import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { FEATURE_SKUS, billableProviderCost, billableQuantity } from '../server/billing/catalog.mjs';
import { getVideoProduct, routeReachability } from '../server/videoCatalog.mjs';
import { createVideoGeneration } from '../server/videoGeneration.mjs';
import { createVolcLipSyncAdapter, volcLipSyncReadiness } from '../server/volcLipSync.mjs';

/* ═══ 2026-09-26 批 AU：**数字人（火山口型对齐）**整条链路 ═══════════════════════════════════════
   用户口径：「数字人要不要用对口型的，你先看一下知渔他们那边是什么策略」→「**数字人你也可以做**」。
   知渔策略（docs/design/72 实查）：他们的"数字人"就是换口型，入参 source_video_url + source_audio_url，
   整条流水线里这一档卖 2.40 积分/分钟。我们照同一形态，上游换成火山 AI MediaKit 口型对齐（1 元/分钟）。

   ⚠️ 这一批**一次付费调用都没发**（也没有素材）⇒ 端到端全部用**假 MediaKit**（注入 fetchImpl）跑：
      不联网、不花钱，但走的是生产同一份代码（真适配器 + 真作业流水线 + 真计费）。
   判据六条：
     ① 产品契约：videoProcess + credential 'volc' + routeId 指向口型对齐；**多要一段音频**（localSpec.audio）；
        台账 unverified、产品与 SKU 都 public:false（没实测就不许公开 —— 与字幕擦除那条同一把尺）；
     ② 适配器契约：POST /tools/lip-sync、Bearer 鉴权、body 是 video_url + audio_url + enable_video_loop，
        **没有** mode / model_version（口型对齐的参数表与字幕擦除不同，逐字核对过官方文档）；
     ③ `enable_video_loop` 必须是 true：按秒收费的口径是**音频秒数**，用默认的截断策略会"收 20 秒的钱交 10 秒的货"；
     ④ 建单：缺人物视频 / 缺驱动音频一律 400 且**不建单不冻结积分**（用户补个文件就能过，不该扣了钱才说）；
     ⑤ 上传：视频与音频各走一次 mediakit:// 票据（两个文件都要传，只传视频会让上游回 must specify audio_url）；
     ⑥ 计费：按秒档数量 = 秒数；落库成本 = (1 元/60) × 秒数；0.12 积分/秒 的面值毛利过 40% 地板。 */

const PRODUCT_ID = 'lipsync_volc';
const MEDIAKIT = 'https://mediakit.example.test/api/v1';

function harness(t, { volcApiKey = 'AKLT-test-key', handler } = {}) {
  const db = new Database(':memory:');
  const assetRoot = mkdtempSync(join(tmpdir(), 'shubao-lipsync-'));
  const calls = [];
  const holds = [];
  t.after(() => {
    /* ⚠️ 先关服务再删目录（与批 AR 那条同一条纪律）：顺序反了会"测试结束后仍有异步活动" */
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
    fetchImpl: async url => { throw new Error('生成上游不该被调用: ' + url); },
    volcApiKey,
    volcFetchImpl: fetchImpl,
    maxConcurrent: 2,
    assetSigningSecret: 'test-lipsync-signing-secret',
    /* 产品故意 public:false（未实测 + 价未签字）⇒ 内部可建单靠这个口子，生产用不到它 */
    allowHiddenProducts: true,
  });
  return { service, db, calls, holds };
}

/* 假 MediaKit：两次票据（视频 + 音频）→ 两次上传 → 提交口型对齐 → 轮询 completed → 下载成片 */
function fakeMediakit() {
  const state = { tickets: 0, polls: 0 };
  return async (url, options = {}, calls = []) => {
    const json = payload => new Response(JSON.stringify(payload), { status: 200, headers: { 'content-type': 'application/json' } });
    if (url.endsWith('/tools-sync/request-media-upload-url')) {
      state.tickets += 1;
      return json({
        success: true,
        result: {
          file_id: `mediakit://file-${state.tickets}`,
          method: 'PUT',
          upload_headers: [],
          upload_url: `https://tos.example.test/put?sig=${state.tickets}`,
        },
      });
    }
    if (url.startsWith('https://tos.example.test/put')) return new Response('', { status: 200 });
    if (url.endsWith('/tools/lip-sync')) {
      return json({ success: true, task_id: 'lip-task-1', request_id: 'req-1' });
    }
    if (url.includes('/tasks/lip-task-1')) {
      state.polls += 1;
      if (state.polls === 1) return json({ success: true, status: 'running' });
      /* 官方文档给的完成态形状：result.video_url + result.duration（duration 就是计费口径） */
      return json({ success: true, status: 'completed', result: { video_url: 'https://cdn.example.test/lipsync.mp4', duration: 6.5 } });
    }
    if (url.startsWith('https://cdn.example.test/lipsync.mp4')) {
      const bytes = Buffer.from('00000018667479706d703432000000006d70343269736f6d', 'hex');
      return new Response(bytes, { status: 200, headers: { 'content-type': 'video/mp4', 'content-length': String(bytes.length) } });
    }
    throw new Error('假 MediaKit 没有这条路由: ' + url + '（calls=' + calls.length + '）');
  };
}

