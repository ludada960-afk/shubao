import React from 'react';

export default function EcCopywriting({ copywriting, onChange }) {
  const fields = [
    { key: 'plan', label: '📝 详情页策划思路', placeholder: '整体策划方向、产品定位、目标人群描述...' },
    { key: 'sellingPoints', label: '🎯 核心卖点与优势', placeholder: '商品核心卖点排布，每个卖点一句话（逗号/换行分隔）' },
    { key: 'qc', label: '✅ 质检报告展示', placeholder: '合格证信息、检测报告内容、认证资质...' },
    { key: 'details', label: '🔍 产品细节特写', placeholder: '需要特写的部位：材质纹理、接口、Logo、包装...' },
    { key: 'maintenance', label: '🧴 售后保养维护', placeholder: '使用注意事项、保养方法、质保期限、退换政策...' },
  ];

  const setField = (key, val) => onChange({ ...copywriting, [key]: val });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {fields.map(f => (
        <div key={f.key}>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
            {f.label}
          </label>
          <textarea
            value={copywriting[f.key] || ''}
            onChange={e => setField(f.key, e.target.value)}
            placeholder={f.placeholder}
            rows={3}
            style={{
              width: '100%', padding: '10px 12px',
              fontSize: 13, lineHeight: 1.6,
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)',
              background: 'rgba(0,0,0,0.02)',
              color: 'var(--text-primary)',
              outline: 'none', resize: 'vertical',
              fontFamily: 'inherit',
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
