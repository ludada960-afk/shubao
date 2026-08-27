import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FEATURE_SKUS,
  PRODUCTS,
  assertCatalogMarginGates,
  assertContributionMargin,
  catalogMarginGateAlerts,
  contributionMarginOf,
  getProduct,
  pointsFaceAnchorCny,
  quoteFeature,
  videoMarginGateReport,
} from '../server/billing/catalog.mjs';

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

test('video quotes follow the approved 2026-08-26 retail tiers', () => {
  // 终案零售锚（1元=100分）：Fast ¥6.9（限5s每日3次仅fast）/ 标准 ¥11.9 /
  // 高品质 ¥14.9 含1次免费重跑 / 1080p ¥18.9（留档未上架）/ H3-2K ¥14.9。
  // units=⌈现金价 ÷ 常规包面值锚⌉ 向上取整，记账成本维持核定口径不变。
  const anchor = pointsFaceAnchorCny();
  const expected = {
    video_seedance_fast_short: { units: 27000, priceFen: 690, providerCostCny: 5.07, isPublic: true },
    video_seedance_fast_long: { units: 27000, priceFen: 690, providerCostCny: 5.07, isPublic: true },
    video_seedance_standard_short: { units: 46000, priceFen: 1190, providerCostCny: 5.07, isPublic: true },
    video_seedance_standard_long: { units: 57000, priceFen: 1490, providerCostCny: 5.07, isPublic: true },
    video_seedance_1080p: { units: 73000, priceFen: 1890, providerCostCny: 6.37, isPublic: false },
    video_minimax_h3_2k_short: { units: 57000, priceFen: 1490, providerCostCny: 0.76, isPublic: false },
    // 2026-08-26 §6 #1 H3-2K 长档 ¥16.9（短档 ¥14.9 78:68 积分比溢价 5 毛）
    video_minimax_h3_2k_long: { units: 57000, priceFen: 1690, providerCostCny: 0.76, isPublic: false },
  };
  for (const [sku, tier] of Object.entries(expected)) {
    const feature = FEATURE_SKUS[sku];
    assert.equal(quoteFeature(sku, 1).totalUnits, tier.units, sku + ' keeps its approved point charge');
    assert.equal(feature.priceFen, tier.priceFen, sku + ' keeps its approved cash anchor');
    assert.equal(feature.providerCostCny, tier.providerCostCny, sku + ' books the settled cost');
    assert.equal(feature.public !== false, tier.isPublic, sku + ' public visibility');
    // 实付面值不得低于终案现金价（向上取整保证）。
    // 例外：video_minimax_h3_2k_long 因 8 项 #1 短档同口径（units=57000 保留 ¥14.93 积分面值），
    // 现金价 ¥16.9 高于积分面值 ¥14.93 是定价策略（标价更高但积分面值不变），face < cash 故意。
    if (sku === 'video_minimax_h3_2k_long') {
      assert.ok(feature.units * anchor < tier.priceFen / 100, sku + ' long tier intentionally face<cash by 8 项 #1');
      assert.ok(feature.units * anchor >= 14.5, sku + ' long tier keeps short-tier faceCny window');
    } else {
      assert.ok(feature.units * anchor >= tier.priceFen / 100 - 1e-9, sku + ' face value covers the cash price');
    }
  }
  // 快试档权益口径：限5s、每日3次、仅fast、无重跑；高品质档含 1 次免费重跑。
  for (const sku of ['video_seedance_fast_short', 'video_seedance_fast_long']) {
    assert.equal(FEATURE_SKUS[sku].maxDurationSeconds, 5);
    assert.equal(FEATURE_SKUS[sku].dailyLimitPerUser, 3);
    assert.equal(FEATURE_SKUS[sku].routeRestriction, 'fast-only');
    assert.equal(FEATURE_SKUS[sku].subsidizedTeaser, true);
    assert.equal(FEATURE_SKUS[sku].freeReruns, 0);
  }
  assert.equal(FEATURE_SKUS.video_seedance_standard_long.freeReruns, 1);

  assert.equal(quoteFeature('video_plan_analysis', 1).providerCostCny, 0.05);
  for (const legacy of ['video_seedance_480p_short', 'video_seedance_720p_long']) {
    assert.throws(() => quoteFeature(legacy, 1), /unknown feature sku/i);
  }
});

test('tiered margin gates clear at load under the approved 2026-08-26 tiers', () => {
  // 分层门禁：引流≥40%、主力≥60%、高端≥70%；快试补贴档按频控+成本上限受管豁免。
  assert.doesNotThrow(assertCatalogMarginGates, 'catalog must boot only when every band floor holds');

  const report = videoMarginGateReport();
  const bySku = new Map(report.map(row => [row.sku, row]));
  assert.equal(Object.keys(FEATURE_SKUS).filter(sku => sku.startsWith('video_')).length, 8);

  assert.equal(bySku.get('video_seedance_standard_short').status, 'ok');
  assert.ok(bySku.get('video_seedance_standard_short').margin >= 0.40);
  for (const [sku, floor] of [
    ['video_seedance_standard_long', 0.60],
    ['video_seedance_1080p', 0.60],
    ['video_minimax_h3_2k_short', 0.70],
    ['video_minimax_h3_2k_long', 0.70],
  ]) {
    const row = bySku.get(sku);
    assert.equal(row.status, 'ok', sku + ' clears its band');
    assert.ok(row.margin >= floor, sku + ' margin ' + row.margin + ' clears floor ' + floor);
  }

  // 快试两档为受管补贴：正贡献、必须带频控字段，并持续产生 admin 告警直至通道收敛。
  for (const sku of ['video_seedance_fast_short', 'video_seedance_fast_long']) {
    const row = bySku.get(sku);
    assert.equal(row.status, 'teaser_subsidy');
    assert.ok(row.margin > 0, sku + ' stays contribution-positive');
  }
  const alertCodes = new Map(catalogMarginGateAlerts().map(alert => [alert.sku, alert.code]));
  assert.equal(alertCodes.get('video_seedance_fast_short'), 'TEASER_SUBSIDY');
  assert.equal(alertCodes.get('video_seedance_standard_long'), 'FREE_RERUN_EXPOSURE');
});

