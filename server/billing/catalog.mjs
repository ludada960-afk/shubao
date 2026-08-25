const CONTRIBUTION_MARGIN_GATE = 0.70;

function freezeCatalog(entries) {
  return Object.freeze(Object.fromEntries(
    Object.entries(entries).map(([sku, item]) => [sku, Object.freeze(item)]),
  ));
}

export const PRODUCTS = freezeCatalog({
  ec_trial_990: { sku: 'ec_trial_990', priceFen: 990, currency: 'ec_points', grantUnits: 30000, validityDays: null },
  ec_starter_29: { sku: 'ec_starter_29', priceFen: 2900, currency: 'ec_points', grantUnits: 105000, validityDays: null },
  ec_growth_79: { sku: 'ec_growth_79', priceFen: 7900, currency: 'ec_points', grantUnits: 295000, validityDays: null },
  ec_studio_199: { sku: 'ec_studio_199', priceFen: 19900, currency: 'ec_points', grantUnits: 760000, validityDays: null },
  xhs_entry_19: { sku: 'xhs_entry_19', priceFen: 1900, currency: 'content_sets', grantUnits: 3, validityDays: 30, regenPerWork: 5 },
  xhs_growth_49: { sku: 'xhs_growth_49', priceFen: 4900, currency: 'content_sets', grantUnits: 10, validityDays: 30, regenPerWork: 8 },
  xhs_creator_99: { sku: 'xhs_creator_99', priceFen: 9900, currency: 'content_sets', grantUnits: 25, validityDays: 30, regenPerWork: 15 },
  xhs_studio_199: { sku: 'xhs_studio_199', priceFen: 19900, currency: 'content_sets', grantUnits: 60, validityDays: 30, regenPerWork: 30 },
});

export const FEATURE_SKUS = freezeCatalog({
  // Both middle-station dashboards label balances with "$" but settle these prices in CNY.
  ec_image_2k: { units: 1000, providerCostCny: 0.038 },
  ec_image_4k: { units: 2000, providerCostCny: 0.038 },
  ec_nano_flash_1k: { units: 1000, providerCostCny: 0.06 },
  ec_nano_flash_2k: { units: 1000, providerCostCny: 0.06 },
  ec_nano_flash_4k: { units: 2000, providerCostCny: 0.06 },
  ec_nano_pro_1k: { units: 1000, providerCostCny: 0.06 },
  ec_nano_pro_2k: { units: 1000, providerCostCny: 0.06 },
  ec_nano_pro_4k: { units: 2000, providerCostCny: 0.06 },
  // Video products are priced against the least favorable point package and
  // include the payment-cost allowance in the contribution-margin gate.
  // 成本口径（2026-09 核定）：
  // - Seedance（IP233 按条计费）：720p ¥5.07/条；1080p ¥6.37/条（1080p 产品未上架，先留档）。
  // - MiniMax H3 经 Poke 中转（0.2× 折扣后 input $0.42–0.84、output $1.68–3.36 /1M token）。
  //   每条估算：典型任务 prompt≈600 字 + 2 张参考图（≈2.6k 输入 token）、2K 约 300k 输出 token
  //   （≈50k token/秒 × 6 秒），按中位价 (2.6×0.63 + 300×2.52)/1000 ≈ $0.758 ≈ ¥5.45（汇率 7.2）。
  //   该值为估算（cost_confidence=low），待首张真实账单校准；输入端封顶 ≤¥0.15/条，误差主要在输出 token 单耗。
  video_seedance_fast_short: { units: 40000, providerCostCny: 5.07 },
  video_seedance_fast_long: { units: 46000, providerCostCny: 5.07 },
  video_seedance_standard_short: { units: 62000, providerCostCny: 5.07 },
  video_seedance_standard_long: { units: 72000, providerCostCny: 5.07 },
  video_minimax_h3_2k_short: { units: 68000, providerCostCny: 5.45, public: false },
  video_minimax_h3_2k_long: { units: 78000, providerCostCny: 5.45, public: false },
  video_plan_analysis: { units: 1000, providerCostCny: 0.05 },
  // One Xiaohongshu/Plog set is a cover plus eight content images.
  // It uses the same point ledger as ecommerce generation: 9 x 2K images.
  xhs_image_set_2k: { units: 9000, currency: 'ec_points', providerCostCny: 0.342 },
  ec_ai_assistant: { units: 200, providerCostCny: 0.01 },
  ec_extension_analysis: { units: 1500, providerCostCny: 0.09 },
  ec_extension_basic: { units: 3000, providerCostCny: 0.114 },
  ec_extension_standard: { units: 5000, providerCostCny: 0.19 },
  ec_extension_complete: { units: 9000, providerCostCny: 0.342 },
  ec_reverse_prompt: { units: 200, providerCostCny: 0.01 },
  ec_canvas_ocr: { units: 200, providerCostCny: 0.01 },
  ec_remove_bg: { units: 500, providerCostCny: 0.03 },
  ec_direction_refresh: { units: 1000, providerCostCny: 0.05 },
  ec_smart_layer: { units: 3000, providerCostCny: 0.20 },
  ec_layer_psd: { units: 3000, providerCostCny: 0.20 },
  content_full_set: { units: 1, currency: 'content_sets' },
});

