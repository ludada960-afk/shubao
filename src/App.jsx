/**
 * 薯包AI · App 路由（V3 灵图风格视觉统一）
 */
import React, { useEffect, Suspense } from 'react';
import { AppProvider, useApp, pathnameToPage } from './store/AppContext';
import { TaskProvider } from './store/taskStore';
import { ArrowLeft, FolderOpen, Images, LayoutGrid, ShieldCheck, Sparkles } from 'lucide-react';
import { IMAGES } from './constants/images';
import { LoginModal, PricingModal } from './components/business/Modals';
import TaskSidebar from './components/task/TaskSidebar';
import ErrorBoundary from './components/ErrorBoundary';
import { DialogProvider, useDialog } from './components/ui/DialogProvider.jsx';
import { LongTaskProvider } from './components/ui/LongTaskProvider.jsx';
import { LongTaskOverlay } from './components/ui/LongTaskOverlay.jsx';
import { resetPageScrollLock } from './components/ui/useModalScrollLock.js';
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
const MediaCreationPage = React.lazy(() => import('./pages/MediaCreation/index.jsx'));
const TermsPage = React.lazy(() => import('./pages/Legal/index.jsx').then(mod => ({ default: mod.TermsPage })));
const PrivacyPage = React.lazy(() => import('./pages/Legal/index.jsx').then(mod => ({ default: mod.PrivacyPage })));
import LoadingView from './pages/Generate/Loading';
import NoteModal from './NoteModal';
import { downloadZip, saveWork, regenerateText, proxyImg } from './services/api';
import { signOut } from './services/auth';
import { shouldShowNoteModal } from './routing/resultRouting';
import { buildContentCanvasResult } from './utils/contentCanvasHandoff.js';
import AccountEntitlementControl from './components/billing/AccountEntitlementControl.jsx';
import MemberCenterModal from './pages/Home/MemberCenterModal.jsx';
import CreativeDomainNav from './components/layout/CreativeDomainNav.jsx';
import AppSidebar from './components/layout/AppSidebar.jsx';
import './styles/app-sidebar.css';
import ThemeSwitcher from './components/layout/ThemeSwitcher.jsx';

/* 旧的悬浮图标栏 SideNav 已删除（用户 9-18 批注 #1）：它既放不下技能入口，
   又只有图标——用户看不懂每个按钮是什么。取而代之的是左侧常驻导航 AppSidebar，
   它承载「图片生成 / 视频生成」两个总页面与各自的精品推荐入口。 */

/* ═══════ TopBar（无容器，直接浮在页面）═══════ */
/* ═══ 三级顶栏（2026-09-19 批 H-8，用户批注 #11-⑤ / #12 / #13）══════════════════════
   用户的原始要求把三级的顶栏分别说清楚了：
     · 首页（一级）  ：左 LOGO + 右积分账户；
     · 总页面（二级）：分类 + 右积分账户（分类就是 CreativeDomainNav，见 .app-board-bar）；
     · 子页面（三级）：**左 返回 + 中 名称 + 右 积分账户**（批注 #12 逐字）。
   子页面的「我是谁」由页面自己 publish 上来（MediaCreation 用 useLayoutEffect 调
   onSubpageHeader），因为只有它知道当前是哪条技能、返回要回到哪个 Hub。
   ⚠️ 为什么是 useLayoutEffect 而不是 useEffect：useEffect 在**浏览器绘制之后**才跑，
     会先闪一帧「LOGO 顶栏」再换成「返回顶栏」；layout effect 在绘制前跑，不闪。 */
/* 批 J-①（用户批注 #2-1/#3-1/#3-2）：总页面顶栏不渲染 LOGO —— 左导航顶上已经有了，
   同一件事说两遍还各占一格。总页面整行只剩右侧的积分/账户（照 flova「拉到最右边」）。 */
