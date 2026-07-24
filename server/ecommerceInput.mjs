export const PRODUCT_ROLE_LABELS = [
  '正面主视图',
  '侧面 / 45°图',
  '背面图',
  '使用场景图',
  '材质或结构细节',
  '包装 / SKU图',
];

export function roleForIndex(index) {
  return PRODUCT_ROLE_LABELS[Math.max(0, Math.min(Number(index) || 0, PRODUCT_ROLE_LABELS.length - 1))];
}

export function normalizeEcommerceInput(input = {}) {
  const productImages = Array.isArray(input.productImages) ? input.productImages.filter(Boolean).slice(0, 6) : [];
  const referenceImages = Array.isArray(input.referenceImages) ? input.referenceImages.filter(Boolean).slice(0, 50) : [];
  const styleAnchorCandidates = referenceImages.filter((_, index) => index === 0 || index === referenceImages.length - 1 || index % Math.max(1, Math.ceil(referenceImages.length / 4)) === 0).slice(0, 4);
  return {
    productImages,
    referenceImages,
    styleAnchorCandidates,
    productRoles: productImages.map((image, index) => ({ image, role: roleForIndex(index) })),
    productName: String(input.productName || '').trim(),
    category: String(input.category || '').trim(),
    prompt: String(input.prompt || '').trim(),
  };
}
