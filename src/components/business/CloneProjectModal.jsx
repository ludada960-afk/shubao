// src/components/business/CloneProjectModal.jsx
// 4c183cd4 续命 P-C 1-click 派生升级: 派生此项目 弹窗
// 模板选择: same-style (同风格) | change-style (变风格) | change-angle (变角度)
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Copy, Sparkles, Move3d, X, Loader2 } from 'lucide-react';
import { cloneProject } from '../../services/api.js';

const CLONE_OPTIONS = [
  {
    id: 'same-style',
    label: '同风格派生',
    desc: '保留原项目的视觉风格、构图与产品角度,只换一组素材或场景。适合批量生产同款产品图。',
    icon: Copy,
    recommended: true,
  },
  {
    id: 'change-style',
    label: '变风格派生',
    desc: '保留产品主体,切换整体视觉风格 (色系/材质/光影),用于 A/B 测试不同风格方向。',
    icon: Sparkles,
  },
  {
    id: 'change-angle',
    label: '变角度派生',
    desc: '保持风格一致,改变镜头角度与构图 (平拍/俯拍/45 度/特写),扩展产品视角覆盖。',
    icon: Move3d,
  },
];

function classNames(...values) {
  return values.filter(Boolean).join(' ');
}

function isValidTitle(value) {
  const v = String(value || '').trim();
  return v.length > 0 && v.length <= 80;
}

