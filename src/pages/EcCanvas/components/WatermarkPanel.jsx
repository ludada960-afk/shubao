// Material Watermark System (2026-09-08)
// 核心原则：水印应用到素材（图片/视频），不是画布
// 分离：图片水印面板 + 视频水印面板
// 面板从左侧弹出（按钮在左侧缩放条）

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { X, Image, Video, Type, ImageIcon, RotateCcw, RotateCw, Minus, Plus, Grid, Droplet, Sparkles, SlidersHorizontal } from 'lucide-react';

// ===== 共享样式 =====
const panelStyle = {
  position: 'absolute',
  left: 60, // 紧贴缩放条右侧
  bottom: 16,
  width: 320,
  maxHeight: 'calc(100vh - 120px)',
  overflowY: 'auto',
  background: '#fff',
  border: '1px solid rgba(21, 24, 40, 0.12)',
  borderRadius: 14,
  boxShadow: '0 16px 40px rgba(21, 24, 40, 0.18)',
  zIndex: 100,
  fontFamily: 'inherit',
  fontSize: 13,
  color: '#1f2329',
};

const sectionStyle = {
  padding: '16px 16px 8px',
  borderBottom: '1px solid rgba(21, 24, 40, 0.08)',
};

const headerStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: 12,
};

const labelStyle = {
  display: 'block',
  fontSize: 11,
  fontWeight: 600,
  color: '#6b7280',
  marginBottom: 6,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};

const inputStyle = {
  width: '100%',
  height: 36,
  padding: '0 12px',
  border: '1px solid rgba(21, 24, 40, 0.12)',
  borderRadius: 8,
  fontSize: 13,
  color: '#1f2329',
  background: '#fff',
  outline: 'none',
  transition: 'border-color 0.15s, box-shadow 0.15s',
};

const sliderContainerStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  marginTop: 8,
};

const selectStyle = {
  width: '100%',
  height: 36,
  padding: '0 12px',
  border: '1px solid rgba(21, 24, 40, 0.12)',
  borderRadius: 8,
  fontSize: 13,
  color: '#1f2329',
  background: '#fff',
  cursor: 'pointer',
  appearance: 'none',
  backgroundImage: "url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e\")",
  backgroundPosition: 'right 12px center',
  backgroundRepeat: 'no-repeat',
  backgroundSize: '16px',
  paddingRight: 36,
};

const colorPickerStyle = {
  width: 40,
  height: 36,
  border: 'none',
  borderRadius: 8,
  cursor: 'pointer',
  padding: 2,
};

const checkboxStyle = {
  width: 18,
  height: 18,
  accentColor: '#7c3aed',
  cursor: 'pointer',
};

const buttonStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  padding: '8px 16px',
  borderRadius: 8,
  fontSize: 12,
  fontWeight: 600,
  fontFamily: 'inherit',
  cursor: 'pointer',
  border: 'none',
  transition: 'all 0.15s ease',
};

const primaryButtonStyle = {
  ...buttonStyle,
  background: '#7c3aed',
  color: '#fff',
};

const secondaryButtonStyle = {
  ...buttonStyle,
  background: '#f3f4f6',
  color: '#374151',
};

const iconButtonStyle = {
  width: 36,
  height: 36,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: 8,
  border: '1px solid rgba(21, 24, 40, 0.12)',
  background: '#fff',
  cursor: 'pointer',
  transition: 'all 0.15s ease',
};

// ===== 预设水印位置 =====
const WATERMARK_POSITIONS = [
  { value: 'top-left', label: '左上', icon: '↖' },
  { value: 'top-center', label: '上中', icon: '↑' },
  { value: 'top-right', label: '右上', icon: '↗' },
  { value: 'center-left', label: '左中', icon: '←' },
  { value: 'center', label: '正中', icon: '⊙' },
  { value: 'center-right', label: '右中', icon: '→' },
  { value: 'bottom-left', label: '左下', icon: '↙' },
  { value: 'bottom-center', label: '下中', icon: '↓' },
  { value: 'bottom-right', label: '右下', icon: '↘' },
];

const TILE_PATTERNS = [
  { value: 'none', label: '单个' },
  { value: 'grid', label: '网格平铺' },
  { value: 'diagonal', label: '对角线平铺' },
];

