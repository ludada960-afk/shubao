import React, { useEffect, useRef, useState } from 'react';
import { Play } from 'lucide-react';

/* ═══ CaseCard：案例卡（图片板块与视频板块共用）══════════════════════════════════
   来源：docs/design/43-media-architecture.md §4.2 与 §10.3（知渔实测）。
   实测结论：他们的案例墙 = **统一 4:3 封面 + 标题**，分组标题分隔；卡片上不放别的元素。
   用户批注（图 #7/#8）：案例卡要能"极快了解这个案例长什么样"，视频案例 hover 时
   真的动起来（他们做成 hover 出现「试一试」+ 案例窗）；点击即复用。
   成本控制（用户问过）：视频预览**进入视口且 hover 才加载**、静音、循环、
   preload=metadata，且全局同一时刻最多一条在播 —— 47 张封面 + 若干视频也不会拖慢首屏。
   本组件是案例卡的**唯一实现**，两个板块共用；样式数值不许各写一套。 */
export default function CaseCard({
  title = '',
  cover = '',
  video = '',
  badge = '',
  onOpen = null,
  className = '',
}) {
  const articleRef = useRef(null);
  const videoRef = useRef(null);
  const [inView, setInView] = useState(false);
  const [hovering, setHovering] = useState(false);

  useEffect(() => {
    const node = articleRef.current;
    if (!node || !video) return undefined;
    if (typeof IntersectionObserver !== 'function') { setInView(true); return undefined; }
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => { if (entry.isIntersecting) setInView(true); });
    }, { rootMargin: '120px' });
    observer.observe(node);
    return () => observer.disconnect();
  }, [video]);

  const shouldPlay = Boolean(video) && inView && hovering;
  useEffect(() => {
    const node = videoRef.current;
    if (!node) return;
    if (shouldPlay) {
      /* 同一时刻只留一条在播：开播前把其它案例卡上的预览全部暂停 */
      document.querySelectorAll('video[data-case-preview]').forEach(other => {
        if (other !== node) other.pause();
      });
      const played = node.play();
      if (played?.catch) played.catch(() => {});
    } else {
      node.pause();
      try { node.currentTime = 0; } catch { /* 元数据未就绪时忽略 */ }
    }
  }, [shouldPlay]);

  return (
    <article
      ref={articleRef}
      className={['media-case-card', className].filter(Boolean).join(' ')}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      <button type="button" className="media-case-card-hit" onClick={() => onOpen?.()} aria-label={title ? title + '（查看案例）' : '查看案例'}>
        <span className="media-case-card-cover">
          {video && shouldPlay
            ? <video ref={videoRef} data-case-preview src={video} muted loop playsInline preload="metadata" />
            : (cover ? <img src={cover} alt={title} loading="lazy" /> : <span className="media-case-card-blank" />)}
          {video && !shouldPlay && <span className="media-case-card-play" aria-hidden="true"><Play size={16} /></span>}
        </span>
        <span className="media-case-card-title">{title}</span>
        {badge && <span className="media-case-card-badge">{badge}</span>}
      </button>
    </article>
  );
}
