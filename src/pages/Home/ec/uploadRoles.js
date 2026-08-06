export const PRODUCT_UPLOAD_ROLES = [
  { key: 'front', label: '产品图1', hint: '上传第一张清晰商品图' },
  { key: 'side', label: '产品图2', hint: '可补充任意角度或结构' },
  { key: 'back', label: '产品图3', hint: '可继续补充商品真实信息' },
  { key: 'scene', label: '产品图4', hint: '可补充使用方式或尺度关系' },
  { key: 'detail', label: '产品图5', hint: '可补充材质、接口或工艺' },
  { key: 'sku', label: '产品图6', hint: '可补充颜色、规格或包装关系' },
];

export function nextProductRole(images = []) {
  const index = Number.isFinite(images.length) ? Math.max(0, images.length) : 0;
  return PRODUCT_UPLOAD_ROLES[index] || {
    key: `product-${index + 1}`,
    label: `产品图${index + 1}`,
    hint: '继续上传商品图，补充商品真实信息',
  };
}
