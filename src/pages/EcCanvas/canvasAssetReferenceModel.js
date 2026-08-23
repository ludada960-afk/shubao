const MEDIA_KINDS = new Set(['image', 'video', 'audio', 'document']);

function clean(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function integerOrNull(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function safeMetadataText(value, max = 320) {
  const normalized = clean(value);
  return normalized && normalized.length <= max && !/[\u0000-\u001F\u007F]/.test(normalized)
    ? normalized : '';
}

export function normalizeCanvasAssetMetadata(value = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const metadata = {};
  const displayName = safeMetadataText(value.displayName)
    || safeMetadataText(value.label)
    || safeMetadataText(value.name);
  if (displayName) metadata.displayName = displayName;
  for (const key of ['role', 'group', 'ratio', 'size', 'aspectRatio']) {
    const text = safeMetadataText(value[key], 120);
    if (text) metadata[key] = text;
  }
  for (const key of ['width', 'height', 'durationMs']) {
    if (Number.isSafeInteger(value[key]) && value[key] > 0) metadata[key] = value[key];
  }
  if (value.aigc && typeof value.aigc === 'object' && !Array.isArray(value.aigc)) {
    const aigc = {};
    if (value.aigc.generated === true) aigc.generated = true;
    const version = safeMetadataText(value.aigc.provenanceVersion, 64);
    if (version) aigc.provenanceVersion = version;
    if (Object.keys(aigc).length) metadata.aigc = aigc;
  }
  if (value.provenance && typeof value.provenance === 'object' && !Array.isArray(value.provenance)) {
    const provenance = {};
    for (const key of ['route', 'planItemId', 'generatedAt']) {
      const text = safeMetadataText(value.provenance[key]);
      if (text) provenance[key] = text;
    }
    if (Array.isArray(value.provenance.sourceAssetIds)) {
      const sourceAssetIds = [...new Set(value.provenance.sourceAssetIds
        .map(item => safeMetadataText(item, 256))
        .filter(Boolean))].slice(0, 64);
      if (sourceAssetIds.length) provenance.sourceAssetIds = sourceAssetIds;
    }
    if (Object.keys(provenance).length) metadata.provenance = provenance;
  }
  return metadata;
}

function mediaKindFor(value = {}) {
  const mimeType = clean(value.mimeType || value.mime_type).toLowerCase();
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  const explicit = clean(value.mediaKind || value.media_kind).toLowerCase();
  if (MEDIA_KINDS.has(explicit)) return explicit;
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

export function buildCanvasAssetRef(value = {}, options = {}) {
  const ref = normalizeCanvasProjectAssetRef({
    ...value,
    projectId: value?.projectId || value?.project_id || options.projectId,
    role: value?.role || options.role,
  });
  if (!ref || !['image', 'video', 'audio'].includes(ref.mediaKind)) return null;
  return ref;
}

export function canvasProjectAssetRefKey(value = {}) {
  const ref = normalizeCanvasProjectAssetRef(value);
  return ref ? `${ref.projectId}:${ref.projectAssetId}:${ref.contentHash}` : '';
}

export function attachCanvasProjectAssetRef(target = {}, asset = {}, options = {}) {
  const ref = normalizeCanvasProjectAssetRef(asset, options);
  if (!ref) return { ...target };
  const metadata = {
    ...normalizeCanvasAssetMetadata(target.metadata),
    ...normalizeCanvasAssetMetadata(asset.metadata),
  };
  return {
    ...target,
    projectId: target.projectId || ref.projectId,
    projectAssetId: ref.projectAssetId,
    assetId: target.assetId || ref.assetId,
    url: target.url || ref.stableUrl,
    assetRef: ref,
    ...(Object.keys(metadata).length ? { metadata } : {}),
  };
}

export function collectCanvasProjectAssetRefs({ work = {}, nodes = [] } = {}) {
  const candidates = [
    ...(Array.isArray(work.projectAssetRefs) ? work.projectAssetRefs : []),
    ...(Array.isArray(work.mediaAssets) ? work.mediaAssets : []),
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
