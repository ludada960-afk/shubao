import React, { useState, useRef, useEffect } from 'react';
import { MdAutoAwesome, MdEdit, MdShoppingCart } from 'react-icons/md';
import { useApp } from '../../store/AppContext';
import XhsContentMode from './XhsContentMode';
import EcMode from './EcMode';
import DesignDirection from './ec/DesignDirection';
import GallerySection from './GallerySection';
import Footer from '../../components/layout/Footer';

/**
 * 薯包AI 首页 — 灵图结构精确复刻
 * 白色卡片 → {干净内容区 + 底栏} 平行同级
 */
export default function HomePage() {
  const { state, dispatch } = useApp();
  const { mode } = state;
  const isXHS = mode === 'content';
  const [xhsSubMode, setXhsSubMode] = useState('content');
  const [ecStep, setEcStep] = useState(1);  // 三段式：1=参数配置, 2=设计方向确认, 3=无限画布
  const ecParamsRef = useRef({});  // 第一步收集的参数

  // 当结果被清除（新建作品）时，重置步骤
  useEffect(() => {
    if (state.genState === 'idle' && ecStep !== 1) {
      setEcStep(1);
    }
  }, [state.genState]);

  return (
    <div style={{ position: 'relative', minHeight: '100vh', background: 'var(--bg)', overflow: 'hidden', paddingBottom: 80 }}>
      <div className="creative-bg-glow" />

      <div style={{ position: 'relative', zIndex: 10 }}>
        {/* 标题区 */}
        <div style={{ maxWidth: 1240, margin: '0 auto', padding: '24px 20px 0' }}>
          <div style={{ textAlign: 'center' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 'var(--radius-full)', border: '1px solid var(--border)', background: 'rgba(255,255,255,0.75)', fontSize: 13, fontWeight: 900, color: 'var(--text-secondary)', boxShadow: 'var(--shadow-sm)' }}>
              <MdAutoAwesome size={16} fill="#FBBF24" color="#F59E0B" />
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

          {/* ═══ 主模式切换 — 大号胶囊 ═══ */}
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 28 }}>
            <div style={{ display: 'flex', gap: 5, padding: 5, borderRadius: 30, background: 'rgba(0,0,0,0.04)', boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.06)' }}>
              <button onClick={() => { dispatch({ type: 'SET_MODE', mode: 'content' }); setEcStep(1); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '11px 28px', borderRadius: 25,
                  border: 'none',
                  background: isXHS ? '#1a1a1a' : 'transparent',
                  color: isXHS ? '#fff' : '#555',
                  fontWeight: 700, fontSize: 15,
                  cursor: 'pointer', fontFamily: 'inherit',
                  transition: 'all 0.2s',
                  boxShadow: isXHS ? 'inset 0 2px 6px rgba(0,0,0,0.25), 0 1px 3px rgba(0,0,0,0.08)' : 'none',
                }}
                onMouseEnter={e => { if (!isXHS) { e.currentTarget.style.background = 'rgba(0,0,0,0.06)'; e.currentTarget.style.color = '#1a1a1a'; } }}
                onMouseLeave={e => { if (!isXHS) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#555'; } }}>
                <MdEdit size={16} /> 小红书图文
              </button>
              <button onClick={() => dispatch({ type: 'SET_MODE', mode: 'ecommerce' })}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '11px 28px', borderRadius: 25,
                  border: 'none',
                  background: !isXHS ? '#1a1a1a' : 'transparent',
                  color: !isXHS ? '#fff' : '#555',
                  fontWeight: 700, fontSize: 15,
                  cursor: 'pointer', fontFamily: 'inherit',
                  transition: 'all 0.2s',
                  boxShadow: !isXHS ? 'inset 0 2px 6px rgba(0,0,0,0.25), 0 1px 3px rgba(0,0,0,0.08)' : 'none',
                }}
                onMouseEnter={e => { if (isXHS) { e.currentTarget.style.background = 'rgba(0,0,0,0.06)'; e.currentTarget.style.color = '#1a1a1a'; } }}
                onMouseLeave={e => { if (isXHS) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#555'; } }}>
                <MdShoppingCart size={16} /> 电商生图
              </button>
            </div>
          </div>


          {/* ═══ 白色表面卡 / 设计方向确认 ═══ */}
          {ecStep === 2 ? (
            <DesignDirection
              params={ecParamsRef.current}
              onBack={() => setEcStep(1)}
              onGenerated={() => setEcStep(3)}
            />
          ) : (
            <div className="surface-card" style={{ marginTop: 20 }}>
              <div className="surface-card-inner">
                {isXHS ? <XhsContentMode compactMode xhsSubMode={xhsSubMode} setXhsSubMode={setXhsSubMode} /> : (
                  <EcMode ecStep={ecStep} setEcStep={(step) => {
                    if (step === 2) {
                      // EcMode 会在 setEcStep(2) 时通过 onStepChange 传参
                    }
                    setEcStep(step);
                  }} onStepChange={(params) => { ecParamsRef.current = params; }} />
                )}
              </div>
            </div>
          )}
        </div>

        {/* 案例发现区 */}
        <GallerySection maxItems={24} />
      </div>
      <Footer />
    </div>
  );
}
