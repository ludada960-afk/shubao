/* P2 · 工作流模板库（一键铺开层 L1/L3，spec §1/§5）
   设计师视角: 卡片三件套 = 图缩略 + 便签教程 + 一键铺开；预估积分角标读 pricing（不变式③ 展示口径）;
   点赞走幂等 API 显示真数（usageCount/likeCount 都是服务端真数, 不 mock）。
   T4/T5（requiresAudioVideo）= "视频/音频能力即将上线（待 P3）" 灰态徽标, 铺开可用但画布内 P3 节点灰态、
   运行入口由 index.jsx 按 P0.5 门控（不变式①: 不确认不扣费, T4/T5 永不提供扣费运行）。
   与 L2 提示词模板（CanvasTemplateMarketplace）并存, 本库是"图工作流"层。*/
import React, { useCallback, useEffect, useState } from 'react';
import { Heart, Layers3, Loader2, Star, Video, Workflow, X, Zap } from 'lucide-react';
import { fetchWorkflowTemplates, likeWorkflowTemplate, workflowSlotIds } from './workflowTemplates.js';

const OVERLAY = { position: 'fixed', inset: 0, zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15,23,42,.55)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' };
const PANEL = { position: 'relative', width: 'min(960px, 96vw)', maxHeight: '90vh', overflow: 'auto', borderRadius: 14, background: '#fff', boxShadow: '0 24px 60px rgba(15,23,42,.32)', border: '1px solid rgba(15,23,42,.06)' };
const TAB = { padding: '6px 12px', borderRadius: 999, border: '1px solid rgba(15,23,42,.08)', background: '#fff', color: '#475569', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5 };
const TAB_ACTIVE = { ...TAB, background: '#7c3aed', color: '#fff', borderColor: '#7c3aed' };
const CARD = { borderRadius: 10, border: '1px solid rgba(15,23,42,.08)', background: '#fff', overflow: 'hidden', display: 'flex', flexDirection: 'column', transition: 'all .18s ease' };

/* 图缩略: 按节点 bbox 等比缩放进 216x120, 槽位琥珀虚线, 连线带箭头。零外部依赖。*/
function TemplateGraphThumb({ graph }) {
  const nodes = Array.isArray(graph?.nodes) ? graph.nodes : [];
  const connections = Array.isArray(graph?.connections) ? graph.connections : [];
  if (!nodes.length) {
    return <div style={{ height: 120, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, background: 'linear-gradient(135deg,#f8fafc,#eef2ff)', color: '#94a3b8' }}>
      <Workflow size={22} />
      <small style={{ fontSize: 11 }}>图结构暂不可用</small>
    </div>;
  }
  const byId = new Map(nodes.map(node => [String(node?.id ?? ''), node]));
  let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let maxY = -Infinity;
  for (const node of nodes) {
    const x = Number(node?.x) || 0; const y = Number(node?.y) || 0;
    const w = Number(node?.w) || 240; const h = Number(node?.h) || 140;
    minX = Math.min(minX, x); minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + w); maxY = Math.max(maxY, y + h);
  }
  const pad = 18;
  const boxW = Math.max(1, maxX - minX + pad * 2);
  const boxH = Math.max(1, maxY - minY + pad * 2);
  const scale = Math.min(216 / boxW, 120 / boxH, 1.4);
  const viewW = 216; const viewH = 120;
  const originX = (viewW - boxW * scale) / 2;
  const originY = (viewH - boxH * scale) / 2;
  const point = (x, y) => [originX + (x - minX + pad) * scale, originY + (y - minY + pad) * scale];
  const colorFor = node => {
    const kind = String(node?.kind || '');
    if (kind === 'video') return { fill: 'rgba(220,38,38,.08)', stroke: '#fca5a5' };
    if (kind === 'audio') return { fill: 'rgba(13,148,136,.10)', stroke: '#5eead4' };
    if (kind === 'text') return { fill: 'rgba(37,99,235,.08)', stroke: '#bfdbfe' };
    if (node?.isSlot || node?.slot) return { fill: 'rgba(245,158,11,.12)', stroke: '#f59e0b' };
    return { fill: 'rgba(124,58,237,.08)', stroke: '#ddd6fe' };
  };
  return <svg viewBox={'0 0 ' + viewW + ' ' + viewH} width="100%" height={viewH} style={{ display: 'block', background: 'linear-gradient(135deg,#f8fafc,#f5f3ff)' }} aria-label="模板图缩略">
    <defs>
      <marker id="wf-thum-arrow" viewBox="0 0 8 8" refX={7} refY={4} markerWidth={5} markerHeight={5} orient="auto-start-reverse">
        <path d="M 0 0 L 8 4 L 0 8 z" fill="#cbd5e1" />
      </marker>
    </defs>
    {connections.map((edge, index) => {
      const from = byId.get(String(edge?.fromNodeId || edge?.from || ''));
      const to = byId.get(String(edge?.toNodeId || edge?.to || ''));
      if (!from || !to) return null;
      const [x1, y1] = point((Number(from.x) || 0) + (Number(from.w) || 240) / 2, (Number(from.y) || 0) + (Number(from.h) || 140) / 2);
      const [x2, y2] = point((Number(to.x) || 0) + (Number(to.w) || 240) / 2, (Number(to.y) || 0) + (Number(to.h) || 140) / 2);
      return <line key={index} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#cbd5e1" strokeWidth={1.4} markerEnd="url(#wf-thum-arrow)" />;
    })}
    {nodes.map(node => {
      const [x, y] = point(Number(node?.x) || 0, Number(node?.y) || 0);
      const w = Math.max(8, (Number(node?.w) || 240) * scale);
      const h = Math.max(6, (Number(node?.h) || 140) * scale);
      const tone = colorFor(node);
      const isSlot = Boolean(node?.isSlot || node?.slot);
      const label = String(node?.name || node?.displayLabel || node?.kind || '');
      const showLabel = w > 46 && label.length <= 10;
      return <g key={String(node?.id ?? index)}>
        <rect x={x} y={y} width={w} height={h} rx={5 * scale} fill={tone.fill} stroke={tone.stroke} strokeWidth={isSlot ? 1.6 : 1} strokeDasharray={isSlot ? '4 3' : undefined} />
        {showLabel && <text x={x + 6 * scale} y={y + Math.min(12 * scale, h - 4)} fontSize={Math.max(7, 9 * scale)} fill="#475569" style={{ fontVariant: 'tabular-nums' }}>{isSlot ? '[槽] ' : ''}{label}</text>}
      </g>;
    })}
  </svg>;
}