export default function CloneProjectModal({ open, project, onClose, onCloned, defaultMode = 'same-style' }) {
  const [mode, setMode] = useState(defaultMode);
  const [titleHint, setTitleHint] = useState('');
  const [targetKind, setTargetKind] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setMode(defaultMode);
    setTitleHint('');
    setTargetKind(String(project?.kind || '').trim());
    setError('');
    setBusy(false);
    const t = setTimeout(() => inputRef.current && inputRef.current.focus(), 50);
    return () => clearTimeout(t);
  }, [open, defaultMode, project]);

  const close = useCallback(() => {
    if (busy) return;
    onClose && onClose();
  }, [busy, onClose]);

  useEffect(() => {
    if (!open) return undefined;
    const handler = (event) => {
      if (event.key === 'Escape' && !busy) close();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, busy, close]);

  const projectId = project?.id || project?.projectId || '';
  const projectTitle = String(project?.title || '').trim();
  const kinds = useMemo(() => {
    const list = ['video', 'ecommerce', 'xiaohongshu', 'plog'];
    const cur = String(project?.kind || '').trim();
    const set = new Set(list);
    if (cur) set.add(cur);
    return Array.from(set);
  }, [project]);

  const handleSubmit = useCallback(async (event) => {
    event.preventDefault();
    if (busy) return;
    if (!projectId) {
      setError('未选择项目');
      return;
    }
    if (titleHint && !isValidTitle(titleHint)) {
      setError('派生标题需在 1-80 字');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const result = await cloneProject(projectId, {
        cloneMode: mode,
        ...(titleHint ? { titleHint: titleHint.trim() } : {}),
        ...(targetKind ? { targetKind: targetKind } : {}),
      });
      onCloned && onCloned(result);
    } catch (submitError) {
      setError(submitError && submitError.message ? submitError.message : '派生失败,请稍后重试');
    } finally {
      setBusy(false);
    }
  }, [busy, projectId, mode, titleHint, targetKind, onCloned]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="派生此项目"
      onClick={close}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(15, 23, 42, 0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
    >
      <form
        onClick={(event) => event.stopPropagation()}
        onSubmit={handleSubmit}
        style={{
          width: 'min(560px, 100%)',
          maxHeight: '90vh',
          overflowY: 'auto',
          background: '#ffffff',
          borderRadius: 14,
          boxShadow: '0 20px 60px rgba(15,23,42,0.35)',
          padding: 24,
          fontFamily: 'inherit',
        }}
      >
        <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, color: '#0f172a' }}>派生此项目</h2>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
              基于
              <strong style={{ color: '#0f172a' }}> {projectTitle || '当前项目'} </strong>
              创建一份可继续编辑的副本。
            </p>
          </div>
          <button
            type="button"
            aria-label="关闭派生弹窗"
            disabled={busy}
            onClick={close}
            style={{
              background: 'transparent', border: 'none', cursor: busy ? 'not-allowed' : 'pointer',
              padding: 4, color: '#64748b',
            }}
          >
            <X size={18} />
          </button>
        </header>

        <fieldset
          disabled={busy}
          style={{ border: 'none', padding: 0, margin: 0 }}
        >
          <legend style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', marginBottom: 8 }}>
            选择派生模板
          </legend>
          <div style={{ display: 'grid', gap: 10 }}>
            {CLONE_OPTIONS.map((opt) => {
              const selected = opt.id === mode;
              const Icon = opt.icon;
              return (
                <label
                  key={opt.id}
                  className={classNames('pc-clone-option', selected && 'is-selected')}
                  style={{
                    display: 'flex', gap: 12, alignItems: 'flex-start',
                    border: selected ? '1.5px solid #2563eb' : '1px solid #e2e8f0',
                    background: selected ? '#eff6ff' : '#ffffff',
                    borderRadius: 10, padding: 12, cursor: 'pointer',
                    transition: 'border-color 120ms ease, background 120ms ease',
                  }}
                >
                  <input
                    type="radio"
                    name="pc-clone-mode"
                    value={opt.id}
                    checked={selected}
                    onChange={() => setMode(opt.id)}
                    style={{ marginTop: 4, accentColor: '#2563eb' }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Icon size={16} color={selected ? '#2563eb' : '#475569'} />
                      <strong style={{ fontSize: 14, color: '#0f172a' }}>{opt.label}</strong>
                      {opt.recommended ? (
                        <span style={{
                          fontSize: 10, color: '#2563eb', background: '#dbeafe',
                          padding: '2px 6px', borderRadius: 999,
                        }}>推荐</span>
                      ) : null}
                    </div>
                    <p style={{ margin: '4px 0 0', fontSize: 12, color: '#475569', lineHeight: 1.5 }}>
                      {opt.desc}
                    </p>
                  </div>
                </label>
              );
            })}
          </div>
        </fieldset>

        <div style={{ marginTop: 18, display: 'grid', gap: 12 }}>
          <label style={{ display: 'grid', gap: 4 }}>
            <span style={{ fontSize: 12, color: '#475569' }}>派生后标题 (留空使用默认)</span>
            <input
              ref={inputRef}
              type="text"
              value={titleHint}
              maxLength={80}
              disabled={busy}
              onChange={(event) => setTitleHint(event.target.value)}
              placeholder={projectTitle ? projectTitle + ' - 派生' : '输入新标题'}
              style={{
                border: '1px solid #cbd5e1', borderRadius: 8, padding: '8px 10px',
                fontSize: 13, color: '#0f172a', background: '#ffffff', outline: 'none',
              }}
            />
          </label>
          <label style={{ display: 'grid', gap: 4 }}>
            <span style={{ fontSize: 12, color: '#475569' }}>目标项目类型 (留空继承)</span>
            <select
              value={targetKind}
              disabled={busy}
              onChange={(event) => setTargetKind(event.target.value)}
              style={{
                border: '1px solid #cbd5e1', borderRadius: 8, padding: '8px 10px',
                fontSize: 13, color: '#0f172a', background: '#ffffff', outline: 'none',
              }}
            >
              <option value="">继承源项目类型</option>
              {kinds.map((kind) => (
                <option key={kind} value={kind}>{kind}</option>
              ))}
            </select>
          </label>
        </div>

        {error ? (
          <p style={{
            marginTop: 12, padding: '8px 10px', borderRadius: 8,
            background: '#fef2f2', color: '#b91c1c', fontSize: 12,
          }} role="alert">{error}</p>
        ) : null}

        <footer style={{
          marginTop: 20, display: 'flex', gap: 8, justifyContent: 'flex-end',
        }}>
          <button
            type="button"
            disabled={busy}
            onClick={close}
            style={{
              padding: '8px 14px', border: '1px solid #cbd5e1', background: '#ffffff',
              color: '#475569', borderRadius: 8, cursor: busy ? 'not-allowed' : 'pointer', fontSize: 13,
            }}
          >取消</button>
          <button
            type="submit"
            disabled={busy || !projectId}
            style={{
              padding: '8px 14px', border: 'none', background: busy ? '#93c5fd' : '#2563eb',
              color: '#ffffff', borderRadius: 8,
              cursor: busy || !projectId ? 'not-allowed' : 'pointer', fontSize: 13,
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}
          >
            {busy ? <Loader2 size={14} className="is-spinning" /> : <Copy size={14} />}
            {busy ? '派生中...' : '开始派生'}
          </button>
        </footer>
      </form>
    </div>
  );
}
