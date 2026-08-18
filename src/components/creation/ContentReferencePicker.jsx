import { useRef } from 'react';
import { ImagePlus, Palette, Sparkles, X } from 'lucide-react';
import './ContentReferencePicker.css';

function imageUrl(image) {
  if (typeof image === 'string') return image;
  return String(image?.previewUrl || image?.url || image?.data || '').trim();
}

function ReferenceSlot({ role, images, max, label, hint, icon: Icon, onAdd, onRemove }) {
  const inputRef = useRef(null);
  const count = Array.isArray(images) ? images.length : 0;
  const acceptFiles = files => {
    const selected = Array.from(files || []).filter(file => file?.type?.startsWith('image/'));
    if (selected.length) onAdd?.(role, selected.slice(0, Math.max(0, max - count)));
  };
  return (
    <section className={`content-reference-slot content-reference-slot-${role}`} aria-label={label}>
      <div className="content-reference-slot-head">
        <span className="content-reference-slot-title"><Icon size={15} strokeWidth={1.9} />{label}</span>
        <span className="content-reference-slot-count">{count}/{max}</span>
      </div>
      <div
        className="content-reference-rail"
        onDragOver={event => event.preventDefault()}
        onDrop={event => { event.preventDefault(); acceptFiles(event.dataTransfer?.files); }}
      >
        {images.map((image, index) => {
          const url = imageUrl(image);
          return (
            <div className="content-reference-thumb" key={`${role}-${index}-${url.slice(0, 24)}`}>
              <img src={url} alt={`${label}${index + 1}`} />
              <button type="button" aria-label={`删除${label}${index + 1}`} onClick={() => onRemove?.(role, index)}>
                <X size={12} />
              </button>
            </div>
          );
        })}
        {count < max && (
          <button type="button" className="content-reference-add" onClick={() => inputRef.current?.click()}>
            <ImagePlus size={17} />
            <span>加图</span>
          </button>
        )}
      </div>
      <p className="content-reference-slot-hint">{hint}</p>
      <input ref={inputRef} type="file" accept="image/*" multiple hidden onChange={event => { acceptFiles(event.target.files); event.target.value = ''; }} />
    </section>
  );
}
export default function ContentReferencePicker({
  styleImages = [],
  sourceImages = [],
  onAdd,
  onRemove,
  compact = false,
  styleMax = 3,
  sourceMax = 6,
}) {
  return (
    <div className={`content-reference-picker${compact ? ' is-compact' : ''}`}>
      <div className="content-reference-picker-intro">
        <div><strong>参考素材</strong><span>按用途上传，生成时会分别处理</span></div>
        <Sparkles size={15} aria-hidden="true" />
      </div>
      <div className="content-reference-picker-grid">
        <ReferenceSlot
          role="style"
          images={styleImages}
          max={styleMax}
          label="风格参考"
          hint="借鉴色调、光线、构图和材质，不复制图中主体"
          icon={Palette}
          onAdd={onAdd}
          onRemove={onRemove}
        />
        <ReferenceSlot
          role="source"
          images={sourceImages}
          max={sourceMax}
          label={compact ? '我的素材' : '生活素材'}
          hint="保留你上传的人、物、空间或生活细节"
          icon={ImagePlus}
          onAdd={onAdd}
          onRemove={onRemove}
        />
      </div>
    </div>
  );
}
