import React from 'react';
import { FileAudio, Film, ImagePlus, X } from 'lucide-react';
import ResponsiveImage from '../../../../components/ResponsiveImage.jsx';

export function EcommerceImageCard({ role, image, label, index, onRemove }) {
  return (
    <div className={`ec-xhs-upload-card ec-xhs-image-card ec-xhs-card-${role}`}>
      <ResponsiveImage src={image.url} variant="thumb" ratio="4:5" alt={label} style={{ width: '100%', height: '100%', background: 'var(--sb-neutral-0)' }} imgStyle={{ objectFit: 'cover' }} />
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

/* kind：素材种类（image / video / audio）。默认 image 保持既有调用点一字不改。
   2026-09-18 加它的原因：视频创作台的三张上传卡要求「样式从图片侧复制」——
   口径是**同一份实现**，不是再抄一份 CSS。所以视频侧直接复用本组件，
   只换图标（图形以外的每一个值都来自 Home.css 的 .ec-xhs-upload-card）。 */
const ADD_ICON = { image: ImagePlus, video: Film, audio: FileAudio };

export function EcommerceAddCard({ role, label, meta, onClick, title, optional = false, kind = 'image' }) {
  const Icon = ADD_ICON[kind] || ImagePlus;
  return (
    <button type="button" className={`ec-xhs-upload-card ec-xhs-add-card ec-xhs-card-${role}`} data-kind={kind} onClick={onClick} title={title}>
      <span className="ec-xhs-add-icon"><Icon size={20} /></span>
      {optional && <span className="ec-xhs-optional">可选</span>}
      <span className="ec-xhs-card-title">{label}</span>
      <span className="ec-xhs-card-meta">{meta}</span>
    </button>
  );
}
