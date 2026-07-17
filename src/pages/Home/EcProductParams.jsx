import React from 'react';

export default function EcProductParams({ params, onChange }) {
  const set = (key, val) => onChange({ ...params, [key]: val });
  const fields = [
    { key: 'category', label: '品类', placeholder: '例如：美妆护肤 / 3C数码' },
    { key: 'size', label: '产品尺寸', placeholder: '长 × 宽 × 高 (cm)' },
    { key: 'baseColor', label: '底色/主色', placeholder: '例如：白色 / #F5F0EB' },
    { key: 'accentColor', label: '点缀色', placeholder: '例如：金色 / 玫瑰金' },
    { key: 'material', label: '材质', placeholder: '例如：陶瓷 / 硅胶 / 不锈钢' },
    { key: 'craft', label: '工艺说明', placeholder: '例如：磨砂 / 抛光 / 浮雕' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {fields.map(f => (
        <div key={f.key}>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
            {f.label}
          </label>
          <input
            value={params[f.key] || ''}
            onChange={e => set(f.key, e.target.value)}
            placeholder={f.placeholder}
            className="input-lingtu"
            style={{
              width: '100%',
              padding: '10px 14px',
              fontSize: 13,
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)',
              background: 'rgba(0,0,0,0.02)',
              color: 'var(--text-primary)',
              outline: 'none',
              transition: 'border-color 0.15s',
            }}
            onFocus={e => e.target.style.borderColor = 'var(--accent)'}
            onBlur={e => e.target.style.borderColor = 'var(--border)'}
          />
        </div>
      ))}
    </div>
  );
}
