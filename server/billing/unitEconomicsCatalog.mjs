import { FEATURE_SKUS, PRODUCTS } from './catalog.mjs';

const PAYMENT_FEE_RATE = 0.03;
const UNITS_PER_POINT = 1000;

export function buildUnitEconomicsCatalog() {
  return {
    unitsPerPoint: UNITS_PER_POINT,
    paymentFeeRate: PAYMENT_FEE_RATE,
    products: Object.values(PRODUCTS)
      .filter(product => product.currency === 'ec_points')
      .map(product => ({ sku: product.sku, priceFen: product.priceFen, grantUnits: product.grantUnits })),
    features: Object.entries(FEATURE_SKUS)
      .filter(([, feature]) => (feature.currency ?? 'ec_points') === 'ec_points' && feature.public !== false)
      .map(([sku, feature]) => ({ sku, units: feature.units, providerCostCny: feature.providerCostCny })),
  };
}
