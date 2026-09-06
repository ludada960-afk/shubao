/**
 * 薯包AI · App 路由（V3 灵图风格视觉统一）
 */
import React, { useEffect, Suspense } from 'react';
import { AppProvider, useApp, pathnameToPage } from './store/AppContext';
import { TaskProvider } from './store/taskStore';
import { MdCheck } from 'react-icons/md';
import { FolderOpen, Images, LayoutGrid, ShieldCheck, Sparkles, SquarePlay } from 'lucide-react';
import { IMAGES } from './constants/images';
import { LoginModal, PricingModal } from './components/business/Modals';
import TaskSidebar from './components/task/TaskSidebar';
import ErrorBoundary from './components/ErrorBoundary';
import { DialogProvider, useDialog } from './components/ui/DialogProvider.jsx';
import { LongTaskProvider } from './components/ui/LongTaskProvider.jsx';
import { LongTaskOverlay } from './components/ui/LongTaskOverlay.jsx';
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
const VisionFeedbackPage = React.lazy(() => import('./pages/VisionFeedback/index.jsx'));
const ProductArchivePage = React.lazy(() => import('./pages/ProductArchive/index.jsx'));
const PublicTemplatesPage = React.lazy(() => import('./pages/PublicTemplates/index.jsx'));
const TermsPage = React.lazy(() => import('./pages/Legal/index.jsx').then(mod => ({ default: mod.TermsPage })));
const PrivacyPage = React.lazy(() => import('./pages/Legal/index.jsx').then(mod => ({ default: mod.PrivacyPage })));
import LoadingView from './pages/Generate/Loading';
import NoteModal from './NoteModal';
import { downloadZip, saveWork, regenerateText, proxyImg } from './services/api';
import { signOut } from './services/auth';
import { shouldShowNoteModal } from './routing/resultRouting';
import { buildContentCanvasResult } from './utils/contentCanvasHandoff.js';
import AccountEntitlementControl from './components/billing/AccountEntitlementControl.jsx';
import CreativeDomainNav from './components/layout/CreativeDomainNav.jsx';
import ThemeSwitcher from './components/layout/ThemeSwitcher.jsx';

