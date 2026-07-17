import React, { useRef } from 'react';
import { Upload, X } from 'lucide-react';

/**
 * 双栏参考图上传区
 * 左侧：产品实拍图（锁定产品不畸变）
 * 右侧：竞品风格参考图（只学光影/构图，不学产品）
 */
export default function EcRefImages({ refShots, setRefShots, refStyles, setRefStyles }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
      <RefColumn
        label="📷 产品实拍图"
        sub="锁定产品主体，避免AI变形"
        images={refShots}
        onAdd={f => setRefShots(p => [...p, ...f])}
        onRemove={i => setRefShots(p => p.filter((_, j) => j !== i))}
        max={10}
        color="#2D6A4F"
      />
      <RefColumn
        label="🎨 竞品风格参考图"
        sub="只取光影/色调/构图，不学生产品"
        images={refStyles}
        onAdd={f => setRefStyles(p => [...p, ...f])}
        onRemove={i => setRefStyles(p => p.filter((_, j) => j !== i))}
        max={10}
        color="#6B21A8"
      />
    </div>
  );
}

function RefColumn({ label, sub, images, onAdd, onRemove, max, color }) {
  const fileRef = useRef(null);
  const hasImages = images.length > 0;

  return (
    <div style={{
      background: 'rgba(0,0,0,0.02)',
      borderRadius: 'var(--radius-md)',
      padding: 16,
      border: '1px solid var(--border-light)',
    }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 11, color: 'var(--text-faint)', marginBottom: 12 }}>{sub}</div>

      {!hasImages ? (
        <div onClick={() => fileRef.current?.click()}
          style={{
            border: '2px dashed var(--border)',
            borderRadius: 'var(--radius-md)',
            padding: '32px 14px',
            textAlign: 'center', cursor: 'pointer',
            transition: 'all 0.15s',
            background: 'transparent',
          }}>
          <Upload size={22} style={{ color: 'var(--text-faint)', marginBottom: 8 }} />
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-muted)' }}>点击上传</div>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {images.map((src, i) => (
            <div key={i} style={{
              position: 'relative', width: 72, height: 72,
              borderRadius: 'var(--radius-sm)', overflow: 'hidden',
              border: '1px solid var(--border)',
              flexShrink: 0,
            }}>
              <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <div onClick={() => onRemove(i)}
                style={{
                  position: 'absolute', top: 2, right: 2,
                  width: 18, height: 18, borderRadius: '50%',
                  background: color, color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', fontSize: 10,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                }}>✕</div>
            </div>
          ))}
          {images.length < max && (
            <div onClick={() => fileRef.current?.click()}
              style={{
                width: 72, height: 72,
                borderRadius: 'var(--radius-sm)',
                border: '2px dashed var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', color: 'var(--text-faint)', fontSize: 20,
                flexShrink: 0,
              }}>+</div>
          )}
        </div>
      )}
      <input ref={fileRef} type="file" accept="image/*" multiple hidden
        onChange={e => {
          const files = Array.from(e.target.files || []);
          const previews = files.map(f => URL.createObjectURL(f));
          onAdd(previews);
          e.target.value = '';
        }} />
      {hasImages && (
        <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-faint)' }}>
          {images.length}/{max} 张
          <span onClick={() => fileRef.current?.click()}
            style={{ marginLeft: 10, color: 'var(--accent)', cursor: 'pointer', fontWeight: 500 }}>
            继续添加
          </span>
        </div>
      )}
    </div>
  );
}
