import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

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
    const idealLeft = align === 'start' ? rect.left : rect.right - measuredWidth;
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
    globalThis.addEventListener('scroll', reposition, true);
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      globalThis.removeEventListener('resize', reposition);
      globalThis.removeEventListener('scroll', reposition, true);
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [anchorRef, onDismiss, open, reposition]);

  if (!open || !globalThis.document?.body) return null;
  return createPortal(
    <div
      ref={contentRef}
      className={className}
      data-anchored-portal="true"
      style={{
        position: 'fixed',
        zIndex: 12050,
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
