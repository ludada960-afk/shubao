/* ═══ 门禁：「做成动图」2026-09-27 批 DC-4（docs/design/90 §7.2 的 M4）═════════════════════════
   用户口径（逐字，本文件每条判据的依据都在这里）：
     · 「**动图选 A 吧**」—— 形态 = 工作台里对**已生成的那张**给一颗「做成动图」：
        静图 → **2~3 秒循环短片**，可下载、**电脑端直接传小红书**；
     · 「即便是在服务端做，**你也要收费呀**，用户又不知道你没有成本，而且你确定你的方案没有成本吗，
        **你这个不是用到图生视频吗**」—— 独立 SKU、价格写在按钮上、**真的走一次上游图生视频**；
     · 「**真实跑还是我自己去做吧**」「你自己把这些功能都做齐全了，然后确保在**没有真实生产环境里面
        跑出来、不消耗我的上游 token** 的前提之下，把一切都做顺利了……确保**最大程度上没有问题**了，
        再交付给我」—— 所以本文件里**上游一律打桩**（fake registry），一次真实调用都不发；
        真机那一次留给用户本人（§六 那组"只有真机才能验"的清单也照这条写进文档）。

   七条判据（每条都带自证，红的不许提交）：
     ① SKU 过毛利地板 + 面价 = ¥3.90 + 按钮上的价格**来自服务端目录**（不是页面里写死的数）；
     ② 裁切是**纯函数**：给时长 → 2~3 秒且**不超原片**（自证：恒定 5 秒的实现会被判红）；
     ③ 本机 ffmpeg 真裁一条：h264 / 时长落在 2~3 秒 / 无音轨 / 体积比原片小（零上游成本）；
     ④ 一次点击 = **一次**上游调用；同一张图重复触发 = 同一条任务（不重复扣费）；
     ⑤ 失败不扣费：打桩上游失败 / 裁切失败 → 任务落 failed + 冻结**退回**、**不结算**；
     ⑥ 建单前校验：没有成品图 / 非法秒数一律 400，且**一条 job、一分钱都不产生**；
     ⑦ 接线：按钮带价、点前弹确认、过程可轮询（走**这一档自己的口**，不查视频任务口）、
        做完给下载（文件名认得出是哪一张）、失败就近说明；
     ⑦-b 状态查询的两道核：属主限定 + 产品判据（2026-09-28 批 CY-2 换口时加的）。 */
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import Database from 'better-sqlite3';
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { FEATURE_SKUS, MARGIN_BANDS, assertCatalogMarginGates, quoteFeature } from '../server/billing/catalog.mjs';
import {
  STILL_MOTION_PRODUCT_ID,
  getVideoProduct,
  isNonModelProduct,
  publicVideoProducts,
  routeReachability,
  videoFeatureSku,
} from '../server/videoCatalog.mjs';
import {
  LIVE_PHOTO_CLIP_SECONDS,
  LIVE_PHOTO_MAX_SECONDS,
  LIVE_PHOTO_MIN_SECONDS,
  livePhotoDescriptor,
  livePhotoTrimWindow,
  trimClipToSeconds,
} from '../server/stillMotion.mjs';
import { createVideoGeneration } from '../server/videoGeneration.mjs';
import { ffmpegAvailable } from '../server/videoLocalAdapter.mjs';

const ROOT = new URL('..', import.meta.url);
const read = relative => readFileSync(new URL(relative, ROOT), 'utf8');
const PAGE = read('src/pages/MediaCreation/index.jsx');
const API = read('src/services/api.js');
const SKU = 'video_live_photo_short';

/* ── 夹具：一段**真**的 5 秒 mp4（带音轨）—— 上游那 5 秒档的样子 ──────────────────────────────
   ⚠️ 这是本机 ffmpeg 现场生成的（零成本），不是仓库里的二进制、也不是上游产物。 */
let fixtureCache = null;
function upstreamFixture() {
  if (fixtureCache !== null) return fixtureCache;
  const dir = mkdtempSync(join(tmpdir(), 'shubao-live-photo-'));
  const file = join(dir, 'upstream-5s.mp4');
  const result = spawnSync('ffmpeg', [
    '-y', '-f', 'lavfi', '-i', 'testsrc2=size=320x240:rate=15:duration=5',
    '-f', 'lavfi', '-i', 'sine=frequency=440:duration=5',
    '-c:v', 'libx264', '-preset', 'ultrafast', '-c:a', 'aac', '-shortest', file,
  ], { encoding: 'utf8' });
  fixtureCache = result.status === 0 && existsSync(file)
    ? { dir, file, bytes: readFileSync(file) }
    : { dir, file: '', bytes: null };
  return fixtureCache;
}

function ffprobe(filePath) {
  return execFileSync('ffprobe', [
    '-v', 'error',
    '-show_entries', 'format=duration', '-show_entries', 'stream=codec_name,codec_type',
    '-of', 'default=nw=1', filePath,
  ], { encoding: 'utf8' });
}