// ===== 默认配置 =====
const DEFAULT_IMAGE_WATERMARK = {
  enabled: false,
  type: 'text', // 'text' | 'logo'
  text: 'SHUBAO AI',
  fontFamily: 'system-ui',
  fontSize: 24,
  fontWeight: 600,
  color: '#111827',
  opacity: 0.3,
  rotation: -15,
  position: 'bottom-right',
  offsetX: 20,
  offsetY: 20,
  tilePattern: 'none',
  tileGapX: 100,
  tileGapY: 100,
  logoUrl: '',
  logoOpacity: 0.5,
  logoScale: 1,
};

const DEFAULT_VIDEO_WATERMARK = {
  enabled: false,
  type: 'text', // 'text' | 'logo' | 'dynamic'
  text: 'SHUBAO AI',
  fontFamily: 'system-ui',
  fontSize: 28,
  fontWeight: 600,
  color: '#ffffff',
  opacity: 0.4,
  rotation: 0,
  position: 'bottom-right',
  offsetX: 30,
  offsetY: 30,
  // 动态水印特有
  dynamic: {
    enabled: false,
    mode: 'scroll', // 'scroll' | 'bounce' | 'fade' | 'pulse'
    speed: 1,
    direction: 'horizontal', // 'horizontal' | 'vertical' | 'diagonal'
    text: 'SHUBAO AI',
  },
  logoUrl: '',
  logoOpacity: 0.5,
  logoScale: 1,
};

