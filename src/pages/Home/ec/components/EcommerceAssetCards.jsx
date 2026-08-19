import React from 'react';
import { ImagePlus, X } from 'lucide-react';
import ResponsiveImage from '../../../../components/ResponsiveImage.jsx';

export function EcommerceImageCard({ role, image, label, index, onRemove }) {
  return (
    <div className={`ec-xhs-upload-card ec-xhs-image-card ec-xhs-card-${role}`}>
      <ResponsiveImage src={image.url} variant="thumb" ratio="4:5" alt={label} style={{ width: '100%', height: '100%', background: '#fff' }} imgStyle={{ objectFit: 'cover' }} />
      <span className="ec-xhs-card-caption">{label}</span>
      {image.status && <span className="ec-xhs-card-status">{image.status}</span>}
      {!image.locked && (
        <button type="button" className="ec-xhs-card-remove" aria-label={`移除${label}`} onClick={() => onRemove(index)}>
          <X size={10} />
        </button>
      )}
    </div>
  );
}

export function EcommerceAddCard({ role, label, meta, onClick, title, optional = false }) {
  return (
    <button type="button" className={`ec-xhs-upload-card ec-xhs-add-card ec-xhs-card-${role}`} onClick={onClick} title={title}>
      <span className="ec-xhs-add-icon"><ImagePlus size={20} /></span>
      {optional && <span className="ec-xhs-optional">可选</span>}
      <span className="ec-xhs-card-title">{label}</span>
      <span className="ec-xhs-card-meta">{meta}</span>
    </button>
  );
}
