/**
 * 薯包AI · App 路由（V3 灵图风格视觉统一）
 */
import React, { useEffect } from 'react';
import { AppProvider, useApp } from './store/AppContext';
import { Sparkles, LogIn, Check, Menu, X, User, LayoutGrid } from 'lucide-react';
import { IMAGES } from './constants/images';
import { LoginModal, PricingModal } from './components/business/Modals';
import HomePage from './pages/Home/index';
import PricingPage from './pages/Pricing/index';
import WorksPage from './pages/Works/index';
import RemakePage from './pages/Remake/index';
import PlogPage from './pages/Plog/index';
import LoadingView from './pages/Generate/Loading';
import NoteModal from './NoteModal';
import { downloadZip, saveWork, regenerateText } from './services/api';

/* ═══════ TopBar（无容器，直接浮在页面）═══════ */
function TopBar() {
  const { state, dispatch } = useApp();
  const { page, logged, credits } = state;

  return (
    <div style={{
      position: 'sticky', top: 0, zIndex: 100,
      paddingTop: 28, userSelect: 'none',
    }}>
      {/* 纯 Logo + 按钮行，无背景无框无阴影 */}
      <div style={{
        maxWidth: 1680, margin: '0 auto',
        paddingLeft: 36, paddingRight: 36,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        {/* Left: Logo — 灵图: 46x46 icon + 24/30px text */}
        <div onClick={() => dispatch({ type: 'NAVIGATE', page: 'home' })}
          style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', height: 50 }}>
          <span style={{ display: 'flex', width: 46, height: 46, borderRadius: 12, overflow: 'hidden', flexShrink: 0 }}>
            <img src={IMAGES.appicon} alt="薯包AI" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </span>
          <span style={{ fontSize: 24, fontWeight: 900, lineHeight: 1, color: 'var(--accent)', letterSpacing: 'normal' }}
            className="topbar-logo">
            薯包AI
          </span>
          <style>{`@media (min-width: 640px) { .topbar-logo { font-size: 30px !important; } .topbar-logo-wrap { gap: 16px !important; } }`}</style>
        </div>

        {/* Right: 按钮组 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* 我的作品 */}
          <button onClick={() => dispatch({ type: 'NAVIGATE', page: 'works' })}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, height: 44,
              padding: '0 14px', border: 'none', borderRadius: 'var(--radius-full)',
              background: page === 'works' ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.5)',
              fontSize: 13, fontWeight: page === 'works' ? 900 : 500,
              color: page === 'works' ? 'var(--accent)' : 'var(--text-muted)',
              cursor: 'pointer', fontFamily: 'inherit',
              backdropFilter: 'blur(8px)',
              transition: 'all 0.12s', whiteSpace: 'nowrap',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.85)'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(57,45,26,0.08)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = page === 'works' ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.5)'; e.currentTarget.style.boxShadow = 'none'; }}>
            <LayoutGrid size={16} />
            <span style={{ display: 'none' }} className="topbar-works-label">我的作品</span>
            <style>{`@media (min-width: 640px) { .topbar-works-label { display: inline !important; } }`}</style>
            {logged && (
              <span style={{ fontWeight: 700, fontSize: 11, background: 'var(--accent)', color: '#fff', padding: '1px 7px', borderRadius: 8 }}>{credits}</span>
            )}
          </button>

          {/* 套餐 */}
          <button onClick={() => dispatch({ type: 'SHOW_PRICE', show: true })}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, height: 44,
              padding: '0 20px', border: 'none', borderRadius: 'var(--radius-full)',
              background: 'var(--accent)', color: '#fff',
              fontSize: 13, fontWeight: 900, cursor: 'pointer', fontFamily: 'inherit',
              boxShadow: '0 14px 32px rgba(28,25,23,0.18)',
              transition: 'all 0.15s', whiteSpace: 'nowrap',
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.background = '#2A2521'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.background = 'var(--accent)'; }}>
            <Sparkles size={16} fill="rgba(252,211,77,0.8)" color="#FCD34D" />
            套餐
          </button>

          {/* 登录 */}
          {logged ? (
            <button onClick={() => dispatch({ type: 'SET_LOGGED', logged: false, phone: '' })}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, height: 44,
                padding: '0 24px', border: 'none', borderRadius: 'var(--radius-full)',
                background: 'transparent', fontSize: 15, fontWeight: 700,
                color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'inherit',
                whiteSpace: 'nowrap', transition: 'all 0.12s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.5)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
              <Check size={16} /> 已登录
            </button>
          ) : (
            <button onClick={() => dispatch({ type: 'SHOW_LOGIN', show: true })}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, height: 44,
                padding: '0 24px', border: 'none', borderRadius: 'var(--radius-full)',
                background: 'transparent', fontSize: 15, fontWeight: 700,
                color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'inherit',
                whiteSpace: 'nowrap', transition: 'all 0.12s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.5)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
              去登录
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function AppRouter() {
  const { state, dispatch } = useApp();
  const { page, genState, result } = state;

  useEffect(() => {
    const hash = window.location.hash;
    if (hash.startsWith('#/remake')) {
      dispatch({ type: 'NAVIGATE', page: 'remake' });
    }
  }, []);

  const textRegen = async () => {
    if (!result || result._galleryItem) { alert('这是薯包出品的展示内容，请先自己生成作品后再使用此功能'); return; }
    try {
      const d = await regenerateText(result._inputText || result.title, result.category);
      dispatch({
        type: 'UPDATE_RESULT',
        updater: (prev) => ({ ...prev, title: d.title || prev.title, body_text: d.body_text || prev.body_text, hashtags: d.hashtags || prev.hashtags, pages: d.pages || prev.pages }),
      });
    } catch (e) { alert('文案重生成失败：' + e.message); }
  };

  const handleDownload = () => {
    if (result?._ecResult) {
      const imgs = Object.entries(result.images || {});
      imgs.forEach(([style, url]) => {
        const a = document.createElement('a');
        a.href = url;
        a.download = `${result.product_name || '商品'}-${style}.png`;
        a.click();
      });
      return;
    }
    if (result?._galleryItem) { alert('这是薯包出品的展示内容，请先自己生成作品后再使用此功能'); return; }
    downloadZip(result.cover_url, result.image_urls, result.title, result.body_text, result.hashtags);
  };

  // 作品集页面映射（/gallery 映射到 home，gallery 案例已平铺首页）
  const pageMap = {
    home: HomePage,
    gallery: HomePage,  // 不再独立
    pricing: PricingPage,
    works: WorksPage,
    remake: RemakePage,
    plog: PlogPage,
  };
  const PageComponent = pageMap[page] || HomePage;

  return (<>
    <TopBar />
    {genState === 'result' && result ? (
      <NoteModal
        item={result}
        onClose={() => { dispatch({ type: 'CLOSE_RESULT' }); if (state.scrollPos) setTimeout(() => window.scrollTo(0, state.scrollPos), 50); }}
        textRegen={textRegen}
        onDownload={handleDownload}
        onUnlock={() => dispatch({ type: 'SHOW_PRICE', show: true })}
        onGallery={() => { dispatch({ type: 'CLOSE_RESULT' }); dispatch({ type: 'NAVIGATE', page: 'home' }); }}
        onItemUpdate={(i, url) => {
          dispatch({ type: 'UPDATE_RESULT', updater: (prev) => {
            if (!prev) return prev;
            if (i === 0) return { ...prev, cover_url: url };
            const u = [...(prev.image_urls || [])]; if (u[i-1]) u[i-1] = url;
            return { ...prev, image_urls: u };
          }});
          if (result._inputText) {
            const updated = { ...result };
            if (i === 0) updated.cover_url = url;
            else { const u = [...(updated.image_urls || [])]; if (u[i-1]) u[i-1] = url; updated.image_urls = u; }
            saveWork(updated);
          }
        }}
      />
    ) : (
      <PageComponent />
    )}
    {genState === 'loading' && (
      <div style={{ position:'fixed', inset:0, zIndex:9999, background:'var(--bg)' }}>
        <LoadingView />
      </div>
    )}
    <LoginModal />
    <PricingModal />
  </>);
}

export default function App() {
  return (<AppProvider><AppRouter /></AppProvider>);
}
