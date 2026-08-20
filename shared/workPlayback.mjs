function clean(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function stableVideoUrl(value) {
  const url = clean(value);
  const path = (() => {
    if (url.startsWith('/')) return url.split(/[?#]/, 1)[0];
    try { return new URL(url).pathname; } catch { return ''; }
  })();
  const match = /^\/api\/video\/(?:assets|media)\/([^/?#]+)$/i.exec(path);
  return match ? `/api/video/assets/${match[1]}` : '';
}

function stripValue(value) {
  if (Array.isArray(value)) return value.map(stripValue);
  if (!value || typeof value !== 'object') return value;
  const next = Object.fromEntries(Object.entries(value).map(([key, child]) => [key, stripValue(child)]));
  const stableUrl = stableVideoUrl(next.stableUrl || next.stable_url)
    || stableVideoUrl(next.url || next.playbackUrl || next.playback_url);
  if (!stableUrl) return next;
  next.stableUrl = stableUrl;
  next.url = stableUrl;
  delete next.playbackUrl;
  delete next.playback_url;
  return next;
}

export function stripTransientWorkPlayback(work = {}) {
  if (!work || typeof work !== 'object' || Array.isArray(work)) return work;
  const next = stripValue(work);
  for (const key of ['video_url', 'audio_url']) {
    const nestedKey = key === 'video_url' ? 'video' : 'audio';
    const stableUrl = stableVideoUrl(next[key]) || stableVideoUrl(next[nestedKey]?.stableUrl);
    if (stableUrl) next[key] = stableUrl;
  }
  return next;
}