function SideNav() {
  const { state, dispatch } = useApp();
  const { page } = state;
  const requestLogin = target => {
    const destination = typeof target === 'string' ? target : target?.type === 'OPEN_CANVAS' ? 'ec-canvas' : target?.page;
    dispatch({
      type: 'SET_LOGIN_INTENT',
      intent: { destination, source: state.page, ...(typeof target === 'object' && target?.tab ? { canvasTab: target.tab } : {}) },
    });
    dispatch({ type: 'SHOW_LOGIN', show: true });
  };
  const items = [
    {
      icon: Sparkles,
      motion: 'sparkles',
      label: '开始创作',
      isPrimary: true,
      active: page === 'home',
      onClick: () => dispatch({ type: 'NEW_WORK' }),
    },
    {
      icon: SquarePlay,
      motion: 'video',
      label: '视频创作',
      active: page === 'video-studio',
      onClick: () => {
        if (!state.logged) return requestLogin('video-studio');
        dispatch({ type: 'NAVIGATE', page: 'video-studio' });
      },
    },
    {
      icon: LayoutGrid,
      motion: 'grid',
      label: '画布',
      active: page === 'ec-canvas',
      onClick: () => {
        if (!state.logged) return requestLogin('ec-canvas');
        dispatch({ type: 'OPEN_CANVAS' });
      },
    },
    {
      icon: FolderOpen,
      motion: 'folder',
      label: '作品',
      active: false,
      onClick: () => {
        if (!state.logged) return requestLogin('works');
        dispatch({ type: 'OPEN_CANVAS', tab: 'works' });
      },
    },
    {
      icon: Images,
      motion: 'assets',
      label: '素材',
      active: page === 'ec-canvas' && state.canvasEntryTab === 'assets',
      onClick: () => {
        if (!state.logged) return requestLogin({ type: 'OPEN_CANVAS', tab: 'assets' });
        dispatch({ type: 'OPEN_CANVAS', tab: 'assets' });
      },
    },
  ];

  return (
    <nav className="app-side-nav" aria-label="快速创作导航">
      {items.map(item => {
        const Icon = item.icon;
        return (
          <button
            key={item.label}
            type="button"
            onClick={item.onClick}
            aria-label={item.label}
            aria-current={item.active ? 'page' : undefined}
            data-nav-icon={item.motion}
            className={`app-side-nav-item${item.isPrimary ? ' is-primary' : ''}${item.active ? ' is-active' : ''}`}
          >
            <span className={`app-side-nav-icon motion-${item.motion}`} aria-hidden="true">
              <Icon size={item.isPrimary ? 19 : 20} strokeWidth={2.1} />
            </span>
            <span className="app-side-nav-tooltip" role="tooltip" aria-hidden="true">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

/* ═══════ TopBar（无容器，直接浮在页面）═══════ */
function TopBar() {
  const { state, dispatch, refreshBillingBalance } = useApp();
  const { logged, ecPoints, unlimited, balanceRefreshStatus } = state;
  const canAdmin = state.accountAccess?.role === 'owner';
  const [compact, setCompact] = React.useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => { ticking = false; setCompact((window.scrollY || 0) > 120); });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

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
    <div className={'app-topbar' + (compact ? ' is-compact' : '')} style={{ zIndex: 1100, userSelect: 'none' }}>
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
          <ThemeSwitcher />
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
    if (hash.startsWith('#/vision')) {
      dispatch({ type: 'NAVIGATE', page: 'vision-feedback' });
    }
    // V2 P3：商品档案独立页（P3 · 4c183cd4 续命），URL 由独立页组件自己从 hash 解析，
    // 这里只需把当前 page 切到 product-archive，让路由表正确挂载独立页。
    if (/^#?\/?product-archives\/[^/?#\s]+/i.test(hash)) {
      dispatch({ type: 'NAVIGATE', page: 'product-archive' });
    }
    // V2 P3：公共模板社区页（4c183cd4 续命），hash 形式 #/public-templates 进入。
    if (/^#?\/?public-templates(\?.*)?$/i.test(hash) || /^#?\/?public-templates\/?$/i.test(hash)) {
      dispatch({ type: 'NAVIGATE', page: 'public-templates' });
    }
  }, []);

  // 4c183cd4 续命: 监听浏览器前进/后退 (popstate) 同步 page.
  // AppContext.createInitialState 已根据初始 pathname 设好 page, 但用户在 SPA
  // 内部点导航或浏览器按返回键时, 需把 URL 变化反映到 state.page 才能保持
  // URL 与视图一致. 不影响 SPA 内部 dispatch NAVIGATE 的现有行为.
  useEffect(() => {
    const handlePopState = () => {
      const pathname = (typeof window !== 'undefined' && window.location && window.location.pathname) || '';
      const nextPage = pathnameToPage(pathname);
      if (nextPage && nextPage !== page) {
        dispatch({ type: 'NAVIGATE', page: nextPage });
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [dispatch, page]);

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
    'vision-feedback': VisionFeedbackPage,
    'product-archive': ProductArchivePage,
    'public-templates': PublicTemplatesPage,
    'admin': AdminConsolePage,
    'terms': TermsPage,
    'privacy': PrivacyPage,
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
    {/* V4 P0-3 (D2) 长任务全屏进度条 overlay, 由 LongTaskProvider 驱动 */}
    <LongTaskOverlay />
  </>);
}

export default function App() {
  return (
    <AppProvider>
      <TaskProvider>
        <DialogProvider>
          <LongTaskProvider>
            <ErrorBoundary>
              <AppRouter />
            </ErrorBoundary>
          </LongTaskProvider>
        </DialogProvider>
      </TaskProvider>
    </AppProvider>
  );
}