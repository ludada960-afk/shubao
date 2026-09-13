import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Music, Search, Trash2 } from 'lucide-react';

import { deleteProjectAsset, listProjectAssetLibrary } from '../../../services/projects.js';
import { normalizeProjectAssetLibrary, projectAssetSelectionKey } from '../../Works/projectAssetLibraryModel.js';
import ResponsiveImage from '../../../components/ResponsiveImage.jsx';
import { useModalScrollLock } from '../../../components/ui/useModalScrollLock.js';
import './canvas-asset-picker.css';

const MEDIA_FILTERS = [
  { id: '', label: '全部' },
  { id: 'image', label: '图片' },
  { id: 'video', label: '视频' },
  { id: 'audio', label: '音频' },
];

/**
 * 从资产库选择（2026-09-12 用户批注：画布必须能「从资产库选择」把素材放到画布上；
 * 照竞品交互：平时不动，鼠标悬停才出现打勾，点一下即选中，底部确认后加入画布）。
 */
export default function CanvasAssetPickerModal({ open, onClose, onConfirm }) {
  const [state, setState] = useState({ loading: false, error: '', items: [] });
  const [mediaFilter, setMediaFilter] = useState('');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(() => new Set());
  useModalScrollLock(open);

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    setState(current => ({ ...current, loading: true, error: '' }));
    setSelected(new Set());
    (async () => {
      try {
        const library = await listProjectAssetLibrary({ mediaKind: mediaFilter, query, limit: 500 });
        if (!cancelled) setState({ loading: false, error: '', items: normalizeProjectAssetLibrary(library) });
      } catch (error) {
        if (!cancelled) setState({ loading: false, error: error?.message || '资产库读取失败', items: [] });
      }
    })();
    return () => { cancelled = true; };
  }, [open, mediaFilter, query]);

  const toggle = useCallback(item => {
    const key = projectAssetSelectionKey(item);
    setSelected(current => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }, []);

  /* 9-13 用户批注：资产库弹窗照竞品 —— 卡片上要有垃圾桶，悬停才出现，删完立刻从列表消失。
     删除走既有接口（与「资产库」页同一个），失败时用同一条内联错误条提示，不弹新窗打断。 */
  const [busyKey, setBusyKey] = useState('');
  const handleDelete = useCallback(async item => {
    const key = projectAssetSelectionKey(item);
    if (!key || !item?.projectId || !item?.projectAssetId || busyKey) return;
    setBusyKey(key);
    try {
      await deleteProjectAsset(item.projectId, item.projectAssetId);
      setState(current => ({ ...current, error: '', items: current.items.filter(entry => projectAssetSelectionKey(entry) !== key) }));
      setSelected(current => {
        const next = new Set(current);
        next.delete(key);
        return next;
      });
    } catch (error) {
      setState(current => ({ ...current, error: error?.message || '删除失败，请重试' }));
    } finally {
      setBusyKey('');
    }
  }, [busyKey]);

  const picked = useMemo(
    () => state.items.filter(item => selected.has(projectAssetSelectionKey(item))),
    [state.items, selected],
  );

  if (!open) return null;

  const overlay = (
    <div className="canvas-asset-picker-overlay" onMouseDown={event => { if (event.target === event.currentTarget) onClose?.(); }}>
      <section className="canvas-asset-picker" role="dialog" aria-modal="true" aria-label="从资产库选择">
        <header>
          <div><strong>从资产库选择</strong><span>点击资产即可选中，确认后加入当前画布</span></div>
          <button type="button" aria-label="关闭" onClick={onClose}>×</button>
        </header>
        <div className="canvas-asset-picker-tools">
          <label className="canvas-asset-picker-search">
            <Search size={14} />
            <input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="搜索资产名称…" aria-label="搜索资产" />
          </label>
          <div className="canvas-asset-picker-tabs" role="tablist" aria-label="资产类型">
            {MEDIA_FILTERS.map(option => <button
              key={option.id || 'all'}
              type="button"
              role="tab"
              aria-selected={mediaFilter === option.id}
              className={mediaFilter === option.id ? 'is-active' : ''}
              onClick={() => setMediaFilter(option.id)}
            >{option.label}</button>)}
          </div>
        </div>
        {state.error && <div className="canvas-asset-picker-error" role="alert">{state.error}</div>}
        <div className="canvas-asset-picker-grid">
          {state.items.map(item => {
            const key = projectAssetSelectionKey(item);
            const isSelected = selected.has(key);
            const kind = String(item.mediaKind || '').toLowerCase();
            const name = item.metadata?.displayName || item.projectTitle || item.assetId || '素材';
            /* 卡片里还要放删除按钮 —— 外层不能再是 <button>（按钮不能嵌套按钮），
               改用 role=button 的 div 并补上键盘可达（Enter / 空格）。 */
            return <div
              key={key}
              role="button"
              tabIndex={0}
              className={`canvas-asset-picker-card${isSelected ? ' is-selected' : ''}`}
              aria-pressed={isSelected}
              aria-label={`选择 ${name}`}
              onClick={() => toggle(item)}
              onKeyDown={event => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  toggle(item);
                }
              }}
            >
              <span className="canvas-asset-picker-thumb">
                {kind === 'image' ? <ResponsiveImage src={item.stableUrl} variant="thumb" ratio="1:1" alt="" />
                  : kind === 'video' ? <video src={item.playbackUrl || item.stableUrl} muted playsInline preload="metadata" />
                    : <Music size={24} color="#94a3b8" />}
              </span>
              <span className="canvas-asset-picker-name" title={name}>{name}</span>
              <span className="canvas-asset-picker-check" aria-hidden="true"><Check size={14} /></span>
              <button
                type="button"
                className="canvas-asset-picker-delete"
                data-busy={busyKey === key ? 'true' : undefined}
                aria-label={`删除${name}`}
                title="删除"
                onClick={event => { event.stopPropagation(); handleDelete(item); }}
              ><Trash2 size={15} /></button>
            </div>;
          })}
          {!state.loading && !state.items.length && <div className="canvas-asset-picker-empty">资产库里还没有素材，先在「资产库」上传或把生成物加入资产库</div>}
          {state.loading && <div className="canvas-asset-picker-empty">正在读取资产库…</div>}
        </div>
        <footer>
          <span>已选 {picked.length} 个</span>
          <div>
            <button type="button" className="is-ghost" onClick={onClose}>取消</button>
            <button type="button" className="is-primary" disabled={!picked.length} onClick={() => onConfirm?.(picked)}>加入画布{picked.length ? ` (${picked.length})` : ''}</button>
          </div>
        </footer>
      </section>
    </div>
  );
  return typeof document === 'undefined' ? overlay : createPortal(overlay, document.body);
}
