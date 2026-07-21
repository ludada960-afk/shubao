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
    info: '#7c3aed',
    success: '#10b981',
    error: '#ef4444',
    warning: '#f59e0b',
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
.      {/* Toast 渲染层 */}
      <div style={{
        position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
        zIndex: 10000, display: 'flex', flexDirection: 'column', gap: 8,
        alignItems: 'center', pointerEvents: 'none',
      }}>
        {toasts.map(t => (
          <div key={t.id} style={{
            background: colors[t.type] || colors.info,
            color: '#fff', fontSize: 13, fontWeight: 600,
            padding: '10px 20px', borderRadius: 10,
            boxShadow: '0 6px 20px rgba(0,0,0,0.2)',
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
