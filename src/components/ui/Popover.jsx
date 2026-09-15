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

  /* D11 键盘可达：原实现在 display:contents 包装层上挂 onClick —— 键盘无法聚焦/触发，
     且包装层不是语义元素。改为把语义（role/aria-expanded/键盘激活）注入触发器本身，
     包装层退回纯测量锚点（display:contents 不产生盒子，视觉零变化）。 */
  const triggerNode = React.isValidElement(trigger)
    ? React.cloneElement(trigger, {
        'aria-haspopup': 'true',
        'aria-expanded': isOpen,
        onClick: (event) => {
          trigger.props.onClick?.(event);
          if (event.defaultPrevented) return;
          isOpen ? close() : open();
        },
        onKeyDown: (event) => {
          trigger.props.onKeyDown?.(event);
          if (event.defaultPrevented) return;
          if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
            event.preventDefault();
            isOpen ? close() : open();
          }
          if (event.key === 'Escape' && isOpen) { event.preventDefault(); close(); }
        },
      })
    : trigger;

  return (
    <>
      <span ref={anchorRef} style={{ display: 'contents' }}>
        {triggerNode}
      </span>
      {isOpen && (
        <div ref={panelRef} style={{
          position: 'fixed',
          top: pos.goUp ? 'auto' : pos.top,
          bottom: pos.goUp ? pos.bottom : 'auto',
          left: pos.left,
          width,
          zIndex: 'var(--sb-z-dropdown)',
          background: 'var(--sb-neutral-0)',
          borderRadius: 'var(--sb-radius-2xl)',
          /* D34 已收敛：阴影字面量 `0 18px 46px rgba(57,45,26,0.16)` → var(--sb-shadow-4)。
             定档用的是**角色**（Popover = 浮层面板 → 4 档），不是「数值最近」——
             这是 D34 对 D20-A 的口径细化：D20-A 的 α 表适用于「只有值、没有角色信息」的
             token 迁移；对**组件内已知角色的字面量**按角色定档（与 D29 同一把尺）。
             有意变更：α .16 → .13、偏移 18→12、模糊 46→36（并多一层 `0 2px 8px`）。 */
          border: '1px solid var(--sb-border-default)',
          boxShadow: 'var(--sb-shadow-4)',
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
