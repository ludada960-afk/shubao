const MEDIA_KINDS = new Set(['image', 'video', 'audio']);

function clean(value) {
  return String(value || '').trim();
}

function searchableMetadata(value) {
  if (!value || typeof value !== 'object') return '';
  try {
    return JSON.stringify(value);
  } catch {
    return '';
  }
}

function searchableText(asset) {
  return [
    asset?.projectAssetId,
    asset?.metadata?.displayName,
    searchableMetadata(asset?.metadata),
    asset?.assetId,
    asset?.role,
    asset?.projectId,
    asset?.project?.title,
    asset?.project?.id,
    asset?.projectTitle,
  ].map(clean).filter(Boolean).join(' ').toLocaleLowerCase('zh-CN');
}

function dateValue(value) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function formatDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export const PROJECT_ASSET_RETENTION_FILTERS = Object.freeze([
  { id: 'all', label: '全部状态' },
  { id: 'pinned', label: '长期保留' },
  { id: 'managed', label: '按项目策略' },
  { id: 'attention', label: '需要处理' },
]);

export const PROJECT_ASSET_PRODUCTION_STATES = Object.freeze([
  { id: 'draft', label: '草稿', detail: '仍在制作或等待筛选', tone: 'draft' },
  { id: 'candidate', label: '候选', detail: '已选中，等待交付或发布', tone: 'candidate' },
  { id: 'delivered', label: '已交付', detail: '已用于发布、上架或交付', tone: 'delivered' },
  { id: 'archived', label: '已归档', detail: '保留记录，但暂不参与当前交付', tone: 'archived' },
]);

export const PROJECT_ASSET_PRODUCTION_FILTERS = Object.freeze([
  { id: 'all', label: '全部生产状态' },
  ...PROJECT_ASSET_PRODUCTION_STATES.map(({ id, label }) => ({ id, label })),
]);

export function projectAssetProductionStatus(asset = {}) {
  return PROJECT_ASSET_PRODUCTION_STATES.find(status => status.id === clean(asset.productionState))
    || PROJECT_ASSET_PRODUCTION_STATES[0];
}

export function projectAssetProductionOptions(asset = {}) {
  const current = projectAssetProductionStatus(asset).id;
  const allowed = {
    draft: ['draft', 'candidate', 'archived'],
    candidate: ['candidate', 'draft', 'archived'],
    delivered: ['delivered', 'archived'],
    archived: ['archived', 'draft'],
  }[current] || ['draft', 'candidate', 'archived'];
  return allowed.map(id => PROJECT_ASSET_PRODUCTION_STATES.find(option => option.id === id)).filter(Boolean);
}

export function projectAssetRetentionStatus(asset = {}, now = new Date()) {
  if (asset.retentionPinned || asset.retentionClass === 'permanent') {
    return { id: 'pinned', label: '长期保留', detail: '不会按项目策略清理', tone: 'pinned' };
  }
  const retentionState = clean(asset.retentionState).toLowerCase();
  const expiresAt = dateValue(asset.expiresAt);
  if (retentionState === 'marked' || retentionState === 'isolated' || (expiresAt && expiresAt <= now)) {
    return { id: 'attention', label: expiresAt && expiresAt <= now ? '已到期' : '待清理', detail: '请长期保留或重新生成', tone: 'attention' };
  }
  return {
    id: 'managed',
    label: expiresAt ? `保留至 ${formatDate(expiresAt)}` : '按项目策略保留',
    detail: '可随时长期保留',
    tone: 'managed',
  };
}

export function canReuseProjectAsset(asset = {}, now = new Date()) {
  return projectAssetRetentionStatus(asset, now).id !== 'attention';
}

export function projectAssetSelectionKey(asset = {}) {
  const projectId = clean(asset?.projectId || asset?.project?.id);
  const projectAssetId = clean(asset?.projectAssetId);
  const contentHash = clean(asset?.contentHash);
  return projectId && projectAssetId && contentHash ? `${projectId}:${projectAssetId}:${contentHash}` : '';
}

export function toggleProjectAssetSelection(selectedKeys, asset, now = new Date()) {
  const next = new Set(selectedKeys instanceof Set ? selectedKeys : (Array.isArray(selectedKeys) ? selectedKeys : []));
  const key = projectAssetSelectionKey(asset);
  if (!key || !canReuseProjectAsset(asset, now)) return next;
  if (next.has(key)) next.delete(key);
  else next.add(key);
  return next;
}

export function normalizeProjectAssetSelection(selectedKeys, assets = [], now = new Date()) {
  const allowed = new Set((Array.isArray(assets) ? assets : [])
    .filter(asset => canReuseProjectAsset(asset, now))
    .map(projectAssetSelectionKey)
    .filter(Boolean));
  const keys = selectedKeys instanceof Set ? [...selectedKeys] : (Array.isArray(selectedKeys) ? selectedKeys : []);
  return new Set(keys
    .filter(key => allowed.has(key)));
}

export function normalizeProjectAssetLibrary(assets = [], { currentProjectId = '' } = {}) {
  const seen = new Set();
  return (Array.isArray(assets) ? assets : [])
    .map(asset => ({
      ...asset,
      projectId: asset?.projectId || asset?.project?.id || '',
      projectTitle: asset?.projectTitle || asset?.project?.title || '未命名项目',
      mediaKind: clean(asset?.mediaKind || asset?.media_kind).toLowerCase(),
    }))
    .filter(asset => {
      if (!MEDIA_KINDS.has(asset.mediaKind) || !asset.projectAssetId || !asset.contentHash) return false;
      const key = `${asset.projectId}:${asset.projectAssetId}:${asset.contentHash}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((left, right) => {
      const currentProjectOrder = (right.projectId === currentProjectId ? 1 : 0) - (left.projectId === currentProjectId ? 1 : 0);
      if (currentProjectOrder) return currentProjectOrder;
      const pinnedOrder = (right.retentionPinned ? 1 : 0) - (left.retentionPinned ? 1 : 0);
      if (pinnedOrder) return pinnedOrder;
      return String(right.createdAt || '').localeCompare(String(left.createdAt || ''));
    });
}

export function filterProjectAssetLibrary(assets = [], { query = '', retentionFilter = 'all', productionFilter = 'all', now = new Date() } = {}) {
  const normalizedQuery = clean(query).toLocaleLowerCase('zh-CN');
  return (Array.isArray(assets) ? assets : []).filter(asset => {
    if (normalizedQuery && !searchableText(asset).includes(normalizedQuery)) return false;
    if (retentionFilter !== 'all' && projectAssetRetentionStatus(asset, now).id !== retentionFilter) return false;
    if (productionFilter !== 'all' && projectAssetProductionStatus(asset).id !== productionFilter) return false;
    return true;
  });
}
