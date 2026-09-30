import React from 'react';
import { FileAudio, Film, ImagePlus, X } from 'lucide-react';
import ResponsiveImage from '../../../../components/ResponsiveImage.jsx';

/* ═══ 批 CY-㉜：状态角标**不許**把内部枚举原样渲染出来 ═══════════════════════════════════
   用户 2026-09-30 逐字（首尾帧那张图）：
     「然后你这里为什么会显示一个英文呢？这又是什么 bug 呀？」

   根因就在下面那一行：`<span className="ec-xhs-card-status">{image.status}</span>`
   —— 直接渲染 `image.status` 的**原始字符串**。而调用方传的是内部枚举：
     · VideoStudio/index.jsx:1958  mediaCardStatus() 返回 `'ready' | 'uploading' | 'error'`
     · XhsContentMode.jsx:134/137  传的是 `'loaded'`
   两个都是**代码内部用的词**，不是给用户看的文案。
   ⇒ 改成查表映射；**查不到就整个不渲染**（宁可没有角标，也不要漏一个英文单词给用户）。 */
export const STATUS_LABEL = Object.freeze({
  ready: '就绪',
  loaded: '就绪',
  done: '就绪',
  ok: '就绪',
  uploading: '上传中',
  loading: '上传中',
  pending: '等待中',
  queued: '排队中',
  error: '上传失败',
  failed: '上传失败',
  processing: '处理中',
});

export function EcommerceImageCard({ role, image, label, index, onRemove }) {
  const statusLabel = STATUS_LABEL[String(image?.status || '').toLowerCase()] || '';
  return (
    <div className={`ec-xhs-upload-card ec-xhs-image-card ec-xhs-card-${role}`}>
      <ResponsiveImage src={image.url} variant="thumb" ratio="4:5" alt={label} style={{ width: '100%', height: '100%', background: 'var(--sb-neutral-0)' }} imgStyle={{ objectFit: 'cover' }} />
      <span className="ec-xhs-card-caption">{label}</span>
      {statusLabel && <span className="ec-xhs-card-status">{statusLabel}</span>}
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
