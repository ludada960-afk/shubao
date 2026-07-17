import React, { useState, useEffect } from 'react';
import { Plus, Trash2 } from 'lucide-react';

/**
 * SKU 多变体配置（保留昨天重构结果）
 * 每个变体：颜色 / 规格 / 尺寸 / 数量 / 标注
 */
export default function EcSkuPanel({ skus, onChange }) {
  // 默认展示 1 组变体，降低用户感知门槛
  useEffect(() => {
    if (skus.length === 0) {
      onChange([{ id: Date.now(), color: '', spec: '', size: '', count: 1, label: '' }]);
    }
  }, []);

  const addSku = () => {
    onChange([...skus, {
      id: Date.now(),
      color: '', spec: '', size: '', count: 1,
      label: '',
    }]);
  };

  const updateSku = (id, key, val) => {
    onChange(skus.map(s => s.id === id ? { ...s, [key]: val } : s));
  };

  const removeSku = (id) => {
    onChange(skus.filter(s => s.id !== id));
  };

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10, lineHeight: 1.6 }}>
          每个变体对应一张 SKU 规格图，支持多维度组合（颜色 × 规格 × 尺寸）
        </div>

        {skus.length === 0 ? (
          <div onClick={addSku}
            style={{
              border: '2px dashed var(--border)',
              borderRadius: 'var(--radius-md)',
              padding: '24px 14px',
              textAlign: 'center', cursor: 'pointer',
              fontSize: 13, color: 'var(--text-faint)',
            }}>
            <Plus size={18} style={{ margin: '0 auto 6px', display: 'block' }} />
            添加变体
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {skus.map(sku => (
              <div key={sku.id}
                style={{
                  background: 'rgba(0,0,0,0.02)',
                  borderRadius: 'var(--radius-sm)',
                  padding: 12,
                  border: '1px solid var(--border-light)',
                }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
                  <SkuField value={sku.color} onChange={v => updateSku(sku.id, 'color', v)} placeholder="颜色" />
                  <SkuField value={sku.spec} onChange={v => updateSku(sku.id, 'spec', v)} placeholder="规格" />
                  <SkuField value={sku.size} onChange={v => updateSku(sku.id, 'size', v)} placeholder="尺寸" />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input value={sku.label || ''}
                    onChange={e => updateSku(sku.id, 'label', e.target.value)}
                    placeholder="标注（选填，如“经典款”）"
                    style={{
                      flex: 1, padding: '6px 10px', border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-sm)', fontSize: 12, background: '#fff',
                      color: 'var(--text-primary)', outline: 'none',
                    }}
                  />
                  <span style={{ fontSize: 12, color: 'var(--text-faint)', whiteSpace: 'nowrap' }}>
                    ×
                    <input type="number" min="1" value={sku.count}
                      onChange={e => updateSku(sku.id, 'count', parseInt(e.target.value) || 1)}
                      style={{
                        width: 40, padding: '4px 4px', marginLeft: 4,
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-sm)', fontSize: 12, textAlign: 'center',
                        color: 'var(--text-primary)', outline: 'none',
                      }} />
                  </span>
                  <div onClick={() => removeSku(sku.id)}
                    style={{
                      width: 26, height: 26, borderRadius: '50%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer', color: 'var(--text-faint)',
                      transition: 'all 0.12s',
                    }}>
                    <Trash2 size={13} />
                  </div>
                </div>
              </div>
            ))}
            <div onClick={addSku}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                padding: '10px', borderRadius: 'var(--radius-sm)',
                border: '1px dashed var(--border)', cursor: 'pointer',
                fontSize: 13, color: 'var(--text-muted)', transition: 'all 0.12s',
              }}>
              <Plus size={14} /> 添加变体
            </div>
          </div>
        )}
      </div>
      {skus.length > 0 && (
        <div style={{ fontSize: 11, color: 'var(--text-faint)', padding: '6px 0' }}>
          共 {skus.length} 个变体，预计生成 {skus.reduce((a, s) => a + s.count, 0)} 张 SKU 图
        </div>
      )}
    </div>
  );
}

function SkuField({ value, onChange, placeholder }) {
  return (
    <input value={value} onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        padding: '7px 10px', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-sm)', fontSize: 12, background: '#fff',
        color: 'var(--text-primary)', outline: 'none', width: '100%',
      }} />
  );
}
