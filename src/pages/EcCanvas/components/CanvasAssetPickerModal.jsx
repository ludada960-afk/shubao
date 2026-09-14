import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Image as ImageIcon, Music, Search, Trash2, Video as VideoIcon } from 'lucide-react';

import { deleteProjectAsset, listProjectAssetLibrary } from '../../../services/projects.js';
import { normalizeProjectAssetLibrary, projectAssetSelectionKey } from '../../Works/projectAssetLibraryModel.js';
import ResponsiveImage from '../../../components/ResponsiveImage.jsx';
import { useDialog } from '../../../components/ui/DialogProvider.jsx';
import { useModalScrollLock } from '../../../components/ui/useModalScrollLock.js';
import './canvas-asset-picker.css';

const MEDIA_FILTERS = [
  { id: '', label: '全部' },
  { id: 'image', label: '图片' },
  { id: 'video', label: '视频' },
  { id: 'audio', label: '音频' },
];

/* 9-15 用户批注：卡片左上角必须常显素材类型角标（图片 / 视频 / 音频，图标 + 文字小胶囊），
   不需要 hover 就可见；角标不得与打勾圈重叠（打勾圈移到角标正下方，见 CSS）。 */
const TYPE_BADGES = Object.freeze({
  image: { label: '图片', Icon: ImageIcon },
  video: { label: '视频', Icon: VideoIcon },
  audio: { label: '音频', Icon: Music },
});

/* 每批加载条数（9-13 用户批注：不要一次把 500 条全部渲染出来，改成滚动到底按批加载） */
const PAGE_SIZE = 24;
/* 服务端 /api/project-assets 只有 LIMIT 没有 offset 分页：滚动加载时先取一次全量快照到本地，
   再按 PAGE_SIZE 逐批 reveal，任何一批都不会重复或漏项。 */
const CATALOG_LIMIT = 500;

/**
 * 从资产库选择（2026-09-12 用户批注：画布必须能「从资产库选择」把素材放到画布上；
 * 2026-09-13 五条批注逐条落地：
 *   ① 卡片上下重叠 —— 栅格行距加大（row-gap 16px ≥ 14px），实测相邻两行互不覆盖；
 *   ② 一次性加载压力大 —— 首批 24 条 + IntersectionObserver 观察栅格底部哨兵，
 *      滚动到底自动追加下一批（每批 24），加载中「正在加载更多…」、全部加载完「已经到底了」，
 *      搜索/切换分类时重置回第一批；
 *   ③ 左上角打勾圆圈点了没反应 —— 改成真正可点的多选按钮（stopPropagation 只切选中、不触发删除），
 *      选中态紫描边 + 圆圈实心紫底白勾，底栏左侧只显示计数「已选 N 个」；
 *   ④ 垃圾桶点了直接删 —— 先弹项目统一的确认弹窗（useDialog -> confirm，与任务面板同一套），
 *      确认后才调 deleteProjectAsset，删除中忙碌态防连点；
 *   ⑤ 保留既有行为：方卡 165×165、封面 cover 填满、名称底部渐变遮罩、垃圾桶/打勾默认隐藏悬停出现、
 *      搜索 + 全部/图片/视频/音频 分类、点遮罩关闭、Esc 关闭。
 */
