import React, { useState } from 'react';
import { MdAutoAwesome } from 'react-icons/md';

/* ═══════ 5 套风格（对齐后端 STYLE_SKILLS）+ 智能 ═══════ */
const STYLES = [
  { key: 'smart', label: '智能风格', desc: 'AI 根据品类自动匹配', icon: <MdAutoAwesome size={14} />, gradient: 'linear-gradient(135deg, #7c3aed 0%, #ec4899 50%, #f59e0b 100%)' },
  { key: 'premium_minimal', label: '高级极简', desc: '大量留白·低饱和', gradient: 'linear-gradient(135deg, #f5f5f5, #fff)' },
  { key: 'lifestyle_scene', label: '生活场景', desc: '真实环境·故事性', gradient: 'linear-gradient(135deg, #bbf7d0, #d1fae5)' },
  { key: 'fashion_editorial', label: '时尚杂志', desc: '高对比·戏剧光', gradient: 'linear-gradient(135deg, #1a1a2e, #d4a574)' },
  { key: 'warm_natural', label: '自然暖调', desc: '暖光·柔和·治愈', gradient: 'linear-gradient(135deg, #fde68a, #fed7aa)' },
  { key: 'tech_precision', label: '科技精工', desc: '冷调·锐利·高科技', gradient: 'linear-gradient(135deg, #3b82f6, #60a5fa)' },
];

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

export default function StylePanel({ value = 'smart', onChange, customColors, onColorsChange }) {
  const [showColors, setShowColors] = useState(false);

  return (
    <div style={{ padding: '16px 20px 14px' }}>
      {/* ── 风格选择 ── */}
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8, letterSpacing: 0.3 }}>画面风格</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 14 }}>
        {STYLES.map(s => {
          const active = value === s.key;
          return (
            <div key={s.key} onClick={() => onChange(s.key)}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
                padding: '10px 4px', borderRadius: 10, cursor: 'pointer',
                border: '1.5px solid',
                borderColor: active ? '#1a1a1a' : 'rgba(0,0,0,0.06)',
                background: active ? '#1a1a1a' : 'rgba(0,0,0,0.02)',
                transition: 'all 0.18s ease',
              }}
              onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(0,0,0,0.06)'; }}
              onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'rgba(0,0,0,0.02)'; }}>
              <div style={{
                width: 36, height: 20, borderRadius: 4,
                background: s.gradient,
                border: `1px solid ${active ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.08)'}`,
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
              }} />
              <span style={{
                fontSize: 11, fontWeight: 600,
                color: active ? '#fff' : 'var(--text-secondary)',
                display: 'flex', alignItems: 'center', gap: 2,
                textAlign: 'center',
              }}>
                {s.icon && React.cloneElement(s.icon, { size: 11, style: { color: active ? '#fff' : 'var(--text-muted)' } })}
                {s.label}
              </span>
              <span style={{
                fontSize: 9, color: active ? 'rgba(255,255,255,0.7)' : 'var(--text-faint)',
                textAlign: 'center', lineHeight: 1.2,
              }}>{s.desc}</span>
            </div>
          );
        })}
      </div>

      {/* ── 自定义色彩调色板 ── */}
      <div style={{
        background: 'rgba(0,0,0,0.02)', borderRadius: 10, padding: '10px 12px',
        border: '1px solid rgba(0,0,0,0.05)',
      }}>
        <div onClick={() => setShowColors(!showColors)}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            cursor: 'pointer', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)',
          }}>
          <span>🎨 自定义色调</span>
          <span style={{
            fontSize: 10, color: 'var(--text-muted)',
            transform: showColors ? 'rotate(180deg)' : 'none',
            transition: 'transform 0.2s',
          }}>▾</span>
        </div>

        {showColors && (
          <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {PRESET_COLORS.map(c => {
              const active = JSON.stringify(customColors) === JSON.stringify(c.colors);
              return (
                <div key={c.label} onClick={() => onColorsChange?.(c.colors)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    padding: '4px 8px', borderRadius: 8, cursor: 'pointer',
                    border: `1.5px solid ${active ? '#1a1a1a' : 'rgba(0,0,0,0.06)'}`,
                    background: active ? '#1a1a1a' : '#fff',
                    transition: 'all 0.15s',
                  }}>
                  {c.colors && (
                    <div style={{ display: 'flex', gap: 1 }}>
                      {c.colors.map((clr, i) => (
                        <div key={i} style={{
                          width: 10, height: 10, borderRadius: '50%',
                          background: clr,
                          border: '1px solid rgba(0,0,0,0.1)',
                        }} />
                      ))}
                    </div>
                  )}
                  <span style={{
                    fontSize: 10, fontWeight: 600,
                    color: active ? '#fff' : 'var(--text-secondary)',
                  }}>{c.label}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
