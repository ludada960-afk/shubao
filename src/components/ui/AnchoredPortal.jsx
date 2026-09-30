import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { useDismissOverlay, OVERLAY_ROOT_ATTR } from '../media/useDismissOverlay.js';

const VIEWPORT_GAP = 10;

export default function AnchoredPortal({
  anchorRef,
  open,
  onDismiss,
  children,
  align = 'end',
  minWidth = 220,
  maxWidth = 420,
  className = '',
}) {
  const contentRef = useRef(null);
  const [position, setPosition] = useState({ top: 0, left: 0, width: minWidth, maxHeight: 320, visibility: 'hidden' });

  const reposition = useCallback(() => {
    const anchor = anchorRef?.current;
    if (!anchor || !open) return;
    const rect = anchor.getBoundingClientRect();
    const viewportWidth = globalThis.innerWidth || document.documentElement.clientWidth;
    const viewportHeight = globalThis.innerHeight || document.documentElement.clientHeight;
    const measuredWidth = Math.min(maxWidth, Math.max(minWidth, contentRef.current?.offsetWidth || minWidth));
    const measuredHeight = contentRef.current?.offsetHeight || 260;
    const roomBelow = viewportHeight - rect.bottom - VIEWPORT_GAP;
    const roomAbove = rect.top - VIEWPORT_GAP;
    const placeAbove = roomBelow < Math.min(measuredHeight, 260) && roomAbove > roomBelow;
    const maxHeight = Math.max(160, (placeAbove ? roomAbove : roomBelow) - VIEWPORT_GAP);
    const idealLeft = align === 'center'
      ? rect.left + (rect.width - measuredWidth) / 2
      : align === 'start' ? rect.left : rect.right - measuredWidth;
    const left = Math.max(VIEWPORT_GAP, Math.min(idealLeft, viewportWidth - measuredWidth - VIEWPORT_GAP));
    const top = placeAbove
      ? Math.max(VIEWPORT_GAP, rect.top - Math.min(measuredHeight, maxHeight) - VIEWPORT_GAP)
      : Math.min(viewportHeight - VIEWPORT_GAP, rect.bottom + VIEWPORT_GAP);
    setPosition({ top, left, width: measuredWidth, maxHeight, visibility: 'visible' });
  }, [align, anchorRef, maxWidth, minWidth, open]);

  useLayoutEffect(() => {
    if (open) reposition();
  }, [open, reposition]);

  useEffect(() => {
    if (!open) return undefined;
    const handlePointerDown = event => {
      if (contentRef.current?.contains(event.target) || anchorRef?.current?.contains(event.target)) return;
      onDismiss?.();
    };
    const handleKeyDown = event => {
      if (event.key === 'Escape') onDismiss?.();
    };
    globalThis.addEventListener('resize', reposition);
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      globalThis.removeEventListener('resize', reposition);
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [anchorRef, onDismiss, open, reposition]);

  /* ═══ 2026-09-29 批 DC 续-18：**滚一滚就关**（用户实测知渔后的全局口径）══════════════════════
     原来这里是 `addEventListener('scroll', reposition, true)` —— 面板**跟着滚**。
     那是"跟滚"那一族的最后一份：跟着滚的浮层天生会撕裂（锚点在动、浮层在动，
     不同步就出现"面板盖住别的控件""点面板里的东西点到下面"）。
     ⇒ 删掉跟随、改成收起；`resize` 保留（视口尺寸真的变了，重量坐标是对的）。
     这一处覆盖 4 个浮层（品牌色取色盘 / 画面比例 12 档 / 电商平台 / 目标语言）。 */
  useDismissOverlay(Boolean(open), onDismiss);

  if (!open || !globalThis.document?.body) return null;
  return createPortal(
    <div
      ref={contentRef}
      className={className}
      data-anchored-portal="true"
      /* 标成浮层根：全局那个滚轮监听据此**放过面板内部**的滚动。
         ⚠️ 比例那 12 档列表本身就是可滚的（`maxHeight` + `overflow:auto`）——
            不打这个标记，用户在档位里滚一下整个面板就关了。 */
      {...{ [OVERLAY_ROOT_ATTR]: 'true' }}
      style={{
        position: 'fixed',
        zIndex: 'var(--sb-z-tooltip)',
        top: position.top,
        left: position.left,
        width: position.width,
        maxHeight: position.maxHeight,
        overflow: 'auto',
        visibility: position.visibility,
      }}
    >{children}</div>,
    document.body,
  );
}
