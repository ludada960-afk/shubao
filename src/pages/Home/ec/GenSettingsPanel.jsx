import React, { useState } from 'react';
import { ChevronDown, Monitor, Palette, Sparkles } from 'lucide-react';
import { HexColorPicker } from 'react-colorful';
import { IMAGE_MODELS, SELECTABLE_IMAGE_MODELS, imageModelResolutions, normalizeImageModel } from '../../../services/imageModelCatalog.js';
import { brandLogo } from '../../../services/modelLogos.js';
import ModelLogo from '../../../components/ModelLogo.jsx';
import {
  SPACING,
  FONT_SIZE,
  CONTROL_HEIGHT,
  RADIUS,
  groupTitleStyle,
  helperTextStyle,
  inputStyle,
  sectionStyle,
} from './panelVisualLanguage.js';

const RESOLUTIONS = [
  { key: '1K', label: '1K', ratio: '标准', desc: '试方向' },
  { key: '2K', label: '2K', ratio: '高清', desc: '推荐' },
  { key: '4K', label: '4K', ratio: '超清', desc: '看细节' },
];

/* ═══════ 面板视觉语言：全部取自 panelVisualLanguage.js 统一规范 ═══════
   2026-09-15 用户批注①（子项 2）：
   「你现在做的好小气，完全没有一个真正的视觉逻辑……清晰度这些模块做得特别小，
    周边没有呼吸感，主次之分也不好。……重新设计它们的布局、大小、呼吸感、
    整体视觉语言、间隙。」
   本文件不再出现任何魔法数字：间距/字号/控件高/圆角一律走规范常量，
   改规范 = 六个面板同步改。
   ─────────────────────────────────────────────────────────────── */

/* 分组标题行：图标 + 13/700 标题，与内容 20px（规范 sp5） */
function GroupTitle({ icon: Icon, children }) {
  return (
    <div style={groupTitleStyle}>
      <Icon size={14} color="var(--accent, #7c3aed)" style={{ flexShrink: 0 }} />
      <span>{children}</span>
    </div>
  );
}

