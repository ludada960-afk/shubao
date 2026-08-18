import { stableAssetDataUrl } from './generatedAssets.mjs';
import { CONTENT_REFERENCE_LIMITS, normalizeReferenceGroups } from './contentReferenceRouter.mjs';

const ASSET_ID = /^[a-f0-9]{64}\.(?:jpg|png|webp)$/;

function uniqueAssetIds(referenceAssetIds, limit) {
  return [...new Set((Array.isArray(referenceAssetIds) ? referenceAssetIds : [])
    .map(value => String(value || '').trim())
    .filter(value => ASSET_ID.test(value)))]
    .slice(0, limit);
}

/**
 * Resolves only assets owned by the signed-in content creator. The legacy
 * image value is retained solely for older clients and free previews.
 */
export async function resolveContentReferenceImages({
  ownerEmail,
  referenceAssetIds,
  legacyImages,
  limit = 3,
  assetUploadService,
  generatedAssetStore,
} = {}) {
  if (!assetUploadService || typeof assetUploadService.getOwnedAsset !== 'function') {
    throw new TypeError('assetUploadService.getOwnedAsset is required');
  }
  if (!generatedAssetStore || typeof generatedAssetStore.read !== 'function') {
    throw new TypeError('generatedAssetStore.read is required');
  }
  const safeLimit = Number.isSafeInteger(limit) && limit > 0 ? limit : 3;
  const ids = uniqueAssetIds(referenceAssetIds, safeLimit);
  if (!ids.length) return Array.isArray(legacyImages) ? legacyImages.slice(0, safeLimit) : [];

  const images = [];
  for (const assetId of ids) {
    await assetUploadService.getOwnedAsset({ ownerEmail, assetId });
    const stored = await generatedAssetStore.read(assetId);
    if (!stored) throw new Error('参考素材已不可用，请重新上传');
    images.push(stableAssetDataUrl(stored));
  }
  return images;
}

/**
 * Resolve the two user-facing reference roles without allowing a style image
 * to silently become a subject-preserving image-to-image input.
 */
export async function resolveContentReferenceGroups({
  ownerEmail,
  referenceAssets,
  referenceAssetIds,
  legacyImages,
  assetUploadService,
  generatedAssetStore,
} = {}) {
  const normalized = normalizeReferenceGroups({ referenceAssets, referenceAssetIds });
  const legacy = Array.isArray(legacyImages) ? legacyImages : [];
  const styleLegacy = normalized.style.length ? normalized.style : legacy;
  const [style, source] = await Promise.all([
    resolveContentReferenceImages({
      ownerEmail,
      referenceAssetIds: normalized.style,
      legacyImages: styleLegacy,
      limit: CONTENT_REFERENCE_LIMITS.style,
      assetUploadService,
      generatedAssetStore,
    }),
    resolveContentReferenceImages({
      ownerEmail,
      referenceAssetIds: normalized.source,
      legacyImages: normalized.source,
      limit: CONTENT_REFERENCE_LIMITS.source,
      assetUploadService,
      generatedAssetStore,
    }),
  ]);
  return { style, source };
}
