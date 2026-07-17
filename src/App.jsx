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

/* ═══════ TopBar（灵图风格：Logo左 + 右功能按钮）═══════ */
function TopBar() {
  const { state, dispatch } = useApp();
  const { page, logged, credits } = state;

  return (
    <div style={{
      position: 'sticky', top: 0, zIndex: 100,
      paddingTop: 16, userSelect: 'none',
    }}>
      <div style={{
        margin: '0 auto', height: 60,
        width: 'calc(100% - 32px)', maxWidth: 1680,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 8, padding: '0 16px',
        background: 'rgba(255,255,255,0.75)',
        border: '1px solid rgba(255,255,255,0.60)',
        borderRadius: 'var(--radius-full)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        boxShadow: '0 12px 30px rgba(57,45,26,0.10)',
      }}>
        {/* Left: Logo */}
        <div onClick={() => dispatch({ type: 'NAVIGATE', page: 'home' })}
          style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', flexShrink: 0 }}>
          <span style={{
            display: 'flex', width: 36, height: 36, borderRadius: 9, overflow: 'hidden', flexShrink: 0,
            alignItems: 'center', justifyContent: 'center',
            background: 'linear-gradient(135deg, #7c3aed, #6366f1, #e879f9)',
            boxShadow: '0 12px 24px rgba(124,92,255,0.22)',
          }}>
            <Sparkles size={18} color="#fff" fill="#fff" />
          </span>
          <span style={{ fontSize: 18, fontWeight: 900, color: 'var(--accent)', lineHeight: 1 }}>
            薯包AI
          </span>
        </div>

        {/* Right */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {/* 我的作品 (replaces credits area) */}
          <button onClick={() => dispatch({ type: 'NAVIGATE', page: 'works' })}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              height: 36, padding: '0 14px',
              borderRadius: 'var(--radius-full)',
              border: '1px solid rgba(255,255,255,0.6)',
              background: page === 'works' ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.6)',
              fontSize: 12, fontWeight: page === 'works' ? 900 : 500,
              color: page === 'works' ? 'var(--accent)' : 'var(--text-muted)',
              cursor: 'pointer', fontFamily: 'inherit',
              backdropFilter: 'blur(8px)',
              transition: 'all 0.12s',
            }}>
            <LayoutGrid size={14} />
            <span>我的作品</span>
            {logged && (
              <span style={{
                fontWeight: 700, fontSize: 11,
                background: 'var(--accent)', color: '#fff',
                padding: '1px 7px', borderRadius: 8,
                marginLeft: 2,
              }}>{credits}</span>
            )}
          </button>

          {/* 套餐 */}
          <button onClick={() => dispatch({ type: 'SHOW_PRICE', show: true })}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              height: 36, padding: '0 14px', border: 'none',
              borderRadius: 'var(--radius-full)',
              background: 'var(--accent)', color: '#fff',
              fontSize: 12, fontWeight: 900, cursor: 'pointer', fontFamily: 'inherit',
              boxShadow: '0 14px 32px rgba(28,25,23,0.18)',
            }}>
            <Sparkles size={13} fill="rgba(252,211,77,0.8)" color="#FCD34D" />
            套餐
          </button>

          {/* 登录 */}
          {logged ? (
            <button onClick={() => dispatch({ type: 'SET_LOGGED', logged: false, phone: '' })}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                height: 36, padding: '0 14px', border: 'none',
                borderRadius: 'var(--radius-full)',
                background: 'transparent',
                fontSize: 12, fontWeight: 600, color: 'var(--text-muted)',
                cursor: 'pointer', fontFamily: 'inherit',
              }}>
              <Check size={13} /> 已登录
            </button>
          ) : (
            <button onClick={() => dispatch({ type: 'SHOW_LOGIN', show: true })}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                height: 36, padding: '0 16px', border: 'none',
                borderRadius: 'var(--radius-full)',
                background: 'transparent',
                fontSize: 12, fontWeight: 600, color: 'var(--text-muted)',
                cursor: 'pointer', fontFamily: 'inherit',
              }}>
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
