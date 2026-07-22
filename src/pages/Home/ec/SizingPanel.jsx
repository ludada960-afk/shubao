import React, { useMemo, useCallback, useState, useEffect, useRef } from 'react';
import { Check, Info, ChevronDown, Zap, Pencil } from 'lucide-react';

/* ═══════ 图片类型组件库 ═══════ */
const IMAGE_TYPES = [
  { key: 'white_bg', label: '白底首图', icon: '⬜', defaultRatio: '1:1', defaultCount: 1,
    desc: '纯白底产品居中，电商必选', usage: '首图/主图', maxCount: 3 },
  { key: 'main_text', label: '商品主图', icon: '🖼️', defaultRatio: '1:1', defaultCount: 3,
    desc: '核心卖点展示，可含促销文字', usage: '主图轮播', maxCount: 5 },
  { key: 'main_3x4', label: '商品主图 3:4', icon: '📱', defaultRatio: '3:4', defaultCount: 3,
    desc: '竖版主图，适合移动端展示', usage: '竖版主图', maxCount: 5 },
  { key: 'transparent', label: '透明 PNG', icon: '🔲', defaultRatio: '1:1', defaultCount: 1,
    desc: '去底素材，方便二次设计', usage: '素材/合成用', maxCount: 3 },
  { key: 'sku', label: 'SKU 规格图', icon: '🏷️', defaultRatio: '1:1', defaultCount: 0,
    desc: '同款不同色/规格展示', usage: 'SKU选择', maxCount: 20 },
  { key: 'detail', label: '详情切片', icon: '📋', defaultRatio: '3:4', defaultCount: 5,
    desc: '长图详情页切片，含多种子类', usage: '详情页长图', maxCount: 10 },
  { key: 'poster', label: '营销海报', icon: '🎯', defaultRatio: '3:4', defaultCount: 0,
    desc: '促销活动、节日海报、Banner', usage: '活动推广', maxCount: 5 },
];

/* ═══════ 比例选项（带形状预览，去平台名）═══ */
const RATIOS = [
  { key: '1:1',    label: '1:1',    w: 18, h: 18, usage: '正方形' },
  { key: '3:4',    label: '3:4',    w: 14, h: 18, usage: '竖版' },
  { key: '4:3',    label: '4:3',    w: 18, h: 14, usage: '横版' },
  { key: '9:16',   label: '9:16',   w: 10, h: 18, usage: '全屏竖版' },
  { key: '16:9',   label: '16:9',   w: 18, h: 10, usage: '宽屏' },
  { key: '2:3',    label: '2:3',    w: 12, h: 18, usage: '经典竖版' },
  { key: '21:9',   label: '21:9',   w: 21, h: 9,  usage: '超宽横条' },
  { key: '5:4',    label: '5:4',    w: 16, h: 13, usage: '传统比例' },
  { key: '4:5',    label: '4:5',    w: 13, h: 16, usage: '社交竖版' },
  { key: '32:9',   label: '32:9',   w: 24, h: 7,  usage: '全景横幅' },
];

/* 比例形状预览图标 */
function RatioShape({ w, h, active }) {
  return (
    <svg width={w+2} height={h+2} viewBox={`0 0 ${w+2} ${h+2}`} style={{ flexShrink: 0 }}>
      <rect x={1} y={1} width={w} height={h} rx={2}
        fill={active ? '#7c3aed' : 'none'}
        stroke={active ? '#7c3aed' : 'rgba(0,0,0,0.35)'} strokeWidth={1.5} />
    </svg>
  );
}

