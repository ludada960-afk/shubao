// 4c183cd4 续命 P3 模板社区 - 详情模态 + 复制到画布
//
// 设计:
//   * 静态数据来自 src/constants/publicTemplates.js (18 套真缩略图 + base 使用率)
//   * 启动时从 GET /api/templates/public 拿真使用率 (server 持久化覆盖 base)
//   * 列表: 类目筛选 + 排序(popular/likes/downloads/newest) + 热门区
//   * 详情: 点击卡片展开模态, 显示 tagline/idealFor/durationSec/modelHint + 复制按钮
//   * 复制: POST /api/templates/public/:tplId/clone -> 跳到 #/video-studio/<projectId>
//
// 注意: 不做自动 reset; 当用户没登录, 复制时弹出登录模态 (复用 useApp 现有 modal).

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Sparkles, Heart, Download, X, ChevronRight } from 'lucide-react';
import './index.css';
import {
  PUBLIC_TEMPLATE_CATEGORIES,
  PUBLIC_TEMPLATES,
  PUBLIC_TEMPLATE_DETAILS,
  popularTemplates,
  templatesByCategory,
  getPublicTemplate,
  getPublicTemplateDetail,
} from '../../constants/publicTemplates.js';
import { useApp } from '../../store/AppContext.jsx';

const SORTS = [
  { key: 'popular', label: '综合热度' },
  { key: 'likes', label: '最多点赞' },
  { key: 'downloads', label: '最多下载' },
  { key: 'newest', label: '最新上架' },
];

function fmt(num) {
  if (typeof num !== 'number' || !Number.isFinite(num)) return '0';
  if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
  return String(num);
}

function applySort(items, sort) {
  const arr = items.slice();
  if (sort === 'likes') return arr.sort((a, b) => b.likes - a.likes);
  if (sort === 'downloads') return arr.sort((a, b) => b.downloads - a.downloads);
  if (sort === 'newest') return arr.sort((a, b) => String(b.id).localeCompare(String(a.id)));
  // popular = likes + 2*downloads
  return arr.sort((a, b) => (b.likes + 2 * b.downloads) - (a.likes + 2 * a.downloads));
}

