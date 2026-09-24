import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  CONTENT_REJECTION_MESSAGE,
  classifyContentRejection,
  contentRejectionError,
  isContentRejectionError,
} from '../server/contentRejection.mjs';
import { generateCompleteImageSet } from '../server/contentImageGeneration.mjs';
import { createNanoBananaProviderAdapter, NANO_UPSTREAM_MODELS } from '../server/ecommerceEngine/nanoBananaProviderAdapter.mjs';
import { createVideoGeneration } from '../server/videoGeneration.mjs';

/* ═══ 2026-09-24 批 BA：**上游内容策略拒绝的翻译层**（docs/design/75 §三.2 的第二条）═══════════════
   用户口径（原话）：
     「有这种内容肯定是要**直接拒**的」
     「**为什么还要重新花钱呢**，用户上传素材和提示词不是本来就要识别一次吗…
       没有低成本的过滤方案吗」
     「用户上传的素材和提示词都应该先过一遍没问题再传输生成，其实也是**防止我们被中转站给 ban 掉**」
   第一阶段（批 AX）是**出站之前**的本地词表（零成本）；这一批处理**漏过去之后**：
   上游自己按内容政策把这一单拒了，而我们现在把它当成"我们的故障"透给用户 ——
   用户看到"生成失败，请重试"，于是**原样再点一次**，同一份内容再撞一次墙（每次都在烧上游的钱）。

   四件事，逐件守：
     ① 认出来（判据只用**上游返回体里那段已经拿到手的文本**，不猜字段名）；
     ② 换成一句用户能照着做的中文（"更换素材或提示词"）；
     ③ **不重试**（内容问题重试一百次也是同一个结果）；
     ④ **退费口径一个字不改**（该退的照旧退，见下面第 ④ 条）。
   ⚠️ 这一批**一次付费调用都没发**：全部用注入的假上游，不联网、不花钱。 */

test('① 认得出上游的内容拒绝，且**不误判**非内容故障（这是省钱与不误导的分界线）', () => {
  /* ── 正样本：三族真实措辞（OpenAI 兼容网关 / Gemini 族 / 国内中转站与火山） ── */
  const positives = [
    ['OpenAI 兼容网关（英）', 400, '{"error":{"message":"Your request was rejected as a result of our safety system.","type":"invalid_request_error"}}'],
    ['Gemini 族（英）', 400, 'The response was blocked due to safety reasons (SAFETY).'],
    ['内容政策（英）', 403, 'content_policy_violation: this prompt is not allowed'],
    ['国内中转站（中）', 400, '{"error":{"message":"提示词或素材内容审核不通过，请调整后重试"}}'],
    ['火山 MediaKit（中）', 400, '{"message":"输入视频包含违规内容，已被拒绝"}'],
    ['涉敏（中）', 422, '图片包含敏感信息，已拦截'],
  ];
  for (const [label, status, detail] of positives) {
    const result = classifyContentRejection({ status, detail });
    assert.equal(result.rejected, true, label + ' 应当被认成内容拒绝：' + detail);
  }
  /* ── 负样本：这些**不是**内容问题，判错会让用户去改一份本来没问题的素材 ── */
  const negatives = [
    ['额度不足', 400, 'insufficient_user_quota: 当前分组额度不足'],
    ['限流', 429, 'rate limit exceeded, please retry later'],
    ['超时', 504, 'upstream gateway timeout'],
    ['模型不存在', 404, 'The model `sd-2.0-720p` does not exist'],
    ['参数错误', 400, 'invalid_duration: 时长只支持 5/10/15 秒'],
    ['鉴权失败', 401, 'invalid api key'],
    ['5xx（上游自己的故障，不该借内容的名义拦下用户）', 500, 'internal error, safety module crashed'],
    ['空响应体', 400, ''],
  ];
  for (const [label, status, detail] of negatives) {
    assert.equal(classifyContentRejection({ status, detail }).rejected, false, label + ' 不该判成内容拒绝：' + detail);
  }
  /* 错误形状：不重试 + 400（客户端输入问题，不是我们的故障 —— 与第一阶段同一条纪律） */
  const error = contentRejectionError('safety system', { status: 400 });
  assert.equal(error.message, CONTENT_REJECTION_MESSAGE);
  assert.equal(error.retryable, false, '内容问题不许重试');
  assert.equal(error.status, 400, 'HTTP 语义取 400（不是 5xx）');
  assert.equal(isContentRejectionError(error), true);
  assert.equal(isContentRejectionError(new Error('普通失败')), false);
  /* 中文文案必须带出"下一步做什么"（"重试"这三个动作里，用户能做的只有换素材） */
  assert.match(CONTENT_REJECTION_MESSAGE, /更换/);
  assert.match(CONTENT_REJECTION_MESSAGE, /没有扣费|未扣费/);
});

