const VIEWPORT_GUTTER = 12;
const PANEL_GAP = 13;

export const CANVAS_CREATION_OPTIONS = Object.freeze([
  Object.freeze({ id: 'text-generation', label: '生成文案', description: '从当前商品图提炼卖点和电商文案' }),
  Object.freeze({ id: 'image-edit', label: '图片生成', description: '按新的画面要求编辑或生成图片' }),
  Object.freeze({ id: 'ecommerce-suite', label: '电商套图', description: '用当前商品继续生成完整套图' }),
]);

export const MULTI_SELECTION_ACTIONS = Object.freeze([
  Object.freeze({ id: 'align-left', label: '左对齐' }),
  Object.freeze({ id: 'align-center', label: '垂直居中' }),
  Object.freeze({ id: 'align-right', label: '右对齐' }),
  Object.freeze({ id: 'auto-layout', label: '自动排版' }),
  Object.freeze({ id: 'bind-elements', label: '绑定元素' }),
  Object.freeze({ id: 'group-elements', label: '打组' }),
  Object.freeze({ id: 'export-selection', label: '导出' }),
  Object.freeze({ id: 'merge-layers', label: '合并图层' }),
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
  return MULTI_SELECTION_ACTIONS.filter(action => {
    if (action.id === 'export-selection' || action.id === 'merge-layers') return imageOnly;
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
  const scale = Math.max(0.01, finite(viewport.scale, 1));
  const worldLeft = -finite(viewport.x) / scale;
  const worldTop = -finite(viewport.y) / scale;
  const worldRight = (finite(bounds.width, 1440) - finite(viewport.x)) / scale;
  const worldBottom = (finite(bounds.height, 900) - finite(viewport.y)) / scale;
  const panelWidth = finite(panel.width, 520);
  const panelHeight = finite(panel.height, 238);
  const gutter = VIEWPORT_GUTTER / scale;
  const centeredX = finite(node.x) + finite(node.w, 230) / 2 - panelWidth / 2;
  const x = Math.min(worldRight - panelWidth - gutter, Math.max(worldLeft + gutter, centeredX));
  const belowY = finite(node.y) + finite(node.h, 230) + PANEL_GAP;
  const canFitBelow = belowY + panelHeight <= worldBottom - gutter;
  const placement = canFitBelow ? 'below' : 'above';
  const targetY = canFitBelow ? belowY : finite(node.y) - panelHeight - PANEL_GAP;
  const y = Math.min(worldBottom - panelHeight - gutter, Math.max(worldTop + gutter, targetY));
  return {
    left: roundCoordinate(x),
    top: roundCoordinate(y),
    width: panelWidth,
    placement,
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
