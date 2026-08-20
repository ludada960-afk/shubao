import crypto from 'node:crypto';

const IMAGE_ASSET_ID_RE = /^([a-f0-9]{64})\.(?:jpg|png|webp)$/i;
const IMAGE_MIME_RE = /^image\/(?:jpeg|png|webp)$/i;

function clean(value, max = 500) {
  const normalized = String(value ?? '').trim();
  if (!normalized || normalized.length > max || /[\u0000-\u001F\u007F]/.test(normalized)) return '';
  return normalized;
}

function coded(code, message) {
  return Object.assign(new Error(message), { code });
}

function normalizeMetadata(value) {
  if (value == null) return {};
  if (typeof value !== 'object' || Array.isArray(value)) throw coded('IMAGE_ASSET_METADATA_INVALID', '素材元数据无效');
  try {
    const serialized = JSON.stringify(value);
    if (serialized.length > 8_000) throw coded('IMAGE_ASSET_METADATA_INVALID', '素材元数据过大');
    return JSON.parse(serialized);
  } catch (error) {
    if (error?.code === 'IMAGE_ASSET_METADATA_INVALID') throw error;
    throw coded('IMAGE_ASSET_METADATA_INVALID', '素材元数据不可保存');
  }
}

function sourceAssetId(value) {
  const normalized = clean(value, 256);
  const match = IMAGE_ASSET_ID_RE.exec(normalized);
  return match ? { id: normalized, hash: match[1].toLowerCase() } : null;
}

export function createImageProjectAssetImporter({ projectStore, assetUploadService, readGeneratedAsset } = {}) {
  if (!projectStore || typeof projectStore.createProjectAsset !== 'function') {
    throw new TypeError('projectStore.createProjectAsset is required');
  }
  if (!assetUploadService || typeof assetUploadService.getOwnedAsset !== 'function') {
    throw new TypeError('assetUploadService.getOwnedAsset is required');
  }
  if (typeof readGeneratedAsset !== 'function') throw new TypeError('readGeneratedAsset is required');

  return async function importImageProjectAsset({
    ownerEmail,
    projectId,
    imageAssetId,
    role = 'reference',
    metadata = {},
  } = {}) {
    const owner = clean(ownerEmail, 320).toLowerCase();
    const targetProjectId = clean(projectId, 256);
    const sourceId = sourceAssetId(imageAssetId);
    const normalizedRole = clean(role, 80);
    if (!owner) throw new TypeError('ownerEmail is required');
    if (!targetProjectId) throw new TypeError('projectId is required');
    if (!sourceId) throw coded('IMAGE_ASSET_NOT_FOUND', '图片素材不存在或不是可归档原图');
    if (!normalizedRole) throw new TypeError('role is required');

    let source;
    try {
      source = await assetUploadService.getOwnedAsset({ ownerEmail: owner, assetId: sourceId.id });
    } catch (error) {
      if (error?.code === 'ASSET_NOT_FOUND' || error?.code === 'ASSET_OWNER_MISMATCH') {
        throw coded('IMAGE_ASSET_NOT_FOUND', '图片素材不存在或不属于当前账号');
      }
      throw error;
    }
    if (!source || source.kind !== 'original' || !IMAGE_MIME_RE.test(clean(source.mimeType, 160))) {
      throw coded('IMAGE_ASSET_NOT_READY', '图片素材尚未完成持久化校验');
    }

    const stored = await readGeneratedAsset(sourceId.id);
    if (!stored?.buffer?.length || !IMAGE_MIME_RE.test(clean(stored.contentType, 160))) {
      throw coded('IMAGE_ASSET_NOT_READY', '图片素材尚未完成持久化校验');
    }
    const actualHash = crypto.createHash('sha256').update(stored.buffer).digest('hex');
    if (actualHash !== sourceId.hash || clean(source.url) !== `/api/generated-assets/${sourceId.id}`) {
      throw coded('IMAGE_ASSET_NOT_READY', '图片素材完整性校验失败');
    }

    const userMetadata = normalizeMetadata(metadata);
    return projectStore.createProjectAsset({
      ownerEmail: owner,
      projectId: targetProjectId,
      assetId: sourceId.id,
      role: normalizedRole,
      stableUrl: `/api/generated-assets/${sourceId.id}`,
      contentHash: sourceId.hash,
      mimeType: clean(source.mimeType, 160).toLowerCase(),
      width: Number.isSafeInteger(source.width) ? source.width : null,
      height: Number.isSafeInteger(source.height) ? source.height : null,
      metadata: {
        ...userMetadata,
        source: 'ecommerce-upload',
        sourceImageAssetId: sourceId.id,
        width: Number.isSafeInteger(source.width) ? source.width : null,
        height: Number.isSafeInteger(source.height) ? source.height : null,
        bytes: Number.isSafeInteger(source.byteSize) ? source.byteSize : stored.buffer.length,
      },
      retentionClass: 'source',
    });
  };
}
