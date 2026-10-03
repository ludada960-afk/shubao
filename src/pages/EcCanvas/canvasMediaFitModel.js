/* ══════════════════════════════════════════════════════════════════════════════
   画布「素材必须完整展示 + 互不遮挡」的两条硬规则（批 CY-⑲）

   用户 2026-09-28 原话：
     「用户无论生成什么东西或者上传什么东西进来到画布里面。他都应该所有的素材全部能够
       完整的展示出来，并且互相之间是不会有遮挡，不会有覆盖的情况。」
     「你现在画布的大部分面积并没有展示出来内容呀。导致截断了他当前视角下的内容」

   调研（tldraw / Excalidraw / React Flow / ComfyUI 源码）给出的行业口径：

   ① **框跟着素材走，不反过来把素材塞进框里。**
      ComfyUI `fitDimensionsToNodeWidth(w, h, nodeWidth)`：
        `calculatedHeight = Math.max(nodeWidth / intrinsicAspectRatio, minHeight)`
      —— 节点高度由**素材真实宽高比**推出来，图片和视频走同一条。
      tldraw `ImageShapeUtil` 建形状时直接用素材自身像素尺寸，并 `isAspectRatioLocked → true`。
      而 `object-fit: contain`（MDN）在比例不匹配时产生的就是 **letterbox / pillarbox**
      ——正是用户截图里「上下有白色部分」「左右被截断」的那两条。

   ② **间距要按「屏幕像素」表达，不能按世界坐标。**
      Excalidraw `insertImages`：`const gridPadding = 50 / this.state.zoom.value`
      —— 除以缩放，任何缩放下间隙都是恒定的 50 屏幕像素。
      我们原来直接把 `gap: 28` 塞进世界坐标：低缩放时 28 世界像素只剩几个屏幕像素（看着像重叠），
      高缩放时又变成一大片空白。

   ⚠️ 调研同时确认了一件**不是 bug** 的事，别再当 bug 去"修"：
      「stage 边缘裁掉内容」是无限画布模型的**固有属性**，不是缺陷 ——
      React Flow `translateExtent` 默认 `[[-∞,-∞],[+∞,+∞]]`，
      Excalidraw `Renderer.ts` 把出视口的元素移进 `removed` 绘制集合但**状态原封不动**。
      素材在视口外只应该「没被画出来」，绝不能「从状态里消失」。
   ══════════════════════════════════════════════════════════════════════════════ */

/** 整卡高度（含 footer）是**唯一口径**，在 canvasGeometry 里定义 —— 别在这里再抄一份。 */
import { getCanvasCardHeight } from './canvasGeometry.js';

/** 画布素材框的宽度基准（与 createUploadedImageNodes 的 width 保持一致）。 */
export const CANVAS_MEDIA_WIDTH = 240;

/** 素材框最大高度：太高会让一屏放不下两张，也和 Excalidraw 的
 *  「不超过视口高度一半」是同一个意图。 */
export const CANVAS_MEDIA_MAX_HEIGHT = 720;

/** 落位间隙，**屏幕像素**。除以缩放后才是世界坐标（见 screenGapToWorld）。 */
export const CANVAS_MEDIA_GAP_SCREEN = 28;

/**
 * 由素材真实宽高比推算框高。
 *
 * 口径来自 ComfyUI `fitDimensionsToNodeWidth`：`h = w / (naturalW / naturalH)`，
 * 再夹一个上限。量不到尺寸时（跨域未解码、视频未 loadedmetadata）回落到 1:1。
 *
 * @param {number} width  框宽（世界坐标）
 * @param {number} naturalWidth  素材真实宽（像素），量不到传 0
 * @param {number} naturalHeight 素材真实高（像素），量不到传 0
 */
export function canvasMediaFrameHeight(width, naturalWidth, naturalHeight) {
  const w = Math.max(1, Number(width) || CANVAS_MEDIA_WIDTH);
  const nw = Number(naturalWidth) || 0;
  const nh = Number(naturalHeight) || 0;
  if (!(nw > 0 && nh > 0)) return Math.round(w);
  return Math.max(1, Math.min(CANVAS_MEDIA_MAX_HEIGHT, Math.round(w * nh / nw)));
}

