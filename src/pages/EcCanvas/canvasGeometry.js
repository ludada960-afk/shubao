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

/* ══════════════════════════════════════════════════════════════════════════════
   拖线时的**吸附**（批 CY-㊴）
   ──────────────────────────────────────────────────────────────────────────────
   用户 2026-09-30 逐字：
     「你应该允许他手动拉到任意一个素材的左边或者右边的加号这里时
       **给一个吸附的能力，让它可以吸附上去**，然后创建成连接。」

   为什么必须写成**纯模型**函数、而不是拿 DOM 量：
     ① `test/canvas-port-geometry` 与 `test/ec-canvas-state` 明确禁止画布页用
        ResizeObserver / 渲染期端口中心做几何 —— 那次事故（批 CY-㉕/㉖）就是
        "DOM 实测的端口中心在缩放平移后全错位"。
     ② 端口中心本来就有一个纯模型口径 `getNodePortCenter`（连线端点用的就是它），
        吸附必须与**连线端点同一个口径**，否则"吸上了但线没接上"。

   半径按**世界坐标**给，调用方负责用当前缩放换算（这样低缩放下吸附范围
   在屏幕上才是恒定的 ~40px，不会越缩越小）。
   ══════════════════════════════════════════════════════════════════════════ */
export const CANVAS_SNAP_RADIUS = 44;

export function pickCanvasConnectionSnapTarget(nodes = [], pointer = null, {
  fromId = '',
  radius = CANVAS_SNAP_RADIUS,
  accept = null,
} = {}) {
  if (!pointer || !Number.isFinite(pointer.x) || !Number.isFinite(pointer.y)) return null;
  let best = null;
  for (const node of nodes || []) {
    if (!node || node.id === fromId || node.hidden) continue;
    /* accept 让调用方把"类型不兼容"这类规则挡在外面（互斥矩阵见 canvasQuantvExtensions） */
    if (typeof accept === 'function' && !accept(node)) continue;
    const center = getNodePortCenter(node, 'input');
    const distance = Math.hypot(center.x - pointer.x, center.y - pointer.y);
    if (!Number.isFinite(distance) || distance > radius) continue;
    if (!best || distance < best.distance) best = { nodeId: node.id, node, center, distance };
  }
  return best;
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
