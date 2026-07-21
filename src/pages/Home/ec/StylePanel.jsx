import React, { useState, useCallback, useEffect } from 'react';
import { HexColorPicker } from 'react-colorful';
import { Sparkles, Pencil, Lock, Unlock, ImageIcon, Trees, Coffee, Sun, Moon, Briefcase, Home } from 'lucide-react';

/* ═══════ 6 套风格 = 完整方案（含光影+色调+构图）═══ */
const STYLES = [
  { key: 'smart', label: '智能风格', desc: 'AI 根据品类自动匹配',
    icon: <Sparkles size={14} />,
    gradient: 'linear-gradient(135deg, #7c3aed 0%, #ec4899 50%, #f59e0b 100%)',
    tone: '由AI决定' },
  { key: 'premium_minimal', label: '高级极简', desc: '低饱和·白灰·大量留白',
    gradient: 'linear-gradient(135deg, #f5f5f5, #e5e5e5)',
    tone: '白灰低饱和' },
  { key: 'lifestyle_scene', label: '生活场景', desc: '暖调·自然光·家居感',
    gradient: 'linear-gradient(135deg, #f5f0eb, #d1fae5)',
    tone: '暖调自然光' },
  { key: 'fashion_editorial', label: '时尚杂志', desc: '高对比·暗调·戏剧光',
    gradient: 'linear-gradient(135deg, #1a1a2e, #d4a574)',
    tone: '暗调高对比' },
  { key: 'warm_natural', label: '自然暖调', desc: '柔光·米棕·治愈系',
    gradient: 'linear-gradient(135deg, #fde68a, #fed7aa)',
    tone: '米棕柔光' },
  { key: 'tech_precision', label: '科技精工', desc: '冷蓝·锐利·金属质感',
    gradient: 'linear-gradient(135deg, #3b82f6, #60a5fa)',
    tone: '冷蓝金属' },
];

/* ═══════ 智能场景预设 ═══ */
const SCENE_PRESETS = [
  { 
    key: 'studio_white', 
    label: '专业白底', 
    icon: <ImageIcon size={14} />,
    desc: '电商标准白底图',
    prompt: 'Professional e-commerce photography on pure white background #FFFFFF, clean studio lighting, soft shadow, product photography style'
  },
  { 
    key: 'lifestyle_home', 
    label: '居家场景', 
    icon: <Home size={14} />,
    desc: '温馨家居环境',
    prompt: 'Cozy home interior setting, warm natural window light, wooden table surface, soft lifestyle arrangement, inviting atmosphere'
  },
  { 
    key: 'outdoor_nature', 
    label: '户外自然', 
    icon: <Trees size={14} />,
    desc: '自然光户外场景',
    prompt: 'Outdoor natural setting, golden hour sunlight, green nature background, fresh air feeling, organic lifestyle'
  },
  { 
    key: 'cafe_coffee', 
    label: '咖啡休闲', 
    icon: <Coffee size={14} />,
    desc: '咖啡厅氛围',
    prompt: 'Modern cafe setting, marble or wooden table, coffee cup nearby, warm ambient lighting, relaxed lifestyle mood'
  },
  { 
    key: 'office_desk', 
    label: '办公桌面', 
    icon: <Briefcase size={14} />,
    desc: '职场商务场景',
    prompt: 'Clean office desk setup, minimal stationery, laptop in background, professional workspace, natural desk lighting'
  },
  { 
    key: 'sunset_glow', 
    label: '日落暖光', 
    icon: <Sun size={14} />,
    desc: '黄昏温暖光线',
    prompt: 'Golden hour sunset lighting, warm orange glow, long soft shadows, cozy evening atmosphere, dreamy warm tone'
  },
  { 
    key: 'night_mood', 
    label: '夜晚氛围', 
    icon: <Moon size={14} />,
    desc: '暗调夜景风格',
    prompt: 'Night time mood lighting, dark background with subtle ambient light, dramatic shadows, sophisticated evening atmosphere'
  },
];

