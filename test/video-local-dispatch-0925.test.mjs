import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import Database from 'better-sqlite3';
import { mkdtempSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { billableProviderCost, billableQuantity, FEATURE_SKUS, quoteFeature, videoMarginGateReport } from '../server/billing/catalog.mjs';
import { localVideoProducts, publicVideoProducts, getVideoProduct } from '../server/videoCatalog.mjs';
import { createVideoGeneration } from '../server/videoGeneration.mjs';
import { ffmpegAvailable, resetFfmpegProbe } from '../server/videoLocalAdapter.mjs';

/* ═══ 2026-09-25 批 AM：**本地方案的派发**（交接第①步的门禁）═════════════════════════════════
   交接文档 docs/design/70 的原话：
     「把派发层挂进作业流水线：server/videoGeneration.mjs 里按产品的 localEngine 选适配器
      （上游走 videoProviders.mjs 的 registry，本地走 createLocalVideoAdapter）……
       改完补一条门禁：**声明了 localEngine 的产品必须走本地适配器**。」

   五条判据（每条都对应一个"不守就会静默跑歪"的风险）：
     ① 派发：localEngine 产品建的单一律走**本机**渲染 —— 上游 fetch 一次都不许被调用
        （否则本地链路会变成"悄悄花钱走上游"，而账上记的是零成本）；
     ② 计费数量：按秒的 SKU 数量 = 秒数（billableQuantity 是唯一事实源），
        按条的 SKU 数量恒为 1 —— 前端报价令牌与服务端 hold 必须用同一个数，否则 409；
     ③ 建单前的校验：缺时长/缺分辨率/缺区域一律 400，且**一条 job 都不许落库**（不收费）；
     ④ 产品清单：本地方案**不进**模型清单（publicVideoProducts），只在 localVideoProducts 里；
     ⑤ 端到端：真 ffmpeg 出片 → 走既有落库（video_assets/video_deliveries 两行 + 成片可读）。
   ⚠️ ⑤ 需要本机 ffmpeg：没有就跳过（与 npm test 的 skip-pattern 同一条思路）。
      其余四条是纯逻辑，任何机器都必须绿。 */

const UPSCALE = 'upscale_local';
const DESUBTITLE = 'desubtitle_local';

/* 一小段**真** mp4（1.2 秒、带音轨）——本地渲染要真的能被 ffmpeg 读，
   所以这个夹具是 ffmpeg 生成的，不是随便写的字节。整个测试文件共用一份，只生成一次。 */
let fixtureCache = null;
function tinyVideoFixture() {
  if (fixtureCache !== null) return fixtureCache;
  const dir = mkdtempSync(join(tmpdir(), 'shubao-local-dispatch-'));
  const file = join(dir, 'tiny.mp4');
  const result = spawnSync('ffmpeg', [
    '-y', '-f', 'lavfi', '-i', 'testsrc2=size=320x240:rate=15:duration=1.2',
    '-f', 'lavfi', '-i', 'sine=frequency=440:duration=1.2',
    '-c:v', 'libx264', '-preset', 'ultrafast', '-c:a', 'aac', '-shortest', file,
  ], { encoding: 'utf8' });
  fixtureCache = result.status === 0 && existsSync(file)
    ? { dir, file, bytes: readFileSync(file) }
    : { dir, file: '', bytes: null };
  return fixtureCache;
}

function harness(t, overrides = {}) {
  const db = new Database(':memory:');
  const assetRoot = mkdtempSync(join(tmpdir(), 'shubao-local-engine-'));
  const holds = [];
  const upstreamCalls = [];
  t.after(() => {
    db.close();
    rmSync(assetRoot, { recursive: true, force: true });
    const fixture = tinyVideoFixture();
    rmSync(fixture.dir, { recursive: true, force: true });
    fixtureCache = null;
  });
  const service = createVideoGeneration({
    db,
    walletService: {
      createHold(input) { holds.push(input); return { id: `hold-${input.metadata?.taskId || 'test'}`, status: 'held' }; },
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
    /* ⚠️ 上游被调用一次就直接失败：这就是「本地单绝不上游」的判据（比事后查日志硬） */
    fetchImpl: async url => {
      upstreamCalls.push(String(url));
      throw new Error('upstream must not be called for local engine jobs');
    },
    maxConcurrent: 2,
    assetSigningSecret: 'test-video-asset-signing-secret',
    ...overrides,
  });
  return { service, db, holds, upstreamCalls };
}

async function waitForSettled(service, ownerEmail, jobId, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  let job = service.getJob(ownerEmail, jobId);
  while (Date.now() < deadline) {
    job = service.getJob(ownerEmail, jobId);
    if (job.status === 'completed' || job.status === 'failed' || job.status === 'needs_review') return job;
    await new Promise(resolve => setTimeout(resolve, 25));
  }
  throw new Error(`job ${jobId} did not settle: ${job?.status}`);
}

test('① 本地方案的产品都声明了 localEngine，且**不进**模型清单（只在 localVideoProducts 里）', () => {
  const models = publicVideoProducts({ includeHidden: true }).map(product => product.id);
  assert.equal(models.includes(UPSCALE), false, '本地方案不是模型，不许出现在模型清单里');
  assert.equal(models.includes(DESUBTITLE), false, '同上');

  const locals = localVideoProducts();
  assert.deepEqual(locals.map(product => product.id).sort(), [DESUBTITLE, UPSCALE].sort());
  for (const product of locals) {
    assert.equal(product.public, true);
    /* SKU 名由产品 id 派生：id 写错一个字母，扣费就会打到一个不存在的 SKU 上 */
    assert.ok(FEATURE_SKUS[product.quotes.short.sku], product.id + ' 的短档 SKU 必须真实存在');
    assert.ok(FEATURE_SKUS[product.quotes.long.sku], product.id + ' 的长档 SKU 必须真实存在');
    /* 本地引擎的成本必须是 0（billing/catalog 的显式类别） */
    assert.equal(FEATURE_SKUS[product.quotes.short.sku].localEngine, true);
    assert.equal(FEATURE_SKUS[product.quotes.short.sku].providerCostCny, 0);
  }
  const upscale = locals.find(product => product.id === UPSCALE);
  const desub = locals.find(product => product.id === DESUBTITLE);
  assert.equal(upscale.billingQuantity, 'clip', '视频高清按条：0.50 积分/条');
  /* 2026-10-04：去字幕从「按秒」改成「**按次**」（用户原话「这里应该固定一个费用呀…」）。
     本机 ffmpeg delogo 的成本是 ¥0，所以固定价不花钱；改成按次之后
     `billingQuantity` 必然是 'clip' —— 留着 'seconds' 就等于"数量还按秒算"，
     那正是"界面写 1 积分、实际按 12 秒扣"那类事故。 */
  assert.equal(desub.billingQuantity, 'clip', '去字幕按次：1 积分/次（成本 0，无随时长浮动）');
  assert.deepEqual(upscale.resolutions, ['720p', '1080p', '2k'], '照知渔那一页的三档输出分辨率');
  assert.deepEqual(desub.resolutions, [], '去字幕不改分辨率 ⇒ 没有这一格');
  assert.equal(upscale.localSpec.regions, false);
  assert.equal(desub.localSpec.regions, true);
});

test('② 计费数量唯一事实源：按条恒为 1，按秒 = 秒数（向上取整）', () => {
  assert.equal(billableQuantity({ sku: 'video_upscale_local_short', seconds: 12 }), 1);
  /* 2026-10-04：去字幕摘掉了 perSecond（成本 ¥0 ⇒ 敢平价），所以数量恒为 1，与时长无关。
     ⚠️ 这正是用户要的「固定的费用」：10 秒与 300 秒都是 1 积分/次。 */
  assert.equal(billableQuantity({ sku: 'video_desubtitle_local_short', seconds: 12 }), 1,
    '按次：数量与时长无关');
  assert.equal(billableQuantity({ sku: 'video_desubtitle_local_short', seconds: 300 }), 1,
    '300 秒的片子也是 1 积分/次');
  /* 2026-10-04：去字幕摘掉 perSecond 之后，`seconds: 0` **不再**是错误 —— 按次的档根本不看时长
     （数量恒为 1）。时长校验在建单那一步（localVideoPlan）做，不是计费函数的事。
     仍然要求"正数时长"的只剩**按秒**的那些 SKU。 */
  assert.equal(billableQuantity({ sku: 'video_desubtitle_local_short', seconds: 0 }), 1);
  assert.throws(() => billableQuantity({ sku: 'video_lipsync_volc_short', seconds: 0 }), /positive duration/);
  assert.throws(() => billableQuantity({ sku: 'nope', seconds: 5 }), /Unknown feature SKU/);
  assert.equal(quoteFeature('video_desubtitle_local_short', 1).totalUnits, 1000, '1 积分/次');
  /* 既有的上游 SKU 行为逐值不变（数量恒为 1） */
  for (const sku of ['video_seedance_standard_short', 'video_seedance_fast_long', 'video_minimax_h3_2k_short']) {
    assert.equal(billableQuantity({ sku, seconds: 15 }), 1, sku + ' 是按条 SKU');
  }
  /* ⚠️ **按秒档**（数字人 0.12 积分/秒）逐值不变 —— 那一档成本真的随秒数涨，不许跟着改 */
  assert.equal(billableQuantity({ sku: 'video_lipsync_volc_short', seconds: 12 }), 12);
  assert.equal(billableQuantity({ sku: 'video_lipsync_volc_short', seconds: 12.4 }), 13, '不足一秒按一秒算');
});

/* ═══ 2026-10-04：智能擦除（火山）是「**平价 + 时长封顶**」，不是无脑平价 ═══════════════════════
   用户要的是「不管框哪里、不管是不是自动，都应该是��个固定的费用」；
   但火山的成本是 ¥0.4/分钟、目录允许到 300 秒 —— 无脑平价 = 每卖一条 300 秒的单亏 ¥1.5。
   ⇒ 封顶之内一个固定价，超出按秒。这一条守的就是那个封顶，以及它两侧的数值。 */
test('② 之二 智能擦除：封顶内固定价，超出按秒；成本永远按真实秒数记账', () => {
  const sku = 'video_desubtitle_volc_short';
  const cap = FEATURE_SKUS[sku].flatMaxSeconds;
  assert.ok(cap > 0, '平价档必须声明 flatMaxSeconds');
  assert.equal(billableQuantity({ sku, seconds: cap }), 1, '封顶之内：一次调用 = 数量 1');
  assert.equal(quoteFeature(sku, 1).totalUnits, FEATURE_SKUS[sku].flatUnits, '封顶之内显示固定价');
  assert.equal(billableQuantity({ sku, seconds: cap + 1 }), cap + 1, '超出封顶：落回按秒');
  assert.equal(quoteFeature(sku, cap + 1).units, FEATURE_SKUS[sku].units, '超出封顶：按每��单价');

  /* ⚠️ 最要紧的一条：**卖多少**与**花多少**是两个数。平价档（数量=1）也必须按真实秒数记成本，
     否则一条 60 秒的单会只记 ¥0.0067 而不是 ¥0.40 —— 账面凭空多出 98% 的利润。 */
  assert.equal(billableProviderCost({ sku, quantity: 1, seconds: cap }), 0.4,
    '平价档的成本按真实秒数记（火山 0.4 元/分钟 × 1 分钟）');
  assert.equal(billableProviderCost({ sku, quantity: 1, seconds: cap }), quoteFeature(sku, 1).providerCostCny * cap);
  /* 本机那档成本是 0，任何时长都是 0 */
  assert.equal(billableProviderCost({ sku: 'video_desubtitle_local_short', quantity: 1, seconds: 300 }), 0);
});

test('② 之三 封顶之内的那一单，毛利仍过得了地板（启动期门禁看得见的同一列）', () => {
  const row = videoMarginGateReport().find(item => item.sku === 'video_desubtitle_volc_short');
  assert.ok(row, '这一档必须在门禁报表里');
  assert.equal(row.flatMaxSeconds, FEATURE_SKUS.video_desubtitle_volc_short.flatMaxSeconds);
  assert.ok(row.flatMargin >= row.floor,
    `封顶档毛利 ${(row.flatMargin * 100).toFixed(1)}% 跌破 ${row.bandLabel} 地板 ${(row.floor * 100).toFixed(0)}%`);
  assert.equal(row.status, 'ok');
});

test('③ 建单校验：缺时长 / 缺分辨率 / 缺区域一律 400，且一条 job 都不落库', async t => {
  const { service, db, holds } = harness(t);
  const ownerEmail = 'owner@example.com';
  const video = await service.uploadAsset({ ownerEmail, kind: 'video', contentType: 'video/mp4', buffer: Buffer.from('video-bytes') });
  const attempts = [
    [{ productId: UPSCALE, resolution: '1080p', duration: 0 }, 'LOCAL_PLAN_DURATION_INVALID'],
    [{ productId: UPSCALE, duration: 6 }, 'LOCAL_PLAN_RESOLUTION_INVALID'],
    [{ productId: UPSCALE, duration: 6, resolution: '4k' }, 'LOCAL_PLAN_RESOLUTION_INVALID'],
    [{ productId: UPSCALE, duration: 6, resolution: '1080p', fps: 24 }, 'LOCAL_PLAN_FPS_INVALID'],
    [{ productId: DESUBTITLE, duration: 6 }, 'LOCAL_PLAN_REGION_REQUIRED'],
    [{ productId: DESUBTITLE, duration: 6, regions: [{ x: -5, y: 0, w: 100, h: 40 }] }, 'LOCAL_PLAN_REGION_REQUIRED'],
  ];
  for (const [input, code] of attempts) {
    await assert.rejects(
      service.createJob({
        ownerEmail,
        idempotencyKey: `local-invalid-${code}-${input.resolution || input.regions ? 'b' : 'a'}${input.fps || ''}`,
        billingQuoteId: 'quote-local-invalid',
        publicBaseUrl: 'https://example.com',
        input: { references: { videos: [video.id] }, ...input },
      }),
      error => error?.code === code,
      `期望 ${code}，实际输入 ${JSON.stringify(input)}`,
    );
  }
  /* 一条源视频都没有 = 无事可做 */
  await assert.rejects(
    service.createJob({
      ownerEmail,
      idempotencyKey: 'local-invalid-no-source',
      billingQuoteId: 'quote-local-invalid',
      publicBaseUrl: 'https://example.com',
      input: { productId: UPSCALE, duration: 6, resolution: '1080p', references: {} },
    }),
    error => error?.code === 'VIDEO_LOCAL_SOURCE_REQUIRED',
  );
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM video_jobs').get().count, 0, '无效请求不许建单（更不许收费）');
  assert.equal(holds.length, 0, '校验失败在建 hold 之前');
});

test('④ 本地方案**不需要**提示词与拍摄方案（那是上游生成的契约）', async t => {
  const { service } = harness(t);
  const ownerEmail = 'owner@example.com';
  const video = await service.uploadAsset({ ownerEmail, kind: 'video', contentType: 'video/mp4', buffer: Buffer.from('video-bytes') });
  /* 没有 prompt、没有 videoPlan/planConfirmed —— 照样建单成功（本地方案的"方案"是渲染清单） */
  const created = await service.createJob({
    ownerEmail,
    idempotencyKey: 'local-no-plan',
    billingQuoteId: 'quote-local-no-plan',
    publicBaseUrl: 'https://example.com',
    input: {
      productId: UPSCALE, duration: 9, resolution: '1080p',
      references: { videos: [video.id] },
    },
  });
  assert.equal(created.replay, false);
  assert.equal(created.job.productId, UPSCALE);
  assert.equal(created.job.mode, 'local');
  assert.equal(created.job.duration, 9);
  assert.equal(created.job.resolution, '1080p');
  assert.equal(created.job.aspectRatio, '', '本地方案不改比例：不冒充一个它没用过的比例');
});

test('⑤ 冻结额 = 目录里那条 SKU 的面值（2026-10-04：去字幕已改**按次** 1 积分）', async t => {
  const { service, holds } = harness(t);
  const ownerEmail = 'owner@example.com';
  const video = await service.uploadAsset({ ownerEmail, kind: 'video', contentType: 'video/mp4', buffer: Buffer.from('video-bytes') });
  await service.createJob({
    ownerEmail,
    idempotencyKey: 'local-desub-billing',
    billingQuoteId: 'quote-local-desub',
    publicBaseUrl: 'https://example.com',
    input: {
      productId: DESUBTITLE, duration: 12,
      regions: [{ x: 120, y: 520, w: 1080, h: 140 }],
      references: { videos: [video.id] },
    },
  });
  assert.equal(holds.length, 1);
  assert.equal(holds[0].items[0].sku, 'video_desubtitle_local_long');
  /* ⚠️ 用户要的是「固定的费用」：12 秒和 300 秒都是 1000 units。
     原来这里是 480（12 秒 × 40 units/秒）—— 界面上那个"预计"会随片子长短变，
     用户点之前不知道要花多少。 */
  assert.equal(holds[0].items[0].units, 1000, '按次：与时长无关，1 积分');
  assert.equal(holds[0].items[0].units, FEATURE_SKUS.video_desubtitle_local_long.units);
  /* 按条那一档：数量恒为 1（0.50 积分/条，与时长无关） */
  await service.createJob({
    ownerEmail,
    idempotencyKey: 'local-upscale-billing',
    billingQuoteId: 'quote-local-upscale',
    publicBaseUrl: 'https://example.com',
    input: { productId: UPSCALE, duration: 12, resolution: '720p', references: { videos: [video.id] } },
  });
  assert.equal(holds[1].items[0].sku, 'video_upscale_local_long');
  assert.equal(holds[1].items[0].units, 500);
  assert.equal(holds[1].items[0].units, FEATURE_SKUS.video_upscale_local_long.units);
});

test('⑥ 端到端：本地方案的单走本机渲染 → 成片落库（上游 fetch 一次都没被调用）', async t => {
  const probe = await ffmpegAvailable();
  if (!probe.ok) {
    t.skip('本机没有 ffmpeg —— 端到端出片那条跳过（纯逻辑的四条仍然跑）');
    return;
  }
  resetFfmpegProbe();
  const fixture = tinyVideoFixture();
  assert.ok(fixture.bytes, '夹具视频必须生成成功（本机有 ffmpeg 就应该生成得出来）');

  const { service, db, upstreamCalls } = harness(t);
  const ownerEmail = 'owner@example.com';
  const source = await service.uploadAsset({
    ownerEmail, kind: 'video', contentType: 'video/mp4', buffer: fixture.bytes,
  });

  /* 视频高清：320x240 → 720p（本机渲染，同步出片） */
  const created = await service.createJob({
    ownerEmail,
    idempotencyKey: 'local-render-e2e',
    billingQuoteId: 'quote-local-e2e',
    publicBaseUrl: 'https://example.com',
    input: { productId: UPSCALE, duration: 2, resolution: '720p', references: { videos: [source.id] } },
  });
  const settled = await waitForSettled(service, ownerEmail, created.job.id);
  assert.equal(settled.status, 'completed', settled.error || '本地渲染应当一次跑通');
  assert.ok(settled.resultUrl, '成片地址必须回填');
  assert.equal(upstreamCalls.length, 0, '本地方案绝不上游：上游 fetch 一次都不许被调用');

  /* 走的是既有的资产落库：video_assets（kind=output）+ 一条 verified 投递记录 */
  const assetId = String(settled.resultUrl).match(/\/api\/video\/(?:media|assets)\/([^?]+)/)?.[1] || '';
  assert.ok(assetId, '成片地址里必须能取到资产 id：' + settled.resultUrl);
  const asset = db.prepare('SELECT * FROM video_assets WHERE id = ?').get(assetId);
  assert.ok(asset, '成片必须进 video_assets');
  assert.equal(asset.kind, 'output');
  assert.equal(asset.content_type, 'video/mp4');
  assert.ok(asset.bytes > 0);
  assert.match(asset.sha256, /^[a-f0-9]{64}$/);
  const delivery = db.prepare('SELECT * FROM video_deliveries WHERE job_id = ?').get(created.job.id);
  assert.equal(delivery.verification_state, 'verified', '成片要走既有的投递校验');

  /* 成片真的在磁盘上（不是"记录里有、文件没有"） */
  const read = await service.readAsset(asset.id, ownerEmail);
  assert.ok(read?.filePath && existsSync(read.filePath), '成片文件必须真的落盘');
  assert.ok(read.size > 0);

  /* 去字幕：框选一条区域 → delogo 出片 */
  const desubJob = await service.createJob({
    ownerEmail,
    idempotencyKey: 'local-desubtitle-e2e',
    billingQuoteId: 'quote-local-e2e',
    publicBaseUrl: 'https://example.com',
    input: {
      productId: DESUBTITLE, duration: 2,
      regions: [{ x: 40, y: 180, w: 240, h: 40 }],
      references: { videos: [source.id] },
    },
  });
  const desubSettled = await waitForSettled(service, ownerEmail, desubJob.job.id);
  assert.equal(desubSettled.status, 'completed', desubSettled.error || '去字幕应当一次跑通');
  assert.equal(desubSettled.resolution, '', '去字幕不改分辨率');
  assert.equal(upstreamCalls.length, 0);
});

test('⑧ 前端/服务端的计费数量规则**逐值一致**（漂移了就是"显示 0.5、扣 0.04"那类事故）', async () => {
  /* 服务端那一份（建 hold 用的）在 server/billing/catalog.mjs 的 billableQuantity；
     前端那一份（报价用的）在 src/pages/VideoStudio/videoStudioModel.js 的 localBillableQuantity。
     两份必须同源同值 —— 这个门禁就是它们的"同源"证明（跨层，单看一边看不出来）。 */
  const { localBillableQuantity, localQuoteFor, localJobPoints } = await import('../src/pages/VideoStudio/videoStudioModel.js');
  const clip = { billingQuantity: 'clip', quotes: { short: { sku: 'video_upscale_local_short', units: 500 }, long: { sku: 'video_upscale_local_long', units: 500 } } };
  /* ⚠️ 2026-10-04：「按秒」这一档的样本换成**数字人**（video_lipsync_volc_*，0.12 积分/秒）。
     原来拿去字幕当样本，是因为它是当时唯一的按秒档；它已经改成按次了 ——
     继续拿它当按秒样本，这条门禁就会变成"验一条已经不存在的产品"。 */
  const perSecond = { billingQuantity: 'seconds', quotes: { short: { sku: 'video_lipsync_volc_short', units: 120 }, long: { sku: 'video_lipsync_volc_long', units: 120 } } };
  /* 平价 + 封顶那一档（智能去字幕）也要一样逐值对齐 */
  const flat = {
    billingQuantity: 'seconds',
    flatMaxSeconds: FEATURE_SKUS.video_desubtitle_volc_short.flatMaxSeconds,
    quotes: {
      short: { sku: 'video_desubtitle_volc_short', units: FEATURE_SKUS.video_desubtitle_volc_short.units, flatUnits: FEATURE_SKUS.video_desubtitle_volc_short.flatUnits, flatMaxSeconds: FEATURE_SKUS.video_desubtitle_volc_short.flatMaxSeconds },
      long: { sku: 'video_desubtitle_volc_long', units: FEATURE_SKUS.video_desubtitle_volc_long.units, flatUnits: FEATURE_SKUS.video_desubtitle_volc_long.flatUnits, flatMaxSeconds: FEATURE_SKUS.video_desubtitle_volc_long.flatMaxSeconds },
    },
  };
  const secondsSamples = [1, 5, 8, 9, 12, 12.4, 30, 59.9, 60, 60.01, 120, 300];
  for (const seconds of secondsSamples) {
    assert.equal(
      localBillableQuantity(clip, seconds),
      billableQuantity({ sku: 'video_upscale_local_short', seconds }),
      '按条那一档的数量必须与 billableQuantity 一致（seconds=' + seconds + '）',
    );
    assert.equal(
      localBillableQuantity(perSecond, seconds),
      billableQuantity({ sku: 'video_lipsync_volc_short', seconds }),
      '按秒那一档的数量必须与 billableQuantity 一致（seconds=' + seconds + '）',
    );
    assert.equal(
      localBillableQuantity(flat, seconds),
      billableQuantity({ sku: 'video_desubtitle_volc_short', seconds }),
      '平价档的数量必须与 billableQuantity 一致（seconds=' + seconds + '）',
    );
  }
  /* 报价合同也对着目录比：units × 数量 = totalUnits，且积分算法与界面一致（向上取整到整数积分） */
  const ten = localQuoteFor(perSecond, 10);
  const tenServer = quoteFeature('video_lipsync_volc_long', billableQuantity({ sku: 'video_lipsync_volc_long', seconds: 10 }));
  assert.equal(ten.sku, tenServer.sku);
  assert.equal(ten.totalUnits, tenServer.totalUnits, '10 秒 = 1200 units（1.2 积分）');
  assert.equal(localJobPoints(perSecond, 10), 2, '界面按整数积分显示：1.2 → 2（与 estimatedPoints 同一口径）');
  const clipQuote = localQuoteFor(clip, 30);
  assert.equal(clipQuote.totalUnits, 500, '按条那一档与时长无关');
  assert.equal(localJobPoints(clip, 30), 1, '0.50 积分 → 1');
  /* 平价档：封顶之内是**同一个数**，与时长无关（用户要的就是这个） */
  const flatInside = localQuoteFor(flat, 45);
  const flatInsideServer = quoteFeature('video_desubtitle_volc_long', billableQuantity({ sku: 'video_desubtitle_volc_long', seconds: 45 }));
  assert.equal(flatInside.totalUnits, flatInsideServer.totalUnits);
  assert.equal(localQuoteFor(flat, 12).totalUnits, flatInside.totalUnits, '12 秒与 45 秒同一个价');
  assert.equal(localJobPoints(flat, 12), localJobPoints(flat, 45));
  /* 超出封顶：落回按秒，两边仍逐值相等 */
  const flatOutside = localQuoteFor(flat, 90);
  const flatOutsideServer = quoteFeature('video_desubtitle_volc_long', billableQuantity({ sku: 'video_desubtitle_volc_long', seconds: 90 }));
  assert.equal(flatOutside.totalUnits, flatOutsideServer.totalUnits, '超出封顶：按秒，两边仍一致');
  /* 时长读不出来（0 / 负数 / 非数）时不许报出一个假的价：宁可返回 0，让按钮保持禁用 */
  for (const bad of [0, -3, Number.NaN, undefined, 'abc']) {
    assert.equal(localQuoteFor(perSecond, bad), null, '读不到时长就不报价：' + String(bad));
    assert.equal(localJobPoints(perSecond, bad), 0);
  }
});

test('⑦ 派发点：产品声明决定链路（本地方案有本地适配器，上游产品没有）', () => {
  /* 判据从**产品声明**派生：localEngine 的产品必须能被本地适配器认领；
     上游产品拿给本地适配器必须被拒绝（防止有人把上游档位接到本地链路上 —— 那会让
     "按上游成本定的价"配上"零成本实现"，账就乱了）。 */
  assert.equal(getVideoProduct(UPSCALE).localEngine, true);
  assert.equal(getVideoProduct(DESUBTITLE).localEngine, true);
  assert.equal(getVideoProduct('seedance_standard').localEngine, undefined);
  const source = readFileSync(new URL('../server/videoGeneration.mjs', import.meta.url), 'utf8');
  const dispatch = source.slice(source.indexOf('function providerForJob'), source.indexOf('function providerForJob') + 1600);
  /* 批 AR：判据从"localEngine → localProviderFor"扩成"**处理已有视频的产品 → processProviderFor**"
     （本机 lc / 上游火山共用这条契约）。要证明的事没变：派发按**产品声明**分流，不是按路由名猜。 */
  assert.match(dispatch, /isProcessProduct\(product\)\) return processProviderFor\(product\)/,
    '派发点必须按产品声明分流（处理已有视频 → 本机或火山；其余 → 上游生成 registry）');
  const providers = readFileSync(new URL('../server/videoProviders.mjs', import.meta.url), 'utf8');
  assert.match(providers, /if \(product\.localEngine === true\) continue;/,
    '上游注册表必须跳过本地方案（不许给它们建一条永远 disabled 的上游适配器）');
});
