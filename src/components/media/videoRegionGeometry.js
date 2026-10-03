/* ═══ 视频区域框选的几何：显示框 = 纯函数（2026-10-03）═══════════════════════════════

   起因是用户批注：「点击擦除为什么是这样的」—— 点开智能擦除，画面只露出
   **顶部一条横带**，而字幕通常在画面下三分之一，根本框不到。

   根因：显示框的尺寸原先来自 `surface.offsetWidth/offsetHeight`，
   而那个 surface 是 `.video-region-canvas` 的 `inset:0` 子元素 ——
   **尺寸完全由祖先决定**（祖先当时是 `max-height:280px` + auto 宽度）。
   于是：
     · 1080×1920 的片子只有顶部 280px 可见 ⇒ 看上去就是一条横带；
     · 坐标系建在一个"我们自己都没约束过的容器"上 ——
       祖先一改（加信箱留白、加 transform、滚动条出现），
       所有已框的区域**立刻整体错位**，而且没有任何地方会报错。

   ⇒ 显示框改由**视频固有尺寸**按比例 fit 出来（纯函数、可测、无 DOM 读），
     再把这个框写成内联宽高。于是「显示框」与「框选坐标系」从此是同一个数。

   为什么单独成文件而不是留在组件里：门禁要在 node 里直接跑它
   （.jsx 没法被 node --test 直接 import）。 */

export const REGION_BOX_MAX_W = 720;
export const REGION_BOX_MAX_H = 560;

/** 按视频**固有尺寸**算出显示框（等比 fit 到上限内）。尺寸未就绪时返回 0。 */
export function fitRegionBox(intrinsicWidth, intrinsicHeight, maxWidth = REGION_BOX_MAX_W, maxHeight = REGION_BOX_MAX_H) {
  const nw = Number(intrinsicWidth) || 0;
  const nh = Number(intrinsicHeight) || 0;
  if (!(nw > 0) || !(nh > 0)) return { width: 0, height: 0 };
  const scale = Math.min(maxWidth / nw, maxHeight / nh);
  return { width: Math.max(1, Math.round(nw * scale)), height: Math.max(1, Math.round(nh * scale)) };
}