import React, { useState } from 'react';
import { ChevronDown, Coins, Monitor, Palette, ShieldAlert, Sparkles } from 'lucide-react';
import { HexColorPicker } from 'react-colorful';
import { IMAGE_MODELS, SELECTABLE_IMAGE_MODELS, generationUnits, imageModelResolutions, normalizeImageModel } from '../../../services/imageModelCatalog.js';
import { brandLogo } from '../../../services/modelLogos.js';
import ModelLogo from '../../../components/ModelLogo.jsx';

const RESOLUTIONS = [
  { key: '1K', label: '1K', ratio: '标准', desc: '试方向' },
  { key: '2K', label: '2K', ratio: '高清', desc: '推荐' },
  { key: '4K', label: '4K', ratio: '超清', desc: '看细节' },
];

const lbl = {
  fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)',
  display: 'flex', alignItems: 'center', gap: 5, marginBottom: 1,
};

/* 行高基线：扩展列表每一行 ≤ 44px（图标 + 名称 + 一句话徽标） */
const rowPad = { padding: '2px 9px', borderRadius: 8 };

export default function GenSettingsPanel({ value, onChange, showHeader = true, brandColors = null, onBrandColorsChange = null }) {
  const safeValue = value || {};
  const selectedModel = normalizeImageModel(safeValue.imageModel);
  const currentDef = IMAGE_MODELS.find(model => model.id === selectedModel);
  const set = (key, val) => onChange?.({ ...safeValue, [key]: val });
  /* 9-13：清晰度选项必须跟着模型能力走 —— Midjourney 上游只有 1K/2K，
     选了它就不能再给 4K（避免「选了 4K、实际给 2K」的静默回落）。 */
  const availableResolutions = imageModelResolutions(selectedModel);
  const resolutionChoices = RESOLUTIONS.filter(r => availableResolutions.includes(r.key));
  /* 9-14 用户批注：默认不应该锁品牌主色 —— 锁定状态只由外部传入 brandColors 推导，
     不传/传空数组 = 未锁定；用户点了「锁定」才锁。 */
  const brandLocked = Array.isArray(brandColors) && brandColors.length > 0;
  const [pickerColor, setPickerColor] = useState(() => (brandLocked && brandColors[0] ? brandColors[0] : '#7c3aed'));
  /* 9-14 用户批注：模型列表太长 → 默认折叠成「当前模型」，点开才展开 */
  const [modelListOpen, setModelListOpen] = useState(false);
  const toggleBrand = () => onBrandColorsChange?.(brandLocked ? [] : [pickerColor, pickerColor]);

  const selectModel = model => {
    /* 切到不支持当前清晰度的模型时，顺手落到该模型的最高可用档（不偷偷给 2K） */
    const nextResolutions = imageModelResolutions(model.id);
    const currentResolution = safeValue.resolution || '2K';
    const nextResolution = nextResolutions.includes(currentResolution) ? currentResolution : nextResolutions[nextResolutions.length - 1];
    onChange?.({ ...safeValue, imageModel: model.id, resolution: nextResolution });
    setModelListOpen(false);
  };

  const modelRow = (model, active, showDesc = true) => (
    <span style={{ minWidth: 0, flex: 1 }}>
      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <strong style={{ fontSize: 12, color: active ? '#6d28d9' : 'var(--text-primary)' }}>{model.label}</strong>
        <span style={{ fontSize: 10, color: active ? '#7c3aed' : 'var(--text-muted)', whiteSpace: 'nowrap' }}>{model.badge}</span>
      </span>
      {showDesc && <span style={{ display: 'block', marginTop: 2, fontSize: 10, lineHeight: 1.3, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{model.shortDescription || model.description}</span>}
    </span>
  );

  const modelIcon = (model, size) => (
    <span style={{ display: 'grid', placeItems: 'center', width: size, height: size, flexShrink: 0, borderRadius: 8, background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.06)' }}>
      <ModelLogo logo={brandLogo(model.brand)} size={Math.round(size * 0.72)} />
    </span>
  );

  return (
    <div style={{ padding: 0 }}>
      {/* 9-12 用户批注：「两套描述基本一样」→ 面板顶部只保留外层那套标题，这里不再重复 */}
      {/* 9-14 用户批注：模型太多/面板下部看不到 → 默认折叠模型列表 + 压缩纵向间距，一屏看全 */}
      <div style={{ padding: '10px 14px 12px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div>
          <label style={lbl}>
            <Sparkles size={13} color="#7c3aed" /> 生图模型
          </label>
          {/* 折叠态 = 「当前模型」一行；点开后列出全部已验收档位，行高 ≤ 44px */}
          <button
            type="button"
            onClick={() => setModelListOpen(open => !open)}
            aria-expanded={modelListOpen}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 8,
              ...rowPad, border: '1.5px solid rgba(0,0,0,0.08)', background: modelListOpen ? 'rgba(124,58,237,0.04)' : '#fff',
              cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', transition: 'all 0.15s',
            }}
          >
            {modelIcon(currentDef || { brand: 'openai' }, 20)}
            {modelRow(currentDef || { id: selectedModel, label: '智能推荐', badge: '', description: '' }, false, false)}
            <ChevronDown size={14} style={{ flexShrink: 0, transform: modelListOpen ? 'rotate(180deg)' : 'none', color: 'var(--text-muted)', transition: 'transform 0.15s' }} />
          </button>
          {modelListOpen && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 3, marginTop: 2 }}>
              {/* 9-13：选择器只列「已通过真实生成验收」的档位（SELECTABLE_IMAGE_MODELS） */}
              {SELECTABLE_IMAGE_MODELS.map(model => {
                const active = selectedModel === model.id;
                return (
                  <button key={model.id} type="button" onClick={() => selectModel(model)} style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                    ...rowPad, textAlign: 'left', fontFamily: 'inherit', cursor: 'pointer',
                    border: '1.5px solid ' + (active ? '#7c3aed' : 'rgba(0,0,0,0.08)'),
                    background: active ? 'linear-gradient(135deg, rgba(124,58,237,0.08), rgba(255,255,255,0.94))' : '#fff',
                    boxShadow: active ? '0 3px 12px rgba(124,58,237,0.13)' : 'none',
                  }}>
                    {modelIcon(model, 24)}
                    {modelRow(model, active)}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* 分辨率：紧凑分段控件（一行） */}
        <div>
          <label style={lbl}>
            <Monitor size={13} color="#7c3aed" /> 清晰度
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(' + resolutionChoices.length + ', minmax(0, 1fr))', gap: 6 }}>
            {resolutionChoices.map(r => {
              const active = (safeValue.resolution || '2K') === r.key;
              return (
                <button key={r.key} type="button" onClick={() => set('resolution', r.key)}
                  style={{
                    height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                    borderRadius: 8, border: '1.5px solid ' + (active ? '#7c3aed' : 'rgba(0,0,0,0.08)'),
                    background: active ? 'linear-gradient(135deg, rgba(124,58,237,0.08), rgba(255,255,255,0.94))' : '#fff',
                    color: active ? '#6d28d9' : 'var(--text-primary)', fontFamily: 'inherit', cursor: 'pointer',
                    boxShadow: active ? '0 2px 8px rgba(124,58,237,0.12)' : 'none',
                  }}
                  onMouseEnter={e => { if (!active) e.currentTarget.style.borderColor = 'rgba(124,58,237,0.3)'; }}
                  onMouseLeave={e => { if (!active) e.currentTarget.style.borderColor = 'rgba(0,0,0,0.08)'; }}
                >
                  <span style={{ fontSize: 12, fontWeight: 700 }}>{r.label}</span>
                  <span style={{ fontSize: 9, color: active ? '#7c3aed' : 'var(--text-muted)' }}>{r.ratio}·{r.desc}</span>
                </button>
              );
            })}
          </div>
        </div>

        {onBrandColorsChange && (
          <div>
            <label style={lbl}>
              <Palette size={13} color="#7c3aed" /> 锁定品牌主色调
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label style={{ position: 'relative', width: 26, height: 26, borderRadius: 7, background: pickerColor, border: brandLocked ? '2px solid #7c3aed' : '1.5px dashed rgba(0,0,0,0.2)', flexShrink: 0, cursor: 'pointer', overflow: 'hidden' }} title="点击预览可选品牌主色">
                <input
                  type="color"
                  aria-label="品牌主色"
                  value={pickerColor}
                  onChange={event => { setPickerColor(event.target.value); if (brandLocked) onBrandColorsChange?.([event.target.value, event.target.value]); }}
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer', border: 0, padding: 0 }}
                />
              </label>
              <input
                aria-label="品牌主色"
                value={pickerColor}
                onChange={event => { setPickerColor(event.target.value); if (brandLocked) onBrandColorsChange?.([event.target.value, event.target.value]); }}
                placeholder="#7C3AED"
                style={{ width: 110, height: 26, boxSizing: 'border-box', padding: '0 9px', border: '1px solid rgba(0,0,0,0.12)', borderRadius: 7, background: '#fff', fontSize: 11, fontWeight: 600, fontFamily: 'monospace', outline: 'none' }}
              />
              <button
                type="button"
                onClick={toggleBrand}
                style={{ height: 26, padding: '0 12px', borderRadius: 7, border: brandLocked ? '1px solid #7c3aed' : '1px solid rgba(0,0,0,0.12)', background: brandLocked ? '#7c3aed' : '#fff', color: brandLocked ? '#fff' : 'var(--text-secondary)', fontSize: 11, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}
              >{brandLocked ? '已锁定' : '锁定'}</button>
            </div>
            {brandLocked && <div style={{ marginTop: 6 }}><HexColorPicker color={pickerColor} onChange={color => { setPickerColor(color); onBrandColorsChange?.([color, color]); }} style={{ width: '100%', height: 108 }} /></div>}
          </div>
        )}

        {/* 9-11 二轮批注: 「避免出现的元素」从「视觉方向」迁到生成设置 —— 它属于生成约束, 与清晰度/模型同族 */}
        <div>
          <label style={lbl}>
            <ShieldAlert size={13} color="#7c3aed" /> 避免出现的元素
          </label>
          <input
            aria-label="避免出现的元素"
            value={safeValue.negativePrompt || ''}
            onChange={event => set('negativePrompt', event.target.value)}
            placeholder="商品结构变形、异常手部、乱码文字、无关道具"
            style={{ width: '100%', height: 26, boxSizing: 'border-box', padding: '0 10px', border: '1px solid rgba(0,0,0,0.12)', borderRadius: 7, background: 'rgba(248,248,250,.92)', color: 'var(--text-primary)', fontFamily: 'inherit', fontSize: 11, outline: 'none' }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '2px 10px', borderRadius: 9, background: 'rgba(124,58,237,0.06)', color: 'var(--text-muted)', fontSize: 10, lineHeight: 1.35 }}>
          <Coins size={14} color="#7c3aed" style={{ marginTop: 1, flexShrink: 0 }} />
          <span>当前约 {(generationUnits(selectedModel, safeValue.resolution || '2K') || 0) / 1000} AI 积分/张；确认套图前会显示本次总费用。</span>
        </div>
      </div>
    </div>
  );
}