/**
 * 薯包AI · App 路由（V3 灵图风格视觉统一）
 */
import React, { useEffect, Suspense } from 'react';
import { AppProvider, useApp } from './store/AppContext';
import { TaskProvider } from './store/taskStore';
import { MdCheck } from 'react-icons/md';
import { ShieldCheck } from 'lucide-react';
import { IMAGES } from './constants/images';
import { LoginModal, PricingModal } from './components/business/Modals';
import TaskSidebar from './components/task/TaskSidebar';
import ErrorBoundary from './components/ErrorBoundary';
import { DialogProvider, useDialog } from './components/ui/DialogProvider.jsx';
import './styles/app-shell.css';
const HomePage = React.lazy(() => import('./pages/Home/index'));
const PricingPage = React.lazy(() => import('./pages/Pricing/index'));
const RemakePage = React.lazy(() => import('./pages/Remake/index'));
const PlogPage = React.lazy(() => import('./pages/Plog/index'));
const EcCanvasPage = React.lazy(() => import('./pages/EcCanvas/index'));
const EcStudioPage = React.lazy(() => import('./pages/EcStudio/index'));
const EcAutoPage = React.lazy(() => import('./pages/EcAuto/index'));
const VideoStudioPage = React.lazy(() => import('./pages/VideoStudio/index'));
const AdminConsolePage = React.lazy(() => import('./pages/AdminConsole/index.jsx'));
import LoadingView from './pages/Generate/Loading';
import NoteModal from './NoteModal';
import { downloadZip, saveWork, regenerateText, proxyImg } from './services/api';
import { signOut } from './services/auth';
import { shouldShowNoteModal } from './routing/resultRouting';
import { buildContentCanvasResult } from './utils/contentCanvasHandoff.js';
import AccountEntitlementControl from './components/billing/AccountEntitlementControl.jsx';
import CreativeDomainNav from './components/layout/CreativeDomainNav.jsx';

/* ═══════ TopBar（无容器，直接浮在页面）═══════ */
function TopBar() {
  const { state, dispatch, refreshBillingBalance } = useApp();
  const { logged, ecPoints, unlimited, balanceRefreshStatus } = state;
  const canAdmin = state.accountAccess?.role === 'owner';

  useEffect(() => {
    if (!logged || state.browserQa) return undefined;
    const refreshOnVisible = () => {
      if (document.visibilityState === 'visible') refreshBillingBalance().catch(() => {});
    };
    refreshBillingBalance().catch(() => {});
    document.addEventListener('visibilitychange', refreshOnVisible);
    return () => document.removeEventListener('visibilitychange', refreshOnVisible);
  }, [logged, refreshBillingBalance, state.browserQa]);

  return (
    <div className="app-topbar" style={{ zIndex: 100, userSelect: 'none' }}>
      {/* 纯 Logo + 按钮行，无背景无框无阴影 */}
      <div className="topbar-row">
        {/* Left: Logo — 匹配灵图: 侧面阴影 + 26px文字 + 薯包 AI */}
        <div className="topbar-brand" onClick={() => dispatch({ type: 'NAVIGATE', page: 'home' })}
          style={{ cursor: 'pointer' }}>
          <span className="topbar-brand-mark">
            <img src={IMAGES.appicon} alt="薯包AI" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </span>
          <span className="topbar-logo">
            薯包 AI
          </span>
        </div>

        <CreativeDomainNav />

        {/* Right: 按钮组 */}
        <div className="topbar-actions">
          {canAdmin && (
            <button
              type="button"
              className="topbar-action-button topbar-admin-button"
              aria-label="管理后台"
              title="管理后台"
              aria-current={state.page === 'admin' ? 'page' : undefined}
              onClick={() => dispatch({ type: 'NAVIGATE', page: 'admin' })}
            >
              <ShieldCheck size={16} /> <span className="topbar-admin-label">管理后台</span>
            </button>
          )}
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
            <button
              type="button"
              className="topbar-action-button"
              onClick={async () => { await signOut(); dispatch({ type: 'SET_LOGGED', logged: false, phone: '' }); }}
            >
              <MdCheck size={16} /> 已登录
            </button>
          ) : (
            <button
              type="button"
              className="topbar-action-button"
              onClick={() => dispatch({ type: 'SHOW_LOGIN', show: true })}
            >
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
  const canAdmin = state.accountAccess?.role === 'owner';

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
    'video-studio': VideoStudioPage,
    admin: AdminConsolePage,
  };
  const PageComponent = page === 'admin' && !canAdmin
    ? HomePage
    : (pageMap[page] || HomePage);
  const previewItem = galleryItem || result;
  const galleryNotice = () => dialog.notice({
    title: '请先生成自己的作品',
    message: '案例用于查看效果，生成自己的作品后即可继续编辑或下载。',
  });

  return (<>
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
