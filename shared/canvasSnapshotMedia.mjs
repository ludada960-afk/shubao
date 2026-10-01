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
  /* 2026-10-01 性能：`localPreviewUrl` 漏在这个集合外面 ⇒ 快照里留着一整份 base64。
     它按定义就是"本地预览"——上传还没归档之前的临时地址，和 `url` 是同一个性质
     （同一个字符串在 index.jsx 里被同时赋给 url 与 localPreviewUrl）。
     不在集合里 ⇒ upload 刚传完那几秒，快照体积是好几 MB；
     而消费方 restore 之后拿到的 durable `url` 才是真图，预览留着纯属白占体积。 */
  'localPreviewUrl',
  'previewUrl',
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

  /* ⚠️ 2026-10-01 修：判"这张图是不是真的没了"时，**光看 assetRef 不够**。
     `localPreviewUrl` 进了 MEDIA_URL_KEYS 之后，会出现这种节点：
       url = '/api/generated-assets/x.jpg'   ← 已经归档好的真图
       localPreviewUrl = 'data:…'            ← 顺手一起被清掉的本地预览
     它明明有能用的图，原判据却只看 `!stableUrl` ⇒ 把它错标成 unavailable，
     界面上冒出「媒体尚未归档到项目素材库」。所以这里必须看**还剩不剩可用的媒体地址**。 */
  const hasUsableMediaUrl = Object.keys(next)
    .some(key => MEDIA_URL_KEYS.has(key) && !isTransientMediaUrl(next[key]));

  if (removedTransientMedia && MEDIA_KINDS.has(String(next.kind || '').trim().toLowerCase())
    && !stableUrl && !hasUsableMediaUrl) {
    next.status = 'unavailable';
    next.mediaPlaybackStatus = 'unavailable';
    next.mediaPlaybackError = '媒体尚未归档到项目素材库，请稍后重试归档';
  }
  return next;
}

export function sanitizeCanvasSnapshotMedia(value = {}) {
  return scrub(value);
}
