import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Music, Search } from 'lucide-react';

import { listProjectAssetLibrary } from '../../../services/projects.js';
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
            return <button
              key={key}
              type="button"
              className={`canvas-asset-picker-card${isSelected ? ' is-selected' : ''}`}
              aria-pressed={isSelected}
              aria-label={`选择 ${item.metadata?.displayName || item.assetId || '资产'}`}
              onClick={() => toggle(item)}
            >
              <span className="canvas-asset-picker-thumb">
                {kind === 'image' ? <ResponsiveImage src={item.stableUrl} variant="thumb" ratio="1:1" alt="" />
                  : kind === 'video' ? <video src={item.playbackUrl || item.stableUrl} muted playsInline preload="metadata" />
                    : <Music size={24} color="#94a3b8" />}
              </span>
              <span className="canvas-asset-picker-check" aria-hidden="true"><Check size={14} /></span>
            </button>;
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
