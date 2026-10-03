import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { FEATURE_SKUS, billableProviderCost, billableQuantity } from '../server/billing/catalog.mjs';
import { getVideoProduct, routeReachability } from '../server/videoCatalog.mjs';
import { createVideoGeneration } from '../server/videoGeneration.mjs';

/* ═══ 2026-09-26 批 AR：**自动标记**（火山 AI MediaKit 字幕擦除）整条链路 ═════════════════════════
   用户拍板：「我觉得自己接去字幕很麻烦，**不如就直接接火山API**吧」+「**自动标记卖多少就按你说的来吧**」。

   这一批的核心难点是：**账户未充值**（火山后付费也要余额）⇒ 一次付费调用都不能发。
   所以这里的端到端用**假 MediaKit**（注入 fetchImpl）跑：不联网、不花钱，
   但走的是**生产同一份代码**（真适配器 + 真作业流水线 + 真计费）。
   判据六条：
     ① 收费项：0.05 积分/秒（50 units/秒，用户批的价）、按秒计费、public:false（未实测不许公开）；
     ② 建单：process 产品走"源视频 + 时长"契约（没有提示词/比例/方案闸门），缺视频或时长一律 400 且不收费；
     ③ 上传：站内片子先换 `mediakit://{file_id}`（纯二进制 PUT），提交时用它当 video_url；
     ④ 提交与轮询：POST 到火山那条路径、Authorization: Bearer、mode=Subtitle；轮询到 completed 后下载落库；
     ⑤ 计费数量与成本：按秒档 = 秒数份数；落库成本 = 单价成本 × 秒数（结算时真正记账的数）；
     ⑥ 凭据门禁：没配 Key 时建单 503（不建单、不冻结积分）。 */

const PRODUCT_ID = 'desubtitle_volc';
const MEDIAKIT = 'https://mediakit.example.test/api/v1';

/* 一小段**真** mp4：上传那一步要读文件（我们验证的是"上传走了纯二进制"，文件内容不必是有效视频） */
function harness(t, { volcApiKey = 'AKLT-test-key', handler } = {}) {
  const db = new Database(':memory:');
  const assetRoot = mkdtempSync(join(tmpdir(), 'shubao-volc-'));
  const calls = [];
  const holds = [];
  t.after(() => {
    /* ⚠️ 先关服务再删目录：本地任务表、队列、对账定时器都在服务里，
       顺序反了就会出现"测试结束后仍有异步活动"（本仓第一次就踩到 ENOENT 那一版）。 */
    service.close();
    db.close();
    rmSync(assetRoot, { recursive: true, force: true });
  });
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url: String(url), method: options.method || 'GET', headers: options.headers || {}, body: options.body });
    return handler(String(url), options, calls);
  };
  const service = createVideoGeneration({
    db,
    walletService: {
      createHold(input) { holds.push(input); return { id: `hold-${holds.length}`, status: 'held' }; },
      getBalance() { return { unlimited: false, availableUnits: 999999 }; },
      settleItem() { return { status: 'settled' }; },
      releaseItem() { return { status: 'released' }; },
    },
    quoteService: {
      verify({ quoteId, ownerEmail, expectedQuote }) {
        return { quoteId, ownerEmail, currency: expectedQuote.currency, expiresAt: '2099-01-01T00:00:00.000Z' };
      },
    },
    upsertWork() {},
    assetRoot,
    apiKey: 'test-key',
    /* 上游**生成**那条路的 fetch：这些用例里一次都不该被调用（本地方案/火山都不是"生成"） */
    fetchImpl: async url => { throw new Error('生成上游不该被调用: ' + url); },
    volcApiKey,
    volcFetchImpl: fetchImpl,
    maxConcurrent: 2,
    assetSigningSecret: 'test-volc-signing-secret',
    /* ⚠️ 这个产品**故意** public:false（没跑过一次真片子就不许公开，见批 AP/AR 的注释）；
       但它的代码路径必须被端到端测到 —— allowHiddenProducts 就是为这种"内部可建单、对外不公开"
       的场景准备的口子（生产上用不到它）。 */
    allowHiddenProducts: true,
  });
  return { service, db, calls, holds };
}

