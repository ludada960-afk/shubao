import React, { useMemo, useCallback, useRef, useState } from 'react';
import { Check, Info, Zap, Pencil, ChevronDown, Globe2 } from 'lucide-react';
import AnchoredPortal from '../../../components/ui/AnchoredPortal.jsx';
import {
  getLegalRatios,
  IMAGE_TYPES,
  PLATFORM_PRESETS,
  RATIOS,
  resolveSizingImages,
} from './ecommercePlanModel.js';
import { normalizeCommerceFormat } from './ecommerceFormatRegistry.js';
import { COMMERCE_LANGUAGES, COMMERCE_PLATFORMS } from './internationalCommerceRegistry.js';

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
function RatioSelect({ value, onChange, disabled, resolution, role, platform }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);
  const legalRatios = getLegalRatios(resolution, role, platform);
  const current = legalRatios.find(r => r.key === value) || legalRatios[0];

  return (
    <div style={{ position: 'relative' }}>
      <button ref={ref} type="button" onClick={() => !disabled && setOpen(o => !o)} disabled={disabled}
        style={{
          display: 'flex', alignItems: 'center', gap: 4, height: 26, padding: '0 7px',
          borderRadius: 7, border: `1px solid ${disabled ? 'rgba(0,0,0,0.06)' : 'rgba(0,0,0,0.14)'}`, 
          background: disabled ? 'rgba(0,0,0,0.03)' : '#fff',
          cursor: disabled ? 'not-allowed' : 'pointer', 
          fontSize: 11, fontWeight: 700, 
          color: disabled ? 'var(--text-muted)' : '#1a1a1a', 
          userSelect: 'none', fontFamily: 'inherit',
        }}>
        <RatioShape w={current.w} h={current.h} active={false} />
        <span>{current.label}</span>
        {!disabled && <svg width={8} height={8} viewBox="0 0 8 8"><path d="M1 2.5 L4 5.5 L7 2.5" stroke="#999" strokeWidth={1.5} fill="none" strokeLinecap="round"/></svg>}
      </button>
      <AnchoredPortal anchorRef={ref} open={open} onDismiss={() => setOpen(false)} align="center" minWidth={292} maxWidth={360} className="ec-ratio-portal">
        <div style={{
          background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(16px)',
          borderRadius: 10, border: '1px solid rgba(0,0,0,0.10)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.14)', padding: '6px',
          display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 4,
        }}>
          {legalRatios.map(r => {
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
      </AnchoredPortal>
    </div>
  );
}

function hasSameImages(left, right) {
  if (left.length !== right.length) return false;
  return left.every((item, index) => {
    const baseline = right[index];
    return item.key === baseline.key
      && item.count === baseline.count
      && item.ratio === baseline.ratio
      && (item.targetRatio || item.ratio) === (baseline.targetRatio || baseline.ratio);
  });
}

/* ═══════ SizingPanel — 图片类型组件库 + 平台推荐 ═══════ */
export default function SizingPanel({
  platform = 'smart',
  onPlatformChange,
  onPlatformSizingChange,
  sizing = { smart: true, images: [] },
  onSizingChange,
  smartMode = true,
  onOverride,
  resolution = '2K',
  targetLanguage = 'zh-CN',
  onTargetLanguageChange,
}) {
  const [platformOpen, setPlatformOpen] = useState(false);
  const [languageOpen, setLanguageOpen] = useState(false);
  const platformButtonRef = useRef(null);
  const languageButtonRef = useRef(null);
  // 当前激活的图片类型列表
  const activeImages = resolveSizingImages(platform, { ...sizing, resolution });
  // 已激活的 key 集合
  const activeKeys = useMemo(() => new Set(activeImages.map(i => i.key)), [activeImages]);
  // 是否已被用户自定义
  const isCustomized = platform !== 'smart'
    || targetLanguage !== 'zh-CN'
    || sizing.smart === false
    || (sizing.images?.length > 0 && !sizing.smart);

  /* ── 平台切换 ── */
  const handlePlatform = useCallback((key) => {
    const newImages = resolveSizingImages(key, { smart: true, images: [], resolution });
    if (onPlatformSizingChange) {
      onPlatformSizingChange(key, { smart: true, images: newImages });
    } else {
      onPlatformChange?.(key);
      onSizingChange?.({ smart: true, images: newImages });
    }
    setPlatformOpen(false);
    onOverride?.(key !== 'smart');
  }, [onPlatformChange, onPlatformSizingChange, onSizingChange, onOverride, resolution]);

  const handleLanguage = useCallback((nextLanguage) => {
    onTargetLanguageChange?.(nextLanguage);
    setLanguageOpen(false);
    onOverride?.(nextLanguage !== 'zh-CN');
  }, [onOverride, onTargetLanguageChange]);

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
      const format = normalizeCommerceFormat({ ratio: typeDef.defaultRatio, role: typeKey });
      next = [...activeImages, {
        key: typeKey,
        count: typeDef.defaultCount || 1,
        ratio: format.generationRatio,
        targetRatio: format.targetRatio,
        cropPolicy: format.cropPolicy,
        label: typeDef.label,
      }];
    }
    const baseline = resolveSizingImages(platform, { smart: true, images: [], resolution });
    const isBackToRecommended = hasSameImages(next, baseline);
    onSizingChange?.({ smart: isBackToRecommended, images: next });
    onOverride?.(!isBackToRecommended);
  }, [activeKeys, activeImages, onSizingChange, onOverride, platform, resolution]);

  /* ── 修改数量 ── */
  const updateCount = useCallback((typeKey, count) => {
    const next = activeImages.map(i => i.key === typeKey ? { ...i, count: Math.max(0, Math.min(count, IMAGE_TYPES.find(t => t.key === typeKey)?.maxCount || 20)) } : i);
    const baseline = resolveSizingImages(platform, { smart: true, images: [], resolution });
    const isBackToRecommended = hasSameImages(next, baseline);
    onSizingChange?.({ smart: isBackToRecommended, images: next });
    onOverride?.(!isBackToRecommended);
  }, [activeImages, onSizingChange, onOverride, platform, resolution]);

  /* ── 修改比例 ── */
  const updateRatio = useCallback((typeKey, ratio) => {
    if (!getLegalRatios(resolution, typeKey, platform).some(option => option.key === ratio)) return;
    const format = normalizeCommerceFormat({ ratio, role: typeKey });
    const next = activeImages.map(i => i.key === typeKey ? {
      ...i,
      ratio: format.generationRatio,
      targetRatio: format.targetRatio,
      cropPolicy: format.cropPolicy,
    } : i);
    const baseline = resolveSizingImages(platform, { smart: true, images: [], resolution });
    const isBackToRecommended = hasSameImages(next, baseline);
    onSizingChange?.({ smart: isBackToRecommended, images: next });
    onOverride?.(!isBackToRecommended);
  }, [activeImages, onSizingChange, onOverride, platform, resolution]);

  const totalImages = activeImages.reduce((s, img) => s + (img.count || 0), 0);
  const pDef = PLATFORM_PRESETS[platform] || PLATFORM_PRESETS.smart;
  const platformOption = COMMERCE_PLATFORMS.find(item => item.id === platform) || COMMERCE_PLATFORMS[0];
  const languageOption = COMMERCE_LANGUAGES.find(item => item.id === targetLanguage) || COMMERCE_LANGUAGES[0];
  const planSummary = activeImages
    .filter(item => item.count > 0)
    .map(item => `${item.label || item.key}×${item.count}`)
    .join('、') || '尚未选择图片类型';

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
        {/* ── 平台与语言 ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
          <div style={{ position: 'relative' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8, letterSpacing: 0.3 }}>目标平台</div>
            <button ref={platformButtonRef} type="button" aria-expanded={platformOpen} onClick={() => { setPlatformOpen(open => !open); setLanguageOpen(false); }}
              style={{ width: '100%', height: 38, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '0 11px', borderRadius: 10, border: '1px solid rgba(0,0,0,0.12)', background: '#f8f8fa', color: 'var(--text-primary)', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{platformOption.label}</span>
              <ChevronDown size={15} style={{ flexShrink: 0, transform: platformOpen ? 'rotate(180deg)' : 'none' }} />
            </button>
            {platformOpen && (
              <AnchoredPortal anchorRef={platformButtonRef} open={platformOpen} onDismiss={() => setPlatformOpen(false)} align="center" minWidth={320} maxWidth={420} className="ec-commerce-menu">
                <div style={{ padding: 6, maxHeight: 'min(520px, calc(100vh - 32px))', overflowY: 'auto', borderRadius: 12, border: '1px solid rgba(0,0,0,0.12)', background: '#fff', boxShadow: '0 16px 36px rgba(0,0,0,0.16)' }}>{COMMERCE_PLATFORMS.map(option => (
                      <button key={option.id} type="button" onClick={() => handlePlatform(option.id)}
                        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px', border: 0, borderRadius: 8, background: option.id === platform ? 'rgba(124,58,237,0.10)' : 'transparent', color: option.id === platform ? '#6d28d9' : 'var(--text-primary)', fontSize: 12, fontWeight: option.id === platform ? 800 : 500, textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit' }}>
                        <span>{option.label}</span><span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{option.locale}</span>
                      </button>
                    ))}</div>
              </AnchoredPortal>
            )}
          </div>
          <div style={{ position: 'relative' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8, letterSpacing: 0.3 }}>目标语言</div>
            <button ref={languageButtonRef} type="button" aria-expanded={languageOpen} onClick={() => { setLanguageOpen(open => !open); setPlatformOpen(false); }}
              style={{ width: '100%', height: 38, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '0 11px', borderRadius: 10, border: '1px solid rgba(0,0,0,0.12)', background: '#f8f8fa', color: 'var(--text-primary)', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{languageOption.label}</span>
              <ChevronDown size={15} style={{ flexShrink: 0, transform: languageOpen ? 'rotate(180deg)' : 'none' }} />
            </button>
            {languageOpen && (
              <AnchoredPortal anchorRef={languageButtonRef} open={languageOpen} onDismiss={() => setLanguageOpen(false)} align="center" minWidth={320} maxWidth={420} className="ec-commerce-menu">
                <div style={{ padding: 6, maxHeight: 'min(520px, calc(100vh - 32px))', overflowY: 'auto', borderRadius: 12, border: '1px solid rgba(0,0,0,0.12)', background: '#fff', boxShadow: '0 16px 36px rgba(0,0,0,0.16)' }}>{COMMERCE_LANGUAGES.map(option => (
                  <button key={option.id} type="button" onClick={() => handleLanguage(option.id)}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px', border: 0, borderRadius: 8, background: option.id === targetLanguage ? 'rgba(124,58,237,0.10)' : 'transparent', color: option.id === targetLanguage ? '#6d28d9' : 'var(--text-primary)', fontSize: 12, fontWeight: option.id === targetLanguage ? 800 : 500, textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit' }}>
                    <span>{option.label}</span><span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{option.locale}</span>
                  </button>
                ))}</div>
              </AnchoredPortal>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16, color: 'var(--text-muted)', fontSize: 10 }}>
          <Globe2 size={12} />
          <span>{platformOption.summary}</span>
        </div>

        {/* ── 平台说明 ── */}
        {pDef.desc && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-muted)', marginBottom: 14, padding: '6px 10px', background: 'rgba(0,0,0,0.025)', borderRadius: 8 }}>
            <Info size={12} /> 当前方案：{platformOption.label} · {planSummary}
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
                    value={checked && activeItem ? (activeItem.targetRatio || activeItem.ratio) : typeDef.defaultRatio}
                    onChange={r => checked && updateRatio(typeDef.key, r)} 
                    disabled={!checked}
                    resolution={resolution}
                    role={typeDef.key}
                    platform={platform}
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
          {platform === 'amazon' && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 3, color: '#e67e22', fontSize: 11 }}>
              <Info size={12} /> 亚马逊首图须纯白底
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export { IMAGE_TYPES, PLATFORM_PRESETS, RATIOS, resolveSizingImages };
