import React from 'react';
import { Lightbulb, Target, ShieldCheck, Search, HeartHandshake } from 'lucide-react';

const lbl = { fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 5 };
// 自适应高度 textarea：onInput 时动态撑开
const autoGrow = (el) => { if (!el) return; el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; };
const taBase = {
  width: '100%', padding: '8px 10px', fontSize: 12, borderRadius: 8, lineHeight: 1.55,
  border: '1.5px solid rgba(0,0,0,0.10)', background: 'rgba(0,0,0,0.025)',
  color: 'var(--text-primary)', outline: 'none', fontFamily: 'inherit',
  resize: 'none', overflowY: 'hidden', minHeight: 60, transition: 'border-color 0.15s',
};

export default function CopyPanel({ copywriting, onChange }) {
  const setF = (key, val) => onChange({ ...copywriting, [key]: val });

  const detailFields = [
    { key: 'plan', label: '创意思路', icon: <Lightbulb size={12} />, ph: '整体策划方向、产品定位、目标人群...' },
    { key: 'sellingPoints', label: '核心卖点', icon: <Target size={12} />, ph: '每行一个卖点，如：24小时持久' },
    { key: 'qc', label: '质检报告', icon: <ShieldCheck size={12} />, ph: '合格证信息、检测报告...' },
    { key: 'details', label: '细节特写', icon: <Search size={12} />, ph: '材质纹理、接口、包装...' },
    { key: 'maintenance', label: '保养维护', icon: <HeartHandshake size={12} />, ph: '使用注意、保养方法...' },
  ];

  return (
    <div style={{ padding: 0 }}>
      <div className="ec-panel-fields" style={{ padding: '14px 16px 12px' }}>
        {/* 创意思路：满宽 */}
        <div style={{ marginBottom: 10 }}>
          <label className="ec-panel-field-label" style={{ ...lbl }}>
            <Lightbulb size={12} color="#7c3aed" /> 创意思路
          </label>
          <textarea value={copywriting.plan || ''} onChange={e => setF('plan', e.target.value)}
            onInput={e => autoGrow(e.target)}
            placeholder="整体策划方向、产品定位、目标人群…例：25-35岁精致女性，强调天然成分和长效保湿"
            style={{ ...taBase }}
            onFocus={e => e.target.style.borderColor='rgba(124,58,237,0.4)'}
            onBlur={e => e.target.style.borderColor='rgba(0,0,0,0.10)'}
          />
        </div>
        {/* 其余4个：2列网格 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {[
            { key: 'sellingPoints', label: '核心卖点', icon: <Target size={12} color="#7c3aed" />, ph: '每行一个卖点，例：\n24小时持久保湿\n温和不刺激' },
            { key: 'qc', label: '质检报告', icon: <ShieldCheck size={12} color="#7c3aed" />, ph: '合格证编号、检测机构、通过项目…' },
            { key: 'details', label: '细节特写', icon: <Search size={12} color="#7c3aed" />, ph: '材质纹理、接缝工艺、包装细节…' },
            { key: 'maintenance', label: '保养维护', icon: <HeartHandshake size={12} color="#7c3aed" />, ph: '使用注意事项、保养方法、储存条件…' },
          ].map(f => (
            <div key={f.key}>
              <label className="ec-panel-field-label" style={{ ...lbl }}>
                {f.icon} {f.label}
              </label>
              <textarea value={copywriting[f.key] || ''} onChange={e => setF(f.key, e.target.value)}
                onInput={e => autoGrow(e.target)}
                placeholder={f.ph}
                style={{ ...taBase, minHeight: 64 }}
                onFocus={e => e.target.style.borderColor='rgba(124,58,237,0.4)'}
                onBlur={e => e.target.style.borderColor='rgba(0,0,0,0.10)'}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
