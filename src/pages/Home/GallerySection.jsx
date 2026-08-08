import React from 'react';
import { useApp } from '../../store/AppContext';
import { GALLERY } from '../../constants/data';
import ResponsiveImage from '../../components/ResponsiveImage.jsx';
import { predecodeResponsiveImage } from '../../components/responsiveImageModel.js';

/**
 * 灵感发现案例区 — 灵图风格精确对齐 V2
 * - CSS columns 实现真瀑布流（不裁切图片）
 * - 案例完整展示图文
 */
export default function GallerySection({ maxItems = 24, showHeader = true }) {
  const { dispatch } = useApp();

  return (
    <section style={{ marginTop: 60, maxWidth: 'var(--max-width-gallery)', margin: '60px auto 0', paddingInline: 20 }}>
      {showHeader && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 900, color: '#c9482b', letterSpacing: 0.3, marginBottom: 4 }}>
              精选案例
            </div>
            <h2 style={{ fontSize: 28, fontWeight: 900, color: 'var(--accent)', lineHeight: 1.1 }}>
              灵感发现
            </h2>
          </div>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>
            {GALLERY.length} 个案例
          </span>
        </div>
      )}

      {/* CSS Columns 真瀑布流 — 自适应图片高宽，不裁切 */}
      <style>{`
        .gallery-masonry {
          column-count: 2;
          column-gap: 12px;
        }
        .gallery-masonry > .gallery-card {
          break-inside: avoid;
          margin-bottom: 12px;
        }
        @media (min-width: 768px) { .gallery-masonry { column-count: 3; } }
        @media (min-width: 1280px) { .gallery-masonry { column-count: 4; } }
      `}</style>
      <div className="gallery-masonry">
        {GALLERY.slice(0, maxItems).map((g) => (
          <div key={g.id} className="gallery-card"
            tabIndex={0}
            role="button"
            aria-label={`查看案例：${g.title}`}
            onClick={() => dispatch({
              type: 'VIEW_GALLERY_ITEM',
              item: { ...g, body_text: g.body, hashtags: g.tags, category: g.cat, _inputText: g.hint, _galleryItem: true }
            })}
            onKeyDown={event => {
              if (event.key !== 'Enter' && event.key !== ' ') return;
              event.preventDefault();
              event.currentTarget.click();
            }}
            style={{ borderRadius: 16, overflow: 'hidden', cursor: 'pointer', transition: 'transform 0.3s' }}
            onMouseEnter={e => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              void predecodeResponsiveImage(g.cover_url, 'display').catch(() => {});
            }}
            onFocus={() => { void predecodeResponsiveImage(g.cover_url, 'display').catch(() => {}); }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'none'; }}>
            {g.cover_url ? (
              <div style={{ position: 'relative', lineHeight: 0 }}>
                <ResponsiveImage src={g.cover_url} alt={g.title} variant="thumb" ratio="3:4"
                  sizes="(min-width: 1280px) 25vw, (min-width: 768px) 34vw, 50vw"
                  style={{ width: '100%', transition: 'transform 0.3s' }}
                  imgStyle={{ height: 'auto', objectFit: 'cover' }}
                  className="gallery-img-scale" />
                {/* Gradient overlay */}
                <div style={{ position: 'absolute', insetInline: 0, bottom: 0, height: 96, background: 'linear-gradient(to top, rgba(0,0,0,0.72), transparent)', pointerEvents: 'none' }} />
                {/* Title */}
                <div style={{
                  position: 'absolute', bottom: 14, left: 14, right: 14,
                  fontSize: 13, fontWeight: 600, color: '#fff', lineHeight: 1.3,
                  display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                  textShadow: '0 1px 3px rgba(0,0,0,0.3)',
                }}>
                  {g.title}
                </div>
              </div>
            ) : (
              <div style={{ width: '100%', aspectRatio: '3/4', background: g.grad || 'var(--accent-bg)', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: 'var(--text-muted)', padding: 16, textAlign: 'center' }}>
                {g.title}
              </div>
            )}
          </div>
        ))}
      </div>

      <style>{`.gallery-card:hover .gallery-img-scale { transform: scale(1.05); }`}</style>
    </section>
  );
}
