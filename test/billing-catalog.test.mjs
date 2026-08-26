import test from 'node:test';
import assert from 'node:assert/strict';
import { FEATURE_SKUS, PRODUCTS, getProduct, quoteFeature, assertContributionMargin } from '../server/billing/catalog.mjs';

test('client cannot choose the price or grant amount', () => {
  const product = getProduct('ec_starter_29');
  assert.deepEqual(product, { sku: 'ec_starter_29', priceFen: 2900, currency: 'ec_points', grantUnits: 105000, validityDays: null });

  product.priceFen = 1;
  product.grantUnits = 1;
  assert.equal(getProduct('ec_starter_29').priceFen, 2900);
  assert.equal(getProduct('ec_starter_29').grantUnits, 105000);
});

test('catalog lookups reject inherited prototype keys', () => {
  for (const sku of ['toString', '__proto__', 'constructor']) {
    assert.throws(() => getProduct(sku), /unknown product sku/i);
    assert.throws(() => quoteFeature(sku, 1), /unknown feature sku/i);
  }
});

test('exported catalog entries cannot be mutated by callers', () => {
  assert.equal(Object.isFrozen(PRODUCTS), true);
  assert.equal(Object.isFrozen(PRODUCTS.ec_starter_29), true);
  assert.equal(Object.isFrozen(FEATURE_SKUS), true);
  assert.equal(Object.isFrozen(FEATURE_SKUS.ec_image_2k), true);
  assert.throws(() => { PRODUCTS.ec_starter_29.priceFen = 1; }, TypeError);
  assert.throws(() => { FEATURE_SKUS.ec_image_2k.units = 1; }, TypeError);
});

test('quotes ecommerce outputs from server feature weights', () => {
  assert.equal(quoteFeature('ec_image_2k', 8).totalUnits, 8000);
  assert.equal(quoteFeature('ec_image_4k', 2).totalUnits, 4000);
});

test('video quotes are fixed per successful generation', () => {
  const expected = {
    video_seedance_fast_short: [40000, 5.07, true],
    video_seedance_fast_long: [46000, 5.07, true],
    video_seedance_standard_short: [62000, 5.07, true],
    video_seedance_standard_long: [72000, 5.07, true],
    video_minimax_h3_2k_short: [68000, 5.45, false],
    video_minimax_h3_2k_long: [78000, 5.45, false],
    video_plan_analysis: [1000, 0.05, true],
  };
  for (const [sku, [units, providerCostCny, isPublic]] of Object.entries(expected)) {
    assert.equal(quoteFeature(sku, 1).totalUnits, units);
    assert.equal(quoteFeature(sku, 1).providerCostCny, providerCostCny);
    assert.equal(FEATURE_SKUS[sku].public !== false, isPublic);
  }
  for (const legacy of ['video_seedance_480p_short', 'video_seedance_720p_long']) {
    assert.throws(() => quoteFeature(legacy, 1), /unknown feature sku/i);
  }
});

test('video prices still clearing the 70% margin gate after the 2026-09 provider cost reset', () => {
  const unitPriceCny = Math.min(...Object.values(PRODUCTS)
    .filter(product => product.currency === 'ec_points')
    .map(product => (product.priceFen / 100) / product.grantUnits));
  // Seedance 按条成本涨到 ¥5.07；MiniMax H3 按 7.15 汇率情景 ¥5.45 记账（1:1 情景 ≈¥0.76 待充值实测）后，
  // 仅长时长档仍守住 70% 设计毛利线。
  const aboveGate = ['video_seedance_standard_long', 'video_minimax_h3_2k_long'];
  assert.equal(Object.keys(FEATURE_SKUS).filter(sku => sku.startsWith('video_')).length, 7);
  for (const sku of aboveGate) {
    const feature = FEATURE_SKUS[sku];
    assert.ok(assertContributionMargin(feature, feature.units * unitPriceCny) >= 0.70,
      sku + ' is expected to stay above the 70% gate');
  }
});

test('video tiers priced below the 70% gate are locked to their audited margins pending repricing', () => {
  const unitPriceCny = Math.min(...Object.values(PRODUCTS)
    .filter(product => product.currency === 'ec_points')
    .map(product => (product.priceFen / 100) / product.grantUnits));
  // 已核定的真实口径缺口：这些档位低于 0.70 门禁，属已知定价风险；
  // 上调积分售价需要产品决策，此处锁定当前毛利防止成本口径被静默改动。
  const belowGateExpectations = {
    video_seedance_fast_short: 0.4859,
    video_seedance_fast_long: 0.5491,
    video_seedance_standard_short: 0.6577,
    video_minimax_h3_2k_short: 0.6639,
  };
  const marginOf = (feature, unitPrice) =>
    (unitPrice - unitPrice * 0.03 - feature.providerCostCny) / unitPrice;
  for (const [sku, expectedMargin] of Object.entries(belowGateExpectations)) {
    const feature = FEATURE_SKUS[sku];
    const margin = marginOf(feature, feature.units * unitPriceCny);
    assert.ok(Math.abs(margin - expectedMargin) < 0.001,
      sku + ' margin drifted: ' + margin.toFixed(4) + ' vs audited ' + expectedMargin);
    assert.ok(margin < 0.70, sku + ' moved above the gate - move it to the aboveGate list');
  }
});