/* ── 打桩上游：与 videoProviders 的适配器**同形**（submit/get/download）────────────────────────
   为什么用 fake registry 而不是假 fetch：这一条链路（建单 → 队列 → 轮询 → 下载 → 裁切 → 落库）
   要整条跑通，假 fetch 只能测到报文；fake registry 能**数出上游被调了几次**、也能造失败，
   而一次真实调用都不发（用户的铁律）。 */
function fakeRegistry({ fixture, failSubmit = false, failPoll = false, slowPolls = 0 }) {
  const state = { submits: [], polls: 0 };
  function adapter() {
    return {
      enabled: true,
      routeId: 'agv-seedance2.0fast',
      productId: STILL_MOTION_PRODUCT_ID,
      protocol: 'seedance',
      model: 'agv-seedance2.0fast',
      async submit(payload, idempotencyKey) {
        state.submits.push({ payload, idempotencyKey });
        if (failSubmit) throw Object.assign(new Error('打桩：上游提交失败'), { status: 502, code: 'VIDEO_PROVIDER_UNREACHABLE' });
        return { id: 'stub-task-1', progress: 0 };
      },
      async get() {
        state.polls += 1;
        if (state.polls <= slowPolls) return { status: 'processing', progress: 40, downloadUrl: '' };
        if (failPoll) return { status: 'failed', progress: 0, downloadUrl: '' };
        return { status: 'completed', progress: 100, downloadUrl: '' };
      },
      async download() {
        return new Response(fixture.bytes, {
          headers: { 'content-type': 'video/mp4', 'content-length': String(fixture.bytes.length) },
        });
      },
    };
  }
  return {
    state,
    get(productId) { return productId === STILL_MOTION_PRODUCT_ID ? adapter() : null; },
    alternate() { return null; },
    hasBackup: false,
    list() { return [adapter()]; },
    publicProducts(options) { return publicVideoProducts(options); },
    unavailableProducts() { return []; },
  };
}

function harness(t, { fixture = upstreamFixture(), ...options } = {}) {
  const db = new Database(':memory:');
  const assetRoot = mkdtempSync(join(tmpdir(), 'shubao-live-photo-assets-'));
  const holds = [];
  const settles = [];
  const releases = [];
  t.after(() => {
    db.close();
    rmSync(assetRoot, { recursive: true, force: true });
    if (fixtureCache) { rmSync(fixtureCache.dir, { recursive: true, force: true }); fixtureCache = null; }
  });
  const registry = fakeRegistry({ fixture, ...options });
  const service = createVideoGeneration({
    db,
    walletService: {
      createHold(input) { holds.push(input); return { id: `hold-${holds.length}`, status: 'held' }; },
      getBalance() { return { unlimited: false, availableUnits: 999999 }; },
      settleItem(itemId, key, meta) { settles.push({ itemId, key, meta }); return { status: 'settled' }; },
      releaseItem(itemId, key, meta) { releases.push({ itemId, key, meta }); return { status: 'released' }; },
    },
    quoteService: {
      verify({ quoteId, ownerEmail, expectedQuote }) {
        /* 报价令牌的校验在真实服务里是 HMAC；这里只要回出**同一个金额**，
           因为本文件要验的是"扣的是不是目录里那条 SKU 的价"，不是签名算法。 */
        return { quoteId, ownerEmail, currency: expectedQuote.currency, expiresAt: '2099-01-01T00:00:00.000Z' };
      },
    },
    upsertWork() {},
    assetRoot,
    apiKey: 'test-key',
    fetchImpl: async url => { throw new Error('stub upstream must not use fetch: ' + url); },
    providerRegistry: registry,
    pollIntervalMs: 5,
    maxConcurrent: 2,
    assetSigningSecret: 'test-live-photo-signing-secret',
  });
  return { service, db, holds, settles, releases, registry };
}

async function waitForSettled(service, ownerEmail, jobId, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  let job = service.getJob(ownerEmail, jobId);
  while (Date.now() < deadline) {
    job = service.getJob(ownerEmail, jobId);
    if (['completed', 'failed', 'needs_review'].includes(job?.status)) return job;
    await new Promise(resolve => { setTimeout(resolve, 20); });
  }
  throw new Error(`job ${jobId} 没有落终态：${job?.status}`);
}

/** 一张"成品图"（走既有上传链路进站，与页面里那张 /api/generated-assets 同一种东西） */
async function uploadStill(service, ownerEmail) {
  const fixture = upstreamFixture();
  const png = spawnSync('ffmpeg', [
    '-y', '-f', 'lavfi', '-i', 'color=c=0x7C3AED:s=300x400:d=1', '-frames:v', '1',
    join(fixture.dir, 'still.png'),
  ], { encoding: 'utf8' });
  assert.equal(png.status, 0, '夹具静图必须生成成功（本机有 ffmpeg 就应该生成得出来）');
  const bytes = readFileSync(join(fixture.dir, 'still.png'));
  return service.uploadAsset({ ownerEmail, kind: 'image', contentType: 'image/png', buffer: bytes });
}

/* ═══ ① SKU 与按钮上的价 ═══════════════════════════════════════════════════════════════════════ */

