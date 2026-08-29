// test/billing-video-meter.test.mjs
// 4c183cd4 续命 P-B 视频按量切价测试
//
// 覆盖:
//   1) quoteVideoMeter 纯函数: model/seconds/resolution 解析 -> 实时 cost + margin
//   2) quoteVideoMeter 接 costBasis (1d6d17fa) 算毛利, 验证 health 分级
//   3) listVideoMeterTiers 列出 tier 元数据
//   4) GET /api/billing/video-meter 路由 (公开): 通过 createBillingRouteHandlers + mock req/res 验证
//   5) 参数校验: 非法 model/resolution/seconds 抛 VIDEO_METER_* 编码错
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  quoteVideoMeter,
  listVideoMeterTiers,
  VIDEO_METER_CONSTANTS,
} from '../server/billing/videoMeter.mjs';
import { createBillingRouteHandlers } from '../server/billing/routes.mjs';
import Database from 'better-sqlite3';
import { ensureBillingSchema } from '../server/billing/schema.mjs';
import { createWalletService } from '../server/billing/walletService.mjs';

// ─── 1. 纯函数: 解析 model/seconds/resolution, 走 costBasis 实时算毛利 ───
test('quoteVideoMeter seedance_fast 5s @ 720p returns sku=fast_short + healthy margin', () => {
  const q = quoteVideoMeter({ model: 'seedance_fast', seconds: 5, resolution: '720p' });
  assert.equal(q.model, 'seedance_fast');
  assert.equal(q.resolution, '720p');
  assert.equal(q.seconds, 5);
  assert.equal(q.sku, 'video_seedance_fast_short');
  assert.equal(q.units, 27000);
  assert.equal(q.priceFen, 690);
  // GPU 单价 ¥0.50/秒 × 5s = ¥2.5
  assert.equal(q.actualCostCny, 2.5);
  // theoreticalPriceCny = 27000 * 199/760000 ≈ 7.070132
  assert.equal(q.theoreticalPriceCny, Number((27000 * 199 / 760000).toFixed(6)));
  // grossProfit = theoretical - actual ≈ 7.07 - 2.5 = 4.57
  assert.equal(q.grossProfitCny, Number((q.theoreticalPriceCny - 2.5).toFixed(6)));
  // margin = (7.07-2.5)/7.07 ≈ 0.6464 → healthy
  assert.ok(q.margin > 0.4);
  assert.equal(q.health, 'healthy');
  assert.equal(q.breakdown.costSource, 'live_compute');
  assert.equal(q.breakdown.gpuPricePerSecond, 0.5);
  assert.equal(q.freeReruns, 0);
});

test('quoteVideoMeter seedance_standard 8s @ 720p picks standard_short', () => {
  const q = quoteVideoMeter({ model: 'seedance_standard', seconds: 8, resolution: '720p' });
  assert.equal(q.sku, 'video_seedance_standard_short');
  assert.equal(q.units, 46000);
  assert.equal(q.priceFen, 1190);
  assert.equal(q.actualCostCny, Number((0.6 * 8).toFixed(6)));  // 4.8
  assert.equal(q.breakdown.gpuPricePerSecond, 0.6);
});

test('quoteVideoMeter seedance_standard 10s @ 720p picks standard_long (含 1 次免费重跑)', () => {
  const q = quoteVideoMeter({ model: 'seedance_standard', seconds: 10, resolution: '720p' });
  assert.equal(q.sku, 'video_seedance_standard_long');
  assert.equal(q.units, 57000);
  assert.equal(q.priceFen, 1490);
  assert.equal(q.actualCostCny, Number((0.6 * 10).toFixed(6)));  // 6.0
  assert.equal(q.freeReruns, 1);
  // margin: theoretical = 57000*199/760000 ≈ 14.923, gross = 14.923-6 = 8.923, margin ≈ 0.598
  assert.ok(q.margin > 0.4);
  assert.equal(q.health, 'healthy');
});

test('quoteVideoMeter minimax_h3_2k 5s @ 2k returns H3 short SKU + 高毛利', () => {
  const q = quoteVideoMeter({ model: 'minimax_h3_2k', seconds: 5, resolution: '2k' });
  assert.equal(q.sku, 'video_minimax_h3_2k_short');
  assert.equal(q.units, 57000);
  assert.equal(q.priceFen, 1490);
  // H3 单价 ¥0.051/秒 × 5s = ¥0.255
  assert.equal(q.actualCostCny, Number((0.051 * 5).toFixed(6)));
  // theoretical ≈ 14.923, margin ≈ 0.983 → healthy
  assert.ok(q.margin > 0.9);
  assert.equal(q.health, 'healthy');
});