test('② 图片（nano 直连）：内容拒绝换中文、**且只发一次请求**（不重试 = 不重复花钱）', async () => {
  const calls = [];
  const adapter = createNanoBananaProviderAdapter({
    apiKey: 'test-key-that-is-long-enough',
    baseUrl: 'https://provider.example',
    publicBaseUrl: 'http://127.0.0.1:3002',
    retryDelaysMs: [1, 1, 1],
    sleepImpl: () => Promise.resolve(),
    fetchImpl: async url => {
      calls.push(String(url));
      if (String(url).endsWith('/v1/models')) return new Response(JSON.stringify({ data: [{ id: NANO_UPSTREAM_MODELS.flash }] }), { status: 200 });
      return new Response(JSON.stringify({ error: { message: 'The response was blocked due to safety reasons.' } }), { status: 400 });
    },
    generatedAssetStore: {
      async persistBuffer() { throw new Error('不该走到落库'); },
      async read() { return null; },
    },
  });
  await assert.rejects(
    () => adapter.submitEdit({
      idempotencyKey: 'nano-content',
      prompt: '违规素材',
      modelRoute: { imageModel: 'nano-banana-2', model: NANO_UPSTREAM_MODELS.flash, resolution: '2K', ratio: '3:4' },
      inputAssets: [],
    }),
    error => {
      assert.equal(error.code, 'CONTENT_REJECTED');
      assert.equal(error.message, CONTENT_REJECTION_MESSAGE);
      assert.equal(error.retryable, false, '不许重试（重试就是重复花钱）');
      return true;
    },
  );
  const generateCalls = calls.filter(url => url.includes(':generateContent'));
  assert.equal(generateCalls.length, 1, '内容拒绝只发一次请求（原来 400 会被当成 GENERATION_FAILED，但那不是重点；重点是**不能**变成"忙"而重排队）');
});

test('③ 图片（成套生成）：内容拒绝不许说成"服务不可用、我们会重试"，且不重跑', async () => {
  const attempts = [];
  await assert.rejects(
    () => generateCompleteImageSet({
      tasks: [{ id: 'a' }, { id: 'b' }],
      primaryAttempts: 3,
      recoveryAttempts: 3,
      delay: () => Promise.resolve(),
      execute: async task => {
        attempts.push(task.id);
        throw contentRejectionError('content_policy_violation');
      },
    }),
    error => {
      assert.equal(error.code, 'CONTENT_REJECTED');
      assert.equal(error.message, CONTENT_REJECTION_MESSAGE, '不许再说"图片服务暂时不可用，系统已自动重试"');
      assert.equal(error.retryable, false, '内容问题不许进恢复队列');
      return true;
    },
  );
  assert.deepEqual([...new Set(attempts)].sort(), ['a', 'b'], '两个任务都只跑一遍');
  assert.equal(attempts.length, 2, '重试次数 = 0（3 次重试全都不许发生）');
});

function videoHarness(t, { handler } = {}) {
  const db = new Database(':memory:');
  const assetRoot = mkdtempSync(join(tmpdir(), 'shubao-content-reject-'));
  const released = [];
  const calls = [];
  t.after(() => { service.close(); db.close(); rmSync(assetRoot, { recursive: true, force: true }); });
  /* ⚠️ 这个假上游**必须真的接进 createVideoGeneration**（第一次写成了另一个 throwing fetchImpl，
      结果两类失败都走到"提交结果未知 → 待人工核对"，看起来像我的改动没生效 —— 其实是探针接错了）。 */
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url: String(url), method: options.method || 'GET', body: options.body });
    return handler(String(url), options);
  };
  const service = createVideoGeneration({
    db,
    walletService: {
      createHold() { return { id: 'hold-1', status: 'held' }; },
      getBalance() { return { unlimited: false, availableUnits: 999999 }; },
      settleItem() { return { status: 'settled' }; },
      releaseItem(holdId, key, input) { released.push({ holdId, key, reason: input?.reason }); return { status: 'released' }; },
    },
    quoteService: { verify({ quoteId, ownerEmail, expectedQuote }) { return { quoteId, ownerEmail, currency: expectedQuote.currency, expiresAt: '2099-01-01T00:00:00.000Z' }; } },
    upsertWork() {},
    assetRoot,
    apiKey: 'test-key',
    fetchImpl,
    maxConcurrent: 1,
    assetSigningSecret: 'test-content-rejection-secret',
  });
  return { service, db, calls, released };
}