function TemplateDetail({ tpl, usage, onClose, onClone, busy }) {
  if (!tpl) return null;
  const detail = PUBLIC_TEMPLATE_DETAILS[tpl.id] || {};
  const live = usage || { likes: tpl.likes, downloads: tpl.downloads };
  return (
    <div className="tpl-modal-backdrop" role="dialog" aria-modal="true" aria-label={`${tpl.name} 详情`} onClick={onClose}>
      <div className="tpl-modal" onClick={e => e.stopPropagation()}>
        <header className="tpl-modal-head">
          <div className="tpl-modal-title">
            <span className="tpl-modal-cat">{tpl.cat}</span>
            <h2>{tpl.name}</h2>
          </div>
          <button type="button" className="tpl-modal-close" onClick={onClose} aria-label="关闭">
            <X size={18} />
          </button>
        </header>
        <div className="tpl-modal-body">
          <div className="tpl-modal-thumb">
            <img src={tpl.thumb} alt={tpl.name} loading="lazy" />
            <span className="tpl-modal-id">{tpl.id}</span>
          </div>
          <div className="tpl-modal-info">
            <p className="tpl-modal-tagline">{detail.tagline || '薯包官方原创模板'}</p>
            <dl>
              <div><dt>创作者</dt><dd>{tpl.creator}</dd></div>
              <div><dt>类目</dt><dd>{tpl.cat}</dd></div>
              <div><dt>建议时长</dt><dd>{detail.durationSec ? `${detail.durationSec} 秒` : '按画布时长'}</dd></div>
              <div><dt>建议场景</dt><dd>{(detail.idealFor || []).join(' / ') || '通用'}</dd></div>
              <div><dt>模型提示</dt><dd>{detail.modelHint || '默认'}</dd></div>
            </dl>
            <div className="tpl-modal-stats">
              <span><Heart size={14} /> {fmt(live.likes)} 赞</span>
              <span><Download size={14} /> {fmt(live.downloads)} 下载</span>
            </div>
            <div className="tpl-modal-actions">
              <button
                type="button"
                className="tpl-modal-clone"
                onClick={() => onClone(tpl)}
                disabled={busy}
                aria-label={`复制 ${tpl.name} 到画布`}
              >
                <Sparkles size={16} />
                {busy ? '复制中…' : '复制到画布'}
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const PublicTemplates = () => {
  const { state, dispatch } = useApp();
  const [cat, setCat] = useState('all');
  const [sort, setSort] = useState('popular');
  const [usageMap, setUsageMap] = useState(() => {
    const out = Object.create(null);
    for (const t of PUBLIC_TEMPLATES) out[t.id] = { likes: t.likes, downloads: t.downloads };
    return out;
  });
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/templates/public?limit=50', { credentials: 'include' });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled || !data || !Array.isArray(data.items)) return;
        setUsageMap(prev => {
          const next = { ...prev };
          for (const item of data.items) {
            if (item?.id) next[item.id] = { likes: item.likes || 0, downloads: item.downloads || 0 };
          }
          return next;
        });
      } catch (_) { /* offline fallback = 静态 base */ }
    })();
    return () => { cancelled = true; };
  }, []);

  const decorated = useMemo(() => {
    return PUBLIC_TEMPLATES.map(t => {
      const live = usageMap[t.id] || { likes: t.likes, downloads: t.downloads };
      return { ...t, likes: live.likes, downloads: live.downloads };
    });
  }, [usageMap]);

  const items = useMemo(() => {
    const filtered = cat === 'all' ? decorated : decorated.filter(t => t.cat === cat);
    return applySort(filtered, sort);
  }, [decorated, cat, sort]);

  const popular = useMemo(() => applySort(decorated, 'popular').slice(0, 4), [decorated]);

  const handleSelect = useCallback((t) => setSelected(t), []);
  const handleClose = useCallback(() => { if (!busy) setSelected(null); }, [busy]);

  const handleClone = useCallback(async (tpl) => {
    if (!tpl) return;
    if (!state.logged) {
      dispatch({ type: 'SET_LOGIN_INTENT', intent: { destination: 'public-templates', source: 'public-templates' } });
      dispatch({ type: 'SHOW_LOGIN', show: true });
      return;
    }
    setBusy(true);
    try {
      const idempotencyKey = `tpl-clone-${tpl.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const res = await fetch(`/api/templates/public/${encodeURIComponent(tpl.id)}/clone`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
        },
        credentials: 'include',
        body: JSON.stringify({ idempotencyKey }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setToast(data?.error || '复制失败, 请稍后重试');
        setTimeout(() => setToast(''), 2400);
        return;
      }
      if (data?.projectId) {
        // 把 projectId 暂存到 sessionStorage, VideoProjectWorkbench 启动时可读
        try { sessionStorage.setItem('video.project.to.open', data.projectId); } catch (_) {}
        // 跳到 video-studio, hash 形式
        window.location.hash = `#/video-studio/${data.projectId}`;
        dispatch({ type: 'NAVIGATE', page: 'video-studio' });
        setSelected(null);
        setToast(`已复制到画布 · ${data.templateName}`);
        setTimeout(() => setToast(''), 2400);
      }
    } catch (error) {
      setToast(error?.message || '复制请求失败');
      setTimeout(() => setToast(''), 2400);
    } finally {
      setBusy(false);
    }
  }, [state.logged, dispatch]);

  return (
    <section className="public-templates-page" aria-label="公共模板社区">
      <header className="public-templates-head">
        <h1>公共模板库</h1>
        <p>9 类目 18 套, 站主原创, 复制到画布即可继续编辑</p>
      </header>

      <section className="popular-row" aria-label="热门模板">
        <h2><Sparkles size={16} /> 热门模板</h2>
        <ul className="popular-list">
          {popular.map(t => (
            <li key={t.id} className="popular-card" onClick={() => handleSelect(t)} role="button" tabIndex={0}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSelect(t); } }}>
              <img src={t.thumb} alt={t.name} loading="lazy" />
              <div className="popular-meta">
                <strong>{t.name}</strong>
                <small><Heart size={11} /> {fmt(t.likes)}  ·  <Download size={11} /> {fmt(t.downloads)}</small>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <nav className="cat-bar" aria-label="类目筛选">
        <button type="button" className={cat === 'all' ? 'is-on' : ''} onClick={() => setCat('all')}>
          全部 ({PUBLIC_TEMPLATES.length})
        </button>
        {PUBLIC_TEMPLATE_CATEGORIES.map(c => {
          const cnt = PUBLIC_TEMPLATES.filter(t => t.cat === c.key).length;
          return (
            <button key={c.key} type="button" className={cat === c.key ? 'is-on' : ''} onClick={() => setCat(c.key)}>
              {c.label} ({cnt})
            </button>
          );
        })}
      </nav>

      <div className="sort-bar" aria-label="排序">
        {SORTS.map(s => (
          <button key={s.key} type="button" className={sort === s.key ? 'is-on' : ''} onClick={() => setSort(s.key)}>
            {s.label}
          </button>
        ))}
        <span className="sort-count">共 {items.length} 套</span>
      </div>

      <ul className="grid" aria-label="模板列表">
        {items.map(t => (
          <li key={t.id} className="grid-item" onClick={() => handleSelect(t)} role="button" tabIndex={0}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSelect(t); } }}>
            <img src={t.thumb} alt={t.name} loading="lazy" width="320" height="200" />
            <div className="grid-meta">
              <strong>{t.name}</strong>
              <small>{t.cat} · 创作者 {t.creator}</small>
              <div className="grid-stats"><Heart size={11} /> {fmt(t.likes)}  ·  <Download size={11} /> {fmt(t.downloads)}</div>
            </div>
          </li>
        ))}
      </ul>

      {selected && (
        <TemplateDetail
          tpl={selected}
          usage={usageMap[selected.id]}
          onClose={handleClose}
          onClone={handleClone}
          busy={busy}
        />
      )}
      {toast && (
        <div className="tpl-toast" role="status" aria-live="polite">{toast}</div>
      )}
    </section>
  );
};

export default PublicTemplates;
