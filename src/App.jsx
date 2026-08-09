/**
 * 薯包AI · App 路由（V3 灵图风格视觉统一）
 */
import React, { useEffect, Suspense } from 'react';
import { AppProvider, useApp } from './store/AppContext';
import { TaskProvider } from './store/taskStore';
import { MdAutoAwesome, MdCheck, MdDashboard, MdFolder, MdGridOn } from 'react-icons/md';
import { IMAGES } from './constants/images';
import { LoginModal, PricingModal } from './components/business/Modals';
import TaskSidebar from './components/task/TaskSidebar';
import ErrorBoundary from './components/ErrorBoundary';
import { DialogProvider, useDialog } from './components/ui/DialogProvider.jsx';
const HomePage = React.lazy(() => import('./pages/Home/index'));
const PricingPage = React.lazy(() => import('./pages/Pricing/index'));
const RemakePage = React.lazy(() => import('./pages/Remake/index'));
const PlogPage = React.lazy(() => import('./pages/Plog/index'));
const EcCanvasPage = React.lazy(() => import('./pages/EcCanvas/index'));
const EcStudioPage = React.lazy(() => import('./pages/EcStudio/index'));
const EcAutoPage = React.lazy(() => import('./pages/EcAuto/index'));
import LoadingView from './pages/Generate/Loading';
import NoteModal from './NoteModal';
import { downloadZip, saveWork, regenerateText, proxyImg } from './services/api';
import { signOut } from './services/auth';
import { shouldShowNoteModal } from './routing/resultRouting';
import { buildContentCanvasResult } from './utils/contentCanvasHandoff.js';
import AccountEntitlementControl from './components/billing/AccountEntitlementControl.jsx';

/* ═══════ 左侧导航栏（3按钮精简版）═══════ */
function SideNav() {
  const { state, dispatch } = useApp();
  const { page } = state;

  // 生图（新建）/ 画布 / 作品 — 语义清晰，无重叠
  const items = [
    {
      icon: <MdAutoAwesome size={19} />,
      label: '生图',
      isPrimary: true,       // 主行动按钮，始终紫色强调
      active: page === 'home',
      onClick: () => dispatch({ type: 'NEW_WORK' }),  // 彻底重置状态，强制 remount
    },
    {
      icon: <MdGridOn size={20} />,
      label: '画布',
      active: page === 'ec-canvas',
      onClick: () => {
        // 画布是个人工作台：先完成受邀账号登录，再允许进入。
        if (!state.logged) {
          dispatch({ type: 'SET_LOGIN_INTENT', intent: { destination: 'ec-canvas', source: state.page } });
          dispatch({ type: 'SHOW_LOGIN', show: true });
          return;
        }
        dispatch({ type: 'OPEN_CANVAS' });
      },
    },
    {
      icon: <MdFolder size={20} />,
      label: '作品',
      active: false,
      onClick: () => {
        if (!state.logged) {
          dispatch({ type: 'SET_LOGIN_INTENT', intent: { destination: 'works', source: state.page } });
          dispatch({ type: 'SHOW_LOGIN', show: true });
          return;
        }
        dispatch({ type: 'OPEN_CANVAS', tab: 'works' });
      },
    },
  ];

  return (
    <div className="app-side-nav" style={{
      position: 'fixed', left: 0, top: '50%', transform: 'translateY(-50%)',
      zIndex: 200, display: 'flex', flexDirection: 'column', gap: 8,
      padding: '10px', marginLeft: 16,
      background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(20px)',
      borderRadius: 20, border: '1px solid rgba(0,0,0,0.08)',
      boxShadow: '0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)',
    }}>
      {items.map((item, i) => {
        const isGen = item.isPrimary;
        // 按钮样式：更像可点击的按钮，有明确的背景和边框
        const bg = isGen
          ? (item.active
              ? 'linear-gradient(135deg, #7c3aed, #a78bfa)'
              : 'linear-gradient(135deg, rgba(124,58,237,0.12), rgba(167,139,250,0.08))')
          : item.active 
            ? 'linear-gradient(135deg, rgba(0,0,0,0.08), rgba(0,0,0,0.04))' 
            : 'rgba(0,0,0,0.03)';
        const color = isGen
          ? (item.active ? '#fff' : '#7c3aed')
          : item.active ? '#1a1a1a' : '#666';
        const border = isGen
          ? (item.active ? 'none' : '1.5px solid rgba(124,58,237,0.25)')
          : item.active ? '1.5px solid rgba(0,0,0,0.15)' : '1.5px solid rgba(0,0,0,0.08)';
        const shadow = item.active 
          ? '0 4px 12px rgba(0,0,0,0.15)' 
          : '0 2px 6px rgba(0,0,0,0.04)';

        return (
          <button key={i} type="button" onClick={item.onClick} title={item.label} aria-label={item.label}
            aria-current={item.active ? 'page' : undefined}
            style={{
              width: 44, height: 44, borderRadius: 14,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', transition: 'all 0.2s cubic-bezier(0.22, 1, 0.36, 1)',
              background: bg, color, border, boxShadow: shadow,
              padding: 0, font: 'inherit',
            }}
            onMouseEnter={e => {
              if (!item.active) {
                e.currentTarget.style.background = isGen
                  ? 'linear-gradient(135deg, rgba(124,58,237,0.2), rgba(167,139,250,0.15))'
                  : 'rgba(0,0,0,0.06)';
                e.currentTarget.style.transform = 'scale(1.05)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
              }
            }}
            onMouseLeave={e => { 
              e.currentTarget.style.background = bg; 
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.boxShadow = shadow;
            }}>
            {item.icon}
          </button>
        );
      })}
    </div>
  );
}

