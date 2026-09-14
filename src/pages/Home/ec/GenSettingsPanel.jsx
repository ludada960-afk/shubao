import React, { useState } from 'react';
import { ChevronDown, Monitor, Palette, Sparkles } from 'lucide-react';
import { HexColorPicker } from 'react-colorful';
import { IMAGE_MODELS, SELECTABLE_IMAGE_MODELS, imageModelResolutions, normalizeImageModel } from '../../../services/imageModelCatalog.js';
import { brandLogo } from '../../../services/modelLogos.js';
import ModelLogo from '../../../components/ModelLogo.jsx';
/* 未锁定态的唯一事实源（D8：同一语义只允许一处定义，禁止各面板内联同一组值）。 */
import { NEUTRAL_UNLOCKED } from './panelVisualLanguage.js';

/* ══════════════════════════════════════════════════════════════════════
   2026-09-15 总统筹 V3 改造（用户点名「最丑」的面板）

   取值来源：src/styles/design-tokens-v3.css（--sb-*，唯一权威）
   原则来源：docs/design/00-principles.md
   问题来源：docs/design/31-current-ui-audit.md §1.3 / §Q5
   ──────────────────────────────────────────────────────────────────────
   本文件按原则逐条落地，**不再自己发明取值**（含颜色、间距、圆角、字号）：

   ▌原则 3.2（面板内禁止套白卡）
     旧实现：分组套「纯白卡 + 极淡黑描边」，再套进 L1 半透明白面板。
     两者色差 ≈0，那条 1px 边框成了唯一分界 → 面板看起来像「一堆小方框拼的表格」，
     正是「又丑又 low」的视觉来源。
     新实现：分组改用 **留白 + 分组标题** 分区，不套白卡；
     选项控件底 = --sb-surface-tint（L3），默认**不画边框**。

   ▌原则 3.3（分层二选一，禁止「弱色差 + 弱边框」）
     旧实现正是被禁止的 C 方案。现在默认态零边框，只有 hover/selected 才出现描边。

   ▌原则 4.3 与 1.2（hover 与 selected 必须走不同视觉通道）
     hover    ：**只**改底色 → --sb-state-hover-bg（中性灰，绝不发紫）
     selected ：底 --sb-state-selected-bg + 描边 --sb-state-selected-line
                + 文字/图标 --sb-state-selected-ink（品牌紫，持久不随鼠标移开消失）
     旧实现 hover 与 selected 都往「紫渐变 + 紫阴影」走，用户分不清
     「鼠标停在这」和「这个面板是开着的」。

   ▌原则 6.1（彩色字只有三种合法场合）
     分组标签是**层级信息**，不是品牌动作 → 图标与文字一律中性色。
     旧实现把「分辨率/品质/品牌色」等普通分组标签的图标染紫，属明确禁止项。

   ▌原则 6.3（默认必须处于未锁定 / 中性态）
     默认态零品牌紫；品牌紫只在选中/锁定时出现。

   ▌原则 3.4（嵌套圆角公式：内层 = 外层 − 内边距）
     面板 20 → 内层 12（--sb-radius-card）→ 更内层 8（--sb-radius-control）。

   ▌原则 2.3 / 2.1（面板内边距 20、组内:组间 = 1:2）
     --sb-panel-padding(20) / --sb-group-gap(20) / --sb-field-gap(8)
   ══════════════════════════════════════════════════════════════════════ */

/* 取色器起始色的兜底值：SSR / 无 document 时才用到，正常路径一律从
   --sb-text-primary 读取（见组件内 neutralInk）。 */
const FALLBACK_NEUTRAL_INK = 'rgb(26, 22, 20)';

const RESOLUTIONS = [
  { key: '1K', label: '1K', ratio: '标准', desc: '试方向' },
  { key: '2K', label: '2K', ratio: '高清', desc: '推荐' },
  { key: '4K', label: '4K', ratio: '超清', desc: '看细节' },
];

/* 分组标题（原则 3.2：用「留白 + 分组标题」分区，而不是套卡片）
   11/700 + --sb-text-hint；与内容间距 --sb-field-gap(8)，
   分组之间由父级 --sb-group-gap(20) 拉开。 */
