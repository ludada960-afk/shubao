const TRANSIENT_KEYS = new Set(['file', 'blob', 'rawFile', 'rawData', 'base64', 'dataUrl']);
const MEDIA_URL_KEYS = new Set([
  'url', 'src', 'previewUrl', 'playbackUrl', 'playback_url',
  'cover_url', 'video_url', 'audio_url', 'image_url',
]);
const MEDIA_ARRAY_KEYS = new Set(['image_urls', 'images']);

function transientUrl(value) {
  return typeof value === 'string' && /^(?:data:|blob:|filesystem:)/i.test(value.trim());
}

function stableRefUrl(value) {
  const ref = value?.assetRef || value?.projectAssetRef;
  const url = typeof ref?.stableUrl === 'string' ? ref.stableUrl.trim() : '';
  return url && !transientUrl(url) ? url : '';
}

function sanitize(value, parentKey = '') {
  if (Array.isArray(value)) {
    return value
      .map(item => sanitize(item, parentKey))
      .filter(item => !(typeof item === 'string' && transientUrl(item)));
  }
  if (!value || typeof value !== 'object') return value;

  const next = {};
  const stableUrl = stableRefUrl(value);
  for (const [key, child] of Object.entries(value)) {
    if (TRANSIENT_KEYS.has(key)) continue;
    if (MEDIA_URL_KEYS.has(key) && transientUrl(child)) {
      if (key === 'url' && stableUrl) next[key] = stableUrl;
      continue;
    }
    if (MEDIA_ARRAY_KEYS.has(key) && Array.isArray(child)) {
      next[key] = sanitize(child, key);
      continue;
    }
    next[key] = sanitize(child, key);
  }
  return next;
}

export function sanitizeDurableWork(value = {}) {
  return sanitize(value);
}