/* 内联比例选择器（替代原生 select）*/
function RatioSelect({ value, onChange, disabled }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);
  const current = RATIOS.find(r => r.key === value) || RATIOS[0];

  React.useEffect(() => {
    if (!open) return;
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    setTimeout(() => window.addEventListener('mousedown', close), 0);
    return () => window.removeEventListener('mousedown', close);
  }, [open]);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div onClick={() => !disabled && setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 4, height: 26, padding: '0 7px',
          borderRadius: 7, border: `1px solid ${disabled ? 'rgba(0,0,0,0.06)' : 'rgba(0,0,0,0.14)'}`, 
          background: disabled ? 'rgba(0,0,0,0.03)' : '#fff',
          cursor: disabled ? 'not-allowed' : 'pointer', 
          fontSize: 11, fontWeight: 700, 
          color: disabled ? 'var(--text-muted)' : '#1a1a1a', 
          userSelect: 'none',
        }}>
        <RatioShape w={current.w} h={current.h} active={false} />
        <span>{current.label}</span>
        {!disabled && <svg width={8} height={8} viewBox="0 0 8 8"><path d="M1 2.5 L4 5.5 L7 2.5" stroke="#999" strokeWidth={1.5} fill="none" strokeLinecap="round"/></svg>}
      </div>
      {open && (
        <div style={{
          position: 'absolute', top: 30, right: 0, zIndex: 1000,
          background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(16px)',
          borderRadius: 10, border: '1px solid rgba(0,0,0,0.10)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.14)', padding: '6px',
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4, minWidth: 160,
        }}>
          {RATIOS.map(r => {
            const sel = r.key === value;
            return (
              <div key={r.key} onClick={() => { onChange(r.key); setOpen(false); }}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                  padding: '6px 4px', borderRadius: 7, cursor: 'pointer',
                  background: sel ? 'rgba(124,58,237,0.08)' : 'transparent',
                  border: `1px solid ${sel ? 'rgba(124,58,237,0.3)' : 'transparent'}`,
                  transition: 'all 0.12s',
                }}
                onMouseEnter={e => { if (!sel) e.currentTarget.style.background='rgba(0,0,0,0.04)'; }}
                onMouseLeave={e => { if (!sel) e.currentTarget.style.background='transparent'; }}>
                <RatioShape w={r.w} h={r.h} active={sel} />
                <span style={{ fontSize: 10, fontWeight: 700, color: sel ? '#7c3aed' : '#555' }}>{r.label}</span>
                <span style={{ fontSize: 9, color: '#aaa', textAlign: 'center', lineHeight: 1.2 }}>{r.usage}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ═══════ 平台推荐组合 ═══════ */
const PLATFORM_PRESETS = {
  smart:    { name: '智能推荐', icon: '🤖', desc: 'AI 根据产品自动选择最佳平台和套餐',
              types: ['white_bg', 'main_text', 'transparent', 'detail'] },
  '淘宝':   { name: '淘宝/天猫', icon: '🟠', desc: '1白底首图+3商品主图+1透明PNG+5详情=10张',
              types: ['white_bg', 'main_text', 'transparent', 'detail'] },
  '京东':   { name: '京东', icon: '🔴', desc: '1白底首图+3商品主图+1透明PNG+5详情=10张',
              types: ['white_bg', 'main_text', 'transparent', 'detail'] },
  '拼多多': { name: '拼多多', icon: '🟢', desc: '5商品主图+3详情切片，促销风格',
              types: ['main_text', 'detail'] },
  '抖音':   { name: '抖音小店', icon: '🎵', desc: '3商品主图+1透明PNG+3详情，竖版优先',
              types: ['main_3x4', 'transparent', 'detail'] },
  '小红书': { name: '小红书商城', icon: '📕', desc: '3竖版主图+2详情，生活方式调性',
              types: ['main_3x4', 'detail'] },
  '亚马逊': { name: 'Amazon', icon: '🌐', desc: '1纯白底首图+4商品主图+1透明PNG，不可含文字',
              types: ['white_bg', 'main_text', 'transparent'] },
};

const PLATFORMS = [
  { key: 'smart', label: '智能', icon: '🤖' },
  { key: '淘宝', label: '淘宝', icon: '🟠' },
  { key: '京东', label: '京东', icon: '🔴' },
  { key: '拼多多', label: '拼多多', icon: '🟢' },
  { key: '抖音', label: '抖音', icon: '🎵' },
  { key: '小红书', label: '小红书', icon: '📕' },
  { key: '亚马逊', label: '亚马逊', icon: '🌐' },
];

/* ═══════ 构建默认 images 数组 ═══════ */
function buildDefaultImages(typeKeys) {
  return IMAGE_TYPES
    .filter(t => typeKeys.includes(t.key))
    .map(t => ({ key: t.key, count: t.defaultCount, ratio: t.defaultRatio, label: t.label }));
}

/* ═══════ SizingPanel — 图片类型组件库 + 平台推荐 ═══════ */
export default function SizingPanel({
  platform = 'smart',
  onPlatformChange,
  sizing = { smart: true, images: [] },
  onSizingChange,
  smartMode = true,
  onOverride,
}) {
  // 当前激活的图片类型列表
  const activeImages = sizing.images?.length ? sizing.images : buildDefaultImages(PLATFORM_PRESETS[platform]?.types || PLATFORM_PRESETS.smart.types);
  // 已激活的 key 集合
  const activeKeys = useMemo(() => new Set(activeImages.map(i => i.key)), [activeImages]);
  // 是否已被用户自定义
  const isCustomized = sizing.smart === false || (sizing.images?.length > 0 && !sizing.smart);

  /* ── 平台切换 ── */
  const handlePlatform = useCallback((key) => {
    onPlatformChange?.(key);
    const preset = PLATFORM_PRESETS[key] || PLATFORM_PRESETS.smart;
    const newImages = buildDefaultImages(preset.types);
    onSizingChange?.({ smart: true, images: newImages });
  }, [onPlatformChange, onSizingChange]);

  /* ── 切换图片类型勾选 ── */
  const toggleType = useCallback((typeKey) => {
    const typeDef = IMAGE_TYPES.find(t => t.key === typeKey);
    if (!typeDef) return;
    let next;
    if (activeKeys.has(typeKey)) {
      // 取消勾选 → 移除
      next = activeImages.filter(i => i.key !== typeKey);
    } else {
      // 勾选 → 添加（默认数量）
      next = [...activeImages, { key: typeKey, count: typeDef.defaultCount || 1, ratio: typeDef.defaultRatio, label: typeDef.label }];
    }
    onSizingChange?.({ smart: false, images: next });
    onOverride?.();
  }, [activeKeys, activeImages, onSizingChange, onOverride]);

  /* ── 修改数量 ── */
  const updateCount = useCallback((typeKey, count) => {
    const next = activeImages.map(i => i.key === typeKey ? { ...i, count: Math.max(0, Math.min(count, IMAGE_TYPES.find(t => t.key === typeKey)?.maxCount || 20)) } : i);
    onSizingChange?.({ smart: false, images: next });
    onOverride?.();
  }, [activeImages, onSizingChange, onOverride]);

  /* ── 修改比例 ── */
  const updateRatio = useCallback((typeKey, ratio) => {
    const next = activeImages.map(i => i.key === typeKey ? { ...i, ratio } : i);
    onSizingChange?.({ smart: false, images: next });
    onOverride?.();
  }, [activeImages, onSizingChange, onOverride]);

  const totalImages = activeImages.reduce((s, img) => s + (img.count || 0), 0);
  const pDef = PLATFORM_PRESETS[platform] || PLATFORM_PRESETS.smart;

  return (
    <div style={{ padding: 0 }}>
      {/* ── 智能方案指示 ── */}
      {smartMode && !isCustomized && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '10px 16px', background: 'linear-gradient(135deg, rgba(34,197,94,0.08), rgba(34,197,94,0.04))',
          borderBottom: '1px solid rgba(34,197,94,0.12)',
          fontSize: 12, fontWeight: 600, color: '#16a34a',
        }}>
          <Zap size={14} />
          <span>当前：已启用智能方案 · 系统根据平台自动推荐最佳图片组合</span>
        </div>
      )}
      {isCustomized && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '10px 16px', background: 'linear-gradient(135deg, rgba(124,58,237,0.06), rgba(124,58,237,0.03))',
          borderBottom: '1px solid rgba(124,58,237,0.1)',
          fontSize: 12, fontWeight: 600, color: '#7c3aed',
        }}>
          <Pencil size={14} />
          <span>已自定义配置 · 基于智能推荐修改</span>
        </div>
      )}

      <div style={{ padding: '14px 16px 12px' }}>
        {/* ── 平台选择 ── */}
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8, letterSpacing: 0.3 }}>目标平台</div>
        <div style={{ display: 'flex', gap: 5, marginBottom: 16, flexWrap: 'wrap' }}>
          {PLATFORMS.map(p => {
            const active = platform === p.key;
            return (
              <div key={p.key} onClick={() => handlePlatform(p.key)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '7px 14px', borderRadius: 10, cursor: 'pointer',
                  border: '1.5px solid', fontSize: 12, fontWeight: 600,
                  borderColor: active ? '#1a1a1a' : 'rgba(0,0,0,0.1)',
                  background: active ? '#1a1a1a' : 'rgba(0,0,0,0.03)',
                  color: active ? '#fff' : 'var(--text-secondary)',
                  transition: 'all 0.18s ease', whiteSpace: 'nowrap',
                }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(0,0,0,0.06)'; }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'rgba(0,0,0,0.03)'; }}>
                <span>{p.icon}</span><span>{p.label}</span>
              </div>
            );
          })}
        </div>

        {/* ── 平台说明 ── */}
        {pDef.desc && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-muted)', marginBottom: 14, padding: '6px 10px', background: 'rgba(0,0,0,0.025)', borderRadius: 8 }}>
            <Info size={12} /> {pDef.desc}
          </div>
        )}

        {/* ── 图片类型列表 ── */}
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8, letterSpacing: 0.3 }}>图片类型</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {IMAGE_TYPES.map(typeDef => {
            const checked = activeKeys.has(typeDef.key);
            const activeItem = activeImages.find(i => i.key === typeDef.key);
            return (
              <div key={typeDef.key} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 10px', borderRadius: 10,
                background: checked ? 'rgba(0,0,0,0.03)' : 'transparent',
                border: `1.5px solid ${checked ? 'rgba(0,0,0,0.1)' : 'transparent'}`,
                transition: 'all 0.15s',
              }}>
                {/* 勾选框 */}
                <div onClick={() => toggleType(typeDef.key)} style={{
                  width: 20, height: 20, borderRadius: 6, cursor: 'pointer',
                  border: `2px solid ${checked ? '#1a1a1a' : 'rgba(0,0,0,0.15)'}`,
                  background: checked ? '#1a1a1a' : '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.15s', flexShrink: 0,
                }}>
                  {checked && <Check size={12} color="#fff" strokeWidth={3} />}
                </div>

                {/* 图标 + 标签 */}
                <span style={{ fontSize: 14, flexShrink: 0 }}>{typeDef.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{typeDef.label}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>{typeDef.desc}</div>
                </div>

                {/* 数量 + 比例（始终显示，未勾选时禁用） */}
                <div style={{ 
                  display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
                  opacity: checked ? 1 : 0.35,
                  pointerEvents: checked ? 'auto' : 'none',
                  transition: 'opacity 0.2s',
                }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>数量</span>
                  <input type="number" min={0} max={typeDef.maxCount || 20}
                    value={checked && activeItem ? activeItem.count : typeDef.defaultCount}
                    onChange={e => updateCount(typeDef.key, parseInt(e.target.value) || 0)}
                    disabled={!checked}
                    style={{
                      width: 38, height: 26, textAlign: 'center', borderRadius: 6,
                      border: `1px solid ${checked ? 'rgba(0,0,0,0.12)' : 'rgba(0,0,0,0.06)'}`, 
                      background: checked ? '#fff' : 'rgba(0,0,0,0.03)',
                      fontSize: 12, fontWeight: 600, outline: 'none', fontFamily: 'inherit',
                      color: checked ? 'var(--text-primary)' : 'var(--text-muted)',
                      cursor: checked ? 'text' : 'not-allowed',
                    }} />
                  <RatioSelect 
                    value={checked && activeItem ? activeItem.ratio : typeDef.defaultRatio} 
                    onChange={r => checked && updateRatio(typeDef.key, r)} 
                    disabled={!checked}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* ── 底部统计 ── */}
        <div style={{
          marginTop: 12, paddingTop: 10, borderTop: '1px solid rgba(0,0,0,0.06)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          fontSize: 12, fontWeight: 600, color: 'var(--text-muted)',
        }}>
          <span>共 <b style={{ color: 'var(--text-primary)' }}>{totalImages}</b> 张图片</span>
          {platform === '亚马逊' && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 3, color: '#e67e22', fontSize: 11 }}>
              <Info size={12} /> 亚马逊首图须纯白底
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export { IMAGE_TYPES, PLATFORM_PRESETS, RATIOS };
