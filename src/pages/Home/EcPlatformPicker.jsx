import React, { useState } from 'react';
import { MdTune, MdExpandMore, MdExpandLess } from 'react-icons/md';

const PLATFORMS = [
  { key: '淘宝', icon: '🟠', desc: '800×800 / 白底+场景' },
  { key: '京东', icon: '🛒', desc: '800×800 / 主图+场景' },
  { key: '拼多多', icon: '🟢', desc: '750×750 / 白底优先' },
  { key: '抖音', icon: '🎵', desc: '800×800 / 竖版适配' },
  { key: '小红书', icon: '📕', desc: '1:1 / 3:4 双比例' },
  { key: '亚马逊', icon: '🌐', desc: '1600×1600 / 白底刚需' },
];

const RATIOS = [
  { key: '1:1', label: '1:1 方形' },
  { key: '3:4', label: '3:4 竖版' },
  { key: '4:3', label: '4:3 横版' },
  { key: '16:9', label: '16:9 宽屏' },
];

const RESOLUTIONS = [
  { key: '1K', label: '1024×1024' },
  { key: '1.5K', label: '1536×1536' },
  { key: '2K', label: '2048×2048' },
];

/**
 * 电商平台选择 — 灵图风格：平台pill + 智能默认/自定义下拉
 */
export default function EcPlatformPicker({ platform, onChange }) {
  const [customOpen, setCustomOpen] = useState(false);
  const [customRatio, setCustomRatio] = useState('1:1');
  const [customRes, setCustomRes] = useState('1K');
  const [customCount, setCustomCount] = useState(5);

  const handleCustomToggle = () => {
    setCustomOpen(!customOpen);
  };

  return (
    <div>
      {/* Platform pills — lingtuai style */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
        {PLATFORMS.map(p => {
          const active = platform === p.key;
          return (
            <button key={p.key} onClick={() => onChange(p.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 14px',
                borderRadius: 'var(--radius-full)',
                cursor: 'pointer', transition: 'all 0.15s',
                background: active ? 'var(--accent)' : '#fff',
                color: active ? '#fff' : 'var(--text-secondary)',
                border: active ? 'none' : '1px solid var(--border)',
                fontSize: 12, fontWeight: active ? 900 : 600,
                fontFamily: 'inherit',
                boxShadow: active ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              }}>
              <span>{p.icon}</span>
              <span>{p.key}</span>
            </button>
          );
        })}
      </div>

      {/* Size config — lingtuai pill style */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: 0,
      }}>
        <div style={{ position: 'relative' }}>
          <button
            onClick={handleCustomToggle}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              height: 40, padding: '0 12px',
              borderRadius: 'var(--radius-full)',
              border: '1px solid var(--border)',
              background: '#fff',
              fontSize: 12, fontWeight: 700, color: 'var(--text-muted)',
              cursor: 'pointer', fontFamily: 'inherit',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)'; }}>
            <MdTune size={15} />
            <span style={{ fontWeight: 900, color: 'var(--text-primary)' }}>{customOpen ? '自定义' : '智能'}</span>
            <span>{customRes}</span>
            <span style={{ opacity: 0.5 }}>×</span>
            <span>{customCount}</span>
            {customOpen ? <MdExpandLess size={14} /> : <MdExpandMore size={14} />}
          </button>

          {/* Dropdown panel */}
          {customOpen && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 6px)', left: 0,
              minWidth: 240, zIndex: 50,
              borderRadius: 18, border: '1px solid var(--border)',
              background: 'rgba(255,255,255,0.95)',
              backdropFilter: 'blur(16px)',
              padding: 12,
              boxShadow: '0 18px 46px rgba(57,45,26,0.16)',
              animation: 'fadeIn 0.12s ease',
            }}>
              {/* Ratio */}
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 900, color: 'var(--text-muted)', marginBottom: 6, letterSpacing: 0.3 }}>
                  画面比例
                </div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {RATIOS.map(r => {
                    const active = customRatio === r.key;
                    return (
                      <div key={r.key} onClick={() => setCustomRatio(r.key)}
                        style={{
                          padding: '5px 12px', borderRadius: 8,
                          fontSize: 12, cursor: 'pointer',
                          background: active ? 'var(--accent)' : 'rgba(0,0,0,0.04)',
                          color: active ? '#fff' : 'var(--text-secondary)',
                          fontWeight: active ? 900 : 600,
                          transition: 'all 0.12s',
                        }}>
                        {r.label}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Resolution */}
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 900, color: 'var(--text-muted)', marginBottom: 6, letterSpacing: 0.3 }}>
                  清晰度
                </div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {RESOLUTIONS.map(r => {
                    const active = customRes === r.key;
                    return (
                      <div key={r.key} onClick={() => setCustomRes(r.key)}
                        style={{
                          padding: '5px 12px', borderRadius: 8,
                          fontSize: 12, cursor: 'pointer',
                          background: active ? 'var(--accent)' : 'rgba(0,0,0,0.04)',
                          color: active ? '#fff' : 'var(--text-secondary)',
                          fontWeight: active ? 900 : 600,
                          transition: 'all 0.12s',
                        }}>
                        {r.label}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Count slider */}
              <div>
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  marginBottom: 6,
                }}>
                  <span style={{ fontSize: 11, fontWeight: 900, color: 'var(--text-muted)', letterSpacing: 0.3 }}>生成张数</span>
                  <span style={{ fontSize: 14, fontWeight: 900, color: 'var(--text-primary)' }}>{customCount}</span>
                </div>
                <input type="range" min="1" max="20" value={customCount}
                  onChange={e => setCustomCount(parseInt(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--accent)', height: 4 }} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
