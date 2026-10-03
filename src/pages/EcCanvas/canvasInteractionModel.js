import { selectDeliverableNodes } from './canvasAssetProvenance.js';
import { isLongDetailCandidate } from './detailCompositionModel.js';
/* 整卡占位（含 footer）的唯一口径 —— 组框/多选框都必须按它算，否则框比卡片矮一截。 */
import { canvasNodeFootprint } from './canvasMediaFitModel.js';

const VIEWPORT_GUTTER = 12;
const PANEL_GAP = 13;

/* 引用当前素材生成 9 个动作 (4c183cd4 续命 画布中央 + 右侧'引用当前素材生成'深度重构 v2)
   - 5 原有 全部保留 (text-generation / image-edit / ecommerce-suite / video-upload / video-generation)
     用户 8-29 原话: "你看了吗? 你看我们现在线上的这个版本, 这些功能都是要保留的, 只是之前其中几个功能做的不够好"
   - 4 新增 (流影AI LibTV Agent 风格, 用户硬性指定):
     1-click 套图 (5 宫格) / 1-click 视频模板 (4 步 chain) / TTS 配音 (5 provider) / 字幕动效 (弹出/淡入/逐字)
   - group 字段: 'core' (核心常用) / 'magic' (流影AI 智能)
   - 排序按: core 先, magic 后 — 用户认知路径, 资深美工+产品经理视角 */
export const CANVAS_CREATION_OPTIONS = Object.freeze([
  /* ── core 核心常用 (5 原有, 用户硬性要求保留) ── */
  Object.freeze({ id: 'text-generation', label: '生成文案', description: '从当前商品图提炼卖点和电商文案', group: 'core' }),
  Object.freeze({ id: 'image-edit', label: '图片生成', description: '按新的画面要求编辑或生成图片', group: 'core' }),
  Object.freeze({ id: 'ecommerce-suite', label: '电商套图', description: '用当前商品继续生成完整套图', group: 'core' }),
  Object.freeze({ id: 'video-upload', label: '上传视频', description: '把现有视频加入画布继续创作', group: 'core' }),
  Object.freeze({ id: 'video-generation', label: '生成视频', description: '用当前图片或视频生成营销成片', priceLabel: '32积分起', group: 'core' }),
  /* ── audio 音频与字幕 (只对视频节点开放, 用户 9-04 反馈:
     1-click 套图/1-click 视频 与 core 5 项重复 → 移除;
     图片节点上出现 TTS 配音很奇怪 → 只有视频节点才显示这组) ── */
  Object.freeze({ id: 'application-tts', label: 'TTS 配音', description: '给视频配旁白音轨 (5 家供应商可选)', priceLabel: '8积分', group: 'audio', videoOnly: true }),
  Object.freeze({ id: 'application-caption', label: '字幕动效', description: '智能字幕排版 + 弹出/淡入/逐字动画', priceLabel: '5积分', group: 'audio', videoOnly: true }),
]);

export const MULTI_SELECTION_ACTIONS = Object.freeze([
  /* 2026-10-02：原来只有「左/垂直居中/右」三条，且中间那条的 label 写的是
     「垂直居中」而它算的其实是**水平**居中（`x = bounds.x + (w - node.w)/2`）——
     标签与行为对不上，用户按���「垂直居中」结果发现图是横着排的。
     现在补齐六向（业界六件套：左/水平居中/右 + 顶/垂直居中/底），
     并把 label 改成与行为一致的说法。 */
  Object.freeze({ id: 'align-left', label: '左对齐' }),
  Object.freeze({ id: 'align-center', label: '水平居中' }),
  Object.freeze({ id: 'align-right', label: '右对齐' }),
  Object.freeze({ id: 'align-top', label: '顶对齐' }),
  Object.freeze({ id: 'align-middle', label: '垂直居中' }),
  Object.freeze({ id: 'align-bottom', label: '底对齐' }),
  Object.freeze({ id: 'distribute-h', label: '水平等距', needsSelection: 3 }),
  Object.freeze({ id: 'distribute-v', label: '垂直等距', needsSelection: 3 }),
  Object.freeze({ id: 'auto-layout', label: '自动排版' }),
  /* 9-16 用户批注（图15~19）：打组与绑定元素原来是**同一套逻辑**（只差一个 bound 布尔），
     既不能取消、按钮也不高亮。现在两者语义彻底分开：
       · 打组 = 形成一个**组容器**（组框样式与普通选中不同，组内节点不显示左右加号），
                组内节点一起移动、一起选中；
       · 绑定元素 = 只是「一起移动」的关联，不形成组容器、不画组框、组内节点保留加号。
     两者都可再次点击**解除**（按钮高亮表示当前选中已处于该状态）。 */
  Object.freeze({ id: 'bind-elements', label: '绑定元素', toggles: 'bind' }),
  Object.freeze({ id: 'group-elements', label: '打组', toggles: 'group' }),
  Object.freeze({ id: 'export-selection', label: '导出' }),
  Object.freeze({ id: 'stitch-details', label: '合成长图' }),
  Object.freeze({ id: 'delete-selection', label: '删除' }),
]);

