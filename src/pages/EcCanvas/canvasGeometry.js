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

/**
 * 比例字符串 → 给定宽度下的高度。
 *
 * ⚠️ 2026-10-02：原来这里是**逐条枚举**（3:4 / 4:3 / 9:16 / 16:9 / 长图），
 * 凡是没枚举到的比例一律退化成正方形。而服务端 `modelCatalog.LEGAL_IMAGE_SIZES`
 * 有 **13 种**比例（1:1 / 4:5 / 3:4 / 2:3 / 9:16 / 4:3 / 3:2 / 16:9 / …）——
 * 落进兜底的那些（2:3、5:4、1:5…）在画布上就画成了方图。
 *
 * ⇒ 改成**解析** `宽:高`，一次覆盖全部；`长图` 没有比例含义，单独给。
 *   （逐条枚举的代价：每加一种比例要记得回来补，漏一条就是一张画错的卡。）
 */
export function mediaHeightForRatio(ratio, width = LANE_METRICS.cardWidth) {
  const normalized = String(ratio || '1:1').trim();
  if (normalized === '长图') return Math.round(width * 1.9);
  const match = /^(\d+(?:\.\d+)?)\s*[:x×/]\s*(\d+(?:\.\d+)?)$/.exec(normalized);
  if (!match) return width;
  const w = Number(match[1]);
  const h = Number(match[2]);
  if (!(w > 0) || !(h > 0)) return width;
  return Math.round(width * h / w);
}

/* 9-11 用户批注: 连线端点必须是节点两侧「加号」按钮的中心, 而不是节点边缘 —
   加号是 30px 圆钮, 与节点边缘留 2px 间隙 (CSS .ec-canvas-node-port right/left: -32px),
   所以中心在节点边缘外 17px。端点停在边缘会看起来「线路和加号不重叠」。 */
export const CANVAS_PORT_CENTER_OFFSET = 17;

/* ═══ 卡片 footer 高度：**整卡几何的唯一事实源** ═══════════════════════════════════════════
   为什么必须是常量（而不是让模型去复刻 CSS 的 padding/字号/行高）：
     footer 现在是**内容撑出来**的（padding 6+7 + gap 2 + 两行文字 + border 1 ≈ 45.7px）。
     字体 token 或文案一变，这个高度就变，而模型端点会**默默偏移** —— 正是 2026-10-02
     用户报「线偏移在加号上面」的那个 bug。
   ⇒ 这里定死，并由 `test/canvas-port-geometry` 钉住与 CSS 的 footer 规则一致。
   ⚠️ `showMeta === false` 的节点**不渲染** footer ⇒ 该节点本��就不该加这截高度
      （也是这个 bug「时有时无」的原因）。 */
export const CANVAS_CARD_FOOTER_H = 46;

/** 节点**整卡**高度 = 媒体本体 + footer。端口 / 吸附 / 框选 / 碰撞 / 小地图都用它。 */
export function getCanvasCardHeight(node = {}) {
  const media = Math.max(1, numeric(node.h, 200));
  const footer = node.showMeta === false ? 0 : CANVAS_CARD_FOOTER_H;
  return media + footer;
}

export function getNodePortCenter(node = {}, port = 'output', measured = null) {
  /* ═══ 2026-10-04：实测端口优先，模型 rect 兜底 ══════════════════════════════════
     用户连续三轮报「连线还是没连上素材本身 / 没连到加号身上」。

     离线实测（Playwright 量真实渲染盒）确认：模型公式本身**是对的**
     —— 输出端口实测中心 x=436，公式预期 437（差 1px 是边框）。
     真正错位的是另一件事：**加号按钮贴在渲染出来的元素上，而这个元素不一定等于
     模型矩形**。生成框/composer 面板的视觉宽度大于 `node.w`（要放参考图槽、输入框、底栏），
     于是用 `node.x + node.w` 算出来的端点会落在卡片**里面**或旁边几十像素处。

     业界口径（查证）：React Flow 的 `nodeInternals.handleBounds` 用**实测**的 handle 盒子，
     量不到才退回 `positionAbsolute + width/height`；tldraw / Excalidraw 同理。
     ⇒ 这里优先用实测（canvasNodeRects.js），量不到再走下面这段模型口径。
        实测值的来源与纪律见 canvasNodeRects.js 顶部说明。 */
  if (measured) return { x: numeric(measured.x), y: numeric(measured.y) };

  const isInput = port === 'input' || port === 'in';
  const width = Math.max(1, numeric(node.w, 200));
  /* ⚠️ 用**整卡**高度，不是 node.h：端口的 CSS 是 `top:50%`，参照物就是整张卡片
     （外壳没有显式 height，是媒体 + footer 撑出来的）。
     原来这里用 node.h（**只有媒体本体**）⇒ 端点比加号高了半个 footer（≈22.85px），
     正是用户报的「线偏移到加号上面 / 没有连到素材本身身上」。
     业界口径见文件头：React Flow / tldraw / Excalidraw / Draw.io 四家都取**整卡**中线。 */
  const cardHeight = getCanvasCardHeight(node);
  return {
    x: numeric(node.x) + (isInput ? -CANVAS_PORT_CENTER_OFFSET : width + CANVAS_PORT_CENTER_OFFSET),
    y: numeric(node.y) + cardHeight / 2,
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