export default function GenSettingsPanel({ value, onChange, showHeader = true, brandColors = null, onBrandColorsChange = null }) {
  const safeValue = value || {};
  const selectedModel = normalizeImageModel(safeValue.imageModel);
  const currentDef = IMAGE_MODELS.find(model => model.id === selectedModel);
  const set = (key, val) => onChange?.({ ...safeValue, [key]: val });
  /* 清晰度选项跟着模型能力走 —— Midjourney 上游只有 1K/2K，
     选了它就不能再给 4K（避免「选了 4K、实际给 2K」的静默回落）。 */
  const availableResolutions = imageModelResolutions(selectedModel);
  const resolutionChoices = RESOLUTIONS.filter(r => availableResolutions.includes(r.key));

  /* 用户批注①（子项 1）：默认必须「未锁定任何颜色」。
     锁定态只由外部传入的 brandColors 推导，不传/传空 = 未锁定。 */
  const brandLocked = Array.isArray(brandColors) && brandColors.length > 0;
  /* 用户批注①（子项 1）：取色器的暂存色是**用户当前选的颜色**本身，
     不再用固定的品牌紫 #7c3aed —— 否则「不管用户在调色盘里选哪个颜色，
     它的边缘都是紫色的」。未锁定时给一个中性起始色（黑），也不代表已选紫。 */
  const [pickerColor, setPickerColor] = useState(() => (brandLocked && brandColors[0] ? brandColors[0] : '#1F1D1A'));
  /* 用户批注①（子项 1）：取色面板默认收起 —— 默认态不能看起来像「已经选了颜色」 */
  const [pickerOpen, setPickerOpen] = useState(false);
  const [modelListOpen, setModelListOpen] = useState(false);
  const toggleBrand = () => onBrandColorsChange?.(brandLocked ? [] : [pickerColor, pickerColor]);

  const selectModel = model => {
    const nextResolutions = imageModelResolutions(model.id);
    const currentResolution = safeValue.resolution || '2K';
    const nextResolution = nextResolutions.includes(currentResolution) ? currentResolution : nextResolutions[nextResolutions.length - 1];
    onChange?.({ ...safeValue, imageModel: model.id, resolution: nextResolution });
    setModelListOpen(false);
  };

  const modelRow = (model, active, showDesc = true) => (
    <span style={{ minWidth: 0, flex: 1 }}>
      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: SPACING.sp2 }}>
        <strong style={{ fontSize: FONT_SIZE.body, fontWeight: 600, color: 'var(--text-primary)' }}>{model.label}</strong>
        <span style={{ ...helperTextStyle, whiteSpace: 'nowrap' }}>{model.badge}</span>
      </span>
      {showDesc && (
        <span style={{ display: 'block', marginTop: SPACING.sp1, ...helperTextStyle, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {model.shortDescription || model.description}
        </span>
      )}
    </span>
  );

  const modelIcon = (model, size) => (
    <span style={{
      display: 'grid', placeItems: 'center', width: size, height: size, flexShrink: 0,
      borderRadius: RADIUS.control, background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.06)',
    }}>
      <ModelLogo logo={brandLogo(model.brand)} size={Math.round(size * 0.72)} />
    </span>
  );

  /* 选中态统一：中性深色描边 + 浅底，不再到处铺紫色（紫只用于「已调整」徽标与图标） */
  const optionStyle = active => ({
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: SPACING.sp2,
    padding: `${SPACING.sp2}px ${SPACING.sp3}px`,
    textAlign: 'left',
    fontFamily: 'inherit',
    cursor: 'pointer',
    borderRadius: RADIUS.control,
    border: `1.5px solid ${active ? '#1F1D1A' : 'rgba(45,41,38,0.12)'}`,
    background: active ? 'rgba(31,29,26,0.045)' : '#fff',
    transition: 'border-color .15s ease, background .15s ease',
  });

  return (
    <div style={{ padding: 0 }}>
      {/* 面板内边距 24 上下 / 20 左右，分组之间 16px（规范 sp6/sp5/sp4） */}
      <div style={{ padding: `${SPACING.sp6}px ${SPACING.sp5}px`, display: 'flex', flexDirection: 'column', gap: SPACING.sp4 }}>

        {/* ── 分组 1：生图模型 ── */}
        <div style={sectionStyle}>
          <GroupTitle icon={Sparkles}>生图模型</GroupTitle>
          <button
            type="button"
            onClick={() => setModelListOpen(open => !open)}
            aria-expanded={modelListOpen}
            style={{ ...optionStyle(modelListOpen), minHeight: CONTROL_HEIGHT.large }}
          >
            {modelIcon(currentDef || { brand: 'openai' }, 22)}
            {modelRow(currentDef || { id: selectedModel, label: '智能推荐', badge: '', description: '' }, false, false)}
            <ChevronDown size={15} style={{ flexShrink: 0, transform: modelListOpen ? 'rotate(180deg)' : 'none', color: 'var(--text-muted)', transition: 'transform 0.15s' }} />
          </button>
          {modelListOpen && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: SPACING.sp2 }}>
              {SELECTABLE_IMAGE_MODELS.map(model => {
                const active = selectedModel === model.id;
                return (
                  <button key={model.id} type="button" onClick={() => selectModel(model)} style={{ ...optionStyle(active), minHeight: CONTROL_HEIGHT.large }}>
                    {modelIcon(model, 24)}
                    {modelRow(model, active)}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ── 分组 2：清晰度（用户批注「清晰度这些模块做得特别小」→ 控件抬到 40px） ── */}
        <div style={sectionStyle}>
          <GroupTitle icon={Monitor}>清晰度</GroupTitle>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${resolutionChoices.length}, minmax(0, 1fr))`, gap: SPACING.sp2 }}>
            {resolutionChoices.map(r => {
              const active = (safeValue.resolution || '2K') === r.key;
              return (
                <button key={r.key} type="button" onClick={() => set('resolution', r.key)}
                  aria-pressed={active}
                  style={{
                    height: CONTROL_HEIGHT.large,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1,
                    borderRadius: RADIUS.control, fontFamily: 'inherit', cursor: 'pointer',
                    border: `1.5px solid ${active ? '#1F1D1A' : 'rgba(45,41,38,0.12)'}`,
                    background: active ? 'rgba(31,29,26,0.045)' : '#fff',
                    transition: 'border-color .15s ease, background .15s ease',
                  }}
                  onMouseEnter={e => { if (!active) e.currentTarget.style.borderColor = 'rgba(45,41,38,0.28)'; }}
                  onMouseLeave={e => { if (!active) e.currentTarget.style.borderColor = 'rgba(45,41,38,0.12)'; }}
                >
                  <span style={{ fontSize: FONT_SIZE.fieldLabel, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>{r.label}</span>
                  <span style={{ ...helperTextStyle, lineHeight: 1.2 }}>{r.ratio}·{r.desc}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── 分组 3：品牌主色调（默认未锁定） ── */}
        {onBrandColorsChange && (
          <div style={sectionStyle}>
            <GroupTitle icon={Palette}>品牌主色调</GroupTitle>
            {/* 未锁定 = 中性占位 + 中性灰虚线描边；锁定 = 描边跟随所选颜色本身。
                两条都为了用户批注①：外围绝不能有固定紫色描边。 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: SPACING.sp2 }}>
              <button
                type="button"
                aria-label="选择品牌主色"
                aria-pressed={brandLocked}
                onClick={() => setPickerOpen(open => !open)}
                style={{
                  position: 'relative', width: CONTROL_HEIGHT.base, height: CONTROL_HEIGHT.base, flexShrink: 0,
                  borderRadius: RADIUS.control, cursor: 'pointer', padding: 0,
                  /* 锁定 → 颜色本身做描边；未锁定 → 中性灰虚线，且不填充颜色 */
                  border: brandLocked ? `2px solid ${pickerColor}` : '1.5px dashed rgba(45,41,38,0.28)',
                  background: brandLocked ? pickerColor : 'repeating-conic-gradient(rgba(0,0,0,0.05) 0% 25%, transparent 0% 50%) 50% / 8px 8px',
                }}
              />
              <input
                aria-label="品牌主色色值"
                value={brandLocked || pickerOpen ? pickerColor : ''}
                onChange={event => { setPickerColor(event.target.value); if (brandLocked) onBrandColorsChange?.([event.target.value, event.target.value]); }}
                onFocus={() => setPickerOpen(true)}
                placeholder="未锁定"
                style={{ ...inputStyle, flex: 1, minWidth: 0, fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace' }}
              />
              <button
                type="button"
                onClick={toggleBrand}
                style={{
                  flexShrink: 0, height: CONTROL_HEIGHT.base, padding: `0 ${SPACING.sp3}px`,
                  borderRadius: RADIUS.control, fontFamily: 'inherit',
                  fontSize: FONT_SIZE.body, fontWeight: 600, cursor: 'pointer',
                  border: '1px solid rgba(45,41,38,0.12)',
                  background: brandLocked ? '#1F1D1A' : '#fff',
                  color: brandLocked ? '#fff' : 'var(--text-secondary)',
                }}
              >
                {brandLocked ? '已锁定' : '锁定'}
              </button>
            </div>
            {brandLocked && pickerOpen && (
              <div style={{ borderRadius: RADIUS.control, overflow: 'hidden', border: '1px solid rgba(45,41,38,0.10)' }}>
                <HexColorPicker color={pickerColor} onChange={color => { setPickerColor(color); onBrandColorsChange?.([color, color]); }} style={{ width: '100%', height: 128 }} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