/**
 * 把「屏幕像素」间距换算成当前缩放下的世界坐标。
 * Excalidraw `gridPadding = 50 / zoom` 的同款做法。
 * 缩放越小，世界坐标的间距要越大，才等于同样的屏幕留白。
 */
export function screenGapToWorld(gapScreen, scale) {
  const s = Math.max(0.05, Number(scale) || 1);
  return Math.max(1, Math.round((Number(gapScreen) || CANVAS_MEDIA_GAP_SCREEN) / s));
}

/** 两个矩形是否相交（含 gap 间隙）。gap 为世界坐标。 */
export function canvasRectsOverlap(a, b, gap = 0) {
  return a.x < b.x + b.w + gap
    && a.x + a.w + gap > b.x
    && a.y < b.y + b.h + gap
    && a.y + a.h + gap > b.y;
}

/**
 * 素材框的**占位**矩形。
 *
 * ⚠️ 这一条是「明明排得好好的却还是互相盖住」的真正根因：
 *   `node.h` 只是**图片本体**的高度，而 `.ec-canvas-media-node` 在图片下面
 *   还渲染了一个 `<footer>`（名称 + 比例/尺寸，`.ec-canvas-media-node footer`）。
 *   落位避让只按 `node.h` 算 ⇒ **每个带 footer 的节点都多出一截压到下一个**。
 *   这就是用户说的「互相之间会有遮挡、会有覆盖」——不是错觉，是几何事实。
 *
 * 2026-10-02（批 之二十二）：这里曾有一份**自己的** footer 高度常量 34，
 * 而端口几何那边是 46 —— 同一个「整卡多高」的问题有两个答案。
 * 后果不是玄学：框选按 34 算、连线端点按 46 算 ⇒
 *   「框选矩形明明盖住了整张卡片，节点却没被选中」，而卡片上的加号又对不上线。
 * 现在**整卡高度只有一处定义**（canvasGeometry.getCanvasCardHeight），
 * 本模块不再持有第二份常量。
 */
export function canvasNodeFootprint(node) {
  if (!node) return null;
  const w = Math.max(1, Number(node.w) || CANVAS_MEDIA_WIDTH);
  return {
    x: Number(node.x) || 0,
    y: Number(node.y) || 0,
    w,
    /* 整卡高度（含 footer，showMeta===false 时不含）—— 唯一口径。 */
    h: getCanvasCardHeight({ ...node, w, h: Math.max(1, Number(node.h) || w) }),
  };
}

/**
 * 给「一整批」素材找一个互不重叠、且不压住任何已有节点的落位原点。
 *
 * 存在的理由：`createUploadedImageNodes` 是按 `x + i*(width+gap)` **横向一字排开**的，
 * 以前只对**第一个**节点找过空白位（`findCanvasBlankPlacement` 只算一个 200×200 的框），
 * 于是第 2、3、4 张落在哪儿全凭运气 —— 必压已有节点。
 * 现在按**整批的外接矩形**一次性找位置。
 *
 * @param {Array<{w:number,h:number}>} sizes 本批每个节点的**占位**尺寸（已含 footer）
 */
