const MEDIA_KINDS = new Set(['image', 'video', 'audio']);
const MEDIA_MIME_PREFIXES = new Map([
  ['image', 'image/'],
  ['video', 'video/'],
  ['audio', 'audio/'],
]);

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
  if (typeof value !== 'object' || Array.isArray(value)) throw coded('VIDEO_ASSET_METADATA_INVALID', '素材元数据无效');
  try {
    const serialized = JSON.stringify(value);
    if (serialized.length > 8_000) throw coded('VIDEO_ASSET_METADATA_INVALID', '素材元数据过大');
    return JSON.parse(serialized);
  } catch (error) {
    if (error?.code === 'VIDEO_ASSET_METADATA_INVALID') throw error;
    throw coded('VIDEO_ASSET_METADATA_INVALID', '素材元数据不可保存');
  }
}

function sourceRowFromValue(source) {
  const row = source?.row && typeof source.row === 'object' ? source.row : source;
  return row && typeof row === 'object' ? row : null;
}

export function createVideoProjectAssetImporter({ projectStore, readVideoAsset } = {}) {
  if (!projectStore || typeof projectStore.createProjectAsset !== 'function') {
    throw new TypeError('projectStore.createProjectAsset is required');
  }
  if (typeof readVideoAsset !== 'function') throw new TypeError('readVideoAsset is required');

  return async function importVideoProjectAsset({
    ownerEmail,
    projectId,
    videoAssetId,
    role = 'reference',
    metadata = {},
  } = {}) {
    const owner = clean(ownerEmail, 320).toLowerCase();
    const targetProjectId = clean(projectId, 256);
    const sourceId = clean(videoAssetId, 256);
    const normalizedRole = clean(role, 80);
    if (!owner) throw new TypeError('ownerEmail is required');
    if (!targetProjectId) throw new TypeError('projectId is required');
    if (!sourceId) throw new TypeError('videoAssetId is required');
    if (!normalizedRole) throw new TypeError('role is required');

    const source = await readVideoAsset(sourceId, owner);
    const row = sourceRowFromValue(source);
    const kind = clean(row?.kind, 20).toLowerCase();
    const mimeType = clean(row?.content_type || row?.contentType, 160).toLowerCase();
    const contentHash = clean(row?.sha256 || row?.contentHash, 64).toLowerCase();
    const bytes = Number(row?.bytes);
    if (!row || clean(row.owner_email || row.ownerEmail, 320).toLowerCase() !== owner) {
      throw coded('VIDEO_ASSET_NOT_FOUND', '素材不存在或不属于当前账号');
    }
    if (!MEDIA_KINDS.has(kind) || !MEDIA_MIME_PREFIXES.get(kind)
      || !mimeType.startsWith(MEDIA_MIME_PREFIXES.get(kind))
      || !/^[a-f0-9]{64}$/.test(contentHash)
      || !Number.isSafeInteger(bytes) || bytes <= 0
      || !source?.filePath) {
      throw coded('VIDEO_ASSET_NOT_READY', '素材尚未完成持久化校验');
    }

    const userMetadata = normalizeMetadata(metadata);
    return projectStore.createProjectAsset({
      ownerEmail: owner,
      projectId: targetProjectId,
      assetId: clean(row.id, 256),
      role: normalizedRole,
      stableUrl: `/api/video/assets/${encodeURIComponent(clean(row.id, 256))}`,
      contentHash,
      mimeType,
      metadata: {
        ...userMetadata,
        source: 'video-upload',
        sourceVideoAssetId: clean(row.id, 256),
        fileName: clean(row.file_name || row.fileName, 500),
        bytes,
      },
      retentionClass: 'source',
    });
  };
}
