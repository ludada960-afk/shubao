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
  // This Seedance channel charges a fixed amount per successful generation.
  // Point weights keep at least 70%
  // model contribution margin against the least expensive point package.
  video_seedance_480p_short: { units: 32000, providerCostCny: 4.355 },
  video_seedance_480p_long: { units: 40000, providerCostCny: 4.355 },
  video_seedance_720p_short: { units: 48000, providerCostCny: 4.355 },
  video_seedance_720p_long: { units: 58000, providerCostCny: 4.355 },
  // One Xiaohongshu/Plog set is a cover plus eight content images.
  // It uses the same point ledger as ecommerce generation: 9 x 2K images.
  xhs_image_set_2k: { units: 9000, currency: 'ec_points', providerCostCny: 0.342 },
  ec_reverse_prompt: { units: 200, providerCostCny: 0.01 },
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
