import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AtSign, Check } from 'lucide-react';
import ResponsiveImage from '../ResponsiveImage.jsx';
import { buildImageMentions } from './imageMentionModel.js';
import './ImageMentionPicker.css';

function imageIdentity(image = {}) {
  return String(image.sourceNodeId || image.id || image.assetId || image.url || '');
}

export default function ImageMentionPicker({ images = [], selectedImages = [], onToggle, disabled = false, selectionMode = 'toggle' }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const available = useMemo(() => buildImageMentions(images), [images]);
  const selected = useMemo(() => buildImageMentions(selectedImages), [selectedImages]);
  const selectedIds = useMemo(() => new Set(selected.map(imageIdentity)), [selected]);
  const insertMode = selectionMode === 'insert';

  useEffect(() => {
    if (!open) return undefined;
    const close = event => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);

  return <div ref={rootRef} className="image-mention-picker" data-canvas-control="true">
    <button
      type="button"
      className={`image-mention-trigger ${open ? 'is-open' : ''}`}
      aria-label="引用图片"
      aria-expanded={open}
      disabled={disabled || !available.length}
      onPointerDown={event => event.stopPropagation()}
      onClick={event => { event.stopPropagation(); setOpen(value => !value); }}
    ><AtSign size={15} /></button>
    {open && <div className="image-mention-menu" role="menu" aria-label="引用参考图" onPointerDown={event => event.stopPropagation()}>
      <strong>引用参考图</strong>
      {available.map(image => {
        const active = selectedIds.has(imageIdentity(image));
        const selectedMention = selected.find(item => imageIdentity(item) === imageIdentity(image));
        return <button
          key={imageIdentity(image)}
          type="button"
          role={insertMode ? 'menuitem' : 'menuitemcheckbox'}
          {...(insertMode ? {} : { 'aria-checked': active })}
          onClick={event => {
            event.stopPropagation();
            onToggle?.(image);
            if (insertMode) setOpen(false);
          }}
        >
          <ResponsiveImage src={image.url} alt="" variant="thumb" ratio={image.ratio || '1:1'} style={{ width: 34, height: 34 }} imgStyle={{ objectFit: 'contain' }} />
          <span><b>{selectedMention?.label || image.name || '图片'}</b><small>{image.role === 'product' ? '产品图' : '参考图'}</small></span>
          {!insertMode && active && <Check size={15} />}
        </button>;
      })}
    </div>}
  </div>;
}
