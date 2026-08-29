import { selectDeliverableNodes } from './canvasAssetProvenance.js';
import { isLongDetailCandidate } from './detailCompositionModel.js';

const VIEWPORT_GUTTER = 12;
const PANEL_GAP = 13;

/* 引用当前素材生成 14 个动作 (4c183cd4 续命 画布中央 + 右侧'引用当前素材生成'深度重构)
   - 5 原有 (text-generation / image-edit / ecommerce-suite / video-upload / video-generation)
   - 9 新增 (LibTV Agent 风格 + 流影AI 调研: 智能分镜 / 1-click 套图 / 1-click 视频 / TTS 配音 /
     字幕动效 / AI 抠图 / 滤镜调色 / 相似推荐 / 1-click 派生)
   - group 字段: 'core' (核心常用) / 'expand' (扩展) / 'magic' (智能/AI 黑魔法)
   - 排序按: core 先, magic 中, expand 后 — 资深美工+产品经理视角 */
export const CANVAS_CREATION_OPTIONS = Object.freeze([
  /* ── core 核心常用 (5 原有) ── */
  Object.freeze({ id: 'text-generation', label: '生成文案', description: '从当前商品图提炼卖点和电商文案', group: 'core' }),
  Object.freeze({ id: 'image-edit', label: '图片生成', description: '按新的画面要求编辑或生成图片', group: 'core' }),
  Object.freeze({ id: 'ecommerce-suite', label: '电商套图', description: '用当前商品继续生成完整套图', group: 'core' }),
  Object.freeze({ id: 'video-upload', label: '上传视频', description: '把现有视频加入画布继续创作', group: 'core' }),
  Object.freeze({ id: 'video-generation', label: '生成视频', description: '用当前图片或视频生成营销成片', priceLabel: '32积分起', group: 'core' }),
  /* ── magic 智能/AI (5 新增, LibTV + 流影AI 风格) ── */
  Object.freeze({ id: 'ai-storyboard', label: '智能分镜', description: '自动拆解画面为 6 段电影分镜 (Enclosure/Breakthrough/Framing…)', priceLabel: '18积分', group: 'magic' }),
  Object.freeze({ id: 'one-click-suite', label: '1-click 套图', description: '一键生成电商 5 宫格 (主图+场景+细节+白底+详情图)', priceLabel: '15积分', group: 'magic' }),
  Object.freeze({ id: 'tts-voiceover', label: 'TTS 配音', description: '5 家供应商 (火山/阿里云/ElevenLabs/Azure/MiniMax) 美式播客感', priceLabel: '8积分', group: 'magic' }),
  Object.freeze({ id: 'caption-motion', label: '字幕动效', description: '流影AI 风格字幕排版 + 弹出/淡入/逐字动画', priceLabel: '5积分', group: 'magic' }),
  Object.freeze({ id: 'similar-recommend', label: '相似推荐', description: '从作品库/公共模板找出最相似的 5 张图', group: 'magic' }),
  /* ── expand 扩展 (4 新增) ── */
  Object.freeze({ id: 'one-click-video', label: '1-click 视频模板', description: '流影AI 1-click 视频模板 (4 步: 文案→首帧→视频→音轨+字幕)', priceLabel: '40积分', group: 'expand' }),
  Object.freeze({ id: 'bg-removal', label: 'AI 抠图', description: '一键去背景生成透明 PNG 商品素材', priceLabel: '0.5积分', group: 'expand' }),
  Object.freeze({ id: 'color-grade', label: '滤镜调色', description: '12 套电商主流调色 (暖黄/冷蓝/高级灰/INS 风)', group: 'expand' }),
  Object.freeze({ id: 'derive-1click', label: '1-click 派生', description: '一键变风格/变角度/换模特, 沿用商品主体', priceLabel: '3积分', group: 'expand' }),
]);

export const MULTI_SELECTION_ACTIONS = Object.freeze([
  Object.freeze({ id: 'align-left', label: '左对齐' }),
  Object.freeze({ id: 'align-center', label: '垂直居中' }),
  Object.freeze({ id: 'align-right', label: '右对齐' }),
  Object.freeze({ id: 'auto-layout', label: '自动排版' }),
  Object.freeze({ id: 'bind-elements', label: '绑定元素' }),
  Object.freeze({ id: 'group-elements', label: '打组' }),
  Object.freeze({ id: 'export-selection', label: '导出' }),
  Object.freeze({ id: 'stitch-details', label: '合成长图' }),
  Object.freeze({ id: 'delete-selection', label: '删除' }),
]);

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

export function getCanvasToolbarPosition({ node = {}, viewport = {}, bounds = {}, width = 520, height = 50 } = {}) {
  const scale = Math.max(0.01, finite(viewport.scale, 1));
  const viewportWidth = finite(bounds.width, 1440);
  const viewportHeight = finite(bounds.height, 900);
  const gutter = 12 / scale;
  const toolbarWidth = Math.min(Math.max(180, finite(width, 520)), Math.max(180, viewportWidth / scale - gutter * 2));
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
  const left = Math.min(...selected.map(node => finite(node.x)));
  const top = Math.min(...selected.map(node => finite(node.y)));
  const right = Math.max(...selected.map(node => finite(node.x) + Math.max(1, finite(node.w, 1))));
  const bottom = Math.max(...selected.map(node => finite(node.y) + Math.max(1, finite(node.h, 1))));
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
  return nodes.map(node => {
    if (!ids.has(node.id)) return node;
    if (actionId === 'align-left') return { ...node, x: bounds.x };
    if (actionId === 'align-center') return { ...node, x: bounds.x + (bounds.w - finite(node.w, 1)) / 2 };
    if (actionId === 'align-right') return { ...node, x: bounds.x + bounds.w - finite(node.w, 1) };
    return node;
  });
}

export function shouldPersistCanvasMutation(kind) {
  return ['drag-end', 'create', 'delete', 'connect', 'edit'].includes(String(kind || ''));
}
