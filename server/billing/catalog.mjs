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
  ec_image_2k: { units: 1000, providerCostCny: 0.0694 },
  ec_image_4k: { units: 2000, providerCostCny: 0.0694 },
  ec_reverse_prompt: { units: 200, providerCostCny: 0.01 },
  ec_remove_bg: { units: 500, providerCostCny: 0.03 },
  ec_layer_psd: { units: 3000, providerCostCny: 0.20, enabled: false },
  content_full_set: { units: 1, currency: 'content_sets' },
});

function assertPositiveFinite(value, label) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new TypeError(`${label} must be a positive finite number`);
  }
}

function toMicroYuan(value, label) {
  assertPositiveFinite(value, label);
  const [mantissa, exponentText] = value.toString().toLowerCase().split('e');
  const [whole, fraction = ''] = mantissa.split('.');
  const exponent = Number(exponentText ?? 0);
  const digits = BigInt(`${whole}${fraction}`);
  const decimalPlaces = exponent + 6 - fraction.length;
  if (decimalPlaces >= 0) return digits * (10n ** BigInt(decimalPlaces));

  const divisor = 10n ** BigInt(-decimalPlaces);
  const rounded = (digits + divisor / 2n) / divisor;
  if (rounded <= 0n) {
    throw new TypeError(`${label} must be at least 0.000001 CNY`);
  }
  return rounded;
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
  const unitPriceMicroYuan = toMicroYuan(unitPriceCny, 'unit price');
  const providerCostMicroYuan = toMicroYuan(item.providerCostCny, 'provider cost');

  const margin = (unitPriceCny - unitPriceCny * 0.03 - item.providerCostCny) / unitPriceCny;
  if (providerCostMicroYuan * 100n > unitPriceMicroYuan * 27n) {
    throw new Error(`Contribution margin ${margin.toFixed(4)} is below ${CONTRIBUTION_MARGIN_GATE.toFixed(2)}`);
  }
  return margin;
}
