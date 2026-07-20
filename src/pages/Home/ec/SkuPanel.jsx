import React from 'react';
import { Plus } from 'lucide-react';

const sInp = {
  padding: '6px 10px', borderRadius: 8, fontSize: 12, border: '1px solid rgba(0,0,0,0.12)',
  background: '#fff', color: 'var(--text-primary)', outline: 'none', width: '100%',
  fontFamily: 'inherit',
};

export default function SkuPanel({ skus, onChange }) {
  const add = () => onChange([...skus, { id: Date.now(), color: '', size: '', capacity: '', dimLabel: '', count: 1 }]);
  const upd = (id, key, val) => onChange(skus.map(s => s.id === id ? { ...s, [key]: val } : s));
  const rm = (id) => onChange(skus.filter(s => s.id !== id));

  return (
    <div style={{ padding: 0 }}>
      {/* ── SKU 永远不显示智能方案标签 ── */}
      <div style={{
        padding: '14px 16px 12px',
        borderBottom: '1px solid rgba(0,0,0,0.06)',
      }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: 0.3 }}>SKU 变体配置</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>定义颜色、规格、尺寸，每个变体生成一张 SKU 图</div>
      </div>

      <div style={{ padding: '12px 16px' }}>
        {skus.map((sku, idx) => (
          <div key={sku.id} style={{
            background: 'rgba(0,0,0,0.03)', borderRadius: 12, padding: 12, marginBottom: 8,
            border: '1px solid rgba(0,0,0,0.06)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)' }}>变体 #{idx + 1}</span>
              {skus.length > 1 && (
                <div onClick={() => rm(sku.id)}
                  style={{
                    fontSize: 11, fontWeight: 600, color: '#e74c3c', cursor: 'pointer',
                    padding: '2px 8px', borderRadius: 6,
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(231,76,60,0.1)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >删除</div>
              )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 3 }}>颜色</div>
                <input value={sku.color} onChange={e => upd(sku.id, 'color', e.target.value)}
                  placeholder="月岩白" style={{ ...sInp, height: 32 }} />
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 3 }}>规格/尺码</div>
                <input value={sku.size} onChange={e => upd(sku.id, 'size', e.target.value)}
                  placeholder="M / 100ml" style={{ ...sInp, height: 32 }} />
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 3 }}>容量/数量</div>
                <input value={sku.capacity} onChange={e => upd(sku.id, 'capacity', e.target.value)}
                  placeholder="500ml / 3件装" style={{ ...sInp, height: 32 }} />
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 3 }}>标注尺寸</div>
                <input value={sku.dimLabel} onChange={e => upd(sku.id, 'dimLabel', e.target.value)}
                  placeholder="20×10×5cm" style={{ ...sInp, height: 32 }} />
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>生成数量</span>
              <input type="number" min="1" max="10" value={sku.count}
                onChange={e => upd(sku.id, 'count', parseInt(e.target.value) || 1)}
                style={{ ...sInp, width: 48, height: 28, textAlign: 'center', fontSize: 12 }} />
              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>张</span>
            </div>
          </div>
        ))}

        <div onClick={add}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
            padding: '10px', borderRadius: 10, border: '1.5px dashed rgba(0,0,0,0.12)',
            cursor: 'pointer', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)',
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(0,0,0,0.25)'}
          onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(0,0,0,0.12)'}
        >
          <Plus size={14} /> 添加变体
        </div>

        {skus.length > 0 && (
          <div style={{ marginTop: 8, fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>
            共 {skus.length} 个变体，{skus.reduce((a, s) => a + (s.count || 1), 0)} 张 SKU 图
          </div>
        )}
      </div>
    </div>
  );
}
