/* ══════════════════════════════════════════════════════════════════════════════
   画布吸附（对齐参考线 + 网格）

   口径来自两家一线实现，**不是自己拍脑袋**：

   ① **阈值用屏幕像素表达，再除以缩放** —— 任何缩放下手感一致：
      Excalidraw `snapping.ts`：`const SNAP_DISTANCE = 8; getSnapDistance = z => 8 / z`
      tldraw `SnapManager.getSnapThreshold()`：`options.snapThreshold / getZoomLevel()`
      少了这一步，低缩放时 8 世界像素已经小于一个像素（吸不动），
      高缩放时又粘得太狠。

   ② **对齐参考线的候选点是「边 + 中心」**（不是只比左边线）：
      tldraw `BoundsSnaps.points` 默认 corners + centers；
      Excalidraw 的对齐线同样取 left/centerX/right × top/centerY/bottom。
      优先级：**中心 > 边** —— 中心对齐比边对齐更能表达「我要对齐」，
      距离相同时让中心赢。

   ③ **网格吸附与对齐参考线互斥**：先看参考线，参考线命中就不吸附网格，
      否则两个都生效会把节点拽歪（RF `calculateSnapOffset` 解决的正是
      「一组节点各自吸到不同网格格子、互相错位」的问题）。

   ⚠️ 只做**点吸附**（left/centerX/right、top/centerY/bottom），
     不做 tldraw 的间距/等距吸附（gap_center / gap_duplicate）：
     那需要先算出「所有候选间隙」，复杂度高一档，而画布上素材是**成排**的，
     等距吸附的实际收益远小于对齐线。
   ══════════════════════════════════════════════════════════════════════════════ */

/** 吸附阈值，单位**屏幕像素**。Excalidraw 用的就是 8。 */
export const CANVAS_SNAP_SCREEN = 8;

/** 网格边长（世界坐标）。0 = 不吸网格。 */
export const CANVAS_SNAP_GRID = 0;

/**
 * 网格步长按**屏幕像素**表达，除以缩放后才是世界坐标。
 *
 * 口径同 `CANVAS_SNAP_SCREEN`：网格线在屏幕上必须始终一样大，
 * 否则缩小 4 倍之后格子只剩 1px（等于没有网格），放大之后又一大片空白。
 * Excalidraw 落位间隙用的是同一个思路（`50 / zoom`）。
 *
 * @param {number} scale  当前缩放
 * @param {boolean} enabled 开关（右键菜单「网格吸附」）
 * @returns {number} 世界坐标下的步长；关闭时返回 0（纯函数据此不吸网格）
 */
export const CANVAS_GRID_SCREEN = 20;

export function canvasSnapGridWorld(scale = 1, enabled = false) {
  if (!enabled) return 0;
  const s = Math.max(0.05, Number(scale) || 1);
  return CANVAS_GRID_SCREEN / s;
}

const finite = (value, fallback = 0) => (Number.isFinite(Number(value)) ? Number(value) : fallback);

/** 屏幕像素阈值 → 世界坐标阈值。 */
export function canvasSnapThreshold(scale = 1) {
  const s = Math.max(0.05, finite(scale, 1) || 1);
  return CANVAS_SNAP_SCREEN / s;
}

function snapValue(value, grid) {
  if (!(grid > 0)) return value;
  return Math.round(value / grid) * grid;
}

/** 一个矩形在某一轴上的三个候选锚点。 */
function anchorsX(box) { return [box.x, box.x + box.w / 2, box.x + box.w]; }
function anchorsY(box) { return [box.y, box.y + box.h / 2, box.y + box.h]; }

/**
 * 对齐参考线：把「正在拖动的那一块」吸附到「其它静止节点」的边/中心上。
 *
 * @param {{x,y,w,h}} selection 拖动中整块的外接矩形（已含位移）
 * @param {Array<{x,y,w,h}>} others  静止节点的占位矩形
 * @param {number} scale           当前缩放
 * @returns {{dx:number, dy:number, guides:Array}} 需要补的位移 + 要画的参考线
 */
