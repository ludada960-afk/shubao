import { inferWorkType, mergeWorkCollections } from '../../utils/workRecords.js';
import { normalizeWorkImages } from '../../utils/workImages.js';

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizedOwner(value) {
  return cleanString(value).toLowerCase();
}

function displayName(work = {}) {
  return cleanString(work.product_name || work.name || work.title) || '历史作品';
}

function allWorkImages(work = {}) {
  const candidates = [
    ...normalizeWorkImages(work.images),
    ...normalizeWorkImages(work.cover_url ? [work.cover_url] : []),
    ...normalizeWorkImages(work.image_urls),
    ...normalizeWorkImages((Array.isArray(work.pages) ? work.pages : []).map(page => page?.image_url || page?.url || page)),
  ];
  const seen = new Set();
  return candidates.filter(image => {
    if (!image?.url || seen.has(image.url)) return false;
    seen.add(image.url);
    return true;
  });
}

export function canvasWorkCategory(work = {}) {
  return inferWorkType(work);
}

export function filterCanvasWorks(works = [], category = 'all') {
  const list = Array.isArray(works) ? works : [];
  return category === 'all' ? list : list.filter(work => canvasWorkCategory(work) === category);
}

function normalizePanelWork(work = {}) {
  const images = allWorkImages(work);
  if (!images.length) return null;
  const workType = canvasWorkCategory(work);
  return {
    ...work,
    id: work.id || work.taskId || work._saveKey || images[0]?.url || Date.now(),
    name: displayName(work),
    product_name: cleanString(work.product_name) || displayName(work),
    platform: cleanString(work.platform) || '淘宝',
    images,
    createdAt: work.createdAt || work.at || '',
    workType,
  };
}

export function normalizeCanvasWorkPanel({ localWorks = [], serverWorks = [], ownerEmail = '' } = {}) {
  const owner = normalizedOwner(ownerEmail);
  const ownedLocalWorks = owner
    ? (Array.isArray(localWorks) ? localWorks : []).filter(work => normalizedOwner(work?._phone) === owner)
    : [];
  return mergeWorkCollections(serverWorks, ownedLocalWorks)
    .map(normalizePanelWork)
    .filter(Boolean);
}

export function buildCanvasImportResult(work = {}, { importId } = {}) {
  const imageRecords = allWorkImages(work);
  const images = Object.fromEntries(imageRecords.map((image, index) => [
    image.key || image.label || `image_${index + 1}`,
    image.url,
  ]));
  return {
    ...work,
    images,
    imageRecords,
    productAssets: normalizeWorkImages(work.productAssets || work.product_assets || work.productImages || work.source_images || work.sourceImages),
    product_name: displayName(work),
    _ecResult: true,
    workType: canvasWorkCategory(work),
    platform: cleanString(work.platform) || '淘宝',
    _saveKey: work._saveKey || '',
    canvasImportId: importId || globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`,
  };
}

export function canvasOutputImages(result = {}) {
  const imageRecords = normalizeWorkImages(result.imageRecords);
  return imageRecords.length ? imageRecords : normalizeWorkImages(result.images);
}

export function collectCanvasWorkImages({ baseImages = [], nodes = [] } = {}) {
  const images = normalizeWorkImages(baseImages);
  const seen = new Set(images.map(image => image.url));
  const outputKinds = new Set(['output', 'image-composer']);
  for (const node of Array.isArray(nodes) ? nodes : []) {
    const url = cleanString(node?.url);
    const complete = node?.status === 'ready' || node?.status === 'success';
    if (!url || !complete || !outputKinds.has(node?.kind) || seen.has(url)) continue;
    seen.add(url);
    images.push({
      key: cleanString(node.assetId || node.id) || `canvas_${images.length + 1}`,
      label: cleanString(node.displayLabel || node.name) || '画布创作',
      displayName: cleanString(node.displayLabel || node.name) || '画布创作',
      url,
      role: cleanString(node.role),
      group: cleanString(node.group) || '画布创作',
      ratio: cleanString(node.ratio),
      size: cleanString(node.size),
      source: 'canvas',
    });
  }
  return images;
}

export function canvasWorkOutputFingerprint(nodes = []) {
  const outputKinds = new Set(['output', 'image-composer']);
  return (Array.isArray(nodes) ? nodes : [])
    .filter(node => outputKinds.has(node?.kind) && ['ready', 'success'].includes(node?.status))
    .map(node => cleanString(node?.url))
    .filter(Boolean)
    .sort()
    .join('\n');
}