/* ═══════ TopBar（无容器，直接浮在页面）═══════ */
function TopBar() {
  const { state, dispatch, refreshBillingBalance } = useApp();
  const { page, logged, ecPoints, unlimited, balanceRefreshStatus } = state;

  useEffect(() => {
    if (!logged) return undefined;
    const refreshOnVisible = () => {
      if (document.visibilityState === 'visible') refreshBillingBalance().catch(() => {});
    };
    refreshBillingBalance().catch(() => {});
    document.addEventListener('visibilitychange', refreshOnVisible);
    return () => document.removeEventListener('visibilitychange', refreshOnVisible);
  }, [logged, refreshBillingBalance]);

  return (
    <div className="app-topbar" style={{
      position: 'sticky', top: 0, zIndex: 100,
      paddingTop: 28, userSelect: 'none',
    }}>
      {/* 纯 Logo + 按钮行，无背景无框无阴影 */}
      <div className="topbar-row" style={{
        maxWidth: 1680, margin: '0 auto',
        paddingLeft: 36, paddingRight: 36,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        {/* Left: Logo — 匹配灵图: 侧面阴影 + 26px文字 + 薯包 AI */}
        <div className="topbar-brand" onClick={() => dispatch({ type: 'NAVIGATE', page: 'home' })}
          style={{ display: 'flex', alignItems: 'center', gap: 16, cursor: 'pointer', height: 50 }}>
          <span className="topbar-brand-mark" style={{
            display: 'flex', width: 42, height: 42, borderRadius: 12, overflow: 'hidden', flexShrink: 0,
            boxShadow: '3px 6px 18px rgba(160,130,220,0.35), 1px 2px 6px rgba(0,0,0,0.10)',
          }}>
            <img src={IMAGES.appicon} alt="薯包AI" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </span>
          <span style={{ fontSize: 26, fontWeight: 800, lineHeight: 1, color: '#333', letterSpacing: '0.03em' }}
            className="topbar-logo">
            薯包 AI
          </span>
          <style>{`@media (min-width: 640px) { .topbar-logo { font-size: 26px !important; font-weight: 800 !important; letter-spacing: 0.03em !important; } }`}</style>
        </div>

        {/* Right: 按钮组 */}
        <div className="topbar-actions" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <AccountEntitlementControl
            logged={logged}
            ecPoints={ecPoints}
            unlimited={unlimited}
            refreshStatus={balanceRefreshStatus}
            onPurchase={() => dispatch({ type: 'SHOW_PRICE', show: true })}
            onLogin={() => dispatch({ type: 'SHOW_LOGIN', show: true })}
          />

          {/* 登录 */}
          {logged ? (
            <button onClick={async () => { await signOut(); dispatch({ type: 'SET_LOGGED', logged: false, phone: '' }); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, height: 44,
                padding: '0 24px', border: 'none', borderRadius: 'var(--radius-full)',
                background: 'transparent', fontSize: 15, fontWeight: 700,
                color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'inherit',
                whiteSpace: 'nowrap', transition: 'all 0.12s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.5)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
              <MdCheck size={16} /> 已登录
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
  const { page, genState, result, galleryItem } = state;
  const dialog = useDialog();

  useEffect(() => {
    const hash = window.location.hash;
    if (hash.startsWith('#/remake')) {
      dispatch({ type: 'NAVIGATE', page: 'remake' });
    }
  }, []);

  // B3: 全局 resize 节流 — 防止高频重排导致崩溃
  useEffect(() => {
    let rafId = null;
    const handleResize = () => {
      if (rafId) return;
      rafId = requestAnimationFrame(() => { rafId = null; });
    };
    window.addEventListener('resize', handleResize, { passive: true });
    return () => {
      window.removeEventListener('resize', handleResize);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []);

  const textRegen = async () => {
    if (!result || result._galleryItem) { await dialog.notice({ title: '请先生成自己的作品', message: '案例用于查看效果，生成自己的作品后即可重新编辑文案。' }); return; }
    try {
      const d = await regenerateText(result._inputText || result.title, result.category);
      dispatch({
        type: 'UPDATE_RESULT',
        updater: (prev) => ({ ...prev, title: d.title || prev.title, body_text: d.body_text || prev.body_text, hashtags: d.hashtags || prev.hashtags, pages: d.pages || prev.pages }),
      });
    } catch (e) { await dialog.notice({ title: '文案生成失败', message: e.message || '请稍后重试。' }); }
  };

  const handleDownload = () => {
    if (result?._ecResult) {
      const imgs = Object.entries(result.images || {});
      imgs.forEach(([style, url]) => {
        const a = document.createElement('a');
        // B2: 走代理 URL 避免跨域 404
        a.href = proxyImg(url);
        a.download = `${result.product_name || '商品'}-${style}.png`;
        a.target = '_blank';
        a.click();
      });
      return;
    }
    if (result?._galleryItem) { dialog.notice({ title: '请先生成自己的作品', message: '案例用于查看效果，生成自己的作品后即可下载。' }); return; }
    downloadZip(result.cover_url, result.image_urls, result.title, result.body_text, result.hashtags);
  };

  // 作品集页面映射（/gallery 映射到 home，gallery 案例已平铺首页）
  const pageMap = {
    home: HomePage,
    gallery: HomePage,  // 不再独立
    pricing: PricingPage,
    remake: RemakePage,
    plog: PlogPage,
    'ec-canvas': EcCanvasPage,
    'ec-studio': EcStudioPage,
    'ec-auto': EcAutoPage,
  };
  const PageComponent = pageMap[page] || HomePage;
  const previewItem = galleryItem || result;
  const galleryNotice = () => dialog.notice({
    title: '请先生成自己的作品',
    message: '案例用于查看效果，生成自己的作品后即可继续编辑或下载。',
  });

  return (<>
    {page !== 'ec-canvas' && <SideNav />}
    <TaskSidebar />
    {page !== 'ec-canvas' && <TopBar />}
    <React.Suspense fallback={<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontSize: 16, color: '#999' }}>加载中…</div>}>
      <PageComponent key={state._workVersion || 0} />
    </React.Suspense>
    {(galleryItem || (genState === 'result' && shouldShowNoteModal({ page, result }))) && (
      <NoteModal
        item={previewItem}
        onClose={() => {
          if (galleryItem) dispatch({ type: 'VIEW_GALLERY_ITEM', item: null });
          else dispatch({ type: 'CLOSE_RESULT' });
          if (state.scrollPos) setTimeout(() => window.scrollTo(0, state.scrollPos), 50);
        }}
        textRegen={galleryItem ? galleryNotice : textRegen}
        onDownload={galleryItem ? galleryNotice : handleDownload}
        onUnlock={() => dispatch({ type: 'SHOW_PRICE', show: true })}
        onGallery={() => { dispatch({ type: 'CLOSE_RESULT' }); dispatch({ type: 'NAVIGATE', page: 'home' }); }}
        onSendToCanvas={(contentItem) => {
          const canvasResult = buildContentCanvasResult(contentItem);
          dispatch({ type: 'SET_RESULT', result: canvasResult });
          dispatch({ type: 'NAVIGATE', page: 'ec-canvas' });
        }}
        onItemUpdate={galleryItem ? undefined : (i, url) => {
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
            saveWork(updated, state.phone);
          }
        }}
      />
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
  return (<AppProvider><TaskProvider><DialogProvider><ErrorBoundary><AppRouter /></ErrorBoundary></DialogProvider></TaskProvider></AppProvider>);
}
