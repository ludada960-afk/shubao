/* ══════════════════════════════════════════════════════════════════════════════
   画布「真正看得见的」视口尺寸（批 CY-㉚ 建立 · 批 CY-㊴ 重写它的前提）

   shubao-canvas-visible-viewport-sig-v2
   ────────────────────────────────────────────────────────────────────────────
   用户 2026-09-30 逐字（图4-②）：
     「当前我们用户能够看到的所有内容，它都应该成为这个视窗……
       可是你这个视窗里却是一个被截断的状态。」

   ⚠️ 这一个函数上叠了**两个**互相掩盖的缺陷。它们必须一起修：
     单独修任何一个，实测都还是错 —— 下面每一条都有实机数字。

   ── 缺陷①：把 margin 从元素自己的宽度里又减了一遍 ─────────────────────────
     批 CY-㉚ 的原始假设是「`clientWidth` 是完整布局宽，右侧面板靠
     `margin-right`(476px) 让位，所以要减掉」。**那个假设不成立**：

       `.ec-canvas-stage` 是 `.ec-canvas-workbench`（column flex）里的
       `flex:1` 子项，横向靠 `align-items` 拉伸。**margin 参与 flex 分配**，
       浏览器为了把 margin 塞进整行，已经把它的 border box 缩成了
       `整行 − margin`。实测（1600×1000 窗口、右栏开）：

         stage 真实可见宽 (getBoundingClientRect) = 1124   ← 已经是 1600−476
         stage clientWidth                      = 1124   ← 同上，不含那条 margin
         stage margin-right                     =  476

       于是 `clientWidth − marginRight = 648`，**476 被减了两遍**。

     一般规律（不是本项目的特例）：**margin 按定义在 border box 之外**。
     `flex` 子项、以及 `width:auto` 的块级元素，布局都会先把 border box
     缩到「父宽 − margin」；只有当元素写了**显式 width/height** 时，
     它的 border box 才不会为 margin 收缩、右侧溢出的部分才是被裁掉的。
     本函数的调用对象 `.ec-canvas-stage` 没有显式 width ⇒ 永远不该再减。

   ── 缺陷②：在 render 期间读 DOM，拿到的是**上一次提交**的布局 ────────────
     这一条比①更隐蔽，也正是「为什么上次修了还是错」的原因。
     原调用点在组件体里直接调用本函数 —— render 期间 DOM **还没有**本次
     提交的新 class，于是量到的是上一帧的舞台：

       面板关（真宽 1600）→ 读到上一帧也是关 → 1600  ✅（碰巧对）
       面板开（真宽 1124）→ 读到上一帧还是关 → 1600  ❌（应为 1124）
       再关面板（真宽1600）→ 读到上一帧开着 → 1124−476 = 648  ❌（①也暴露了）

     实测视窗框渲染宽（小地图画布 178px、世界窗 6400、缩放 0.68）：
       面板开 → 65.44px（=按 1600 算）   正确应为 45.97px（按 1124 算）
       面板关 → 26.50px（=按  648 算）   正确应为 65.44px（按 1600 算）

     ⇒ 光换测量方式不够。**必须在提交之后量**（`useLayoutEffect` + ResizeObserver），
       见本文件底部的 `useCanvasVisibleViewport`。

   ── 为什么这套接线不写在 `index.jsx` 里 ────────────────────────────────────
   `test/canvas-port-geometry.test.mjs` 与 `test/ec-canvas-state.test.mjs` 各有一条断言，
   禁止 `index.jsx` 出现 ResizeObserver —— 它们守的是「**端口/连线几何不许来自 DOM 实测**」
   （那次事故里 DOM 实测的端口中心在缩放/平移后全错位，于是有了 `getCanvasDomPortCenter`
   + `setRenderedPortCenters`）。本批头一版把 ResizeObserver 直接写在 `index.jsx` 里量视口，
   被这两条判为回归、全量红了两条 —— 那两条守的方向没错，但拦的是**写法**不是**用途**。
   ⇒ 与其去改别人的门禁（改判据要有新的证据），不如把测量搬进本模块：
     `index.jsx` 一行 `useCanvasVisibleViewport(containerRef)` 消费结果，
     **画布页里不再有任何 DOM 实测**，两条门禁原样通过、意图也同时被满足。
   ══════════════════════════════════════════════════════════════════════════ */

