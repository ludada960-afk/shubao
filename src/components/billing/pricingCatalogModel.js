const SAFE_PROVIDER_ID = /^[a-z0-9][a-z0-9_-]{0,127}$/i;
const PAYMENT_PROVIDER_LABELS = Object.freeze({
  wechat: '微信支付',
  wechatpay: '微信支付',
  wechat_pay: '微信支付',
  alipay: '支付宝',
  alipay_trade: '支付宝',
  stripe: '银行卡支付',
});

const PAYMENT_CHANNEL_LABELS = Object.freeze({
  balance: '余额充值',
  wechat_qr: '微信支付',
  alipay: '支付宝',
});

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
      // 预付月卡礼包：一次性买断积分+赠分（无自动续订），赠分随服务端目录下发。
      giftUnits: Number.isSafeInteger(product.giftUnits) && product.giftUnits > 0 ? product.giftUnits : null,
    }];
  });
}

export function createPricingModalViewState({
  interrupted = false,
  pendingAction = null,
  priceReason = null,
} = {}) {
  return {
    mode: interrupted ? 'insufficient' : 'plans',
    interrupted: Boolean(interrupted),
    pendingAction,
    priceReason,
  };
}

export function transitionPricingModalView(state, event) {
  if (!state || typeof state !== 'object') {
    return createPricingModalViewState();
  }
  if (event === 'VIEW_PLANS') {
    return { ...state, mode: 'plans' };
  }
  if (event === 'RETURN_TO_INSUFFICIENT' && state.interrupted) {
    return { ...state, mode: 'insufficient' };
  }
  return state;
}

export function enabledPaymentProviders(catalog) {
  const providers = Array.isArray(catalog?.paymentProviders) ? catalog.paymentProviders : [];
  return providers
    .filter(provider => provider?.enabled === true && SAFE_PROVIDER_ID.test(provider?.id || ''))
    .map(provider => ({ id: provider.id, enabled: true }));
}

export function formatPaymentProviderLabel(providerId) {
  const normalized = typeof providerId === 'string' ? providerId.trim().toLowerCase() : '';
  return PAYMENT_PROVIDER_LABELS[normalized] || '在线支付';
}

export function formatCatalogPrice(priceFen) {
  const value = Number(priceFen) / 100;
  return Number.isFinite(value)
    ? new Intl.NumberFormat('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(value)
    : '—';
}

export function formatCatalogGrant(product) {
  if (product?.currency !== 'ec_points') {
    return `${Number(product?.grantUnits || 0)} 创作套数`;
  }
  const total = new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 3 }).format(Number(product.grantUnits || 0) / 1000);
  if (!product.giftUnits) return `${total} AI 积分`;
  const gift = new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 3 }).format(product.giftUnits / 1000);
  return `${total} AI 积分（含赠 ${gift}）`;
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
  const requestedKey = typeof input?.idempotencyKey === 'string' ? input.idempotencyKey.trim() : '';
  const idempotencyKey = requestedKey || (typeof cryptoImpl?.randomUUID === 'function'
    ? cryptoImpl.randomUUID()
    : fallbackUuid(cryptoImpl));
  return { productSku, provider, idempotencyKey };
}
// 支付区视图：微信/支付宝置灰「即将开通」，仅余额充值通道可点。
export function listPaymentChannels(catalog) {
  const channels = Array.isArray(catalog?.paymentChannels) ? catalog.paymentChannels : [];
  return channels
    .filter(channel => SAFE_PROVIDER_ID.test(channel?.id || ''))
    .map(channel => ({
      id: channel.id,
      label: PAYMENT_CHANNEL_LABELS[channel.id] || channel.label || '在线支付',
      kind: channel.kind === 'external' ? 'external' : 'internal',
      status: channel.status === 'active' ? 'active' : 'unavailable',
      enabled: channel.enabled === true,
      availabilityNote: typeof channel.availabilityNote === 'string' ? channel.availabilityNote : '',
      description: typeof channel.description === 'string' ? channel.description : '',
    }));
}

// ── 视频按量档位视图（2026-08-26 终案）──
// 价格与积分来自服务端目录（features[].priceFen / units），此处只承载展示元数据；
// comingSoon 的档位（1080p / H3-2K 未上架）在目录中不出现，页面以「即将上线」呈现。
export const VIDEO_TIER_METADATA = Object.freeze([
  {
    sku: 'video_seedance_fast_short',
    eyebrow: 'FAST',
    name: '快试',
    tagline: '5 秒试稿钩子，跑通节奏再上正式档',
    comingSoon: false,
    bullets: ['单条 ≤ 5 秒', '每日最多 3 条', '仅快速通道出片'],
  },
  {
    sku: 'video_seedance_standard_short',
    eyebrow: 'STANDARD',
    name: '标准',
    tagline: '720P 正式交付的主力档',
    comingSoon: false,
    bullets: ['≤8 秒短片', '商品/人物/场景通用', '失败不计费'],
  },
  {
    sku: 'video_seedance_standard_long',
    eyebrow: 'PREMIUM',
    name: '高品质',
    badge: '含 1 次免费重跑',
    tagline: '长时长交付，结果不满意免费重做一次',
    comingSoon: false,
    bullets: ['>8 秒长片', '含 1 次免费重跑', '失败不计费'],
  },
  {
    sku: 'video_seedance_1080p',
    eyebrow: 'FULL HD',
    name: '1080P',
    tagline: '全高清交付，适合投放主视觉',
    comingSoon: true,
    bullets: ['1080P 全高清', '上线前公示最终价格'],
  },
  {
    sku: 'video_minimax_h3_2k_short',
    eyebrow: 'H3 · 2K',
    name: 'H3 2K 精制',
    tagline: '2K 精修路线，多模态与首尾帧',
    comingSoon: true,
    bullets: ['2K 分辨率', '支持首尾帧', '白名单逐步开放'],
  },
]);

export function buildVideoTiers(catalog) {
  const features = Array.isArray(catalog?.features) ? catalog.features : [];
  const bySku = new Map(features.map(feature => [feature.sku, feature]));
  const imageUnits = bySku.get('ec_image_2k')?.units || 1000;
  return VIDEO_TIER_METADATA.map(meta => {
    const feature = bySku.get(meta.sku);
    if (!feature || !Number.isSafeInteger(feature.units)) {
      return { ...meta, available: false, priceFen: null, points: null, imageEquivalent: null };
    }
    const points = feature.units / 1000;
    return {
      ...meta,
      available: meta.comingSoon !== true,
      priceFen: Number.isSafeInteger(feature.priceFen) ? feature.priceFen : null,
      points,
      // 「能买什么」换算：同等积分可兑换的 2K 商品图数量（用真实 SKU 折算）。
      imageEquivalent: Math.floor((points * 1000) / imageUnits),
    };
  });
}