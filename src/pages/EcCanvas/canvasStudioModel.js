const MIN_NODE_WIDTH = 160;
const MIN_NODE_HEIGHT = 56;
const MAX_NODE_WIDTH = 960;
const MAX_NODE_HEIGHT = 1200;

export const CANVAS_RATIO_OPTIONS = Object.freeze(['1:1', '3:4', '4:3', '9:16', '16:9']);
export const CANVAS_RESOLUTION_OPTIONS = Object.freeze(['1K', '2K', '4K']);
export const CANVAS_COUNT_OPTIONS = Object.freeze([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
export const CANVAS_SUITE_COUNT_OPTIONS = Object.freeze([3, 6, 9, 12]);

export function toggleCanvasComposerSurface(current = '', next = '') {
  return current === next ? '' : String(next || '');
}

export function closeCanvasComposerSurface() {
  return '';
}

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

export function getCanvasComposerPresentation({ node, selectedId = '', selectedCount = 1, width = 640, gap = 12 } = {}) {
  const visible = Boolean(node?.id && node.id === selectedId && Number(selectedCount) === 1);
  if (!visible) return { visible: false, position: null };
  const nodeWidth = Math.max(1, finite(node.w, width));
  const nodeHeight = Math.max(1, finite(node.h, 0));
  return {
    visible: true,
    position: {
      left: Math.round(finite(node.x) + (nodeWidth - width) / 2),
      top: Math.round(finite(node.y) + nodeHeight + gap),
      width: Math.round(width),
    },
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

function gridSize(value, fallback = 3) {
  return Math.min(5, Math.max(2, Math.round(finite(value, fallback))));
}

export function getGridGuidePositions(grid = 3, positions) {
  const count = gridSize(grid) - 1;
  if (Array.isArray(positions) && positions.length === count && positions.every(value => Number.isFinite(Number(value)))) {
    return positions.map(value => Math.min(1, Math.max(0, Number(value))));
  }
  return Array.from({ length: count }, (_, index) => (index + 1) / (count + 1));
}

export function moveGridGuide(positions = [], index, value, minGap = 0.08) {
  if (!Array.isArray(positions) || index < 0 || index >= positions.length) return Array.isArray(positions) ? [...positions] : [];
  const next = positions.map(item => Math.min(1, Math.max(0, finite(item))));
  const gap = Math.min(0.25, Math.max(0.02, finite(minGap, 0.08)));
  const lower = index === 0 ? gap : next[index - 1] + gap;
  const upper = index === next.length - 1 ? 1 - gap : next[index + 1] - gap;
  next[index] = Math.min(upper, Math.max(lower, finite(value, next[index])));
  return next;
}

export function resizeCanvasNodeByHandle(node = {}, {
  handle = 'se',
  dx = 0,
  dy = 0,
  preserveAspect = false,
  minWidth = MIN_NODE_WIDTH,
  minHeight = MIN_NODE_HEIGHT,
} = {}) {
  const original = {
    x: finite(node.x),
    y: finite(node.y),
    w: Math.max(1, finite(node.w, MIN_NODE_WIDTH)),
    h: Math.max(1, finite(node.h, MIN_NODE_HEIGHT)),
  };
  const horizontal = String(handle).includes('e') || String(handle).includes('w');
  const vertical = String(handle).includes('n') || String(handle).includes('s');
  const minW = Math.max(48, finite(minWidth, MIN_NODE_WIDTH));
  const minH = Math.max(32, finite(minHeight, MIN_NODE_HEIGHT));
  let left = original.x;
  let right = original.x + original.w;
  let top = original.y;
  let bottom = original.y + original.h;
  const moveX = finite(dx);
  const moveY = finite(dy);

  if (!preserveAspect) {
    if (String(handle).includes('w')) left = Math.min(right - minW, left + moveX);
    if (String(handle).includes('e')) right = Math.max(left + minW, right + moveX);
    if (String(handle).includes('n')) top = Math.min(bottom - minH, top + moveY);
    if (String(handle).includes('s')) bottom = Math.max(top + minH, bottom + moveY);
    return {
      ...node,
      x: Math.round(left),
      y: Math.round(top),
      w: Math.round(Math.min(MAX_NODE_WIDTH, Math.max(minW, right - left))),
      h: Math.round(Math.min(MAX_NODE_HEIGHT, Math.max(minH, bottom - top))),
    };
  }

  const aspect = Math.max(0.05, ratioValue(node.ratio, original.w / original.h));
  let nextW = original.w;
  let nextH = original.h;
  const widthCandidate = String(handle).includes('w')
    ? original.w - moveX
    : String(handle).includes('e') ? original.w + moveX : original.w;
  const heightCandidate = String(handle).includes('n')
    ? original.h - moveY
    : String(handle).includes('s') ? original.h + moveY : original.h;
  if (horizontal && vertical) {
    const widthTravel = Math.abs(widthCandidate - original.w) / Math.max(1, original.w);
    const heightTravel = Math.abs(heightCandidate - original.h) / Math.max(1, original.h);
    if (widthTravel >= heightTravel) {
      nextW = widthCandidate;
      nextH = nextW / aspect;
    } else {
      nextH = heightCandidate;
      nextW = nextH * aspect;
    }
  } else if (horizontal) {
    nextW = widthCandidate;
    nextH = nextW / aspect;
  } else if (vertical) {
    nextH = heightCandidate;
    nextW = nextH * aspect;
  }
  nextW = Math.min(MAX_NODE_WIDTH, Math.max(minW, nextW));
  nextH = Math.min(MAX_NODE_HEIGHT, Math.max(minH, nextH));
  if (String(handle).includes('w')) left = right - nextW;
  else if (String(handle).includes('e')) right = left + nextW;
  else {
    left = original.x;
    right = left + nextW;
  }
  if (String(handle).includes('n')) top = bottom - nextH;
  else if (String(handle).includes('s')) bottom = top + nextH;
  else {
    top = original.y;
    bottom = top + nextH;
  }
  return {
    ...node,
    x: Math.round(left),
    y: Math.round(top),
    w: Math.round(right - left),
    h: Math.round(bottom - top),
  };
}

export function applyCanvasMoveScale(node = {}, { scale = 1, offsetX = 0, offsetY = 0 } = {}) {
  const currentWidth = Math.max(1, finite(node.w, MIN_NODE_WIDTH));
  const next = resizeCanvasNode(node, { width: currentWidth * Math.min(2.5, Math.max(0.1, finite(scale, 1))) });
  return {
    ...next,
    x: finite(node.x) + finite(offsetX),
    y: finite(node.y) + finite(offsetY),
  };
}

export function createCanvasTextNode({ x = 0, y = 0, sourceNodeId = '', now = Date.now() } = {}) {
  return {
    id: `text_${now}`,
    kind: 'text',
    x: finite(x),
    y: finite(y),
    w: 420,
    h: 84,
    text: '双击编辑文字',
    placeholder: '双击编辑文字',
    sourceNodeIds: sourceNodeId ? [sourceNodeId] : [],
    status: 'ready',
    textStyle: {
      block: 'body',
      color: '#20242a',
      fontSize: 48,
      fontStyle: 'normal',
      fontWeight: 700,
      list: 'none',
      textAlign: 'left',
    },
  };
}

export function createCanvasImageComposerNode({ x = 0, y = 0, sourceNodeId = '', now = Date.now() } = {}) {
  return {
    id: `image_composer_${now}`,
    kind: 'image-composer',
    status: 'ready',
    x: finite(x),
    y: finite(y),
    w: 280,
    h: 280,
    prompt: '',
    ratio: '1:1',
    resolution: '2K',
    count: 1,
    sourceNodeIds: sourceNodeId ? [sourceNodeId] : [],
  };
}

export function createCanvasTextComposerNode({ x = 0, y = 0, sourceNodeId = '', now = Date.now() } = {}) {
  return {
    id: `text_composer_${now}`,
    kind: 'text-composer',
    status: 'ready',
    x: finite(x),
    y: finite(y),
    w: 340,
    h: 170,
    text: '',
    placeholder: '双击开始编辑...',
    prompt: '',
    ratio: '1:1',
    resolution: '2K',
    count: 1,
    sourceNodeIds: sourceNodeId ? [sourceNodeId] : [],
    textStyle: {
      block: 'body',
      color: '#20242a',
      fontSize: 18,
      fontStyle: 'normal',
      fontWeight: 400,
      list: 'none',
      textAlign: 'left',
    },
  };
}

export function createCanvasSuiteComposerNode({ x = 0, y = 0, sourceNodeId = '', platform = 'smart', now = Date.now() } = {}) {
  return {
    id: `suite_composer_${now}`,
    kind: 'suite-composer',
    status: 'ready',
    x: finite(x),
    y: finite(y),
    w: 640,
    h: 420,
    prompt: '',
    platform,
    suiteType: '完整套图',
    ratio: '1:1',
    resolution: '2K',
    language: '中文',
    count: 6,
    skuMode: '默认SKU',
    styleSkill: 'smart',
    productInfoMode: 'auto',
    copywritingMode: 'smart',
    sourceNodeIds: sourceNodeId ? [sourceNodeId] : [],
    configuration: {
      platform,
      sizing: { smart: true, images: [] },
      styleSkill: 'smart',
      customColors: null,
      productParams: { category: '', size: '', baseColor: '', accentColor: '', material: '', craft: '' },
      skus: [],
      copywriting: { plan: '', sellingPoints: '', qc: '', details: '', maintenance: '' },
      genSettings: { resolution: '2K', negativePrompt: '' },
    },
  };
}

function unit(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(1, Math.max(0, number)) : fallback;
}

export function normalizeCanvasSelection(selection) {
  if (!selection || typeof selection !== 'object') return { mode: 'whole' };
  const mode = selection.mode === 'subject' ? 'subject' : selection.mode === 'rectangle' ? 'rectangle' : 'whole';
  if (mode !== 'rectangle') return { mode };
  const rect = selection.rect || {};
  const x = unit(rect.x);
  const y = unit(rect.y);
  return {
    mode,
    rect: {
      x,
      y,
      w: Math.min(1 - x, Math.max(0, Number.isFinite(Number(rect.w)) ? Number(rect.w) : 0)),
      h: Math.min(1 - y, Math.max(0, Number.isFinite(Number(rect.h)) ? Number(rect.h) : 0)),
    },
  };
}

function closestRatio(width, height) {
  const value = Math.max(1, finite(width, 1)) / Math.max(1, finite(height, 1));
  const ratios = [
    ['1:1', 1],
    ['3:4', 3 / 4],
    ['4:3', 4 / 3],
    ['9:16', 9 / 16],
    ['16:9', 16 / 9],
  ];
  return ratios.reduce((best, current) => Math.abs(current[1] - value) < Math.abs(best[1] - value) ? current : best)[0];
}

export function createUploadedImageNodes({ assets = [], x = 80, y = 100, now = Date.now() } = {}) {
  const width = 240;
  const gap = 38;
  return assets.filter(asset => asset?.url).map((asset, index) => {
    const ratio = asset.ratio || closestRatio(asset.width, asset.height);
    return {
      id: `upload_${now}_${index}`,
      assetId: asset.assetId || `upload-asset-${now}-${index}`,
      kind: 'image',
      provenance: 'source',
      status: 'ready',
      url: asset.url,
      name: asset.name || `上传图片 ${index + 1}`,
      displayLabel: asset.name || `上传图片 ${index + 1}`,
      group: '',
      role: '',
      ratio,
      size: asset.width && asset.height ? `${asset.width}×${asset.height}` : '',
      sourceNodeIds: [],
      editable: true,
      showMeta: false,
      x: finite(x) + index * (width + gap),
      y: finite(y),
      w: width,
      h: Math.round(width / ratioValue(ratio, 1)),
      rotation: 0,
      flipX: false,
      flipY: false,
      locked: false,
      hidden: false,
    };
  });
}
