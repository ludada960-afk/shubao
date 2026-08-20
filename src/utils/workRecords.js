import { normalizeWorkImages } from './workImages.js';
export { stripTransientWorkPlayback } from '../../shared/workPlayback.mjs';

const PERSISTENT_GENERATED_IMAGE = /^\/api\/generated-assets\/[a-f0-9]{64}\.(?:jpg|png|webp)(?:\?.*)?$/i;
const UNSAFE_ECOMMERCE_IMAGE = /^(?:blob:|data:)|(?:^|\/)(?:temp_uploads?|uploads?|ec-temp-img)(?:\/|$)/i;
const GENERATION_STATUSES = new Set(['generating', 'completed', 'needs_review']);
const WORK_TYPE_ALIASES = Object.freeze({
  ec: 'ecommerce',
  commerce: 'ecommerce',
  ecommerce: 'ecommerce',
  content: 'xhs',
  plog: 'xhs',
  xhs: 'xhs',
  xiaohongshu: 'xhs',
  video: 'video',
  ai_video: 'video',
  aivideo: 'video',
  visual: 'visual',
  creation: 'visual',
  visual_creation: 'visual',
});

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizedOwner(value) {
  return cleanString(value).toLowerCase();
}

export function inferWorkType(work = {}) {
  const explicit = cleanString(work.workType || work.contentType || work.generationType).toLowerCase();
  if (explicit) return WORK_TYPE_ALIASES[explicit] || explicit;
  if (work._videoResult || work.video_url || work.video?.url) return 'video';
  return work._ecResult ? 'ecommerce' : 'xhs';
}

export function withWorkType(work = {}) {
  return { ...work, workType: inferWorkType(work) };
}

export function filterWorksForOwner(works, ownerEmail) {
  const owner = normalizedOwner(ownerEmail);
  if (!owner) return [];
  return (Array.isArray(works) ? works : []).filter(work => (
    normalizedOwner(work?._phone) === owner
  ));
}

export function replaceCachedWorksForOwner(cachedWorks, ownerEmail, ownerWorks, limit = 50) {
  const owner = normalizedOwner(ownerEmail);
  const cached = Array.isArray(cachedWorks) ? cachedWorks : [];
  if (!owner) return [...cached];
  const owned = filterWorksForOwner(ownerWorks, owner).slice(0, Math.max(0, limit));
  const otherOwners = cached.filter(work => normalizedOwner(work?._phone) !== owner);
  return [...owned, ...otherOwners];
}

export function isPersistentEcommerceImageUrl(value) {
  const url = cleanString(value);
  if (!url || UNSAFE_ECOMMERCE_IMAGE.test(url)) return false;
  if (PERSISTENT_GENERATED_IMAGE.test(url)) return true;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

export function normalizeEcommerceWork(work) {
  if (!work || typeof work !== 'object' || Array.isArray(work)) return null;
  const images = normalizeWorkImages(work.images)
    .filter(image => isPersistentEcommerceImageUrl(image.url));
  const generationStatus = GENERATION_STATUSES.has(cleanString(work.generationStatus))
    ? cleanString(work.generationStatus)
    : 'completed';
  if (!images.length && generationStatus === 'completed') return null;
  return { ...work, images, generationStatus };
}

function workIdentity(work) {
  const identities = [];
  const saveKey = cleanString(work?._saveKey);
  if (saveKey) identities.push(`save:${saveKey}`);
  const taskId = cleanString(work?.taskId);
  if (taskId) identities.push(`task:${taskId}`);
  return identities;
}

function ecommerceImageIdentities(work) {
  if (!work?._ecResult) return [];
  return normalizeWorkImages(work.images)
    .map(image => cleanString(image.url))
    .filter(Boolean)
    .sort()
    .map(url => `image:${url}`);
}

function ecommerceImageIdentity(work) {
  const identities = ecommerceImageIdentities(work);
  return identities.length ? identities.join('|') : '';
}

function normalizeWork(work) {
  if (!work || typeof work !== 'object' || Array.isArray(work)) return null;
  return work._ecResult ? normalizeEcommerceWork(work) : work;
}

export function stableWorkKey(work, fallback = '') {
  return cleanString(work?._saveKey)
    || cleanString(work?.taskId)
    || ecommerceImageIdentity(work)
    || cleanString(work?.id)
    || fallback;
}

// Server records are authoritative. The local cache only supplies a fallback
// while offline or for a record that has not reached the server yet.
export function mergeWorkCollections(serverWorks, localWorks = []) {
  const result = [];
  const seen = new Set();
  const add = candidate => {
    const work = normalizeWork(candidate);
    if (!work) return;
    const identities = [...workIdentity(work), ...ecommerceImageIdentities(work)];
    if (identities.some(identity => seen.has(identity))) return;
    identities.forEach(identity => seen.add(identity));
    result.push(work);
  };
  (Array.isArray(serverWorks) ? serverWorks : []).forEach(add);
  (Array.isArray(localWorks) ? localWorks : []).forEach(add);
  return result;
}
