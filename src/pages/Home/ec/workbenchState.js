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
