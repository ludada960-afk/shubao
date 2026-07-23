import React from 'react';
import { Monitor, Ban, Info } from 'lucide-react';

const RESOLUTIONS = [
  { key: '1K', label: '1K', ratio: '标准', desc: '适合快速试方向' },
  { key: '2K', label: '2K', ratio: '高清', desc: '推荐：兼顾细节与效率' },
  { key: '4K', label: '4K', ratio: '超清', desc: '适合放大查看细节' },
];

const lbl = { fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 };
const cardBase = {
  padding: '10px 12px', borderRadius: 10, border: '1.5px solid rgba(0,0,0,0.08)',
  background: '#fff', cursor: 'pointer', transition: 'all 0.15s',
  display: 'flex', alignItems: 'center', gap: 8,
};

export default function GenSettingsPanel({ value, onChange }) {
  const set = (key, val) => onChange?.({ ...value, [key]: val });

  return (
    <div style={{ padding: 0 }}>
      {/* 头部 */}
      <div style={{
        padding: '14px 16px 12px',
        borderBottom: '1px solid rgba(0,0,0,0.06)',
      }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: 0.3 }}>生图设置</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>按商品用途控制清晰度与画面约束</div>
      </div>

      <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* 分辨率 */}
        <div>
          <label style={{ ...lbl, display: 'flex', alignItems: 'center', gap: 5 }}>
            <Monitor size={13} color="#7c3aed" /> 清晰度
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {RESOLUTIONS.map(r => {
              const active = value.resolution === r.key;
              return (
                <div key={r.key} onClick={() => set('resolution', r.key)}
                  style={{
                    ...cardBase,
                    borderColor: active ? '#7c3aed' : 'rgba(0,0,0,0.08)',
                    background: active ? 'linear-gradient(135deg, rgba(124,58,237,0.06), rgba(124,58,237,0.02))' : '#fff',
                    boxShadow: active ? '0 2px 8px rgba(124,58,237,0.12)' : 'none',
                  }}
                  onMouseEnter={e => { if (!active) e.currentTarget.style.borderColor = 'rgba(124,58,237,0.3)'; }}
                  onMouseLeave={e => { if (!active) e.currentTarget.style.borderColor = 'rgba(0,0,0,0.08)'; }}
                >
                  <div style={{
                    width: 28, height: 28, borderRadius: 6,
                    background: active ? '#7c3aed' : 'rgba(0,0,0,0.06)',
                    color: active ? '#fff' : 'var(--text-muted)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, fontWeight: 700, flexShrink: 0,
                  }}>{r.ratio}</div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: active ? '#7c3aed' : 'var(--text-primary)' }}>{r.label}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{r.desc}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 避免出现的元素 */}
        <div>
          <label style={{ ...lbl, display: 'flex', alignItems: 'center', gap: 5 }}>
            <Ban size={13} color="#7c3aed" /> 避免出现的元素
            <span title="只会作为生成约束补充，不会覆盖产品图中的真实结构">
              <Info size={12} color="var(--text-muted)" aria-hidden="true" />
            </span>
          </label>
          <div role="note" style={{
            fontSize: 11, color: 'var(--text-muted)', background: 'rgba(0,0,0,0.03)',
            padding: '6px 10px', borderRadius: 8, marginBottom: 6,
          }}>
            例如商品结构错误、SKU 颜色不一致、无关道具、错误品牌元素或密集文字。
          </div>
          <input
            value={value.negativePrompt || ''}
            onChange={e => set('negativePrompt', e.target.value)}
            placeholder="例如：SKU颜色不一致、错误品牌元素、无关道具"
            style={{
              width: '100%', padding: '8px 12px', fontSize: 12, borderRadius: 8,
              border: '1px solid rgba(0,0,0,0.12)', background: 'rgba(0,0,0,0.03)',
              color: 'var(--text-primary)', outline: 'none', fontFamily: 'inherit',
            }}
          />
        </div>
      </div>
    </div>
  );
}
