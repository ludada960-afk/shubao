import React, { useRef } from 'react';
import { MdAdd, MdClose, MdAddPhotoAlternate } from 'react-icons/md';

/**
 * UploadBox — tilted image upload card for the e-commerce input area.
 * Shows uploaded image or empty state with + button.
 *
 * Props:
 *   images     — array of image URLs
 *   onAdd      — callback(newUrls[])
 *   onRemove    — callback(index)
 *   label      — "产品图" | "参考图"
 *   optional   — show "可选" badge (default false)
 *   tilt       — rotation in degrees ('left' = -4, 'right' = 4)
 *   max        — max images (default 10)
 */
export default function UploadBox({ images = [], onAdd, onRemove, label, optional = false, tilt = 'left', max = 10 }) {
  const fileRef = useRef(null);
  const rotation = tilt === 'left' ? -4 : 4;
  const hasImages = images.length > 0;

  const handleChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const urls = files.slice(0, max - images.length).map(f => URL.createObjectURL(f));
    if (urls.length > 0) onAdd(urls);
    e.target.value = '';
  };

  return (
    <div style={{ position: 'relative', flex: '1 1 0', minWidth: 0 }}>
      {/* Label */}
      <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.5)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
        {label}
        {optional && (
          <span style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: 4 }}>
            可选
          </span>
        )}
      </div>

      {/* Box */}
      <div
        onClick={() => !hasImages && fileRef.current?.click()}
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '1',
          maxHeight: 200,
          borderRadius: 16,
          border: hasImages ? '1px solid rgba(255,255,255,0.1)' : '2px dashed rgba(255,255,255,0.15)',
          background: hasImages ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.02)',
          cursor: hasImages ? 'default' : 'pointer',
          transform: `rotate(${hasImages ? 0 : rotation}deg)`,
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        onMouseEnter={e => { if (!hasImages) { e.currentTarget.style.transform = 'rotate(0deg)'; e.currentTarget.style.borderColor = '#a78bfa'; } }}
        onMouseLeave={e => { if (!hasImages) { e.currentTarget.style.transform = `rotate(${rotation}deg)`; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'; } }}
      >
        {hasImages ? (
          <>
            <img src={images[0]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            {/* Remove button */}
            <div onClick={(e) => { e.stopPropagation(); onRemove(0); }}
              style={{ position: 'absolute', top: 6, right: 6, width: 22, height: 22, borderRadius: '50%', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <MdClose size={12} color="#fff" />
            </div>
            {/* Count badge */}
            {images.length > 1 && (
              <div style={{ position: 'absolute', bottom: 6, right: 6, padding: '3px 8px', borderRadius: 8, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', fontSize: 11, fontWeight: 700, color: '#fff' }}>
                +{images.length - 1}
              </div>
            )}
            {/* Add more button */}
            {images.length < max && (
              <div onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }}
                style={{ position: 'absolute', bottom: 6, left: 6, width: 28, height: 28, borderRadius: 8, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <MdAdd size={14} color="#fff" />
              </div>
            )}
          </>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <MdAddPhotoAlternate size={20} color="rgba(255,255,255,0.4)" />
            </div>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.35)' }}>点击上传</span>
          </div>
        )}
      </div>

      <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={handleChange} />
    </div>
  );
}