/* 组容器 id 语义：#group_<ts> = 打组容器；#bind_<ts> = 绑定关联。
   以 id 前缀而不是节点上的布尔字段来判断，保证两者永远不会互相冒充。 */
export const CANVAS_GROUP_PREFIX = '#group_';
export const CANVAS_BIND_PREFIX = '#bind_';
export const CANVAS_GROUP_GAP = 22;   /* 组框在节点外包一圈的呼吸感（用户：四周留呼吸感） */

export function canvasGroupKindOf(groupId = '') {
  const value = String(groupId || '');
  if (value.startsWith(CANVAS_GROUP_PREFIX)) return 'group';
  if (value.startsWith(CANVAS_BIND_PREFIX)) return 'bind';
  return '';
}

export function canvasNodeGroupKind(node = {}) {
  return canvasGroupKindOf(node?.groupId);
}

/** 选中集合当前的打组/绑定状态，供多选工具栏高亮与「再点一次解除」使用。 */
export function canvasSelectionGroupState(nodes = [], selectedIds = new Set()) {
  const ids = selectedIds instanceof Set ? selectedIds : new Set(selectedIds || []);
  const selected = nodes.filter(node => ids.has(node.id));
  if (selected.length < 2) return { groupId: '', kind: '' };
  const groupId = String(selected[0]?.groupId || '');
  if (!groupId) return { groupId: '', kind: '' };
  /* 只有当**选中的每个节点**都在同一个组里才认为处于该状态 */
  if (!selected.every(node => String(node.groupId || '') === groupId)) return { groupId: '', kind: '' };
  return { groupId, kind: canvasGroupKindOf(groupId) };
}

/** 组框：把组内节点外包一圈（含四周呼吸感），供画布渲染组容器用。 */
export function canvasGroupBounds(nodes = [], groupId = '', gap = CANVAS_GROUP_GAP) {
  const members = nodes.filter(node => node && node.groupId === groupId && node.hidden !== true);
  if (members.length < 2) return null;
  /* 2026-10-02：原来用裸 node.h（只有媒体本体），于是组框**永远盖不住 footer** ——
     组框比实际卡片矮一截，看起来像「框没框全」。改走 footprint（整卡口径）。 */
  const boxes = members.map(canvasNodeFootprint).filter(Boolean);
  const left = Math.min(...boxes.map(box => box.x));
  const top = Math.min(...boxes.map(box => box.y));
  const right = Math.max(...boxes.map(box => box.x + box.w));
  const bottom = Math.max(...boxes.map(box => box.y + box.h));
  return {
    x: roundCoordinate(left - gap),
    y: roundCoordinate(top - gap),
    w: roundCoordinate(right - left + gap * 2),
    h: roundCoordinate(bottom - top + gap * 2),
    count: members.length,
  };
}

/** 画布上所有需要渲染的组容器（打组 + 绑定各一种样式）。 */
export function canvasGroupFrames(nodes = []) {
  const ids = [...new Set(nodes.map(node => String(node?.groupId || '')).filter(Boolean))];
  return ids.map(groupId => {
    const bounds = canvasGroupBounds(nodes, groupId);
    if (!bounds) return null;
    return { groupId, kind: canvasGroupKindOf(groupId), bounds, memberIds: nodes.filter(node => node.groupId === groupId).map(node => node.id) };
  }).filter(Boolean);
}