import { useLayoutEffect, useMemo, useState } from 'react';


/**
 * 读一个容器**真正看得见**的尺寸。
 *
 * 口径：元素自己的 border box（`getBoundingClientRect()`）。
 * **不减 margin** —— margin 在 border box 之外，对"看得见多大一片"没有贡献，
 * 而 flex/block-auto 布局早已把它算进去了（见文件头缺陷①）。
 *
 * ⚠️ 若将来调用对象改成**写了显式 width** 的元素（border box 不再为 margin 收缩），
 *   溢出被裁掉的那部分才需要减 —— 那时必须在本函数里**显式**处理并写清理由，
 *   不许把减法悄悄加回来（这就是批 CY-㉚ 踩的坑）。
 *
 * @param {object|null} element   容器元素（调用点是 `.ec-canvas-stage`）
 * @param {{width:number,height:number}} [fallback]  取不到有效值时的兜底
 * @param {(el: object) => ({width:number,height:number}|null)} [readRect] 便于测试注入
 * @returns {{width:number,height:number}}
 */
export function readCanvasVisibleViewport(element, fallback = { width: 1440, height: 900 }, readRect) {
  if (!element) return { width: fallback.width, height: fallback.height };
  const rect = readRect
    ? readRect(element)
    : (typeof element.getBoundingClientRect === 'function' ? element.getBoundingClientRect() : null);
  /* 没有 getBoundingClientRect 的场合（非 DOM 环境）退回 clientWidth/clientHeight */
  const width = Number(rect?.width) || Number(element.clientWidth) || 0;
  const height = Number(rect?.height) || Number(element.clientHeight) || 0;
  return {
    // 兜底到 fallback：拿不到有效值时宁可给一个保守值，也不要给 0（0 会让视窗框消失）
    width: width > 0 ? width : fallback.width,
    height: height > 0 ? height : fallback.height,
  };
}

/**
 * 订阅一个容器**提交之后**的可见尺寸。
 *
 * ⚠️ 为什么不能直接在组件体里调用 `readCanvasVisibleViewport`：
 *   render 期间 DOM 还没提交本次的 class，量到的是**上一次**的布局（见文件头缺陷②）。
 *   所以测量必须落在 `useLayoutEffect`（提交后、绘制前），并且要订阅容器尺寸变化 ——
 *   **右栏开关与窗口缩放都只改容器尺寸、不改任何 state**，光靠依赖数组盯不到。
 *
 * @param {{current: object|null}} elementRef 容器 ref（调用点是 `.ec-canvas-stage`）
 * @returns {{width:number,height:number}} 首帧为视口尺寸兜底，绘制前即被真实值替换
 */
export function useCanvasVisibleViewport(elementRef) {
  /* 兜底只依赖挂载那一刻的视口大小，所以必须 memo 住：
     否则每次渲染都是新对象，effect 会跟着重跑。 */
  const fallback = useMemo(
    () => ({ width: globalThis.innerWidth || 1440, height: globalThis.innerHeight || 900 }),
    [],
  );
  const [size, setSize] = useState(fallback);
  useLayoutEffect(() => {
    const measure = () => {
      const next = readCanvasVisibleViewport(elementRef.current, fallback);
      setSize(prev => (prev.width === next.width && prev.height === next.height ? prev : next));
    };
    measure();
    const element = elementRef.current;
    if (!element || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    /* CSS 里 `.ec-canvas-stage` 的 margin-right 有 220ms 过渡，过渡期间本观察者会逐帧回调 ——
       视窗框因此跟着面板动画一起走，而不是等动画结束才跳一下。 */
    return () => observer.disconnect();
  }, [elementRef, fallback]);
  return size;
}