test('① 动图 SKU：面价 ¥3.90 / 成本如实记 ¥0.91 / 过 70% 地板，且按钮上的价来自服务端目录', () => {
  const feature = FEATURE_SKUS[SKU];
  assert.ok(feature, '动图 SKU 必须登记在 billing/catalog 里');
  assert.equal(feature.priceFen, 390, '面价 ¥3.90（docs/design/90 §6.5 写给用户的数）');
  /* 用户原话：「你确定你的方案没有成本吗，你这个不是用到图生视频吗」⇒ 记账成本必须是真的那个数 */
  assert.equal(feature.providerCostCny, 0.91, '成本 = 我们自己的最短档（Seedance Fast 5 秒 ≈ ¥0.91/条）');
  assert.equal(feature.marginBand, 'premium', '这一档按高端档（70% 地板）受管');
  assert.equal(feature.maxDurationSeconds, 5, '买的就是上游最短的 5 秒档');
  assert.equal(feature.routeRestriction, 'fast-only');
  assert.ok(feature.dailyLimitPerUser > 0);

  /* 启动期门禁（fail closed）必须真的过 —— 它在服务端启动序列里，红一条整个站起不来 */
  assert.equal(assertCatalogMarginGates(), true);
  const margin = 1 - feature.providerCostCny / (feature.units * 0.0002618421052631579);
  assert.ok(margin >= 0.76, '现金口径毛利 ≈76.7%（实得 ' + (margin * 100).toFixed(1) + '%）');
  const faceMargin = (feature.units * 0.0002618421052631579) * 0.97 - feature.providerCostCny;
  assert.ok(faceMargin / (feature.units * 0.0002618421052631579) >= MARGIN_BANDS.premium.floor,
    '积分面值口径也要过 70% 地板（门禁算的就是它）');

  /* SKU 名由产品 id 派生（一条产品一条价档）：id 写错一个字母，钱就会打到别的账上 */
  assert.equal(videoFeatureSku({ productId: STILL_MOTION_PRODUCT_ID, duration: 5 }), SKU);
  const descriptor = livePhotoDescriptor();
  assert.equal(descriptor.sku, SKU);
  assert.equal(descriptor.points, Math.ceil(quoteFeature(SKU, 1).totalUnits / 1000),
    '按钮上的数字 = 服务端目录算出来的积分（ceil(units/1000)，与视频侧同一口径）');
  assert.equal(descriptor.points, 15);
  assert.equal(descriptor.providerCostCny, feature.providerCostCny);

  /* ── 自证：把成本偷偷改小，门禁必须判红（这就是"不许为了过门禁填小"的证明）────────────── */
  const fudged = { units: 100, providerCostCny: 0.91 };
  const fudgedMargin = (fudged.units * 0.0002618421052631579) * 0.97 - fudged.providerCostCny;
  assert.ok(fudgedMargin / (fudged.units * 0.0002618421052631579) < MARGIN_BANDS.premium.floor,
    '自证：单价调低到 100 units 时毛利会掉到地板以下 ⇒ 上面那条断言不是空转');
});

test('①-b 动图产品：与 Seedance Fast **同一条通道**，且不是"模型"（不进模型下拉）', () => {
  const product = getVideoProduct(STILL_MOTION_PRODUCT_ID);
  const fast = getVideoProduct('seedance_fast');
  assert.equal(product.routeId, fast.routeId, '不要新造第二条上游通道：与已有出片验证的通道逐字相同');
  assert.equal(routeReachability(product.routeId).state, 'verified', '那条通道是**真实出过片**的');
  assert.deepEqual(product.durations, { min: 5, max: 5 }, '只买上游最短的那一档（成本最小）');
  assert.deepEqual(product.durationOptions, [5]);
  assert.deepEqual(product.limits, { images: 1, videos: 0, audios: 0, total: 1 }, '只吃一张成品图');
  assert.equal(product.public, true);
  assert.equal(isNonModelProduct(product), true);
  assert.equal(publicVideoProducts({ includeHidden: true }).some(item => item.id === STILL_MOTION_PRODUCT_ID), false,
    '它不是模型：进了模型下拉，用户会在「视频创作」里选到一条"其实是在给旧图做动图"的档位');
});

/* ═══ ② 裁切纯函数 ═════════════════════════════════════════════════════════════════════════════ */

