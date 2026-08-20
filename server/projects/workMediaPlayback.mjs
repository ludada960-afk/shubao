function clean(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function mediaAssetId(stableUrl) {
  const match = /^\/api\/video\/(?:assets|media)\/([^/?#]+)$/i.exec(clean(stableUrl));
  if (!match) return '';
  try { return decodeURIComponent(match[1]); } catch { return ''; }
}

function decorateValue(value, resolvePlayback, ownerEmail) {
  if (Array.isArray(value)) return value.map(item => decorateValue(item, resolvePlayback, ownerEmail));
  if (!value || typeof value !== 'object') return value;

  const next = Object.fromEntries(Object.entries(value)
    .map(([key, child]) => [key, decorateValue(child, resolvePlayback, ownerEmail)]));
  const declaredStableUrl = clean(next.stableUrl || next.stable_url);
  const stableUrl = declaredStableUrl || (mediaAssetId(next.url) ? clean(next.url) : '');
  const assetId = mediaAssetId(stableUrl);
  if (!assetId) return next;

  let playbackUrl = '';
  try {
    playbackUrl = clean(resolvePlayback({ asset: { ...next, assetId, stableUrl }, ownerEmail }));
  } catch { /* A stale or deleted video asset should remain readable as metadata. */ }
  if (!playbackUrl) return next;
  return {
    ...next,
    stableUrl: declaredStableUrl || stableUrl,
    playbackUrl,
    url: playbackUrl,
  };
}

export function decorateOwnedWorkPlayback(work, { ownerEmail = '', resolveAssetPlaybackUrl } = {}) {
  if (!work || typeof work !== 'object' || typeof resolveAssetPlaybackUrl !== 'function') return work;
  const decorated = decorateValue(work, resolveAssetPlaybackUrl, ownerEmail);
  const decorateTopLevelMedia = (key, urlKey) => {
    const stableUrl = clean(work[urlKey] || work[key]?.stableUrl || work[key]?.url);
    const assetId = mediaAssetId(stableUrl);
    if (!assetId) return;
    let playbackUrl = '';
    try {
      playbackUrl = clean(resolveAssetPlaybackUrl({
        asset: { ...(work[key] || {}), assetId, stableUrl },
        ownerEmail,
      }));
    } catch { /* Keep the work metadata visible when playback reminting fails. */ }
    if (!playbackUrl) return;
    decorated[urlKey] = playbackUrl;
    decorated[key] = {
      ...(decorated[key] || {}),
      stableUrl: decorated[key]?.stableUrl || stableUrl,
      playbackUrl,
      url: playbackUrl,
    };
  };
  decorateTopLevelMedia('video', 'video_url');
  decorateTopLevelMedia('audio', 'audio_url');
  return decorated;
}
