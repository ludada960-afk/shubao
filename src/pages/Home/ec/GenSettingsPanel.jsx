import React, { useState } from 'react';
import { Monitor, Gauge, Zap, Ban, Hash, Info } from 'lucide-react';

const RESOLUTIONS = [
  { key: '1024x1024', label: '1024×1024', ratio: '1:1', desc: '正方形·适合主图' },
  { key: '1536x1024', label: '1536×1024', ratio: '3:2', desc: '横版·适合场景图' },
  { key: '1024x1536', label: '1024×1536', ratio: '2:3', desc: '竖版·适合详情图' },
  { key: '2048x2048', label: '2048×2048', ratio: '1:1', desc: '2K高清·细节更丰富' },
];

const QUALITIES = [
  { key: 'standard', label: '标准', desc: '速度快·适合快速预览' },
  { key: 'hd', label: '高清', desc: '细节好·适合最终出图' },
];

const lbl = { fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 };
const cardBase = {
  padding: '10px 12px', borderRadius: 10, border: '1.5px solid rgba(0,0,0,0.08)',
  background: '#fff', cursor: 'pointer', transition: 'all 0.15s',
  display: 'flex', alignItems: 'center', gap: 8,
};

export default function GenSettingsPanel({ value, onChange }) {
  const [showTip, setShowTip] = useState(false);

  const set = (key, val) => onChange?.({ ...value, [key]: val });

  return (
    <div style={{ padding: 0 }}>
      {/* 头部 */}
      <div style={{
        padding: '14px 16px 12px',
        borderBottom: '1px solid rgba(0,0,0,0.06)',
      }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: 0.3 }}>生图设置</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>分辨率、品质与高级参数控制</div>
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

        {/* 创意度滑块 */}
        <div>
          <label style={{ ...lbl, display: 'flex', alignItems: 'center', gap: 5 }}>
            <Zap size={13} color="#7c3aed" /> 创意度
            <span style={{ marginLeft: 'auto', fontSize: 11, color: '#7c3aed', fontWeight: 700 }}>{Math.round(value.creativity * 100)}%</span>
          </label>
          <input
            type="range" min="0.5" max="1" step="0.05"
            value={value.creativity}
            onChange={e => set('creativity', parseFloat(e.target.value))}
            style={{ width: '100%', accentColor: '#7c3aed' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
            <span>保守（更贴合产品）</span>
            <span>奔放（更有创意）</span>
          </div>
        </div>

        {/* 反向提示词 */}
        <div>
          <label style={{ ...lbl, display: 'flex', alignItems: 'center', gap: 5 }}>
            <Ban size={13} color="#7c3aed" /> 反向提示词
            <span style={{ marginLeft: 4, cursor: 'pointer' }} onMouseEnter={() => setShowTip(true)} onMouseLeave={() => setShowTip(false)}>
              <Info size={12} color="var(--text-muted)" />
            </span>
          </label>
          {showTip && (
            <div style={{
              fontSize: 11, color: 'var(--text-muted)', background: 'rgba(0,0,0,0.03)',
              padding: '6px 10px', borderRadius: 8, marginBottom: 6,
            }}>
              输入不希望在图中出现的内容，如：模糊、低质量、多余的手指、文字水印等
            </div>
          )}
          <input
            value={value.negativePrompt || ''}
            onChange={e => set('negativePrompt', e.target.value)}
            placeholder="例如：模糊、低质量、多余的手指、文字水印..."
            style={{
              width: '100%', padding: '8px 12px', fontSize: 12, borderRadius: 8,
              border: '1px solid rgba(0,0,0,0.12)', background: 'rgba(0,0,0,0.03)',
              color: 'var(--text-primary)', outline: 'none', fontFamily: 'inherit',
            }}
          />
        </div>

        {/* 固定种子 */}
        <div>
          <label style={{ ...lbl, display: 'flex', alignItems: 'center', gap: 5 }}>
            <Hash size={13} color="#7c3aed" /> 固定种子（可选）
          </label>
          <input
            type="number"
            value={value.seed || ''}
            onChange={e => set('seed', e.target.value)}
            placeholder="留空则随机"
            style={{
              width: '100%', padding: '8px 12px', fontSize: 12, borderRadius: 8,
              border: '1px solid rgba(0,0,0,0.12)', background: 'rgba(0,0,0,0.03)',
              color: 'var(--text-primary)', outline: 'none', fontFamily: 'inherit',
            }}
          />
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
            固定种子可让相同参数下生成风格一致的图片
          </div>
        </div>
      </div>
    </div>
  );
}
