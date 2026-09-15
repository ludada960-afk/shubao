import React, { createContext, useContext, useState, useCallback } from 'react';

/**
 * C8: 全局 Toast 提示系统
 * 用法：
 *   const { toast } = useToast();
 *   toast('消息内容', 'success');
 */
const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const remove = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const toast = useCallback((msg, type = 'info', duration = 3000) => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, msg, type }]);
    if (duration > 0) {
      setTimeout(() => remove(id), duration);
    }
  }, [remove]);

  const colors = {
    info: 'var(--sb-brand)',
    success: 'var(--sb-success)',
    error: 'var(--sb-danger)',
    warning: 'var(--sb-warning)',
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
.      {/* Toast 渲染层 */}
      <div style={{
        position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
        zIndex: 'var(--sb-z-toast)', display: 'flex', flexDirection: 'column', gap: 8,
        alignItems: 'center', pointerEvents: 'none',
      }}>
        {toasts.map(t => (
          <div key={t.id} style={{
            background: colors[t.type] || colors.info,
            color: 'var(--sb-neutral-0)', fontSize: 'var(--sb-text-md)', fontWeight: 600,
            padding: '10px 20px', borderRadius: 'var(--sb-radius-lg)',
            /* D34 已收敛：`0 6px 20px rgba(12,10,9,0.2)` → var(--sb-shadow-3)。
               定档按**角色**（Toast = 瞬态浮层，与 dropdown/popover 同档）。
               有意变更：α .2 → .10、模糊 20→16；几何最接近（偏移 6→4）。 */
            boxShadow: 'var(--sb-shadow-3)',
            animation: 'toastSlideIn 0.3s ease',
            maxWidth: '90vw', wordBreak: 'break-word',
          }}>
            {t.msg}
          </div>
        ))}
      </div>
      <style>{`
        @keyframes toastSlideIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) return { toast: (msg) => console.log('[toast]', msg) };
  return ctx;
}
