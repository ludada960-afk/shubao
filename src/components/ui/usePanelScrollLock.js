import { useEffect } from 'react';

/**
 * 9-11 二轮用户批注: 面板打开期间, 页面不得滚动, 滚轮滚到哪里都只滚「当前面板」。
 * - 锁 page: body/html overflow hidden (带滚动条宽度补偿, 不跳版)。
 * - 面板内: 交给浏览器原生滚动 (不 preventDefault, 不重复滚)。
 * - 面板外: preventDefault 并把 deltaY 累加到面板 scrollTop。
 */
export const DEFAULT_PANEL_SELECTOR = '.ec-config-panel, .visual-config-panel, [data-wheel-scroll-panel="true"]';

export function usePanelScrollLock(open, { panelSelector = DEFAULT_PANEL_SELECTOR } = {}) {
  useEffect(() => {
    if (!open) return undefined;
    if (typeof document === 'undefined' || typeof window === 'undefined') return undefined;
    const { body, documentElement } = document;
    const previousBodyOverflow = body.style.overflow;
    const previousHtmlOverflow = documentElement.style.overflow;
    const previousPaddingRight = body.style.paddingRight;
    const scrollbarGap = Math.max(0, window.innerWidth - documentElement.clientWidth);
    body.style.overflow = 'hidden';
    documentElement.style.overflow = 'hidden';
    if (scrollbarGap > 0) body.style.paddingRight = `${scrollbarGap}px`;

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
        /* 面板本身不可滚 (内容一屏): 退回到面板内的可滚子节点 */
        const inner = primary.querySelector('[data-wheel-scroll-target="true"]');
        if (inner) inner.scrollTop += delta;
      }
    };

    window.addEventListener('wheel', handleWheel, { passive: false, capture: true });
    return () => {
      window.removeEventListener('wheel', handleWheel, { capture: true });
      body.style.overflow = previousBodyOverflow;
      documentElement.style.overflow = previousHtmlOverflow;
      body.style.paddingRight = previousPaddingRight;
    };
  }, [open, panelSelector]);
}

export default usePanelScrollLock;