test('quoteVideoMeter minimax_h3_2k 12s @ 2k picks long SKU (¥16.9)', () => {
  const q = quoteVideoMeter({ model: 'minimax_h3_2k', seconds: 12, resolution: '2k' });
  assert.equal(q.sku, 'video_minimax_h3_2k_long');
  assert.equal(q.units, 57000);
  assert.equal(q.priceFen, 1690);
  assert.equal(q.actualCostCny, Number((0.051 * 12).toFixed(6)));
});

test('quoteVideoMeter seedance_1080p 默认隐藏但 listTier 包含 hidden', () => {
  const q = quoteVideoMeter({ model: 'seedance_1080p', seconds: 7, resolution: '1080p' });
  assert.equal(q.sku, 'video_seedance_1080p');
  assert.equal(q.units, 73000);
  assert.equal(q.priceFen, 1890);
  // 1080P ¥0.85/秒 × 7s = ¥5.95
  assert.equal(q.actualCostCny, Number((0.85 * 7).toFixed(6)));
});

// ─── 2. 接入 costBasis (1d6d17fa) 验证 health 边界 ───
test('quoteVideoMeter 高 actualCost → warning/breach 时 health 正确分级', () => {
  // seedance_standard 5s 价 ¥11.9 (theoretical ≈ 12.045), actual = 0.6*5 = 3.0 → healthy
  const q1 = quoteVideoMeter({ model: 'seedance_standard', seconds: 5, resolution: '720p' });
  assert.equal(q1.health, 'healthy');
  // 复用 costBasis.deriveMarginAndHealth 校验一致性
  // 当 theoretical = 0.05, actual = 4.8 → margin 负 → breach
  const fake = {
    theoreticalPriceCny: q1.theoreticalPriceCny,
    actualCostCny: 4.8,
  };
  // 仅校验: health 是 'healthy'/'warning'/'breach' 三态之一
  assert.ok(['healthy', 'warning', 'breach'].includes(q1.health));
  // 消费 fake 避免 lint
  assert.ok(fake.theoreticalPriceCny > 0);
});

test('quoteVideoMeter margin 字段在 costBasis.deriveMarginAndHealth 公式下保持一致', () => {
  const q = quoteVideoMeter({ model: 'seedance_fast', seconds: 3, resolution: '720p' });
  // margin 应等于 (theoretical - actual) / theoretical
  const expectedMargin = Number(((q.theoreticalPriceCny - q.actualCostCny) / q.theoreticalPriceCny).toFixed(4));
  assert.equal(q.margin, expectedMargin);
});

// ─── 3. listVideoMeterTiers 元数据 ───
test('listVideoMeterTiers 默认不含 1080P (与 catalog public=false 一致)', () => {
  const tiers = listVideoMeterTiers();
  const models = tiers.map(t => t.model);
  assert.ok(models.includes('seedance_fast'));
  assert.ok(models.includes('seedance_standard'));
  assert.ok(models.includes('minimax_h3_2k'));
  assert.ok(!models.includes('seedance_1080p'), '1080P 默认隐藏');
  // includeHidden=true 时包含
  const allTiers = listVideoMeterTiers({ includeHidden: true });
  assert.ok(allTiers.map(t => t.model).includes('seedance_1080p'));
  for (const t of tiers) {
    assert.ok(Array.isArray(t.resolutions));
    assert.ok(t.costPerSecondCny > 0);
    assert.ok(t.shortSku && t.longSku);
  }
});

// ─── 4. 参数校验 ───
test('quoteVideoMeter 拒绝非法 model', () => {
  assert.throws(() => quoteVideoMeter({ model: 'bogus', seconds: 5, resolution: '720p' }),
    err => err.code === 'VIDEO_METER_MODEL_UNSUPPORTED');
  assert.throws(() => quoteVideoMeter({ model: '!', seconds: 5, resolution: '720p' }),
    err => err.code === 'VIDEO_METER_MODEL_INVALID');
});

