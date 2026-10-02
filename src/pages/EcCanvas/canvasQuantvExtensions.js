/* ── §18 色值迁移例外声明（2026-09-14 本批）─────────────────────────────
   本文件**有意不参与** §18「硬编码色值 → token」迁移，原因是它的色值不是 UI chrome：
   · NODE_KIND_COLORS —— 小地图按**节点类型**区分的分类身份调色板，每种类型一个不同色相
     （text/image/video/audio…）。语义 token 会把它们收敛到同一支，**塌掉类型区分度**。
   · STICKER_COLORS   —— 便签的**用户内容**配色，随作品数据落库，不是界面主题色。
   与 scripts/design-ratchet.mjs 的 DATA_FILES（src/constants/data.js）同理：
   受棘轮基线约束（只降不升），但语义上不属于 token 迁移对象。
   若日后确需收编，应作为**独立裁定**（改观感），不得按 §18 机械替换。 */

/* ═══════ 4c183cd4 续命 画布总监督 - Quantv 功能扩展 (2026-08-30) ═══════
   复刻 Quantv 画布所有功能的核心模块:
   - 边类型校验 (isEdgeInvalid)
   - 节点能力按 model 开关 (nodeActionFlags)
   - 节点自动命名 (autoCanvasShotName)
   - 任务日志状态机 (8 状态)
   - 保存状态指示器 (saveStatus)
   - 批量打包下载 (batchDownloadNodes)
   - 节点分组 (canvasGroupOps)
   - 网格吸附 (snapToGrid)
   - 自动排版 (autoArrange)
   - 主题切换 (themeMode)
   - 便签 (sticker)
   用户原话 8-30: "你必须做到最成品, 最面向市场, 最高级的一个体验和流畅度" */

/* ═══════ 1. 节点产出/接收类型 (Quantv §1.2) ═══════ */

/* 每种节点 kind 的产出类型 (output kind) 和可接收类型 (input kinds)
   Quantv 用 iG={text:'文本', image:'图片', video:'视频', audio:'音频', doc:'文档'}
   薯包扩展: image / video / audio / text / application 五类 */
export const NODE_TYPE_KIND = Object.freeze({
  text: 'text',
  image: 'image',
  output: 'image',          // 输出节点也是图片
  video: 'video',
  audio: 'audio',
  application: 'application',
  source_group: 'image',
  'layer-group': 'image',
  'image-composer': 'image',
  'text-composer': 'text',
  'video-composer': 'video',
  'suite-composer': 'image',
  'smart-remix': 'image',
  'layer-workbench': 'image',
  'remove-bg': 'image',
  extend: 'image',
  inpaint: 'image',
  translate: 'image',
  upscale: 'image',
});

export const NODE_ACCEPT_TYPES = Object.freeze({
  text: ['text', 'image'],
  image: ['image', 'application'],
  output: ['image', 'application'],
  video: ['image', 'text', 'video', 'application'],
  audio: ['text', 'video', 'application'],
  application: ['image', 'text', 'video', 'audio'],
  source_group: [],
  'layer-group': ['image'],
  'image-composer': ['image', 'text'],
  'text-composer': ['text', 'image'],
  'video-composer': ['image', 'text', 'video', 'audio'],
  'suite-composer': ['image'],
  'smart-remix': ['image', 'text'],
  'layer-workbench': ['image'],
  'remove-bg': ['image'],
  extend: ['image'],
  inpaint: ['image', 'text'],
  translate: ['image'],
  upscale: ['image'],
});

/* ═══════ 2. 边类型校验 (Quantv isEdgeInvalid) ═══════ */

const TYPE_LABEL = Object.freeze({
  image: '图片', video: '视频', audio: '音频', text: '文本', application: '应用',
});

/** 给用户看的"这个框能接什么"（用于把拦截原因说成人话，而不是 type-mismatch） */
export function describeAcceptedTypes(kind) {
  return (NODE_ACCEPT_TYPES[kind] || []).map(type => TYPE_LABEL[type] || type);
}

/* ═══ 批 CY-㊴（2026-09-30）：把这条矩阵从"只画红线"变成**真的会拦** ═════════════
   用户原话：
     「他不应该让画布里面的任意视频也跟他进行连接匹配。因为视频是跟他互斥的，
       视频是不能跟他连接的嘛，**如果跟他连接了的话，你下面的素材图这个框是没有办法添加进来的**。
       那这些逻辑性的问题肯定不止我说的这么一个例子。你要把所有的逻辑都想明白。」

   事故：`isEdgeInvalid` 的结果**只被用来把线画成红色虚线**（index.jsx 的 ConnectionLines），
   边本身照样进 connections、照样进生成链路、照样扣费 ——
   也就是说"图片生成框里连了一条视频"这种事，用户看得见红线，却照样会发生。
   ⇒ 这里补一个**建边前**的判定：不合规则不建边，并把原因说成人话给用户看。

   顺带修一处矩阵与真实上传口径的**不一致**（用户 9-30 点名的"逻辑想明白"）：
     `handleComposerSourceUpload` 里 **视频生成框本来就能收视频/音频**
     （files.filter(type.startsWith('video/') || startsWith('audio/'))），
     但矩阵写的是 ['image','text'] —— 于是"手动上传能进、拖线进不去"。
     同一件事两条路两种结果，这才叫逻辑没想清楚。 */
