import React, { useMemo, useCallback, useRef, useState } from 'react';
import { Check, Info, ChevronDown, Globe2 } from 'lucide-react';
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
import {
  SPACING,
  FONT_SIZE,
  CONTROL_HEIGHT,
  RADIUS,
  groupTitleStyle,
  helperTextStyle,
  sectionStyle,
} from './panelVisualLanguage.js';

/* 2026-09-15 用户批注①（子项 2/3）：面板统一 480px、控件点击区 >=32px、
   间距走统一阶梯。本面板的交互逻辑（平台/语言/图片类型/比例联动）零改动，
   只把视觉层换成规范常量 —— 用户明确要求「不能粗暴匹配，要相应适配」。 */

/* 比例形状预览图标 */
function RatioShape({ w, h, active }) {
  return (
    <svg width={w+2} height={h+2} viewBox={`0 0 ${w+2} ${h+2}`} style={{ flexShrink: 0 }}>
      /* 选中 = 品牌色（原则 6.1 合法场合①），未选中 = 中性描边。 */
      <rect x={1} y={1} width={w} height={h} rx={2}
        fill={active ? 'var(--sb-brand)' : 'none'}
        stroke={active ? 'var(--sb-brand)' : 'var(--sb-border-strong)'} strokeWidth={1.5} />
    </svg>
  );
}

