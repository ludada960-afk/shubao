/* ═══ 批 CY-⑰：这份表是**徽标与重试按钮的唯一真源**（CanvasNodeShell:23 读它），
   以前只有 7 个状态，而**引擎真的会写出来**的状态远不止这 7 个。
   后果全部落在用户眼睛里，而且**一个错测试都抓不到**：

   ① `skipped`（canvasGraphRunController:135 真的会把节点置成它 —— 无执行器且无产物）
      不在表里 ⇒ `normalizeStatus` 回落 'draft' ⇒ 徽标显示**「待配置」**。
      而同一次运行的用户提示条就写着「跳过 N」（index.jsx:3367）。
      更糟：重试按钮的条件是 `status === 'error'`（CanvasNodeShell:49），
      于是被跳过的节点**连"重试"都不给** —— 而重试恰恰是此时最该有的动作。
   ② `processing` / `uploading` / `upload-error` / `generating`
      —— index.jsx 里有 **13 处**写这些状态，节点正在生成/上传时，徽标一律显示**「待配置」**。
   ③ `completed`（canvasSessionModel:245 真的写进节点）⇒ 也显示「待配置」。
   ④ `blocked`（canvasGraphEngine 的 BLOCKED_STATUSES 里有）从来没被写进节点，
      所以下游被阻塞的节点**徽标毫无变化**、用户看不出来它被卡住了。

   ⇒ 修法：**把引擎真的会写出来的状态全部登记进来**，各自给一个如实的徽标。
     注意「未知状态回落 draft」这条**保留** —— 真正不认识的字符串仍然按"待配置"处理，
     不能因为补了几个就把兜底拆掉。 */
export const NODE_STATUSES = {
  draft: { label: '待配置', tone: 'neutral' },
  analyzing: { label: '分析中', tone: 'info' },
  queued: { label: '排队中', tone: 'info' },
  pending: { label: '排队中', tone: 'info' },
  submitted: { label: '已提交', tone: 'info' },
  running: { label: '处理中', tone: 'info' },
  processing: { label: '生成中', tone: 'info' },
  generating: { label: '生成中', tone: 'info' },
  uploading: { label: '上传中', tone: 'info' },
  ready: { label: '可编辑', tone: 'success' },
  success: { label: '已完成', tone: 'success' },
  completed: { label: '已完成', tone: 'success' },
  done: { label: '已完成', tone: 'success' },
  succeeded: { label: '已完成', tone: 'success' },
  blocked: { label: '被上游阻塞', tone: 'warning' },
  skipped: { label: '已跳过', tone: 'warning' },
  stale: { label: '已失效·需重跑', tone: 'warning' },
  error: { label: '需要重试', tone: 'danger' },
  failed: { label: '需要重试', tone: 'danger' },
  failure: { label: '需要重试', tone: 'danger' },
  'upload-error': { label: '上传失败', tone: 'danger' },
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
    url: layer.url || layer.preview_url || layer.previewUrl || '',
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
