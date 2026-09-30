/* ═══ 2026-09-29 批 DC 续-18：**滚轮一滚，浮层就关**（用户实测知渔后的全局口径）══════════════════
   用户 2026-09-29 逐字：
   > 「其实我自己去测试了一下知渔他们的做法。我发现他们好像全局都是把这种按钮张开面板的时候，
   >   如果用户去滚动鼠标滚轮的话，**面板就会自动关闭**。我们现在的情况是不管首页的两个板块，还是
   >   各种子页面，还是画布里面？所有的地方我们的面板逻辑跟他们都不一样。现在我们滚动我们的滚轮
   >   的话，这个面板只要是张开的状态，它会跟着滚动，这其实可能会造成很多的 bug。
   >   我觉得还不如就照他那种做法，就是当张开面板的时候，用户滚动鼠标滚轮这个面板就会自己关掉。
   >   **你全局都要去实现这个方案。**」

   为什么值得这么做（不只是"跟竞品一样"）：
     · **跟着滚的浮层天生会撕裂** —— 锚点在动、浮层在动，两者不同步就会出现"面板盖住别的控件"
       "点面板里的东西点到了下面"，每出现一次都要单独修一次；
     · 滚轮是**明确的用户意图**（"我要看别的地方了"），关掉浮层是最省事的解读；
     · 它同时把 2026-09-29 批 DC 续-15 / 续-17 反复折腾的"锚点跟着滚"整条消掉 ——
       浮层不再需要跟随，也就不需要 scroll 监听、不需要量锚点、不需要翻转逻辑。

   ⚠️ **只有一个监听器**（挂在 document 上，capture），所有浮层走**订阅**。
     每处各自 `addEventListener('scroll')` 就是"每处一份实现"，那正是本仓最忌讳的第二套真相。 */
import { useEffect, useRef } from 'react';

const subscribers = new Set();
let installed = false;

/** 装一次全局监听。幂等 —— 调多少次都只装一个。 */
function ensureInstalled() {
  if (installed || typeof document === 'undefined') return;
  installed = true;

  /* `wheel` + `scroll` 两个都收：
       · `wheel` 是**用户主动滚**（知渔那个行为就是它）；
       · `scroll` 兜住**代码滚动 / 拖滚动条 / 键盘翻页** —— 那些同样让浮层失去意义。
     ⚠️ 都用 capture：左栏、面板内部都是独立滚动容器，冒泡阶段收不到它们的 scroll。 */
  const dismiss = event => {
    /* 事件从**浮层自己**里冒出来就别关 —— 用户在面板内部滚动（例如比例那 12 档的列表）
       不该把面板关掉。判据：composedPath 里有没有标了 overlay 根的节点。 */
    if (event && typeof event.composedPath === 'function') {
      for (const node of event.composedPath()) {
        if (node && node.nodeType === 1 && node.getAttribute && node.getAttribute(OVERLAY_ROOT_ATTR) !== null) return;
      }
    }
    for (const close of [...subscribers]) {
      try { close(event); } catch { /* 一个订阅者出错不许影响其它浮层 */ }
    }
  };

  document.addEventListener('wheel', dismiss, { capture: true, passive: true });
  document.addEventListener('scroll', dismiss, { capture: true, passive: true });
  window.addEventListener('resize', dismiss, { passive: true });
}

/** 给浮层根节点用：标一下"我是个浮层"，上面那个 capture 监听据此放过面板内部的滚动。 */
export const OVERLAY_ROOT_ATTR = 'data-overlay-root';

/** 订阅"滚轮/滚动 ⇒ 收起"，返回取消订阅函数（useEffect 的 cleanup 直接用）。 */
export function subscribeDismissOverlay(close, active = true) {
  if (!active || typeof document === 'undefined' || typeof close !== 'function') return () => {};
  ensureInstalled();
  subscribers.add(close);
  return () => { subscribers.delete(close); };
}

/** React 版：`active` 为真期间订阅，用户一滚/一缩放就调 `onClose`。
 *  `onClose` 走 ref 转发，所以调用方不必把它放进依赖数组（否则每次渲染都退订重订）。 */
export function useDismissOverlay(active, onClose) {
  const latest = useRef(onClose);
  latest.current = onClose;
  useEffect(() => {
    if (!active) return undefined;
    return subscribeDismissOverlay(() => {
      if (typeof latest.current === 'function') latest.current();
    }, true);
  }, [active]);
}
