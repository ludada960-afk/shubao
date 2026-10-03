/* ══════════════════════════════════════════════════════════════════════════════
   视口交互：滚轮语义、缩放锚点、键盘缩放

   原来这里只有一句 `factor = e.deltaY > 0 ? 0.92 : 1.09`，看起来没问题，
   实测是四个独立的毛病叠在一起：

   ① **没有归一化 deltaMode**。鼠标滚轮在 Windows 上是「行」(deltaMode=1)，
      触控板是「像素」(0)，Firefox 还能给「页」(2)。三者数量级差 20~400 倍，
      同一个 0.92/1.09 在不同设备上手感完全不同。
      React Flow 的做法（`xypanzoom/utils.ts` `wheelDelta`）：
        `-deltaY * (deltaMode === 1 ? 0.05 : deltaMode ? 1 : 0.002) * factor`
      本模块照抄这个口径，并把它收敛成**乘性**（对数缩放）——
      固定 0.92/1.09 意味着「滚一格永远缩 8%」，
      而业界是「滚一格缩放比 × 1.1」，后者在任何缩放级别下步长一致。

   ② **ctrlKey（触控板捏合）没区分**。触控板双指捏合浏览器会发 ctrlKey+wheel，
      不做区分的话捏合和滚动是同一个量级，捏不上去。

   ③ **Shift+滚轮（水平滚动）在 `?` 面板里宣传了，但根本没实现**。
      画布只能上下缩放，横向摆放的一堆图根本挪不动视角。

   ④ **按钮缩放只改 scale、不动 x/y**（`zoomTo`）—— 于是点一下 `+`，
      画面会朝**原点**漂移，而不是朝**视口中心**放大。
      tldraw 把这两种明确拆开：zoom-in（居中）/ zoom-in-on-cursor（shift+=，保焦点）。
   ══════════════════════════════════════════════════════════════════════════════ */

export const CANVAS_ZOOM_MIN = 0.15;
export const CANVAS_ZOOM_MAX = 4;

/** 键盘/按钮缩放一步的倍率（tldraw 用 2 的幂，Excalidraw 用 1.1）。 */
export const CANVAS_ZOOM_STEP = 1.2;

const finite = (value, fallback = 0) => (Number.isFinite(Number(value)) ? Number(value) : fallback);

export function clampCanvasZoom(scale, min = CANVAS_ZOOM_MIN, max = CANVAS_ZOOM_MAX) {
  const value = finite(scale, 1) || 1;
  return Math.max(min, Math.min(max, value));
}

/** deltaMode 归一化 → 一个与设备无关的「缩放级别数」。 */
export function normalizeCanvasWheelDelta({ deltaY = 0, deltaMode = 0 } = {}) {
  const delta = finite(deltaY);
  const mode = finite(deltaMode);
  /* React Flow 的同一口径：行 ×0.05、页 ×1、像素 ×0.002 */
  return -delta * (mode === 1 ? 0.05 : mode ? 1 : 0.002);
}

/**
 * 一次滚轮/捏合该干什么。返回纯意图，不碰 state —— 便于门禁钉住。
 * @returns {{kind:'zoom'|'pan-x'|'pan-y', factor:number, dx:number, dy:number}}
 */
export function canvasWheelIntent({ deltaX = 0, deltaY = 0, deltaMode = 0, ctrlKey = false, shiftKey = false } = {}) {
  /* 触控板捏合 = ctrlKey + wheel。必须单独走缩放，且步长放大（真机捏合更细腻）。 */
  if (ctrlKey) {
    const steps = normalizeCanvasWheelDelta({ deltaY, deltaMode });
    return { kind: 'zoom', factor: canvasZoomFactorFromSteps(steps * 4), dx: 0, dy: 0 };
  }
  /* Shift+滚轮 = 水平平移（? 面板里宣传过，一直没实现）。 */
  if (shiftKey) {
    const horizontal = Math.abs(finite(deltaX)) > Math.abs(finite(deltaY)) ? finite(deltaX) : finite(deltaY);
    return { kind: 'pan-x', factor: 1, dx: horizontal * 0.6, dy: 0 };
  }
  const steps = normalizeCanvasWheelDelta({ deltaY, deltaMode });
  return { kind: 'zoom', factor: canvasZoomFactorFromSteps(steps), dx: 0, dy: 0 };
}

/** 把「缩放级别数」换成倍率（对数刻度：正数放大、负数缩小）。 */
export function canvasZoomFactorFromSteps(steps = 0, perStep = 0.11) {
  return Math.exp(finite(steps) * finite(perStep, 0.11));
}

/** 以某个**屏幕点**为锚缩放（滚轮/捏合走这条）。 */
export function canvasZoomAtPoint(viewport = { x: 0, y: 0, scale: 1 }, point = { x: 0, y: 0 }, factor = 1) {
  const current = clampCanvasZoom(viewport.scale);
  const next = clampCanvasZoom(current * factor);
  const scale = viewport.scale > 0 ? viewport.scale : 1;
  const worldX = (finite(point.x) - finite(viewport.x)) / scale;
  const worldY = (finite(point.y) - finite(viewport.y)) / scale;
  return { scale: next, x: finite(point.x) - worldX * next, y: finite(point.y) - worldY * next };
}

/**
 * 以**视口中心**为锚缩放（工具栏 `−` / `+` 走这条）。
 * ⚠️ 与 canvasZoomAtPoint 的区别不是形式：按钮没有鼠标位置，
 * 而「画面朝原点漂」正是只改 scale、不重算 x/y 造成的。
 */
export function canvasZoomAtCenter(viewport = { x: 0, y: 0, scale: 1 }, bounds = { width: 0, height: 0 }, factor = 1) {
  const center = { x: finite(bounds.width) / 2, y: finite(bounds.height) / 2 };
  return canvasZoomAtPoint(viewport, center, factor);
}

/** 缩放到指定倍率并保持视口中心。 */
export function canvasZoomToScale(viewport, bounds, scale) {
  const current = clampCanvasZoom(viewport.scale);
  const target = clampCanvasZoom(scale);
  if (!current || current === target) return { ...viewport, scale: target };
  return canvasZoomAtCenter(viewport, bounds, target / current);
}

/** 键盘缩放：Ctrl+`+`/`=` 放大、Ctrl+`-` 缩小、Ctrl+`0` 回到 100%。 */
export function canvasKeyboardZoomIntent({ key = '', ctrlKey = false, metaKey = false } = {}) {
  if (!(ctrlKey || metaKey)) return null;
  if (key === '0' || key === ')' || key === '0') return { kind: 'reset', scale: 1 };
  if (key === '+' || key === '=' || key === 'Add') return { kind: 'step', factor: CANVAS_ZOOM_STEP };
  if (key === '-' || key === '_' || key === 'Subtract') return { kind: 'step', factor: 1 / CANVAS_ZOOM_STEP };
  return null;
}

/** 一次手势的位移阈值（像素）：低于它就算「点」，不算「拖」—— 用来消掉抖动误判。 */
export const CANVAS_DRAG_THRESHOLD = 3;

export function canvasDragExceeded(start = { x: 0, y: 0 }, point = { x: 0, y: 0 }, threshold = CANVAS_DRAG_THRESHOLD) {
  return Math.hypot(finite(point.x) - finite(start.x), finite(point.y) - finite(start.y)) > threshold;
}