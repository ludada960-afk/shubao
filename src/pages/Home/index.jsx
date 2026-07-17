import React, { useState } from 'react';
import { Pencil, ShoppingCart, Sparkles } from 'lucide-react';
import { useApp } from '../../store/AppContext';
import XhsContentMode from './XhsContentMode';
import EcMode from './EcMode';
import GallerySection from './GallerySection';
import Footer from '../../components/layout/Footer';

/**
 * 薯包AI 首页 — 暖白轻奢 V2
 * Tab 切换：小红书图文 / 电商生图
 * 底部案例、Footer 两种模式共用
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

      {/* XHS 模式 — 全页（不含Footer，由下方共享的 Gallery+Footer 补） */}
      {isXHS ? (
        <>
          <XhsContentMode />
          <GallerySection maxItems={12} />
          <Footer />
        </>
      ) : (
        <>
          {/* 电商模式 Tab */}
          <div style={{ maxWidth: 860, margin: '0 auto', padding: '32px 32px 0' }}>
            <div style={{
              display: 'flex', gap: 3,
              background: 'rgba(255,255,255,0.6)',
              borderRadius: 'var(--radius-full)',
              padding: 4, width: 'fit-content', margin: '0 auto',
              backdropFilter: 'blur(12px)',
            }}>
              <button onClick={() => setMode('content')}
                className="btn-pill" style={{ padding: '10px 28px', background: 'transparent', color: 'var(--text-muted)', fontWeight: 450, fontSize: 14 }}>
                <Pencil size={15} /> 小红书图文
              </button>
              <button onClick={() => setMode('ecommerce')}
                className="btn-pill"
                style={{ padding: '10px 28px', background: 'var(--accent)', color: '#fff', fontWeight: 600, boxShadow: 'var(--shadow-sm)', fontSize: 14 }}>
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

          {/* 底部案例 + Footer — 与 XHS 模式完全一致的组件 */}
          <GallerySection maxItems={18} />
          <Footer />
        </>
      )}
    </div>
  );
}