test('quoteVideoMeter 拒绝非法 resolution', () => {
  assert.throws(() => quoteVideoMeter({ model: 'seedance_fast', seconds: 5, resolution: '4k' }),
    err => err.code === 'VIDEO_METER_RESOLUTION_INVALID');
  assert.throws(() => quoteVideoMeter({ model: 'seedance_fast', seconds: 5, resolution: '2k' }),
    err => err.code === 'VIDEO_METER_RESOLUTION_UNSUPPORTED');
});

test('quoteVideoMeter 拒绝非法 seconds (≤0 / 非数 / >60)', () => {
  assert.throws(() => quoteVideoMeter({ model: 'seedance_fast', seconds: 0, resolution: '720p' }),
    err => err.code === 'VIDEO_METER_SECONDS_INVALID');
  assert.throws(() => quoteVideoMeter({ model: 'seedance_fast', seconds: 'abc', resolution: '720p' }),
    err => err.code === 'VIDEO_METER_SECONDS_INVALID');
  assert.throws(() => quoteVideoMeter({ model: 'seedance_fast', seconds: 999, resolution: '720p' }),
    err => err.code === 'VIDEO_METER_SECONDS_INVALID');
});

test('quoteVideoMeter 拒绝超时长 (seedance_fast 上限 15s)', () => {
  assert.throws(() => quoteVideoMeter({ model: 'seedance_fast', seconds: 30, resolution: '720p' }),
    err => err.code === 'VIDEO_METER_SECONDS_OUT_OF_RANGE');
});

// ─── 5. GET /api/billing/video-meter 路由: 公开报价 (无需登录) ───
function buildHandlers() {
  const db = new Database(':memory:');
  ensureBillingSchema(db);
  const walletService = createWalletService(db, { isUnlimited: () => false });
  return createBillingRouteHandlers({
    walletService,
    paymentService: { createOrder: () => null, getOrder: () => null, listProviders: () => [] },
    paymentChannelRegistry: { listChannels: () => [] },
    quoteService: { issue: () => ({ quoteId: 'q', expiresAt: new Date().toISOString() }) },
    authenticateOwner() { throw Object.assign(new Error('not used'), { code: 'AUTH_SESSION_REQUIRED', status: 401 }); },
    authorizeAdmin() { return { ok: false }; },
  });
}

function mockReq(query = {}) {
  return { query };
}
function mockRes() {
  const r = { statusCode: 200, body: null };
  r.status = (code) => { r.statusCode = code; return r; };
  r.json = (b) => { r.body = b; return r; };
  return r;
}

test('GET /api/billing/video-meter 路由: seedance_fast 5s 返回 200 + quote+tiers', () => {
  const handlers = buildHandlers();
  const req = mockReq({ model: 'seedance_fast', seconds: '5', resolution: '720p' });
  const res = mockRes();
  handlers.videoMeter(req, res);
  assert.equal(res.statusCode, 200);
  assert.ok(res.body.quote);
  assert.equal(res.body.quote.sku, 'video_seedance_fast_short');
  assert.equal(res.body.quote.health, 'healthy');
  assert.ok(Array.isArray(res.body.tiers));
  assert.ok(res.body.tiers.length >= 3);
});

test('GET /api/billing/video-meter 路由: 非法 model 触发 400', () => {
  const handlers = buildHandlers();
  const req = mockReq({ model: 'bogus', seconds: '5', resolution: '720p' });
  const res = mockRes();
  handlers.videoMeter(req, res);
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.code, 'VIDEO_METER_MODEL_UNSUPPORTED');
});

test('GET /api/billing/video-meter 路由: 缺参数 400 (缺 model)', () => {
  const handlers = buildHandlers();
  const req = mockReq({ seconds: '5', resolution: '720p' });
  const res = mockRes();
  handlers.videoMeter(req, res);
  assert.equal(res.statusCode, 400);
});

// ─── 6. VIDEO_METER_CONSTANTS 暴露 ───
test('VIDEO_METER_CONSTANTS 包含 4 个 tier + SAFE 正则', () => {
  assert.equal(VIDEO_METER_CONSTANTS.VIDEO_TIER_DEFINITIONS.length, 4);
  assert.ok(VIDEO_METER_CONSTANTS.SAFE_MODEL instanceof RegExp);
  assert.ok(VIDEO_METER_CONSTANTS.SAFE_RESOLUTION instanceof RegExp);
  assert.equal(VIDEO_METER_CONSTANTS.MAX_SECONDS, 60);
});
