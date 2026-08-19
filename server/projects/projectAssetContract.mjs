const MEDIA_KIND_BY_PREFIX = Object.freeze([
  ['image/', 'image'],
  ['video/', 'video'],
  ['audio/', 'audio'],
]);

const MAX_ID_LENGTH = 256;
const MAX_ROLE_LENGTH = 80;
const MAX_HASH_LENGTH = 256;

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
  return {
    ...normalized,
    mediaKind: mediaKindFromMime(asset.mime_type ?? asset.mimeType),
    stableUrl: String(asset.stable_url ?? asset.stableUrl ?? '').trim(),
  };
}