test('minimax h3 margins carry a dual-scenario FX band pending real-billing calibration', () => {
  const unitPriceCny = Math.min(...Object.values(PRODUCTS)
    .filter(product => product.currency === 'ec_points')
    .map(product => (product.priceFen / 100) / product.grantUnits));
  // 汇率修正（2026-09）：poke2api 计价口径未证实，H3 成本按双情景标注——
  // 1:1 情景 ≈¥0.76/条（倾向，同源 65535 已实证 $ 按 ×1 读）/ 7.15 情景 ¥5.45/条；
  // 落库仍取保守上界 ¥5.45。锁定口径不变：保守情景短档 <70%、长档 ≥70%；
  // 倾向情景两档都应远高于门禁——¥5.45 只是上界，不得据此断言 H3 档保底亏损。
  const marginAtCost = (feature, costCny) =>
    ((feature.units * unitPriceCny) * 0.97 - costCny) / (feature.units * unitPriceCny);
  for (const sku of ['video_minimax_h3_2k_short', 'video_minimax_h3_2k_long']) {
    const feature = FEATURE_SKUS[sku];
    assert.equal(feature.providerCostCny, 5.45, sku + ' keeps booking the conservative upper bound');
    assert.ok(marginAtCost(feature, 0.76) > 0.70,
      sku + ' favorable 1:1 scenario should clear the 70% gate by a wide margin');
  }
  // 双情景区间宽度必须显著（>18 个百分点），否则单点展示不会误导、区间化就没有必要。
  const shortFeature = FEATURE_SKUS.video_minimax_h3_2k_short;
  const spread = marginAtCost(shortFeature, 0.76) - marginAtCost(shortFeature, 5.45);
  assert.ok(spread > 0.18,
    'dual-scenario margin spread should stay material: ' + spread.toFixed(4));
});

test('quotes an explicit design-direction refresh as one AI point', () => {
  assert.deepEqual(quoteFeature('ec_direction_refresh', 1), {
    sku: 'ec_direction_refresh',
    quantity: 1,
    units: 1000,
    totalUnits: 1000,
    currency: 'ec_points',
    providerCostCny: 0.05,
  });
});

test('low-cost AI helpers share a server-authoritative 0.2 point quote', () => {
  assert.deepEqual(quoteFeature('ec_ai_assistant', 1), {
    sku: 'ec_ai_assistant',
    quantity: 1,
    units: 200,
    totalUnits: 200,
    currency: 'ec_points',
    providerCostCny: 0.01,
  });
});

test('pixel-layer preparation has a server-authoritative quote', () => {
  assert.deepEqual(quoteFeature('ec_layer_psd', 1), {
    sku: 'ec_layer_psd', quantity: 1, units: 3000, totalUnits: 3000,
    currency: 'ec_points', providerCostCny: 0.20,
  });
});

test('automatic smart layering has a dedicated server-authoritative quote', () => {
  assert.deepEqual(quoteFeature('ec_smart_layer', 1), {
    sku: 'ec_smart_layer', quantity: 1, units: 3000, totalUnits: 3000,
    currency: 'ec_points', providerCostCny: 0.20,
  });
});

test('quote quantity must be a positive integer', () => {
  for (const quantity of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.throws(() => quoteFeature('ec_image_2k', quantity), /quantity/i);
  }
});

test('rejects quotes whose total units are not a safe integer', () => {
  assert.throws(
    () => quoteFeature('ec_image_2k', Number.MAX_SAFE_INTEGER),
    /totalUnits.*safe integer/i,
  );
});

test('rejects a feature price below the 70 percent contribution margin gate', () => {
  assert.throws(() => assertContributionMargin({ providerCostCny: 0.0694 }, 0.20), /margin/i);
});

test('accepts a feature price at the 70 percent contribution margin gate', () => {
  assert.ok(Math.abs(assertContributionMargin({ providerCostCny: 0.027 }, 0.1) - 0.7) < 1e-12);
});

test('accepts the exact 70 percent contribution margin boundary', () => {
  assert.doesNotThrow(() => assertContributionMargin({ providerCostCny: 0.5373 }, 1.99));
});

test('rejects a mathematically below-gate margin without micro-yuan rounding', () => {
  assert.throws(() => assertContributionMargin({ providerCostCny: 0.2700004 }, 1), /margin/i);
});

test('accepts a positive provider cost smaller than one micro-yuan', () => {
  assert.doesNotThrow(() => assertContributionMargin({ providerCostCny: 0.0000004 }, 1));
});

test('prices and provider costs must be positive finite numbers', () => {
  for (const unitPriceCny of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.throws(() => assertContributionMargin({ providerCostCny: 0.01 }, unitPriceCny), /price/i);
  }
  for (const providerCostCny of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.throws(() => assertContributionMargin({ providerCostCny }, 0.1), /cost/i);
  }
});
