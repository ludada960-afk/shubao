const MIN_NODE_WIDTH = 160;
const MAX_NODE_WIDTH = 960;

function finite(value, fallback = 0) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

export function ratioValue(ratio, fallback = 1) {
  const match = String(ratio || '').match(/^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/);
  if (!match) return fallback;
  const width = Number(match[1]);
  const height = Number(match[2]);
  return width > 0 && height > 0 ? width / height : fallback;
}

export function getCanvasNodePresentation({ selected = false, hovered = false, focusActive = false, related = false } = {}) {
  return {
    state: selected ? 'selected' : hovered ? 'hovered' : 'idle',
    dimmed: Boolean(focusActive && !selected && !related),
    handlesVisible: Boolean(selected || hovered),
  };
}

export function resizeCanvasNode(node = {}, { width } = {}) {
  const currentWidth = Math.max(1, finite(node.w, MIN_NODE_WIDTH));
  const currentHeight = Math.max(1, finite(node.h, currentWidth));
  const aspect = ratioValue(node.ratio, currentWidth / currentHeight);
  const nextWidth = Math.round(Math.min(MAX_NODE_WIDTH, Math.max(MIN_NODE_WIDTH, finite(width, currentWidth))));
  return {
    ...node,
    w: nextWidth,
    h: Math.round(nextWidth / Math.max(0.01, aspect)),
  };
}

export function createCanvasTextNode({ x = 0, y = 0, sourceNodeId = '', now = Date.now() } = {}) {
  return {
    id: `text_${now}`,
    kind: 'text',
    x: finite(x),
    y: finite(y),
    w: 420,
    h: 180,
    text: '',
    placeholder: '输入标题、卖点或生成要求',
    sourceNodeIds: sourceNodeId ? [sourceNodeId] : [],
    status: 'ready',
  };
}
