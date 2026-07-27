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
        <footer style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>{dialog.kind !== 'notice' && <button type="button" onClick={() => finish(dialog.kind === 'text' ? null : false)} style={{ minHeight: 38, padding: '0 16px', border: '1px solid #d0d5dd', borderRadius: 9, background: '#fff', cursor: 'pointer', fontWeight: 700 }}>取消</button>}<button type="button" disabled={dialog.kind === 'text' && !dialog.value.trim()} onClick={() => finish(dialog.kind === 'text' ? dialog.value.trim() : true)} style={{ minHeight: 38, padding: '0 16px', border: 0, borderRadius: 9, background: '#1f2937', color: '#fff', cursor: 'pointer', fontWeight: 800 }}>{dialog.confirmLabel}</button></footer>
      </section>
    </div>}
  </DialogContext.Provider>;
}

export function useDialog() {
  const value = useContext(DialogContext);
  if (!value) throw new Error('useDialog must be used inside DialogProvider');
  return value;
}