/** 打组 / 绑定 / 解除：返回新的 nodes 数组（纯函数，可测）。 */
export function applyCanvasGroupAction(nodes = [], selectedIds = new Set(), actionId = '') {
  const ids = selectedIds instanceof Set ? selectedIds : new Set(selectedIds || []);
  const members = nodes.filter(node => ids.has(node.id));
  if (members.length < 2) return nodes;
  const state = canvasSelectionGroupState(nodes, ids);
  const wanted = actionId === 'bind-elements' ? 'bind' : 'group';
  const clearing = state.kind === wanted;
  /* 已是该状态 → 再点一次解除（用户批注：不能取消） */
  if (clearing) return nodes.map(node => (ids.has(node.id) ? { ...node, groupId: '' } : node));
  const prefix = wanted === 'bind' ? CANVAS_BIND_PREFIX : CANVAS_GROUP_PREFIX;
  /* 换组时把原来同组、这次没选中的成员一起带过来，避免出现半个组 */
  const previous = state.groupId
    ? new Set(nodes.filter(node => node.groupId === state.groupId).map(node => node.id))
    : new Set();
  const nextGroupId = `${prefix}${Date.now()}`;
  return nodes.map(node => (ids.has(node.id) || previous.has(node.id) ? { ...node, groupId: nextGroupId } : node));
}

/** 拖动一个节点时，同组/同绑定关系的节点一起移动（打组与绑定在“一起移动”这一点上一致）。 */
export function expandCanvasGroupDragIds(nodes = [], nodeId = '') {
  const node = nodes.find(candidate => candidate.id === nodeId);
  const groupId = String(node?.groupId || '');
  if (!groupId) return new Set();
  return new Set(nodes.filter(candidate => candidate.groupId === groupId).map(candidate => candidate.id));
}

function isExportableCanvasImage(node = {}) {
  if (!node.url) return false;
  if (node.kind === 'output') return ['ready', 'success', 'completed'].includes(node.status);
  return node.kind === 'image' && ['ready', 'success', 'completed'].includes(node.status);
}

export function multiSelectionActionsForNodes(nodes = [], selectedIds = new Set()) {
  const ids = selectedIds instanceof Set ? selectedIds : new Set(selectedIds || []);
  const selected = nodes.filter(node => ids.has(node.id));
  const imageOnly = selected.length >= 2 && selected.every(isExportableCanvasImage);
  const { deliverables } = selectDeliverableNodes(nodes, ids);
  const detailCount = deliverables.filter(isLongDetailCandidate).length;
  return MULTI_SELECTION_ACTIONS.filter(action => {
    if (action.id === 'export-selection') return imageOnly && deliverables.length > 0;
    if (action.id === 'stitch-details') return detailCount >= 2;
    return true;
  });
}

function finite(value, fallback = 0) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function roundCoordinate(value) {
  return Math.round(value * 100) / 100;
}

export function getCanvasFocusIds(hoveredNodeId, connections = []) {
  const hovered = String(hoveredNodeId || '');
  if (!hovered) return new Set();
  const focused = new Set([hovered]);
  connections.forEach(connection => {
    const fromId = String(connection?.fromNodeId || connection?.from || '');
    const toId = String(connection?.toNodeId || connection?.to || '');
    if (fromId === hovered && toId) focused.add(toId);
    if (toId === hovered && fromId) focused.add(fromId);
  });
  return focused;
}

export function isCanvasConnectionVisible(connection = {}, nodes = []) {
  const fromId = connection.fromNodeId || connection.from;
  const toId = connection.toNodeId || connection.to;
  const from = nodes.find(node => node.id === fromId);
  const to = nodes.find(node => node.id === toId);
  return Boolean(from && to && !from.hidden && !to.hidden);
}