/* 内联比例选择器（替代原生 select）*/
function RatioSelect({ value, onChange, disabled, resolution, role, platform }) {
  const [open, setOpen] = React.useState(false);
  /* hover 用 state 表达而不是内联改 style —— 内联改 style 会覆盖声明式的选中态，
     导致 hover 与 selected 长得一样（原则 4.3 要两条不同通道）。 */
  const [hoverKey, setHoverKey] = React.useState('');
  const ref = React.useRef(null);
  const legalRatios = getLegalRatios(resolution, role, platform);
  const current = legalRatios.find(r => r.key === value) || legalRatios[0];

  return (
    <div style={{ position: 'relative' }}>
      <button ref={ref} type="button" onClick={() => !disabled && setOpen(o => !o)} disabled={disabled}
        style={{
          display: 'flex', alignItems: 'center', gap: SPACING.sp1, height: CONTROL_HEIGHT.compact, padding: `0 ${SPACING.sp2}px`,
          borderRadius: 'var(--sb-radius-control)',
          border: `1px solid ${disabled ? 'var(--sb-border-subtle)' : 'var(--sb-border-default)'}`, 
          background: disabled ? 'var(--sb-state-disabled-bg)' : 'var(--sb-surface-card)',
          cursor: disabled ? 'not-allowed' : 'pointer', 
          fontSize: FONT_SIZE.helper, fontWeight: 700, 
          color: disabled ? 'var(--sb-state-disabled-ink)' : 'var(--sb-text-primary)', 
          userSelect: 'none', fontFamily: 'inherit',
        }}>
        <RatioShape w={current.w} h={current.h} active={false} />
        <span>{current.label}</span>
        {!disabled && <svg width={8} height={8} viewBox="0 0 8 8"><path d="M1 2.5 L4 5.5 L7 2.5" stroke="var(--sb-text-hint)" strokeWidth={1.5} fill="none" strokeLinecap="round"/></svg>}
      </button>
      <AnchoredPortal anchorRef={ref} open={open} onDismiss={() => setOpen(false)} align="center" minWidth={292} maxWidth={360} className="ec-ratio-portal">
        <div style={{
          background: 'var(--sb-surface-card)',
          borderRadius: 'var(--sb-radius-card)',
          border: '1px solid var(--sb-border-default)',
          boxShadow: 'var(--sb-shadow-lg)', padding: 'var(--sb-space-2)',
          display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 4,
        }}>
          {legalRatios.map(r => {
            const sel = r.key === value;
            return (
              <div key={r.key} onClick={() => { onChange(r.key); setOpen(false); }}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--sb-space-1)',
                  padding: 'var(--sb-space-2) var(--sb-space-1)',
                  borderRadius: 'var(--sb-radius-control)', cursor: 'pointer',
                  /* hover = 中性底（原则 4.3），selected = 品牌浅底 + 品牌描边 */
                  background: sel ? 'var(--sb-state-selected-bg)' : hoverKey === r.key ? 'var(--sb-state-hover-bg)' : 'transparent',
                  border: `1px solid ${sel ? 'var(--sb-state-selected-line)' : 'transparent'}`,
                  transition: 'background-color var(--sb-duration-fast) var(--sb-ease-out)',
                }}
                onMouseEnter={() => setHoverKey(r.key)}
                onMouseLeave={() => setHoverKey('')}>
                <RatioShape w={r.w} h={r.h} active={sel} />
                <span style={{ fontSize: 'var(--sb-text-2xs)', fontWeight: 'var(--sb-weight-bold)',
                  color: sel ? 'var(--sb-state-selected-ink)' : 'var(--sb-text-secondary)' }}>{r.label}</span>
                <span style={{ fontSize: 'var(--sb-text-2xs)', color: 'var(--sb-text-hint)', textAlign: 'center', lineHeight: 1.2 }}>{r.usage}</span>
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
  platform = 'taobao',
  onPlatformChange,
  onPlatformSizingChange,
  sizing = { smart: true, images: [] },
  onSizingChange,
  resolution = '2K',
  targetLanguage = 'zh-CN',
  onTargetLanguageChange,
}) {
  const [platformOpen, setPlatformOpen] = useState(false);
  const [languageOpen, setLanguageOpen] = useState(false);
  /* hover 用 state 而不是内联改 style —— 内联会覆盖声明式的选中态样式，
     导致 hover 与 selected 长得一样（原则 4.3 要求两条不同视觉通道）。 */
  const [hoverRow, setHoverRow] = useState('');
  const platformButtonRef = useRef(null);
  const languageButtonRef = useRef(null);
  // 当前激活的图片类型列表
  const activeImages = resolveSizingImages(platform, { ...sizing, resolution });
  // 已激活的 key 集合
  const activeKeys = useMemo(() => new Set(activeImages.map(i => i.key)), [activeImages]);
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
  }, [onPlatformChange, onPlatformSizingChange, onSizingChange, resolution]);

  const handleLanguage = useCallback((nextLanguage) => {
    onTargetLanguageChange?.(nextLanguage);
    setLanguageOpen(false);
  }, [onTargetLanguageChange]);

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
  }, [activeKeys, activeImages, onSizingChange, platform, resolution]);

  /* ── 修改数量 ── */
  const updateCount = useCallback((typeKey, count) => {
    const next = activeImages.map(i => i.key === typeKey ? { ...i, count: Math.max(0, Math.min(count, IMAGE_TYPES.find(t => t.key === typeKey)?.maxCount || 20)) } : i);
    const baseline = resolveSizingImages(platform, { smart: true, images: [], resolution });
    const isBackToRecommended = hasSameImages(next, baseline);
    onSizingChange?.({ smart: isBackToRecommended, images: next });
  }, [activeImages, onSizingChange, platform, resolution]);

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
  }, [activeImages, onSizingChange, platform, resolution]);

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
      <div style={{ padding: `${SPACING.sp6}px ${SPACING.sp5}px` }}>
        {/* ── 平台与语言 ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: SPACING.sp3, marginBottom: SPACING.sp2 }}>
          <div style={{ position: 'relative' }}>
            <div style={{ ...groupTitleStyle, fontSize: FONT_SIZE.fieldLabel, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: SPACING.sp2 }}>目标平台</div>
            <button ref={platformButtonRef} type="button" aria-expanded={platformOpen} onClick={() => { setPlatformOpen(open => !open); setLanguageOpen(false); }}
              style={{ width: '100%', height: 'var(--sb-control-md)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--sb-space-2)', padding: '0 var(--sb-space-3)', borderRadius: 'var(--sb-radius-control)', border: '1px solid var(--sb-border-default)', background: 'var(--sb-surface-tint)', color: 'var(--sb-text-primary)', fontSize: 'var(--sb-text-xs)', fontWeight: 'var(--sb-weight-semibold)', cursor: 'pointer', fontFamily: 'inherit' }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{platformOption.label}</span>
              <ChevronDown size={15} style={{ flexShrink: 0, transform: platformOpen ? 'rotate(180deg)' : 'none' }} />
            </button>
            {platformOpen && (
              <AnchoredPortal anchorRef={platformButtonRef} open={platformOpen} onDismiss={() => setPlatformOpen(false)} align="center" minWidth={320} maxWidth={420} className="ec-commerce-menu">
                <div style={{ padding: 'var(--sb-space-2)', maxHeight: 'min(520px, calc(100vh - 32px))', overflowY: 'auto', borderRadius: 'var(--sb-radius-card)', border: '1px solid var(--sb-border-default)', background: 'var(--sb-surface-card)', boxShadow: 'var(--sb-shadow-lg)' }}>{COMMERCE_PLATFORMS.map(option => (
                      <button key={option.id} type="button" onClick={() => handlePlatform(option.id)}
                        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--sb-space-2)', border: 0, borderRadius: 'var(--sb-radius-control)', background: option.id === platform ? 'var(--sb-state-selected-bg)' : 'transparent', color: option.id === platform ? 'var(--sb-state-selected-ink)' : 'var(--sb-text-primary)', fontSize: 'var(--sb-text-xs)', fontWeight: option.id === platform ? 'var(--sb-weight-semibold)' : 'var(--sb-weight-regular)', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit' }}>
                        <span>{option.label}</span><span style={{ fontSize: 'var(--sb-text-2xs)', color: 'var(--sb-text-muted)' }}>{option.locale}</span>
                      </button>
                    ))}</div>
              </AnchoredPortal>
            )}
          </div>
          <div style={{ position: 'relative' }}>
            <div style={{ ...groupTitleStyle, fontSize: FONT_SIZE.fieldLabel, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: SPACING.sp2 }}>目标语言</div>
            <button ref={languageButtonRef} type="button" aria-expanded={languageOpen} onClick={() => { setLanguageOpen(open => !open); setPlatformOpen(false); }}
              style={{ width: '100%', height: 'var(--sb-control-md)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--sb-space-2)', padding: '0 var(--sb-space-3)', borderRadius: 'var(--sb-radius-control)', border: '1px solid var(--sb-border-default)', background: 'var(--sb-surface-tint)', color: 'var(--sb-text-primary)', fontSize: 'var(--sb-text-xs)', fontWeight: 'var(--sb-weight-semibold)', cursor: 'pointer', fontFamily: 'inherit' }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{languageOption.label}</span>
              <ChevronDown size={15} style={{ flexShrink: 0, transform: languageOpen ? 'rotate(180deg)' : 'none' }} />
            </button>
            {languageOpen && (
              <AnchoredPortal anchorRef={languageButtonRef} open={languageOpen} onDismiss={() => setLanguageOpen(false)} align="center" minWidth={320} maxWidth={420} className="ec-commerce-menu">
                <div style={{ padding: 'var(--sb-space-2)', maxHeight: 'min(520px, calc(100vh - 32px))', overflowY: 'auto', borderRadius: 'var(--sb-radius-card)', border: '1px solid var(--sb-border-default)', background: 'var(--sb-surface-card)', boxShadow: 'var(--sb-shadow-lg)' }}>{COMMERCE_LANGUAGES.map(option => (
                  <button key={option.id} type="button" onClick={() => handleLanguage(option.id)}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--sb-space-2)', border: 0, borderRadius: 'var(--sb-radius-control)', background: option.id === targetLanguage ? 'var(--sb-state-selected-bg)' : 'transparent', color: option.id === targetLanguage ? 'var(--sb-state-selected-ink)' : 'var(--sb-text-primary)', fontSize: 'var(--sb-text-xs)', fontWeight: option.id === targetLanguage ? 'var(--sb-weight-semibold)' : 'var(--sb-weight-regular)', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit' }}>
                    <span>{option.label}</span><span style={{ fontSize: 'var(--sb-text-2xs)', color: 'var(--sb-text-muted)' }}>{option.locale}</span>
                  </button>
                ))}</div>
              </AnchoredPortal>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: SPACING.sp1, marginBottom: SPACING.sp4, ...helperTextStyle }}>
          <Globe2 size={12} style={{ flexShrink: 0 }} />
          <span>{platformOption.summary}</span>
        </div>

        {/* ── 平台说明 ── */}
        {pDef.desc && (
          <div style={{ display: 'flex', alignItems: 'center', gap: SPACING.sp1, ...helperTextStyle, marginBottom: SPACING.sp3, padding: `${SPACING.sp2}px ${SPACING.sp3}px`, background: 'var(--sb-surface-tint)', borderRadius: 'var(--sb-radius-control)' }}>
            <Info size={12} style={{ flexShrink: 0 }} /> 当前方案：{platformOption.label} · {planSummary}
          </div>
        )}

        {/* ── 图片类型列表 ── */}
        <div style={{ ...groupTitleStyle, marginBottom: SPACING.sp2 }}>图片类型</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING.sp1 }}>
          {IMAGE_TYPES.map(typeDef => {
            const checked = activeKeys.has(typeDef.key);
            const activeItem = activeImages.find(i => i.key === typeDef.key);
            return (
              <div key={typeDef.key} style={{
                display: 'flex', alignItems: 'center', gap: SPACING.sp3,
                /* 整行 ≥48px 且整行可点：用户批注「输入区都特别小」——
                   原来只有 20×20 的勾选框能点，远低于 32px 点击区规范。 */
                minHeight: 48, padding: `${SPACING.sp2}px ${SPACING.sp3}px`,
                borderRadius: 'var(--sb-radius-card)',
                /* 选中 = 品牌浅底 + 品牌描边；hover = 中性底（原则 4.3 两条不同通道） */
                background: checked ? 'var(--sb-state-selected-bg)' : hoverRow === typeDef.key ? 'var(--sb-state-hover-bg)' : 'transparent',
                border: `1.5px solid ${checked ? 'var(--sb-state-selected-line)' : 'transparent'}`,
                transition: 'background-color var(--sb-duration-fast) var(--sb-ease-out), border-color var(--sb-duration-fast) var(--sb-ease-out)',
                cursor: 'pointer',
              }}
                onMouseEnter={() => setHoverRow(typeDef.key)}
                onMouseLeave={() => setHoverRow('')}
                role="checkbox"
                aria-checked={checked}
                aria-label={typeDef.label}
                onClick={() => toggleType(typeDef.key)}
              >
                {/* 勾选框：视觉 20×20（保持分类列表的轻量感），
                    点击目标由父行承担（父行 minHeight 48px 且整行 onClick）。 */}
                <div aria-hidden="true" style={{
                  width: 20, height: 20, borderRadius: 'var(--sb-radius-chip)', flexShrink: 0,
                  /* 勾选 = 品牌色（原则 6.1「当前选中」），未选 = 中性描边 */
                  border: `2px solid ${checked ? 'var(--sb-brand)' : 'var(--sb-border-strong)'}`,
                  background: checked ? 'var(--sb-brand)' : 'var(--sb-surface-card)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'background-color var(--sb-duration-fast) var(--sb-ease-out)',
                }}>
                  {checked && <Check size={12} color="var(--sb-brand-ink)" strokeWidth={3} />}
                </div>

                {/* 图标 + 标签 */}
                <span style={{ fontSize: 15, flexShrink: 0 }}>{typeDef.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: FONT_SIZE.body, fontWeight: 600, color: checked ? 'var(--sb-state-selected-ink)' : 'var(--sb-text-primary)' }}>{typeDef.label}</div>
                  <div style={{ ...helperTextStyle, marginTop: 1 }}>{typeDef.desc}</div>
                </div>

                {/* 数量 + 比例（始终显示，未勾选时禁用） */}
                <div style={{ 
                  display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
                  opacity: checked ? 1 : 0.35,
                  pointerEvents: checked ? 'auto' : 'none',
                  transition: 'opacity 0.2s',
                }}>
                  <span style={helperTextStyle}>数量</span>
                  <input type="number" min={0} max={typeDef.maxCount || 20}
                    value={checked && activeItem ? activeItem.count : typeDef.defaultCount}
                    onChange={e => updateCount(typeDef.key, parseInt(e.target.value) || 0)}
                    disabled={!checked}
                    style={{
                      width: 44, height: CONTROL_HEIGHT.compact, textAlign: 'center', borderRadius: RADIUS.control,
                      border: `1px solid ${checked ? 'var(--sb-border-default)' : 'var(--sb-border-subtle)'}`, 
                      background: checked ? 'var(--sb-surface-card)' : 'var(--sb-state-disabled-bg)',
                      fontSize: FONT_SIZE.body, fontWeight: 600, outline: 'none', fontFamily: 'inherit',
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
          marginTop: SPACING.sp3, paddingTop: SPACING.sp3, borderTop: '1px solid var(--sb-border-subtle)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          fontSize: FONT_SIZE.body, fontWeight: 600, color: 'var(--text-muted)',
        }}>
          <span>共 <b style={{ color: 'var(--text-primary)' }}>{totalImages}</b> 张图片</span>
          {platform === 'amazon' && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 3, color: 'var(--sb-warning)', fontSize: FONT_SIZE.helper }}>
              <Info size={12} /> 亚马逊首图须纯白底
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export { IMAGE_TYPES, PLATFORM_PRESETS, RATIOS, resolveSizingImages };
