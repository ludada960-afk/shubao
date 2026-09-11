const LANE_ORDER = ['白底图', '主图', '详情图', 'SKU', '素材'];
const LANE_METRICS = {
  startX: 410,
  startY: 70,
  laneGap: 76,
  columnGap: 38,
  cardWidth: 230,
  cardFooter: 64,
};

function numeric(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

export function mediaHeightForRatio(ratio, width = LANE_METRICS.cardWidth) {
  const normalized = String(ratio || '1:1');
  if (normalized === '3:4') return Math.round(width * 4 / 3);
  if (normalized === '4:3') return Math.round(width * 3 / 4);
  if (normalized === '9:16') return Math.round(width * 16 / 9);
  if (normalized === '16:9') return Math.round(width * 9 / 16);
  if (normalized === '长图') return Math.round(width * 1.9);
  return width;
}

/* 9-11 用户批注: 连线端点必须是节点两侧「加号」按钮的中心, 而不是节点边缘 —
   加号是 30px 圆钮, 与节点边缘留 2px 间隙 (CSS .ec-canvas-node-port right/left: -32px),
   所以中心在节点边缘外 17px。端点停在边缘会看起来「线路和加号不重叠」。 */
export const CANVAS_PORT_CENTER_OFFSET = 17;

export function getNodePortCenter(node = {}, port = 'output') {
  const isInput = port === 'input' || port === 'in';
  const width = Math.max(1, numeric(node.w, 200));
  const height = Math.max(1, numeric(node.h, 200));
  return {
    x: numeric(node.x) + (isInput ? -CANVAS_PORT_CENTER_OFFSET : width + CANVAS_PORT_CENTER_OFFSET),
    y: numeric(node.y) + height / 2,
  };
}

export function cubicEdgePath(from = {}, to = {}) {
  const middle = (numeric(from.x) + numeric(to.x)) / 2;
  return `M ${numeric(from.x)} ${numeric(from.y)} C ${middle} ${numeric(from.y)}, ${middle} ${numeric(to.y)}, ${numeric(to.x)} ${numeric(to.y)}`;
}

export function layoutAssetLanes({ sourceNode = {}, assets = [] } = {}) {
  const buckets = new Map(LANE_ORDER.map(group => [group, []]));
  assets.forEach(asset => buckets.get(LANE_ORDER.includes(asset.group) ? asset.group : '素材').push(asset));
  const startX = Math.max(LANE_METRICS.startX, numeric(sourceNode.x) + numeric(sourceNode.w, 248) + 150);
  let nextY = LANE_METRICS.startY;
  const nodes = [];
  for (const group of LANE_ORDER) {
    const lane = buckets.get(group);
    if (!lane.length) continue;
    const laneHeight = Math.max(...lane.map(asset => mediaHeightForRatio(asset.ratio) + LANE_METRICS.cardFooter));
    lane.forEach((asset, index) => {
      const width = numeric(asset.w, LANE_METRICS.cardWidth);
      const height = mediaHeightForRatio(asset.ratio, width);
      nodes.push({ ...asset, group, x: startX + index * (width + LANE_METRICS.columnGap), y: nextY, w: width, h: height });
    });
    nextY += laneHeight + LANE_METRICS.laneGap;
  }
  return nodes;
}