export function replaceCanvasNodeWithLayerResult({
  nodes = [],
  connections = [],
  sourceNodeId,
  pendingNodeId,
  groupNode,
  childNodes = [],
  resultConnections = [],
} = {}) {
  const removedIds = new Set([sourceNodeId, pendingNodeId].filter(Boolean));
  const retainedNodes = nodes.filter(node => !removedIds.has(node?.id));
  const replacementId = groupNode?.id;
  const retainedConnections = connections.flatMap(connection => {
    const fromId = connection?.fromNodeId || connection?.from;
    const toId = connection?.toNodeId || connection?.to;
    if (fromId === pendingNodeId || toId === pendingNodeId) return [];
    if (fromId !== sourceNodeId && toId !== sourceNodeId) return [connection];
    if (!replacementId) return [];
    return [{
      ...connection,
      ...(fromId === sourceNodeId ? {
        fromNodeId: replacementId,
        ...(Object.hasOwn(connection, 'from') ? { from: replacementId } : {}),
      } : {}),
      ...(toId === sourceNodeId ? {
        toNodeId: replacementId,
        ...(Object.hasOwn(connection, 'to') ? { to: replacementId } : {}),
      } : {}),
    }];
  });
  return {
    nodes: [...retainedNodes, groupNode, ...childNodes].filter(Boolean),
    connections: [...retainedConnections, ...resultConnections],
  };
}

export function expandCanvasLayerGroup(nodes = [], groupNodeId) {
  return nodes.map(node => {
    if (node?.id === groupNodeId) return { ...node, layerExpanded: true, hidden: true };
    if (node?.parentLayerGroupId === groupNodeId) return { ...node, hidden: false };
    return node;
  });
}

export function getContextMenuPosition({
  x,
  y,
  viewportWidth,
  viewportHeight,
  width = 240,
  height = 360,
  gutter = VIEWPORT_GUTTER,
} = {}) {
  const maxX = Math.max(gutter, finite(viewportWidth) - finite(width, 240) - gutter);
  const maxY = Math.max(gutter, finite(viewportHeight) - finite(height, 360) - gutter);
  return {
    x: Math.min(maxX, Math.max(gutter, finite(x))),
    y: Math.min(maxY, Math.max(gutter, finite(y))),
  };
}

export function getContextPanelPosition({ node = {}, viewport = {}, bounds = {}, panel = {} } = {}) {
  const panelWidth = finite(panel.width, 520);
  const centeredX = finite(node.x) + finite(node.w, 230) / 2 - panelWidth / 2;
  const belowY = finite(node.y) + finite(node.h, 230) + PANEL_GAP;
  return {
    left: roundCoordinate(centeredX),
    top: roundCoordinate(belowY),
    width: panelWidth,
    placement: 'below',
  };
}

/**
 * 选中工具条的定位。
 *
 * ⚠️⚠️ 批 CY-㉔ 修：这里原来有一处**单位不对称**，是用户 2026-09-28 报的
 * 「工具条左边被裁掉一截」（自己账号实测，截图 zoom=39%）的真正根因。
 *
 * 背景（先说清楚坐标系，否则这段注释没人看得懂）：
 *   · 工具条渲染在**内容层**里 —— 那个 div 带 `transform: scale(s)`，
 *     而工具条自己带 `transform: … scale(var(--canvas-overlay-scale))`，
 *     那个变量 = `1/s`（index.jsx 在内容层上内联注入）⇒ **两级缩放互相抵消**，
 *     工具条在屏幕上恒定大小（这是设计意图：缩放画布时工具条不该跟着变大变小）。
 *   · 所以工具条的**屏幕宽度就是它的 CSS 宽度**（`offsetWidth` / `getBoundingClientRect().width`
 *     在这里**相等**，两者都不是 bug）。
 *   · 但 `left/top` 是**世界坐标**（内容层被 scale 之后的世界坐标系）。
 *
 * 于是：`width`/`height` 是**屏幕像素**，而 `visibleLeft/visibleRight` 是**世界坐标**。
 * 算它在世界里占多宽，必须 `width / scale`。
 *
 * 原来的代码：**高度除了、宽度没除**
 *     centeredX  = … toolbarWidth / 2 …   ← toolbarWidth 是屏幕像素，直接当世界坐标用了
 *     belowBottom = … toolbarHeight / scale … ← 高度是对的，除了
 * ⇒ 缩放越小错得越离谱：39% 时工具条真实占 1230 屏幕像素 = 3154 世界单位，
 *   而 clamp 只当它占 1230 ⇒ 少算了 1924 ⇒ 左边有 ~375 屏幕像素甩到视口外，
 *   **再被内容层的 `overflow: clip` 一刀切掉** —— 就是截图里「图层」被削掉半截。
 *   100% 缩放时 `/scale` 恰好等于 1，所以**这个 bug 在 100% 下完全看不出来**，
 *   这正是它一直没被发现、而用户说「应该是非常普遍的 bug」的原因。
 */