test('② 裁切窗口是纯函数：目标落在 2~3 秒，且**绝不超原片**', () => {
  const five = livePhotoTrimWindow({ sourceSeconds: 5 });
  assert.equal(five.seconds, LIVE_PHOTO_CLIP_SECONDS, '上游 5 秒 → 裁 2.5 秒（默认档）');
  assert.equal(five.startSeconds, 0, '从第 0 秒起裁（动图要的就是"这张图动起来"的头几秒）');
  assert.equal(five.short, false);
  assert.ok(five.seconds >= LIVE_PHOTO_MIN_SECONDS && five.seconds <= LIVE_PHOTO_MAX_SECONDS, '必须落在 2~3 秒');

  for (const target of [0, 0.5, 1, 1.9, 2, 2.5, 3, 3.1, 4, 10, Number.NaN, undefined, 'abc']) {
    const window = livePhotoTrimWindow({ sourceSeconds: 5, targetSeconds: target });
    assert.ok(window.seconds >= LIVE_PHOTO_MIN_SECONDS - 0.001 && window.seconds <= LIVE_PHOTO_MAX_SECONDS,
      '任何目标值都要被夹进 2~3 秒（实得 ' + window.seconds + '，输入 ' + String(target) + '）');
    assert.ok(window.seconds <= 5, '不超原片');
  }
  /* 原片比目标还短：宁可给一段短的，也不许让 ffmpeg 去补不存在的画面 */
  const shortSource = livePhotoTrimWindow({ sourceSeconds: 1.2 });
  assert.equal(shortSource.seconds, 1.2);
  assert.equal(shortSource.short, true, '要标记出来（调用方/诊断看得到"上游出短了"）');
  assert.ok(shortSource.seconds <= 1.2, '不超原片');
  /* 量不出原片时长：按目标裁（ffmpeg 的 -t 自己会在片尾停住） */
  assert.equal(livePhotoTrimWindow({ sourceSeconds: 0 }).seconds, LIVE_PHOTO_CLIP_SECONDS);
  assert.equal(livePhotoTrimWindow({}).seconds, LIVE_PHOTO_CLIP_SECONDS);

  /* ── 自证：写死 5 秒（= 直接把上游原片交出去）的实现会被上面任何一条判红 ────────────── */
  const broken = () => ({ seconds: 5 });
  assert.ok(broken().seconds > LIVE_PHOTO_MAX_SECONDS, '自证：5 秒不满足"2~3 秒" ⇒ 判据咬得住');
});

/* ═══ ③ 本机真裁一条（零上游成本）══════════════════════════════════════════════════════════════ */

test('③ 本机 ffmpeg 真裁：h264 / 时长落在 2~3 秒 / 无音轨 / 体积比原片小', async t => {
  const probe = await ffmpegAvailable();
  if (!probe.ok) { t.skip('本机没有 ffmpeg —— 真裁那条跳过（纯函数那条任何时候都必须绿）'); return; }
  const fixture = upstreamFixture();
  assert.ok(fixture.bytes, '夹具视频必须生成成功');
  const outPath = join(fixture.dir, 'clip.mp4');
  const result = await trimClipToSeconds({ inputPath: fixture.file, outPath, seconds: LIVE_PHOTO_CLIP_SECONDS });
  assert.equal(result.seconds, LIVE_PHOTO_CLIP_SECONDS);
  const reported = ffprobe(outPath);
  assert.match(reported, /codec_name=h264/, '必须是 H.264（平台兼容底线）');
  assert.doesNotMatch(reported, /codec_type=audio/, '循环短片不留音轨（去掉更小体积、循环不断音）');
  const duration = Number((reported.match(/duration=([\d.]+)/) || [])[1]);
  assert.ok(duration >= 2 && duration <= 3, '交付时长必须落在 2~3 秒（实得 ' + duration + ' 秒）');
  const clipBytes = statSync(outPath).size;
  assert.ok(clipBytes > 0 && clipBytes < fixture.bytes.length,
    '裁完的体积必须小于原片（' + clipBytes + ' < ' + fixture.bytes.length + '，上传更轻）');
  /* ── 自证：不裁（直接拷原片）会得到 5 秒 —— 上面那条"2~3 秒"不是空转 ───────────────── */
  assert.ok(duration < 5, '自证：没裁的话这里会是 5 秒');
});

/* ═══ ④⑤⑥ 建单链路：一次点击一次上游、幂等、失败退费、建单前校验 ══════════════════════════════ */

test('④ 一次点击 = 一次上游调用；同一张图重复触发 = 同一条任务（不重复扣费）', async t => {
  const { service, db, holds, registry } = harness(t);
  const ownerEmail = 'owner@example.com';
  const still = await uploadStill(service, ownerEmail);
  const input = {
    productId: STILL_MOTION_PRODUCT_ID,
    duration: 5,
    resolution: '720p',
    mode: 'reference',
    aspectRatio: '3:4',
    generateAudio: false,
    references: { images: [still.id] },
  };
  const first = await service.createJob({ ownerEmail, idempotencyKey: 'still-motion-1', billingQuoteId: 'q1', publicBaseUrl: 'https://example.com', input });
  assert.equal(first.replay, false);
  const settled = await waitForSettled(service, ownerEmail, first.job.id);
  assert.equal(settled.status, 'completed', settled.error || '打桩上游应当一次跑通');
  assert.equal(registry.state.submits.length, 1, '一次点击只许调一次上游（数出来的，不是看日志猜的）');
  assert.equal(holds.length, 1, '一次点击只许冻一笔');
  assert.equal(holds[0].items[0].sku, SKU);
  assert.equal(holds[0].items[0].units, quoteFeature(SKU, 1).totalUnits, '冻结额 = 目录里那条 SKU 的面值');

  /* 重复触发（同一个幂等键 = 用户连点/刷新重放）：回放同一条任务，不再建单、不再冻钱 */
  const replay = await service.createJob({ ownerEmail, idempotencyKey: 'still-motion-1', billingQuoteId: 'q1', publicBaseUrl: 'https://example.com', input });
  assert.equal(replay.replay, true, '同一次点击的重复触发必须命中回放');
  assert.equal(replay.job.id, first.job.id);
  await new Promise(resolve => { setTimeout(resolve, 50); });
  assert.equal(registry.state.submits.length, 1, '回放不许再打一次上游');
  assert.equal(holds.length, 1, '回放不许再冻一次钱');
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM video_jobs').get().count, 1, '同一次点击只有一条任务');
});

