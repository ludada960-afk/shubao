import React, { useState } from 'react';
import { Pencil, ShoppingCart, Sparkles, ChevronRight } from 'lucide-react';
import { useApp } from '../../store/AppContext';
import { GALLERY } from '../../constants/data';
import { proxyImg } from '../../services/api';
import XhsContentMode from './XhsContentMode';
import EcMode from './EcMode';
import Footer from '../../components/layout/Footer';

/**
 * 薯包AI 首页 — 暖白轻奢 V2
 * Tab 切换：小红书图文（保留现有全页） / 电商生图（玻璃卡+折叠精修）
 */
export default function HomePage() {
  const { state, dispatch } = useApp();
  const { mode } = state;
  const [toast, setToast] = useState(null);

  const setMode = (m) => dispatch({ type: 'SET_MODE', mode: m });
  const isXHS = mode === 'content';

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 9999,
          background: 'var(--accent)',
          color: '#fff', padding: '12px 24px', borderRadius: 'var(--radius-full)',
          boxShadow: 'var(--shadow-xl)',
          fontSize: 14, fontWeight: 500, maxWidth: '90vw',
          animation: 'slideDown 0.3s ease',
        }}>{toast.message}</div>
      )}

      {/* 模式 Tab（不对外部页面做 padding，XHS 模式自由伸展） */}
      {isXHS ? (
        <XhsContentMode />
      ) : (
        <>
          {/* 电商模式 Tab 放在顶部 */}
          <div style={{ maxWidth: 860, margin: '0 auto', padding: '32px 32px 0' }}>
            <div style={{
              display: 'flex', gap: 3,
              background: 'rgba(255,255,255,0.6)',
              borderRadius: 'var(--radius-full)',
              padding: 4, width: 'fit-content', margin: '0 auto',
              backdropFilter: 'blur(12px)',
            }}>
              <button onClick={() => setMode('content')}
                className="btn-pill"
                style={{
                  padding: '10px 28px',
                  background: 'transparent',
                  color: 'var(--text-muted)',
                  fontWeight: 450,
                  fontSize: 14,
                }}>
                <Pencil size={15} /> 小红书图文
              </button>
              <button onClick={() => setMode('ecommerce')}
                className="btn-pill"
                style={{
                  padding: '10px 28px',
                  background: 'var(--accent)',
                  color: '#fff',
                  fontWeight: 600,
                  boxShadow: 'var(--shadow-sm)',
                  fontSize: 14,
                }}>
                <ShoppingCart size={15} /> 电商生图
              </button>
            </div>
          </div>

          {/* EC 玻璃卡 */}
          <div style={{ maxWidth: 860, margin: '24px auto 0', padding: '0 32px' }}>
            <div className="card-glass" style={{ padding: 28, position: 'relative', minHeight: 200 }}>
              <EcMode />
            </div>
          </div>

          {/* 灵感发现 */}
          <section style={{ maxWidth: 'var(--max-width)', margin: '48px auto 0', padding: '0 32px' }}>
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
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 14 }}>
              {GALLERY.slice(0, 18).map(g => (
                <div key={g.id}
                  onClick={() => dispatch({ type: 'SET_RESULT', result: { ...g, body_text: g.body, hashtags: g.tags, category: g.cat, _inputText: g.hint, _galleryItem: true } })}
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
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                      {g.title.length > 16 ? g.title.slice(0, 16) + '..' : g.title}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <Footer />
        </>
      )}
    </div>
  );
}
