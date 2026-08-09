export const PRODUCT_SLOT_PLAN = [
  { key: 'front', label: '产品图1', hint: '上传第一张清晰商品图，展示你希望保留的真实外观' },
  { key: 'angle', label: '产品图2', hint: '可补充任意角度，帮助补全商品结构和比例' },
  { key: 'back', label: '产品图3', hint: '可继续上传商品图，补充未展示的部分' },
  { key: 'detail', label: '产品图4', hint: '可补充材质、接口、纹理或工艺细节' },
  { key: 'scale', label: '产品图5', hint: '可补充使用或尺度关系，便于完整识别' },
];

export function nextProductSlot(count = 0) {
  const safeCount = Number.isFinite(count) ? Math.max(0, count) : 0;
  return PRODUCT_SLOT_PLAN[safeCount] || {
    key: `product-${safeCount + 1}`,
    label: `产品图${safeCount + 1}`,
    hint: '继续上传商品图，补充商品的真实信息',
  };
}

export function createWorkbenchState() {
  return {
    packageMode: 'taobao',
    skus: [],
    productImages: [],
    refImages: [],
  };
}

export function createSmartOverrides() {
  return {
    sizing: false,
    style: false,
    params: false,
    sku: false,
    copy: false,
    settings: false,
  };
}

export function createSmartConfiguration() {
  return {
    platform: 'taobao',
    commerceContext: {
      platform: 'taobao',
      contentType: 'main',
      targetLanguage: 'zh-CN',
    },
    sizing: { smart: true, images: [] },
    styleSkill: 'smart',
    customColors: null,
    productParams: { category: '', size: '', baseColor: '', accentColor: '', material: '', craft: '' },
    skus: [],
    copywriting: { plan: '', sellingPoints: '', qc: '', details: '', maintenance: '' },
    genSettings: { resolution: '2K', negativePrompt: '' },
  };
}

function hasText(value) {
  return String(value ?? '').trim().length > 0;
}

export function deriveEffectiveSmartOverrides(configuration = {}) {
  const sizing = configuration.sizing || {};
  const customColors = Array.isArray(configuration.customColors)
    ? configuration.customColors.filter(hasText)
    : [];
  const productParams = configuration.productParams || {};
  const copywriting = configuration.copywriting || {};
  const genSettings = configuration.genSettings || {};
  const commerceContext = {
    contentType: 'main',
    targetLanguage: 'zh-CN',
    ...(configuration.commerceContext || {}),
  };

  return {
    sizing: configuration.platform !== 'taobao'
      || commerceContext.contentType !== 'main'
      || sizing.smart === false
      || (Array.isArray(sizing.images) && sizing.images.length > 0 && sizing.smart !== true),
    style: configuration.styleSkill !== 'smart' || customColors.length > 0,
    params: Object.values(productParams).some(hasText),
    sku: (Array.isArray(configuration.skus) ? configuration.skus : [])
      .some(sku => ['color', 'size', 'capacity', 'dimLabel'].some(field => hasText(sku?.[field]))),
    copy: Object.values(copywriting).some(hasText),
    settings: (genSettings.resolution || '2K') !== '2K' || hasText(genSettings.negativePrompt)
      || commerceContext.targetLanguage !== 'zh-CN',
  };
}

const IMAGE_SUMMARY_LABELS = Object.freeze({
  white_bg: '白底',
  main_text: '主图',
  main_3x4: '竖图',
  transparent: '素材',
  detail: '详情',
  sku: 'SKU',
});

const PARAM_SUMMARY_LABELS = Object.freeze({
  category: '品类',
  size: '尺寸',
  baseColor: '主色',
  accentColor: '辅色',
  material: '材质',
  craft: '工艺',
});

export function summarizeCommerceConfiguration(kind, state = {}) {
  if (kind === 'sizing') {
    const parts = (Array.isArray(state.images) ? state.images : [])
      .filter(image => Number(image?.count) > 0)
      .map(image => `${Number(image.count)}${IMAGE_SUMMARY_LABELS[image.key] || image.label || image.key}`);
    return parts.join('丨') || '智能套图';
  }
  if (kind === 'sku') {
    const skus = (Array.isArray(state.skus) ? state.skus : [])
      .filter(sku => ['color', 'size', 'capacity', 'dimLabel'].some(field => String(sku?.[field] || '').trim()));
    if (!skus.length) return 'SKU变体';
    const count = skus.reduce((total, sku) => total + Math.max(1, Number(sku?.count) || 1), 0);
    return `${skus.length}变体丨${count}张`;
  }
  if (kind === 'params') {
    const parts = Object.entries(state.productParams || {})
      .filter(([, value]) => String(value || '').trim())
      .map(([key]) => PARAM_SUMMARY_LABELS[key] || key);
    return parts.join('丨') || '商品信息';
  }
  return '';
}

export function buildUploadDeck({ productImages = [], refImages = [] } = {}) {
  return {
    productSlot: nextProductSlot(productImages.length).key,
    productRail: [...productImages],
    referenceRail: [...refImages],
  };
}

export function reconcilePackage({ baseline = [], draft = [], applied = [] } = {}) {
  const normalizedBaseline = [...baseline];
  const normalizedDraft = [...draft];
  const baselineKey = normalizedBaseline.join('|');
  const draftKey = normalizedDraft.join('|');
  return draftKey === baselineKey ? normalizedBaseline : normalizedDraft.length ? normalizedDraft : [...applied];
}

export function summarizePackage({ platform = 'taobao', images = [] } = {}) {
  if (platform === 'taobao' && !images.length) return '淘宝套图方案';
  const imageCount = images.reduce((total, item) => total + (item?.count || 0), 0);
  return imageCount ? `${imageCount} 张套图` : '自定义套图方案';
}

function normalizeSupplementImage(image, locked, status) {
  const value = typeof image === 'string' ? { url: image } : { ...(image || {}) };
  return { ...value, url: value.url || value.src || value.image_url || '', locked, status };
}

export function buildSupplementDeck({ inheritedProductImages = [], addedProductImages = [], inheritedReferenceImages = [], addedReferenceImages = [] } = {}) {
  return {
    productImages: [
      ...inheritedProductImages.map(image => normalizeSupplementImage(image, true, '已带入')),
      ...addedProductImages.map(image => normalizeSupplementImage(image, false, '本轮新增')),
    ].filter(image => image.url),
    referenceImages: [
      ...inheritedReferenceImages.map(image => normalizeSupplementImage(image, true, '已带入')),
      ...addedReferenceImages.map(image => normalizeSupplementImage(image, false, '本轮新增')),
    ].filter(image => image.url),
  };
}

function canvasSourceAsset(asset) {
  if (typeof asset === 'string') return asset ? { url: asset } : null;
  if (!asset || typeof asset !== 'object') return null;
  const url = asset.url || asset.src || asset.image_url || '';
  return url ? { ...asset, url } : null;
}

export function withEcommerceCanvasSources(delivery = {}, { productAssets = [], referenceAssets = [] } = {}) {
  return {
    ...delivery,
    productAssets: (Array.isArray(productAssets) ? productAssets : []).map(canvasSourceAsset).filter(Boolean),
    referenceAssets: (Array.isArray(referenceAssets) ? referenceAssets : []).map(canvasSourceAsset).filter(Boolean),
  };
}