export function findCanvasBatchPlacement({
  sizes = [],
  viewport = { x: 0, y: 0, scale: 1 },
  bounds = { width: 1200, height: 800 },
  nodes = [],
  preferred,
  gapScreen = CANVAS_MEDIA_GAP_SCREEN,
} = {}) {
  const list = (Array.isArray(sizes) ? sizes : []).filter(s => s && Number(s.w) > 0);
  if (!list.length) return null;

  const scale = Math.max(0.05, Number(viewport.scale) || 1);
  const gap = screenGapToWorld(gapScreen, scale);
  const vx = Number(viewport.x) || 0;
  const vy = Number(viewport.y) || 0;
  const bw = Math.max(1, Number(bounds.width) || 1200);
  const bh = Math.max(1, Number(bounds.height) || 800);
  const pad = screenGapToWorld(24, scale);

  /* 本批按一字排开后的总占位（横向） */
  const batchW = list.reduce((sum, s) => sum + Math.max(1, Number(s.w) || 1), 0) + gap * (list.length - 1);
  const batchH = Math.max(...list.map(s => Math.max(1, Number(s.h) || 1)));

  /* 当前视口在**世界坐标**里的范围 */
  const visible = {
    x: (0 - vx) / scale + pad,
    y: (0 - vy) / scale + pad,
    w: Math.max(0, bw / scale - pad * 2),
    h: Math.max(0, bh / scale - pad * 2),
  };
  const maxX = Math.max(visible.x, visible.x + visible.w - batchW);
  const maxY = Math.max(visible.y, visible.y + visible.h - batchH);

  const occupied = nodes
    .filter(node => node && node.hidden !== true)
    .map(canvasNodeFootprint)
    .filter(Boolean);

  /* 把整批放在 (x, y) 时，是否与任何已有节点相交 */
  const batchFree = (x, y) => {
    let cursorX = x;
    for (const size of list) {
      const w = Math.max(1, Number(size.w) || 1);
      const h = Math.max(1, Number(size.h) || 1);
      if (occupied.some(rect => canvasRectsOverlap({ x: cursorX, y, w, h }, rect, gap))) return false;
      cursorX += w + gap;
    }
    return true;
  };

  const candidates = [];
  const add = (x, y, clampToViewport) => {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    candidates.push(clampToViewport
      ? { x: Math.min(maxX, Math.max(visible.x, x)), y: Math.min(maxY, Math.max(visible.y, y)) }
      : { x: Math.round(x), y: Math.round(y) });
  };

  /* ① 用户指定的位置（拖放点 / 落点）及其四个正交方向 */
  if (preferred && Number.isFinite(Number(preferred.x)) && Number.isFinite(Number(preferred.y))) {
    const px = Number(preferred.x);
    const py = Number(preferred.y);
    add(px, py, true);
    add(px + batchW + gap, py, true);
    add(px - batchW - gap, py, true);
    add(px, py + batchH + gap, true);
    add(px, py - batchH - gap, true);
  }
  /* ② 视口中心 */
  add(visible.x + (visible.w - batchW) / 2, visible.y + (visible.h - batchH) / 2, true);
  /* ③ 视口内网格扫描 */
  const stepX = Math.max(160, Math.min(batchW + gap, 480));
  const stepY = Math.max(120, Math.min(batchH + gap, 360));
  for (let y = visible.y; y <= maxY; y += stepY) {
    for (let x = visible.x; x <= maxX; x += stepX) add(x, y, true);
  }
  for (const candidate of candidates) {
    if (batchFree(candidate.x, candidate.y)) return candidate;
  }

  /* ④ 视口内真的塞不下 ⇒ 往视口外找，但**绝不**把新节点压回已有节点身上。
     （一个无限画布上「放到视野外」是可接受的，「盖住已有内容」不可接受。） */
  const anchor = preferred && Number.isFinite(Number(preferred.x))
    ? { x: Number(preferred.x), y: Number(preferred.y) }
    : { x: visible.x, y: visible.y };
  const ringX = Math.max(batchW + gap, stepX);
  const ringY = Math.max(batchH + gap, stepY);
  for (let ring = 1; ring <= 12; ring += 1) {
    const spots = [
      [anchor.x + ring * ringX, anchor.y],
      [anchor.x - ring * ringX, anchor.y],
      [anchor.x, anchor.y + ring * ringY],
      [anchor.x, anchor.y - ring * ringY],
      [anchor.x + ring * ringX, anchor.y + ring * ringY],
      [anchor.x - ring * ringX, anchor.y + ring * ringY],
      [anchor.x + ring * ringX, anchor.y - ring * ringY],
      [anchor.x - ring * ringX, anchor.y - ring * ringY],
    ];
    for (const [x, y] of spots) {
      if (Number.isFinite(x) && Number.isFinite(y) && batchFree(x, y)) return { x: Math.round(x), y: Math.round(y) };
    }
  }

  /* ⑤ 兜底：所有已有节点的右下方，一定不与任何节点相交。 */
  const right = Math.max(visible.x + visible.w, ...occupied.map(rect => rect.x + rect.w));
  const bottom = Math.max(visible.y + visible.h, ...occupied.map(rect => rect.y + rect.h));
  return { x: Math.round(right + gap), y: Math.round(bottom + gap) };
}

/** 一批素材横向排开时每个节点的**占位**宽（含间隙）。 */
export function canvasBatchWidths(sizes, gap) {
  let total = 0;
  for (const size of sizes) total += Math.max(1, Number(size?.w) || 1);
  return total + Math.max(0, gap) * Math.max(0, sizes.length - 1);
}
