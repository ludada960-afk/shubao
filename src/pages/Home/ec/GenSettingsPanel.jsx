import React from 'react';
import { Coins, Monitor, ShieldAlert, Sparkles } from 'lucide-react';
import { IMAGE_MODELS, generationUnits, normalizeImageModel } from '../../../services/imageModelCatalog.js';

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

export default function GenSettingsPanel({ value, onChange, showHeader = true }) {
  const safeValue = value || {};
  const selectedModel = normalizeImageModel(safeValue.imageModel);
  const set = (key, val) => onChange?.({ ...safeValue, [key]: val });

  return (
    <div style={{ padding: 0 }}>
      {showHeader && <div style={{
        padding: '14px 16px 12px',
        borderBottom: '1px solid rgba(0,0,0,0.06)',
      }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: 0.3 }}>生图设置</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>按商品用途控制清晰度与画面约束</div>
      </div>}

      <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <label style={{ ...lbl, display: 'flex', alignItems: 'center', gap: 5 }}>
            <Sparkles size={13} color="#7c3aed" /> 生图模型
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 7 }}>
            {IMAGE_MODELS.map(model => {
              const active = selectedModel === model.id;
              return <button key={model.id} type="button" onClick={() => set('imageModel', model.id)} style={{
                ...cardBase, width: '100%', textAlign: 'left', fontFamily: 'inherit',
                padding: 8,
                borderColor: active ? '#7c3aed' : 'rgba(0,0,0,0.08)',
                background: active ? 'linear-gradient(135deg, rgba(124,58,237,0.08), rgba(255,255,255,0.94))' : '#fff',
                boxShadow: active ? '0 3px 12px rgba(124,58,237,0.13)' : 'none',
              }}>
                <img src={model.visual} alt="" width="72" height="52" loading="lazy" decoding="async" fetchpriority="auto" style={{ width: 72, height: 52, borderRadius: 7, objectFit: 'cover', flexShrink: 0, border: '1px solid rgba(0,0,0,0.06)' }} />
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <strong style={{ fontSize: 12, color: active ? '#6d28d9' : 'var(--text-primary)' }}>{model.label}</strong>
                    <span style={{ fontSize: 10, color: active ? '#7c3aed' : 'var(--text-muted)' }}>{model.badge}</span>
                  </span>
                  <span style={{ display: 'block', marginTop: 2, fontSize: 10, lineHeight: 1.45, color: 'var(--text-muted)' }}>{model.description}</span>
                </span>
              </button>;
            })}
          </div>
        </div>

        {/* 分辨率 */}
        <div>
          <label style={{ ...lbl, display: 'flex', alignItems: 'center', gap: 5 }}>
            <Monitor size={13} color="#7c3aed" /> 清晰度
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {RESOLUTIONS.map(r => {
              const active = (safeValue.resolution || '2K') === r.key;
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
        {/* 9-11 二轮批注: 「避免出现的元素」从「视觉方向」迁到生成设置 —— 它属于生成约束, 与清晰度/模型同族 */}
        <div>
          <label style={{ ...lbl, display: 'flex', alignItems: 'center', gap: 5 }}>
            <ShieldAlert size={13} color="#7c3aed" /> 避免出现的元素
          </label>
          <div style={{ marginBottom: 7, color: 'var(--text-muted)', fontSize: 10, lineHeight: 1.5 }}>
            建议填写商品结构变形、异常手部、乱码文字、无关道具等具体风险；只作为画面约束补充，不会改变商品实拍事实。
          </div>
          <input
            aria-label="避免出现的元素"
            value={safeValue.negativePrompt || ''}
            onChange={event => set('negativePrompt', event.target.value)}
            placeholder="商品结构变形、异常手部、乱码文字、无关道具"
            style={{ width: '100%', height: 36, boxSizing: 'border-box', padding: '0 10px', border: '1px solid rgba(0,0,0,0.12)', borderRadius: 7, background: 'rgba(248,248,250,.92)', color: 'var(--text-primary)', fontFamily: 'inherit', fontSize: 11, outline: 'none' }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '9px 10px', borderRadius: 9, background: 'rgba(124,58,237,0.06)', color: 'var(--text-muted)', fontSize: 10, lineHeight: 1.5 }}>
          <Coins size={14} color="#7c3aed" style={{ marginTop: 1, flexShrink: 0 }} />
          <span>当前约 {(generationUnits(selectedModel, safeValue.resolution || '2K') || 0) / 1000} AI 积分/张；确认套图前会显示本次总费用。</span>
        </div>
      </div>
    </div>
  );
}
