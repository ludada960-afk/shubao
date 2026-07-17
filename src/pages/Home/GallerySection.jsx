import React from 'react';
import { useApp } from '../../store/AppContext';
import { GALLERY } from '../../constants/data';
import { proxyImg } from '../../services/api';

/**
 * 灵感发现案例区 — 灵图风格瀑布流（grid-auto-rows）
 * 保留原有案例内容，视觉层完全对齐灵图
 */
export default function GallerySection({ maxItems = 18, showHeader = true }) {
  const { state, dispatch } = useApp();

  return (
    <section style={{
      marginTop: 60, paddingBottom: 20,
      maxWidth: 'var(--max-width-content)', margin: '60px auto 0', paddingInline: 0,
    }}>
      {showHeader && (
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
          marginBottom: 20,
        }}>
          <div>
            <div style={{
              fontSize: 13, fontWeight: 900,
              color: '#c9482b', letterSpacing: 0.3,
              marginBottom: 2,
            }}>
              精选案例
            </div>
            <h2 style={{
              fontSize: 28, fontWeight: 900,
              color: 'var(--accent)', lineHeight: 1.1,
            }}>
              灵感发现
            </h2>
          </div>
          <span style={{
            fontSize: 13, fontWeight: 600, color: 'var(--text-muted)',
            cursor: 'default',
          }}>
            {GALLERY.length} 个案例
          </span>
        </div>
      )}

      {/* Masonry-like grid using grid-auto-rows */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
        gap: 12,
      }}>
        {GALLERY.slice(0, maxItems).map((g, idx) => {
          // Varying spans based on index for masonry effect
          const spanRows = [4, 3, 3, 3, 4, 4, 4, 3, 4, 4, 2, 2, 4, 4, 3, 3, 3, 1][idx % 18] || 3;

          return (
            <div key={g.id}
              onClick={() => dispatch({
                type: 'SET_RESULT',
                result: {
                  ...g, body_text: g.body, hashtags: g.tags,
                  category: g.cat, _inputText: g.hint, _galleryItem: true
                }
              })}
              style={{
                borderRadius: 16, overflow: 'hidden', cursor: 'pointer',
                transition: 'transform 0.3s, box-shadow 0.3s',
              }}
              className="gallery-card-hover"
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'none'; }}>
              {g.cover_url ? (
                <div style={{ position: 'relative', lineHeight: 0 }}>
                  <img
                    src={proxyImg(g.cover_url)}
                    alt={g.title}
                    loading="lazy"
                    decoding="async"
                    style={{
                      width: '100%', height: 'auto', display: 'block',
                      transition: 'transform 0.3s',
                    }}
                    className="gallery-img-scale"
                  />
                  {/* Gradient overlay + title */}
                  <div style={{
                    position: 'absolute', insetInline: 0, bottom: 0,
                    height: 96,
                    background: 'linear-gradient(to top, rgba(0,0,0,0.72), transparent)',
                    pointerEvents: 'none',
                  }} />
                  <div style={{
                    position: 'absolute', bottom: 12, left: 14, right: 14,
                    fontSize: 13, fontWeight: 700,
                    color: '#fff', lineHeight: 1.3,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                    textShadow: '0 1px 3px rgba(0,0,0,0.3)',
                  }}>
                    {g.title}
                  </div>
                </div>
              ) : (
                <div style={{
                  width: '100%', aspectRatio: '3/4',
                  background: g.grad || 'var(--accent-bg)',
                  borderRadius: 16,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, fontWeight: 700,
                  color: 'var(--text-muted)',
                  padding: 16, textAlign: 'center',
                }}>
                  {g.title}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Style for hover effects */}
      <style>{`
        .gallery-card-hover:hover .gallery-img-scale {
          transform: scale(1.05);
        }
      `}</style>
    </section>
  );
}
