function clean(value, max = 256) {
  return String(value ?? '').trim().slice(0, max);
}

export function normalizeClientProjectAssetRef(value = {}) {
  return {
    projectId: clean(value.projectId),
    projectAssetId: clean(value.projectAssetId),
    role: clean(value.role, 80),
    contentHash: clean(value.contentHash),
    mimeType: clean(value.mimeType, 160),
    stableUrl: clean(value.stableUrl, 2000),
    mediaKind: clean(value.mediaKind, 32),
  };
}

export function projectAssetReferenceKey(value = {}) {
  const ref = normalizeClientProjectAssetRef(value);
  return `${ref.projectId}:${ref.projectAssetId}:${ref.contentHash}`;
}
