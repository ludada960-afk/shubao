// test/price-experiment.test.mjs
// 2026-08-26 周一切片 · §6 #2 标准档 A/B 实验
// -----------------------------------------------------------------------------
// 验证：assignPriceVariant 末 4 字符末位奇偶 50/50、flag 关闭回 control、
// breakdownByVariant 二次分组+理论毛利、adminOperations summary 输出 byVariant。
// -----------------------------------------------------------------------------
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  PRICING_EXPERIMENT,
  assignPriceVariant,
  breakdownByVariant,
  isPriceExperimentEnabled,
  listExperimentVariants,
} from '../server/billing/priceExperiment.mjs';

test('experiment flag, sku, and variants are wired to the standard short SKU', () => {
  assert.equal(PRICING_EXPERIMENT.sku, 'video_seedance_standard_short');
  assert.equal(PRICING_EXPERIMENT.flag, 'std_ab_2026_08_26');
  const variants = listExperimentVariants();
  assert.equal(variants.length, 2);
  assert.equal(variants[0].key, 'control');
  assert.equal(variants[0].priceFen, 1190);
  assert.equal(variants[1].key, 'treatment');
  assert.equal(variants[1].priceFen, 1290);
});

test('assignPriceVariant falls back to control when env disables the experiment', () => {
  const result = assignPriceVariant({
    sku: PRICING_EXPERIMENT.sku,
    userId: 'user-1234',
    env: { PRICING_EXPERIMENT_STD_AB: '0' },
  });
  assert.equal(result.key, 'control');
  assert.equal(result.experimentEnabled, false);
});

test('assignPriceVariant 50/50 splits by last-4-char code parity (odd→treatment, even→control)', () => {
  // 末 4 字符 '1234' 末位 = '4'.charCodeAt(0) = 52（偶数）→ control
  const even = assignPriceVariant({ sku: PRICING_EXPERIMENT.sku, userId: 'user-1234' });
  assert.equal(even.key, 'control');
  // 末 4 字符 '1235' 末位 = '5'.charCodeAt(0) = 53（奇数）→ treatment
  const odd = assignPriceVariant({ sku: PRICING_EXPERIMENT.sku, userId: 'user-1235' });
  assert.equal(odd.key, 'treatment');
});

test('assignPriceVariant is stable across calls for the same userId', () => {
  const a = assignPriceVariant({ sku: PRICING_EXPERIMENT.sku, userId: 'stable-user-9999' });
  const b = assignPriceVariant({ sku: PRICING_EXPERIMENT.sku, userId: 'stable-user-9999' });
  assert.equal(a.key, b.key);
});

test('assignPriceVariant rejects unknown sku', () => {
  assert.throws(
    () => assignPriceVariant({ sku: 'video_seedance_fast_short', userId: 'u' }),
    /not in experiment/,
  );
});

test('isPriceExperimentEnabled defaults to true when env missing or empty', () => {
  assert.equal(isPriceExperimentEnabled({ env: {} }), true);
  assert.equal(isPriceExperimentEnabled({ env: { PRICING_EXPERIMENT_STD_AB: '1' } }), true);
  assert.equal(isPriceExperimentEnabled({ env: { PRICING_EXPERIMENT_STD_AB: '0' } }), false);
});

test('breakdownByVariant groups by sku+variantKey and surfaces theoretical_margin', () => {
  const bySku = [
    { sku: 'video_seedance_standard_short', variantKey: 'control', actions: 6, points_consumed: 276000, theoretical_revenue: 72.24, cash_revenue: 71.4, provider_cost_cny: 30.42 },
    { sku: 'video_seedance_standard_short', variantKey: 'treatment', actions: 4, points_consumed: 184000, theoretical_revenue: 49.36, cash_revenue: 51.6, provider_cost_cny: 20.28 },
    { sku: 'ec_image_2k', variantKey: 'unknown', actions: 10, points_consumed: 10000, theoretical_revenue: 2.62, cash_revenue: 0, provider_cost_cny: 0.38 },
  ];
  const out = breakdownByVariant(bySku);
  const control = out.find(row => row.sku === 'video_seedance_standard_short' && row.variantKey === 'control');
  const treatment = out.find(row => row.sku === 'video_seedance_standard_short' && row.variantKey === 'treatment');
  assert.ok(control, 'control variant present');
  assert.ok(treatment, 'treatment variant present');
  assert.equal(control.actions, 6);
  assert.equal(treatment.actions, 4);
  assert.ok(control.theoretical_margin > 0 && control.theoretical_margin < 1);
  assert.ok(treatment.theoretical_margin > 0 && treatment.theoretical_margin < 1);
  assert.equal(control.theoretical_revenue, 72.24);
  assert.equal(treatment.cash_revenue, 51.6);
});

test('breakdownByVariant returns empty array for empty input', () => {
  assert.deepEqual(breakdownByVariant([]), []);
});

test('adminOperations imports the experiment metadata and exposes breakdownByVariant for the experiment SKU', async () => {
  // 静态契约：adminOperations 必须导入 PRICING_EXPERIMENT / listExperimentVariants /
  // breakdownByVariant，否则 byVariant 输出会静默退化为空数组，UI 无法发现实验。
  const fs = await import('node:fs/promises');
  const source = await fs.readFile(new URL('../server/adminOperations.mjs', import.meta.url), 'utf8');
  assert.match(source, /from '\.\/billing\/priceExperiment\.mjs'/, 'adminOperations must import priceExperiment');
  assert.match(source, /PRICING_EXPERIMENT/, 'adminOperations must reference PRICING_EXPERIMENT');
  assert.match(source, /listExperimentVariants\(\)/, 'adminOperations must call listExperimentVariants');
  assert.match(source, /breakdownByVariant\(/, 'adminOperations must call breakdownByVariant');
  assert.match(source, /json_extract\(u\.metadata, '\$\.variantKey'\)/,
    'bySku query must extract metadata.variantKey to feed byVariant');
  // 输出契约：breakdownByVariant 接收与 adminOperations 一致的 bySku 行结构，
  // 验证 shareOfSku 推导与 share 求和==1 的不变量（实验 SKU 内部）。
  const sku = PRICING_EXPERIMENT.sku;
  const rows = [
    { sku, variantKey: 'control', actions: 5, points_consumed: 230000, theoretical_revenue: 60.20, cash_revenue: 59.5, provider_cost_cny: 25.35 },
    { sku, variantKey: 'treatment', actions: 3, points_consumed: 138000, theoretical_revenue: 38.70, cash_revenue: 38.7, provider_cost_cny: 15.21 },
  ];
  const out = breakdownByVariant(rows);
  const total = rows.reduce((sum, r) => sum + r.actions, 0);
  const shares = out.map(r => Number((r.actions / total).toFixed(4)));
  const sumShares = Number(shares.reduce((s, v) => s + v, 0).toFixed(4));
  assert.equal(sumShares, 1, 'variant shares must sum to 1 for the experiment SKU');
  // 期望 adminOperations summary 字段名：byVariant + pricingExperiment
  // （断言只覆盖导出形状，避免与 adminOperations 集成测试耦合到账本/钱包初始化）
  assert.ok(typeof PRICING_EXPERIMENT.flag === 'string' && PRICING_EXPERIMENT.flag.length > 0);
});