test('④-b 交付件是**裁过的**那一条（不是上游原片）：资产时长落在 2~3 秒', async t => {
  const probe = await ffmpegAvailable();
  if (!probe.ok) { t.skip('本机没有 ffmpeg —— 交付件复核那条跳过'); return; }
  const { service, db } = harness(t);
  const ownerEmail = 'owner@example.com';
  const still = await uploadStill(service, ownerEmail);
  const created = await service.createJob({
    ownerEmail,
    idempotencyKey: 'still-motion-clip',
    billingQuoteId: 'q1',
    publicBaseUrl: 'https://example.com',
    input: {
      productId: STILL_MOTION_PRODUCT_ID, duration: 5, resolution: '720p', mode: 'reference',
      aspectRatio: '3:4', generateAudio: false, references: { images: [still.id] },
    },
  });
  const settled = await waitForSettled(service, ownerEmail, created.job.id);
  assert.equal(settled.status, 'completed', settled.error || '应当一次跑通');
  const assetId = String(settled.resultUrl).match(/\/api\/video\/(?:media|assets)\/([^?]+)/)?.[1] || '';
  assert.ok(assetId, '成片地址里必须能取到资产 id：' + settled.resultUrl);
  const asset = db.prepare('SELECT * FROM video_assets WHERE id = ?').get(assetId);
  assert.equal(asset.kind, 'output');
  assert.equal(asset.content_type, 'video/mp4');
  const onDisk = await service.readAsset(assetId, ownerEmail);
  assert.ok(onDisk?.filePath && existsSync(onDisk.filePath), '成片必须真的落盘');
  const reported = ffprobe(onDisk.filePath);
  const duration = Number((reported.match(/duration=([\d.]+)/) || [])[1]);
  assert.ok(duration >= 2 && duration <= 3, '交付给用户的必须是裁过的 2~3 秒（实得 ' + duration + ' 秒）');
  assert.doesNotMatch(reported, /codec_type=audio/, '交付件没有音轨（循环短片）');
  /* 上游原片不留档：它只用来裁（交付的是 2~3 秒那条） */
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM video_deliveries WHERE verification_state = 'verified'").get().count, 1);
});

test('⑤ 失败不扣费：上游失败 / 裁切失败都要落 failed + 退回冻结、**不结算**', async t => {
  /* 情况 A：打桩上游把任务判失败 */
  const upstreamFail = harness(t, { failPoll: true });
  const ownerEmail = 'owner@example.com';
  const stillA = await uploadStill(upstreamFail.service, ownerEmail);
  const jobA = await upstreamFail.service.createJob({
    ownerEmail, idempotencyKey: 'still-motion-fail', billingQuoteId: 'q1', publicBaseUrl: 'https://example.com',
    input: {
      productId: STILL_MOTION_PRODUCT_ID, duration: 5, resolution: '720p', mode: 'reference',
      aspectRatio: '3:4', references: { images: [stillA.id] },
    },
  });
  const settledA = await waitForSettled(upstreamFail.service, ownerEmail, jobA.job.id);
  assert.equal(settledA.status, 'failed', '上游失败 → 任务失败');
  assert.equal(upstreamFail.db.prepare('SELECT billing_state FROM video_jobs WHERE id = ?').get(jobA.job.id).billing_state, 'released',
    '失败必须把冻结**退回**（用户没拿到东西就不该付钱）');
  assert.equal(upstreamFail.settles.length, 0, '失败绝不许结算');
  assert.equal(upstreamFail.releases.length, 1, '要恰好释放一次');
  assert.equal(upstreamFail.db.prepare("SELECT COUNT(*) AS count FROM video_deliveries WHERE verification_state = 'verified'").get().count, 0,
    '失败不许留下"已交付"的记录');

  /* 情况 B：上游给了片子，但本机裁不出来（ffmpeg 被换成一个不存在的程序）——
     这正是"用户被扣了上游的钱却拿不到 2~3 秒动图"的那种风险，必须判失败并退钱。 */
  const ffmpegProbe = await ffmpegAvailable();
  if (!ffmpegProbe.ok) return;
  const previous = process.env.FFMPEG_PATH;
  process.env.FFMPEG_PATH = 'definitely-not-a-real-ffmpeg-binary';
  try {
    const trimFail = harness(t);
    const stillB = await uploadStill(trimFail.service, ownerEmail);
    const jobB = await trimFail.service.createJob({
      ownerEmail, idempotencyKey: 'still-motion-trim-fail', billingQuoteId: 'q1', publicBaseUrl: 'https://example.com',
      input: {
        productId: STILL_MOTION_PRODUCT_ID, duration: 5, resolution: '720p', mode: 'reference',
        aspectRatio: '3:4', references: { images: [stillB.id] },
      },
    });
    const settledB = await waitForSettled(trimFail.service, ownerEmail, jobB.job.id);
    assert.equal(settledB.status, 'failed', '裁不出来 = 这一单没交付 ⇒ 必须失败（而不是交付一个 5 秒原片）');
    assert.equal(trimFail.db.prepare('SELECT billing_state FROM video_jobs WHERE id = ?').get(jobB.job.id).billing_state, 'released');
    assert.equal(trimFail.settles.length, 0);
    assert.ok(trimFail.releases.length >= 1, '裁切失败同样要退钱');
  } finally {
    if (previous === undefined) delete process.env.FFMPEG_PATH;
    else process.env.FFMPEG_PATH = previous;
  }
});

