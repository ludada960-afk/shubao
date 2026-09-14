import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { MdClose } from 'react-icons/md';

const DialogContext = createContext(null);

export function DialogProvider({ children }) {
  const [dialog, setDialog] = useState(null);
  const resolverRef = useRef(null);
  const finish = useCallback((value) => {
    resolverRef.current?.(value);
    resolverRef.current = null;
    setDialog(null);
  }, []);
  const open = useCallback((options) => new Promise(resolve => {
    resolverRef.current?.(false);
    resolverRef.current = resolve;
    setDialog({ kind: 'notice', title: '提示', confirmLabel: '知道了', ...options });
  }), []);
  const dialogs = {
    notice: options => open({ ...options, kind: 'notice' }),
    confirm: options => open({ ...options, kind: 'confirm', confirmLabel: options?.confirmLabel || '确认' }),
    text: options => open({ ...options, kind: 'text', value: options?.defaultValue || '', confirmLabel: options?.confirmLabel || '保存' }),
  };
  return <DialogContext.Provider value={dialogs}>
    {children}
    {dialog && <div role="presentation" onMouseDown={() => finish(dialog.kind === 'text' ? null : false)} style={{ position: 'fixed', inset: 0, zIndex: 12000, display: 'grid', placeItems: 'center', padding: 20, background: 'rgba(17,24,39,.42)', backdropFilter: 'blur(8px)' }}>
      <section role="dialog" aria-modal="true" aria-labelledby="app-dialog-title" onMouseDown={event => event.stopPropagation()} style={{ width: 'min(420px, 100%)', border: '1px solid rgba(15,23,42,.08)', borderRadius: 16, background: '#fff', boxShadow: '0 24px 80px rgba(15,23,42,.24)', padding: 22 }}>
        <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}><div><h2 id="app-dialog-title" style={{ margin: 0, fontSize: 18 }}>{dialog.title}</h2>{dialog.message && <p style={{ margin: '8px 0 0', color: '#667085', fontSize: 13, lineHeight: 1.6 }}>{dialog.message}</p>}</div><button type="button" aria-label="关闭" title="关闭" onClick={() => finish(dialog.kind === 'text' ? null : false)} style={{ display: 'grid', placeItems: 'center', width: 30, height: 30, border: 0, borderRadius: 8, background: '#f3f4f6', cursor: 'pointer' }}><MdClose size={16} /></button></header>
        {dialog.kind === 'text' && <input autoFocus value={dialog.value} onChange={event => setDialog(current => ({ ...current, value: event.target.value }))} onKeyDown={event => { if (event.key === 'Enter' && dialog.value.trim()) finish(dialog.value.trim()); if (event.key === 'Escape') finish(null); }} placeholder={dialog.placeholder} style={{ boxSizing: 'border-box', width: '100%', marginTop: 18, padding: '11px 12px', border: '1px solid #d0d5dd', borderRadius: 9, outline: 0, font: 'inherit' }} />}
        {/* 9-16 对齐全站底部操作区规范（--footer-actions-*）：
             按钮间距 8 → 12px；按钮高度 38 → 36px 统一档 + 最小宽 88px + 圆角 10px（主次等重）。
             **关键修复**：确认按钮在 kind='text' 且输入为空时是 disabled 的，但原来内联样式
             完全没有 disabled 分支 —— 禁用后仍是深色实心 + 白字 + cursor: pointer，
             用户看到的是「可点却点不动」的主按钮（全站最偏离的一处）。
             现在走 .ui-btn:disabled（明确底色 + 明确文字色 + not-allowed）。 */}
        <footer className="ui-modal-footer" style={{ marginTop: 20, padding: 0, borderTop: 0 }}>
          <div className="ui-modal-footer-actions">
            {dialog.kind !== 'notice' && <button type="button" className="ui-btn ui-btn-secondary" onClick={() => finish(dialog.kind === 'text' ? null : false)}>取消</button>}
            <button type="button" className="ui-btn ui-btn-primary is-dark" disabled={dialog.kind === 'text' && !dialog.value.trim()} onClick={() => finish(dialog.kind === 'text' ? dialog.value.trim() : true)}>{dialog.confirmLabel}</button>
          </div>
        </footer>
      </section>
    </div>}
  </DialogContext.Provider>;
}

export function useDialog() {
  const value = useContext(DialogContext);
  if (!value) throw new Error('useDialog must be used inside DialogProvider');
  return value;
}
