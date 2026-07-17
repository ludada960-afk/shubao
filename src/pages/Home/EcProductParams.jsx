import React, { useState } from 'react';

const CATEGORIES = [
  '美妆护肤', '3C数码', '家居日用', '服饰鞋包',
  '食品饮料', '母婴用品', '宠物用品', '运动户外',
  '汽车用品', '图书文具', '珠宝配饰', '其他',
];

export default function EcProductParams({ params, onChange }) {
  const [showCatDropdown, setShowCatDropdown] = useState(false);
  const set = (key, val) => onChange({ ...params, [key]: val });
  const setCat = (val) => { set('category', val); setShowCatDropdown(false); };

  const fields = [
    { key: 'size', label: '产品尺寸', placeholder: '例如：长 × 宽 × 高 (cm)...' },
    { key: 'baseColor', label: '底色/主色', placeholder: '例如：白色 / #F5F0EB...' },
    { key: 'accentColor', label: '点缀色', placeholder: '例如：金色 / 玫瑰金...' },
    { key: 'material', label: '材质', placeholder: '例如：陶瓷 / 硅胶 / 不锈钢...' },
    { key: 'craft', label: '工艺说明', placeholder: '例如：磨砂 / 抛光 / 浮雕...' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* 品类（下拉+手动输入） */}
      <div>
        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
          品类
        </label>
        <div style={{ position: 'relative' }}>
          <input
            value={params.category || ''}
            onChange={e => set('category', e.target.value)}
            onFocus={() => setShowCatDropdown(true)}
            onBlur={() => setTimeout(() => setShowCatDropdown(false), 200)}
            placeholder="例如：美妆护肤 / 3C数码..."
            style={{
              width: '100%',
              padding: '10px 14px',
              fontSize: 13,
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)',
              background: 'rgba(0,0,0,0.02)',
              color: 'var(--text-primary)',
              outline: 'none', fontFamily: 'inherit',
            }}
          />
          {showCatDropdown && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10,
              marginTop: 4,
              background: '#fff',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              boxShadow: 'var(--shadow-lg)',
              padding: 4, display: 'flex', flexWrap: 'wrap', gap: 4,
              maxHeight: 200, overflowY: 'auto',
            }}>
              {CATEGORIES.map(c => (
                <div key={c} onClick={() => setCat(c)}
                  style={{
                    padding: '5px 12px', borderRadius: 'var(--radius-sm)',
                    fontSize: 12, cursor: 'pointer',
                    background: params.category === c ? 'var(--accent-bg)' : 'transparent',
                    color: params.category === c ? 'var(--accent)' : 'var(--text-secondary)',
                    fontWeight: params.category === c ? 600 : 400,
                    transition: 'all 0.08s',
                  }}>
                  {c}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {fields.map(f => (
        <div key={f.key}>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
            {f.label}
          </label>
          <input
            value={params[f.key] || ''}
            onChange={e => set(f.key, e.target.value)}
            placeholder={f.placeholder}
            style={{
              width: '100%', padding: '10px 14px', fontSize: 13,
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)',
              background: 'rgba(0,0,0,0.02)',
              color: 'var(--text-primary)',
              outline: 'none', fontFamily: 'inherit',
            }}
          />
        </div>
      ))}
    </div>
  );
}
