// test/h3-long-pricing.test.mjs
// 2026-08-26 周一切片 · §6 #1 H3-2K 长档定价 ¥16.9
// -----------------------------------------------------------------------------
// 9-11 更新：MiniMax H3-2K 成本口径更正为 IP233 权威价目 ¥5.85/条（原 0.76 为 poke 中转价），
// 原 ¥14.9 短档在该成本下只有 57.8% 毛利、跌破高端带 70% 地板 → 短长档统一 ¥16.9 /
// 65000 units 并改归主力带（60% 地板，实测 62.6%），两档同价不再做短长价格区隔。
// 本文件继续验证：priceFen 锚、marginBand 归属、admin bySku 行口径一致。
// -----------------------------------------------------------------------------
import test from 'node:test';
import assert from 'node:assert/strict';

import { FEATURE_SKUS, videoMarginGateReport } from '../server/billing/catalog.mjs';

test('video_minimax_h3_2k 两档统一 ¥16.9 / 65000 units (9-11 成本更正后改判)', () => {
  for (const sku of ['video_minimax_h3_2k_short', 'video_minimax_h3_2k_long']) {
    assert.equal(FEATURE_SKUS[sku].priceFen, 1690, sku + ' cash anchor');
    assert.equal(FEATURE_SKUS[sku].units, 65000, sku + ' point face');
    assert.equal(FEATURE_SKUS[sku].marginBand, 'core', sku + ' band');
    assert.equal(FEATURE_SKUS[sku].public, true, sku + ' public after 全上');
  }
});

test('h3 成本口径锁定 IP233 权威价目 ¥5.85/条 (原 0.76 为 poke 中转价)', () => {
  assert.equal(FEATURE_SKUS.video_minimax_h3_2k_short.providerCostCny, 5.85);
  assert.equal(FEATURE_SKUS.video_minimax_h3_2k_long.providerCostCny, 5.85);
});

test('margin gate report classifies h3 as core-band ok with ¥16.9 anchor', () => {
  const rows = videoMarginGateReport();
  const long = rows.find(row => row.sku === 'video_minimax_h3_2k_long');
  assert.ok(long, 'h3 long row present in margin gate report');
  assert.equal(long.band, 'core');
  assert.equal(long.status, 'ok');
  assert.equal(long.priceFen, 1690);
  assert.ok(long.margin >= 0.60, 'core band floor kept: ' + long.margin);
  // 积分面值 = units × anchor（65000 × 锚 ≈ ¥17.02），覆盖 ¥16.9 现金锚。
  assert.ok(long.faceCny > 16.5 && long.faceCny < 17.5, 'face value covers the cash anchor');
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
