import { mergeWorkCollections } from '../../utils/workRecords.js';
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

function normalizePanelWork(work = {}) {
  const images = normalizeWorkImages(work.images);
  if (!images.length) return null;
  return {
    ...work,
    id: work.id || work.taskId || work._saveKey || images[0]?.url || Date.now(),
    name: displayName(work),
    product_name: cleanString(work.product_name) || displayName(work),
    platform: cleanString(work.platform) || '淘宝',
    images,
    createdAt: work.createdAt || work.at || '',
    _ecResult: true,
  };
}

export function normalizeCanvasWorkPanel({ localWorks = [], serverWorks = [], ownerEmail = '' } = {}) {
  const owner = normalizedOwner(ownerEmail);
  const ownedLocalWorks = owner
    ? (Array.isArray(localWorks) ? localWorks : []).filter(work => normalizedOwner(work?._phone) === owner)
    : [];
  return mergeWorkCollections(serverWorks, ownedLocalWorks)
    .filter(work => work?._ecResult)
    .map(normalizePanelWork)
    .filter(Boolean);
}

export function buildCanvasImportResult(work = {}, { importId } = {}) {
  const images = Object.fromEntries(normalizeWorkImages(work.images).map((image, index) => [
    image.key || image.label || `image_${index + 1}`,
    image.url,
  ]));
  return {
    ...work,
    images,
    productAssets: normalizeWorkImages(work.productAssets || work.product_assets || work.productImages || work.source_images || work.sourceImages),
    product_name: displayName(work),
    _ecResult: true,
    platform: cleanString(work.platform) || '淘宝',
    _saveKey: work._saveKey || '',
    canvasImportId: importId || globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`,
  };
}
