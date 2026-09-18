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
  /* ESC 关闭：dismissBackdrop === false 的对话（画布离开询问）忽略 ESC —— 即"什么都不发生"。
     其它对话保持原有 ESC 行为不变。 */
  React.useEffect(() => {
    if (!dialog) return undefined;
    const onKey = event => {
      if (event.key !== 'Escape') return;
      if (dialog.dismissBackdrop === false) return;
      finish(dialog.kind === 'text' ? null : false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dialog, finish]);
  const open = useCallback((options) => new Promise(resolve => {
    resolverRef.current?.(false);
    resolverRef.current = resolve;
    setDialog({ kind: 'notice', title: '提示', confirmLabel: '知道了', ...options });
  }), []);
  const dialogs = {
    notice: options => open({ ...options, kind: 'notice' }),
    /* cancelLabel / hideClose 是 2026-09-18 新增的**可选**能力，默认值与原来完全一致
       （cancelLabel 缺省仍是「取消」、X 默认显示）—— 全站其它 confirm 调用点零变化。
       画布「离开时保存画布」的询问需要它们：
         · 两个选项必须语义明确（不保存 / 保存），「取消」会被理解成"取消这次操作"；
         · 右上角 X 有同样歧义 → 该询问直接不显示 X。 */
    confirm: options => open({ ...options, kind: 'confirm', confirmLabel: options?.confirmLabel || '确认', cancelLabel: options?.cancelLabel || '取消' }),
    text: options => open({ ...options, kind: 'text', value: options?.defaultValue || '', confirmLabel: options?.confirmLabel || '保存' }),
  };
  return <DialogContext.Provider value={dialogs}>
    {children}
    {dialog && <div role="presentation" onMouseDown={() => { if (dialog.dismissBackdrop === false) return; finish(dialog.kind === 'text' ? null : false); }} style={{ position: 'fixed', inset: 0, zIndex: 'var(--sb-z-top)', display: 'grid', placeItems: 'center', padding: 20, background: 'var(--sb-scrim)' }}>
      {/* D34（2026-09-15）已收敛：原先的**冷蓝灰族**（slate）已按 D4「覆盖/描边一律暖黑」改暖 ——
          · 边框 rgba(15,23,42,.08) → var(--sb-border-subtle)
          · 阴影 0 24px 80px rgba(15,23,42,.24) → var(--sb-shadow-5)
          · 文字 #667085 → var(--sb-ink-3)
          · 输入框描边 #d0d5dd → var(--sb-border-default)
          这是**有意观感变更**（冷灰→暖黑/暖棕），依据 D4 + D1 补充裁定（暖域一致性）。
          ⚠️ 原来注释写的是「若要收敛应由设计裁定改暖」—— 那次裁定就是 D34。 */}
      <section role="dialog" aria-modal="true" aria-labelledby="app-dialog-title" onMouseDown={event => event.stopPropagation()} style={{ width: 'min(420px, 100%)', border: '1px solid var(--sb-border-subtle)', borderRadius: 16, background: 'var(--sb-neutral-0)', boxShadow: 'var(--sb-shadow-5)', padding: 22 }}>
        <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}><div><h2 id="app-dialog-title" style={{ margin: 0, fontSize: 18 }}>{dialog.title}</h2>{dialog.message && <p style={{ margin: '8px 0 0', color: 'var(--sb-ink-3)', fontSize: 13, lineHeight: 1.6 }}>{dialog.message}</p>}</div>{dialog.hideClose !== true && <button type="button" aria-label="关闭" title="关闭" onClick={() => finish(dialog.kind === 'text' ? null : false)} style={{ display: 'grid', placeItems: 'center', width: 30, height: 30, border: 0, borderRadius: 8, background: 'var(--sb-neutral-100)', cursor: 'pointer' }}><MdClose size={16} /></button>}</header>
        {/* ═══ 批 J-⑭：对话框支持**富文本体**（生成预览要把"这次到底发什么"摊开给用户看）
            ⚠️ 只是**多一个可选插槽**：不传 body 时渲染结果与从前逐字节相同。 */}
        {dialog.body && <div style={{ marginTop: 14 }}>{dialog.body}</div>}
        {dialog.kind === 'text' && <input autoFocus value={dialog.value} onChange={event => setDialog(current => ({ ...current, value: event.target.value }))} onKeyDown={event => { if (event.key === 'Enter' && dialog.value.trim()) finish(dialog.value.trim()); if (event.key === 'Escape') finish(null); }} placeholder={dialog.placeholder} style={{ boxSizing: 'border-box', width: '100%', marginTop: 18, padding: '11px 12px', border: '1px solid var(--sb-border-default)', borderRadius: 8, outline: 0, font: 'inherit' }} />}
        {/* 9-16 对齐全站底部操作区规范（--footer-actions-*）：
             按钮间距 8 → 12px；按钮高度 38 → 36px 统一档 + 最小宽 88px + 圆角 10px（主次等重）。
             **关键修复**：确认按钮在 kind='text' 且输入为空时是 disabled 的，但原来内联样式
             完全没有 disabled 分支 —— 禁用后仍是深色实心 + 白字 + cursor: pointer，
             用户看到的是「可点却点不动」的主按钮（全站最偏离的一处）。
             现在走 .ui-btn:disabled（明确底色 + 明确文字色 + not-allowed）。 */}
        <footer className="ui-modal-footer" style={{ marginTop: 20, padding: 0, borderTop: 0 }}>
          <div className="ui-modal-footer-actions">
            {dialog.kind !== 'notice' && <button type="button" className="ui-btn ui-btn-secondary" onClick={() => finish(dialog.kind === 'text' ? null : false)}>{dialog.cancelLabel || '取消'}</button>}
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