export function getCanvasToolbarPosition({ node = {}, viewport = {}, bounds = {}, width = 520, height = 50 } = {}) {
  const scale = Math.max(0.01, finite(viewport.scale, 1));
  const viewportWidth = finite(bounds.width, 1440);
  const viewportHeight = finite(bounds.height, 900);
  const gutter = 12 / scale;
  /* 屏幕像素 → 世界坐标（与下面 toolbarHeight 的处理保持同一口径）。
     CSS 上限是 `max-width: min(820px, 86vw)`，这里一并兜住，免得算出比视口还宽的位置。 */
  const screenWidth = Math.min(Math.max(180, finite(width, 520)), 820, Math.max(180, viewportWidth * 0.86));
  const toolbarWidth = Math.min(screenWidth / scale, Math.max(180, viewportWidth / scale - gutter * 2));
  const toolbarHeight = Math.max(36, finite(height, 50));
  const visibleLeft = -finite(viewport.x) / scale + gutter;
  const visibleTop = -finite(viewport.y) / scale + gutter;
  const visibleRight = (viewportWidth - finite(viewport.x)) / scale - gutter;
  const visibleBottom = (viewportHeight - finite(viewport.y)) / scale - gutter;
  const anchorX = finite(node.x) + Math.max(1, finite(node.w, 1)) / 2;
  const centeredX = Math.min(visibleRight - toolbarWidth / 2, Math.max(visibleLeft + toolbarWidth / 2, anchorX));
  const aboveBottom = finite(node.y) - 14;
  const belowBottom = finite(node.y) + Math.max(1, finite(node.h, 1)) + 14 + toolbarHeight / scale;
  const aboveTop = aboveBottom - toolbarHeight / scale;
  const preferredBottom = aboveTop >= visibleTop ? aboveBottom : belowBottom;
  const minBottom = visibleTop + toolbarHeight / scale;
  const maxBottom = visibleBottom + toolbarHeight / scale;
  return {
    left: roundCoordinate(centeredX),
    top: roundCoordinate(Math.min(maxBottom, Math.max(minBottom, preferredBottom))),
  };
}

export function moveCanvasNodes(nodes = [], selectedIds = new Set(), delta = {}) {
  const ids = selectedIds instanceof Set ? selectedIds : new Set(selectedIds || []);
  const dx = finite(delta.x);
  const dy = finite(delta.y);
  return nodes.map(node => ids.has(node.id)
    ? { ...node, x: finite(node.x) + dx, y: finite(node.y) + dy }
    : node);
}

export function expandCanvasDragSelection(nodes = [], activeNodeId, selectedIds = new Set()) {
  const ids = selectedIds instanceof Set ? new Set(selectedIds) : new Set(selectedIds || []);
  const activeNode = nodes.find(node => node.id === activeNodeId);
  if (!activeNode?.groupId || ids.size > 1) return ids;
  nodes.forEach(node => {
    if (node.groupId === activeNode.groupId) ids.add(node.id);
  });
  return ids;
}

export function pickCanvasLayerAtPoint(nodes = [], sourceNodeId, point = {}) {
  const source = nodes.find(node => node?.id === sourceNodeId && node?.kind === 'layer-group');
  if (!source) return null;
  const childIds = new Set(Array.isArray(source.layerChildIds) ? source.layerChildIds : []);
  const x = finite(point.x, Number.NaN);
  const y = finite(point.y, Number.NaN);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  const priority = node => node.kind === 'text' || node.semanticType === 'text'
    ? 3
    : node.semanticType === 'product-group' ? 2
      : node.semanticType === 'background' ? 0 : 1;
  return nodes
    .filter(node => childIds.has(node?.id) || node?.parentLayerGroupId === sourceNodeId)
    .filter(node => x >= finite(node.x)
      && x <= finite(node.x) + Math.max(1, finite(node.w, 1))
      && y >= finite(node.y)
      && y <= finite(node.y) + Math.max(1, finite(node.h, 1)))
    .sort((a, b) => priority(b) - priority(a))[0] || null;
}

