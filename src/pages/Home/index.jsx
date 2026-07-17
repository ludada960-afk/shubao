import React, { useState } from 'react';
import { ShoppingCart } from 'lucide-react';
import { useApp } from '../../store/AppContext';
import XhsContentMode from './XhsContentMode';
import EcMode from './EcMode';
import GallerySection from './GallerySection';
import Footer from '../../components/layout/Footer';

/**
 * 薯包AI 首页 — 灵图风格 V3
 * XHS 全页渲染（保留原功能结构）
 * EC 模式套灵图表面卡
 */
export default function HomePage() {
  const { state, dispatch } = useApp();
  const { mode } = state;
  const isXHS = mode === 'content';

  const setMode = (m) => dispatch({ type: 'SET_MODE', mode: m });

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {isXHS ? (
        /* ──── XHS 全页模式（保留原有功能结构，仅继承全局 tokens）──── */
        <div style={{ position: 'relative' }}>
          <div className="creative-bg-glow" />
          <XhsContentMode inlineMode />
        </div>
      ) : (
        /* ──── EC 模式：灵图风格表面卡 ──── */
        <div style={{ position: 'relative', overflow: 'hidden', paddingBottom: 80 }}>
          <div className="creative-bg-glow" />

          {/* Mode Tab */}
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 20, marginBottom: 0 }}>
            <div style={{
              display: 'flex', gap: 3,
              background: 'rgba(255,255,255,0.70)',
              borderRadius: 'var(--radius-full)',
              padding: 4, width: 'fit-content',
              backdropFilter: 'blur(12px)',
            }}>
              <button onClick={() => setMode('content')}
                className="btn-pill" style={{ padding: '8px 24px', background: 'transparent', color: 'var(--text-muted)', fontWeight: 500, fontSize: 13 }}>
                小红书图文
              </button>
              <button onClick={() => setMode('ecommerce')}
                className="btn-pill" style={{ padding: '8px 24px', background: 'var(--accent)', color: '#fff', fontWeight: 900, fontSize: 13 }}>
                <ShoppingCart size={14} /> 电商生图
              </button>
            </div>
          </div>

          {/* Surface card */}
          <main style={{ position: 'relative', zIndex: 10, margin: '16px auto', width: '100%', maxWidth: 860, padding: '0 20px' }}>
            <div className="surface-card">
              <div className="surface-card-inner">
                <div className="surface-card-gradient" style={{ padding: '8px 16px' }}>
                  <EcMode />
                </div>
              </div>
            </div>

            <GallerySection maxItems={18} />
          </main>
        </div>
      )}

      {/* Global Footer */}
      {!isXHS && <Footer />}
    </div>
  );
}
