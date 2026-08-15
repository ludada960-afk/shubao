const clean = value => typeof value === 'string' ? value.trim() : '';
const LEGACY_PROMPT = '此历史案例未保存单图生成提示词。';
const LEGACY_DESCRIPTION = '此历史案例仅保留了图片，没有单图说明。';

function normalizeImage(image, index) {
  if (Array.isArray(image)) {
    return {
      url: clean(image[1]),
      label: clean(image[0]) || `商品展示图 ${index + 1}`,
      prompt: LEGACY_PROMPT,
      description: LEGACY_DESCRIPTION,
    };
  }

  const url = clean(image?.url || image?.src || image?.image_url);
  const label = clean(image?.label || image?.title || image?.style || image?.role) || `商品展示图 ${index + 1}`;
  return {
    ...image,
    url,
    label,
    prompt: clean(image?.prompt) || LEGACY_PROMPT,
    description: clean(image?.description || image?.sellingPoint || image?.purpose) || LEGACY_DESCRIPTION,
  };
}

export function ecommerceGallerySlides(item = {}) {
  const raw = Array.isArray(item.images) ? item.images : Object.entries(item.images || {});
  const images = raw.map(normalizeImage).filter(image => image.url);
  const coverUrl = clean(item.cover_mosaic_url || item.cover_url);
  if (!coverUrl) return images;

  const matchingCover = images.find(image => image.url === coverUrl);
  const cover = matchingCover
    ? { ...matchingCover, isCover: true }
    : {
        url: coverUrl,
        label: '套图总览',
        prompt: clean(item.prompt) || LEGACY_PROMPT,
        description: '把主图、场景、卖点与细节集中呈现，便于快速判断整套方案。',
        isCover: true,
      };

  return [cover, ...images.filter(image => image.url !== coverUrl)];
}
