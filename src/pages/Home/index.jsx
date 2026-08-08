import React, { useState, useRef, useEffect } from 'react';
import { MdAutoAwesome, MdEdit, MdShoppingCart } from 'react-icons/md';
import { useApp } from '../../store/AppContext';
import XhsContentMode from './XhsContentMode';
import EcMode from './EcMode';
import DesignDirection from './ec/DesignDirection';
import GallerySection from './GallerySection';
import Footer from '../../components/layout/Footer';
import RecoveryShelf from './ec/RecoveryShelf';
import { clearLegacyEcommerceDraftState } from './ec/ecommerceDraftStore';

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
  const [recoveryCheckpoint, setRecoveryCheckpoint] = useState(null);
  const ecParamsRef = useRef({});  // 第一步收集的参数
  const modeShowcaseRef = useRef(null);

  const modeOptions = [
    {
      mode: 'ecommerce',
      title: '电商生图',
      src: '/images/home/workspace-ecommerce.png',
    },
    {
      mode: 'content',
      title: '小红书图文',
      src: '/images/home/workspace-xhs.png',
    },
  ];

  const handleModePointerMove = event => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    event.currentTarget.style.setProperty('--mode-tilt-x', `${(-y * 5).toFixed(2)}deg`);
    event.currentTarget.style.setProperty('--mode-tilt-y', `${(x * 7).toFixed(2)}deg`);
  };

  const resetModePointer = event => {
    event.currentTarget.style.setProperty('--mode-tilt-x', '0deg');
    event.currentTarget.style.setProperty('--mode-tilt-y', '0deg');
  };

  useEffect(() => {
    clearLegacyEcommerceDraftState();
  }, []);

  // 当结果被清除（新建作品）时，重置步骤
  useEffect(() => {
    if (state.genState === 'idle' && ecStep !== 1) {
      setEcStep(1);
    }
  }, [state.genState]);

  const restoreCheckpoint = checkpoint => {
    const kind = checkpoint?.project?.kind;
    setRecoveryCheckpoint(checkpoint);
    setEcStep(1);
    if (kind === 'xiaohongshu' || kind === 'plog') {
      dispatch({ type: 'SET_MODE', mode: 'content' });
      setXhsSubMode(kind === 'plog' ? 'plog' : 'content');
    } else {
      dispatch({ type: 'SET_MODE', mode: 'ecommerce' });
    }
  };

  return (
    <div style={{ position: 'relative', minHeight: '100vh', background: 'var(--bg)', overflowX: 'clip', paddingBottom: 80 }}>
      <div className="creative-bg-glow" />

      <div style={{ position: 'relative', zIndex: 10 }}>
        {/* 标题区 */}
        <div className="homepage-shell" style={{ maxWidth: 1240, margin: '0 auto', padding: '24px 20px 0' }}>
          <div style={{ textAlign: 'center' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 'var(--radius-full)', border: '1px solid var(--border)', background: 'rgba(255,255,255,0.75)', fontSize: 13, fontWeight: 900, color: 'var(--text-secondary)', boxShadow: 'var(--shadow-sm)' }}>
              <MdAutoAwesome size={16} fill="#FBBF24" color="#F59E0B" />
              薯包 AI · <span style={{ opacity: 0.7 }}>智能视觉内容创作平台</span>
            </span>

            <h1 style={{ fontSize: 38, fontWeight: 900, lineHeight: 1.05, color: 'var(--accent)', marginTop: 16, marginBottom: 0, letterSpacing: 'normal' }} className="homepage-h1">
              上传创意素材，生成<span className="hero-gradient-text">专业视觉</span>
            </h1>
            <style>{`@media (min-width:640px){.homepage-h1{font-size:54px!important}}@media(min-width:1024px){.homepage-h1{font-size:62px!important}}`}</style>

            <p style={{ margin: '12px auto 0', maxWidth: 860, fontSize: 15, fontWeight: 500, color: 'var(--text-muted)' }} className="homepage-subtitle">
              电商套图、小红书图文与更多营销内容，在同一个工作台完成
            </p>
            <style>{`.homepage-subtitle{line-height:28px}@media(min-width:768px){.homepage-subtitle{font-size:17px!important;line-height:30px!important}}`}</style>
          </div>

          <RecoveryShelf logged={state.logged} onRestore={restoreCheckpoint} />

          {/* ═══ 主模式切换：卡片本身就是工作台入口 ═══ */}
          <div
            ref={modeShowcaseRef}
            className={`homepage-mode-showcase ${isXHS ? 'is-xhs' : 'is-commerce'}`}
            onPointerMove={handleModePointerMove}
            onPointerLeave={resetModePointer}
          >
            <div className="homepage-mode-cards" role="tablist" aria-label="创作模式">
              {modeOptions.map((option, index) => {
                const active = option.mode === (isXHS ? 'content' : 'ecommerce');
                const ModeIcon = option.mode === 'ecommerce' ? MdShoppingCart : MdEdit;
                return (
                  <button
                    type="button"
                    role="tab"
                    aria-selected={active}
                    className={`homepage-mode-card card-${index + 1}${active ? ' is-active' : ''}`}
                    key={option.mode}
                    onClick={() => {
                      dispatch({ type: 'SET_MODE', mode: option.mode });
                      if (option.mode === 'content') setEcStep(1);
                    }}
                  >
                    <span className="homepage-mode-card-title"><ModeIcon size={16} />{option.title}</span>
                    <span className="homepage-mode-card-visual">
                      <img src={option.src} alt={`${option.title}案例`} loading="eager" />
                    </span>
                  </button>
                );
              })}
            </div>
          </div>


          {/* ═══ 白色表面卡 / 设计方向确认 ═══ */}
          {!isXHS && ecStep === 2 && (
            <DesignDirection
              params={ecParamsRef.current}
              onBack={() => setEcStep(1)}
              onGenerated={() => setEcStep(3)}
            />
          )}
          <div className="surface-card" style={{
            display: ecStep === 2 ? 'none' : undefined,
            marginTop: 20,
            background: isXHS ? '#fff' : 'transparent',
            boxShadow: isXHS ? undefined : 'none',
          }}>
            <div className="surface-card-inner">
              {isXHS ? <XhsContentMode compactMode xhsSubMode={xhsSubMode} setXhsSubMode={setXhsSubMode} recoveryCheckpoint={recoveryCheckpoint} /> : (
                <EcMode ecStep={ecStep} setEcStep={setEcStep}
                  onStepChange={(params) => { ecParamsRef.current = params; }}
                  recoveryCheckpoint={recoveryCheckpoint} />
              )}
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
