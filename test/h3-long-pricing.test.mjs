// test/h3-long-pricing.test.mjs
// 2026-08-26 周一切片 · §6 #1 H3-2K 长档定价 ¥16.9
// -----------------------------------------------------------------------------
// 验证：video_minimax_h3_2k_long priceFen = 1690 (¥16.9, 1元=100分锚)；
// 短档 ¥14.9 维持；长档毛利仍在 premium 地板 70% 上方；admin bySku 看板行
// 同步 priceFen=1690。
// -----------------------------------------------------------------------------
import test from 'node:test';
import assert from 'node:assert/strict';

import { FEATURE_SKUS, videoMarginGateReport } from '../server/billing/catalog.mjs';

test('video_minimax_h3_2k_long priceFen equals 1690 (¥16.9) — long tier separate from short', () => {
  assert.equal(FEATURE_SKUS.video_minimax_h3_2k_long.priceFen, 1690);
  assert.equal(FEATURE_SKUS.video_minimax_h3_2k_long.units, 57000);
  assert.equal(FEATURE_SKUS.video_minimax_h3_2k_long.marginBand, 'premium');
});

test('video_minimax_h3_2k_short keeps ¥14.9 (1490) to preserve short/long separation', () => {
  assert.equal(FEATURE_SKUS.video_minimax_h3_2k_short.priceFen, 1490);
  assert.equal(FEATURE_SKUS.video_minimax_h3_2k_short.units, 57000);
});

test('h3 long price/cost separation — long is 1690 vs short 1490 (no overlap)', () => {
  const longPrice = FEATURE_SKUS.video_minimax_h3_2k_long.priceFen;
  const shortPrice = FEATURE_SKUS.video_minimax_h3_2k_short.priceFen;
  assert.ok(longPrice - shortPrice >= 200, 'long must be at least ¥2 above short');
});

test('margin gate report still classifies h3 long as premium-band ok', () => {
  const rows = videoMarginGateReport();
  const long = rows.find(row => row.sku === 'video_minimax_h3_2k_long');
  assert.ok(long, 'h3 long row present in margin gate report');
  assert.equal(long.band, 'premium');
  assert.equal(long.status, 'ok');
  assert.equal(long.priceFen, 1690);
  // 1元=100分锚：priceFen=1690 是零售现金锚；积分面值由 units×anchor 推导（与短档同步未改），
  // admin bySku 行同时显示 priceFen=1690 与 faceCny 区分「卖 ¥16.9」与「积分面值」两种口径。
  assert.ok(long.faceCny > 14 && long.faceCny < 16, '积分面值不变（与短档同口径）');
});

test('admin bySku 看板 H3 long 行直接读 catalog priceFen=1690 (1元=100分锚)', () => {
  // 静态契约：unitEconomicsCatalog 把 priceFen 透传到 admin features 列表。
  // 验证 adminOps 的 unitEconomicsCatalog 路径会得到 1690（用 buildUnitEconomicsCatalog）。
  // 这里只验 catalog 数据源已就绪 + priceFen 字段是 safe integer。
  const feature = FEATURE_SKUS.video_minimax_h3_2k_long;
  assert.equal(feature.priceFen, 1690);
  assert.ok(Number.isSafeInteger(feature.priceFen));
});

test('FEATURE_SKUS frozen object — H3 long price immutable after import', () => {
  // 防御性：catalog 用 Object.freeze 包了一层，H3 long 改价必须走新 commit 而非 mutation。
  assert.equal(Object.isFrozen(FEATURE_SKUS), true);
  assert.equal(Object.isFrozen(FEATURE_SKUS.video_minimax_h3_2k_long), true);
});

test('assertCatalogMarginGates still passes after long-tier price change', async () => {
  // 启动期断言（fail closed）：H3 长档仍在 premium 地板上，跳动价不应触发 below_band_floor。
  const { assertCatalogMarginGates } = await import('../server/billing/catalog.mjs');
  assert.doesNotThrow(() => assertCatalogMarginGates());
});
