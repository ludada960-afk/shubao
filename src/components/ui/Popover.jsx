import React, { useState, useRef, useEffect } from 'react';
import { usePopoverGroup } from './PopoverGroup';

/**
 * Popover — 浅色浮动弹窗，锚定在触发按钮上。
 */
export default function Popover({ id, trigger, children, align = 'left', width = 320 }) {
  const group = usePopoverGroup();
  const isOpen = group ? group.openId === id : false;
  const anchorRef = useRef(null);
  const panelRef = useRef(null);
  const [pos, setPos] = useState({ top: 0, left: 0, goUp: false, bottom: 'auto' });
  const [positioned, setPositioned] = useState(false);

  const open = () => group?.setOpenId(id);
  const close = () => group?.close();

  useEffect(() => {
    if (!isOpen) { setPositioned(false); return; }
    requestAnimationFrame(() => {
      if (!anchorRef.current || !panelRef.current) { setPositioned(true); return; }
      const rect = anchorRef.current.getBoundingClientRect();
      const panelH = panelRef.current.offsetHeight;
      const spaceBelow = window.innerHeight - rect.bottom - 12;
      const goUp = spaceBelow < panelH + 20;
      let left = align === 'right' ? rect.right - width : rect.left;
      if (left + width > window.innerWidth - 12) left = window.innerWidth - width - 12;
      if (left < 12) left = 12;
      setPos({
        top: goUp ? rect.top - panelH - 8 : rect.bottom + 8,
        left, goUp,
        bottom: goUp ? window.innerHeight - rect.top + 8 : 'auto',
      });
      setPositioned(true);
    });
  }, [isOpen, align, width]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target) && anchorRef.current && !anchorRef.current.contains(e.target)) close();
    };
    const timer = setTimeout(() => document.addEventListener('mousedown', handler), 0);
    return () => { clearTimeout(timer); document.removeEventListener('mousedown', handler); };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen]);

  return (
    <>
      <div ref={anchorRef} onClick={isOpen ? close : open} style={{ display: 'contents' }}>
        {trigger}
      </div>
      {isOpen && (
        <div ref={panelRef} style={{
          position: 'fixed',
          top: pos.goUp ? 'auto' : pos.top,
          bottom: pos.goUp ? pos.bottom : 'auto',
          left: pos.left,
          width,
          zIndex: 9999,
          background: '#fff',
          borderRadius: 18,
          border: '1px solid var(--border)',
          boxShadow: '0 18px 46px rgba(57,45,26,0.16)',
          padding: 0,
          overflow: 'hidden',
          opacity: positioned ? 1 : 0,
          transform: positioned ? 'translateY(0)' : 'translateY(-6px)',
          transition: positioned ? 'opacity 0.12s ease, transform 0.12s ease' : 'none',
          pointerEvents: positioned ? 'auto' : 'none',
        }}>
          {children}
        </div>
      )}
    </>
  );
}
