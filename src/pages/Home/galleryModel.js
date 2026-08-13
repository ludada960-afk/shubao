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
  return items.filter(item => {
    const key = galleryIdentity(item);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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

function tryOnGalleryItem(entry) {
  const assets = entry.assets.map(normalizedAsset).filter(Boolean);
  const output = assets.find(asset => asset.role === 'result') || assets.at(-1);
  const prompt = clean(output?.prompt) || assets.map(asset => clean(asset.prompt)).find(Boolean) || '保留商品与人物特征，生成自然可信的上身结果。';
  return {
    id: `production-${entry.id}`, type: 'ecommerce', intent: 'anything_tryon', title: '商品与模特精准上身',
    prompt, body_text: prompt, cover_url: output?.url || '', image_urls: assets.map(asset => asset.url), images: assets, assets,
    ratio: '4:3', requestKey: output?.requestKey || '', imageModel: 'image2', resolution: '2K',
    remix: { prompt, platform: 'smart', intent: 'anything_tryon' },
  };
}

export function productionGalleryItems(catalog = []) {
  const result = [];
  for (const entry of catalog.filter(item => item.status === 'production')) {
    if (entry.id === 'tryon-reference' || entry.assets?.some(asset => asset.intent === 'anything_tryon')) {
      result.push(tryOnGalleryItem(entry));
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