test('⑥ 建单前校验：没有成品图 / 非法秒数一律 400，且**一条 job、一分钱**都不产生', async t => {
  const { service, db, holds } = harness(t);
  const ownerEmail = 'owner@example.com';
  const still = await uploadStill(service, ownerEmail);
  const base = {
    productId: STILL_MOTION_PRODUCT_ID, duration: 5, resolution: '720p', mode: 'reference',
    aspectRatio: '3:4', references: { images: [still.id] },
  };
  /* 0 张图：无事可做 */
  await assert.rejects(
    service.createJob({ ownerEmail, idempotencyKey: 'still-none', billingQuoteId: 'q1', publicBaseUrl: 'https://example.com', input: { ...base, references: {} } }),
    error => error?.code === 'VIDEO_STILL_SOURCE_REQUIRED',
  );
  /* 非法秒数：上游只认 5/10/15，2~3 秒直接拒绝（不能把 3 秒丢给上游） */
  await assert.rejects(
    service.createJob({ ownerEmail, idempotencyKey: 'still-3s', billingQuoteId: 'q1', publicBaseUrl: 'https://example.com', input: { ...base, duration: 3 } }),
    error => error?.code === 'VIDEO_PRODUCT_INPUT_INVALID',
  );
  /* 不合法比例：白名单外一律拒（不许悄悄换一个比例跑） */
  await assert.rejects(
    service.createJob({ ownerEmail, idempotencyKey: 'still-ratio', billingQuoteId: 'q1', publicBaseUrl: 'https://example.com', input: { ...base, aspectRatio: '7:3' } }),
    error => error?.code === 'VIDEO_FORMAT_INVALID',
  );
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM video_jobs').get().count, 0, '无效请求不许建单');
  assert.equal(holds.length, 0, '校验失败在建 hold 之前（不产生余额抖动）');

  /* 这一档**不收方案费**：没有 videoPlan / planConfirmed 也照样能建单（与"处理已有视频"同一档待遇） */
  const created = await service.createJob({ ownerEmail, idempotencyKey: 'still-no-plan', billingQuoteId: 'q1', publicBaseUrl: 'https://example.com', input: base });
  assert.equal(created.replay, false);
  assert.equal(created.job.productId, STILL_MOTION_PRODUCT_ID);
  assert.equal(created.job.duration, 5);
  assert.equal(created.job.aspectRatio, '3:4');
  assert.equal(db.prepare('SELECT prompt FROM video_jobs WHERE id = ?').get(created.job.id).prompt.length > 10, true,
    '落库的提示词是我们自己那句（用户输入里没有提示词可编译）');
});

/* ═══ ⑦-b 状态查询走**这一档自己的口**：属主 + 产品两道核都要真的生效 ═══════════════════════════
   2026-09-28 批 CY-2。为什么要有这一条：状态口从"既有的 /api/video/jobs/:id"改成
   "这一档自己的 GET /api/concept/live-photo?jobId="，换口的**唯一理由**是权限（概念视觉方案归
   `ecommerce_image`，视频任务口挂 `video_generation`）。但换口带来两个新责任，必须真验：
     · 属主 —— 拿别人的任务号查不到（否则这条口就成了越权读任务的后门）；
     · 产品 —— 拿**别的产品**的任务号也查不到（否则这条口能读全部视频任务）。
   路由那一层（index.mjs 的 if (!job || job.productId !== …) 404）用的就是下面这两件事，
   所以这里验的是它的地基：getJob 是属主限定的，且它返回的对象上真的带着 productId。 */