/* ═══ 2026-10-02：防成环 ═══════════════════════════════════════════════════════
   原来只挡了「自己连自己」，没挡 A→B→C→A。
   后果不是画丑：画布的图执行是**顺着边跑**的（canvasGraphRunController
   buildTransitiveDownstream），成环之后那三个节点会互相触发、永远等对方，
   表现为「点了运行永远转圈」。tldraw / draw.io / React Flow 都不自带这层
   （RF 要你自己写 isValidConnection），Excalidraw 靠 binding 天然避免 ——
   我们是自由连线，必须自己判。

   判据：加边 from→to 之前，从 to 出发能不能走回 from。走得到就是成环。
   复杂度 O(V+E)，拖线时每次 pointermove 调一次也扛得住。 */
export function wouldCreateCanvasCycle(connections = [], fromId = '', toId = '') {
  if (!fromId || !toId || fromId === toId) return false;
  const adjacency = new Map();
  (Array.isArray(connections) ? connections : []).forEach(conn => {
    const from = conn?.fromNodeId || conn?.from;
    const to = conn?.toNodeId || conn?.to;
    if (!from || !to) return;
    if (!adjacency.has(from)) adjacency.set(from, []);
    adjacency.get(from).push(to);
  });
  const seen = new Set([toId]);
  const stack = [toId];
  while (stack.length) {
    const current = stack.pop();
    if (current === fromId) return true;
    const next = adjacency.get(current) || [];
    for (const target of next) {
      if (seen.has(target)) continue;
      seen.add(target);
      stack.push(target);
    }
  }
  return false;
}

export function canConnectCanvasNodes(fromId, toNode, nodes = [], connections = []) {
  const fromNode = Array.isArray(nodes) ? nodes.find(node => node.id === fromId) : null;
  if (!fromNode || !toNode) return { ok: false, reason: '这条线的两端有一端已经不在画布上了' };
  if (fromNode.id === toNode.id) return { ok: false, reason: '不能把素材连到它自己' };
  if (wouldCreateCanvasCycle(connections, fromId, toNode.id)) {
    return { ok: false, reason: '这样连会绕回自己（形成闭环），下游就永远等不到了' };
  }
  const outputType = NODE_TYPE_KIND[fromNode.kind] || 'image';
  const acceptedTypes = NODE_ACCEPT_TYPES[toNode.kind] || [];
  if (!acceptedTypes.includes(outputType)) {
    const label = TYPE_LABEL[outputType] || outputType;
    const accepted = describeAcceptedTypes(toNode.kind);
    return {
      ok: false,
      outputType,
      acceptedTypes,
      reason: `「${label}」接不到这个框上 —— 它只接受${accepted.length ? accepted.join('、') : '（暂不支持任何素材）'}`,
    };
  }
  return { ok: true, outputType };
}

/* 检查边是否类型有效: 上游节点产出的类型是否被下游节点接受
   - 任一端缺失: 返回 invalid (边的两端节点必须存在)
   - 类型不匹配: 返回 invalid (上游产出 vs 下游接收) */
export function isEdgeInvalid(connection = {}, nodes = []) {
  const fromId = connection.fromNodeId || connection.from;
  const toId = connection.toNodeId || connection.to;
  const fromNode = nodes.find(n => n.id === fromId);
  const toNode = nodes.find(n => n.id === toId);
  if (!fromNode || !toNode) return { invalid: true, reason: 'missing-node' };
  const outputType = NODE_TYPE_KIND[fromNode.kind] || 'image';
  const acceptedTypes = NODE_ACCEPT_TYPES[toNode.kind] || ['image', 'video', 'audio', 'text'];
  if (!acceptedTypes.includes(outputType)) {
    return { invalid: true, reason: 'type-mismatch', outputType, acceptedTypes };
  }
  return { invalid: false };
}

/* 批量过滤无效边 (返回 valid edges 和 invalid edges) */
export function partitionEdgesByValidity(connections = [], nodes = []) {
  const valid = [];
  const invalid = [];
  for (const conn of connections) {
    const result = isEdgeInvalid(conn, nodes);
    if (result.invalid) invalid.push({ ...conn, invalidReason: result.reason });
    else valid.push(conn);
  }
  return { valid, invalid };
}

/* ═══════ 3. 节点能力按 model 开关 (Quantv nodeActionFlags) ═══════ */

