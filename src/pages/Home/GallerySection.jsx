import React from 'react';
import { ChevronRight } from 'lucide-react';
import { useApp } from '../../store/AppContext';
import { GALLERY } from '../../constants/data';
import { proxyImg } from '../../services/api';

/**
 * 底部灵感案例展示（小红书/电商共用同一套）
 */
export default function GallerySection({ maxItems = 18, showHeader = true }) {
  const { state, dispatch } = useApp();

  return (
    <section style={{ maxWidth: 'var(--max-width)', margin: '48px auto 0', padding: '0 32px' }}>
      {showHeader && (
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
          marginBottom: 20,
        }}>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-faint)', marginBottom: 4, fontWeight: 500 }}>
              精选案例
            </div>
            <h2 style={{ fontSize: 30, fontWeight: 900, color: 'var(--text-primary)' }}>灵感发现</h2>
          </div>
          <span style={{ fontSize: 12, color: 'var(--text-faint)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 2 }}
            onClick={() => dispatch({ type: 'NAVIGATE', page: 'gallery' })}>
            全部作品 <ChevronRight size={12} />
          </span>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 14 }}>
        {GALLERY.slice(0, maxItems).map(g => (
          <div key={g.id}
            onClick={() => dispatch({
              type: 'SET_RESULT',
              result: { ...g, body_text: g.body, hashtags: g.tags, category: g.cat, _inputText: g.hint, _galleryItem: true }
            })}
            style={{
              borderRadius: 'var(--radius-md)', overflow: 'hidden', cursor: 'pointer',
              background: '#fff', border: '1px solid var(--border-light)',
              transition: 'all 0.15s',
            }}>
            {g.cover_url ? (
              <img src={proxyImg(g.cover_url)} alt="" loading="lazy"
                style={{ width: '100%', aspectRatio: '3/4', objectFit: 'cover' }} />
            ) : (
              <div style={{ width: '100%', aspectRatio: '3/4', background: g.grad || 'var(--accent-bg)' }} />
            )}
            <div style={{ padding: '10px 12px' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', ...(g.title.length > 16 ? { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } : {}) }}>
                {g.title}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