export function selectedCanvasBounds(nodes = [], selectedIds = new Set()) {
  const ids = selectedIds instanceof Set ? selectedIds : new Set(selectedIds || []);
  const selected = nodes.filter(node => ids.has(node.id));
  if (!selected.length) return null;
  /* 2026-10-02：与 canvasGroupBounds 同源 —— 多选工具栏的框也必须按**整卡**算，
     否则它比卡片矮 footer 一截（对齐/排版/导出范围都跟着偏）。 */
  const boxes = selected.map(canvasNodeFootprint).filter(Boolean);
  if (!boxes.length) return null;
  const left = Math.min(...boxes.map(box => box.x));
  const top = Math.min(...boxes.map(box => box.y));
  const right = Math.max(...boxes.map(box => box.x + box.w));
  const bottom = Math.max(...boxes.map(box => box.y + box.h));
  return { x: left, y: top, w: right - left, h: bottom - top };
}

export function applyMultiSelectionAction(nodes = [], selectedIds = new Set(), actionId, options = {}) {
  const ids = selectedIds instanceof Set ? selectedIds : new Set(selectedIds || []);
  const selected = nodes.filter(node => ids.has(node.id));
  if (selected.length < 2) return nodes;
  const bounds = selectedCanvasBounds(nodes, ids);
  if (actionId === 'auto-layout') {
    const gap = Math.max(0, finite(options.gap, 24));
    let cursor = bounds.x;
    const top = bounds.y;
    return nodes.map(node => {
      if (!ids.has(node.id)) return node;
      const next = { ...node, x: cursor, y: top };
      cursor += Math.max(1, finite(node.w, 1)) + gap;
      return next;
    });
  }
  /* 等距分布（Excalidraw `distribute.ts` / tldraw `alt+shift+H|V`）：
     保持首尾不动，中间那些按可用空隙**均分**。少于 3 个没有「中间」可言，直接不动作。 */
  if (actionId === 'distribute-h' || actionId === 'distribute-v') {
    if (selected.length < 3) return nodes;
    const horizontal = actionId === 'distribute-h';
    const positionOf = node => (horizontal ? finite(node.x) : finite(node.y));
    const sizeOf = node => Math.max(1, horizontal ? finite(node.w, 1) : finite(node.h, 1));
    const ordered = [...selected].sort((a, b) => positionOf(a) - positionOf(b));
    const first = ordered[0];
    const last = ordered[ordered.length - 1];
    const span = (positionOf(last) + sizeOf(last)) - positionOf(first);
    const totalSize = ordered.reduce((sum, node) => sum + sizeOf(node), 0);
    const gap = (span - totalSize) / (ordered.length - 1);
    if (!(gap > 0)) return nodes;
    const targetById = new Map();
    let cursor = positionOf(first);
    ordered.forEach(node => {
      targetById.set(node.id, cursor);
      cursor += sizeOf(node) + gap;
    });
    return nodes.map(node => {
      if (!targetById.has(node.id)) return node;
      return horizontal
        ? { ...node, x: targetById.get(node.id) }
        : { ...node, y: targetById.get(node.id) };
    });
  }
  return nodes.map(node => {
    if (!ids.has(node.id)) return node;
    if (actionId === 'align-left') return { ...node, x: bounds.x };
    if (actionId === 'align-center') return { ...node, x: bounds.x + (bounds.w - finite(node.w, 1)) / 2 };
    if (actionId === 'align-right') return { ...node, x: bounds.x + bounds.w - finite(node.w, 1) };
    /* 2026-10-02 补齐：纵向三条（原来是缺的，只能横着排） */
    if (actionId === 'align-top') return { ...node, y: bounds.y };
    if (actionId === 'align-middle') return { ...node, y: bounds.y + (bounds.h - finite(node.h, 1)) / 2 };
    if (actionId === 'align-bottom') return { ...node, y: bounds.y + bounds.h - finite(node.h, 1) };
    return node;
  });
}

export function shouldPersistCanvasMutation(kind) {
  return ['drag-end', 'create', 'delete', 'connect', 'edit'].includes(String(kind || ''));
}