/* 每个节点 kind 有默认能力; 用户 model 可开关 (imageAnalyze / imageWorkspace 等 8 项) */
export const NODE_ACTION_FLAGS = Object.freeze({
  text: Object.freeze({ analyze: true, generateImage: true, generateVideo: true }),
  image: Object.freeze({ analyze: true, workspace: true, backgroundRemoval: true, gridSplit: true, upscale: true }),
  video: Object.freeze({ script: true, keyframe: true, subtitleRemoval: true, workspace: true }),
  audio: Object.freeze({ workspace: true, clone: true }),
  application: Object.freeze({ retry: true, regenerate: true }),
  source_group: Object.freeze({ analyze: true }),
  'layer-group': Object.freeze({ analyze: true }),
});

export function getNodeActionFlags(node = {}) {
  return NODE_ACTION_FLAGS[node.kind] || {};
}

/* ═══════ 4. 节点自动命名 (Quantv §1.2 aG + iG) ═══════ */

/* Quantv iG={text:'文本', image:'图片', video:'视频', audio:'音频', doc:'文档'}
   节点命名规则: 同类型节点按出现顺序加序号: 图片1, 图片2, 音频1 ...
   薯包已经实现了 Enclosure-001 风格 (P-B), 这里扩展自动 seq */

const KIND_LABEL = Object.freeze({
  text: '文本',
  image: '图片',
  video: '视频',
  audio: '音频',
  application: '应用',
  source_group: '素材组',
  'layer-group': '图层组',
  'image-composer': '图片生成',
  'text-composer': '文案生成',
  'video-composer': '视频生成',
  'suite-composer': '套图',
  'smart-remix': '商品改造',
  'layer-workbench': '智能分层',
  'remove-bg': '去背景',
  extend: '智能扩图',
  inpaint: '局部改图',
  translate: '图片翻译',
  upscale: '高清修复',
});

export function getKindLabel(kind = '') {
  return KIND_LABEL[kind] || '节点';
}

/* 根据节点列表自动生成下一个同类型序号 */
export function autoCanvasShotName(nodes = [], kind = 'image', counter = null) {
  const label = getKindLabel(kind);
  if (counter != null) return `${label}${counter}`;
  // 找当前最大序号 (≥ 1)
  let maxIdx = 0;
  const prefix = label;
  for (const node of nodes) {
    if (node.kind !== kind) continue;
    if (node.userRenamed) continue;
    const match = (node.name || node.displayLabel || '').match(new RegExp(`^${prefix}(\\d+)$`));
    if (match) {
      const n = parseInt(match[1], 10);
      if (Number.isFinite(n) && n > maxIdx) maxIdx = n;
    }
  }
  // maxIdx = 0 → 下个 = 1 (第一个节点); maxIdx = 2 → 下个 = 3
  const next = maxIdx + 1;
  return `${label}${next}`;
}

/* ═══════ 5. 任务日志状态机 (Quantv Cae - 8 状态) ═══════ */

export const TASK_STATUS = Object.freeze({
  WAITING: 'waiting',
  QUEUED: 'queued',
  PROCESSING: 'processing',
  TRANSFERRING: 'transferring',
  COMPLETED: 'completed',
  FAILED: 'failed',
  REFUNDING: 'refunding',
  REFUNDED: 'refunded',
});

export const TASK_STATUS_LABEL = Object.freeze({
  waiting: '等待提交',
  queued: '排队中',
  processing: '处理中',
  transferring: '结果转存中',
  completed: '已完成',
  failed: '已失败',
  refunding: '退款处理中',
  refunded: '已退款',
});

export function getTaskStatusLabel(status = '') {
  return TASK_STATUS_LABEL[status] || status || '未知';
}

/* 状态机: 哪些状态可转为哪些状态 */
export const TASK_STATUS_TRANSITIONS = Object.freeze({
  waiting: ['queued', 'failed'],
  queued: ['processing', 'failed'],
  processing: ['transferring', 'completed', 'failed'],
  transferring: ['completed', 'failed'],
  completed: ['refunding'],
  failed: ['refunding', 'waiting'],
  refunding: ['refunded', 'failed'],
  refunded: [],
});

export function canTransitionTaskStatus(from = '', to = '') {
  if (from === to) return true;
  const allowed = TASK_STATUS_TRANSITIONS[from] || [];
  return allowed.includes(to);
}

/* ═══════ 6. 保存状态指示器 (Quantv saved/saving/local-only/conflict) ═══════ */

export const SAVE_STATUS = Object.freeze({
  SAVED: 'saved',
  SAVING: 'saving',
  LOCAL_ONLY: 'local-only',
  CONFLICT: 'conflict',
});

export const SAVE_STATUS_LABEL = Object.freeze({
  saved: '已保存',
  saving: '保存中',
  'local-only': '本地未同步',
  conflict: '冲突',
});

