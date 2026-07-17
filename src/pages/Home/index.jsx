import React from 'react';
import { Pencil, ShoppingCart, Sparkles } from 'lucide-react';
import { useApp } from '../../store/AppContext';
import XhsContentMode from './XhsContentMode';
import EcMode from './EcMode';
import GallerySection from './GallerySection';
import Footer from '../../components/layout/Footer';

/**
 * 薯包AI 首页 — 灵图结构精确复刻
 * 白层∈表面卡 → {黄梯度区 + 底栏} 平行同级
 */
export default function HomePage() {
  const { state, dispatch } = useApp();
  const { mode } = state;
  const isXHS = mode === 'content';

  return (
    <div style={{ position: 'relative', minHeight: '100vh', background: 'var(--bg)', overflow: 'hidden', paddingBottom: 80 }}>
      <div className="creative-bg-glow" />

      <div style={{ position: 'relative', zIndex: 10 }}>
        {/* 标题区 */}
        <div style={{ maxWidth: 1240, margin: '0 auto', padding: '24px 20px 0' }}>
          <div style={{ textAlign: 'center' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 'var(--radius-full)', border: '1px solid var(--border)', background: 'rgba(255,255,255,0.75)', fontSize: 13, fontWeight: 900, color: 'var(--text-secondary)', boxShadow: 'var(--shadow-sm)' }}>
              <Sparkles size={16} fill="#FBBF24" color="#F59E0B" />
              薯包 AI · <span style={{opacity:0.7}}>小红书图文</span><span style={{opacity:0.3}}> + </span><span style={{opacity:0.7}}>电商商品图</span>
            </span>

            <h1 style={{ fontSize: 38, fontWeight: 900, lineHeight: 1.05, color: 'var(--accent)', marginTop: 16, marginBottom: 0, letterSpacing: 'normal' }} className="homepage-h1">
              AI 一键生成<span className="hero-gradient-text">视觉内容</span>
            </h1>
            <style>{`@media (min-width:640px){.homepage-h1{font-size:54px!important}}@media(min-width:1024px){.homepage-h1{font-size:62px!important}}`}</style>

            <p style={{ margin: '12px auto 0', maxWidth: 860, fontSize: 15, fontWeight: 500, color: 'var(--text-muted)' }} className="homepage-subtitle">
              <span>📝 小红书图文</span><span style={{margin:'0 10px',opacity:0.2}}>|</span><span>🛒 电商商品图</span><span style={{margin:'0 10px',opacity:0.2}}>|</span><span>⚡ 双模式一键切换，一个AI搞定全部视觉内容</span>
            </p>
            <style>{`.homepage-subtitle{line-height:28px}@media(min-width:768px){.homepage-subtitle{font-size:17px!important;line-height:30px!important}}`}</style>
          </div>

          {/* Mode Tabs */}
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 24 }}>
            <div style={{ display: 'flex', gap: 3, background: 'rgba(255,255,255,0.70)', borderRadius: 'var(--radius-full)', padding: 4, width: 'fit-content', backdropFilter: 'blur(12px)' }}>
              <button onClick={() => dispatch({ type: 'SET_MODE', mode: 'content' })} className="btn-pill"
                style={{ padding: '8px 24px', background: isXHS ? 'var(--accent)' : 'transparent', color: isXHS ? '#fff' : 'var(--text-muted)', fontWeight: isXHS ? 900 : 500, fontSize: 13, boxShadow: isXHS ? '0 1px 3px rgba(0,0,0,0.08)' : 'none' }}>
                <Pencil size={14} /> 小红书图文
              </button>
              <button onClick={() => dispatch({ type: 'SET_MODE', mode: 'ecommerce' })} className="btn-pill"
                style={{ padding: '8px 24px', background: !isXHS ? 'var(--accent)' : 'transparent', color: !isXHS ? '#fff' : 'var(--text-muted)', fontWeight: !isXHS ? 900 : 500, fontSize: 13, boxShadow: !isXHS ? '0 1px 3px rgba(0,0,0,0.08)' : 'none' }}>
                <ShoppingCart size={14} /> 电商生图
              </button>
            </div>
          </div>

          {/* ═══ 灵图三层表面卡 — 组件内部自行分割梯度层+底栏 ═══ */}
          <div className="surface-card" style={{ marginTop: 20 }}>
            <div className="surface-card-inner">
              {isXHS ? <XhsContentMode compactMode /> : <EcMode />}
            </div>
          </div>
        </div>

        {/* 案例发现区 */}
        <GallerySection maxItems={24} />
      </div>
      <Footer />
    </div>
  );
}
