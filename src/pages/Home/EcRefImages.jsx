import React, { useRef } from 'react';
import { Upload } from 'lucide-react';
import { MdClose } from 'react-icons/md';

/**
 * 双栏参考图上传区 — 精修工坊内
 */
export default function EcRefImages({ refShots, setRefShots, refStyles, setRefStyles }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
      <RefColumn
        label="📷 商品实拍图"
        sub="把产品实物照片传上来，AI 照着你的产品画，不会跑偏变形"
        images={refShots}
        onAdd={f => setRefShots(p => [...p, ...f])}
        onRemove={i => setRefShots(p => p.filter((_, j) => j !== i))}
        max={10}
        color="#2D6A4F"
      />
      <RefColumn
        label="🎨 参考风格图"
        sub="传一张你喜欢的风格图、竞品图，AI 学习它的光影和氛围，但保留你的产品"
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
      background: 'rgba(12,10,9,0.02)',
      borderRadius: 'var(--sb-radius-xl)',
      padding: 16,
      border: '1px solid var(--sb-border-subtle)',
    }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--sb-ink-1)', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 11, color: 'var(--sb-ink-5)', marginBottom: 12 }}>{sub}</div>

      {!hasImages ? (
        <button type="button" onClick={() => fileRef.current?.click()}
          style={{
            appearance:'none', margin:0, padding:0, font:'inherit', display:'block', textAlign:'inherit', boxSizing:'content-box', border:'none', background:'none', outline:'none',padding:0, font:'inherit', display:'block', textAlign:'inherit', boxSizing:'content-box', border:'none', background:'none', outline:'none',
            display: 'block', width: '100%',
            border: '2px dashed var(--sb-border-default)',
            borderRadius: 'var(--sb-radius-xl)',
            padding: '32px 14px',
            textAlign: 'center', cursor: 'pointer',
            transition: 'all 0.15s',
            background: 'transparent',
          }}
          onFocus={e => { e.currentTarget.style.boxShadow = 'var(--sb-focus-ring)'; }}
          onBlur={e => { e.currentTarget.style.boxShadow = 'none'; }}>
          <Upload size={22} style={{ color: 'var(--sb-ink-5)', marginBottom: 8 }} />
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--sb-ink-3)' }}>点击上传</div>
          <div style={{ fontSize: 11, color: 'var(--sb-ink-5)', marginTop: 6, lineHeight: 1.6, whiteSpace: 'pre-line' }}>
            {color === '#2D6A4F'
              ? '正面照、侧面45°、细节特写都很有用\n1 张正面照也能出图，越清晰效果越好'
              : '光影、色调、构图的参考 — 竞品好图或杂志风\nAI 会学习氛围但保留你的产品'}
          </div>
        </button>
      ) : (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {images.map((src, i) => (
            <div key={i} style={{
              position: 'relative', width: 72, height: 72,
              borderRadius: 'var(--sb-radius-md)', overflow: 'hidden',
              border: '1px solid var(--sb-border-default)',
              flexShrink: 0,
            }}>
              <img
                src={src}
                alt=""
                width="80"
                height="80"
                loading="lazy"
                decoding="async"
                fetchpriority="auto"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <button type="button" aria-label="移除这张参考图" onClick={() => onRemove(i)}
                style={{
                  appearance:'none', margin:0, padding:0, font:'inherit', display:'block', textAlign:'inherit', boxSizing:'content-box', border:'none', background:'none', outline:'none',padding: 0, font: 'inherit', boxSizing: 'border-box', border: 'none', outline: 'none',
                  position: 'absolute', top: 2, right: 2,
                  width: 18, height: 18, borderRadius: '50%',
                  background: color, color: 'var(--sb-neutral-0)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', fontSize: 10,
                  boxShadow: '0 1px 3px rgba(12,10,9,0.3)',
                }}
                onFocus={e => { e.currentTarget.style.boxShadow = 'var(--sb-focus-ring)'; }}
                onBlur={e => { e.currentTarget.style.boxShadow = '0 1px 3px rgba(12,10,9,0.3)'; }}>✕</button>
            </div>
          ))}
          {images.length < max && (
            <button type="button" aria-label="继续添加参考图" onClick={() => fileRef.current?.click()}
              style={{
                /* 显式尺寸 + 边框：保持 content-box，否则 72+2px 边框会缩成 72（实测少 4px）。 */
                appearance:'none', margin:0, padding:0, font:'inherit', display:'block', textAlign:'inherit', boxSizing:'content-box', border:'none', background:'none', outline:'none',padding:0, font:'inherit', display:'block', textAlign:'inherit', boxSizing:'content-box', border:'none', background:'none', outline:'none',
                width: 72, height: 72,
                borderRadius: 'var(--sb-radius-md)',
                border: '2px dashed var(--sb-border-default)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', color: 'var(--sb-ink-5)', fontSize: 20,
                flexShrink: 0,
              }}>+</button>
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
        <div style={{ marginTop: 8, fontSize: 11, color: 'var(--sb-ink-5)' }}>
          {images.length}/{max} 张
          <button type="button" className="a11y-reset" onClick={() => fileRef.current?.click()}
            style={{ marginLeft: 10, color: 'var(--sb-surface-inverse)', cursor: 'pointer', fontWeight: 500 }}>
            继续添加
          </button>
        </div>
      )}
    </div>
  );
}
