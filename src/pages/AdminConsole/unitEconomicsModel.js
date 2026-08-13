function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function selectConservativeProduct(products = []) {
  return products
    .filter(product => finite(product.priceFen) > 0 && finite(product.grantUnits) > 0)
    .reduce((selected, product) => {
      if (!selected) return product;
      return finite(product.priceFen) / finite(product.grantUnits)
        < finite(selected.priceFen) / finite(selected.grantUnits) ? product : selected;
    }, null);
}

export function buildUnitEconomicsRows({ catalog, basisSku, quantity = 1, revenueMode = 'paid', featureSkus } = {}) {
  const products = Array.isArray(catalog?.products) ? catalog.products : [];
  const features = Array.isArray(catalog?.features) ? catalog.features : [];
  const basis = products.find(product => product.sku === basisSku) || selectConservativeProduct(products);
  const unitsPerPoint = Math.max(1, finite(catalog?.unitsPerPoint, 1000));
  const count = Math.max(1, Math.floor(finite(quantity, 1)));
  const pointRevenueCny = basis ? (finite(basis.priceFen) / 100) / (finite(basis.grantUnits) / unitsPerPoint) : 0;
  const paymentFeeRate = Math.max(0, finite(catalog?.paymentFeeRate));
  const allowed = Array.isArray(featureSkus) ? new Set(featureSkus) : null;

  return features.filter(feature => !allowed || allowed.has(feature.sku)).map(feature => {
    const points = (finite(feature.units) / unitsPerPoint) * count;
    const providerCostCny = finite(feature.providerCostCny) * count;
    const revenueCny = revenueMode === 'gift' ? 0 : points * pointRevenueCny;
    const paymentFeeCny = revenueMode === 'gift' ? 0 : revenueCny * paymentFeeRate;
    const profitCny = revenueCny - providerCostCny - paymentFeeCny;
    return { sku: feature.sku, quantity: count, points, pointRevenueCny, revenueCny, providerCostCny, paymentFeeCny, profitCny, margin: revenueCny > 0 ? profitCny / revenueCny : null };
  });
}
