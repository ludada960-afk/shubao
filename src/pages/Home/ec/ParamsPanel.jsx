import React, { useState } from 'react';
import { CircleHelp, Shapes, Ruler, Palette, Pipette, Layers3, Hammer } from 'lucide-react';

const CATEGORIES = ['美妆护肤', '3C数码', '家居日用', '服饰鞋包', '食品饮料', '母婴用品', '宠物用品', '运动户外', '汽车用品', '图书文具', '珠宝配饰', '其他'];

const lbl = { fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 };
const inp = {
  width: '100%', padding: '9px 12px', fontSize: 14, borderRadius: 8,
  border: '1px solid rgba(0,0,0,0.12)', background: 'rgba(0,0,0,0.03)',
  color: 'var(--text-primary)', outline: 'none', fontFamily: 'inherit',
};

export default function ParamsPanel({ params, onChange, mode = 'product' }) {
  const [catOpen, setCatOpen] = useState(false);
  const [activeHelp, setActiveHelp] = useState(null);
  const set = (key, val) => onChange({ ...params, [key]: val });

  const fields = mode === 'tryon' ? [
    { key: 'baseColor', label: '必须保留的颜色', icon: Palette, ph: '例：炭灰、米白、酒红' },
    { key: 'material', label: '商品材质', icon: Layers3, ph: '羊毛 / 真皮 / 金属 / 雪纺' },
    { key: 'craft', label: '版型与工艺', icon: Hammer, ph: '廓形、垂坠、刺绣、五金细节' },
    { key: 'size', label: '尺码与比例', icon: Ruler, ph: '宽松版 / 标准版 / 商品尺寸' },
  ] : [
    { key: 'size', label: '产品尺寸', icon: Ruler, ph: '长×宽×高 (cm)' },
    { key: 'baseColor', label: '底色/主色', icon: Palette, ph: '白色 / #F5F0EB' },
    { key: 'accentColor', label: '点缀色', icon: Pipette, ph: '金色 / 玫瑰金' },
    { key: 'material', label: '材质', icon: Layers3, ph: '陶瓷 / 硅胶 / 不锈钢' },
    { key: 'craft', label: '工艺说明', icon: Hammer, ph: '磨砂 / 抛光 / 浮雕' },
  ];

  return (
    <div style={{ padding: 0 }}>
      <div className="ec-panel-fields" style={{ padding: '14px 16px 12px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <label className="ec-panel-field-label" style={{ ...lbl }}><Shapes size={12} /> {mode === 'tryon' ? '商品类型' : '品类'}</label>
            <div style={{ position: 'relative' }}>
              <input value={params.category || ''} onChange={e => set('category', e.target.value)}
                onFocus={() => setCatOpen(true)}
                onBlur={() => setTimeout(() => setCatOpen(false), 200)}
                placeholder={mode === 'tryon' ? '服饰 / 鞋包 / 配饰...' : '美妆护肤 / 3C数码...'}
                style={{ ...inp, height: 42 }} />
              {catOpen && (
                <div className="ec-inline-option-menu" style={{
                  position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10,
                  marginTop: 4, background: '#fff', border: '1px solid rgba(0,0,0,0.08)',
                  borderRadius: 8, boxShadow: '0 8px 30px rgba(0,0,0,0.1)',
                  padding: 6, display: 'flex', flexWrap: 'wrap', gap: 4,
                  maxHeight: 120, overflowY: 'auto',
                }}>
                  {CATEGORIES.map(c => (
                    <div key={c} onClick={() => { set('category', c); setCatOpen(false); }}
                      style={{
                        padding: '6px 11px', borderRadius: 6, fontSize: 12, cursor: 'pointer',
                        background: params.category === c ? '#1a1a1a' : 'rgba(0,0,0,0.04)',
                        color: params.category === c ? '#fff' : 'var(--text-secondary)',
                        fontWeight: params.category === c ? 600 : 400,
                        transition: 'all 0.15s',
                      }}>{c}</div>
                  ))}
                </div>
              )}
            </div>
          </div>
          {fields.map(f => (
            <div key={f.key}>
              <label className="ec-panel-field-label" style={{ ...lbl }}><f.icon size={12} /> {f.label}</label>
              <input value={params[f.key] || ''} onChange={e => set(f.key, e.target.value)}
                placeholder={f.ph}
                style={{ ...inp, height: 42 }} />
            </div>
          ))}
          {mode === 'tryon' && (
            <div className="ec-tryon-preserve-options" style={{ gridColumn: '1 / -1' }}>
              {[
                ['preserveMaterial', '锁定材质纹理', '强化材质、垂坠、反光与表面纹理约束，降低换装后质感漂移。'],
                ['preservePattern', '锁定图案与标识', '强化印花、织纹、五金和标识位置约束，减少图案被重绘。'],
                ['consistentPersonScene', '保持人物与场景', '强化人物身份、姿态、环境与光线连续性，适合批量生成同组穿搭。'],
              ].map(([key, label, help]) => (
                <label key={key} className="ec-tryon-preserve-option">
                  <input type="checkbox" checked={params[key] !== false} onChange={event => set(key, event.target.checked)} />
                  <span>{label}</span>
                  <button
                    type="button"
                    className="ec-tryon-help-trigger"
                    aria-label={`查看${label}说明`}
                    aria-expanded={activeHelp === key}
                    onClick={event => { event.preventDefault(); event.stopPropagation(); setActiveHelp(current => current === key ? null : key); }}
                  ><CircleHelp size={14} /></button>
                  {activeHelp === key && <span className="ec-tryon-help-popover" role="tooltip">{help}</span>}
                </label>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
