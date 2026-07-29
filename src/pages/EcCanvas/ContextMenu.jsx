import React, { useEffect, useRef } from 'react';

export default function ContextMenu({ x, y, node, actions = [], onClose, onAction }) {
  const ref = useRef(null);

  useEffect(() => {
    const handler = event => {
      if (ref.current && !ref.current.contains(event.target)) onClose?.();
    };
    window.addEventListener('pointerdown', handler);
    return () => window.removeEventListener('pointerdown', handler);
  }, [onClose]);

  return (
    <div ref={ref} role="menu" aria-label={`${node?.name || node?.displayLabel || '图片'}操作`} style={{
      position: 'fixed', left: Math.max(8, x), top: Math.max(8, y), zIndex: 10000,
      width: 'min(280px, calc(100vw - 16px))', maxHeight: 'min(620px, calc(100vh - 16px))', overflowY: 'auto',
      background: '#fff', borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.16), 0 2px 8px rgba(0,0,0,0.08)',
      border: '1px solid rgba(0,0,0,0.06)', padding: '6px 0',
    }}>
      <div style={{ padding: '7px 13px', color: '#778092', fontSize: 11, borderBottom: '1px solid rgba(15,23,42,.07)' }}>{node?.name || node?.displayLabel || '图片'}</div>
      {actions.map(action => (
        <button key={action.id} type="button" role="menuitem" onClick={() => { onAction?.(action, node); onClose?.(); }} style={{
          display: 'flex', alignItems: 'center', width: '100%', gap: 10, padding: '9px 13px', border: 0, textAlign: 'left', color: action.id === 'delete' ? '#c43d35' : '#1f2937', background: 'transparent', cursor: 'pointer', font: 'inherit', fontSize: 13,
        }} onMouseEnter={event => { event.currentTarget.style.background = action.id === 'delete' ? 'rgba(196,61,53,.07)' : 'rgba(37,99,235,.06)'; }} onMouseLeave={event => { event.currentTarget.style.background = 'transparent'; }}>
          <span style={{ flex: 1, fontWeight: 650 }}>{action.label}</span>
          {action.priceLabel && <span style={{ color: '#667085', fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap' }}>{action.priceLabel}</span>}
        </button>
      ))}
    </div>
  );
}
