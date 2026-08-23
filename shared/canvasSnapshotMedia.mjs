const TRANSIENT_MEDIA_KEYS = new Set([
  'file',
  'blob',
  'rawFile',
  'rawData',
  'base64',
  'dataUrl',
]);

const MEDIA_URL_KEYS = new Set([
  'url',
  'src',
  'playbackUrl',
  'playback_url',
  'videoUrl',
  'video_url',
  'audioUrl',
  'audio_url',
  'imageUrl',
  'image_url',
]);

const MEDIA_KINDS = new Set(['image', 'video', 'audio']);

function isTransientMediaUrl(value) {
  return typeof value === 'string' && /^(?:data:|blob:|filesystem:)/i.test(value.trim());
}

function stableRefUrl(value) {
  const ref = value?.assetRef || value?.projectAssetRef;
  const stableUrl = typeof ref?.stableUrl === 'string' ? ref.stableUrl.trim() : '';
  return stableUrl && !isTransientMediaUrl(stableUrl) ? stableUrl : '';
}

function scrub(value) {
  if (Array.isArray(value)) return value.map(scrub);
  if (!value || typeof value !== 'object') return value;

  const next = Object.fromEntries(Object.entries(value).map(([key, child]) => [key, scrub(child)]));
  const stableUrl = stableRefUrl(next);
  let removedTransientMedia = false;

  for (const key of Object.keys(next)) {
    if (TRANSIENT_MEDIA_KEYS.has(key)) {
      delete next[key];
      removedTransientMedia = true;
      continue;
    }
    if (!MEDIA_URL_KEYS.has(key) || !isTransientMediaUrl(next[key])) continue;
    if (key === 'url' && stableUrl) next[key] = stableUrl;
    else delete next[key];
    removedTransientMedia = true;
  }

  if (removedTransientMedia && MEDIA_KINDS.has(String(next.kind || '').trim().toLowerCase()) && !stableUrl) {
    next.status = 'unavailable';
    next.mediaPlaybackStatus = 'unavailable';
    next.mediaPlaybackError = '媒体尚未归档到项目素材库，请稍后重试归档';
  }
  return next;
}

export function sanitizeCanvasSnapshotMedia(value = {}) {
  return scrub(value);
}
