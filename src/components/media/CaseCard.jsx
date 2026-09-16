import React, { useEffect, useRef, useState } from 'react';
import { ChevronRight, Play } from 'lucide-react';

/* ═══ CaseCard：案例卡（图片板块与视频板块共用，唯一实现）═════════════════════════
   2026-09-16 用 CDP 直连浏览器实访竞品（已登录态）扒到的**卡片真实结构**，逐条照抄：
     · 卡片 = 4:3 圆角 16、白底、1px 细边、柔和投影；hover 上浮 2px + 阴影加深
     · **封面铺满整张卡**（不是"图在上面、文字在下面"的两段式）
     · 封面之上压一层**自下而上的白色渐变**（他们写的是 from-white via-white/15 to-transparent，
       不是常见的那种黑色遮罩）：底部发白，字压在这层白上
     · 底部一行：标题 14px 半粗 + 副标题 11px 一行截断 + 右侧一个 › 箭头
     · 分组标题另算（见 MediaHub.css）：13px 灰色，前面一根小竖条
   所以我之前"封面 + 下面一行标题"的做法是错的 —— 标题在**卡内底部**，封面在它下面。
   视频案例：进入视口且 hover 才加载播放、静音、循环、同一时刻最多一条（成本控制）。 */
export default function CaseCard({
  title = '',
  subtitle = '',
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
