const SAFE_PROVIDER_ID = /^[a-z0-9][a-z0-9_-]{0,127}$/i;

function publicProductMap(catalog) {
  const products = Array.isArray(catalog?.products) ? catalog.products : [];
  return new Map(products.map(product => [product?.sku, product]));
}

function validCatalogProduct(product, currency) {
  return product
    && product.currency === currency
    && Number.isSafeInteger(product.priceFen)
    && product.priceFen > 0
    && Number.isSafeInteger(product.grantUnits)
    && product.grantUnits > 0
    && (product.validityDays === null
      || (Number.isSafeInteger(product.validityDays) && product.validityDays > 0));
}

export function buildPricingPlans(catalog, metadata, currency) {
  const bySku = publicProductMap(catalog);
  return (Array.isArray(metadata) ? metadata : []).flatMap((fallback) => {
    const product = bySku.get(fallback?.sku);
    if (!validCatalogProduct(product, currency)) return [];
    return [{
      sku: product.sku,
      name: fallback.name || product.sku,
      description: fallback.desc || '',
      recommended: Boolean(fallback.pop),
      priceFen: product.priceFen,
      grantUnits: product.grantUnits,
      validityDays: product.validityDays,
      currency: product.currency,
      enabled: product.enabled !== false,
    }];
  });
}

export function enabledPaymentProviders(catalog) {
  const providers = Array.isArray(catalog?.paymentProviders) ? catalog.paymentProviders : [];
  return providers
    .filter(provider => provider?.enabled === true && SAFE_PROVIDER_ID.test(provider?.id || ''))
    .map(provider => ({ id: provider.id, enabled: true }));
}

export function formatCatalogPrice(priceFen) {
  const value = Number(priceFen) / 100;
  return Number.isFinite(value)
    ? new Intl.NumberFormat('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(value)
    : '—';
}

export function formatCatalogGrant(product) {
  if (product?.currency === 'ec_points') {
    return `${new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 3 }).format(Number(product.grantUnits || 0) / 1000)} AI 积分`;
  }
  return `${Number(product?.grantUnits || 0)} 创作套数`;
}

function fallbackUuid(cryptoImpl) {
  if (!cryptoImpl || typeof cryptoImpl.getRandomValues !== 'function') {
    throw new Error('当前浏览器不支持安全订单标识，请升级浏览器后重试');
  }
  const bytes = cryptoImpl.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function createOrderRequest(input, cryptoImpl = globalThis.crypto) {
  const productSku = typeof input?.productSku === 'string' ? input.productSku.trim() : '';
  const provider = typeof input?.provider === 'string' ? input.provider.trim() : '';
  if (!productSku || !provider) throw new TypeError('productSku and provider are required');
  const idempotencyKey = typeof cryptoImpl?.randomUUID === 'function'
    ? cryptoImpl.randomUUID()
    : fallbackUuid(cryptoImpl);
  return { productSku, provider, idempotencyKey };
}
