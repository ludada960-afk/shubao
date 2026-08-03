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

export function getCanvasComposerPresentation({ node, selectedId = '', selectedCount = 1, width = 640, gap = 24 } = {}) {
  const visible = Boolean(node?.id && node.id === selectedId && Number(selectedCount) === 1);
  if (!visible) return { visible: false, position: null };
  const nodeWidth = Math.max(1, finite(node.w, width));
  const nodeHeight = Math.max(1, finite(node.h, 0));
  return {
    visible: true,
    position: {
      left: Math.round(finite(node.x) + (nodeWidth - width) / 2),
      top: Math.round(finite(node.y) + nodeHeight + gap),
      width,
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
    h: 180,
    text: '',
    placeholder: '输入文字',
    sourceNodeIds: sourceNodeId ? [sourceNodeId] : [],
    status: 'ready',
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
    w: 480,
    h: 220,
    text: '',
    placeholder: '双击开始编辑...',
    prompt: '',
    count: 1,
    sourceNodeIds: sourceNodeId ? [sourceNodeId] : [],
  };
}

export function createCanvasSuiteComposerNode({ x = 0, y = 0, sourceNodeId = '', platform = '淘宝', now = Date.now() } = {}) {
  return {
    id: `suite_composer_${now}`,
    kind: 'suite-composer',
    status: 'ready',
    x: finite(x),
    y: finite(y),
    w: 560,
    h: 360,
    prompt: '',
    platform,
    ratio: '1:1',
    resolution: '2K',
    language: '中文',
    count: 6,
    sourceNodeIds: sourceNodeId ? [sourceNodeId] : [],
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
