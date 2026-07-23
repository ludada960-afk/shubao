import React from 'react';
import { Monitor, Gauge, Ban, Info, SlidersHorizontal } from 'lucide-react';

const RESOLUTIONS = [
  { key: '1K', label: '1K', ratio: '预览', desc: '快速确认构图与风格' },
  { key: '2K', label: '2K', ratio: '成片', desc: '商品细节与电商主图' },
  { key: '4K', label: '4K', ratio: '超清', desc: '仅在上游支持时启用' },
];

const QUALITIES = [
  { key: 'preview', label: '先看构图', desc: '快速试错，减少重复生成' },
  { key: 'final', label: '最终成片', desc: '优先商品一致性与细节' },
];

const RATIOS = [
  { key: 'auto', label: '自动', desc: '按套图类型匹配' },
  { key: '1:1', label: '1:1', desc: '主图/白底图' },
  { key: '3:4', label: '3:4', desc: '详情/场景图' },
  { key: '4:3', label: '4:3', desc: '横版场景' },
  { key: '9:16', label: '9:16', desc: '短视频封面' },
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
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>分辨率与出图品质</div>
      </div>

      <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* 分辨率 */}
        <div>
          <label style={{ ...lbl, display: 'flex', alignItems: 'center', gap: 5 }}>
            <Monitor size={13} color="#7c3aed" /> 分辨率
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

        {/* 构图比例 */}
        <div>
          <label style={{ ...lbl, display: 'flex', alignItems: 'center', gap: 5 }}>
            <SlidersHorizontal size={13} color="#7c3aed" /> 构图比例
          </label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {RATIOS.map(r => {
              const active = (value.aspectRatio || 'auto') === r.key;
              return (
                <div key={r.key} onClick={() => set('aspectRatio', r.key)} style={{
                  ...cardBase, padding: '8px 10px', flex: '1 1 70px',
                  borderColor: active ? '#7c3aed' : 'rgba(0,0,0,0.08)',
                  background: active ? 'rgba(124,58,237,0.06)' : '#fff',
                }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700 }}>{r.label}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{r.desc}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 品质 */}
        <div>
          <label style={{ ...lbl, display: 'flex', alignItems: 'center', gap: 5 }}>
            <Gauge size={13} color="#7c3aed" /> 出图品质
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            {QUALITIES.map(q => {
              const active = value.quality === q.key;
              return (
                <div key={q.key} onClick={() => set('quality', q.key)}
                  style={{
                    flex: 1, ...cardBase,
                    borderColor: active ? '#7c3aed' : 'rgba(0,0,0,0.08)',
                    background: active ? 'linear-gradient(135deg, rgba(124,58,237,0.06), rgba(124,58,237,0.02))' : '#fff',
                    boxShadow: active ? '0 2px 8px rgba(124,58,237,0.12)' : 'none',
                  }}
                  onMouseEnter={e => { if (!active) e.currentTarget.style.borderColor = 'rgba(124,58,237,0.3)'; }}
                  onMouseLeave={e => { if (!active) e.currentTarget.style.borderColor = 'rgba(0,0,0,0.08)'; }}
                >
                  <div style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: active ? '#7c3aed' : 'rgba(0,0,0,0.15)',
                    flexShrink: 0,
                  }} />
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: active ? '#7c3aed' : 'var(--text-primary)' }}>{q.label}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{q.desc}</div>
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
            告诉 AI 不希望出现什么，例如“模糊、变形、水印、多余手指”。
          </div>
          <input
            value={value.negativePrompt || ''}
            onChange={e => set('negativePrompt', e.target.value)}
            placeholder="例如：模糊、变形、水印、文字..."
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
