import React from 'react';

const lbl = { fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 };
const inp = {
  width: '100%', padding: '8px 12px', fontSize: 13, borderRadius: 8,
  border: '1px solid rgba(0,0,0,0.1)', background: 'rgba(0,0,0,0.02)',
  color: 'var(--text-primary)', outline: 'none', fontFamily: 'inherit',
};

export default function CopyPanel({ copywriting, onChange }) {
  const setF = (key, val) => onChange({ ...copywriting, [key]: val });

  const detailFields = [
    { key: 'plan', label: '📝 创意思路', ph: '整体策划方向、产品定位、目标人群...' },
    { key: 'sellingPoints', label: '🎯 核心卖点', ph: '每行一个卖点，如：24小时持久' },
    { key: 'qc', label: '✅ 质检报告', ph: '合格证信息、检测报告...' },
    { key: 'details', label: '🔍 细节特写', ph: '材质纹理、接口、包装...' },
    { key: 'maintenance', label: '🧴 保养维护', ph: '使用注意、保养方法...' },
  ];

  return (
    <div style={{ padding: '16px 20px 14px' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 10, letterSpacing: 0.3 }}>文案策划</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 280, overflowY: 'auto' }}>
        {detailFields.map(f => (
          <div key={f.key}>
            <label style={{ ...lbl, fontSize: 11 }}>{f.label}</label>
            <textarea value={copywriting[f.key] || ''} onChange={e => setF(f.key, e.target.value)}
              placeholder={f.ph} rows={1}
              style={{
                ...inp, resize: 'vertical', lineHeight: 1.5,
                padding: '6px 10px', minHeight: 42, fontSize: 12,
              }} />
          </div>
        ))}
      </div>
    </div>
  );
}
