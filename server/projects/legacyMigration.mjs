function stableAssetId(url) {
  const value = String(url || '').trim();
  const match = value.match(/\/api\/generated-assets\/([^/?#]+)$/i);
  return match ? match[1] : '';
}

export function migrateLegacyWorkOnRead({ ownerEmail, work, projectStore } = {}) {
  if (!projectStore || typeof projectStore.migrateLegacyWork !== 'function') throw new TypeError('projectStore.migrateLegacyWork is required');
  const key = String(work?._saveKey || '').trim();
  if (!key || !work?._ecResult || String(work?.projectId || '').trim()) return null;
  const assets = (Array.isArray(work.images) ? work.images : Object.values(work.images || {}))
    .map(image => typeof image === 'string' ? { url: image } : image)
    .map(image => ({ assetId: stableAssetId(image?.url), stableUrl: String(image?.url || '').trim() }))
    .filter(asset => asset.assetId && asset.stableUrl);
  return projectStore.migrateLegacyWork({ ownerEmail, legacyWorkKey: key, title: work.product_name || work.name || '历史作品', assets });
}