const videoBuffer = () => Buffer.concat([Buffer.from('00000018667479706d703432', 'hex'), Buffer.alloc(1024)]);

async function waitForSettled(service, ownerEmail, jobId, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs;
  let job = service.getJob(ownerEmail, jobId);
  while (Date.now() < deadline && !['completed', 'failed', 'needs_review'].includes(job.status)) {
    await new Promise(resolve => setTimeout(resolve, 25));
    job = service.getJob(ownerEmail, jobId);
  }
  return job;
}

async function createUpstreamJob(service, owner) {
  const asset = await service.uploadAsset({ ownerEmail: owner, kind: 'video', contentType: 'video/mp4', buffer: videoBuffer(), publicBaseUrl: 'https://example.com' });
  return service.createJob({
    ownerEmail: owner,
    billingQuoteId: 'quote-content',
    publicBaseUrl: 'https://example.com',
    idempotencyKey: 'content-job',
    input: {
      productId: 'seedance_standard',
      prompt: '一段商品展示',
      negativePrompt: '',
      duration: 5,
      aspectRatio: '9:16',
      resolution: '720p',
      generateAudio: false,
      /* 上游那条路要**已确认的方案**才建单（收过那 1 积分的方案分析费）——
         这里给一份最小可用方案，免得测试撞在闸门上（那不是本文件要验的东西）。 */
      videoPlan: { optimizedPrompt: '按已确认方案出片：商品居中，缓慢推近', beats: [{ time: '0-3s', label: '展示' }, { time: '3-5s', label: '收尾' }] },
      planConfirmed: true,
      references: { videos: [asset.id] },
    },
  });
}

test('④ 视频：上游判违规 ⇒ 用户看到"换素材"、不切备用网关、退费照旧（钱的口径一个字没改）', async t => {
  const { service, released, calls } = videoHarness(t, {
    handler: async url => (String(url).includes('/videos')
      ? new Response(JSON.stringify({ error: { message: 'Your request was rejected as a result of our safety system.' } }), { status: 400 })
      : new Response('{}', { status: 200 })),
  });
  const owner = 'owner@example.com';
  const created = await createUpstreamJob(service, owner);
  const settled = await waitForSettled(service, owner, created.job.id);
  assert.equal(settled.status, 'failed');
  assert.equal(settled.error, '素材或提示词未通过内容审核，请更换后重试（冻结积分已退回）',
    '用户要看到"下一步做什么"，不是"本次没有交付成片"');
  assert.equal(released.length, 1, '该退的积分照旧退（退费口径没有因为这一批改动）');
  assert.match(String(released[0].reason), /VIDEO_CONTENT_REJECTED/, '退费原因里要看得出是内容拒绝');
  /* 备用网关不切：同一份内容在备用网关必被同样拒一次（省一次调用与一次等待） */
  const submits = calls.filter(call => String(call.url).includes('/videos') && call.method === 'POST');
  assert.equal(submits.length, 1, '内容拒绝不许再往备用网关提一次');
});

test('④b 视频：**普通失败**的文案与退费一字未变（不许把内容拒绝的文案泛化到所有失败）', async t => {
  const { service, released } = videoHarness(t, {
    handler: async url => (String(url).includes('/videos')
      ? new Response(JSON.stringify({ error: { message: 'invalid_duration: 时长只支持 5/10/15 秒' } }), { status: 400 })
      : new Response('{}', { status: 200 })),
  });
  const owner = 'owner@example.com';
  const created = await createUpstreamJob(service, owner);
  const settled = await waitForSettled(service, owner, created.job.id);
  assert.equal(settled.status, 'failed');
  assert.equal(settled.error, '本次没有交付成片，冻结积分已退回', '非内容失败的文案与从前逐字相同');
  assert.equal(released.length, 1);
});
