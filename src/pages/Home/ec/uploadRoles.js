export const PRODUCT_UPLOAD_ROLES = [
  { key: 'front', label: '正面主视图', hint: '建议先放一张清晰商品图' },
  { key: 'side', label: '侧面 / 45°图', hint: '可补充，帮助保持比例一致' },
  { key: 'back', label: '背面图', hint: '可补充背面结构' },
  { key: 'scene', label: '使用场景图', hint: '可补充真实使用方式' },
  { key: 'detail', label: '材质或结构细节', hint: '可补充纹理、接口或工艺' },
  { key: 'sku', label: '包装 / SKU图', hint: '可补充颜色与规格关系' },
];

export function nextProductRole(images = []) {
  return PRODUCT_UPLOAD_ROLES[Math.min(images.length, PRODUCT_UPLOAD_ROLES.length - 1)];
}
