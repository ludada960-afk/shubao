import React from 'react';
import { Image as ImageIcon, Film, FileAudio, X } from 'lucide-react';

/* ═══ MediaAssetCard：素材缩略卡（图片 / 视频 / 音频 同一份实现）═══════════════════
   为什么要有它：2026-09-16 用户批注（图 #2）——
   「视频生成的样式得按我们电商生图这边的做法来，上面是素材卡、下面是提示词；
    三个上传区样式要一致」。
   在这之前，图片侧与视频侧各自手写了一套素材卡（video-media-card / 电商上传卡），
   于是同一个产品里"素材长什么样"有两个答案。
   本组件是**唯一实现**，两个板块共用；扇形叠放的数值直接取自图片侧的权威实现
   .visual-skill-stage-outputs（负外边距叠压 + 反向倾斜 + 上下错位），
   由 test/media-language-unify-0916.test.mjs 断言两边同源。
   样式一律走 --sb-* token（不许硬编码色值），见 src/styles/。 */
const KIND_ICON = { image: ImageIcon, video: Film, audio: FileAudio };

export default function MediaAssetCard({
  kind = 'image',
  src = '',
  label = '',
  status = 'ready',
  progress = 0,
  onRemove = null,
  onPreview = null,
  className = '',
}) {
  const Icon = KIND_ICON[kind] || ImageIcon;
  const uploading = status === 'uploading';
  const failed = status === 'error';
  const percent = Math.max(0, Math.min(100, Number(progress) || 0));
  return (
    <article className={['media-asset-card', 'is-' + kind, className].filter(Boolean).join(' ')} data-status={status}>
      <button
        type="button"
        className="media-asset-card-body"
        onClick={() => onPreview?.()}
        aria-label={label ? label + '（点击预览）' : '预览素材'}
      >
        {kind === 'image' && src ? <img src={src} alt={label} loading="lazy" /> : null}
        {kind === 'video' && src ? <video src={src} muted preload="metadata" playsInline /> : null}
        {(!src || kind === 'audio') && <span className="media-asset-card-glyph"><Icon size={22} /></span>}
        {uploading && (
          <span className="media-asset-card-progress" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
            <i><b style={{ width: percent + '%' }} /></i>
            <small>上传中 {percent}%</small>
          </span>
        )}
        {failed && <span className="media-asset-card-failed">上传失败，点击重试</span>}
      </button>
      {label && <span className="media-asset-card-caption">{label}</span>}
      {onRemove && (
        <button type="button" className="media-asset-card-remove" aria-label={'移除' + (label || '素材')} onClick={() => onRemove()}>
          <X size={13} />
        </button>
      )}
    </article>
  );
}