// ===== 辅助函数 =====
function deepMerge(target, source) {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(target[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

// ===== 图片水印面板 =====
export function ImageWatermarkPanel({ open, watermark, onChange, onClose }) {
  const [config, setConfig] = useState(() => deepMerge(DEFAULT_IMAGE_WATERMARK, watermark || {}));
  const [fontPreview, setFontPreview] = useState('SHUBAO AI');

  useEffect(() => {
    setConfig(prev => deepMerge(prev, watermark || {}));
  }, [watermark]);

  const updateConfig = useCallback((patch) => {
    setConfig(prev => {
      const next = deepMerge(prev, patch);
      onChange?.(next);
      return next;
    });
  }, [onChange]);
  
  const handleFontFamilyChange = (e) => {
    const font = e.target.value;
    updateConfig({ fontFamily: font });
  };

  const handleTextChange = (e) => {
    const text = e.target.value;
    updateConfig({ text });
    setFontPreview(text);
  };

  if (!open) return null;

  return (
    <aside style={panelStyle} data-canvas-control="true" aria-label="图片水印设置">
      <header style={headerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ImageIcon style={{ width: 18, height: 18, color: '#7c3aed' }} />
          <strong>图片水印</strong>
        </div>
        <button style={{ ...buttonStyle, background: 'transparent', padding: '4px 8px' }} onClick={onClose} aria-label="关闭">
          <X size={16} />
        </button>
      </header>

      <div style={sectionStyle}>
        <label style={labelStyle}>
          <input type="checkbox" style={checkboxStyle} checked={config.enabled} onChange={e => updateConfig({ enabled: e.target.checked })} />
          <span style={{ marginLeft: 8, fontSize: 13, fontWeight: 500 }}>启用图片水印</span>
        </label>
      </div>

      {config.enabled && (
        <>
          <div style={sectionStyle}>
            <label style={labelStyle}>水印类型</label>
            <select style={selectStyle} value={config.type} onChange={e => updateConfig({ type: e.target.value })}>
              <option value="text">文字水印</option>
              <option value="logo">Logo/图片水印</option>
            </select>
          </div>

          {config.type === 'text' && (
            <>
              <div style={sectionStyle}>
                <label style={labelStyle}>水印文字</label>
                <input style={inputStyle} type="text" maxLength={60} value={config.text} onChange={e => { updateConfig({ text: e.target.value }); setFontPreview(e.target.value); }} placeholder="输入水印文字" />
              </div>

              <div style={sectionStyle}>
                <label style={labelStyle}>字体</label>
                <select style={selectStyle} value={config.fontFamily} onChange={handleFontFamilyChange}>
                  <option value="system-ui">系统默认</option>
                  <option value="Microsoft YaHei">微软雅黑</option>
                  <option value="PingFang SC">苹方</option>
                  <option value="Hiragino Sans GB">冬青黑体</option>
                  <option value="Source Han Sans CN">思源黑体</option>
                  <option value="Noto Sans SC">思源黑体 CN</option>
                  <option value="Georgia">Georgia</option>
                  <option value="Times New Roman">Times New Roman</option>
                  <option value="Arial">Arial</option>
                  <option value="Helvetica">Helvetica</option>
                  <option value="Impact">Impact</option>
                </select>
              </div>

              <div style={sectionStyle}>
                <label style={labelStyle}>字重</label>
                <select style={selectStyle} value={config.fontWeight} onChange={e => updateConfig({ fontWeight: e.target.value })}>
                  <option value="400">Regular</option>
                  <option value="500">Medium</option>
                  <option value="600">SemiBold</option>
                  <option value="700">Bold</option>
                  <option value="800">ExtraBold</option>
                  <option value="900">Black</option>
                </select>
              </div>
            </>
          )}

          {config.type === 'logo' && (
            <>
              <div style={sectionStyle}>
                <label style={labelStyle}>Logo 图片 URL</label>
                <input style={inputStyle} type="url" value={config.logoUrl} onChange={e => updateConfig({ logoUrl: e.target.value })} placeholder="https://example.com/logo.png" />
              </div>

              <div style={sectionStyle}>
                <label style={labelStyle}>Logo 缩放</label>
                <div style={sliderContainerStyle}>
                  <input type="range" min={0.1} max={3} step={0.05} value={config.logoScale} onChange={e => updateConfig({ logoScale: Number(e.target.value) })} style={{ flex: 1 }} />
                  <span style={{ width: 50, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{config.logoScale.toFixed(2)}x</span>
                </div>
              </div>
            </>
          )}

          <div style={sectionStyle}>
            <label style={labelStyle}>
              不透明度 <strong>{Math.round(config.opacity * 100)}%</strong>
            </label>
            <input type="range" min={0} max={1} step={0.01} value={config.opacity} onChange={e => updateConfig({ opacity: Number(e.target.value) })} style={{ width: '100%', accentColor: '#7c3aed' }} />
          </div>

          <div style={sectionStyle}>
            <label style={labelStyle}>颜色</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input type="color" value={config.color} onChange={e => updateConfig({ color: e.target.value })} style={colorPickerStyle} />
              <input style={{ ...inputStyle, flex: 1, paddingLeft: 12 }} type="text" value={config.color} onChange={e => updateConfig({ color: e.target.value })} />
            </div>
          </div>

          <div style={sectionStyle}>
            <label style={labelStyle}>字号 <strong>{config.fontSize}px</strong></label>
            <input type="range" min={8} max={120} step={1} value={config.fontSize} onChange={e => updateConfig({ fontSize: Number(e.target.value) })} style={{ width: '100%', accentColor: '#7c3aed' }} />
          </div>

          <div style={sectionStyle}>
            <label style={labelStyle}>倾斜角度 <strong>{config.rotation}°</strong></label>
            <input type="range" min={-180} max={180} step={1} value={config.rotation} onChange={e => updateConfig({ rotation: Number(e.target.value) })} style={{ width: '100%', accentColor: '#7c3aed' }} />
          </div>

          <div style={sectionStyle}>
            <label style={labelStyle}>位置</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
              {WATERMARK_POSITIONS.map(pos => (
                <button
                  key={pos.value}
                  type="button"
                  onClick={() => updateConfig({ position: pos.value })}
                  style={{
                    ...buttonStyle,
                    padding: '8px 4px',
                    background: config.position === pos.value ? '#7c3aed' : '#f3f4f6',
                    color: config.position === pos.value ? '#fff' : '#374151',
                    border: '1px solid',
                    borderColor: config.position === pos.value ? 'transparent' : 'rgba(21, 24, 40, 0.12)',
                  }}
                >
                  <div style={{ fontSize: 10 }}>{pos.icon}</div>
                  <div style={{ fontSize: 11 }}>{pos.label}</div>
                </button>
              ))}
            </div>
          </div>

          <div style={sectionStyle}>
            <label style={labelStyle}>平铺模式</label>
            <select style={selectStyle} value={config.tilePattern} onChange={e => updateConfig({ tilePattern: e.target.value })}>
              {TILE_PATTERNS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>

          {(config.tilePattern === 'grid' || config.tilePattern === 'diagonal') && (
            <>
              <div style={sectionStyle}>
                <label style={labelStyle}>水平间距 <strong>{config.tileGapX}px</strong></label>
                <input type="range" min={20} max={500} step={5} value={config.tileGapX} onChange={e => updateConfig({ tileGapX: Number(e.target.value) })} style={{ width: '100%', accentColor: '#7c3aed' }} />
              </div>
              <div style={sectionStyle}>
                <label style={labelStyle}>垂直间距 <strong>{config.tileGapY}px</strong></label>
                <input type="range" min={20} max={500} step={5} value={config.tileGapY} onChange={e => updateConfig({ tileGapY: Number(e.target.value) })} style={{ width: '100%', accentColor: '#7c3aed' }} />
              </div>
            </>
          )}

          {config.type === 'logo' && (
            <div style={sectionStyle}>
              <label style={labelStyle}>Logo 不透明度 <strong>{Math.round(config.logoOpacity * 100)}%</strong></label>
              <input type="range" min={0} max={1} step={0.01} value={config.logoOpacity} onChange={e => updateConfig({ logoOpacity: Number(e.target.value) })} style={{ width: '100%', accentColor: '#7c3aed' }} />
            </div>
          )}

          <div style={{ padding: '16px', display: 'flex', gap: 8, justifyContent: 'flex-end', borderTop: '1px solid rgba(21, 24, 40, 0.08)' }}>
            <button style={secondaryButtonStyle} onClick={() => updateConfig(DEFAULT_IMAGE_WATERMARK)}>重置默认</button>
          </div>
        </>
      )}
    </aside>
  );
}

// ===== 视频水印面板 =====
export function VideoWatermarkPanel({ open, watermark, onChange, onClose }) {
  const [config, setConfig] = useState(() => deepMerge(DEFAULT_VIDEO_WATERMARK, watermark || {}));
  const [dynamicTextPreview, setDynamicTextPreview] = useState('SHUBAO AI');

  useEffect(() => {
    setConfig(prev => deepMerge(prev, watermark || {}));
  }, [watermark]);

  const updateConfig = useCallback((patch) => {
    setConfig(prev => {
      const next = deepMerge(prev, patch);
      onChange?.(next);
      return next;
    });
  }, [onChange]);

  const handleDynamicTextChange = (e) => {
    const text = e.target.value;
    updateConfig({ dynamic: { ...config.dynamic, text } });
    setDynamicTextPreview(text);
  };

  /* 9-08 修复: 原来只有 ImageWatermarkPanel 有 open 门控, 视频面板没有 → 画布 tab 上常驻悬浮.
     Hook 全部在门控之前执行, 保证开关时 Hook 顺序一致 (避免 React 运行时崩溃). */
  if (!open) return null;

  return (
    <aside style={{ ...panelStyle, width: 360 }} data-canvas-control="true" aria-label="视频水印设置">
      <header style={headerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Video style={{ width: 18, height: 18, color: '#7c3aed' }} />
          <strong>视频水印</strong>
        </div>
        <button style={{ ...buttonStyle, background: 'transparent', padding: '4px 8px' }} onClick={onClose} aria-label="关闭">
          <X size={16} />
        </button>
      </header>

      <div style={sectionStyle}>
        <label style={labelStyle}>
          <input type="checkbox" style={checkboxStyle} checked={config.enabled} onChange={e => updateConfig({ enabled: e.target.checked })} />
          <span style={{ marginLeft: 8, fontSize: 13, fontWeight: 500 }}>启用视频水印</span>
        </label>
      </div>

      {config.enabled && (
        <>
          <div style={sectionStyle}>
            <label style={labelStyle}>水印类型</label>
            <select style={selectStyle} value={config.type} onChange={e => updateConfig({ type: e.target.value })}>
              <option value="text">文字水印</option>
              <option value="logo">Logo 图片水印</option>
              <option value="dynamic">动态水印</option>
            </select>
          </div>

          {config.type === 'text' && (
            <>
              <div style={sectionStyle}>
                <label style={labelStyle}>水印文字</label>
                <input style={inputStyle} type="text" maxLength={80} value={config.text} onChange={e => updateConfig({ text: e.target.value })} placeholder="输入水印文字" />
              </div>

              <div style={sectionStyle}>
                <label style={labelStyle}>字体</label>
                <select style={selectStyle} value={config.fontFamily} onChange={e => updateConfig({ fontFamily: e.target.value })}>
                  <option value="system-ui">系统默认</option>
                  <option value="Microsoft YaHei">微软雅黑</option>
                  <option value="PingFang SC">苹方</option>
                  <option value="Source Han Sans CN">思源黑体</option>
                  <option value="Arial">Arial</option>
                  <option value="Helvetica">Helvetica</option>
                  <option value="Impact">Impact</option>
                </select>
              </div>

              <div style={sectionStyle}>
                <label style={labelStyle}>字重</label>
                <select style={selectStyle} value={config.fontWeight} onChange={e => updateConfig({ fontWeight: e.target.value })}>
                  <option value="400">Regular</option>
                  <option value="500">Medium</option>
                  <option value="600">SemiBold</option>
                  <option value="700">Bold</option>
                  <option value="800">ExtraBold</option>
                  <option value="900">Black</option>
                </select>
              </div>
            </>
          )}

          {config.type === 'logo' && (
            <>
              <div style={sectionStyle}>
                <label style={labelStyle}>Logo 图片 URL</label>
                <input style={inputStyle} type="url" value={config.logoUrl} onChange={e => updateConfig({ logoUrl: e.target.value })} placeholder="https://example.com/logo.png" />
              </div>
              <div style={sectionStyle}>
                <label style={labelStyle}>Logo 缩放</label>
                <div style={sliderContainerStyle}>
                  <input type="range" min={0.1} max={3} step={0.05} value={config.logoScale} onChange={e => updateConfig({ logoScale: Number(e.target.value) })} style={{ flex: 1 }} />
                  <span style={{ width: 50, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{config.logoScale.toFixed(2)}x</span>
                </div>
              </div>
            </>
          )}

          {config.type === 'dynamic' && (
            <>
              <div style={sectionStyle}>
                <label style={labelStyle}>动态文字</label>
                <input style={inputStyle} type="text" maxLength={60} value={config.dynamic.text} onChange={e => { updateConfig({ dynamic: { ...config.dynamic, text: e.target.value } }); setDynamicTextPreview(e.target.value); }} placeholder="输入动态水印文字" />
              </div>

              <div style={sectionStyle}>
                <label style={labelStyle}>动画模式</label>
                <select style={selectStyle} value={config.dynamic.mode} onChange={e => updateConfig({ dynamic: { ...config.dynamic, mode: e.target.value } })}>
                  <option value="scroll">横向滚动</option>
                  <option value="vertical">纵向滚动</option>
                  <option value="diagonal">对角线滚动</option>
                  <option value="bounce">弹跳</option>
                  <option value="fade">淡入淡出</option>
                  <option value="pulse">脉冲闪烁</option>
                </select>
              </div>

              <div style={sectionStyle}>
                <label style={labelStyle}>速度 <strong>{config.dynamic.speed}x</strong></label>
                <input type="range" min={0.1} max={5} step={0.1} value={config.dynamic.speed} onChange={e => updateConfig({ dynamic: { ...config.dynamic, speed: Number(e.target.value) } })} style={{ width: '100%', accentColor: '#7c3aed' }} />
              </div>

              <div style={sectionStyle}>
                <label style={labelStyle}>方向</label>
                <select style={selectStyle} value={config.dynamic.direction} onChange={e => updateConfig({ dynamic: { ...config.dynamic, direction: e.target.value } })}>
                  <option value="horizontal">水平</option>
                  <option value="vertical">垂直</option>
                  <option value="diagonal">对角线</option>
                </select>
              </div>

              <div style={sectionStyle}>
                <label style={labelStyle}>字号 <strong>{config.fontSize}px</strong></label>
                <input type="range" min={12} max={80} step={1} value={config.fontSize} onChange={e => updateConfig({ fontSize: Number(e.target.value) })} style={{ width: '100%', accentColor: '#7c3aed' }} />
              </div>

              <div style={sectionStyle}>
                <label style={labelStyle}>颜色</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <input type="color" value={config.color} onChange={e => updateConfig({ color: e.target.value })} style={colorPickerStyle} />
                  <input style={{ ...inputStyle, flex: 1, paddingLeft: 12 }} type="text" value={config.color} onChange={e => updateConfig({ color: e.target.value })} />
                </div>
              </div>

              <div style={sectionStyle}>
                <label style={labelStyle}>不透明度 <strong>{Math.round(config.opacity * 100)}%</strong></label>
                <input type="range" min={0} max={1} step={0.01} value={config.opacity} onChange={e => updateConfig({ opacity: Number(e.target.value) })} style={{ width: '100%', accentColor: '#7c3aed' }} />
              </div>
            </>
          )}

          {(config.type === 'text' || config.type === 'logo') && (
            <>
              <div style={sectionStyle}>
                <label style={labelStyle}>
                  不透明度 <strong>{Math.round(config.opacity * 100)}%</strong>
                </label>
                <input type="range" min={0} max={1} step={0.01} value={config.opacity} onChange={e => updateConfig({ opacity: Number(e.target.value) })} style={{ width: '100%', accentColor: '#7c3aed' }} />
              </div>

              <div style={sectionStyle}>
                <label style={labelStyle}>颜色</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <input type="color" value={config.color} onChange={e => updateConfig({ color: e.target.value })} style={colorPickerStyle} />
                  <input style={{ ...inputStyle, flex: 1, paddingLeft: 12 }} type="text" value={config.color} onChange={e => updateConfig({ color: e.target.value })} />
                </div>
              </div>

              <div style={sectionStyle}>
                <label style={labelStyle}>字号 <strong>{config.fontSize}px</strong></label>
                <input type="range" min={12} max={120} step={1} value={config.fontSize} onChange={e => updateConfig({ fontSize: Number(e.target.value) })} style={{ width: '100%', accentColor: '#7c3aed' }} />
              </div>

              <div style={sectionStyle}>
                <label style={labelStyle}>倾斜角度 <strong>{config.rotation}°</strong></label>
                <input type="range" min={-180} max={180} step={1} value={config.rotation} onChange={e => updateConfig({ rotation: Number(e.target.value) })} style={{ width: '100%', accentColor: '#7c3aed' }} />
              </div>

              <div style={sectionStyle}>
                <label style={labelStyle}>位置</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                  {WATERMARK_POSITIONS.map(pos => (
                    <button
                      key={pos.value}
                      type="button"
                      onClick={() => updateConfig({ position: pos.value })}
                      style={{
                        ...buttonStyle,
                        padding: '8px 4px',
                        background: config.position === pos.value ? '#7c3aed' : '#f3f4f6',
                        color: config.position === pos.value ? '#fff' : '#374151',
                        border: '1px solid',
                        borderColor: config.position === pos.value ? 'transparent' : 'rgba(21, 24, 40, 0.12)',
                      }}
                    >
                      <div style={{ fontSize: 10 }}>{pos.icon}</div>
                      <div style={{ fontSize: 11 }}>{pos.label}</div>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {config.type === 'logo' && (
            <div style={sectionStyle}>
              <label style={labelStyle}>Logo 不透明度 <strong>{Math.round(config.logoOpacity * 100)}%</strong></label>
              <input type="range" min={0} max={1} step={0.01} value={config.logoOpacity} onChange={e => updateConfig({ logoOpacity: Number(e.target.value) })} style={{ width: '100%', accentColor: '#7c3aed' }} />
            </div>
          )}

          <div style={{ padding: '16px', display: 'flex', gap: 8, justifyContent: 'flex-end', borderTop: '1px solid rgba(21, 24, 40, 0.08)' }}>
            <button style={secondaryButtonStyle} onClick={() => updateConfig(config.type === 'dynamic' ? DEFAULT_VIDEO_WATERMARK : { ...DEFAULT_VIDEO_WATERMARK, type: config.type })}>重置默认</button>
          </div>
        </>
      )}
    </aside>
  );
}

// ===== 主导出 =====
export { DEFAULT_IMAGE_WATERMARK, DEFAULT_VIDEO_WATERMARK };
export { buildCanvasWatermarkTiles, normalizeCanvasWatermark } from '../canvasWatermarkModel.js';