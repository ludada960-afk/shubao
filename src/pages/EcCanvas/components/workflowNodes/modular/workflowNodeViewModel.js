export const NODE_STATUSES = {
  draft: { label: '待配置', tone: 'neutral' },
  analyzing: { label: '分析中', tone: 'info' },
  running: { label: '处理中', tone: 'info' },
  ready: { label: '可编辑', tone: 'success' },
  success: { label: '已完成', tone: 'success' },
  error: { label: '需要重试', tone: 'danger' },
};

export function normalizeStatus(status) {
  return NODE_STATUSES[status] ? status : 'draft';
}

export function getStatusMeta(status) {
  const normalized = normalizeStatus(status);
  return { id: normalized, ...NODE_STATUSES[normalized] };
}

export function normalizeActions(actions = []) {
  return actions
    .filter(action => action && action.id !== 'video' && action.id !== 'storyboard')
    .map(action => ({
      id: String(action.id),
      label: String(action.label || action.id),
      description: String(action.description || action.hint || ''),
      group: String(action.group || '电商任务'),
      icon: action.icon,
    }));
}

export function groupActions(actions = [], query = '') {
  const needle = String(query).trim().toLowerCase();
  return normalizeActions(actions).reduce((groups, action) => {
    if (needle && !`${action.label} ${action.description}`.toLowerCase().includes(needle)) return groups;
    (groups[action.group] ||= []).push(action);
    return groups;
  }, {});
}

export function getNodeState({ selected = false, status = 'draft', disabled = false } = {}) {
  const meta = getStatusMeta(status);
  return {
    selected: Boolean(selected),
    disabled: Boolean(disabled),
    status: meta.id,
    statusLabel: meta.label,
    statusTone: meta.tone,
  };
}

export function normalizeLayer(layer = {}, index = 0) {
  return {
    id: String(layer.id || `layer-${index + 1}`),
    name: String(layer.name || `图层 ${index + 1}`),
    kind: String(layer.kind || '元素'),
    description: String(layer.description || ''),
    previewUrl: layer.previewUrl || layer.preview_url || '',
    visible: layer.visible !== false,
    locked: Boolean(layer.locked),
    editable: layer.editable !== false,
  };
}

export function normalizeLayers(layers = []) {
  return (Array.isArray(layers) ? layers : []).map(normalizeLayer);
}

export function getLayerCapabilities(capabilities = {}) {
  return {
    pixelLayers: Boolean(capabilities.pixelLayers),
    editableText: Boolean(capabilities.editableText),
    psdExport: Boolean(capabilities.psdExport && capabilities.pixelLayers),
  };
}

export function clampOutputCount(value, allowed = [1, 2, 4]) {
  const count = Number(value);
  return allowed.includes(count) ? count : allowed[0];
}

export function getImageRailState(images = [], maxVisible = 6) {
  const list = Array.isArray(images) ? images : [];
  return { count: list.length, overflow: Math.max(0, list.length - maxVisible), hasImages: list.length > 0 };
}
