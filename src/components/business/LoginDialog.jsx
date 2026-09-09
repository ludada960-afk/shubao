import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

/**
 * 登录弹窗外壳 (2026-09-09 v6)
 * 视觉语言与定价弹窗一致: 暖米底 + 琥珀橙 + 紫罗兰 + 毛玻璃 + 白色圆角卡片
 * 无障碍: role=dialog + aria-modal + 焦点陷阱 + Esc 关闭 + 背景滚动锁
 */
export default function LoginDialog({ onClose, labelledBy, children }) {
  const panelRef = useRef(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, []);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') { event.stopPropagation(); onClose?.(); return; }
      if (event.key !== 'Tab') return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusables = panel.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [onClose]);

  return (
    <div className="ld-overlay" onMouseDown={event => { if (event.target === event.currentTarget) onClose?.(); }}>
      <div className="ld-card" role="dialog" aria-modal="true" aria-labelledby={labelledBy} ref={panelRef}>
        <span className="ld-orbs" aria-hidden="true">
          <span className="ld-orb ld-orb--a" />
          <span className="ld-orb ld-orb--b" />
        </span>
        <button type="button" className="ld-close" onClick={onClose} aria-label="关闭">
          <X size={16} />
        </button>
        {children}
      </div>
    </div>
  );
}
