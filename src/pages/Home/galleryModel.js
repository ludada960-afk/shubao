import { productionPromptFor } from './productionCasePrompts.js';

const clean = value => typeof value === 'string' ? value.trim() : '';
const assetUrl = value => clean(typeof value === 'string' ? value : (value?.url || value?.src || value?.image_url));

function normalizedAsset(value = {}) {
  const url = assetUrl(value);
  return url ? { ...value, url, src: value.src || url } : null;
}

function canonicalUrl(value) {
  const url = assetUrl(value);
  if (!url) return '';
  try {
    const parsed = new URL(url, 'https://gallery.local');
    for (const key of ['variant', 'format', 'retry']) parsed.searchParams.delete(key);
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return url.split('#')[0];
  }
}

export function galleryIdentity(item = {}) {
  const intent = clean(item.intent || item.visualSkillId || item.skillId || item.type);
  const requestKey = clean(item.requestKey || item.replay?.requestKey);
  if (requestKey) return `${intent}:${requestKey}`;
  const cover = canonicalUrl(item.cover_url || item.coverUrl || item.images?.[0]);
  return cover ? `${intent}:${cover}` : `${intent}:${clean(item.id || item.title)}`;
}

export function dedupeGalleryItems(items = []) {
  const seen = new Set();
  const seenCovers = new Set();
  return items.filter(item => {
    const key = galleryIdentity(item);
    const cover = canonicalUrl(item.cover_url || item.coverUrl || item.images?.[0]);
    if (!key || seen.has(key) || (cover && seenCovers.has(cover))) return false;
    seen.add(key);
    if (cover) seenCovers.add(cover);
    return true;
  });
}

function ratioHeight(item = {}) {
  const ratio = clean(item.ratio || item.images?.[0]?.ratio || '3:4');
  const [width, height] = ratio.split(':').map(Number);
  return width > 0 && height > 0 ? height / width : 4 / 3;
}

export function stableGalleryColumns(items = [], columnCount = 4) {
  const count = Math.max(1, Math.floor(Number(columnCount) || 1));
  const columns = Array.from({ length: count }, () => []);
  const heights = Array.from({ length: count }, () => 0);
  items.forEach((item, index) => {
    const columnIndex = heights.indexOf(Math.min(...heights));
    columns[columnIndex].push({ item, index });
    heights[columnIndex] += ratioHeight(item) + 0.06;
  });
  return columns;
}

export function stableGalleryItems(groups = []) {
  const arrays = groups.filter(Array.isArray);
  const result = [];
  const max = Math.max(0, ...arrays.map(items => items.length));
  for (let index = 0; index < max; index += 1) {
    for (const items of arrays) if (items[index]) result.push(items[index]);
  }
  return dedupeGalleryItems(result);
}

export function appendGalleryItemsWithoutReordering(current = [], incoming = []) {
  const nextByIdentity = new Map(incoming.map(item => [galleryIdentity(item), item]));
  const preserved = current.map(item => nextByIdentity.get(galleryIdentity(item)) || item);
  return dedupeGalleryItems([...preserved, ...incoming]);
}

export function tryOnWorkflowCards(item = {}) {
  const assets = (item.assets || item.images || []).filter(asset => assetUrl(asset));
  const product = assets.find(asset => asset.role === 'source') || assets[0];
  const model = assets.find(asset => asset.role === 'reference');
  const result = assets.find(asset => asset.role === 'result') || assets.at(-1);
  return [product, model, result].filter((asset, index, cards) => {
    if (!asset) return false;
    const identity = clean(asset.id) || canonicalUrl(asset);
    return cards.findIndex(candidate => (clean(candidate?.id) || canonicalUrl(candidate)) === identity) === index;
  });
}

function tryOnGalleryItem(entry) {
  const assets = entry.assets.map(normalizedAsset).filter(Boolean);
  const output = assets.find(asset => asset.role === 'result') || assets.at(-1);
  const prompt = clean(output?.prompt) || assets.map(asset => clean(asset.prompt)).find(Boolean) || '保留商品与人物特征，生成自然可信的上身结果。';
  const title = entry.id === 'tryon-angles'
    ? '一套穿搭，多角度街拍成片'
    : '商品与参考模特精准上身';
  return {
    id: `production-${entry.id}`, type: 'ecommerce', intent: 'anything_tryon', title,
    prompt, body_text: prompt, cover_url: output?.url || '', image_urls: assets.map(asset => asset.url), images: assets, assets,
    ratio: '4:3', requestKey: output?.requestKey || '', imageModel: entry.status === 'production' ? 'image2' : 'showcase', resolution: '2K',
    remix: { prompt, platform: 'smart', intent: 'anything_tryon' },
  };
}

function productSuiteGalleryItem(entry) {
  const assets = entry.assets.map(normalizedAsset).filter(Boolean);
  const output = assets.find(asset => asset.displayRole === 'finalComposite')
    || assets.find(asset => asset.role === 'result')
    || assets.at(-1);
  const prompt = clean(output?.prompt) || '保留完整商品结构，生成一套统一主图与详情视觉。';
  return {
    id: `showcase-${entry.id}`, type: 'ecommerce', intent: 'product_suite', title: '珍珠白降噪耳机商品套图',
    prompt, body_text: prompt, cover_url: output?.url || '', image_urls: assets.map(asset => asset.url), images: assets, assets,
    ratio: output?.ratio || '1:1', requestKey: '', imageModel: 'showcase', resolution: '2K',
    remix: { prompt, platform: 'taobao', intent: 'product_suite', referenceAssets: assets.filter(asset => asset.role === 'source') },
  };
}

export function productionGalleryItems(catalog = []) {
  const result = [];
  for (const entry of catalog.filter(item => ['production', 'curated-showcase'].includes(item.status))) {
    if (entry.id === 'tryon-reference' || entry.assets?.some(asset => asset.intent === 'anything_tryon')) {
      result.push(tryOnGalleryItem(entry));
      continue;
    }
    if (entry.id === 'product-suite') {
      result.push(productSuiteGalleryItem(entry));
      continue;
    }
    for (const [index, asset] of (entry.assets || []).entries()) {
      const prompt = clean(asset.prompt) || productionPromptFor(asset.id);
      result.push({
        id: `production-${entry.id}-${asset.id || index}`, type: 'visual', workType: 'visual', visualSkillId: asset.intent,
        title: asset.label, prompt, body_text: prompt, cover_url: asset.src, image_urls: [asset.src], images: [{ ...asset, url: asset.src }],
        ratio: asset.ratio, requestKey: asset.requestKey, imageModel: 'image2', resolution: '2K',
        replay: { skillId: asset.intent, prompt, originalPrompt: prompt, imageModel: 'image2', ratio: asset.ratio, resolution: '2K', requestKey: asset.requestKey, referenceAssets: [], referenceImages: [], panelValues: {} },
      });
    }
  }
  return dedupeGalleryItems(result);
}