function GroupTitle({ icon: Icon, children }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--sb-space-2)',
      fontSize: 'var(--sb-text-2xs)',
      fontWeight: 'var(--sb-weight-bold)',
      color: 'var(--sb-text-hint)',
      lineHeight: 'var(--sb-leading-tight)',
    }}>
      {/* 中性色图标：标签是层级信息，不是品牌动作（原则 6.1） */}
      <Icon size={13} style={{ flexShrink: 0 }} aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}

export default function GenSettingsPanel({ value, onChange, showHeader = true, brandColors = null, onBrandColorsChange = null }) {
  const safeValue = value || {};
  const selectedModel = normalizeImageModel(safeValue.imageModel);
  const currentDef = IMAGE_MODELS.find(model => model.id === selectedModel);
  const set = (key, val) => onChange?.({ ...safeValue, [key]: val });
  /* 清晰度选项跟着模型能力走 —— Midjourney 上游只有 1K/2K（既有契约，不许破坏）。 */
  const availableResolutions = imageModelResolutions(selectedModel);
  const resolutionChoices = RESOLUTIONS.filter(r => availableResolutions.includes(r.key));

  /* 原则 6.3：默认「未锁定任何颜色」；锁定态只由外部 brandColors 推导。 */
  const brandLocked = Array.isArray(brandColors) && brandColors.length > 0;
  /* 未锁定时取色器的起始色 = 中性墨色（--sb-text-primary），**不是品牌紫**。
     从 token 读，避免再引入硬编码 hex（铁律：组件里禁止硬编码色值）。 */
  const neutralInk = typeof window !== 'undefined'
    ? getComputedStyle(document.documentElement).getPropertyValue('--sb-text-primary').trim()
    : '';
  const [pickerColor, setPickerColor] = useState(() => (brandLocked && brandColors[0] ? brandColors[0] : (neutralInk || FALLBACK_NEUTRAL_INK)));
  const [pickerOpen, setPickerOpen] = useState(false);
  const [modelListOpen, setModelListOpen] = useState(false);
  /* 注：本组件不再自管 hover 状态 —— .sb-opt 用 CSS 伪类表达 hover，
     既满足 D2「hover 只做底色」，又避免内联 style 覆盖声明式伪类。 */

  const toggleBrand = () => onBrandColorsChange?.(brandLocked ? [] : [pickerColor, pickerColor]);

  const selectModel = model => {
    const nextResolutions = imageModelResolutions(model.id);
    const currentResolution = safeValue.resolution || '2K';
    const nextResolution = nextResolutions.includes(currentResolution) ? currentResolution : nextResolutions[nextResolutions.length - 1];
    onChange?.({ ...safeValue, imageModel: model.id, resolution: nextResolution });
    setModelListOpen(false);
  };

  /* ── 选项卡：改用预置类 .sb-opt（20-components.md §0.4 明示优先用它） ──
     决策依据：20-components.md「实现方式：优先用 .sb-opt 及 .sb-opt__icon 等预置类，
     而不是手写内联 style。**内联 style 会覆盖声明式伪类**，这正是改前
     「hover 与选中长得一样」的成因之一。」

     .sb-opt 已经把 D2 全套写进 CSS（见 design-tokens-v3.css §18）：
       default        : 底 --sb-l3-option，边框 1.5px transparent（占位防位移）
       hover          : 只换 --sb-l3-option-hover 中性灰，**不变字色、不发紫**
       selected       : 三件套（--sb-sel-bg / --sb-sel-line / --sb-sel-ink）+ --sb-shadow-ring
       selected+hover : 只加深底色（--sb-sel-bg-hover），ring 与字色保持 → 持久性
       active/disabled: 均已定义
     本组件不再自造 hover 状态，也不需要 hoverKey（伪类由 CSS 承担）。 */
  const optionClass = 'sb-opt';

  /* 模型名过长时的规则不变（用户已拍板）：槽位宽固定、内部溢出裁切、**不要省略号** */
  const modelRow = (model, active, showDesc = true) => (
    <span style={{ minWidth: 0, flex: 1 }}>
      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--sb-space-2)' }}>
        <strong style={{
          fontSize: 'var(--sb-text-xs)',
          fontWeight: 'var(--sb-weight-semibold)',
          color: active ? 'var(--sb-state-selected-ink)' : 'var(--sb-text-primary)',
        }}>{model.label}</strong>
        <span style={{
          fontSize: 'var(--sb-text-2xs)',
          color: active ? 'var(--sb-state-selected-ink)' : 'var(--sb-text-hint)',
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}>{model.badge}</span>
      </span>
      {showDesc && (
        <span style={{
          display: 'block',
          marginTop: 'var(--sb-space-1)',
          fontSize: 'var(--sb-text-2xs)',
          color: 'var(--sb-text-muted)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
        }}>{model.shortDescription || model.description}</span>
      )}
    </span>
  );

  /* 图标底座：去掉「极淡黑底 + 描边」，改 --sb-surface-tint（原则 3.3） */
  const modelIcon = (model, size) => (
    <span style={{
      display: 'grid', placeItems: 'center', width: size, height: size, flexShrink: 0,
      borderRadius: 'var(--sb-radius-control)',
      background: 'var(--sb-surface-tint)',
    }}>
      <ModelLogo logo={brandLogo(model.brand)} size={Math.round(size * 0.72)} />
    </span>
  );

  return (
    <div style={{ padding: 0 }}>
      {/* 面板内边距 --sb-panel-padding(20)、分组间距 --sb-group-gap(20)（原则 2.1） */}
      <div style={{
        padding: 'var(--sb-panel-padding)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--sb-group-gap)',
      }}>

        {/* ── 分组 1：生图模型 ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sb-field-gap)' }}>
          <GroupTitle icon={Sparkles}>生图模型</GroupTitle>
          <button
            type="button"
            className={optionClass}
            onClick={() => setModelListOpen(open => !open)}
            aria-expanded={modelListOpen}
            /* 行高 ≥44px（用户「点击区不许缩水」）：V3 阶梯 28/32/36/44 中取 44。 */
            style={{ minHeight: 'var(--sb-control-touch)' }}
          >
            {modelIcon(currentDef || { brand: 'openai' }, 22)}
            {modelRow(currentDef || { id: selectedModel, label: '智能推荐', badge: '', description: '' }, false, false)}
            <ChevronDown size={15} aria-hidden="true" style={{
              flexShrink: 0,
              color: modelListOpen ? 'var(--sb-state-selected-ink)' : 'var(--sb-text-hint)',
              transform: modelListOpen ? 'rotate(180deg)' : 'none',
              transition: 'transform var(--sb-duration-fast) var(--sb-ease-out)',
            }} />
          </button>
          {modelListOpen && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 'var(--sb-space-2)' }}>
              {SELECTABLE_IMAGE_MODELS.map(model => {
                const active = selectedModel === model.id;
                const key = 'model-' + model.id;
                return (
                  <button
                    key={model.id}
                    type="button"
                    className={optionClass}
                    aria-pressed={active}
                    onClick={() => selectModel(model)}
                    style={{ minHeight: 'var(--sb-control-touch)' }}
                  >
                    {modelIcon(model, 24)}
                    {modelRow(model, active)}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ── 分组 2：清晰度 ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sb-field-gap)' }}>
          <GroupTitle icon={Monitor}>清晰度</GroupTitle>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${resolutionChoices.length}, minmax(0, 1fr))`, gap: 'var(--sb-space-2)' }}>
            {resolutionChoices.map(r => {
              const active = (safeValue.resolution || '2K') === r.key;
              const key = 'res-' + r.key;
              return (
                <button
                  key={r.key}
                  type="button"
                  className={optionClass}
                  aria-pressed={active}
                  onClick={() => set('resolution', r.key)}
                  style={{
                    /* 用户明确要求：清晰度等分段控件的点击区必须放大（≥40px，改造前仅 30px）。
                       V3 阶梯里 36(--sb-control-lg) 不满足，取 44(--sb-control-h-xl)——只会更大，不会缩水。 */
                    height: 'var(--sb-control-h-xl)',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 'var(--sb-space-1)',
                  }}
                >
                  <span style={{
                    fontSize: 'var(--sb-text-xs)',
                    fontWeight: 'var(--sb-weight-bold)',
                    lineHeight: 'var(--sb-leading-tight)',
                    color: active ? 'var(--sb-state-selected-ink)' : 'var(--sb-text-primary)',
                  }}>{r.label}</span>
                  <span style={{
                    fontSize: 'var(--sb-text-2xs)',
                    lineHeight: 'var(--sb-leading-tight)',
                    color: active ? 'var(--sb-state-selected-ink)' : 'var(--sb-text-muted)',
                  }}>{r.ratio}·{r.desc}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── 分组 3：品牌主色调（默认未锁定） ── */}
        {onBrandColorsChange && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sb-field-gap)' }}>
            <GroupTitle icon={Palette}>品牌主色调</GroupTitle>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sb-space-2)' }}>
              {/* 未锁定 = 中性灰虚线、零品牌紫（原则 6.3）；锁定 = 描边跟随所选颜色本身 */}
              <button
                type="button"
                aria-label="选择品牌主色"
                aria-pressed={brandLocked}
                onClick={() => setPickerOpen(open => !open)}
                style={{
                  position: 'relative',
                  /* 用户明确要求：点击区不许变小。色块/锁定按钮 ≥36px
                     （改造前 30px）→ --sb-control-lg(36)。 */
                  width: 'var(--sb-control-lg)',
                  height: 'var(--sb-control-lg)',
                  flexShrink: 0,
                  borderRadius: 'var(--sb-radius-control)',
                  cursor: 'pointer',
                  padding: 0,
                  /* D2：锁定/未锁定**边框宽度恒定 2px**（此前 2px↔1.5px 会抖动）；
                     锁定态额外叠 ring，且描边跟随所选颜色本身（不是固定紫）。
                     未锁定态的两条声明引用 NEUTRAL_UNLOCKED 常量（唯一事实源），
                     不再内联同一组值 —— 等价写法，但消除了「多套真相」（D8）。 */
                  border: brandLocked ? `2px solid ${pickerColor}` : NEUTRAL_UNLOCKED.border,
                  boxShadow: brandLocked ? 'var(--sb-shadow-ring)' : 'none',
                  background: brandLocked ? pickerColor : NEUTRAL_UNLOCKED.background,
                }}
              />
              <input
                aria-label="品牌主色色值"
                value={brandLocked || pickerOpen ? pickerColor : ''}
                onChange={event => { setPickerColor(event.target.value); if (brandLocked) onBrandColorsChange?.([event.target.value, event.target.value]); }}
                onFocus={() => setPickerOpen(true)}
                placeholder="未锁定"
                style={{
                  flex: 1, minWidth: 0,
                  /* 与同排色块/锁定按钮同高，保证一行基线一致 */
                  height: 'var(--sb-control-lg)',
                  boxSizing: 'border-box',
                  padding: '0 var(--sb-space-3)',
                  borderRadius: 'var(--sb-radius-control)',
                  border: '1px solid var(--sb-border-default)',
                  background: 'var(--sb-surface-card)',
                  color: 'var(--sb-text-primary)',
                  fontSize: 'var(--sb-text-xs)',
                  fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace',
                  outline: 'none',
                }}
              />
              <button
                type="button"
                onClick={toggleBrand}
                style={{
                  flexShrink: 0,
                  /* 与色块同档 ≥36px（用户「点击区不许变小」） */
                  height: 'var(--sb-control-lg)',
                  minWidth: 'var(--sb-control-min-w)',
                  padding: '0 var(--sb-space-3)',
                  borderRadius: 'var(--sb-radius-control)',
                  fontFamily: 'inherit',
                  fontSize: 'var(--sb-text-xs)',
                  fontWeight: 'var(--sb-weight-semibold)',
                  cursor: 'pointer',
                  border: brandLocked ? '1px solid var(--sb-brand)' : '1px solid var(--sb-border-default)',
                  background: brandLocked ? 'var(--sb-brand)' : 'var(--sb-surface-card)',
                  color: brandLocked ? 'var(--sb-brand-ink)' : 'var(--sb-text-secondary)',
                  transition: 'background-color var(--sb-duration-fast) var(--sb-ease-out)',
                }}
              >
                {brandLocked ? '已锁定' : '锁定'}
              </button>
            </div>
            {brandLocked && pickerOpen && (
              <div style={{ borderRadius: 'var(--sb-radius-card)', overflow: 'hidden', border: '1px solid var(--sb-border-subtle)' }}>
                <HexColorPicker color={pickerColor} onChange={color => { setPickerColor(color); onBrandColorsChange?.([color, color]); }} style={{ width: '100%', height: 128 }} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
