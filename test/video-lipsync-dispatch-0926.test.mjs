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
        台账 callable、产品与 SKU 都 public:true（批 AZ 接线完成 ⇒ 三样同批翻，价格未动）；
     ② 适配器契约：POST /tools/lip-sync、Bearer 鉴权、body 是 video_url + audio_url + enable_video_loop，
        **没有** mode / model_version（口型对齐的参数表与字幕擦除不同，逐字核对过官方文档）；
     ③ `enable_video_loop` 必须是 true：按秒收费的口径是**音频秒数**，用默认的截断策略会"收 20 秒的钱交 10 秒的货"；
     ④ 建单：缺人物视频 / 缺驱动音频一律 400 且**不建单不冻结积分**（用户补个文件就能过，不该扣了钱才说）；
     ⑤ 上传：视频与音频各走一次 mediakit:// 票据（两个文件都要传，只传视频会让上游回 must specify audio_url）；
     ⑥ 计费与能力位：按秒档数量 = 秒数；落库成本 = (1 元/60) × 秒数；0.12 积分/秒 的面值毛利过 40% 地板；
        capabilities.digitalHuman 把页面要用的那几样（要不要音频 / 露哪几格 / 建单模式 / 时长上限）一并给出。 */

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
    /* ⚠️ 批 AZ：数字人已 public:true，这个口子现在只为**隐藏档**（Seedance 1080P 那种）留着 ——
       本文件仍开着它，是为了让"没公开的产品也能被内部流水线跑到"这件事不依赖公开状态。 */
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
  /* ═══ 2026-09-24 批 AX：真机跑通了一次 ⇒ 台账转 **callable**（判据没变，事实变了）═════════════
     用户原话：「数字人这个，**真人视频你自己可以找呀**，网上一大堆，我们反正只是测试呀」。
     实测：免版权站的单人正脸片段 8.56s + 站内 TTS 中文配音 7.25s →
     任务 **amk-tool-lip-sync-1401540081154** → completed（约 92 秒）→ 成片 **7.28 秒**
     （= 音频时长，`enable_video_loop:true` 生效）→ 成本约 **¥0.1213**；
     抽帧对比确认**嘴型真的跟着配音变了**（.tmp/dh/out/compare.jpg）。
     ⇒ 台账从 unverified 转 callable，证据行写在 videoCatalog 里。
     ⚠️ 但**产品仍是 public:false**，原因变了：不再是"没实测/没定价"，而是**创作台还没接线**
        （upstream-process 引擎在 VideoStudio 里没有音频槽位/时长探针/按音频秒报价那条分支）——
        现在翻公开，用户进这一页会落到上游生成那条默认分支（拿默认模型出一段普通视频）。
        所以这条断言守的仍是"点了必失败的东西不许变成可选的档位"，只是拦的原因换了。 */
  assert.equal(product.public, true, '创作台已接线（批 AZ）⇒ 产品公开：用户进这一页走的是 process 分支，不是上游生成分支');
  assert.equal(routeReachability(product.routeId).state, 'callable', '真机跑通 ⇒ 台账转 callable');
  assert.match(String(routeReachability(product.routeId).evidence), /amk-tool-lip-sync/, '台账要带真实任务号与时长');
  assert.match(String(routeReachability(product.routeId).evidence), /7\.28/, '台账要写清成片时长（计费口径）');

  const short = FEATURE_SKUS.video_lipsync_volc_short;
  const long = FEATURE_SKUS.video_lipsync_volc_long;
  assert.equal(short.units, 120, '0.12 积分/秒 = 120 units/秒');
  assert.equal(long.units, 120);
  assert.equal(short.perSecond, true, '按秒计费（数量 = 音频秒数）');
  /* ═══ 2026-09-26 批 AZ：两道门（实测 / 用户签价）批 AX 已过，批 AZ 把第三道（创作台接线）接完 ══
     用户原话：「数字人价格我不清楚，你调研过知渔他们收多少钱吗，**你利润这块觉得还可以就行**」
     ⇒ 产品与两条 SKU 同批翻 public（与 1080P 的 Seedance 同一套做法：三样一起翻，价格一分未动）。 */
  assert.equal(short.public, true, '接线完成 ⇒ 收费项公开（价格 120 units/秒 一分未动）');
  assert.equal(long.public, true);
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

test('⑥ 能力位与派发：capabilities.digitalHuman 给出页面要用的全部事实，且不进模型清单', async t => {
  const { service } = harness(t, { handler: fakeMediakit() });
  const capabilities = service.capabilities();
  assert.equal(capabilities.digitalHuman.productId, PRODUCT_ID);
  assert.equal(capabilities.digitalHuman.requiresAudio, true);
  /* ═══ 2026-09-26 批 AZ：创作台接线完成 ⇒ 能力位转 **可用** ═══════════════════════════════════
     判据的本意一个字没变（**不可用就绝不让页面点**，原因如实写清），变的是事实：
     批 AU 时"没实测 + 价没签字"、批 AX 时"创作台没接线"，本批把接线做完 ⇒ available: true、
     reason 为空串（可售时不该编一句理由出来）。 */
  assert.equal(capabilities.digitalHuman.available, true, '接线完成 + 产品公开 + 凭据在 ⇒ 可用');
  assert.equal(capabilities.digitalHuman.reason, '', '可售时不许编理由（reason 只在不可用时写清是哪一道没过）');
  assert.equal(capabilities.digitalHuman.billingQuantity, 'seconds', '报价按秒（与 SKU 的 perSecond 一致）');
  assert.equal(capabilities.digitalHuman.quotes.short.sku, 'video_lipsync_volc_short');
  /* ═══ 页面要用的那几样必须由**服务端产品声明**给出去（批 AZ）═══════════════════════════════
     原来页面自己写死了"要音频 / 不露规格 / 按秒"这几条判据 —— 那是产品目录之外的第二份真相，
     目录一改页面不会跟着改。⇒ 与 localProducts 同一形状从这里取，页面只读不算。 */
  assert.equal(capabilities.digitalHuman.localSpec.audio, true, '要驱动音频这条判据来自产品声明');
  assert.deepEqual(capabilities.digitalHuman.modes, ['process'], '建单模式也来自产品声明（本机那两条是 local）');
  assert.deepEqual(capabilities.digitalHuman.durations, { min: 1, max: 1800 }, '时长上限（30 分钟）给页面算探针上限');
  assert.match(String(capabilities.digitalHuman.label), /数字人/, '按钮与标题要用产品名，不在页面里另起一个');
  /* 它**不进**模型清单（不是模型），也不进本地方案清单（不是本机） */
  assert.equal(capabilities.products.some(product => product.id === PRODUCT_ID), false, '数字人不许出现在模型下拉里');
  assert.equal(capabilities.localProducts.some(product => product.id === PRODUCT_ID), false, '也不在本机清单里');
  /* ⚠️ 自动标记那一档同样要给出"露哪几格 / 建单模式 / 时长上限"（同一批做的推广） */
  assert.equal(capabilities.subtitleAuto.localSpec.auto, true);
  assert.deepEqual(capabilities.subtitleAuto.modes, ['process']);

  /* 没配 Key 时：原因换成"缺哪把钥匙"，且建单 503（不建单不冻结） */
  const noKey = harness(t, { handler: fakeMediakit(), volcApiKey: '' });
  assert.equal(noKey.service.capabilities().digitalHuman.available, false);
  assert.match(String(noKey.service.capabilities().digitalHuman.reason), /API Key/);
});