function sortFeatured(list = []) {
  return [...list].sort((a, b) => ((Number(b?.usageCount) || 0) - (Number(a?.usageCount) || 0)) || ((Number(b?.likeCount) || 0) - (Number(a?.likeCount) || 0)));
}

export default function WorkflowTemplateGallery({ open, onClose, onInstantiate, email = '', onNotify }) {
  const [tab, setTab] = useState('featured');
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [likes, setLikes] = useState({});
  const [busySlug, setBusySlug] = useState('');
  const [likeBusy, setLikeBusy] = useState(new Set());

  /* 拉列表: 精选 = public（按 usage/like 真数排序）; 我的 = mine=email（需登录）; 分类 = public + category。*/
  const load = useCallback(async key => {
    setLoading(true);
    setError('');
    try {
      let params;
      if (key === 'mine') {
        if (!email) { setTemplates([]); return; }
        params = { mine: email };
      } else if (key === 'image' || key === 'video') {
        params = { category: key };
      } else {
        params = {};
      }
      const list = await fetchWorkflowTemplates(params);
      if (key === 'featured') setTemplates(sortFeatured(list));
      else setTemplates(key === 'featured' ? list : (key === 'image' || key === 'video' ? sortFeatured(list) : list));
    } catch (err) {
      setError(err?.message || '工作流模板读取失败');
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  }, [email]);

  useEffect(() => {
    if (!open) return undefined;
    void load(tab);
    return undefined;
  }, [open, tab, load]);

  useEffect(() => {
    if (!open) return undefined;
    const handler = event => { if (event.key === 'Escape') { event.preventDefault(); onClose?.(); } };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  /* 点赞: 乐观翻转 + 服务端幂等确认（双击不重复计数）; 失败回滚。*/
  const toggleLike = useCallback(async template => {
    const slug = String(template?.slug || '');
    if (!slug || likeBusy.has(slug)) return;
    setLikeBusy(previous => new Set([...previous, slug]));
    const previous = likes[slug] || { liked: false, likeCount: Number(template?.likeCount) || 0 };
    const next = { liked: !previous.liked, likeCount: Math.max(0, previous.liked ? previous.likeCount - 1 : previous.likeCount + 1) };
    setLikes(map => ({ ...map, [slug]: next }));
    try {
      const confirmed = await likeWorkflowTemplate(slug);
      setLikes(map => ({ ...map, [slug]: { liked: confirmed.liked, likeCount: confirmed.likeCount } }));
    } catch (err) {
      setLikes(map => ({ ...map, [slug]: previous }));
      onNotify?.(err?.message || '点赞失败，请稍后重试', 'error');
    } finally {
      setLikeBusy(set => { const copy = new Set(set); copy.delete(slug); return copy; });
    }
  }, [likes, likeBusy, onNotify]);

  const instantiate = useCallback(async template => {
    if (!template?.slug || busySlug) return;
    setBusySlug(template.slug);
    try {
      await onInstantiate?.(template);
    } catch (err) {
      onNotify?.(err?.message || '模板铺开失败，请稍后重试', 'error');
    } finally {
      setBusySlug('');
    }
  }, [busySlug, onInstantiate, onNotify]);

  if (!open) return null;

  const shown = templates;
  const mineTab = tab === 'mine';
  const emptyCopy = mineTab
    ? (email
      ? { title: '你还没有自己的工作流模板', hint: '创建后只对你可见，在"我的"里管理自己的图模板' }
      : { title: '登录后查看我的工作流模板', hint: '先登录账号，再查看/管理你自建的工作流模板' })
    : { title: '暂无可铺开的图工作流模板', hint: '公共模板正在整理中，稍后再来看看' };

  return <div role="dialog" aria-modal="true" aria-label="工作流模板库" style={OVERLAY}>
    <div style={PANEL}>
      <button type="button" aria-label="关闭工作流模板库" onClick={() => onClose?.()}
        style={{ position: 'absolute', top: 12, right: 12, zIndex: 5, width: 32, height: 32, borderRadius: 8, border: 0, background: 'rgba(15,23,42,.06)', color: '#475569', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
        <X size={16} />
      </button>
      <div style={{ padding: '18px 20px 12px', borderBottom: '1px solid rgba(15,23,42,.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Workflow size={18} style={{ color: '#7c3aed' }} />
          <strong style={{ fontSize: 15, color: '#0f172a' }}>工作流模板</strong>
          <span style={{ marginLeft: 'auto', fontSize: 11, color: '#64748b' }}>一键铺开 · 拖图即跑 · 使用/点赞为真数</span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
          <button type="button" onClick={() => setTab('featured')} style={tab === 'featured' ? TAB_ACTIVE : TAB}><Star size={12} />精选</button>
          <button type="button" onClick={() => setTab('mine')} style={tab === 'mine' ? TAB_ACTIVE : TAB}><Layers3 size={12} />我的</button>
          <button type="button" onClick={() => setTab('image')} style={tab === 'image' ? TAB_ACTIVE : TAB}>图像</button>
          <button type="button" onClick={() => setTab('video')} style={tab === 'video' ? TAB_ACTIVE : TAB}><Video size={12} />视频</button>
        </div>
      </div>

      {loading ? <div style={{ padding: '24px 20px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
        {Array.from({ length: 6 }, (item, index) => <div key={index} style={{ borderRadius: 10, border: '1px solid rgba(15,23,42,.06)', height: 210, background: 'linear-gradient(100deg,#f8fafc 30%,#eef2f7 50%,#f8fafc 70%)', backgroundSize: '200% 100%', animation: 'skeletonShimmer 1.4s infinite linear' }} />)}
      </div>
      : error ? <div style={{ padding: '48px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: 28, lineHeight: 1 }}>⚠️</div>
          <strong style={{ display: 'block', marginTop: 10, fontSize: 14, color: '#0f172a' }}>{error}</strong>
          <button type="button" onClick={() => void load(tab)} style={{ marginTop: 14, padding: '7px 16px', borderRadius: 8, border: '1px solid rgba(15,23,42,.1)', background: '#fff', color: '#475569', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>重试</button>
        </div>
      : shown.length ? <div style={{ padding: '18px 20px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
          {shown.map(template => {
            const slug = String(template?.slug || '');
            const like = likes[slug] || { liked: false, likeCount: Number(template?.likeCount) || 0 };
            const p3Gate = template?.requiresAudioVideo === true;
            const slots = workflowSlotIds(template?.graph?.nodes || []);
            const estimated = Number(template?.pricing?.estimatedUnits) || 0;
            const busy = busySlug === slug;
            return <article key={slug || template?.templateId} style={CARD} onMouseEnter={event => { event.currentTarget.style.transform = 'translateY(-2px)'; event.currentTarget.style.boxShadow = '0 12px 30px rgba(15,23,42,.18)'; event.currentTarget.style.borderColor = p3Gate ? 'rgba(100,116,139,.5)' : 'rgba(124,58,237,.4)'; }} onMouseLeave={event => { event.currentTarget.style.transform = ''; event.currentTarget.style.boxShadow = ''; event.currentTarget.style.borderColor = 'rgba(15,23,42,.08)'; }}>
              <div style={{ position: 'relative' }}>
                <TemplateGraphThumb graph={template?.graph} />
                {estimated > 0 && <span title={template?.pricing?.note || '展示预估，结算以目录为准'} style={{ position: 'absolute', top: 8, right: 8, padding: '3px 8px', borderRadius: 999, background: 'rgba(255,247,237,.96)', border: '1px solid rgba(245,158,11,.35)', color: '#b45309', fontSize: 11, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <Zap size={11} />预计 {estimated} 积分
                </span>}
                {p3Gate && <span style={{ position: 'absolute', top: 8, left: 8, padding: '3px 8px', borderRadius: 999, background: 'rgba(241,245,249,.96)', border: '1px solid rgba(100,116,139,.35)', color: '#64748b', fontSize: 11, fontWeight: 600 }}>
                  视频/音频能力即将上线（待 P3）
                </span>}
              </div>
              <div style={{ padding: '10px 12px 8px', flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                  <strong style={{ fontSize: 13, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{template?.name || slug}</strong>
                  <span style={{ fontSize: 10, color: '#94a3b8', whiteSpace: 'nowrap' }}>{template?.isBuiltIn ? '官方' : '自建'}</span>
                </div>
                <p style={{ margin: '6px 0 0', fontSize: 12, color: '#64748b', lineHeight: 1.55, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', minHeight: 37 }}>{template?.description || '暂无说明'}</p>
              </div>
              <div style={{ padding: '0 12px 12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 11, color: '#94a3b8' }}>
                  <span>已使用 {Number(template?.usageCount) || 0} 次</span>
                  <button type="button" disabled={likeBusy.has(slug)}
                    onClick={() => void toggleLike(template)}
                    aria-pressed={like.liked}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4, border: 0, background: 'none', color: like.liked ? '#ef4444' : '#64748b', fontSize: 11, fontWeight: 600, cursor: likeBusy.has(slug) ? 'wait' : 'pointer', padding: 0 }}>
                    <Heart size={12} style={like.liked ? { fill: '#ef4444' } : undefined} />{like.liked ? '已赞' : '赞'} {like.likeCount}
                  </button>
                  {slots.length > 0 && <span title="铺开后琥珀高亮的槽位节点数">填 {slots.length} 槽</span>}
                </div>
                <button type="button" disabled={busy || likeBusy.has(slug)}
                  onClick={() => void instantiate(template)}
                  style={{ marginTop: 8, width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid ' + (p3Gate ? 'rgba(100,116,139,.35)' : 'rgba(124,58,237,.35)'), background: p3Gate ? '#f8fafc' : '#7c3aed', color: p3Gate ? '#64748b' : '#fff', fontSize: 12, fontWeight: 700, cursor: busy ? 'wait' : 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  {busy ? <><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />铺开中…</> : p3Gate ? '铺开到画布（P3 前不可扣费运行）' : '一键同款 · 铺开到画布'}
                </button>
              </div>
            </article>;
          })}
        </div>
      : <div style={{ padding: '48px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: 28, lineHeight: 1 }}>{mineTab ? '🗂️' : '🧩'}</div>
          <strong style={{ display: 'block', marginTop: 10, fontSize: 14, color: '#0f172a' }}>{emptyCopy.title}</strong>
          <p style={{ margin: '6px 0 0', fontSize: 12, color: '#64748b' }}>{emptyCopy.hint}</p>
        </div>}
      <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
    </div>
  </div>;
}
