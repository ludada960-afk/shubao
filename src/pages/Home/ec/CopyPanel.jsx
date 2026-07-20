import React from 'react';
import { Sparkles, Pencil } from 'lucide-react';

const lbl = { fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 };
const inp = {
  width: '100%', padding: '8px 12px', fontSize: 13, borderRadius: 8,
  border: '1px solid rgba(0,0,0,0.12)', background: 'rgba(0,0,0,0.03)',
  color: 'var(--text-primary)', outline: 'none', fontFamily: 'inherit',
};

export default function CopyPanel({ copywriting, onChange, smartMode = true, onOverride }) {
  const setF = (key, val) => { onChange({ ...copywriting, [key]: val }); onOverride?.(); };

  const isCustomized = copywriting.plan || copywriting.sellingPoints || copywriting.qc || copywriting.details || copywriting.maintenance;

  const detailFields = [
    { key: 'plan', label: '📝 创意思路', ph: '整体策划方向、产品定位、目标人群...' },
    { key: 'sellingPoints', label: '🎯 核心卖点', ph: '每行一个卖点，如：24小时持久' },
    { key: 'qc', label: '✅ 质检报告', ph: '合格证信息、检测报告...' },
    { key: 'details', label: '🔍 细节特写', ph: '材质纹理、接口、包装...' },
    { key: 'maintenance', label: '🧴 保养维护', ph: '使用注意、保养方法...' },
  ];

  return (
    <div style={{ padding: 0 }}>
      {/* ── 智能方案指示 ── */}
      {smartMode && !isCustomized && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '10px 16px', background: 'linear-gradient(135deg, rgba(34,197,94,0.08), rgba(34,197,94,0.04))',
          borderBottom: '1px solid rgba(34,197,94,0.12)',
          fontSize: 12, fontWeight: 600, color: '#16a34a',
        }}>
          <Sparkles size={14} />
          <span>当前：已启用智能方案 · 系统自动匹配平台标题、卖点、详情文案风格</span>
        </div>
      )}
      {isCustomized && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '10px 16px', background: 'linear-gradient(135deg, rgba(124,58,237,0.06), rgba(124,58,237,0.03))',
          borderBottom: '1px solid rgba(124,58,237,0.1)',
          fontSize: 12, fontWeight: 600, color: '#7c3aed',
        }}>
          <Pencil size={14} />
          <span>已自定义配置</span>
        </div>
      )}

      <div style={{ padding: '14px 16px 12px' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8, letterSpacing: 0.3 }}>文案策划</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {detailFields.map(f => (
            <div key={f.key}>
              <label style={{ ...lbl, fontSize: 11 }}>{f.label}</label>
              <textarea value={copywriting[f.key] || ''} onChange={e => setF(f.key, e.target.value)}
                placeholder={f.ph} rows={1}
                style={{
                  ...inp, resize: 'none', lineHeight: 1.4,
                  padding: '5px 8px', minHeight: 32, fontSize: 11,
                }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
