const LEGACY_CURRENCY = 'content_sets';
const UNIFIED_CURRENCY = 'ec_points';

const LEGACY_CONFIG = Object.freeze({
  currency: LEGACY_CURRENCY,
  itemKey: 'content-set',
  itemSku: 'content_full_set',
  itemUnits: 1,
  regenerationUnits: true,
});

const UNIFIED_CONFIG = Object.freeze({
  currency: UNIFIED_CURRENCY,
  itemKey: 'xhs-image-set',
  itemSku: 'xhs_image_set_2k',
  itemUnits: 9000,
  regenerationUnits: false,
});

function positiveInteger(value, fallback) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : fallback;
}

function envValue(name) {
  const value = globalThis.process?.env?.[name];
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * `content_sets` is intentionally the library default so historical callers
 * and replay tests remain compatible. The application sets the production
 * mode to `ec_points` before constructing its services.
 */
export function resolveContentBillingConfig(overrides = {}) {
  const requestedCurrency = String(
    overrides.currency ?? envValue('SHUBAO_CONTENT_BILLING_CURRENCY') ?? LEGACY_CURRENCY,
  ).trim().toLowerCase();
  const base = requestedCurrency === UNIFIED_CURRENCY ? UNIFIED_CONFIG : LEGACY_CONFIG;
  const itemUnits = positiveInteger(
    overrides.itemUnits ?? envValue('SHUBAO_CONTENT_BILLING_UNITS'),
    base.itemUnits,
  );
  return Object.freeze({
    ...base,
    ...(overrides.itemKey ? { itemKey: String(overrides.itemKey).trim() } : {}),
    ...(overrides.itemSku ? { itemSku: String(overrides.itemSku).trim() } : {}),
    itemUnits,
    regenerationUnits: overrides.regenerationUnits ?? base.regenerationUnits,
  });
}

export const CONTENT_BILLING_CURRENCIES = Object.freeze({
  LEGACY: LEGACY_CURRENCY,
  UNIFIED: UNIFIED_CURRENCY,
});
