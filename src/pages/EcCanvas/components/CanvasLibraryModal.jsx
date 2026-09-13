import React, { useCallback, useEffect, useState } from 'react';

import {
  deleteCanvas,
  duplicateCanvas,
  listCanvases,
  renameCanvas,
  setCanvasFavorite,
} from '../../../services/projects.js';
import { useModalScrollLock } from '../../../components/ui/useModalScrollLock.js';
import './canvas-library.css';

/**
 * 画布库（2026-09-12 用户批注：点「新建画布」应进入画布管理页）。
 * 卡片：封面 + 名称 + 更新时间；鼠标悬停显示 改名 / 复制 / 收藏 / 删除。
 * 用户原话：「画布可以被新建，每个新建的画布会成为新的画布；鼠标放上去有编辑名字、复制、收藏高亮、垃圾桶删除」。
 */
function formatTime(value) {
  const time = new Date(String(value || '').replace(' ', 'T'));
  if (!Number.isFinite(time.getTime())) return '';
  const pad = number => String(number).padStart(2, '0');
  return `${time.getFullYear()}-${pad(time.getMonth() + 1)}-${pad(time.getDate())} ${pad(time.getHours())}:${pad(time.getMinutes())}`;
}

export default function CanvasLibraryModal({ open, onClose, onCreate, onOpenCanvas, variant = 'modal' }) {
  /* 9-12 用户批注：画布库照竞品做成**整页**（不是弹窗），卡片 hover 上浮放大并浮出四个操作。
     variant='page' 时不再渲染遮罩，直接作为画布区域内的一个整页视图。 */
  const isPage = variant === 'page';
  const [state, setState] = useState({ loading: false, error: '', items: [] });
  const [renamingId, setRenamingId] = useState('');
  const [renameDraft, setRenameDraft] = useState('');
  useModalScrollLock(open);

  const reload = useCallback(async () => {
    setState(current => ({ ...current, loading: true, error: '' }));
    try {
      const items = await listCanvases();
      setState({ loading: false, error: '', items });
    } catch (error) {
      setState({ loading: false, error: error?.message || '画布列表读取失败', items: [] });
    }
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    (async () => {
      setState(current => ({ ...current, loading: true, error: '' }));
      try {
        const items = await listCanvases();
        if (!cancelled) setState({ loading: false, error: '', items });
      } catch (error) {
        if (!cancelled) setState({ loading: false, error: error?.message || '画布列表读取失败', items: [] });
      }
    })();
    return () => { cancelled = true; };
  }, [open]);

  if (!open) return null;

  const commitRename = async item => {
    const title = renameDraft.trim();
    setRenamingId('');
    if (!title || title === item.title) return;
    try {
      await renameCanvas(item.id, title);
      await reload();
    } catch (error) {
      setState(current => ({ ...current, error: error?.message || '重命名失败' }));
    }
  };

  const toggleFavorite = async item => {
    try {
      await setCanvasFavorite(item.id, !item.favorite);
      await reload();
    } catch (error) {
      setState(current => ({ ...current, error: error?.message || '收藏失败' }));
    }
  };

  const duplicate = async item => {
    try {
      await duplicateCanvas(item.id);
      await reload();
    } catch (error) {
      setState(current => ({ ...current, error: error?.message || '复制失败' }));
    }
  };

  const remove = async item => {
    try {
      await deleteCanvas(item.id);
      await reload();
    } catch (error) {
      setState(current => ({ ...current, error: error?.message || '删除失败' }));
    }
  };

  return <div
    className={`canvas-library-overlay${isPage ? ' is-page' : ''}`}
    onMouseDown={event => { if (event.target === event.currentTarget) onClose?.(); }}
  >
    <section className={`canvas-library${isPage ? ' is-page' : ''}`} role="dialog" aria-modal={isPage ? undefined : 'true'} aria-label="我的画布">
      <header className="canvas-library-head">
        <div><strong>我的画布</strong><span>共 {state.items.length} 个画布 · 悬停卡片可改名 / 复制 / 收藏 / 删除</span></div>
        <div className="canvas-library-head-actions">
          <button type="button" className="canvas-library-create" onClick={() => onCreate?.()}>+ 新建画布</button>
          <button type="button" className="canvas-library-close" aria-label="关闭画布库" onClick={onClose}>×</button>
        </div>
      </header>
      {state.error && <div className="canvas-library-error" role="alert">{state.error}</div>}
      {state.loading && <div className="canvas-library-loading">正在读取画布…</div>}
      <div className="canvas-library-grid">
        {state.items.map(item => <article key={item.id} className={`canvas-library-card${item.favorite ? ' is-favorite' : ''}`}>
          <button type="button" className="canvas-library-cover" onClick={() => onOpenCanvas?.(item)} aria-label={`打开画布 ${item.title}`}>
            {item.coverUrl ? <img src={item.coverUrl} alt="" loading="lazy" decoding="async" /> : <span className="canvas-library-cover-empty">空画布</span>}
          </button>
          <div className="canvas-library-card-actions">
            <button type="button" aria-label="改名字" title="改名字" onClick={() => { setRenamingId(item.id); setRenameDraft(item.title); }}>✎</button>
            <button type="button" aria-label="复制画布" title="复制当前画布" onClick={() => duplicate(item)}>⧉</button>
            <button type="button" aria-label={item.favorite ? '取消收藏' : '收藏画布'} title={item.favorite ? '取消收藏' : '收藏画布'} onClick={() => toggleFavorite(item)}>{item.favorite ? '★' : '☆'}</button>
            <button type="button" aria-label="删除画布" title="删除画布" onClick={() => remove(item)}>🗑</button>
          </div>
          <div className="canvas-library-card-body">
            {renamingId === item.id
              ? <input
                autoFocus
                value={renameDraft}
                maxLength={40}
                onChange={event => setRenameDraft(event.target.value)}
                onBlur={() => commitRename(item)}
                onKeyDown={event => { if (event.key === 'Enter') commitRename(item); if (event.key === 'Escape') setRenamingId(''); }}
              />
              : <strong>{item.title}</strong>}
            <small>{formatTime(item.updatedAt)} · {item.nodeCount} 个节点</small>
          </div>
        </article>)}
        {!state.loading && !state.items.length && <div className="canvas-library-empty">还没有画布，点「新建画布」开始创作</div>}
      </div>
    </section>
  </div>;
}