export function getSaveStatusLabel(status = '') {
  return SAVE_STATUS_LABEL[status] || status || '未知';
}

/* ═══════ 7. 批量打包下载 (Quantv downloadNodesMedia) ═══════ */

/* 收集节点的媒体 URL + 文件名, 返回 {url, filename, kind}[]
   不执行实际下载, 给调用方用 fetch + blob + saveAs */
export function collectNodeMediaAssets(nodes = [], selectedIds = new Set()) {
  const ids = selectedIds instanceof Set ? selectedIds : new Set(selectedIds || []);
  const selected = nodes.filter(node => ids.has(node.id));
  const assets = [];
  for (const node of selected) {
    const url = node.url || node.output?.url || node.previewUrl;
    if (!url) continue;
    const name = node.name || node.displayLabel || node.id;
    const kind = node.kind === 'video' ? 'video' : node.kind === 'audio' ? 'audio' : 'image';
    assets.push({ url, filename: `${name}.${kind === 'video' ? 'mp4' : kind === 'audio' ? 'mp3' : 'png'}`, kind, nodeId: node.id });
    // 多图节点 (smart-remix 等): productImages / referenceImages
    const productImages = Array.isArray(node.inputs?.productImages) ? node.inputs.productImages : [];
    const referenceImages = Array.isArray(node.inputs?.referenceImages) ? node.inputs.referenceImages : [];
    [...productImages, ...referenceImages].forEach((img, idx) => {
      if (img?.url) assets.push({ url: img.url, filename: `${name}-${idx}.png`, kind: 'image', nodeId: node.id });
    });
  }
  return assets;
}

