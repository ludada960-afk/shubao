import { useEffect } from 'react';

import { acquirePageScrollLock } from './useModalScrollLock.js';

/**
 * 9-11 用户批注: 面板打开期间页面不得滚动, 滚轮滚到哪里都只滚「当前面板」。
 * - 页面锁走共享计数 (acquirePageScrollLock), 与弹窗叠加也安全 (不会把页面锁死)。
 * - 面板内: 交给浏览器原生滚动 (不 preventDefault, 不重复滚)。
 * - 面板外: preventDefault 并把 deltaY 累加到面板 scrollTop。
 */
export const DEFAULT_PANEL_SELECTOR = '.ec-config-panel, .visual-config-panel, [data-wheel-scroll-panel="true"]';

export function usePanelScrollLock(open, { panelSelector = DEFAULT_PANEL_SELECTOR } = {}) {
  useEffect(() => {
    if (!open) return undefined;
    if (typeof document === 'undefined' || typeof window === 'undefined') return undefined;
    const release = acquirePageScrollLock();

    const visiblePanels = () => Array.from(document.querySelectorAll(panelSelector))
      .filter(element => element instanceof HTMLElement && element.offsetParent !== null);

    const handleWheel = event => {
      if (event.ctrlKey) return;
      const panels = visiblePanels();
      if (!panels.length) return;
      const path = typeof event.composedPath === 'function' ? event.composedPath() : [event.target];
      const owner = panels.find(panel => path.includes(panel));
      if (owner) return; /* 面板内: 原生滚动 */
      event.preventDefault();
      const primary = panels[panels.length - 1];
      const delta = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY;
      primary.scrollTop += delta;
      if (primary.scrollHeight <= primary.clientHeight + 1) {
        const inner = primary.querySelector('[data-wheel-scroll-target="true"]');
        if (inner) inner.scrollTop += delta;
      }
    };

    window.addEventListener('wheel', handleWheel, { passive: false, capture: true });
    return () => {
      window.removeEventListener('wheel', handleWheel, { capture: true });
      release();
    };
  }, [open, panelSelector]);
}

export default usePanelScrollLock;
