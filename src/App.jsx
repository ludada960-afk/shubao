/**
 * 薯包AI · App 路由（V3 灵图风格视觉统一）
 */
import React, { useState, useEffect, Suspense } from 'react';
import { AppProvider, useApp } from './store/AppContext';
import { TaskProvider, useTasks } from './store/taskStore';
import { MdAutoAwesome, MdCheck, MdDashboard, MdFolder, MdGridOn } from 'react-icons/md';
import { IMAGES } from './constants/images';
import { LoginModal, PricingModal } from './components/business/Modals';
import TaskSidebar from './components/task/TaskSidebar';
import GenModal from './components/task/GenModal';
import ErrorBoundary from './components/ErrorBoundary';
const HomePage = React.lazy(() => import('./pages/Home/index'));
const PricingPage = React.lazy(() => import('./pages/Pricing/index'));
const WorksPage = React.lazy(() => import('./pages/Works/index'));
const RemakePage = React.lazy(() => import('./pages/Remake/index'));
const PlogPage = React.lazy(() => import('./pages/Plog/index'));
const EcCanvasPage = React.lazy(() => import('./pages/EcCanvas/index'));
import LoadingView from './pages/Generate/Loading';
import NoteModal from './NoteModal';
import { downloadZip, saveWork, regenerateText } from './services/api';

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
      onClick: () => dispatch({ type: 'NAVIGATE', page: 'ec-canvas' }),
    },
    {
      icon: <MdFolder size={20} />,
      label: '作品',
      active: page === 'works',
      onClick: () => dispatch({ type: 'NAVIGATE', page: 'works' }),
    },
  ];

  return (
    <div style={{
      position: 'fixed', left: 0, top: '50%', transform: 'translateY(-50%)',
      zIndex: 200, display: 'flex', flexDirection: 'column', gap: 3,
      padding: '6px', marginLeft: 12,
      background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(20px)',
      borderRadius: 18, border: '1px solid rgba(0,0,0,0.07)',
      boxShadow: '0 4px 24px rgba(0,0,0,0.10)',
    }}>
      {items.map((item, i) => {
        const isGen = item.isPrimary;
        // 生图按钮：在生图页=全渐变白字；其他页=淡紫底+紫字+紫色边框
        const bg = isGen
          ? (item.active
              ? 'linear-gradient(135deg, #7c3aed, #a78bfa)'
              : 'linear-gradient(135deg, rgba(124,58,237,0.10), rgba(167,139,250,0.08))')
          : item.active ? 'rgba(0,0,0,0.07)' : 'transparent';
        const color = isGen
          ? (item.active ? '#fff' : '#7c3aed')
          : item.active ? '#1a1a1a' : '#999';
        const border = isGen && !item.active
          ? '1.5px solid rgba(124,58,237,0.22)'
          : '1.5px solid transparent';

        return (
          <div key={i} onClick={item.onClick} title={item.label}
            style={{
              width: 40, height: 40, borderRadius: 12,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', transition: 'all 0.15s',
              background: bg, color, border,
            }}
            onMouseEnter={e => {
              if (!item.active)
                e.currentTarget.style.background = isGen
                  ? 'linear-gradient(135deg, rgba(124,58,237,0.18), rgba(167,139,250,0.15))'
                  : 'rgba(0,0,0,0.06)';
            }}
            onMouseLeave={e => { e.currentTarget.style.background = bg; }}>
            {item.icon}
          </div>
        );
      })}
    </div>
  );
}

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
        {/* Left: Logo — 匹配灵图: 侧面阴影 + 26px文字 + 薯包 AI */}
        <div onClick={() => dispatch({ type: 'NAVIGATE', page: 'home' })}
          style={{ display: 'flex', alignItems: 'center', gap: 16, cursor: 'pointer', height: 50 }}>
          <span style={{
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* 我的作品 */}
          <button onClick={() => dispatch({ type: 'NAVIGATE', page: 'ec-canvas' })}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, height: 44,
              padding: '0 14px', border: 'none', borderRadius: 'var(--radius-full)',
              background: page === 'ec-canvas' ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.5)',
              fontSize: 13, fontWeight: page === 'ec-canvas' ? 900 : 500,
              color: page === 'ec-canvas' ? 'var(--accent)' : 'var(--text-muted)',
              cursor: 'pointer', fontFamily: 'inherit',
              backdropFilter: 'blur(8px)',
              transition: 'all 0.12s', whiteSpace: 'nowrap',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.85)'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(57,45,26,0.08)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = page === 'ec-canvas' ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.5)'; e.currentTarget.style.boxShadow = 'none'; }}>
            <MdDashboard size={16} />
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
            <MdAutoAwesome size={16} fill="rgba(252,211,77,0.8)" color="#FCD34D" />
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
  const { tasks, addTask, updateTask } = useTasks();
  const { page, genState, result } = state;
  const [activeTaskId, setActiveTaskId] = useState(null);
  const [genModalOpen, setGenModalOpen] = useState(false);

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
    'ec-canvas': EcCanvasPage,
  };
  const PageComponent = pageMap[page] || HomePage;

  return (<>
    <SideNav />
    <TaskSidebar onOpenTask={(id) => { setActiveTaskId(id); setGenModalOpen(true); }} />
    {page !== 'ec-canvas' && <TopBar />}
    {genState === 'result' && result && !(result._ecResult && page === 'ec-canvas') ? (
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
      <React.Suspense fallback={<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontSize: 16, color: '#999' }}>加载中…</div>}>
        <PageComponent key={state._workVersion || 0} />
      </React.Suspense>
    )}
    {genState === 'loading' && (
      <div style={{ position:'fixed', inset:0, zIndex:9999, background:'var(--bg)' }}>
        <LoadingView />
      </div>
    )}
    {/* 生图弹窗 */}
    {genModalOpen && activeTaskId && (
      <GenModal
        activeTaskId={activeTaskId}
        onClose={() => setGenModalOpen(false)}
        onMinimize={() => setGenModalOpen(false)}
      />
    )}
    <LoginModal />
    <PricingModal />
  </>);
}

export default function App() {
  return (<AppProvider><TaskProvider><ErrorBoundary><AppRouter /></ErrorBoundary></TaskProvider></AppProvider>);
}