/* 假 MediaKit：票据 → 上传 → 提交 → 轮询（第一次 running、第二次 completed）→ 下载成片 */
function fakeMediakit() {
  const state = { polls: 0 };
  return async (url, options = {}, calls = []) => {
    if (url.endsWith('/tools-sync/request-media-upload-url')) {
      /* 字段名照 2026-09-26 实测（响应在 result 里、file_id 自带 mediakit://） */
      return new Response(JSON.stringify({
        success: true,
        result: { file_id: 'mediakit://file-777', method: 'PUT', upload_headers: [], upload_url: 'https://tos.example.test/put?sig=1' },
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    if (url.startsWith('https://tos.example.test/put')) return new Response('', { status: 200 });
    if (url.endsWith('/tools/erase-video-subtitle')) {
      return new Response(JSON.stringify({ success: true, task_id: 'volc-task-1', request_id: 'req-1' }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    if (url.includes('/tasks/volc-task-1')) {
      state.polls += 1;
      if (state.polls === 1) {
        return new Response(JSON.stringify({ success: true, status: 'running' }), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      return new Response(JSON.stringify({ success: true, status: 'completed', video_url: 'https://cdn.example.test/out.mp4', duration: 6 }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    if (url.startsWith('https://cdn.example.test/out.mp4')) {
      const bytes = Buffer.from('00000018667479706d703432000000006d70343269736f6d', 'hex');
      return new Response(bytes, { status: 200, headers: { 'content-type': 'video/mp4', 'content-length': String(bytes.length) } });
    }
    throw new Error('假 MediaKit 没有这条路由: ' + url + '（calls=' + calls.length + '）');
  };
}

async function uploadSource(service, ownerEmail) {
  const buffer = Buffer.concat([Buffer.from('00000018667479706d703432', 'hex'), Buffer.alloc(2048)]);
  return service.uploadAsset({ ownerEmail, kind: 'video', contentType: 'video/mp4', buffer, publicBaseUrl: 'https://example.com' });
}

async function waitForSettled(service, ownerEmail, jobId, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  let job = service.getJob(ownerEmail, jobId);
  while (Date.now() < deadline && !['completed', 'failed', 'needs_review'].includes(job.status)) {
    await new Promise(resolve => setTimeout(resolve, 25));
    job = service.getJob(ownerEmail, jobId);
  }
  return job;
}

test('① 收费项：0.05 积分/秒、按秒计费、未实测前 public:false（用户已批的价）', () => {
  const short = FEATURE_SKUS.video_desubtitle_volc_short;
  const long = FEATURE_SKUS.video_desubtitle_volc_long;
  assert.equal(short.units, 50, '0.05 积分/秒 = 50 units/秒（用户批的价）');
  assert.equal(long.units, 50);
  assert.equal(short.perSecond, true, '按秒计费');
  /* ═══ 2026-09-26 翻公开（事实变了，判据没变）═══════════════════════════════════════════════════
     判据一直是"跑通一次真片子才许公开"；用户充值 ¥5 后我们真跑了一次（6 秒片 → completed、
     拿到成片地址、扣费约 ¥0.04），所以这两条从 false 变 true —— 变的是事实，不是标准。 */
  assert.equal(short.public, true, '已实测出片 ⇒ 允许公开');
  /* 上游成本口径：0.4 元/分钟 ⇒ 每秒 ¥0.006667（按秒归一） */
  assert.ok(Math.abs(short.providerCostCny - 0.4 / 60) < 1e-6, '成本按"每秒"记（与 units 同归一）');
  /* 落库/结算用的**整单成本**要乘秒数 */
  assert.ok(Math.abs(billableProviderCost({ sku: 'video_desubtitle_volc_short', quantity: 6 }) - 6 * 0.4 / 60) < 1e-9);
  const product = getVideoProduct(PRODUCT_ID);
  assert.equal(product.public, true, '产品随实测一起翻公开');
  assert.equal(product.videoProcess, true, '声明"处理已有视频"这一类');
  assert.equal(product.credential, 'volc');
  assert.deepEqual(product.localSpec, { resolution: false, fps: false, regions: false, auto: true }, '自动档没有用户要填的规格');
  assert.equal(routeReachability(product.routeId).state, 'callable', '实测出片 ⇒ 台账转 callable（证据与日期写在 videoCatalog 里）');
  assert.match(String(routeReachability(product.routeId).evidence), /2026-09-26/, '台账必须有实测日期');
});

test('② 建单契约：源视频 + 时长（无提示词/比例/方案闸门）；缺视频或缺时长一律 400 且不收费', async t => {
  const { service, db, holds, calls } = harness(t, { handler: fakeMediakit() });
  const owner = 'owner@example.com';
  const source = await uploadSource(service, owner);

  const base = {
    ownerEmail: owner,
    billingQuoteId: 'quote-auto',
    publicBaseUrl: 'https://example.com',
  };

  /* 缺源视频 */
  await assert.rejects(service.createJob({ ...base, idempotencyKey: 'auto-no-source', input: { productId: PRODUCT_ID, duration: 6 } }),
    error => error?.code === 'VIDEO_LOCAL_SOURCE_REQUIRED');
  /* 缺时长（前端会去读视频时长；读不出来就不许建单） */
  await assert.rejects(service.createJob({
    ...base, idempotencyKey: 'auto-no-duration', input: { productId: PRODUCT_ID, references: { videos: [source.id] } },
  }), error => error?.code === 'LOCAL_PLAN_DURATION_INVALID');
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM video_jobs').get().count, 0, '无效请求不许建单');
  assert.equal(holds.length, 0, '更不能冻结积分');
  assert.equal(calls.length, 0, '校验失败时一次上游请求都不该发（连上传都不发）');

  /* 合规请求：**没有提示词、没有比例、没有方案** 也要能建单（process 契约） */
  const created = await service.createJob({
    ...base,
    idempotencyKey: 'auto-ok',
    input: { productId: PRODUCT_ID, duration: 6, references: { videos: [source.id] } },
  });
  /* 等它跑完再断言：后台流水线还在读源文件时结束测试，会触发"测试结束后仍有异步活动" */
  const afterRun = await waitForSettled(service, owner, created.job.id);
  assert.equal(afterRun.status, 'completed', afterRun.error || '这条也应当跑通');
  assert.equal(created.job.mode, 'process', '本类产品的模式记 process');
  assert.equal(created.job.sku, 'video_desubtitle_volc_short', '6 秒落短档');
  assert.equal(created.job.duration, 6);
  assert.equal(created.job.aspectRatio, '', '不改比例 ⇒ 不冒充一个没用过的比例');
  assert.equal(holds.length, 1);
  /* ⚠️ 2026-10-04：这一档改成「**≤60 秒一律平价**」（用户原话「这里应该固定一个费用呀…」）。
     6 秒落平价 ⇒ 冻结 3000 units（3 积分），而不是 6 × 50 = 300 units。
     ⇒ 这条断言顺带钉住"用户点之前看到的那个数"：界面上的「预计 3 积分」
     必须与 hold 冻结的 3000 units 是同一个数。 */
  assert.equal(holds[0].items[0].units, FEATURE_SKUS.video_desubtitle_volc_short.flatUnits,
    '6 秒在平价封顶之内 ⇒ 一次调用 = 平价（3 积分）');
  assert.equal(billableQuantity({ sku: 'video_desubtitle_volc_short', seconds: 6 }), 1,
    '封顶之内数量恒为 1');
  /* 而成本必须仍按**真实秒数**记 —— 卖 3 积分不等于只花了 1 秒的钱 */
  assert.equal(created.job.providerCostCny, FEATURE_SKUS.video_desubtitle_volc_short.providerCostCny * 6,
    '成本按真实 6 秒记（¥0.4/分钟 × 0.1 分钟），平价只改卖价不改成本');
});

test('③④⑤ 端到端（假 MediaKit）：上传换 mediakit:// → 提交 → 轮询 → 下载落库 → 结算成本按秒乘', async t => {
  const medias = fakeMediakit();
  const { service, db, calls } = harness(t, { handler: medias });
  const owner = 'owner@example.com';
  const source = await uploadSource(service, owner);

  const created = await service.createJob({
    ownerEmail: owner,
    billingQuoteId: 'quote-auto-e2e',
    idempotencyKey: 'auto-e2e',
    publicBaseUrl: 'https://example.com',
    input: { productId: PRODUCT_ID, duration: 6, references: { videos: [source.id] } },
  });
  const settled = await waitForSettled(service, owner, created.job.id);
  assert.equal(settled.status, 'completed', settled.error || '自动标记应当一次跑通（假 MediaKit）');

  /* 上传那一步：先取票据，再用纯二进制 PUT（文档原文严禁 multipart） */
  const ticket = calls.find(call => call.url.endsWith('/tools-sync/request-media-upload-url'));
  assert.ok(ticket, '必须先取上传票据');
  const upload = calls.find(call => call.url.startsWith('https://tos.example.test/put'));
  assert.ok(upload, '要把站内片子 PUT 给火山');
  assert.equal(upload.method, 'PUT');
  assert.equal(upload.headers['Content-Type'], 'application/octet-stream', '纯二进制流');

  /* 提交：火山那条路径 + Bearer 鉴权 + mode=Subtitle（自动检测） */
  const submit = calls.find(call => call.url.endsWith('/tools/erase-video-subtitle'));
  assert.ok(submit, '要提交擦除任务');
  assert.equal(submit.headers.Authorization, 'Bearer AKLT-test-key');
  const body = JSON.parse(String(submit.body));
  assert.equal(body.video_url, 'mediakit://file-777', '提交时用 mediakit:// 协议（站内签名地址火山拉不到）');
  assert.equal(body.mode, 'Subtitle', '自动检测字幕那一档');
  assert.equal(body.model_version, 'v5');
  assert.ok(!('erase_ratio_location' in body), '自动档不许带手框（与自动检测互斥）');

  /* 轮询：真的轮到 completed（不是一次就当真） */
  assert.ok(calls.filter(call => call.url.includes('/tasks/volc-task-1')).length >= 2, '要轮询到终态');

  /* 成片落库：走既有通道（video_assets + video_deliveries） */
  const assetId = String(settled.resultUrl).match(/\/api\/video\/(?:media|assets)\/([^?]+)/)?.[1] || '';
  const asset = db.prepare('SELECT * FROM video_assets WHERE id = ? AND kind = ?').get(assetId, 'output');
  assert.ok(asset, '成片必须进 video_assets（kind=output）');
  const delivery = db.prepare('SELECT * FROM video_deliveries WHERE job_id = ?').get(created.job.id);
  assert.equal(delivery.verification_state, 'verified', '投递记录必须 verified');

  /* 计费：这一单的**真实成本** = 每秒成本 × 秒数（结算时记账用的就是它） */
  const row = db.prepare('SELECT provider_cost_cny, sku FROM video_jobs WHERE id = ?').get(created.job.id);
  assert.equal(row.sku, 'video_desubtitle_volc_short');
  assert.ok(Math.abs(Number(row.provider_cost_cny) - 6 * (0.4 / 60)) < 1e-9,
    `落库成本应为 ¥${(6 * 0.4 / 60).toFixed(6)}（6 秒 × 每秒 ¥0.006667），实际 ${row.provider_cost_cny}`);
});

test('⑥ 凭据门禁：没配 Key 时建单 503（不建单、不冻结积分、不发请求）', async t => {
  const { service, db, holds, calls } = harness(t, { volcApiKey: '', handler: fakeMediakit() });
  const owner = 'owner@example.com';
  const source = await uploadSource(service, owner);
  await assert.rejects(service.createJob({
    ownerEmail: owner,
    billingQuoteId: 'quote-auto-nokey',
    idempotencyKey: 'auto-nokey',
    publicBaseUrl: 'https://example.com',
    input: { productId: PRODUCT_ID, duration: 6, references: { videos: [source.id] } },
  }), error => {
    assert.equal(error?.code, 'VOLC_SUBTITLE_NOT_CONFIGURED');
    assert.match(String(error?.message), /API Key/, '要说清缺什么');
    return true;
  });
  assert.equal(holds.length, 0, '没配凭据不许冻结积分');
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM video_jobs').get().count, 0, '也不许建单');
  assert.equal(calls.length, 0, '更不许发请求');
});

test('⑦ 上游报错要如实变成"任务失败 + 退费"，不许假装成功', async t => {
  const failing = async url => {
    if (url.endsWith('/tools-sync/request-media-upload-url')) {
      return new Response(JSON.stringify({ success: true, upload_url: 'https://tos.example.test/put', file_id: 'file-x' }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    if (url.startsWith('https://tos.example.test/put')) return new Response('', { status: 200 });
    if (url.endsWith('/tools/erase-video-subtitle')) {
      return new Response(JSON.stringify({ success: false, error: 'video_url 不可访问' }), { status: 400, headers: { 'content-type': 'application/json' } });
    }
    throw new Error('不该走到这里: ' + url);
  };
  const { service, holds } = harness(t, { handler: failing });
  const owner = 'owner@example.com';
  const source = await uploadSource(service, owner);
  const created = await service.createJob({
    ownerEmail: owner,
    billingQuoteId: 'quote-auto-fail',
    idempotencyKey: 'auto-fail',
    publicBaseUrl: 'https://example.com',
    input: { productId: PRODUCT_ID, duration: 6, references: { videos: [source.id] } },
  });
  const settled = await waitForSettled(service, owner, created.job.id);
  assert.equal(settled.status, 'failed', '上游拒绝 ⇒ 任务失败（不产出成片）');
  /* 用户看到的是**站内文案**（不是上游原话、更不是凭据/字段名）：上游细节留在服务端日志与
     失败分类里。这条同时守住两件事 —— 有话说，且不泄漏内部信息。 */
  assert.match(String(settled.error || ''), /退回|失败|没有交付/, '要给用户一句看得懂的话');
  assert.doesNotMatch(String(settled.error || ''), /video_url|Bearer|AKLT|mediakit:\/\//, '不许把上游细节/凭据漏给用户');
  assert.equal(holds.length, 1, '冻结过一次（失败后由既有退费机制处理）');
  assert.equal(settled.billingState, 'released', '失败必须解冻（用户的积分要退回去）');
});
