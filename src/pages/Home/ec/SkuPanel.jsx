import React, { useEffect } from 'react';
import { MdAdd } from 'react-icons/md';

const sInp = {
  padding: '6px 10px', borderRadius: 8, fontSize: 12, border: '1px solid rgba(0,0,0,0.12)',
  background: '#fff', color: 'var(--text-primary)', outline: 'none', width: '100%',
  fontFamily: 'inherit',
};

export default function SkuPanel({ skus, onChange }) {
  useEffect(() => {
    if (skus.length === 0) {
      onChange([{ id: Date.now(), color: '', size: '', capacity: '', dimLabel: '', count: 1 }]);
    }
  }, []);

  const add = () => onChange([...skus, { id: Date.now(), color: '', size: '', capacity: '', dimLabel: '', count: 1 }]);
  const upd = (id, key, val) => onChange(skus.map(s => s.id === id ? { ...s, [key]: val } : s));
  const rm = (id) => onChange(skus.filter(s => s.id !== id));

  return (
    <div style={{ padding: '16px 20px 14px' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 10, letterSpacing: 0.3 }}>SKU 变体</div>
      <div style={{ maxHeight: 260, overflowY: 'auto' }}>
        {skus.map(sku => (
          <div key={sku.id} style={{
            background: 'rgba(0,0,0,0.03)', borderRadius: 10, padding: 10, marginBottom: 8,
            border: '1px solid rgba(0,0,0,0.06)',
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6, marginBottom: 6 }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 2 }}>颜色</div>
                <input value={sku.color} onChange={e => upd(sku.id, 'color', e.target.value)}
                  placeholder="月岩白" style={{ ...sInp, height: 32 }} />
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 2 }}>规格/尺码</div>
                <input value={sku.size} onChange={e => upd(sku.id, 'size', e.target.value)}
                  placeholder="M / 100ml" style={{ ...sInp, height: 32 }} />
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 2 }}>容量/数量</div>
                <input value={sku.capacity} onChange={e => upd(sku.id, 'capacity', e.target.value)}
                  placeholder="500ml / 3件装" style={{ ...sInp, height: 32 }} />
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 2 }}>标注尺寸</div>
                <input value={sku.dimLabel} onChange={e => upd(sku.id, 'dimLabel', e.target.value)}
                  placeholder="20×10×5cm" style={{ ...sInp, height: 32 }} />
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)' }}>生成数量</span>
                <input type="number" min="1" max="10" value={sku.count}
                  onChange={e => upd(sku.id, 'count', parseInt(e.target.value) || 1)}
                  style={{ ...sInp, width: 40, height: 26, textAlign: 'center', fontSize: 11 }} />
              </div>
              {skus.length > 1 && (
                <div onClick={() => rm(sku.id)}
                  style={{
                    width: 22, height: 22, borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', color: 'var(--text-faint)', fontSize: 12,
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(231,76,60,0.1)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >×</div>
              )}
            </div>
          </div>
        ))}
        <div onClick={add}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
            padding: '10px', borderRadius: 10, border: '1.5px dashed rgba(0,0,0,0.1)',
            cursor: 'pointer', fontSize: 12, color: 'var(--text-muted)',
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(0,0,0,0.2)'}
          onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(0,0,0,0.1)'}
        >
          <MdAdd size={14} /> 添加变体
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
