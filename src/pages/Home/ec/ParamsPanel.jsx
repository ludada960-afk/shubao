import React, { useState } from 'react';

const CATEGORIES = ['美妆护肤', '3C数码', '家居日用', '服饰鞋包', '食品饮料', '母婴用品', '宠物用品', '运动户外', '汽车用品', '图书文具', '珠宝配饰', '其他'];

const lbl = { fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 };
const inp = {
  width: '100%', padding: '8px 12px', fontSize: 13, borderRadius: 8,
  border: '1px solid rgba(0,0,0,0.1)', background: 'rgba(0,0,0,0.02)',
  color: 'var(--text-primary)', outline: 'none', fontFamily: 'inherit',
};

export default function ParamsPanel({ params, onChange }) {
  const [catOpen, setCatOpen] = useState(false);
  const set = (key, val) => onChange({ ...params, [key]: val });
  const fields = [
    { key: 'size', label: '产品尺寸', ph: '长×宽×高 (cm)' },
    { key: 'baseColor', label: '底色/主色', ph: '白色 / #F5F0EB' },
    { key: 'accentColor', label: '点缀色', ph: '金色 / 玫瑰金' },
    { key: 'material', label: '材质', ph: '陶瓷 / 硅胶 / 不锈钢' },
    { key: 'craft', label: '工艺说明', ph: '磨砂 / 抛光 / 浮雕' },
  ];
  return (
    <div style={{ padding: '16px 20px 14px' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 10, letterSpacing: 0.3 }}>产品参数</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={{ ...lbl, fontSize: 11 }}>品类</label>
          <div style={{ position: 'relative' }}>
            <input value={params.category || ''} onChange={e => set('category', e.target.value)}
              onFocus={() => setCatOpen(true)}
              onBlur={() => setTimeout(() => setCatOpen(false), 200)}
              placeholder="美妆护肤 / 3C数码..."
              style={{ ...inp, height: 36, fontSize: 12 }} />
            {catOpen && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10,
                marginTop: 4, background: '#fff', border: '1px solid rgba(0,0,0,0.08)',
                borderRadius: 8, boxShadow: '0 8px 30px rgba(0,0,0,0.1)',
                padding: 6, display: 'flex', flexWrap: 'wrap', gap: 4,
                maxHeight: 120, overflowY: 'auto',
              }}>
                {CATEGORIES.map(c => (
                  <div key={c} onClick={() => { set('category', c); setCatOpen(false); }}
                    style={{
                      padding: '4px 10px', borderRadius: 6, fontSize: 11, cursor: 'pointer',
                      background: params.category === c ? '#1a1a1a' : 'rgba(0,0,0,0.03)',
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
            <label style={{ ...lbl, fontSize: 11 }}>{f.label}</label>
            <input value={params[f.key] || ''} onChange={e => set(f.key, e.target.value)}
              placeholder={f.ph}
              style={{ ...inp, height: 36, fontSize: 12 }} />
          </div>
        ))}
      </div>
    </div>
  );
}