const videoBuffer = () => Buffer.concat([Buffer.from('00000018667479706d703432', 'hex'), Buffer.alloc(2048)]);
const audioBuffer = () => Buffer.concat([Buffer.from('49443303000000000000', 'hex'), Buffer.alloc(1024)]);

async function uploadInputs(service, ownerEmail) {
  const video = await service.uploadAsset({ ownerEmail, kind: 'video', contentType: 'video/mp4', buffer: videoBuffer(), publicBaseUrl: 'https://example.com' });
  const audio = await service.uploadAsset({ ownerEmail, kind: 'audio', contentType: 'audio/mpeg', buffer: audioBuffer(), publicBaseUrl: 'https://example.com' });
  return { video, audio };
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

test('① 产品与收费项：多要一段音频、按音频秒计费、未实测前一律 public:false', () => {
  const product = getVideoProduct(PRODUCT_ID);
  assert.equal(product.videoProcess, true, '与字幕擦除同属"处理已有视频"这一类（上游执行）');
  assert.equal(product.credential, 'volc', '走同一把 MediaKit Key');
  assert.equal(product.routeId, 'volc-media-kit-lipsync');
  assert.equal(product.localSpec.audio, true, '这一条**多要一段驱动音频**（产出长度由它决定）');
  assert.equal(product.localSpec.regions, false, '口型对齐不需要框选');
  assert.deepEqual(product.limits, { images: 0, videos: 1, audios: 1, total: 2 });
  assert.equal(product.public, false, '没跑过一次真调用 ⇒ 不许公开（同字幕擦除那条的尺子）');
  assert.equal(routeReachability(product.routeId).state, 'unverified', '台账状态必须如实记 unverified');
  assert.match(String(routeReachability(product.routeId).evidence), /2026-09-26/, '台账要写清日期与为什么未验证');

  const short = FEATURE_SKUS.video_lipsync_volc_short;
  const long = FEATURE_SKUS.video_lipsync_volc_long;
  assert.equal(short.units, 120, '0.12 积分/秒 = 120 units/秒');
  assert.equal(long.units, 120);
  assert.equal(short.perSecond, true, '按秒计费（数量 = 音频秒数）');
  assert.equal(short.public, false, '价未签字 + 未实测 ⇒ 收费项不许公开');
  assert.equal(long.public, false);
  /* 上游成本口径：1 元/分钟 ⇒ 每秒 ¥1/60（按秒归一，与 units 同口径） */
  assert.ok(Math.abs(short.providerCostCny - 1 / 60) < 1e-9, '成本按"每秒"记');
  assert.ok(Math.abs(billableProviderCost({ sku: 'video_lipsync_volc_short', quantity: 6 }) - 6 / 60) < 1e-9,
    '落库成本 = 6 秒 × ¥1/60 = ¥0.1');
  /* 面值毛利要过 40% 地板：面值 120 units × 0.0002618 = ¥0.03142，成本 ¥0.016667 ⇒ 46.9% */
  const faceValue = 120 * (199 / 760000);
  assert.ok((faceValue - 1 / 60) / faceValue >= 0.4, '0.12 积分/秒 的毛利过引流带地板');
  assert.equal(billableQuantity({ sku: 'video_lipsync_volc_short', seconds: 12 }), 12, '按秒档：数量 = 秒数');
});

test('② 适配器契约：/tools/lip-sync、Bearer、只有 video_url + audio_url（没有 mode/model_version）', async () => {
  const seen = [];
  const adapter = createVolcLipSyncAdapter({
    apiKey: 'AKLT-k',
    baseUrl: MEDIAKIT,
    fetchImpl: async (url, options = {}) => {
      seen.push({ url: String(url), auth: options.headers?.Authorization, body: options.body ? JSON.parse(options.body) : null });
      return new Response(JSON.stringify({ success: true, task_id: 't-1' }), { status: 200, headers: { 'content-type': 'application/json' } });
    },
  });
  const task = await adapter.submit({ videoUrl: 'mediakit://v1', audioUrl: 'mediakit://a1' }, 'idem-1');
  assert.equal(task.id, 't-1');
  assert.equal(seen[0].url, `${MEDIAKIT}/tools/lip-sync`, '路径照官方文档（没有 -pro / 精细化版）');
  assert.equal(seen[0].auth, 'Bearer AKLT-k', '鉴权是 Bearer API Key');
  assert.equal(seen[0].body.video_url, 'mediakit://v1');
  assert.equal(seen[0].body.audio_url, 'mediakit://a1');
  assert.equal(seen[0].body.enable_video_loop, true, '默认就该是 true：按音频时长出片（见下面第三条的理由）');
  assert.equal(seen[0].body.client_token, 'idem-1');
  assert.equal(seen[0].body.mode, undefined, '口型对齐**没有** mode 字段（逐字核对过参数表）');
  assert.equal(seen[0].body.model_version, undefined, '也**没有** model_version');

  /* 缺音频：这是我们自己的输入错（不是上游），要有明确 code —— 上游那句 must specify audio_url 太晚 */
  await assert.rejects(() => adapter.submit({ videoUrl: 'mediakit://v1' }), error => {
    assert.equal(error.code, 'VOLC_LIPSYNC_AUDIO_REQUIRED');
    return true;
  });
  await assert.rejects(() => adapter.submit({ audioUrl: 'mediakit://a1' }), error => {
    assert.equal(error.code, 'VOLC_LIPSYNC_VIDEO_REQUIRED');
    return true;
  });
  /* 缺 Key 时不许假装能用 */
  const off = createVolcLipSyncAdapter({ apiKey: '', baseUrl: MEDIAKIT, fetchImpl: async () => { throw new Error('不该发请求'); } });
  assert.equal(off.enabled, false);
  await assert.rejects(() => off.submit({ videoUrl: 'mediakit://v1', audioUrl: 'mediakit://a1' }),
    error => error.code === 'VOLC_LIPSYNC_NOT_CONFIGURED');
  assert.equal(volcLipSyncReadiness('').configured, false);
  assert.match(volcLipSyncReadiness('').reason, /API Key/);
});

test('③ 启用循环：按秒收费的口径是音频秒数，默认截断策略会「收 20 秒的钱、交 10 秒的货」', async () => {
  let body = null;
  const adapter = createVolcLipSyncAdapter({
    apiKey: 'AKLT-k',
    baseUrl: MEDIAKIT,
    fetchImpl: async (_url, options = {}) => {
      body = JSON.parse(options.body);
      return new Response(JSON.stringify({ success: true, task_id: 't-2' }), { status: 200, headers: { 'content-type': 'application/json' } });
    },
  });
  await adapter.submit({ videoUrl: 'mediakit://v', audioUrl: 'mediakit://a' });
  assert.equal(body.enable_video_loop, true, '默认打开（不显式传就是官方默认的 false ＝ 截断，账就错了）');
  await adapter.submit({ videoUrl: 'mediakit://v', audioUrl: 'mediakit://a', enableVideoLoop: false });
  assert.equal(body.enable_video_loop, false, '显式关掉仍然尊重（留一个可测的开关，别把口径写死）');
});

test('④ 建单契约：一条人物视频 + 一段驱动配音；缺任何一个都 400 且不建单不冻结不请求上游', async t => {
  const { service, db, holds, calls } = harness(t, { handler: fakeMediakit() });
  const owner = 'owner@example.com';
  const { video, audio } = await uploadInputs(service, owner);
  const base = { ownerEmail: owner, billingQuoteId: 'quote-lip', publicBaseUrl: 'https://example.com' };

  /* 缺人物视频 */
  await assert.rejects(service.createJob({
    ...base, idempotencyKey: 'lip-no-video', input: { productId: PRODUCT_ID, duration: 6, references: { audios: [audio.id] } },
  }), error => error?.code === 'VIDEO_LOCAL_SOURCE_REQUIRED');
  /* 缺驱动音频 —— 这是本批新增的那道闸（上游会回 must specify audio_url，但不能等到扣了钱才说） */
  await assert.rejects(service.createJob({
    ...base, idempotencyKey: 'lip-no-audio', input: { productId: PRODUCT_ID, duration: 6, references: { videos: [video.id] } },
  }), error => error?.code === 'VIDEO_AUDIO_REFERENCE_REQUIRED');
  /* 缺时长 */
  await assert.rejects(service.createJob({
    ...base, idempotencyKey: 'lip-no-duration', input: { productId: PRODUCT_ID, references: { videos: [video.id], audios: [audio.id] } },
  }), error => error?.code === 'LOCAL_PLAN_DURATION_INVALID');
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM video_jobs').get().count, 0, '无效请求不许建单');
  assert.equal(holds.length, 0, '更不能冻结积分');
  assert.equal(calls.length, 0, '校验失败时一次上游请求都不该发（连上传都不发）');

  /* 合规请求：视频 + 音频 + 时长 ⇒ 建单并跑通（没有提示词、没有比例、没有方案闸门） */
  const created = await service.createJob({
    ...base,
    idempotencyKey: 'lip-ok',
    input: { productId: PRODUCT_ID, duration: 6, references: { videos: [video.id], audios: [audio.id] } },
  });
  const settled = await waitForSettled(service, owner, created.job.id);
  assert.equal(settled.status, 'completed', settled.error || '应当跑通');
  assert.equal(settled.deliveryState, 'verified', '要有可交付的成片（落库那条通道与字幕擦除共用）');
  const row = db.prepare('SELECT mode, aspect_ratio, prompt, local_specs FROM video_jobs WHERE id = ?').get(created.job.id);
  assert.equal(row.mode, 'process', '处理已有视频那一类（不是生成）');
  assert.equal(row.aspect_ratio, '', '不改比例 ⇒ 不冒充一个没用过的比例');
  assert.equal(row.prompt, '', '这条路没有提示词');
  assert.match(String(row.local_specs), /"audio":true/, '输入契约（要音频）要落库，便于事后对账');
});

test('⑤ 上传与提交：视频和音频**各上传一次**换 mediakit://，提交打到口型对齐那条端点', async t => {
  const { service, calls } = harness(t, { handler: fakeMediakit() });
  const owner = 'owner@example.com';
  const { video, audio } = await uploadInputs(service, owner);
  const created = await service.createJob({
    ownerEmail: owner,
    billingQuoteId: 'quote-lip-2',
    publicBaseUrl: 'https://example.com',
    idempotencyKey: 'lip-upload',
    input: { productId: PRODUCT_ID, duration: 6, references: { videos: [video.id], audios: [audio.id] } },
  });
  await waitForSettled(service, owner, created.job.id);

  const tickets = calls.filter(call => call.url.endsWith('/tools-sync/request-media-upload-url'));
  assert.equal(tickets.length, 2, '视频与音频各要一张票据（只传视频会让上游回 must specify audio_url）');
  const uploads = calls.filter(call => call.url.startsWith('https://tos.example.test/put'));
  assert.equal(uploads.length, 2, '两次都是纯二进制 PUT');
  assert.equal(uploads.every(call => call.headers['Content-Type'] === 'application/octet-stream'), true, '严禁 multipart');
  const submit = calls.find(call => call.url.endsWith('/tools/lip-sync'));
  assert.ok(submit, '必须提交到口型对齐那条端点');
  const payload = JSON.parse(String(submit.body));
  assert.match(payload.video_url, /^mediakit:\/\//, '视频用 mediakit:// 提交');
  assert.match(payload.audio_url, /^mediakit:\/\//, '音频同样');
  assert.notEqual(payload.video_url, payload.audio_url, '两个文件是两次上传（票据各自一份）');
  /* ⚠️ 分流判据：同一把 Key、同一个 credential，两条路靠 routeId 区分 —— 不许把数字人提到字幕擦除的接口上 */
  assert.equal(calls.some(call => call.url.includes('erase-video-subtitle')), false, '数字人不许打到字幕擦除端点');
  assert.ok(calls.some(call => call.url.includes('/tasks/lip-task-1')), '轮询走 /tasks/{id}');
});

test('⑥ 能力位与派发：capabilities.digitalHuman 如实说"还不可用"，原因写清是实测缺还是价没签', async t => {
  const { service } = harness(t, { handler: fakeMediakit() });
  const capabilities = service.capabilities();
  assert.equal(capabilities.digitalHuman.productId, PRODUCT_ID);
  assert.equal(capabilities.digitalHuman.requiresAudio, true);
  assert.equal(capabilities.digitalHuman.available, false, '未实测 + 价未签字 ⇒ 前端必须保持不可点');
  assert.match(String(capabilities.digitalHuman.reason), /实测|定价/, '原因要写清是"没跑过"还是"价没定"，不许写安慰话');
  assert.equal(capabilities.digitalHuman.billingQuantity, 'seconds', '报价按秒（与 SKU 的 perSecond 一致）');
  assert.equal(capabilities.digitalHuman.quotes.short.sku, 'video_lipsync_volc_short');
  /* 它**不进**模型清单（不是模型），也不进本地方案清单（不是本机） */
  assert.equal(capabilities.products.some(product => product.id === PRODUCT_ID), false, '数字人不许出现在模型下拉里');
  assert.equal(capabilities.localProducts.some(product => product.id === PRODUCT_ID), false, '也不在本机清单里');

  /* 没配 Key 时：原因换成"缺哪把钥匙"，且建单 503（不建单不冻结） */
  const noKey = harness(t, { handler: fakeMediakit(), volcApiKey: '' });
  assert.equal(noKey.service.capabilities().digitalHuman.available, false);
  assert.match(String(noKey.service.capabilities().digitalHuman.reason), /API Key/);
});