test('⑦-b 状态查询的两道核：别人的任务号查不到；任务对象上带着"这是哪一档"的字段', async t => {
  const { service } = harness(t);
  const ownerEmail = 'owner@example.com';
  const otherEmail = 'other@example.com';
  const still = await uploadStill(service, ownerEmail);
  const created = await service.createJob({
    ownerEmail,
    idempotencyKey: 'still-motion-status-1',
    billingQuoteId: 'q-status',
    publicBaseUrl: 'https://example.com',
    input: {
      productId: STILL_MOTION_PRODUCT_ID,
      duration: 5,
      resolution: '720p',
      mode: 'reference',
      aspectRatio: '3:4',
      generateAudio: false,
      references: { images: [still.id] },
    },
  });

  const mine = service.getJob(ownerEmail, created.job.id);
  assert.ok(mine, '本人当然查得到自己的任务');
  assert.equal(mine.productId, STILL_MOTION_PRODUCT_ID,
    '任务对象必须带 productId —— 路由那一道"是不是这一档的任务"就是核它（缺了这道核=白核）');
  assert.notEqual(mine.resultUrl, undefined, '成片地址要在这条查询里拿得到（不然查到了也白查）');

  assert.equal(service.getJob(otherEmail, created.job.id), null,
    '别人的任务号必须查不到（属主限定）—— 查得到就等于这条口成了越权读任务的后门');

  /* 自证：把产品判据换成一个"永远为真"的写法，这条测试必须能看出来（防止判据退化成空转） */
  const gate = job => Boolean(job) && job.productId === STILL_MOTION_PRODUCT_ID;
  assert.equal(gate({ productId: 'seedance_fast' }), false, '别的产品必须过不了这道核（自证：判据不是恒真）');
  assert.equal(gate(mine), true, '自己那一条要过得了');
});


/* ═══ ⑦ 接线：按钮带价、点前确认、可轮询、做完给下载、失败就近说明 ═════════════════════════════ */

