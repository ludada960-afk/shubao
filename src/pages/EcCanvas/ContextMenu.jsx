import React, { useEffect, useRef } from 'react';

/* ═══════ 右键 AI 能力菜单 ═══════ */
const MENU_ITEMS = [
  { key: 'cutout', icon: '🖼️', label: 'AI 智能抠图', paid: true },
  { key: 'crop', icon: '✂️', label: '裁剪', paid: false },
  { key: 'redraw', icon: '🔄', label: '局部重绘', paid: true },
  { key: 'expand', icon: '📐', label: '智能延伸（扩图）', paid: true },
  { key: 'upscale', icon: '🔍', label: '无损超清放大', paid: true },
  { key: 'translate', icon: '🌐', label: 'AI 图片翻译', paid: true },
  { key: 'restore', icon: '✨', label: 'AI 超清修复', paid: true },
  { key: 'variant', icon: '🎨', label: '重新生成变体', paid: true },
  { type: 'divider' },
  { key: 'export', icon: '📥', label: '导出此图', paid: false },
];

export default function ContextMenu({ x, y, onClose, onAction, visible }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!visible) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose?.();
    };
    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, [visible, onClose]);

  if (!visible) return null;

  return (
    <div ref={ref} style={{
      position: 'fixed',
      left: x, top: y,
      zIndex: 10000,
      background: '#fff',
      borderRadius: 12,
      boxShadow: '0 8px 32px rgba(0,0,0,0.16), 0 2px 8px rgba(0,0,0,0.08)',
      border: '1px solid rgba(0,0,0,0.06)',
      padding: '6px 0',
      minWidth: 200,
      animation: 'ctxMenuIn 0.12s ease-out',
    }}>
      <style>{`@keyframes ctxMenuIn { from { opacity: 0; transform: scale(0.95) translateY(-4px); } to { opacity: 1; transform: scale(1) translateY(0); } }`}</style>

      {MENU_ITEMS.map((item, i) => {
        if (item.type === 'divider') {
          return <div key={i} style={{ height: 1, background: 'rgba(0,0,0,0.06)', margin: '4px 8px' }} />;
        }
        return (
          <div key={item.key}
            onClick={() => { onAction?.(item.key); onClose?.(); }}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 14px', cursor: 'pointer',
              fontSize: 13, color: '#1a1a1a',
              transition: 'background 0.1s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.04)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
            <span style={{ fontSize: 15, width: 20, textAlign: 'center' }}>{item.icon}</span>
            <span style={{ flex: 1, fontWeight: 500 }}>{item.label}</span>
            {item.paid && (
              <span style={{
                fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 4,
                background: 'linear-gradient(135deg, #7c3aed, #ec4899)',
                color: '#fff', letterSpacing: 0.3,
              }}>PRO</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
