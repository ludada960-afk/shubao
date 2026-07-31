const VIEWPORT_GUTTER = 12;
const PANEL_GAP = 13;

export const CANVAS_CREATION_OPTIONS = Object.freeze([
  Object.freeze({ id: 'text-generation', label: '生成文案', description: '从当前商品图提炼卖点和电商文案' }),
  Object.freeze({ id: 'image-edit', label: '图片生成', description: '按新的画面要求编辑或生成图片' }),
  Object.freeze({ id: 'ecommerce-suite', label: '电商套图', description: '用当前商品继续生成完整套图' }),
]);

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
    x: roundCoordinate(x),
    y: roundCoordinate(y),
    width: panelWidth,
    placement,
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

export function shouldPersistCanvasMutation(kind) {
  return ['drag-end', 'create', 'delete', 'connect', 'edit'].includes(String(kind || ''));
}