function TopBar({ subpageHeader = null, isBoard = false }) {
  const { state, dispatch, refreshBillingBalance } = useApp();
  const { logged, ecPoints, unlimited, balanceRefreshStatus } = state;
  const canAdmin = state.accountAccess?.role === 'owner';
  const [compact, setCompact] = React.useState(false);
  const [memberOpen, setMemberOpen] = React.useState(false);

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
    <div className={'app-topbar' + (compact ? ' is-compact' : '')} style={{ zIndex: 'var(--sb-z-sticky)', userSelect: 'none' }}>
      {/* 纯 Logo + 按钮行，无背景无框无阴影 */}
      <div className={'topbar-row' + (subpageHeader ? ' is-subpage' : '') + (isBoard && !subpageHeader ? ' is-board' : '')}>
        {/* ═══ 三级顶栏的左/中两格（见 TopBar 顶部注释）═══════════════════════════════
            子页面：左「返回」+ 中「名称」；其余两级：左「LOGO」+ 中留空。
            ═══ 2026-09-24 批 BB：**子页面也要有品牌标**（用户批注，逐字）══════════════════════════
            原话：「我不明白你为什么**子页面里面的左上角就没有 LOGO** 了呢？」
            ⚠️ 这条**推翻了批 J-① 那条旧裁定**（"子页面顶栏三格 = 左返回/中名称/右积分，多一个 LOGO
              就变成四格"）。用户现在明确要子页面也有品牌标 ⇒ 子页面这一格改成
              **[品牌标（缩小版）｜返回 + 名称]**：品牌标在最左、返回紧贴其后，右侧仍是积分账户那一簇，
              格子数没变（还是三格），只是左格从"只有返回"变成"品牌 + 返回"。
              依据：用户在同一个批注里同时要求"子页面要有 LOGO"与"LOGO 整体要升级"，
              这两件事必须一起做，否则子页面会顶着一个旧样式的标。 */}
        {subpageHeader ? (<>
          {/* 品牌标与「返回」同处**第一格**（栅格仍是三格：左组 / 中名称 / 右账户）——
              放进同一格里，`.topbar-row.is-subpage` 的 `1fr auto 1fr` 一行三格不用动，
              标题照旧真居中。 */}
          <span className="topbar-subpage-lead">
            <span className="topbar-brand" aria-hidden="true">
              <img className="topbar-brand-mark" src={IMAGES.brandMark} alt="" width="24" height="24" />
              <span className="topbar-logo">薯包 AI</span>
            </span>
            <button
              type="button"
              className="topbar-back"
              onClick={() => subpageHeader.onBack?.()}
            >
              <ArrowLeft size={16} aria-hidden="true" />
              <span>返回</span>
            </button>
          </span>
          <span className="topbar-title" title={subpageHeader.name || ''}>{subpageHeader.name}</span>
        </>) : (<>
        {/* ═══ 2026-09-24 批 AV：总页面**也要渲染 LOGO**（用户图五批注 3）══════════════════════════
            用户原话：「然后为什么我进来这个图片生成和视频生成的**总页面**这里**左上角的 LOGO
            会不见了呢**。这个也很突兀啊，你要搞进来啊。」
            这是一次**回归**，不是设计取舍出问题：批 J-① 当初把总页面的 LOGO 去掉，理由是
            「左导航顶上已经有了，同一件事说两遍」—— 但**批 L-6 随后把左导航顶上那颗品牌标
            也撤掉了**（改成顶栏一颗）。两条各自成立、合起来的结果是总页面**一颗都没有**了。
            ⇒ 现在左侧品牌标只在顶栏这一处（唯一实现），三类页面（首页/总页面/子页面）里
              首页与总页面都走这一份；子页面按批 J-① 的定论仍是「返回 + 名称」，不加第四格。 */}
        {/* Left: Logo — 匹配灵图: 侧面阴影 + 26px文字 + 薯包 AI */}
        {/* D11 键盘可达：Logo 是「回首页」导航动作 → button + 重置默认样式（外观零变化） */}
        {/* ═══ 2026-09-24 批 BB：**品牌标做一次设计升级**（用户批注，逐字）══════════════════════════
            原话：「而且我们现在这个 LOGO 和文字都特别的 low。我不知道你为什么没有去做一个
            **LOGO 的样式升级**……他们现在的问题就是**太过于随意了**，就是简单的一个图标，然后再放上
            几个没有经过任何修饰的这种简单的字上去而已……你现在的情况就是有了图标，但是你的
            **薯包 AI 这几个字太过于简单了**，而且他们之间也**没有什么交互感**。你应该自己去想办法
            把他们做一个升级和处理呀。」
            ═══ 2026-09-24 批 BE：**两态品牌标 + 字标回归统一**（用户原话，逐字）═══════════════════
            「这个部分当**只有左边导航栏出现**的时候，你就要出现 LOGO，LOGO 要先做好跟左边导航栏的
              **整体适配**；然后当我**向下挪页面**的时候，不是会出现我们上面的导航栏吗，这个时候
              你再**显示出右边的薯包 AI 几个字**；然后这几个字你要**重新设计**一下，**不要搞这么多
              花样**。你就**字体或者其他变化和调整做得统一一些**，不要各做各的呀，乱七八糟的。」
            ⇒ 三件事，与这条批注一一对应：
              ① **LOGO 与左导航对齐**：标水平居中在左侧图标栏那一列上（CSS 里按
                 `--sb-app-sidebar-w/2` 算，与下面每一格的图标中线是同一条）；
              ② **两态**：页面顶部（未滚动）**只显示标**；滚动超过 120px（顶栏变紧凑态、
                 `.app-topbar.is-compact`）才**显示「薯包 AI」这几个字** —— 判据就用既有的
                 `compact` 状态，不新加滚动监听；
              ③ **字标不搞花样**：上一版的「竖分隔线 + 汉字 800 + AI 品牌紫」被否掉，
                 现在**一句话一套样式**（同一字体、同一字重、同一颜色）——
                 拉丁字形仍由字体栈里的 Inter 提供（那是字形回落，不是另一套样式）。 */}
        <button type="button" className="topbar-brand" aria-label="薯包 AI · 回到首页" onClick={() => dispatch({ type: 'NAVIGATE', page: 'home' })}
          style={{ cursor: 'pointer' }}>
          <img
            className="topbar-brand-mark"
            src={IMAGES.brandMark}
            srcSet={`${IMAGES.brandMark2x} 2x, ${IMAGES.brandMark} 3x`}
            alt=""
            width="30"
            height="30"
          />
          <span className="topbar-logo">薯包 AI</span>
        </button>
        </>)}

        {/* ═══ 2026-09-19 批 H-4（用户批注 #11-⑤）：「包括你上面的导航栏也是一样的情况。
            不应该还是左边 LOGO 中间是导航栏。你要看一下别人是怎么做的。」═══════════════
            原来这里是 [左 LOGO] [中 图片生成/视频生成 域导航] [右 账户] 的标准三段式。
            现在中间那一段**从顶栏移走**，改成页面内容区顶部的一条**板块切换条**
            （见下面 .app-board-bar）—— 理由：顶栏的三段式在每一页都占着最贵的位置，
            而"我现在在哪个板块"只在两个总页面/子页面上才有意义；
            首页/画布/作品页的顶栏不该被一条用不上的导航占着。
            ⚠️ CreativeDomainNav 组件本身**没有删**（它承载两个域的数据契约，
              4 个门禁在读它），只是换了挂载位置。 */}
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
            onOpenMemberCenter={() => setMemberOpen(true)}
            onPurchase={() => dispatch({ type: 'SHOW_PRICE', show: true })}
            onLogin={() => dispatch({ type: 'SHOW_LOGIN', show: true })}
          />

          {/* ═══ 批 J（用户批注 #2-5 / #3-2）：「右边的那些**积分啊，会员中心呀，登录啊**这些东西，
              都要抄他们的，这样的一套**表述的语言**会更好。」
              实测我们这里原来是一颗写着「**已登录**」的按钮，可它点下去是**退出登录**
              （onClick 里就是 signOut）—— 标签说的是"状态"，动作却是"登出"，
              这是最容易让人误点的一类文案（用户以为点一下是看账号信息）。
              改成**按它真正干的事命名**：退出登录。登录态本身由旁边那颗账户/积分控件显示，
              不靠这颗按钮再说一遍 —— 与 flova「左边账号状态、右边动作」的分工一致。 */}
          {logged ? (
            <button
              type="button"
              className="topbar-action-button"
              onClick={async () => { await signOut(); dispatch({ type: 'SET_LOGGED', logged: false, phone: '' }); }}
            >
              退出登录
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
      <MemberCenterModal open={memberOpen} onClose={() => setMemberOpen(false)} />
    </div>
  );
}

function AppRouter() {
  const { state, dispatch } = useApp();
  const { page, genState, result, galleryItem } = state;
  const dialog = useDialog();
  const canAdmin = state.accountAccess?.role === 'owner';
  /* 三级顶栏：子页面自己 publish「我是谁 / 返回去哪」（见 TopBar 顶部注释）。
     ⚠️ 换页必须清空 —— 否则从子页面回到 Hub 时，顶栏会残留上一条技能的名字。 */
  const [subpageHeader, setSubpageHeader] = React.useState(null);
  useEffect(() => { setSubpageHeader(null); }, [page]);

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

  /* 9-12 用户批注：切页后如果还有残留的页面滚动锁，页面会「消失+完全卡住」。
     切页是强边界 —— 在这里强制释放一次，保证任何页面切换后都能正常滚动。 */
  useEffect(() => {
    resetPageScrollLock();
  }, [page]);

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
    'image-creation': MediaCreationPage,
    'video-creation': MediaCreationPage,
    /* 9-11 修: 这里原来 admin 出现两次 (vite 报 Duplicate key "admin" in object literal), 后者覆盖前者 —— 去重保留一条 */
    admin: AdminConsolePage,
    'vision-feedback': VisionFeedbackPage,
    'product-archive': ProductArchivePage,
    'public-templates': PublicTemplatesPage,
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

  /* ═══ 外壳：左侧常驻导航 + 主内容（用户 9-18 批注 #1：总页面必须有常驻入口）═══════
     canvas 页整屏自己排版，所以它的外壳里不渲染侧栏（与旧行为一致）。
     ⚠️ 2026-09-18 修：这里必须是一个**纵向 flex 容器**。
        批 A 之前 canvas 页用 height:100vh 且与 topbar **重叠**（topbar 浮在它上面），
        现在 topbar 是文档流里的一条 80px 固定条 —— 若容器不是 flex，
        canvas 页的 100vh 会比可用高度多出 80px，底部工具条被顶出视口（实测 dock y=920 / 视口 900）。
        做成 flex 列之后，画布页用 flex:1 吃满剩余高度（见 EcCanvas.css 的注释）。
        非画布页面：.app-shell 是 flex item，min-height:100vh 保证正常撑高与滚动不变。 */
  const shell = content => (page === 'ec-canvas'
    ? <div className="app-frame">{content}</div>
    : <div className="app-shell"><AppSidebar /><div className="app-main">{content}</div></div>);

  /* ⚠️ TaskSidebar 必须在外壳**内部**：它靠 .app-shell 提供的 --sb-app-sidebar-w 让位给左侧导航；
     放到外壳外面就只能继承 :root 的 0 值，于是又被侧栏压住（这是实测出来的）。 */
  return (<>
    {shell(<>
      <TaskSidebar />
      {/* ═══ 2026-09-24 批 BB：**画布页不再渲染全站顶栏**（用户批注，逐字）═══════════════════════════
          原话：「然后你**画布上面为什么会有这条导航**呢？你要把它**去掉**呀。」
          诊断：这一页 DOM 里其实有**两条**横栏 —— 全站顶栏（薯包 AI / 管理后台 / 积分 / 会员中心）
          与画布自己的 `.ec-canvas-topbar`（返回 / 项目名 / 当前画布·资产库·作品集 / 模板广场 / 导出 /
          新建画布）。两条叠在一起既重复（积分各写一遍），又把画布挤掉一截高度
          （EcCanvas.css 里那条"100vh 比可用高度多出 80px"的老账就是它引起的）。
          ⇒ 画布页只留**它自己那条**：这一页的功能（积分、导出、新建）在画布顶栏里都有。 */}
      {page !== 'ec-canvas' && <TopBar subpageHeader={subpageHeader} isBoard={page === 'image-creation' || page === 'video-creation'} />}
      {/* 板块切换条：只在**总页面**上出现。
          ⚠️ 2026-09-19 批 H-8：子页面（选了某条技能）**不再显示它** ——
             用户批注 #12 把子页面顶栏写定为「左返回 / 中名称 / 右积分账户」，
             没有第三格给分类；而且人在子页面里，"我在哪个板块"已经不是问题了。 */}
      {/* 批 J-①：板块切换条**整条删除**（用户批注 #2-1：「他们的上面……也没有那两个导航栏的」）。
          实测：左导航里本来就有「图片生成 / 视频生成」两个入口，顶上再来一条 = 同一件事说两遍。
          CreativeDomainNav 组件没删（承载两个域的数据契约、多个门禁在读它），只是不再挂在页面上。 */}
      <React.Suspense fallback={<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontSize: 16, color: 'var(--sb-ink-4)' }}>加载中…</div>}>
        <PageComponent key={state._workVersion || 0} onSubpageHeader={setSubpageHeader} />
      </React.Suspense>
    </>)}
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
      <div style={{ position:'fixed', inset:0, zIndex:'var(--sb-z-top)', background:'var(--sb-surface-page)' }}>
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