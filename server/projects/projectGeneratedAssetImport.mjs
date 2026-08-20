import crypto from 'node:crypto';

const GENERATED_ASSET_RE = /^([a-f0-9]{64})\.(jpg|png|webp)$/i;
const MIME_BY_EXTENSION = Object.freeze({
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
});

function clean(value, max = 500) {
  const normalized = String(value ?? '').trim();
  if (!normalized || normalized.length > max || /[\u0000-\u001F\u007F]/.test(normalized)) return '';
  return normalized;
}

function coded(code, message) {
  return Object.assign(new Error(message), { code });
}

function parseGeneratedAsset(value) {
  const normalized = clean(value, 256);
  const match = GENERATED_ASSET_RE.exec(normalized);
  return match ? { id: normalized, hash: match[1].toLowerCase(), extension: match[2].toLowerCase() } : null;
}

export function createGeneratedProjectAssetImporter({ projectStore, readGeneratedAsset } = {}) {
  if (!projectStore || typeof projectStore.createProjectAsset !== 'function') {
    throw new TypeError('projectStore.createProjectAsset is required');
  }
  if (typeof readGeneratedAsset !== 'function') throw new TypeError('readGeneratedAsset is required');

  return async function registerGeneratedProjectAsset({
    ownerEmail,
    projectId,
    versionId = null,
    assetId,
    stableUrl,
    role = 'generated',
    metadata = {},
  } = {}) {
    const owner = clean(ownerEmail, 320).toLowerCase();
    const targetProjectId = clean(projectId, 256);
    const normalizedRole = clean(role, 80);
    const source = parseGeneratedAsset(assetId);
    const stable = clean(stableUrl, 2000);
    const stableSource = parseGeneratedAsset(stable.replace(/^\/api\/generated-assets\//i, ''));
    if (!owner) throw new TypeError('ownerEmail is required');
    if (!targetProjectId) throw new TypeError('projectId is required');
    if (!normalizedRole) throw new TypeError('role is required');
    if (!source || stable !== `/api/generated-assets/${source.id}`
      || !stableSource || stableSource.id !== source.id) {
      throw coded('GENERATED_ASSET_NOT_FOUND', '生成图片不存在或不是应用内稳定资产');
    }

    const stored = await readGeneratedAsset(source.id);
    if (!stored?.buffer?.length) throw coded('GENERATED_ASSET_NOT_READY', '生成图片尚未完成持久化校验');
    const contentType = clean(stored.contentType, 160).toLowerCase();
    const expectedMime = MIME_BY_EXTENSION[source.extension];
    if (contentType !== expectedMime) throw coded('GENERATED_ASSET_NOT_READY', '生成图片格式校验失败');
    const actualHash = crypto.createHash('sha256').update(stored.buffer).digest('hex');
    if (actualHash !== source.hash) throw coded('GENERATED_ASSET_NOT_READY', '生成图片完整性校验失败');

    return projectStore.createProjectAsset({
      ownerEmail: owner,
      projectId: targetProjectId,
      versionId,
      assetId: source.id,
      role: normalizedRole,
      stableUrl: stable,
      contentHash: actualHash,
      mimeType: contentType,
      retentionClass: 'generated',
      metadata,
    });
  };
}
