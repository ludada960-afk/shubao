export function summarizeEcommerceResult(images = {}) {
  const imageCount = Object.values(images || {}).filter(value => {
    if (typeof value === 'string') return value.trim().length > 0;
    return Boolean(value?.url || value?.src || value?.image_url);
  }).length;
  return { imageCount, hasImages: imageCount > 0 };
}
