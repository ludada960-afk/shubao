const PENDING_PROJECT_ASSET_KINDS = new Set(['image', 'video', 'audio']);
const PENDING_PROJECT_ASSET_OPERATIONS = new Set(['import-source', 'register-generated']);
const SAFE_PENDING_ASSET_URL = /^\/api\/(?:generated-assets|video\/assets)\//i;

function cleanText(value, max = 240) {
  const normalized = String(value || '').trim();
  return normalized && normalized.length <= max && !/[\u0000-\u001F\u007F]/.test(normalized) ? normalized : '';
}

function sourceAssetId(kind, record = {}) {
  const asset = record.asset || {};
  return cleanText(record.sourceAssetId || (kind === 'image'
    ? asset.assetId || asset.id
    : asset.id || asset.videoAssetId || asset.assetId), 256);
}

function safeAsset(kind, record, assetId) {
  const asset = record.asset || {};
  const candidateUrl = cleanText(asset.stableUrl || asset.url, 500);
  const candidatePath = SAFE_PENDING_ASSET_URL.test(candidateUrl) ? candidateUrl.split(/[?#]/, 1)[0] : '';
  const expectedPrefix = kind === 'image' ? '/api/generated-assets/' : '/api/video/assets/';
  const stableUrl = candidatePath === `${expectedPrefix}${assetId}` ? candidatePath : '';
  return {
    ...(kind === 'image' ? { assetId } : { id: assetId, videoAssetId: assetId }),
    ...(stableUrl ? { url: stableUrl, stableUrl } : {}),
    ...(cleanText(asset.name || asset.label) ? { name: cleanText(asset.name || asset.label) } : {}),
    ...(cleanText(asset.mimeType || asset.mime_type, 160) ? { mimeType: cleanText(asset.mimeType || asset.mime_type, 160).toLowerCase() } : {}),
    ...(Number.isSafeInteger(asset.width) && asset.width > 0 ? { width: asset.width } : {}),
    ...(Number.isSafeInteger(asset.height) && asset.height > 0 ? { height: asset.height } : {}),
    ...(Number.isFinite(Number(asset.duration)) && Number(asset.duration) >= 0 ? { duration: Number(asset.duration) } : {}),
    ...(cleanText(asset.aspectRatio, 32) ? { aspectRatio: cleanText(asset.aspectRatio, 32) } : {}),
  };
}

export function normalizeCanvasPendingProjectAssetImports(records = []) {
  const byKey = new Map();
  for (const record of Array.isArray(records) ? records : []) {
    const kind = cleanText(record?.kind, 20).toLowerCase();
    if (!PENDING_PROJECT_ASSET_KINDS.has(kind)) continue;
    const requestedOperation = cleanText(record?.operation, 40).toLowerCase();
    const operation = PENDING_PROJECT_ASSET_OPERATIONS.has(requestedOperation)
      ? requestedOperation
      : 'import-source';
    if (operation === 'register-generated' && kind !== 'image') continue;
    const assetId = sourceAssetId(kind, record);
    const nodeIds = [...new Set((Array.isArray(record?.nodeIds) ? record.nodeIds : [])
      .map(nodeId => cleanText(nodeId, 180)).filter(Boolean))].slice(0, 32);
    if (!assetId || !nodeIds.length) continue;
    const key = `${operation}:${kind}:${assetId}`;
    const existing = byKey.get(key);
    const next = {
      kind,
      ...(operation === 'register-generated' ? { operation } : {}),
      sourceAssetId: assetId,
      role: cleanText(record?.role, 80) || 'reference',
      displayName: cleanText(record?.displayName || record?.asset?.name, 240) || 'Canvas 媒体素材',
      nodeIds,
      asset: safeAsset(kind, record, assetId),
    };
    byKey.set(key, existing
      ? { ...existing, ...next, nodeIds: [...new Set([...existing.nodeIds, ...next.nodeIds])].slice(0, 32) }
      : next);
  }
  return [...byKey.values()].slice(0, 32);
}
