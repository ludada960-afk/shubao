// 4c183cd4 续命 P-E 100 套模板 画布广场
// 9 类目 x 11 套 (theme 12 套) 共 100 套, 来自 src/constants/publicTemplates.js
// 用户在画布顶部打开「模板广场」按钮 -> 弹出 9 类目导航 + 100 套模板卡 -> 点选落画布
// 资深美工视角: 类目 pill + 9 列 SVG 缩略图 + 价格徽章 + 标签云; 产品经理视角 100 套一览; 商业化视角每套单价标注
import React, { useEffect, useMemo, useState } from 'react';
import { X, Filter, Layers, Star, Download } from 'lucide-react';
import {
  PUBLIC_TEMPLATES,
  PUBLIC_TEMPLATE_CATEGORIES,
  PUBLIC_TEMPLATE_DETAILS,
  templatesByCategory,
  popularTemplates,
  getPublicTemplate,
  getPublicTemplateDetail,
} from '../../../constants/publicTemplates.js';

const CAT_PILL = {
  padding: '6px 10px',
  borderRadius: 999,
  border: '1px solid rgba(15,23,42,.08)',
  background: '#fff',
  color: '#475569',
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};

const CAT_PILL_ACTIVE = {
  ...CAT_PILL,
  background: '#7c3aed',
  color: '#fff',
  borderColor: '#7c3aed',
};

const CARD = {
  borderRadius: 10,
  border: '1px solid rgba(15,23,42,.08)',
  background: '#fff',
  overflow: 'hidden',
  cursor: 'pointer',
  transition: 'all 0.18s ease',
  display: 'flex',
  flexDirection: 'column',
};

const CARD_HOVER = {
  transform: 'translateY(-2px)',
  boxShadow: '0 12px 30px rgba(15,23,42,.18)',
  borderColor: 'rgba(124,58,237,.4)',
};

export default function CanvasTemplateMarketplace({ open, onClose, onPickTemplate }) {
  const [activeCat, setActiveCat] = useState('all');

  const filteredTemplates = useMemo(() => {
    if (activeCat === 'all') return popularTemplates(60);
    if (activeCat === 'all-list') return [...PUBLIC_TEMPLATES];
    return templatesByCategory(activeCat);
  }, [activeCat]);

  useEffect(() => {
    if (!open) return undefined;
    const handler = (e) => { if (e.key === 'Escape') { e.preventDefault(); onClose?.(); } };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;
  const totalTemplates = PUBLIC_TEMPLATES.length;
  return <div role="dialog" aria-modal="true" aria-label="模板广场" style={{ position: 'fixed', inset: 0, zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15,23,42,.55)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}>
    <div style={{ position: 'relative', width: 'min(960px, 96vw)', maxHeight: '90vh', overflow: 'auto', borderRadius: 14, background: '#fff', boxShadow: '0 24px 60px rgba(15,23,42,.32)', border: '1px solid rgba(15,23,42,.06)' }}>
      <button type="button" aria-label="关闭模板广场" onClick={() => onClose?.()} style={{ position: 'absolute', top: 12, right: 12, zIndex: 5, width: 32, height: 32, borderRadius: 8, border: 0, background: 'rgba(15,23,42,.06)', color: '#475569', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
        <X size={16} />
      </button>
      <div style={{ padding: '18px 20px 12px', borderBottom: '1px solid rgba(15,23,42,.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Layers size={18} style={{ color: '#7c3aed' }} />
          <strong style={{ fontSize: 15, color: '#0f172a' }}>模板广场</strong>
          <span style={{ marginLeft: 'auto', fontSize: 11, color: '#64748b' }}>共 {totalTemplates} 套 · 9 类目</span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
          <button type="button" onClick={() => setActiveCat('all')} style={activeCat === 'all' ? CAT_PILL_ACTIVE : CAT_PILL}>
            🔥 热门
          </button>
          <button type="button" onClick={() => setActiveCat('all-list')} style={activeCat === 'all-list' ? CAT_PILL_ACTIVE : CAT_PILL}>
            全部 {totalTemplates}
          </button>
          {PUBLIC_TEMPLATE_CATEGORIES.map(cat => (
            <button key={cat.key} type="button" onClick={() => setActiveCat(cat.key)} style={activeCat === cat.key ? CAT_PILL_ACTIVE : CAT_PILL} title={`${cat.label} ${cat.count} 套`}>
              {cat.label} {cat.count}
            </button>
          ))}
        </div>
      </div>
      <div style={{ padding: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
        {filteredTemplates.map(tpl => {
          const detail = getPublicTemplateDetail(tpl.id);
          return <TemplateCard key={tpl.id} tpl={tpl} detail={detail} onPick={() => onPickTemplate?.(tpl, detail)} />;
        })}
      </div>
      <div style={{ padding: '10px 20px 18px', borderTop: '1px solid rgba(15,23,42,.06)', display: 'flex', alignItems: 'center', gap: 12, fontSize: 11, color: '#64748b' }}>
        <Filter size={12} />点击模板即可应用到画布，弹出方案卡片后可继续细化或派生新节点。
      </div>
    </div>
  </div>;
}

function TemplateCard({ tpl, detail, onPick }) {
  const [hover, setHover] = useState(false);
  return <div
    role="button"
    tabIndex={0}
    onMouseEnter={() => setHover(true)}
    onMouseLeave={() => setHover(false)}
    onClick={onPick}
    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(); } }}
    style={{ ...CARD, ...(hover ? CARD_HOVER : {}) }}
    aria-label={`应用模板 ${tpl.name}`}
  >
    <div style={{ width: '100%', aspectRatio: '16 / 10', background: '#fafafa', overflow: 'hidden' }}>
      <img src={tpl.thumb} alt={tpl.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
    </div>
    <div style={{ padding: '8px 10px 10px', display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
        <strong style={{ fontSize: 12, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tpl.name}</strong>
        <span style={{ fontSize: 10, color: '#7c3aed', fontWeight: 700 }}>{tpl.id}</span>
      </div>
      {detail?.tagline && <div style={{ fontSize: 10.5, color: '#64748b', lineHeight: 1.4 }}>{detail.tagline}</div>}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 10, color: '#94a3b8', marginTop: 2 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}><Star size={10} style={{ color: '#f59e0b' }} />{tpl.likes}</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}><Download size={10} />{tpl.downloads}</span>
        {detail?.durationSec && <span style={{ marginLeft: 'auto' }}>{detail.durationSec}s</span>}
      </div>
    </div>
  </div>;
}