export default function StylePanel({ value = 'smart', onChange, customColors, onColorsChange, smartMode = true, onOverride, onResetOverride }) {
  const [showBrandColor, setShowBrandColor] = useState(false);
  const [pickerColor, setPickerColor] = useState('#7c3aed');

  // 修复：只有当风格不是 smart 或者品牌色被锁定时才算自定义
  const isCustomized = value !== 'smart' || (customColors && customColors.length > 0);

  // 外部 customColors 变化时同步取色器
  useEffect(() => {
    if (customColors && customColors[0]) {
      setPickerColor(customColors[0]);
    }
  }, [customColors]);

  /* ── 选择风格（完整方案）── */
  const handleStyle = useCallback((key) => {
    onChange(key);
    // 切换风格时，如果品牌色锁定开着就保留，关着就跟着风格走
    // 风格自带色调，不需要额外设置 customColors
    if (key !== 'smart') onOverride?.();
  }, [onChange, onOverride]);

  /* ── 品牌色锁定开关 ── */
  const toggleBrandLock = useCallback(() => {
    if (customColors && customColors.length > 0) {
      // 关闭 → 解除锁定
      onColorsChange?.([]);
      // 只有当风格也是 smart 时才重置 override 状态
      if (value === 'smart') {
        onResetOverride?.();
      }
    } else {
      // 开启 → 锁定当前取色器颜色
      onColorsChange?.([pickerColor, pickerColor]);
      onOverride?.();
    }
  }, [customColors, pickerColor, onColorsChange, onOverride, onResetOverride, value]);

  /* ── 取色器拖动 ── */
  const handlePickerChange = useCallback((color) => {
    setPickerColor(color);
    if (customColors) {
      // 品牌色已锁定 → 实时更新
      onColorsChange?.([color, color]);
      onOverride?.();
    }
  }, [customColors, onColorsChange, onOverride]);

  const brandLocked = customColors && customColors !== null;
  const currentStyle = STYLES.find(s => s.key === value) || STYLES[0];

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
          <span>当前：已启用智能方案 · 系统根据品类自动匹配最佳风格和色调</span>
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
        {/* ── 智能场景预设 ── */}
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 4, letterSpacing: 0.3 }}>场景预设</div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 8 }}>选择产品展示的场景环境</div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: 16 }}>
          {SCENE_PRESETS.map(scene => (
            <div key={scene.key} 
              onClick={() => {
                // 场景预设选择逻辑
                onOverride?.();
              }}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                padding: '10px 4px', borderRadius: 10, cursor: 'pointer',
                border: '1.5px solid rgba(0,0,0,0.08)',
                background: 'rgba(0,0,0,0.02)',
                transition: 'all 0.18s ease',
              }}
              onMouseEnter={e => { 
                e.currentTarget.style.background = 'rgba(124,58,237,0.08)'; 
                e.currentTarget.style.borderColor = 'rgba(124,58,237,0.3)';
              }}
              onMouseLeave={e => { 
                e.currentTarget.style.background = 'rgba(0,0,0,0.02)'; 
                e.currentTarget.style.borderColor = 'rgba(0,0,0,0.08)';
              }}>
              <div style={{
                width: 28, height: 28, borderRadius: 8,
                background: 'linear-gradient(135deg, #f3e8ff 0%, #e9d5ff 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#7c3aed',
              }}>
                {scene.icon}
              </div>
              <span style={{
                fontSize: 10, fontWeight: 600,
                color: 'var(--text-secondary)',
                textAlign: 'center',
              }}>
                {scene.label}
              </span>
              <span style={{
                fontSize: 8,
                color: 'var(--text-muted)',
                textAlign: 'center',
              }}>
                {scene.desc}
              </span>
            </div>
          ))}
        </div>

        {/* ── 风格选择（完整方案）── */}
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 4, letterSpacing: 0.3 }}>画面风格</div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 8 }}>每种风格包含完整的光影、色调、构图方案</div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 16 }}>
          {STYLES.map(s => {
            const active = value === s.key;
            return (
              <div key={s.key} onClick={() => handleStyle(s.key)}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
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
                  fontSize: 9, fontWeight: 500,
                  color: active ? 'rgba(255,255,255,0.6)' : 'var(--text-muted)',
                  textAlign: 'center', lineHeight: 1.2,
                }}>{s.tone}</span>
              </div>
            );
          })}
        </div>

        {/* ── 品牌色锁定（可选覆盖）── */}
        <div style={{
          background: brandLocked ? 'rgba(124,58,237,0.04)' : 'rgba(0,0,0,0.03)',
          borderRadius: 10, padding: '10px 12px',
          border: `1px solid ${brandLocked ? 'rgba(124,58,237,0.15)' : 'rgba(0,0,0,0.06)'}`,
          transition: 'all 0.2s',
        }}>
          <div onClick={toggleBrandLock}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              cursor: 'pointer',
            }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {brandLocked ? <Lock size={13} color="#7c3aed" /> : <Unlock size={13} color="var(--text-muted)" />}
              <div>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>锁定品牌主色调</span>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>
                  {brandLocked ? '已锁定，将覆盖风格自带色调' : '品牌色固定时开启，叠加在风格之上'}
                </div>
              </div>
            </div>
            <div style={{
              width: 36, height: 20, borderRadius: 10,
              background: brandLocked ? '#7c3aed' : 'rgba(0,0,0,0.12)',
              position: 'relative', transition: 'all 0.2s', flexShrink: 0,
            }}>
              <div style={{
                width: 16, height: 16, borderRadius: '50%', background: '#fff',
                position: 'absolute', top: 2,
                left: brandLocked ? 18 : 2,
                transition: 'all 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
              }} />
            </div>
          </div>

          {/* ── 取色器（仅品牌色锁定时展开）── */}
          {brandLocked && (
            <div style={{ marginTop: 12, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <div style={{ flexShrink: 0 }}>
                <HexColorPicker color={pickerColor} onChange={handlePickerChange} style={{ width: 160, height: 140 }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>品牌主色</div>
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
                <div style={{ fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.4 }}>
                  品牌色会叠加在「{currentStyle.label}」的光影和构图之上，保留风格的同时突出品牌辨识度
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