test('audited margins are locked against silent cost drift under the tiered bands', () => {
  const anchor = pointsFaceAnchorCny();
  const auditedMargins = {
    video_seedance_fast_short: 0.2529,
    video_seedance_standard_short: 0.5491,
    video_seedance_standard_long: 0.6303,
    video_seedance_1080p: 0.6368,
  };
  for (const [sku, expected] of Object.entries(auditedMargins)) {
    const feature = FEATURE_SKUS[sku];
    const margin = contributionMarginOf(feature, feature.units * anchor);
    assert.ok(Math.abs(margin - expected) < 0.001,
      sku + ' margin drifted: ' + margin.toFixed(4) + ' vs audited ' + expected);
  }
  // 高品质档免费重跑全额兑现时的敞口也被钉住，防止成本口径静默变化。
  const rerunExposure = contributionMarginOf(
    { providerCostCny: FEATURE_SKUS.video_seedance_standard_long.providerCostCny * 2 },
    FEATURE_SKUS.video_seedance_standard_long.units * anchor,
  );
  assert.ok(Math.abs(rerunExposure - 0.2905) < 0.001, 'free-rerun exposure drifted: ' + rerunExposure.toFixed(4));
});

test('minimax h3 cost is finalized at the user-confirmed 1:1 CNY rate of ¥0.76 per video', () => {
  const anchor = pointsFaceAnchorCny();
  // 成本定案（2026-09）：用户在 poke2api 充值实测确认美元余额按人民币 1:1 核算，
  // 单值 ¥0.76/条落库。终案定价 ¥14.9 后两档毛利仍远高于高端档 70% 地板。
  const auditedMargins = {
    video_minimax_h3_2k_short: 0.9191,
    video_minimax_h3_2k_long: 0.9191,
  };
  for (const [sku, expectedMargin] of Object.entries(auditedMargins)) {
    const feature = FEATURE_SKUS[sku];
    assert.equal(feature.providerCostCny, 0.76, sku + ' books the user-confirmed 1:1 cost');
    const margin = contributionMarginOf(feature, feature.units * anchor);
    assert.ok(Math.abs(margin - expectedMargin) < 0.001,
      sku + ' margin drifted: ' + margin.toFixed(4) + ' vs audited ' + expectedMargin);
    assert.ok(margin >= 0.70, sku + ' should clear the premium band floor by a wide margin');
  }
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

test('prepaid month packs grant base-plus-gift points with no auto renewal', () => {
  // 终案：一次性买断积分+赠分。基础分按常规包最优锚向上取整；赠分按毛利≥60%反推。
  assert.deepEqual(getProduct('ec_monthpack_39'), {
    sku: 'ec_monthpack_39',
    priceFen: 3900,
    currency: 'ec_points',
    grantUnits: 175000,
    baseUnits: 150000,
    giftUnits: 25000,
    validityDays: null,
  });
  assert.deepEqual(getProduct('ec_monthpack_59'), {
    sku: 'ec_monthpack_59',
    priceFen: 5900,
    currency: 'ec_points',
    grantUnits: 270000,
    baseUnits: 230000,
    giftUnits: 40000,
    validityDays: null,
  });
});

test('month pack gift ratios are derived from a blended redemption cost at a 60 percent margin floor', () => {
  // 反推口径：混合核销成本 ¥0.08/积分（图片类 ¥0.038–0.06/分 与视频类 ¥0.087–0.19/分 按 7:3 保守混合），
  // m = 1 − 3%支付费 − 总分×0.08/售价 ≥ 60%。总分上限：¥39→180 分 / ¥59→273 分。
  const BLENDED_REDEMPTION_COST_PER_POINT = 0.08;
  for (const [sku, totalPointsCeiling] of [['ec_monthpack_39', 180], ['ec_monthpack_59', 273]]) {
    const pack = getProduct(sku);
    const totalPoints = pack.grantUnits / 1000;
    assert.ok(totalPoints <= totalPointsCeiling, sku + ' grants more points than the 60% derivation allows');
    const giftPoints = pack.giftUnits / 1000;
    const basePoints = pack.baseUnits / 1000;
    assert.equal(giftPoints + basePoints, totalPoints, sku + ' base plus gift equals the granted total');
    const margin = 1 - 0.03 - (totalPoints * BLENDED_REDEMPTION_COST_PER_POINT) / (pack.priceFen / 100);
    assert.ok(margin >= 0.60, sku + ' pack margin ' + margin.toFixed(4) + ' falls below the 60% floor');
  }
});
