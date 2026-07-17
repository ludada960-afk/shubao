import React from 'react';
import { Pencil, ShoppingCart } from 'lucide-react';
import { useApp } from '../../store/AppContext';
import XhsContentMode from './XhsContentMode';
import EcMode from './EcMode';
import GallerySection from './GallerySection';
import Footer from '../../components/layout/Footer';

/**
 * 薯包AI 首页 — 灵图风格 V3 视觉统一版
 * XHS / EC 共用同一套 UI 外壳（表面卡），仅内部生图内容不同
 * 案例区直接平铺在生图模块下方
 */
export default function HomePage() {
  const { state, dispatch } = useApp();
  const { mode } = state;
  const isXHS = mode === 'content';

  return (
    <div style={{
      position: 'relative', minHeight: '100vh',
      background: 'var(--bg)', overflow: 'hidden', paddingBottom: 60,
    }}>
      {/* 全页面连续渐变光晕 — 固定至顶部 420px，无断层 */}
      <div className="creative-bg-glow" />

      {/* 主内容（z-index 在光晕之上） */}
      <main style={{ position: 'relative', zIndex: 10, margin: '0 auto', width: '100%', maxWidth: 1240, padding: '0 20px' }}>
        {/* Mode Tabs — 灵图风格 pill */}
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 16 }}>
          <div style={{
            display: 'flex', gap: 3,
            background: 'rgba(255,255,255,0.70)',
            borderRadius: 'var(--radius-full)',
            padding: 4, width: 'fit-content',
            backdropFilter: 'blur(12px)',
          }}>
            <button onClick={() => dispatch({ type: 'SET_MODE', mode: 'content' })}
              className="btn-pill"
              style={{
                padding: '8px 24px',
                background: isXHS ? 'var(--accent)' : 'transparent',
                color: isXHS ? '#fff' : 'var(--text-muted)',
                fontWeight: isXHS ? 900 : 500, fontSize: 13,
                boxShadow: isXHS ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              }}>
              <Pencil size={14} /> 小红书图文
            </button>
            <button onClick={() => dispatch({ type: 'SET_MODE', mode: 'ecommerce' })}
              className="btn-pill"
              style={{
                padding: '8px 24px',
                background: !isXHS ? 'var(--accent)' : 'transparent',
                color: !isXHS ? '#fff' : 'var(--text-muted)',
                fontWeight: !isXHS ? 900 : 500, fontSize: 13,
                boxShadow: !isXHS ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              }}>
              <ShoppingCart size={14} /> 电商生图
            </button>
          </div>
        </div>

        {/* ⭐ 统一灵图表面卡 — XHS / EC 共用一样的外壳 */}
        <div className="surface-card" style={{ marginTop: 16 }}>
          <div className="surface-card-inner">
            <div className="surface-card-gradient" style={{ padding: '12px 20px' }}>
              {isXHS ? <XhsContentMode compactMode /> : <EcMode />}
            </div>
          </div>
        </div>

        {/* 案例灵感发现 — 直接平铺首页 */}
        <GallerySection maxItems={24} />
      </main>

      <Footer />
    </div>
  );
}