function assertPositiveFinite(value, label) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new TypeError(`${label} must be a positive finite number`);
  }
}

function toDecimalRational(value, label) {
  assertPositiveFinite(value, label);
  const [mantissa, exponentText] = value.toString().toLowerCase().split('e');
  const [whole, fraction = ''] = mantissa.split('.');
  const exponent = Number(exponentText ?? 0);
  let numerator = BigInt(`${whole}${fraction}`);
  let scale = fraction.length - exponent;
  if (scale < 0) {
    numerator *= 10n ** BigInt(-scale);
    scale = 0;
  }
  return { numerator, scale };
}

export function getProduct(sku) {
  if (!Object.hasOwn(PRODUCTS, sku)) throw new Error(`Unknown product SKU: ${sku}`);
  const product = PRODUCTS[sku];
  return { ...product };
}

export function quoteFeature(sku, quantity) {
  if (!Object.hasOwn(FEATURE_SKUS, sku)) throw new Error(`Unknown feature SKU: ${sku}`);
  const feature = FEATURE_SKUS[sku];
  if (!Number.isSafeInteger(quantity) || quantity <= 0) {
    throw new TypeError('quantity must be a positive integer');
  }
  if (feature.enabled === false) {
    throw new Error(`Feature ${sku} is not enabled`);
  }

  const totalUnits = feature.units * quantity;
  if (!Number.isSafeInteger(totalUnits)) {
    throw new RangeError('totalUnits must be a safe integer');
  }

  return {
    sku,
    quantity,
    units: feature.units,
    totalUnits,
    currency: feature.currency ?? 'ec_points',
    providerCostCny: feature.providerCostCny,
  };
}

export function assertContributionMargin(item, unitPriceCny) {
  if (!item || typeof item !== 'object') {
    throw new TypeError('feature item is required');
  }
  const unitPrice = toDecimalRational(unitPriceCny, 'unit price');
  const providerCost = toDecimalRational(item.providerCostCny, 'provider cost');
  const commonScale = Math.max(unitPrice.scale, providerCost.scale);
  const unitPriceNumerator = unitPrice.numerator * 10n ** BigInt(commonScale - unitPrice.scale);
  const providerCostNumerator = providerCost.numerator * 10n ** BigInt(commonScale - providerCost.scale);

  const margin = (unitPriceCny - unitPriceCny * 0.03 - item.providerCostCny) / unitPriceCny;
  if (providerCostNumerator * 100n > unitPriceNumerator * 27n) {
    throw new Error(`Contribution margin ${margin.toFixed(4)} is below ${CONTRIBUTION_MARGIN_GATE.toFixed(2)}`);
  }
  return margin;
}
