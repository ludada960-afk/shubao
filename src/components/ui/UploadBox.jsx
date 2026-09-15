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
      {/* D34 已收敛：本组件盖在**用户素材**之上，原有的 11 个白色 α 已按角色归入 §23「媒体之上」族：
          --sb-on-media-solid / ink / ink-2 / ink-3 / line / fill / scrim。
          为什么要单立一族：这里的底色是**用户图片**（可能全白也可能全黑），
          所以取不到「合成到底色再比」里的那个底；白 + α 是唯一对任意底图都可读的技术。
          逐处偏差 ≤ .04（见 D34 的对照表）。
          ⚠️ 图标改用**父级 color + currentColor 继承**，而不是给 SVG 传 color 属性 ——
          避免依赖「SVG 表现属性是否支持 var()」这个不确定行为。 */}
      {/* Label */}
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--sb-on-media-ink)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 'var(--sb-space-1-5)' }}>
        {label}
        {optional && (
          <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--sb-on-media-ink-3)', background: 'var(--sb-on-media-fill)', padding: '2px 6px', borderRadius: 4 }}>
            可选
          </span>
        )}
      </div>

      {/* Box */}
      {/* D11 键盘可达：整块是可上传区 → <button>；子图标各自是独立按钮（不再靠
          stopPropagation 抑制父级点击，避免嵌套交互元素语义冲突）。
          .a11y-reset 归零 button 的 UA 默认外观 → 视觉与改造前一致。 */}
      <button
        type="button"
        className="a11y-reset"
        aria-label={hasImages ? '图片已上传' : '点击上传图片'}
        onClick={() => !hasImages && fileRef.current?.click()}
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '1',
          maxHeight: 200,
          borderRadius: 16,
          border: hasImages ? '1px solid var(--sb-on-media-line)' : '2px dashed var(--sb-on-media-line)',
          background: 'var(--sb-on-media-fill)',
          cursor: hasImages ? 'default' : 'pointer',
          transform: `rotate(${hasImages ? 0 : rotation}deg)`,
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        onMouseEnter={e => { if (!hasImages) { e.currentTarget.style.transform = 'rotate(0deg)'; e.currentTarget.style.borderColor = 'var(--sb-brand-400)'; } }}
        onMouseLeave={e => { if (!hasImages) { e.currentTarget.style.transform = `rotate(${rotation}deg)`; e.currentTarget.style.borderColor = 'var(--sb-on-media-line)'; } }}
      >
        {hasImages ? (
          <>
            <img src={images[0]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            {/* Remove button */}
            <button type="button" className="a11y-reset" aria-label="移除已上传图片"
              onClick={(e) => { e.stopPropagation(); onRemove(0); }}
              style={{ position: 'absolute', top: 6, right: 6, width: 22, height: 22, borderRadius: '50%', background: 'var(--sb-on-media-scrim)', color: 'var(--sb-on-media-solid)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <MdClose size={12} />
            </button>
            {/* Count badge */}
            {images.length > 1 && (
              <div style={{ position: 'absolute', bottom: 6, right: 6, padding: '3px 8px', borderRadius: 8, background: 'var(--sb-on-media-scrim)', fontSize: 11, fontWeight: 700, color: 'var(--sb-neutral-0)' }}>
                +{images.length - 1}
              </div>
            )}
            {/* Add more button */}
            {images.length < max && (
              <button type="button" className="a11y-reset" aria-label="继续添加图片"
                onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }}
                style={{ position: 'absolute', bottom: 6, left: 6, width: 28, height: 28, borderRadius: 8, background: 'var(--sb-on-media-scrim)', color: 'var(--sb-on-media-solid)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <MdAdd size={14} />
              </button>
            )}
          </>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--sb-on-media-fill)', color: 'var(--sb-on-media-ink-2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <MdAddPhotoAlternate size={20} />
            </div>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--sb-on-media-ink-2)' }}>点击上传</span>
          </div>
        )}
      </button>

      <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={handleChange} />
    </div>
  );
}