export function canvasAlignmentSnap(selection, others = [], scale = 1) {
  const empty = { dx: 0, dy: 0, guides: [] };
  if (!selection || !(selection.w >= 0) || !(selection.h >= 0)) return empty;
  if (!Array.isArray(others) || !others.length) return empty;
  const threshold = canvasSnapThreshold(scale);

  /* 中心优先（index 0/1/2 分别是 边/中心/边），所以中心给更小的权重 */
  const weightOf = index => (index === 1 ? 0.5 : 1);

  let best = { x: null, y: null };
  const selX = anchorsX(selection);
  const selY = anchorsY(selection);

  others.forEach((other) => {
    const otherX = anchorsX(other);
    const otherY = anchorsY(other);
    for (let i = 0; i < selX.length; i += 1) {
      for (let j = 0; j < otherX.length; j += 1) {
        const delta = otherX[j] - selX[i];
        const distance = Math.abs(delta);
        if (distance > threshold) continue;
        const score = distance * weightOf(i) * weightOf(j);
        if (!best.x || score < best.x.score) best.x = { delta, score, value: otherX[j] };
      }
    }
    for (let i = 0; i < selY.length; i += 1) {
      for (let j = 0; j < otherY.length; j += 1) {
        const delta = otherY[j] - selY[i];
        const distance = Math.abs(delta);
        if (distance > threshold) continue;
        const score = distance * weightOf(i) * weightOf(j);
        if (!best.y || score < best.y.score) best.y = { delta, score, value: otherY[j] };
      }
    }
  });

  const guides = [];
  let dx = 0;
  let dy = 0;
  if (best.x) { dx = best.x.delta; guides.push({ axis: 'x', value: best.x.value }); }
  if (best.y) { dy = best.y.delta; guides.push({ axis: 'y', value: best.y.value }); }
  return { dx, dy, guides };
}

/**
 * 拖动吸附的总入口：网格 ⇄ 对齐参考线 二选一。
 *
 * @returns {{dx:number, dy:number, guides:Array}} 修正后的位移与参考线
 */
export function snapCanvasDrag({
  nodes = [],
  movingIds = new Set(),
  bounds = null,
  dx = 0,
  dy = 0,
  scale = 1,
  grid = CANVAS_SNAP_GRID,
  snapToNodes = true,
} = {}) {
  const ids = movingIds instanceof Set ? movingIds : new Set(movingIds || []);
  if (!bounds) return { dx, dy, guides: [] };

  let nextDx = dx;
  let nextDy = dy;

  /* ① 先看对齐参考线（更符合直觉：用户是在对某个对象，不是在对网格） */
  let guides = [];
  if (snapToNodes) {
    const others = nodes
      .filter(node => node && !ids.has(node.id) && node.hidden !== true)
      .map(node => (node.__footprint
        ? node.__footprint
        : { x: finite(node.x), y: finite(node.y), w: Math.max(1, finite(node.w, 1)), h: Math.max(1, finite(node.h, 1)) }));
    const moved = { x: bounds.x + dx, y: bounds.y + dy, w: bounds.w, h: bounds.h };
    const snap = canvasAlignmentSnap(moved, others, scale);
    nextDx += snap.dx;
    nextDy += snap.dy;
    guides = snap.guides;
  }

  /* ② 参考线没命中才退到网格 —— 同时命中会让一组节点各自吸到不同格子而错位 */
  if (!guides.length && grid > 0) {
    nextDx += snapValue(bounds.x + dx, grid) - (bounds.x + dx);
    nextDy += snapValue(bounds.y + dy, grid) - (bounds.y + dy);
  }

  return { dx: nextDx, dy: nextDy, guides };
}

/* ══════════════════════════════════════════════════════════════════════════════
   拖到视口边缘自动平移（auto-pan）

   口径来自 React Flow `calcAutoPan(pos, bounds, speed = 15, distance = 40)`：
   指针进入边缘 distance 像素以内就按 `clamp(|v - min|, 1, min) / min` 提速，
   由 rAF 循环持续推。少了它，用户想拖一个节点到画布外，只能先平移再回来拖，
   非常难用 —— 这是无限画布最容易被忽略、却最影响手感的一条。
   ══════════════════════════════════════════════════════════════════════════════ */
export const CANVAS_AUTOPAN_EDGE = 40;
export const CANVAS_AUTOPAN_SPEED = 15;

export function calcCanvasAutoPan(
  point = { x: 0, y: 0 },
  bounds = { width: 0, height: 0 },
  { edge = CANVAS_AUTOPAN_EDGE, speed = CANVAS_AUTOPAN_SPEED } = {},
) {
  const width = Math.max(0, finite(bounds.width));
  const height = Math.max(0, finite(bounds.height));
  if (!width || !height) return { dx: 0, dy: 0 };
  const x = finite(point.x);
  const y = finite(point.y);

  let dx = 0;
  let dy = 0;
  if (x < edge) dx = -Math.min(speed, (edge - Math.max(0, x)) / edge * speed);
  else if (x > width - edge) dx = Math.min(speed, (x - (width - edge)) / edge * speed);
  if (y < edge) dy = -Math.min(speed, (edge - Math.max(0, y)) / edge * speed);
  else if (y > height - edge) dy = Math.min(speed, (y - (height - edge)) / edge * speed);

  /* 别让指针跑到边界外面去 */
  if (!dx && !dy) return { dx: 0, dy: 0 };
  return { dx: Math.abs(dx) < 0.05 ? 0 : dx, dy: Math.abs(dy) < 0.05 ? 0 : dy };
}