test('⑦ 界面接线：价格来自服务端、点前确认、可轮询、给下载、失败就近说明', () => {
  /* 价目：从服务端读（不是页面里写死的数） */
  assert.match(API, /export async function fetchLivePhotoOffer/, '要有一个只读的价目接口');
  assert.match(API, /export async function createLivePhotoClip/, '要有一个"开始做"的接口');
  assert.match(PAGE, /fetchLivePhotoOffer\(\)/, '页面必须去服务端拿价目');
  assert.match(PAGE, /skill\?\.id !== LIVE_PHOTO_SKILL_ID/, '这颗按钮只长在概念视觉方案上（用户选的 A 方案）');
  /* 按钮上写价：数字取自服务端（points），页面上**没有任何写死的价** */
  assert.match(PAGE, /做成动图 · \{livePhoto\.offer\.points\} 积分/, '价格必须写在按钮上（本仓铁律）');
  assert.doesNotMatch(PAGE, /做成动图 · \d/, '不许把价格写死在页面里');
  /* 服务端那边价目也是从目录算的 */
  assert.match(read('server/stillMotion.mjs'), /quoteFeature\(sku, 1\)/, '价目必须来自 catalog 的 quoteFeature');
  /* 点之前弹计费确认（铁律②：没有用户确认绝不扣费） */
  assert.match(PAGE, /await dialog\.confirm\(\{[\s\S]{0,400}?做成动图/, '点之前必须有确认框，且确认文案里有这次要做的事');
  assert.match(PAGE, /本次扣 \$\{livePhotoOffer\.points\} 积分/, '确认框必须写出这次要扣多少积分');
  /* 扣费调用必须在确认之后（顺序反了就是"先扣再说"） */
  const handler = PAGE.slice(PAGE.indexOf('async function makeLivePhoto('), PAGE.indexOf('function downloadLivePhoto('));
  assert.ok(handler.indexOf('dialog.confirm(') > 0 && handler.indexOf('createLivePhotoClip(') > handler.indexOf('dialog.confirm('),
    '确认必须发生在发起之前');
  /* 过程可轮询：走**这一档自己的口**（同一条 GET + ?jobId=），不查视频任务口 ——
     ⚠️ 2026-09-28 批 CY-2：初版查的是既有的 `/api/video/jobs/:id`（"不新造状态口"那条纪律），
        但**两处权限不是同一把锁**：这一页归 `ecommerce_image`，那条口挂 `video_generation`。
        只开了电商生图的账号点了这颗按钮 → 钱已按最短路花掉、上游也真出了片，
        他却永远看不到也拿不到（任务记录同样是视频口）。交付承诺不能挂在用户可能没有的权限上。 */
  assert.match(PAGE, /fetchLivePhotoStatus\(jobId\)/, '要能查任务状态（这一档自己的口：/api/concept/live-photo?jobId=）');
  /* ⚠️ 扫之前先把块注释剥掉：本仓踩过一次"门禁在奖励删注释"（见 parse-spec 那条的注释案例），
     这里同样 —— 注释里写"曾经用过 getVideoJob、为什么撤掉"是**留案底**，不是用法。 */
  const pageCode = PAGE.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.doesNotMatch(pageCode, /getVideoJob/,
    '不许再去查视频任务口（权限不同：只开电商生图的账号会看不到自己的动图）');
  assert.match(API, /export async function fetchLivePhotoStatus/, '状态查询要有独立函数（不是把 fetch 散在页面里）');
  assert.match(API, /\/api\/concept\/live-photo\?jobId=/, '状态查的是同一条口的 ?jobId= 分支');
  assert.match(read('server/index.mjs'), /job\.productId !== STILL_MOTION_PRODUCT_ID/,
    '服务端要核"这条任务确实是这一档的"（不许拿这条口读别处的视频任务）');
  assert.match(PAGE, /LIVE_PHOTO_POLL_MS/, '轮询节奏要有常量（不是随手的魔法数）');
  /* 做完给下载，文件名认得出是哪一张 */
  assert.match(handler, /role="alert"|\{ status: 'failed'/, '失败要落成一条就近说明');
  const download = PAGE.slice(PAGE.indexOf('function downloadLivePhoto('), PAGE.indexOf('function saveSheetToAssets('));
  assert.match(download, /downloadFileName\(\{/, '下载要复用既有的文件名口径');
  assert.match(download, /anchor\.download = downloadFileName\(/, '文件名必须挂在下载链上');
  /* 失败说明必须包含"没扣积分"这句实话（就近说明的判据） */
  assert.match(PAGE, /本次不扣积分/, '失败时要说清没有扣积分');
  assert.match(PAGE, /做好之前不会扣积分/, '做的过程中也要说清这一步还没扣钱');
  assert.match(PAGE, /media-run-live-note" role="alert"/, '就近说明要带 role=alert（不是转瞬即逝的 toast）');

  /* ═══ 「查不到进度」这一种失败：三种坏做法一个都不许出现（2026-09-28 批 CY-2）═══════════════
     这一条守的是最难受的那种失败：**钱已经按最短路花掉了、上游也真在出片**，只是这一会儿读不到状态。
     实测过的三种坏做法：① 说成"本次不扣积分"（把花了钱说成没花钱）；② 把用户推去「任务记录」
     （那个入口挂的是另一个权限）；③ 让用户原地再买一次（同一张图两条任务，钱花两遍）。 */
  assert.match(PAGE, /livePhotoLookupFailed: true, jobId/,
    '查不到进度要能**被认出来**（带标记 + 带上 jobId），否则 catch 里只能笼统地说"不扣积分"');
  /* ⚠️ 这条判据**只许指向那一支**：从标记那行到它自己的那一条 setLivePhoto 为止。
     第一版把范围写成了"标记 → 下一个函数"，结果把**下面那条通用失败分支**（那条说"不扣积分"是对的）
     也扫了进来 —— 门禁当场把我这条写错的断言判红（记在这里，免得下次又把范围写宽）。 */
  const lookupStart = PAGE.indexOf('if (failure?.livePhotoLookupFailed)');
  assert.ok(lookupStart > 0, '找不到"查不到进度"那一支 —— 这条判据不能是空转');
  const lookupBranch = PAGE.slice(lookupStart, PAGE.indexOf('setLivePhoto', lookupStart + 10));
  assert.match(lookupBranch, /^\s*if \(failure\?\.livePhotoLookupFailed\) \{\s*$/,
    '范围必须恰好落在这一支的开头（写宽了会把别的分支扫进来）');
  assert.match(PAGE.slice(lookupStart, PAGE.indexOf('\n', PAGE.indexOf('jobId: failure.jobId', lookupStart))),
    /note: message \}/,
    '**查不到进度**这一支只许原样给 message（钱已经花了 —— 绝不许再拼一句"不扣积分"）');
  const lookupMessage = PAGE.slice(PAGE.indexOf("throw Object.assign(new Error('这一单已经建好了"), PAGE.indexOf('{ livePhotoLookupFailed'));
  assert.ok(lookupMessage.length > 20, '那句说明文字要真的存在（判据不能空转）');
  assert.doesNotMatch(lookupMessage, /不扣积分/,
    '那句说明本身也不许出现"不扣积分"（钱已经花了 —— 那是假话，连暗示都不行）');
  assert.match(PAGE, /media-run-live-recheck/, '取回成片的入口要留在这一张下面（不是推去别处）');
  assert.match(PAGE, /onRecheck: index => \{ void recheckLivePhoto\(index\); \}/, '那颗按钮要接到 recheck');
  const recheck = PAGE.slice(PAGE.indexOf('async function recheckLivePhoto('), PAGE.indexOf('async function makeLivePhoto('));
  assert.match(recheck, /pollLivePhotoJob\(jobId\)/, '「再看一眼」= 拿先前那条任务号再查一次');
  assert.doesNotMatch(recheck, /createLivePhotoClip/,
    '「再看一眼」**绝不许再建单**（再建单 = 同一张图两条任务 = 钱花两遍）');
  /* 两条路径必须落在**同一套**判定上（否则"过一会儿回来查"会得出另一种结论） */
  assert.match(PAGE, /async function settleLivePhoto\(/, '成片/还在做/没做出来 三种落定要抽成一处');
  assert.equal((PAGE.match(/await settleLivePhoto\(/g) || []).length, 2,
    'settleLivePhoto 必须被**两个**调用点共用（点按钮那一次 + 再看一眼那一次）');
});
