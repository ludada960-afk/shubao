import React, { useEffect, useRef, useState } from 'react';
import { ChevronRight, Play } from 'lucide-react';

/* ═══ CaseCard：案例卡（图片板块与视频板块共用，唯一实现）═════════════════════════
   2026-09-16/17 用 CDP 直连竞品（已登录态）扒到的**卡片真实结构**，逐条照抄机制：
     · 卡片 = 4:3 圆角 16、白底、1px 细边、柔和投影；hover 上浮 2px + 阴影加深
     · **封面铺满整张卡**（不是"图在上面、文字在下面"的两段式）
     · 封面之上压一层**自下而上的白色渐变**（他们写的是 from-white，不是黑遮罩）
     · 底部一行：标题 14px 半粗 + 副标题 11px 一行截断 + 右侧一个 › 箭头
     · **封面可以是视频**：他们的卡片直接放 <video>（autoplay/loop/muted/playsinline/preload=metadata），
       所以视频板块的卡是"真的在播"的（他们的原话：这些视频有在播放的）。
   我们与他们的差别只有一处、且是**更省**的做法：
     他们 autoplay 全部卡片（含屏幕外的）；我们**只在卡片进入视口时播放、离开视口立刻暂停**。
     观感一样（在看的都在动），但屏幕外的不会偷跑流量与解码。
     另外尊重 prefers-reduced-motion：不开自动播放，只在 hover 时播。
   图片卡与视频卡**同一份实现**，差别只有传不传 video。 */

const REDUCED_MOTION = () => typeof globalThis.matchMedia === 'function' && globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches;

export default function CaseCard({
  title = '',
  subtitle = '',
  cover = '',
  video = '',
  poster = '',
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
      entries.forEach(entry => setInView(entry.isIntersecting));
    }, { rootMargin: '120px' });
    observer.observe(node);
    return () => observer.disconnect();
  }, [video]);

  /* 进入视口就播、离开就停；hover 时一定在播。减少动效偏好下只 hover 播。 */
  const shouldPlay = Boolean(video) && inView && (hovering || !REDUCED_MOTION());

  useEffect(() => {
    const node = videoRef.current;
    if (!node) return;
    if (shouldPlay) {
      /* 同一时刻只留一条在播（防止几十条视频一起占带宽与解码） */
      document.querySelectorAll('video[data-case-preview]').forEach(other => {
        if (other !== node) other.pause();
      });
      const played = node.play();
      if (played?.catch) played.catch(() => {});
    } else {
      node.pause();
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
          {video
            ? <video
                ref={videoRef}
                data-case-preview
                src={video}
                poster={poster || cover || undefined}
                /* 门禁逐字断言这一串：静音 + 循环 + 内联播放 + 只取元数据（不整包下载） */
                muted loop playsInline preload="metadata"
              />
            : (cover ? <img src={cover} alt={title} loading="lazy" /> : <span className="media-case-card-blank" />)}
          {video && !shouldPlay && <span className="media-case-card-play" aria-hidden="true"><Play size={16} /></span>}
        </span>
        {/* 自下而上的白色渐变：标题压在它上面才读得清（实测同款） */}
        <span className="media-case-card-veil" aria-hidden="true" />
        {badge && <span className="media-case-card-badge">{badge}</span>}
        <span className="media-case-card-caption">
          <span className="media-case-card-titles">
            <span className="media-case-card-title">{title}</span>
            {subtitle && <span className="media-case-card-subtitle">{subtitle}</span>}
          </span>
          <span className="media-case-card-arrow" aria-hidden="true"><ChevronRight size={14} /></span>
        </span>
      </button>
    </article>
  );
}
