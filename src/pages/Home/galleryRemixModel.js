const PRODUCT_SOURCE_PATTERN = /白底|透明|png|去背|抠图/i;

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function imageUrl(value) {
  if (typeof value === 'string') return cleanText(value);
  return cleanText(value?.url || value?.src || value?.image_url);
}

function reusableImage(value, role) {
  const url = imageUrl(value);
  if (!url) return null;
  return typeof value === 'object'
    ? { ...value, url, role: value.role || role, reusableGalleryAsset: true }
    : { url, role, reusableGalleryAsset: true };
}

function uniqueImages(values, role, limit) {
  const seen = new Set();
  const result = [];
  for (const value of Array.isArray(values) ? values : []) {
    const image = reusableImage(value, role);
    if (!image || seen.has(image.url)) continue;
    seen.add(image.url);
    result.push(image);
    if (result.length >= limit) break;
  }
  return result;
}

function ecommerceImages(item) {
  return Array.isArray(item?.images) ? item.images.filter(imageUrl) : [];
}

function ecommerceSources(item) {
  const images = ecommerceImages(item);
  const configuredProducts = uniqueImages(item?.remix?.productImages, 'product', 5);
  const configuredReferences = uniqueImages(item?.remix?.referenceImages, 'reference', 3);
  const productImages = configuredProducts.length
    ? configuredProducts
    : uniqueImages(images.filter(image => PRODUCT_SOURCE_PATTERN.test(`${image?.label || ''} ${image?.description || ''} ${image?.sourceFile || ''}`)), 'product', 1);
  const productUrls = new Set(productImages.map(image => image.url));
  const referenceImages = configuredReferences.length
    ? configuredReferences
    : uniqueImages(images.filter(image => !productUrls.has(imageUrl(image)) && !PRODUCT_SOURCE_PATTERN.test(`${image?.label || ''} ${image?.sourceFile || ''}`)), 'reference', 3);
  return { productImages, referenceImages };
}

export function buildGalleryRemixCheckpoint(item = {}) {
  const id = cleanText(item.id) || `gallery-${Date.now()}`;
  const title = cleanText(item.title) || '案例同款';
  if (item.type === 'visual' || item.workType === 'visual' || item.visualSkillId) {
    const replay = item.replay || {};
    const images = uniqueImages(item.images || item.imageRecords, 'reference', 6);
    return {
      project: { id: `gallery:${id}`, kind: 'visual', title },
      version: {
        id: `gallery:${id}:remix`,
        inputSnapshot: {
          skillId: cleanText(item.visualSkillId || replay.skillId) || 'free',
          skillControl: cleanText(replay.skillControl),
          panelValues: replay.panelValues && typeof replay.panelValues === 'object' ? { ...replay.panelValues } : {},
          text: cleanText(replay.originalPrompt || replay.prompt || item.prompt) || title,
          prompt: cleanText(replay.prompt || item.prompt) || title,
          imageModel: cleanText(replay.imageModel || item.imageModel) || 'image2',
          ratio: cleanText(replay.ratio || item.ratio) || '1:1',
          resolution: cleanText(replay.resolution || item.resolution) || '2K',
          referenceAssets: Array.isArray(item.referenceAssets) ? item.referenceAssets : (Array.isArray(replay.referenceAssets) ? replay.referenceAssets : []),
          referenceImages: images.map(image => image.url),
        },
      },
    };
  }
  if (item.type === 'ecommerce') {
    const sources = ecommerceSources(item);
    return {
      project: { id: `gallery:${id}`, kind: 'ecommerce', title },
      version: {
        id: `gallery:${id}:remix`,
        inputSnapshot: {
          description: cleanText(item?.remix?.prompt) || cleanText(item.hint) || title,
          platform: cleanText(item?.remix?.platform) || 'taobao',
          productImages: sources.productImages,
          referenceImages: sources.referenceImages,
        },
      },
    };
  }

  const referenceImages = uniqueImages(
    item?.remix?.referenceImages?.length
      ? item.remix.referenceImages
      : [item.cover_url, ...(Array.isArray(item.image_urls) ? item.image_urls : [])],
    'reference',
    3,
  ).map(image => image.url);
  return {
    project: { id: `gallery:${id}`, kind: 'xiaohongshu', title },
    version: {
      id: `gallery:${id}:remix`,
      inputSnapshot: {
        text: cleanText(item?.remix?.prompt) || cleanText(item._inputText) || cleanText(item.hint) || title,
        referenceImages,
      },
    },
  };
}
