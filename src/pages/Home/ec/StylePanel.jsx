import React, { useState, useCallback, useEffect } from 'react';
import { HexColorPicker } from 'react-colorful';
import { Sparkles, Pencil } from 'lucide-react';

/* ═══════ 5 套风格（对齐后端 STYLE_SKILLS）+ 智能 ═══════ */
const STYLES = [
  { key: 'smart', label: '智能风格', desc: 'AI 根据品类自动匹配', icon: <Sparkles size={14} />, gradient: 'linear-gradient(135deg, #7c3aed 0%, #ec4899 50%, #f59e0b 100%)' },
  { key: 'premium_minimal', label: '高级极简', desc: '大量留白·低饱和', gradient: 'linear-gradient(135deg, #f5f5f5, #fff)' },
  { key: 'lifestyle_scene', label: '生活场景', desc: '真实环境·故事性', gradient: 'linear-gradient(135deg, #bbf7d0, #d1fae5)' },
  { key: 'fashion_editorial', label: '时尚杂志', desc: '高对比·戏剧光', gradient: 'linear-gradient(135deg, #1a1a2e, #d4a574)' },
  { key: 'warm_natural', label: '自然暖调', desc: '暖光·柔和·治愈', gradient: 'linear-gradient(135deg, #fde68a, #fed7aa)' },
  { key: 'tech_precision', label: '科技精工', desc: '冷调·锐利·高科技', gradient: 'linear-gradient(135deg, #3b82f6, #60a5fa)' },
];

/* ═══════ 预设色卡 ═══════ */
const PRESET_COLORS = [
  { label: '自动', colors: null },
  { label: '纯白', colors: ['#ffffff', '#f5f5f5'] },
  { label: '暖白', colors: ['#f5f0eb', '#e8ddd3'] },
  { label: '冷灰', colors: ['#e0e7ff', '#c7d2fe'] },
  { label: '森绿', colors: ['#bbf7d0', '#22c55e'] },
  { label: '海洋蓝', colors: ['#93c5fd', '#3b82f6'] },
  { label: '珊瑚粉', colors: ['#fbcfe8', '#ec4899'] },
  { label: '大地棕', colors: ['#d6ccc2', '#8b7355'] },
  { label: '奢华金', colors: ['#fbbf24', '#92400e'] },
  { label: '暗夜黑', colors: ['#1a1a2e', '#3f3f46'] },
];

/* ═══════ 风格 → 色调联动映射 ═══════ */
const STYLE_COLOR_MAP = {
  smart: null,                    // 自动：不锁定颜色
  premium_minimal: ['#ffffff', '#f5f5f5'],  // 纯白 — 极简大量留白
  lifestyle_scene: ['#f5f0eb', '#e8ddd3'],  // 暖白 — 家居生活感
  fashion_editorial: ['#1a1a2e', '#3f3f46'], // 暗夜黑 — 戏剧高对比
  warm_natural: ['#d6ccc2', '#8b7355'],      // 大地棕 — 自然暖调
  tech_precision: ['#93c5fd', '#3b82f6'],    // 海洋蓝 — 科技冷调
};

/* ═══════ 反查：颜色 → 匹配的风格 ═══════ */
function findMatchingStyle(colors) {
  if (!colors) return 'smart';
  for (const [styleKey, styleColors] of Object.entries(STYLE_COLOR_MAP)) {
    if (styleColors && JSON.stringify(styleColors) === JSON.stringify(colors)) return styleKey;
  }
  return null; // 用户自定义颜色，不属于任何风格
}

