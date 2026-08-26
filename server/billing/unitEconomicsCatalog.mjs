import { FEATURE_SKUS, PRODUCTS, MARGIN_BANDS, catalogMarginGateAlerts, videoMarginGateReport } from './catalog.mjs';

const PAYMENT_FEE_RATE = 0.03;
const UNITS_PER_POINT = 1000;

export function buildUnitEconomicsCatalog() {
  return {
    unitsPerPoint: UNITS_PER_POINT,
    paymentFeeRate: PAYMENT_FEE_RATE,
    marginBands: MARGIN_BANDS,
    products: Object.values(PRODUCTS)
      .filter(product => product.currency === 'ec_points')
      .map(product => ({
        sku: product.sku,
        priceFen: product.priceFen,
        grantUnits: product.grantUnits,
        ...(Number.isSafeInteger(product.giftUnits) ? { giftUnits: product.giftUnits } : {}),
      })),
    features: Object.entries(FEATURE_SKUS)
      .filter(([, feature]) => (feature.currency ?? 'ec_points') === 'ec_points' && feature.public !== false)
      .map(([sku, feature]) => ({
        sku,
        units: feature.units,
        providerCostCny: feature.providerCostCny,
        ...(Number.isSafeInteger(feature.priceFen) ? { priceFen: feature.priceFen } : {}),
        // 分层毛利门禁上下文（2026-08-26 终案）：admin 看板据此展示档位与告警。
        ...(MARGIN_BANDS[feature.marginBand]
          ? { marginBand: feature.marginBand, marginFloor: MARGIN_BANDS[feature.marginBand].floor }
          : {}),
      })),
    videoMarginGates: videoMarginGateReport(),
    marginGateAlerts: catalogMarginGateAlerts(),
  };
}