export default function CanvasAssetPickerModal({ open, onClose, onConfirm }) {
  const [state, setState] = useState({ loading: false, error: '', items: [] });
  const [mediaFilter, setMediaFilter] = useState('');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(() => new Set());
  /* 9-13 批注 ②：无限滚动状态 —— hasMore 是否还有下一批、loadingMore 正在追加中 */
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  /* 全量快照（惰性拉取）、并发守卫、栅格滚动容器与底部哨兵 */
  const catalogRef = useRef(null);
  const loadingMoreRef = useRef(false);
  const shownKeysRef = useRef(new Set());
  const gridRef = useRef(null);
  const sentinelRef = useRef(null);
  const { confirm } = useDialog();
  useModalScrollLock(open);

  /* 首屏 / 搜索 / 切分类：重置到第一批（24 条） */
  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    setState({ loading: true, error: '', items: [] });
    setHasMore(false);
    setLoadingMore(false);
    setSelected(new Set());
    catalogRef.current = null;
    (async () => {
      try {
        const library = await listProjectAssetLibrary({ mediaKind: mediaFilter, query, limit: PAGE_SIZE });
        if (cancelled) return;
        const items = normalizeProjectAssetLibrary(library);
        setState({ loading: false, error: '', items });
        setHasMore(items.length >= PAGE_SIZE);
      } catch (error) {
        if (!cancelled) setState({ loading: false, error: error?.message || '资产库读取失败', items: [] });
      }
    })();
    return () => { cancelled = true; };
  }, [open, mediaFilter, query]);

  /* 同步「已经渲染出来的 key」，loadMore 据此挑出下一批未展示的素材 */
  useEffect(() => {
    shownKeysRef.current = new Set(state.items.map(projectAssetSelectionKey));
  }, [state.items]);

  /* 滚动到底自动加载下一批（每批 24 条）。服务端不分页：先惰性取一次全量快照，再逐批 reveal */
  const loadMore = useCallback(async () => {
    if (loadingMoreRef.current || !hasMore) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      if (!catalogRef.current) {
        const library = await listProjectAssetLibrary({ mediaKind: mediaFilter, query, limit: CATALOG_LIMIT });
        catalogRef.current = normalizeProjectAssetLibrary(library);
      }
      const unseen = catalogRef.current.filter(item => !shownKeysRef.current.has(projectAssetSelectionKey(item)));
      const batch = unseen.slice(0, PAGE_SIZE);
      if (!batch.length) {
        setHasMore(false);
        return;
      }
      setState(current => ({ ...current, error: '', items: [...current.items, ...batch] }));
      setHasMore(unseen.length > PAGE_SIZE);
    } catch (error) {
      setState(current => ({ ...current, error: error?.message || '资产库读取失败' }));
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [mediaFilter, query, hasMore]);

  /* IntersectionObserver：哨兵进入视口（提前 160px）就追加下一批 */
  useEffect(() => {
    /* 等首批加载完成（state.loading === false）再挂观察器，避免首屏加载中哨兵立即可见而误触发 */
    if (!open || !hasMore || state.loading || typeof IntersectionObserver === 'undefined') return undefined;
    const sentinel = sentinelRef.current;
    if (!sentinel) return undefined;
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) loadMore();
    }, { root: gridRef.current, rootMargin: '0px 0px 160px 0px' });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [open, hasMore, state.loading, loadMore]);

  const toggle = useCallback(item => {
    const key = projectAssetSelectionKey(item);
    setSelected(current => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }, []);

  /* 9-13 用户批注 ④：删除必须二次确认 —— 复用项目统一的确认弹窗（useDialog，任务面板同款）。
     取消什么都不做；确认后才调接口；删除中忙碌态防重复点击。 */
  const [busyKey, setBusyKey] = useState('');
  const handleDelete = useCallback(async item => {
    const key = projectAssetSelectionKey(item);
    if (!key || !item?.projectId || !item?.projectAssetId || busyKey) return;
    const confirmed = await confirm({
      title: '删除这个素材？',
      message: '删除后不可恢复。',
      confirmLabel: '删除',
    });
    if (!confirmed) return;
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
  }, [busyKey, confirm]);

  const picked = useMemo(
    () => state.items.filter(item => selected.has(projectAssetSelectionKey(item))),
    [state.items, selected],
  );

  if (!open) return null;

  const overlay = (
    <div className="canvas-asset-picker-overlay" onPointerDown={event => event.stopPropagation()} onMouseDown={event => { if (event.target === event.currentTarget) onClose?.(); }}>
      <section className="canvas-asset-picker" role="dialog" aria-modal="true" aria-label="从资产库选择">
        <header>
          {/* 9-16 用户批注：「不要出现『选择之后会高亮』这种内部逻辑说明」——副标题只说用户能拿到什么结果。 */}
          <div><strong>从资产库选择</strong><span>把素材放进当前画布</span></div>
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
        <div className="canvas-asset-picker-grid" ref={gridRef}>
          {state.items.map(item => {
            const key = projectAssetSelectionKey(item);
            const isSelected = selected.has(key);
            const kind = String(item.mediaKind || '').toLowerCase();
            const name = item.metadata?.displayName || item.projectTitle || item.assetId || '素材';
            /* 9-15 用户批注：类型角标常显（图标 + 文字小胶囊），不依赖 hover */
            const typeBadge = TYPE_BADGES[kind] || null;
            const TypeIcon = typeBadge?.Icon;
            /* 卡片里放打勾圆圈（真正可点的多选按钮）和删除按钮 —— 外层不能再是 <button>
               （按钮不能嵌套按钮），沿用 role=button 的 div 并补键盘可达（Enter / 空格）。 */
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
              {/* 9-15 用户批注：左上角类型角标常显（图标 + 文字小胶囊），打勾圈移到角标正下方避免重叠 */}
              {TypeIcon && <span className="canvas-asset-picker-type" aria-hidden="true"><TypeIcon size={11} strokeWidth={2.2} /><span>{typeBadge.label}</span></span>}
              {/* 9-13 批注 ③：打勾圆圈从装饰 span 改成可点的多选按钮 —— stopPropagation 只切选中，不触发删除 */}
              <button
                type="button"
                className="canvas-asset-picker-check"
                aria-label={isSelected ? `取消选中 ${name}` : `选中 ${name}`}
                aria-pressed={isSelected}
                title={isSelected ? '取消选中' : '选中'}
                onClick={event => { event.stopPropagation(); toggle(item); }}
              ><Check size={14} /></button>
              <button
                type="button"
                className="canvas-asset-picker-delete"
                data-busy={busyKey === key ? 'true' : undefined}
                disabled={busyKey === key}
                aria-busy={busyKey === key ? 'true' : undefined}
                aria-label={`删除${name}`}
                title="删除"
                onClick={event => { event.stopPropagation(); handleDelete(item); }}
              >{busyKey === key ? <span className="canvas-asset-picker-delete-spinner" aria-hidden="true" /> : <Trash2 size={15} />}</button>
            </div>;
          })}
          {loadingMore && <div className="canvas-asset-picker-more" role="status">正在加载更多…</div>}
          {!state.loading && !loadingMore && !hasMore && state.items.length > 0 && <div className="canvas-asset-picker-more is-end">已经到底了</div>}
          {/* 9-16 文案收短：空态只说「没有素材」与素材从哪来，不铺陈机制。 */}
          {!state.loading && !state.items.length && <div className="canvas-asset-picker-empty">资产库还没有素材。上传文件，或把画布、作品里的素材加进来。</div>}
          {state.loading && <div className="canvas-asset-picker-empty">正在读取资产库…</div>}
          <div className="canvas-asset-picker-sentinel" ref={sentinelRef} aria-hidden="true" />
        </div>
        {/* 9-18 用户批注（P0）：「值对了，覆盖面没到」——本处原先只是**抄了 token 名**，
            真正的底部操作区仍是自写 flex + 自写 gap + 自写圆角，没有用契约类。
            现改用全站唯一的契约类 .ui-modal-footer / .ui-modal-footer-actions / .ui-btn，
            按钮外观（高度/最小宽/圆角/主次/禁用态）全部由契约提供，本文件不再自写。
            同时按用户要求把主按钮由**双色渐变**改为**品牌实底纯色**，缩小与次按钮的重量差。 */}
        <div className="ui-modal-footer">
          <span className="ui-modal-footer-meta">已选 {picked.length} 个</span>
          <div className="ui-modal-footer-actions">
            <button type="button" className="ui-btn ui-btn-secondary" onClick={onClose}>取消</button>
            <button type="button" className="ui-btn ui-btn-primary" disabled={!picked.length} onClick={() => onConfirm?.(picked)}>加入画布{picked.length ? ` (${picked.length})` : ''}</button>
          </div>
        </div>
      </section>
    </div>
  );
  return typeof document === 'undefined' ? overlay : createPortal(overlay, document.body);
}