export default function StylePanel({ value = 'smart', onChange, customColors, onColorsChange, smartMode = true, onOverride }) {
  const [showPicker, setShowPicker] = useState(false);
  const [pickerColor, setPickerColor] = useState('#7c3aed');

  const isCustomized = value !== 'smart' || (customColors && customColors !== null);

  // 外部 customColors 变化时同步取色器
  useEffect(() => {
    if (customColors && customColors[0]) {
      setPickerColor(customColors[0]);
    } else if (!customColors) {
      // 自动模式，取色器保持当前值但不覆盖
    }
  }, [customColors]);

  // 外部 style 变化时同步取色器
  useEffect(() => {
    const mapped = STYLE_COLOR_MAP[value];
    if (mapped && mapped[0]) {
      setPickerColor(mapped[0]);
    }
  }, [value]);

  /* ── 选择风格 → 自动匹配色调 ── */
  const handleStyle = useCallback((key) => {
    onChange(key);
    // 联动：风格切换时自动设置对应色调
    const matchingColors = STYLE_COLOR_MAP[key] ?? null;
    onColorsChange?.(matchingColors);
    if (key !== 'smart') onOverride?.();
  }, [onChange, onColorsChange, onOverride]);

  /* ── 取色器拖动 ── */
  const handlePickerChange = useCallback((color) => {
    setPickerColor(color);
    onColorsChange?.([color, customColors?.[1] || color]);
    onOverride?.();
  }, [onColorsChange, customColors, onOverride]);

  /* ── 选择预设色卡 → 联动取色器 + 可能反向匹配风格 ── */
  const handlePreset = useCallback((preset) => {
    onColorsChange?.(preset.colors);
    // 同步取色器到预设主色
    if (preset.colors && preset.colors[0]) {
      setPickerColor(preset.colors[0]);
    }
    if (preset.colors) onOverride?.();
  }, [onColorsChange, onOverride]);

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
          <Sparkles size={14} />
          <span>当前：已启用智能方案 · 系统根据品类自动匹配最佳画面风格和色调</span>
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
          <span>已自定义配置</span>
        </div>
      )}

      <div style={{ padding: '14px 16px 12px' }}>
        {/* ── 风格选择 ── */}
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8, letterSpacing: 0.3 }}>画面风格</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 14 }}>
          {STYLES.map(s => {
            const active = value === s.key;
            const styleColors = STYLE_COLOR_MAP[s.key];
            return (
              <div key={s.key} onClick={() => handleStyle(s.key)}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
                  padding: '10px 4px', borderRadius: 10, cursor: 'pointer',
                  border: '1.5px solid',
                  borderColor: active ? '#1a1a1a' : 'rgba(0,0,0,0.08)',
                  background: active ? '#1a1a1a' : 'rgba(0,0,0,0.03)',
                  transition: 'all 0.18s ease',
                }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(0,0,0,0.06)'; }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'rgba(0,0,0,0.03)'; }}>
                <div style={{
                  width: 36, height: 20, borderRadius: 4,
                  background: s.gradient,
                  border: `1px solid ${active ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.08)'}`,
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                }} />
                <span style={{
                  fontSize: 11, fontWeight: 600,
                  color: active ? '#fff' : 'var(--text-secondary)',
                  display: 'flex', alignItems: 'center', gap: 2, textAlign: 'center',
                }}>
                  {s.icon && React.cloneElement(s.icon, { size: 11, style: { color: active ? '#fff' : 'var(--text-muted)' } })}
                  {s.label}
                </span>
                <span style={{
                  fontSize: 10, fontWeight: 500,
                  color: active ? 'rgba(255,255,255,0.75)' : 'var(--text-muted)',
                  textAlign: 'center', lineHeight: 1.2,
                }}>{s.desc}</span>
                {/* 风格关联色调指示点 */}
                {styleColors && (
                  <div style={{ display: 'flex', gap: 3, marginTop: 2 }}>
                    {styleColors.map((c, i) => (
                      <div key={i} style={{
                        width: 8, height: 8, borderRadius: '50%',
                        background: c,
                        border: `1px solid ${active ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.15)'}`,
                      }} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ── 自定义色调（与风格联动）── */}
        <div style={{
          background: 'rgba(0,0,0,0.03)', borderRadius: 10, padding: '10px 12px',
          border: '1px solid rgba(0,0,0,0.06)',
        }}>
          <div onClick={() => setShowPicker(!showPicker)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              cursor: 'pointer', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)',
            }}>
            <span>🎨 色调搭配</span>
            <span style={{
              fontSize: 10, color: 'var(--text-muted)',
              transform: showPicker ? 'rotate(180deg)' : 'none',
              transition: 'transform 0.2s',
            }}>▾</span>
          </div>

          {showPicker && (
            <div style={{ marginTop: 10 }}>
              {/* 预设色卡 — 与风格互联动 */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 12 }}>
                {PRESET_COLORS.map(c => {
                  const active = JSON.stringify(customColors) === JSON.stringify(c.colors);
                  // 检查这个色卡是否匹配当前风格
                  const matchesCurrentStyle = c.colors && STYLE_COLOR_MAP[value] &&
                    JSON.stringify(c.colors) === JSON.stringify(STYLE_COLOR_MAP[value]);
                  return (
                    <div key={c.label} onClick={() => handlePreset(c)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 5,
                        padding: '4px 8px', borderRadius: 8, cursor: 'pointer',
                        border: `1.5px solid ${active ? '#1a1a1a' : matchesCurrentStyle ? '#7c3aed' : 'rgba(0,0,0,0.08)'}`,
                        background: active ? '#1a1a1a' : matchesCurrentStyle ? 'rgba(124,58,237,0.06)' : '#fff',
                        transition: 'all 0.15s',
                      }}>
                      {c.colors && (
                        <div style={{ display: 'flex', gap: 1 }}>
                          {c.colors.map((clr, i) => (
                            <div key={i} style={{ width: 10, height: 10, borderRadius: '50%', background: clr, border: '1px solid rgba(0,0,0,0.1)' }} />
                          ))}
                        </div>
                      )}
                      <span style={{ fontSize: 10, fontWeight: 600, color: active ? '#fff' : matchesCurrentStyle ? '#7c3aed' : 'var(--text-secondary)' }}>{c.label}</span>
                      {matchesCurrentStyle && !active && (
                        <span style={{ fontSize: 9, color: '#7c3aed', fontWeight: 700 }}>推荐</span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* 取色器 + 预览 */}
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <div style={{ flexShrink: 0 }}>
                  <HexColorPicker color={pickerColor} onChange={handlePickerChange} style={{ width: 160, height: 140 }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>主色调预览</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: 8,
                      background: pickerColor,
                      border: '2px solid rgba(0,0,0,0.1)',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                      flexShrink: 0,
                    }} />
                    <input value={pickerColor}
                      onChange={e => { setPickerColor(e.target.value); handlePickerChange(e.target.value); }}
                      placeholder="#FFFFFF"
                      style={{
                        width: '100%', height: 28, padding: '0 8px', borderRadius: 6,
                        border: '1px solid rgba(0,0,0,0.12)', background: '#fff',
                        fontSize: 11, fontWeight: 600, fontFamily: 'monospace',
                        color: 'var(--text-primary)', outline: 'none',
                      }} />
                  </div>
                  {/* 当前搭配提示 */}
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.4 }}>
                    {value !== 'smart' && STYLE_COLOR_MAP[value] && (
                      <span style={{ color: '#7c3aed', fontWeight: 600 }}>
                        「{STYLES.find(s => s.key === value)?.label}」推荐色调已自动匹配
                      </span>
                    )}
                    {value !== 'smart' && !STYLE_COLOR_MAP[value] && (
                      <span>拖动取色器或输入色值，自定义画面主色调</span>
                    )}
                    {value === 'smart' && (
                      <span>智能模式下系统自动匹配色调，也可手动锁定</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
