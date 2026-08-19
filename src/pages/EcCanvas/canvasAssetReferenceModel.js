const MEDIA_KINDS = new Set(['image', 'video', 'audio', 'document']);

function clean(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function integerOrNull(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function mediaKindFor(value = {}) {
  const explicit = clean(value.mediaKind || value.media_kind).toLowerCase();
  if (MEDIA_KINDS.has(explicit)) return explicit;
  const mimeType = clean(value.mimeType || value.mime_type).toLowerCase();
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  return 'document';
}

export function normalizeCanvasProjectAssetRef(value = {}, { projectId = '' } = {}) {
  const ref = value?.assetRef && typeof value.assetRef === 'object' ? value.assetRef : value;
  const resolvedProjectId = clean(ref?.projectId || ref?.project_id || projectId);
  const projectAssetId = clean(ref?.projectAssetId || ref?.project_asset_id);
  const stableUrl = clean(ref?.stableUrl || ref?.stable_url || ref?.url || ref?.src);
  const contentHash = clean(ref?.contentHash || ref?.content_hash);
  if (!resolvedProjectId || !projectAssetId || !stableUrl || !contentHash) return null;
  return {
    projectId: resolvedProjectId,
    projectAssetId,
    assetId: clean(ref?.assetId || ref?.asset_id || ref?.id),
    contentHash,
    stableUrl,
    mimeType: clean(ref?.mimeType || ref?.mime_type).toLowerCase(),
    mediaKind: mediaKindFor(ref),
    role: clean(ref?.role) || 'reference',
    width: integerOrNull(ref?.width),
    height: integerOrNull(ref?.height),
  };
}

export function canvasProjectAssetRefKey(value = {}) {
  const ref = normalizeCanvasProjectAssetRef(value);
  return ref ? `${ref.projectId}:${ref.projectAssetId}:${ref.contentHash}` : '';
}

export function attachCanvasProjectAssetRef(target = {}, asset = {}, options = {}) {
  const ref = normalizeCanvasProjectAssetRef(asset, options);
  if (!ref) return { ...target };
  return {
    ...target,
    projectId: target.projectId || ref.projectId,
    projectAssetId: ref.projectAssetId,
    assetId: target.assetId || ref.assetId,
    url: target.url || ref.stableUrl,
    assetRef: ref,
  };
}

export function collectCanvasProjectAssetRefs({ work = {}, nodes = [] } = {}) {
  const candidates = [
    ...(Array.isArray(work.projectAssetRefs) ? work.projectAssetRefs : []),
    ...(Array.isArray(work.imageRecords) ? work.imageRecords : []),
    ...(Array.isArray(work.images) ? work.images : []),
    ...(Array.isArray(work.productAssets) ? work.productAssets : []),
    ...(Array.isArray(work.product_assets) ? work.product_assets : []),
    ...(Array.isArray(nodes) ? nodes : []),
  ];
  const refs = [];
  const seen = new Set();
  candidates.forEach(candidate => {
    const ref = normalizeCanvasProjectAssetRef(candidate, { projectId: work.projectId });
    const key = canvasProjectAssetRefKey(ref || {});
    if (!key || seen.has(key)) return;
    seen.add(key);
    refs.push(ref);
  });
  return refs;
}