/* 浏览器端 blob 下载 (绕过 JSZip 依赖, 用原生 a[download] 逐个触发) */
export async function downloadNodeAsset(asset) {
  if (!asset?.url) return false;
  try {
    const response = await fetch(asset.url, { mode: 'cors' });
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = asset.filename || `canvas-${Date.now()}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    return true;
  } catch (e) {
    // 兜底: 直接打开 URL
    window.open(asset.url, '_blank');
    return false;
  }
}

export async function downloadNodeMediaBatch(assets = [], onProgress = null) {
  let completed = 0;
  for (const asset of assets) {
    await downloadNodeAsset(asset);
    completed++;
    onProgress?.(completed, assets.length);
    // 避免浏览器同时触发多个下载被拦截
    await new Promise(resolve => setTimeout(resolve, 220));
  }
}

/* ═══════ 8. 节点分组 (Quantv CanvasGroupLayer + Ctrl+G) ═══════ */

/* 创建分组: 给一组节点打上 groupId, 第一个节点 id 作为 groupId */
export function createCanvasGroup(nodes = [], selectedIds = new Set(), groupName = '') {
  const ids = selectedIds instanceof Set ? selectedIds : new Set(selectedIds || []);
  const selected = nodes.filter(node => ids.has(node.id));
  if (selected.length < 2) return nodes;
  const groupId = `group_${Date.now()}`;
  return nodes.map(node => ids.has(node.id)
    ? { ...node, groupId, groupName: groupName || `分组 ${groupId.slice(-4)}` }
    : node);
}

/* 取消分组: 清掉 groupId / groupName */
export function dissolveCanvasGroup(nodes = [], selectedIds = new Set()) {
  const ids = selectedIds instanceof Set ? selectedIds : new Set(selectedIds || []);
  return nodes.map(node => ids.has(node.id)
    ? { ...node, groupId: '', groupName: '' }
    : node);
}

/* 选中节点所在的整个分组 (用于 group drag / group delete) */
export function expandToGroupIds(nodes = [], selectedIds = new Set()) {
  const ids = selectedIds instanceof Set ? new Set(selectedIds) : new Set(selectedIds || []);
  const groups = new Map();
  nodes.forEach(node => {
    if (node.groupId && ids.has(node.id)) {
      groups.set(node.groupId, (groups.get(node.groupId) || new Set()));
    }
  });
  nodes.forEach(node => {
    if (groups.has(node.groupId)) {
      groups.get(node.groupId).add(node.id);
    }
  });
  const allIds = new Set(ids);
  groups.forEach(set => set.forEach(id => allIds.add(id)));
  return allIds;
}

/* ═══════ 9. 网格吸附 (Quantv snapEnabled) ═══════ */

export const CANVAS_GRID_SIZE = 8;  // 8px 网格 (Quantv 默认)

export function snapToGrid(value = 0, gridSize = CANVAS_GRID_SIZE) {
  const safe = Number.isFinite(Number(value)) ? Number(value) : 0;
  const size = Math.max(1, Number(gridSize) || CANVAS_GRID_SIZE);
  // 负值保留 (画布允许负坐标, 如 zoom 大时左上角可见区); 0 → 0
  const snapped = Math.round(safe / size) * size;
  // 防止 -0 输出
  return Object.is(snapped, -0) ? 0 : snapped;
}

export function snapNodeToGrid(node = {}, gridSize = CANVAS_GRID_SIZE) {
  return {
    ...node,
    x: snapToGrid(node.x, gridSize),
    y: snapToGrid(node.y, gridSize),
    w: snapToGrid(node.w, gridSize),
    h: snapToGrid(node.h, gridSize),
  };
}

/* ═══════ 10. 自动排版 (Quantv onAutoArrange - 按 DAG 拓扑分层) ═══════ */

export function autoArrangeCanvasNodes(nodes = [], connections = [], options = {}) {
  if (!nodes.length) return nodes;
  const gap = Math.max(20, options.gap || 36);
  const layerGap = Math.max(40, options.layerGap || 80);
  const columnGap = Math.max(20, options.columnGap || gap);

  // 拓扑分层 (BFS)
  const adjacency = new Map();
  const inDegree = new Map();
  nodes.forEach(n => { inDegree.set(n.id, 0); });
  connections.forEach(conn => {
    const fromId = conn.fromNodeId || conn.from;
    const toId = conn.toNodeId || conn.to;
    if (fromId && toId && nodes.some(n => n.id === fromId) && nodes.some(n => n.id === toId)) {
      if (!adjacency.has(fromId)) adjacency.set(fromId, new Set());
      adjacency.get(fromId).add(toId);
      inDegree.set(toId, (inDegree.get(toId) || 0) + 1);
    }
  });

  const layerById = new Map();
  const queue = [];
  nodes.forEach(n => {
    if (inDegree.get(n.id) === 0) {
      layerById.set(n.id, 0);
      queue.push(n.id);
    }
  });
  while (queue.length) {
    const id = queue.shift();
    const layer = layerById.get(id) || 0;
    const neighbors = adjacency.get(id) || new Set();
    neighbors.forEach(nextId => {
      const newLayer = layer + 1;
      if (!layerById.has(nextId) || layerById.get(nextId) < newLayer) {
        layerById.set(nextId, newLayer);
        queue.push(nextId);
      }
    });
  }
  // 兜底: 不在拓扑中的节点放第 0 层
  nodes.forEach(n => {
    if (!layerById.has(n.id)) layerById.set(n.id, 0);
  });

  // 按层分组
  const layers = new Map();
  layerById.forEach((layerIdx, id) => {
    if (!layers.has(layerIdx)) layers.set(layerIdx, []);
    layers.get(layerIdx).push(id);
  });

  // 同层按 kind + 原顺序排 - 拓扑横向布局: 层作为 X 轴, 同层节点作为 Y 轴
  const sortedLayers = [...layers.entries()].sort((a, b) => a[0] - b[0]);
  const positioned = new Map();
  let xCursor = 80;
  let maxLayerHeight = 0;
  for (const [layerIdx, ids] of sortedLayers) {
    let yCursor = 80;
    let maxRowWidth = 0;
    for (const id of ids) {
      const node = nodes.find(n => n.id === id);
      if (!node) continue;
      positioned.set(id, { x: xCursor, y: yCursor, w: node.w, h: node.h });
      yCursor += (node.h || 240) + columnGap;
      const nodeW = node.w || 240;
      if (nodeW > maxRowWidth) maxRowWidth = nodeW;
    }
    if (yCursor - 80 > maxLayerHeight) maxLayerHeight = yCursor - 80;
    xCursor += maxRowWidth + layerGap;
  }
  void maxLayerHeight;

  return nodes.map(node => {
    const pos = positioned.get(node.id);
    if (!pos) return node;
    return { ...node, x: pos.x, y: pos.y, w: pos.w, h: pos.h };
  });
}

/* ═══════ 11. 主题切换 (Quantv light/dark) ═══════ */

export const CANVAS_THEMES = Object.freeze(['light', 'dark', 'auto']);

export function applyCanvasTheme(theme = 'auto', root = document?.documentElement) {
  if (!root) return;
  root.dataset.canvasTheme = theme;
  try {
    localStorage.setItem('da-ai-canvas:theme', theme);
  } catch (e) {
    // localStorage 不可用 (私密模式等), 静默失败
  }
}

export function loadCanvasTheme() {
  try {
    return localStorage.getItem('da-ai-canvas:theme') || 'auto';
  } catch (e) {
    return 'auto';
  }
}

/* ═══════ 12. 便签 (Quantv CanvasStickerLayer) ═══════ */

export const STICKER_COLORS = Object.freeze([
  { id: 'yellow', bg: 'rgba(255, 235, 59, 0.92)', text: '#1a1a1a' },
  { id: 'pink', bg: 'rgba(255, 138, 176, 0.92)', text: '#1a1a1a' },
  { id: 'blue', bg: 'rgba(100, 181, 246, 0.92)', text: '#0d1117' },
  { id: 'green', bg: 'rgba(129, 199, 132, 0.92)', text: '#0d1117' },
  { id: 'purple', bg: 'rgba(186, 104, 200, 0.92)', text: '#ffffff' },
]);

export function createCanvasSticker({ x = 0, y = 0, text = '', color = 'yellow', now = Date.now() } = {}) {
  return {
    id: `sticker_${now}`,
    kind: 'sticker',
    x: Math.round(x),
    y: Math.round(y),
    w: 200,
    h: 140,
    text: text || '便签',
    color,
    rotation: 0,
    zIndex: 1000,
  };
}

/* ═══════ 13. 节点缩略图色 (按 kind) - 用于小地图 ═══════ */

export const NODE_KIND_COLORS = Object.freeze({
  text: '#FFE66D',
  image: '#4ECDC4',
  output: '#4ECDC4',
  video: '#FF6B6B',
  audio: '#A78BFA',
  application: '#FFA500',
  source_group: '#94A3B8',
  'layer-group': '#94A3B8',
  'image-composer': '#06B6D4',
  'text-composer': '#FFE66D',
  'video-composer': '#FF6B6B',
  'suite-composer': '#F97316',
  'smart-remix': '#EC4899',
  'layer-workbench': '#10B981',
  'remove-bg': '#22C55E',
  extend: '#3B82F6',
  inpaint: '#8B5CF6',
  translate: '#F59E0B',
  upscale: '#0EA5E9',
  sticker: '#FACC15',
});

export function getNodeKindColor(kind = '') {
  return NODE_KIND_COLORS[kind] || '#888888';
}

/* ═══════ 14. 导出 JSON schema (Quantv __canvas: 'da-ai-canvas', version: 2) ═══════ */

export const CANVAS_EXPORT_VERSION = 2;
export const CANVAS_EXPORT_TAG = 'da-ai-canvas';

export function exportCanvasToJSON({ nodes = [], connections = [], stickers = [], meta = {} } = {}) {
  return {
    __canvas: CANVAS_EXPORT_TAG,
    version: CANVAS_EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    meta,
    nodes: nodes.map(n => ({
      id: n.id,
      kind: n.kind,
      name: n.name || n.displayLabel || '',
      x: n.x, y: n.y, w: n.w, h: n.h,
      url: n.url || '',
      ...(n.meta && { meta: n.meta }),
    })),
    edges: connections.map(c => ({
      id: c.id,
      from: c.fromNodeId || c.from,
      to: c.toNodeId || c.to,
      type: c.relation || c.type || 'reference',
    })),
    stickers,
  };
}

export function importCanvasFromJSON(json = {}) {
  if (json?.__canvas !== CANVAS_EXPORT_TAG) return null;
  return {
    nodes: Array.isArray(json.nodes) ? json.nodes : [],
    connections: Array.isArray(json.edges) ? json.edges.map(e => ({
      id: e.id,
      fromNodeId: e.from,
      toNodeId: e.to,
      relation: e.type || 'reference',
      from: e.from,
      to: e.to,
      type: e.type || 'reference',
    })) : [],
    stickers: Array.isArray(json.stickers) ? json.stickers : [],
  };
}

/* ═══════ 15. 应用节点 kind 列表 (Quantv §1.2 app) ═══════ */

export const APPLICATION_NODE_KINDS = Object.freeze([
  'application-1click-suite',
  'application-1click-video',
  'application-tts',
  'application-caption',
]);

export function isApplicationNode(node = {}) {
  return APPLICATION_NODE_KINDS.includes(node.actionId) || APPLICATION_NODE_KINDS.includes(node.kind) || node.kind === 'application';
}

/* ═══════ 16. 估算节点积分消耗 (Quantv §10.3 节点底部 ✗ 预计 X.XX 积分) ═══════ */
/* ═══ 批 CY-㉒ 修：这张表与 `canvasBillingModel.ACTIONS` 有 6 个键同名，数值却差了 5~10 倍 ══
   后果不是"估高一点无所谓"，而是**同一个功能在两个界面报两个价**：
     · 点动作前看到的价格  来自 ACTIONS（计费表）—— 这才是真会扣的钱
     · 右面板「预计消耗」     来自本表
     · 整链运行「预计积分」   来自本表（buildRunPlan 的 costOf）
   用户看到的与被扣的相差 10 倍 —— 正是他反复报的「看着是 A、跑的是 B」。

   哪个数是真的？我 SSH 上生产读了 `server/billing/catalog.mjs` 的线上单价：
     ec_image_2k=1000 units, ec_image_4k=2000, ec_remove_bg=500,
     ec_smart_layer=3000, ec_reverse_prompt=200, ec_canvas_ocr=200  ⇒ 1 积分 = 1000 units
   代入计费表全部对得上 ⇒ **计费表是对的，这张表是错的**。
   同名的 6 个键已按计费表改正（含两条"展示价含前置识别"的口径：
     remove-bg 0.7 = 识别 0.2 + 抠图 0.5；layer-edit 3.2 = 识别 0.2 + 分层 3.0）。

   ⚠️ 下面这些**按节点 kind** 给的档（output / video / audio / application-* / *-composer）
      是 Quantv §10.3 的产品定价，不走服务端 sku，所以与服务端 catalog **没有对应关系** ——
      那是两类东西，别拿它们去和 catalog 比。门禁只对「与计费表同名的键」要求一致。 */
export const NODE_COST_ESTIMATES = Object.freeze({
  text: 0,
  image: 0,           // 上传免费
  output: 8,
  video: 32,
  audio: 5,
  application: 15,
  'application-1click-suite': 15,
  'application-1click-video': 40,
  'application-tts': 8,
  'application-caption': 5,
  /* ↓↓ 以下 6 个与 canvasBillingModel.ACTIONS 同名 —— 数值必须与计费表逐值一致 ↓↓ */
  'smart-remix': 1,
  'remove-bg': 0.7,
  extend: 1,
  inpaint: 1,
  translate: 1,
  upscale: 1,
  /* ↑↑ 同名区结束 ↑↑ —— 改动请连同 test/node-cost-tables-0929.test.mjs 一起看 */
  /* ⚠️ `layer-workbench` 与计费表的 `layer-edit` **是两个不同的键**（不在同名区）——
     它按节点 kind 计价，没有对应 sku，所以**不能**照抄 3.2，那是猜的。保持原值。 */
  'image-composer': 10,
  'text-composer': 5,
  'video-composer': 32,
  'suite-composer': 30,
});

export function estimateNodeCost(node = {}) {
  const actionId = node.actionId || node.kind;
  return NODE_COST_ESTIMATES[actionId] || NODE_COST_ESTIMATES[node.kind] || 0;
}

/* ═══════ 17. 画布快捷键清单 (Quantv Qoe 全量) ═══════
   2026-10-02：这份清单以前**在骗人** —— 它宣传的六条里，绑定要么根本不存在、
   要么是死的：
     · Ctrl+D「复制选中节点」：被更早的「Ctrl+D = 取消全选」分支完全遮住，从未生效；
     · Ctrl+Shift+Z「重做」：撤销栈从来没被 push 过 ⇒ 整条撤销/重做都是死的；
     · Ctrl+S「手动保存」：只 setTimeout(220) 就宣称"已保存"，零 I/O；
     · Shift+滚轮「水平滚动」：宣传了但没实现（滚轮只会缩放）；
     · Ctrl+滚轮「缩放画布」：没有这个区分逻辑；
     · 「粘贴节点到鼠标位置」：实际是"粘贴到原位 + 固定 36px 偏移"，与鼠标无关。
   两条路同时修：**要么真做，要么别宣传**。这一批全做了（见 index.jsx 的键盘处理），
   剩下的差异也照实改文案 —— 清单是给用户看的，不能有假。 */
export const CANVAS_SHORTCUTS = Object.freeze([
  { id: 'select-all', keys: ['Ctrl+A', 'Cmd+A'], description: '全选画布上的所有节点（隐藏的不算）' },
  { id: 'copy', keys: ['Ctrl+C', 'Cmd+C'], description: '复制选中节点到剪贴板（在输入框里则是复制文字）' },
  { id: 'paste', keys: ['Ctrl+V', 'Cmd+V'], description: '粘贴节点（偏移 36px，避开原位）' },
  { id: 'duplicate', keys: ['Ctrl+D', 'Cmd+D'], description: '原地复制一份选中节点' },
  { id: 'undo', keys: ['Ctrl+Z', 'Cmd+Z'], description: '撤销上一步（拖动按"一次手势"记一步）' },
  { id: 'redo', keys: ['Ctrl+Shift+Z', 'Cmd+Shift+Z'], description: '重做' },
  { id: 'group', keys: ['Ctrl+G', 'Cmd+G'], description: '打组 (选中 ≥ 2 节点)' },
  { id: 'ungroup', keys: ['Ctrl+Shift+G', 'Cmd+Shift+G'], description: '取消分组' },
  { id: 'delete', keys: ['Delete', 'Backspace'], description: '删除选中内容（选中连线时优先删线）' },
  { id: 'escape', keys: ['Escape'], description: '关闭菜单/弹窗/取消选中' },
  { id: 'fit-view', keys: ['F'], description: '适配视口到所有节点' },
  { id: 'zoom-in', keys: ['Ctrl++', 'Ctrl+=', 'Cmd++'], description: '放大（以视口中心为锚）' },
  { id: 'zoom-out', keys: ['Ctrl+-', 'Cmd+-'], description: '缩小（以视口中心为锚）' },
  { id: 'zoom-reset', keys: ['Ctrl+0', 'Cmd+0'], description: '缩放回到 100%' },
  { id: 'zoom-wheel', keys: ['滚轮', 'Ctrl+滚轮（触控板捏合）'], description: '缩放画布（以鼠标位置为锚）' },
  { id: 'pan-h', keys: ['Shift+滚轮'], description: '水平滚动画布' },
  { id: 'add-text', keys: ['T'], description: '添加可编辑文本对象' },
  { id: 'hand-tool', keys: ['Space (按住)'], description: '抓手工具 (平移画布)' },
  { id: 'multi-select', keys: ['Shift (按住)'], description: '多选模式' },
  { id: 'arrow-keys', keys: ['↑ ↓ ← →'], description: '微调选中节点 (Shift = 10px)' },
  { id: 'save', keys: ['Ctrl+S', 'Cmd+S'], description: '立即保存画布到服务器' },
  { id: 'help', keys: ['?'], description: '显示快捷键面板' },
]);

/* ═══════ 18. 节点右键菜单 (Quantv handleNodeAction 11 项) ═══════ */

export const NODE_RIGHT_CLICK_ACTIONS = Object.freeze([
  { id: 'focus', label: '聚焦节点', icon: 'crosshair', kind: ['text', 'image', 'video', 'audio', 'application'] },
  { id: 'preview', label: '打开预览', icon: 'eye', kind: ['image', 'video', 'audio'] },
  { id: 'generate-image', label: '生成图片', icon: 'image-plus', kind: ['text', 'image', 'application'] },
  { id: 'generate-video', label: '生成视频', icon: 'film', kind: ['text', 'image', 'video', 'application'] },
  { id: 'analyze', label: '图片分析', icon: 'search', kind: ['image', 'video'] },
  { id: 'workspace', label: '图片工作台', icon: 'crop', kind: ['image', 'video'] },
  { id: 'download', label: '下载素材', icon: 'download', kind: ['image', 'video', 'audio'] },
  { id: 'add-asset', label: '加入资产库', icon: 'folder-plus', kind: ['image', 'video', 'audio'] },
  { id: 'rename', label: '重命名', icon: 'edit-3', kind: ['text', 'image', 'video', 'audio', 'application'] },
  { id: 'duplicate', label: '创建副本', icon: 'copy', kind: ['text', 'image', 'video', 'audio', 'application'] },
  { id: 'delete', label: '删除', icon: 'trash-2', kind: ['text', 'image', 'video', 'audio', 'application'], danger: true },
]);

/* ═══════ 19. 画布右键菜单 (Quantv CanvasMenus.contextPoint) ═══════ */

export const CANVAS_RIGHT_CLICK_ACTIONS = Object.freeze([
  { id: 'add-text', label: '添加文本节点', icon: 'type', group: 'add' },
  { id: 'add-image', label: '上传图片', icon: 'image', group: 'add' },
  { id: 'add-video', label: '上传视频', icon: 'film', group: 'add' },
  { id: 'add-audio', label: '上传音频', icon: 'music', group: 'add' },
  { id: 'from-asset-library', label: '从资产库选择', icon: 'folder', group: 'add' },
  { id: 'paste', label: '粘贴', icon: 'clipboard', shortcut: 'Ctrl+V', group: 'edit' },
  { id: 'undo', label: '撤销', icon: 'undo', shortcut: 'Ctrl+Z', group: 'edit' },
  { id: 'redo', label: '重做', icon: 'redo', shortcut: 'Ctrl+Shift+Z', group: 'edit' },
  { id: 'select-all', label: '全选', icon: 'check-square', shortcut: 'Ctrl+A', group: 'edit' },
  { id: 'fit-view', label: '适配视口', icon: 'maximize', shortcut: 'F', group: 'view' },
  { id: 'auto-arrange', label: '自动排版', icon: 'layout-grid', group: 'view' },
  { id: 'toggle-snap', label: '网格吸附', icon: 'grid', group: 'view' },
  { id: 'toggle-theme', label: '切换主题', icon: 'sun', group: 'view' },
]);

/* ═══════ 20. 端口吸力检测 ═══════ */

export const PORT_SNAP_DISTANCE = 24;  // px
export const PORT_SNAP_DISTANCE_SQUARED = PORT_SNAP_DISTANCE * PORT_SNAP_DISTANCE;

export function findNearestPort(point = {}, ports = []) {
  let best = null;
  let bestDist = PORT_SNAP_DISTANCE_SQUARED;
  for (const port of ports) {
    const dx = port.x - point.x;
    const dy = port.y - point.y;
    const dist = dx * dx + dy * dy;
    if (dist < bestDist) {
      bestDist = dist;
      best = port;
    }
  }
  return best;
}
