const MEDIA_KIND_BY_PREFIX = Object.freeze([
  ['image/', 'image'],
  ['video/', 'video'],
  ['audio/', 'audio'],
]);

const MAX_ID_LENGTH = 256;
const MAX_ROLE_LENGTH = 80;
const MAX_HASH_LENGTH = 256;

function safeMetadataText(value, maxLength = 320) {
  const normalized = String(value ?? '').trim();
  return normalized && normalized.length <= maxLength && !/\p{Cc}/u.test(normalized)
    ? normalized : '';
}

function publicProjectAssetMetadata(value) {
  const metadata = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const result = {};
  const displayName = safeMetadataText(metadata.displayName)
    || safeMetadataText(metadata.label)
    || safeMetadataText(metadata.name);
  if (displayName) result.displayName = displayName;
  for (const key of ['role', 'group', 'ratio', 'size', 'aspectRatio']) {
    const text = safeMetadataText(metadata[key], 120);
    if (text) result[key] = text;
  }
  for (const key of ['width', 'height', 'durationMs']) {
    if (Number.isSafeInteger(metadata[key]) && metadata[key] > 0) result[key] = metadata[key];
  }
  if (metadata.aigc && typeof metadata.aigc === 'object' && !Array.isArray(metadata.aigc)) {
    const aigc = {};
    if (metadata.aigc.generated === true) aigc.generated = true;
    const version = safeMetadataText(metadata.aigc.provenanceVersion, 64);
    if (version) aigc.provenanceVersion = version;
    if (Object.keys(aigc).length) result.aigc = aigc;
  }
  if (metadata.provenance && typeof metadata.provenance === 'object' && !Array.isArray(metadata.provenance)) {
    const provenance = {};
    for (const key of ['route', 'planItemId', 'generatedAt']) {
      const text = safeMetadataText(metadata.provenance[key]);
      if (text) provenance[key] = text;
    }
    if (Array.isArray(metadata.provenance.sourceAssetIds)) {
      const sourceAssetIds = [...new Set(metadata.provenance.sourceAssetIds
        .map(item => safeMetadataText(item, 256))
        .filter(Boolean))].slice(0, 64);
      if (sourceAssetIds.length) provenance.sourceAssetIds = sourceAssetIds;
    }
    if (Object.keys(provenance).length) result.provenance = provenance;
  }
  return result;
}

function cleanRequired(value, name, maxLength) {
  const normalized = String(value ?? '').trim();
  if (!normalized) throw new TypeError(`${name} is required`);
  if (normalized.length > maxLength) throw new TypeError(`${name} is too long`);
  if (/\p{Cc}/u.test(normalized)) throw new TypeError(`${name} contains control characters`);
  return normalized;
}

export function mediaKindFromMime(value) {
  const mimeType = String(value || '').trim().toLowerCase();
  return MEDIA_KIND_BY_PREFIX.find(([prefix]) => mimeType.startsWith(prefix))?.[1] || 'document';
}

export function normalizeProjectAssetRef(value = {}) {
  return {
    projectId: cleanRequired(value.projectId, 'projectId', MAX_ID_LENGTH),
    projectAssetId: cleanRequired(value.projectAssetId, 'projectAssetId', MAX_ID_LENGTH),
    role: cleanRequired(value.role, 'role', MAX_ROLE_LENGTH),
    expectedContentHash: cleanRequired(value.expectedContentHash, 'expectedContentHash', MAX_HASH_LENGTH),
  };
}

export function assertCanonicalProjectAssetRef(ref, asset = {}) {
  const normalized = normalizeProjectAssetRef(ref);
  const assetProjectId = cleanRequired(asset.project_id ?? asset.projectId, 'asset.projectId', MAX_ID_LENGTH);
  const assetId = cleanRequired(asset.id ?? asset.projectAssetId, 'asset.projectAssetId', MAX_ID_LENGTH);
  const contentHash = cleanRequired(asset.content_hash ?? asset.contentHash, 'asset.contentHash', MAX_HASH_LENGTH);
  if (normalized.projectId !== assetProjectId || normalized.projectAssetId !== assetId) {
    throw new TypeError('project asset reference does not belong to the requested project');
  }
  if (normalized.expectedContentHash !== contentHash) {
    throw new TypeError('project asset content hash does not match');
  }
  const metadata = publicProjectAssetMetadata(asset.metadata);
  return {
    ...normalized,
    mediaKind: mediaKindFromMime(asset.mime_type ?? asset.mimeType),
    stableUrl: String(asset.stable_url ?? asset.stableUrl ?? '').trim(),
    ...(Object.keys(metadata).length ? { metadata } : {}),
  };
}

// 4c183cd4 续命 主线程加 stub (救 P-A 子代理)
export function stableAssetIdFromUrl(url) { return String(url || "").replace(/[^a-zA-Z0-9]/g, "_").slice(0, 64) || "asset-" + Date.now(); }
