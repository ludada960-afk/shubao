/* ══════════════════════════════════════════════════════════════════════════════
   节点**渲染矩形** —— 连线端点的唯一真相来源（2026-10-04）

   为什么需要它：连线端点一直是这么算的
       x = node.x + node.w ± CANVAS_PORT_CENTER_OFFSET(17)
   而加号按钮（`.ec-canvas-node-port`）是**贴��渲染出来的元素**放的。
   只要「模型矩形」与「渲染矩形」不是同一个东西，端点就一定对不上。

   哪些节点会不一致？（都实测过）
     · 生成框 / composer 面板：视觉宽度 > node.w（要放参考图槽、输入框、底栏）
     · 带 footer 的卡片：视觉高度 = node.h + 46
     · 被 CSS 改过 min-height / border-box 的变体（is-video / is-text / is-direction）
   ⇒ 于是线会从半空里开始或结束，**离加号差几十像素**。
   这是用户反复报「连线还是没连上」的同一个根因（2026-10-03/04 连续三轮）。

   业界口径（查证）：
     · React Flow：`nodeInternals.handleBounds` —— 端点取**实测**的 handle 盒子，
       量不到时才退回 `node.positionAbsolute + width/height`。
     · tldraw：端口绑在 shape 的渲染几何上。
     · Excalidraw：箭头端点从元素的 AABB 推导。
   三家都**不以模型 rect 为准**。

   ⇒ 这里照做：提交后由一个 hook 量一次（与本仓 `canvasVisibleViewport.js`
     同一纪律：DOM 读只能放在提交后的 hook 里，不许进渲染路径），
     量到的 rect 换算回世界坐标后交给 `getNodePortCenter` 优先使用；
     量不到（节点还没渲染 / 被裁剪）就退回模型 rect，行为与今天一致。 */

import { useLayoutEffect } from 'react';

const rects = new Map();

/** 实测矩形（屏幕像素）→ 世界坐标。逆运算见 canvasState.toWorldPoint。 */
export function screenRectToWorld(rect, originRect, viewport) {
  const scale = Number(viewport?.scale) || 1;
  const originLeft = Number(originRect?.left) || 0;
  const originTop = Number(originRect?.top) || 0;
  const vx = Number(viewport?.x) || 0;
  const vy = Number(viewport?.y) || 0;
  return {
    x: ((Number(rect?.left) || 0) + (Number(rect?.width) || 0) / 2 - originLeft - vx) / scale,
    y: ((Number(rect?.top) || 0) + (Number(rect?.height) || 0) / 2 - originTop - vy) / scale,
  };
}

/** 取某个节点**端口**的实测世界坐标中心；量不到返回 null（调用方退回模型口径）。 */
export function measuredPortCenter(nodeId, port, originRect, viewport) {
  const bucket = rects.get(String(nodeId));
  if (!bucket) return null;
  const rect = port === 'input' || port === 'in' ? bucket.input : bucket.output;
  if (!rect || !(Number(rect.width) > 0) || !(Number(rect.height) > 0)) return null;
  return screenRectToWorld(rect, originRect, viewport);
}

/** 手工登记（测试与无 DOM 环境用）。 */
export function registerCanvasNodeRect(nodeId, { input = null, output = null } = {}) {
  rects.set(String(nodeId), { input, output });
}

export function clearCanvasNodeRect(nodeId) {
  if (nodeId === undefined) rects.clear();
  else rects.delete(String(nodeId));
}

export function measuredCanvasNodeRectCount() {
  return rects.size;
}

function measurePorts(container) {
  if (!container || typeof document === 'undefined') return;
  const nodes = container.querySelectorAll('[data-canvas-node-id]');
  const seen = new Set();
  nodes.forEach(nodeEl => {
    const id = nodeEl.getAttribute('data-canvas-node-id');
    if (!id) return;
    seen.add(id);
    const input = nodeEl.querySelector('.ec-canvas-node-port.is-input, [data-canvas-port-role="input"]');
    const output = nodeEl.querySelector('.ec-canvas-node-port:not(.is-input), [data-canvas-port-role="output"]');
    rects.set(id, {
      input: input ? input.getBoundingClientRect() : null,
      output: output ? output.getBoundingClientRect() : null,
    });
  });
  /* 节点被删掉后别让表无限增长（长会话里这是真实泄漏）。 */
  rects.forEach((_, id) => { if (!seen.has(id)) rects.delete(id); });
}

/**
 * 量端口并跟随变化。
 * @param {React.MutableRefObject<HTMLElement|null>} containerRef 画布 stage
 * @param {object} viewport 缩放/平移（变了要重量，否则世界坐标不对）
 */
export function useCanvasNodePortRects(containerRef, viewport) {
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;
    measurePorts(container);
    const onResize = () => measurePorts(container);
    window.addEventListener('resize', onResize);
    /* rAF 节流：拖动/缩放期间每帧最多量一次；只读 rect、不写 state（不会触发回流）。 */
    let frame = 0;
    const schedule = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => { frame = 0; measurePorts(container); });
    };
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(schedule) : null;
    ro?.observe(container);
    /* 节点内容变化（加 footer、面板展开）也会改端口位置 ⇒ 观察子树。 */
    const mo = typeof MutationObserver === 'function' ? new MutationObserver(schedule) : null;
    mo?.observe(container, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style'] });
    return () => {
      window.removeEventListener('resize', onResize);
      ro?.disconnect();
      mo?.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, [containerRef, viewport?.x, viewport?.y, viewport?.scale]);
}
