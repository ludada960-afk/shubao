export const PRODUCT_SLOT_PLAN = [
  { key: 'front', label: '正面图', hint: '上传正面主视图，完整展示商品轮廓' },
  { key: 'angle', label: '45°侧面图', hint: '建议上传 45° 侧面图，补足结构与比例' },
  { key: 'back', label: '背面图', hint: '建议上传背面或俯视图，补足未展示部分' },
  { key: 'detail', label: '细节图', hint: '建议上传材质、接口、纹理或工艺细节' },
  { key: 'scale', label: '场景图', hint: '建议上传手持或使用场景，帮助判断尺度' },
];

export function nextProductSlot(count = 0) {
  const safeCount = Number.isFinite(count) ? Math.max(0, count) : 0;
  return PRODUCT_SLOT_PLAN[Math.min(safeCount, PRODUCT_SLOT_PLAN.length - 1)];
}

export function createWorkbenchState() {
  return {
    packageMode: 'smart',
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
    platform: 'smart',
    sizing: { smart: true, images: [] },
    styleSkill: 'smart',
    customColors: null,
    productParams: { category: '', size: '', baseColor: '', accentColor: '', material: '', craft: '' },
    skus: [],
    copywriting: { plan: '', sellingPoints: '', qc: '', details: '', maintenance: '' },
    genSettings: { resolution: '2K', negativePrompt: '' },
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

export function summarizePackage({ platform = 'smart', images = [] } = {}) {
  if (platform === 'smart' && !images.length) return '智能套图方案';
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
