import React, { createContext, useContext, useReducer, useCallback, useEffect, useRef } from 'react';
import {
  getSession,
  onSessionInvalid,
  onSessionRestored,
  adoptOauthBootstrap,
  startSessionAutoRefresh,
  stopSessionAutoRefresh,
} from '../services/auth';
import { fetchBillingBalance, fetchBillingCatalog, fetchBillingLedger } from '../services/billing';
import { fetchAccountAccess } from '../services/admin.js';
import { clearPendingPaidAction, loadPendingPaidAction } from '../utils/pendingPaidAction.js';
import {
  createSessionRequestGate,
  normalizeEntitlement,
  withCreditsCompatibility,
} from './entitlementState';
import { createCanvasBrowserQaState } from '../pages/EcCanvas/canvasBrowserQaState.js';

const AppContext = createContext(null);

const initialState = {
  // 路由
  page: 'home',       // home | gallery | pricing | works
  // 生成状态
  genState: 'idle',   // idle | loading | result
  genStage: 0,
  result: null,
  // 用户
  logged: false,
  phone: '',
  ecPoints: 0,
  ecPointsExpiring: 0,
  ecPointsExpiresAt: null,
  contentSets: 0,
  credits: 0,
  unlimited: false,
  balanceRefreshStatus: 'idle',
  balanceRefreshError: '',
  billingCatalog: null,
  billingLedger: [],
  accountAccess: null,
  // UI
  showLogin: false,
  loginIntent: null,
  showPrice: false,
  priceReason: null,
  pendingPaidAction: null,
  // 模式
  /* 2026-09-17 首页收敛：一级入口只剩两张卡（视频生成 / 图片生成），
     默认必须是**其中一张**，否则扇形是个没有选中项的 tablist（页面打开就对不上）。
     取第一张卡（视频生成）：与卡片顺序、以及首屏 LCP 预载（entry-video，fetchpriority=high）
     三者一致。要换默认只改这一行 —— 卡片顺序不会跟着乱。 */
  mode: 'video',  // video | visual — 首页两张入口卡；content/ecommerce 见技能子页面与恢复链路
  creationLaunch: null,
  priceTab: 'credits',
  // 作品集
  works: [],
  // 展示
  galleryItem: null,
  // 输入
  inputText: '',
  scrollPos: 0,
};

// 4c183cd4 续命: 用户 8-30 反馈 "画布/视频创作/全部都打不开"
// 根因: App.jsx 是 state-based 路由, 不读 window.location.pathname.
//       vite HTML5 history fallback 让 /canvas /video-studio /ec-canvas 都返回
//       index.html (HTTP 200), 但 React 内部 state.page 永远是 'home', 任何
//       deep-link URL 都会渲染首页. 现在把已知的 deep-link 路径映射到正确 page.
const PATHNAME_PAGE_MAP = Object.freeze({
  '/': 'home',
  '/canvas': 'ec-canvas',
  '/video-studio': 'video-studio',
  /* 9-17：媒体板块页（做法参照竞品 /image-creation?id=，一个页面渲染全部技能）。
     老入口一个都没删：这四个路径只是**新增**可达地址，兼容期内并存。 */
  '/image-creation': 'image-creation',
  '/video-creation': 'video-creation',
  '/ec-canvas': 'ec-canvas',
  '/pricing': 'pricing',
  '/public-templates': 'public-templates',
  '/ec-studio': 'ec-studio',
  '/ec-auto': 'ec-auto',
  '/plog': 'plog',
  '/terms': 'terms',
  '/privacy': 'privacy',
});

export function pathnameToPage(pathname) {
  const safe = pathname || (typeof globalThis !== 'undefined' && globalThis.location ? globalThis.location.pathname : '');
  if (typeof safe !== 'string' || safe.length === 0) return 'home';
  const trimmed = safe.split('?')[0].split('#')[0];
  if (Object.prototype.hasOwnProperty.call(PATHNAME_PAGE_MAP, trimmed)) {
    return PATHNAME_PAGE_MAP[trimmed];
  }
  return 'home';
}

function createInitialState() {
  const browserQaState = createCanvasBrowserQaState({
    enabled: import.meta.env.DEV,
    search: globalThis.location?.search || '',
  });
  const base = browserQaState ? { ...initialState, ...browserQaState } : { ...initialState };
  /* 9-17：真实登录态 QA 通道把 page 钉死，任何后续按 pathname 的推导都不许覆盖它 ——
     否则这条通道会时好时坏地落回首页（实测：同一 URL 刷新两次，一次进画布一次进首页），
     而「加入资产库」这类只在画布上存在的链路就永远无法稳定复现/回归。 */
  if (base.qaPagePinned) return base;
  // 4c183cd4 续命: 根据 window.location.pathname 决定初始 page,
  // 让 /canvas /video-studio /ec-canvas 等 deep-link URL 进入对应页面
  // (而不是永远停留在 home). /login 自动弹登录弹窗, 其它路径走 PATHNAME_PAGE_MAP.
  /* 9-17：真实登录态 QA 通道（?qa=ec-canvas-real）自己钉了 page，pathname 不许覆盖它 ——
     否则它会落到首页，画布这条链就永远测不到（这正是「加入资产库」bug 长期漏网的原因）。 */
  if (!base.browserQa && !base.qaPagePinned) {
    const pathname = (typeof globalThis !== 'undefined' && globalThis.location && globalThis.location.pathname) || '';
    const page = pathnameToPage(pathname);
    base.page = page;
    if (pathname === '/login') {
      base.showLogin = true;
    }
  }
  return base;
}

function createEmptyCanvasResult() {
  return {
    id: 'canvas-empty-workspace',
    _ecResult: true,
    _emptyCanvas: true,
    /* 9-13 用户批注（说了很多遍）：「这个地方不叫电商画布，各种各样的创作都会进来这个画布」
       —— 空画布不再冒充某个项目名，顶部标题回落到「智能画布」；
       下游所有用到 product_name 的地方本来就有各自的兜底（'商品'/'画布创作'…）。 */
    product_name: '',
    category: '电商图片',
    platform: '淘宝',
    productAssets: [],
    referenceAssets: [],
    images: [],
    imageRecords: [],
  };
}

function reducer(state, action) {
  switch (action.type) {
    case 'NAVIGATE':
      if (action.page === 'works') {
        return {
          ...state,
          page: 'ec-canvas',
          canvasEntryTab: 'works',
          galleryItem: null,
          result: state.result || createEmptyCanvasResult(),
        };
      }
      return { ...state, page: action.page, galleryItem: null };
    case 'OPEN_CANVAS':
      return {
        ...state,
        page: 'ec-canvas',
        canvasEntryTab: action.tab || 'canvas',
        galleryItem: null,
        result: state.result || createEmptyCanvasResult(),
      };
    case 'SET_CANVAS_ENTRY_TAB':
      return {
        ...state,
        canvasEntryTab: ['canvas', 'assets', 'works', 'trash'].includes(action.tab) ? action.tab : state.canvasEntryTab,
      };
    case 'NEW_WORK':
      return { ...state, page: 'home', genState: 'idle', result: null, galleryItem: null, _workVersion: (state._workVersion || 0) + 1 };
    case 'SET_MODE':
      return { ...state, mode: action.mode };
    case 'SET_CREATION_LAUNCH':
      return { ...state, creationLaunch: action.launch || null };
    case 'SET_INPUT':
      return { ...state, inputText: action.text };
    case 'START_GEN':
      return { ...state, genState: 'loading', genStage: 0, scrollPos: window.scrollY };
    case 'SET_STAGE':
      return { ...state, genStage: action.stage };
    case 'SET_RESULT':
      return { ...state, genState: 'result', result: action.result };
    case 'CLOSE_RESULT':
      return { ...state, genState: 'idle', result: null };
    case 'UPDATE_RESULT':
      return { ...state, result: action.updater(state.result) };
    case 'SET_LOGGED':
      /* ═══ 2026-09-18 产品风险修复：区分「真登出」与「会话失效引导」 ═══════════
         用户批注（点「新建画布」触发 401 后）：「用户画布上的内容会从视图里整个消失。
         真实用户如果会话过期或误触，会有『我的画布没了 / 工作丢了』的强烈错觉。」

         根因：原来任何 SET_LOGGED:false 都会**顺带把页面上下文整段重置**
         （page→home、result→null、genState→idle…）。而 401 时 AppContext 的
         onSessionInvalid 也走这条分支 —— 于是「会话过期」被当成了「用户主动登出」，
         画布被卸载 + result 被清空，用户看到的就是「画布没了」。

         修法：只对**401/会话失效**这条路径保留页面上下文（softSignOut:true）——
         用户回到登录引导，但当前页面与数据**原样保留**，登录后接着看。
         主动点「退出登录」仍是硬登出（清空），语义不变。
         注意：result 被保留 → 画布节点不丢；ecPoints 等账户态仍归零（它们本就无效）。 */
      const softSignOut = action.logged === false && action.softSignOut === true;
      if (softSignOut) {
        return {
          ...state,
          logged: false,
          phone: '',
          /* 账户相关态失效（金额/额度在会话过期后无意义） */
          ecPoints: 0,
          ecPointsExpiring: 0,
          ecPointsExpiresAt: null,
          contentSets: 0,
          credits: 0,
          unlimited: false,
          balanceRefreshStatus: 'idle',
          balanceRefreshError: '',
          accountAccess: null,
          pendingPaidAction: null,
          /* 页面上下文**保持不变**：page / result / genState / 画布内容都留着 */
        };
      }
      return {
        ...state,
        logged: Boolean(action.logged),
        /* ⚠️ 2026-10-04 修：登录态成立时**必须关掉登录弹窗**。
           用户反馈「经常一访问就弹出登录，但是其实之前已经登录了，要关掉登录弹窗
           或者刷新一下才能看到登录了」——
           关键在后半句：登录态其实**恢复成功**了，只是弹窗盖在上面不撤。
           根因是所有"会话恢复成功"的通道（onSessionRestored、挂载期 getSession、
           401 后的静默续期）都只 dispatch SET_LOGGED，**从不 dispatch SHOW_LOGIN:false**，
           于是 logged===true 与 showLogin===true 长期共存。
           放在 reducer 里而不是各调用点，是因为"已登录"与"弹着登录框"在语义上
           本来就不该同时成立 —— 每条恢复通道各写一遍，漏一条就会复现。
           ⚠️ 只在 logged===true 时关：用户主动点登录框时 logged 还是 false，
              不受影响；401 的软登出走的是上面 softSignOut 分支，也不受影响。 */
        ...(action.logged ? { showLogin: false } : {}),
        phone: Object.prototype.hasOwnProperty.call(action, 'phone') ? action.phone : state.phone,
        ...(action.logged ? {} : {
          page: 'home',
          genState: 'idle',
          genStage: 0,
          result: null,
          galleryItem: null,
          works: [],
          creationLaunch: null,
          loginIntent: null,
          inputText: '',
          scrollPos: 0,
          canvasEntryTab: 'canvas',
          ecPoints: 0,
          ecPointsExpiring: 0,
          ecPointsExpiresAt: null,
          contentSets: 0,
          credits: 0,
          unlimited: false,
          balanceRefreshStatus: 'idle',
          balanceRefreshError: '',
          billingCatalog: null,
          billingLedger: [],
          accountAccess: null,
          pendingPaidAction: null,
          priceReason: null,
          showPrice: false,
        }),
      };
    case 'SET_ACCOUNT_ACCESS':
      return { ...state, accountAccess: action.account || null };
    case 'SET_ENTITLEMENT':
      return {
        ...state,
        ecPoints: action.ecPoints,
        ecPointsExpiring: Object.prototype.hasOwnProperty.call(action, 'ecPointsExpiring')
          ? action.ecPointsExpiring
          : state.ecPointsExpiring,
        ecPointsExpiresAt: Object.prototype.hasOwnProperty.call(action, 'ecPointsExpiresAt')
          ? action.ecPointsExpiresAt
          : state.ecPointsExpiresAt,
        contentSets: action.contentSets,
        credits: action.contentSets,
        unlimited: Boolean(action.unlimited),
      };
    case 'SET_BALANCE_REFRESH':
      return {
        ...state,
        balanceRefreshStatus: action.status || 'idle',
        balanceRefreshError: action.error || '',
      };
    case 'SET_CREDITS':
      return {
        ...state,
        contentSets: action.unlimited ? null : action.credits,
        credits: action.unlimited ? null : action.credits,
        unlimited: Boolean(action.unlimited),
      };
    case 'ADD_CREDITS':
      return state.unlimited ? state : {
        ...state,
        contentSets: (state.contentSets || 0) + action.amount,
        credits: (state.contentSets || 0) + action.amount,
      };
    case 'SET_BILLING_CATALOG':
      return { ...state, billingCatalog: action.catalog };
    case 'SET_BILLING_LEDGER':
      return { ...state, billingLedger: action.ledger };
    case 'SHOW_LOGIN':
      return { ...state, showLogin: action.show };
    case 'SET_LOGIN_INTENT':
      return { ...state, loginIntent: action.intent || null };
    case 'SHOW_PRICE':
      return { ...state, showPrice: action.show };
    case 'OPEN_PAYWALL':
      return { ...state, showPrice: true, priceTab: 'credits', priceReason: action.reason || 'INSUFFICIENT_CREDITS', pendingPaidAction: action.pendingAction || null };
    case 'RESTORE_PENDING_PAID_ACTION':
      return { ...state, pendingPaidAction: action.pendingAction || null };
    case 'CLEAR_PAYWALL':
      return { ...state, showPrice: false, priceReason: null, pendingPaidAction: null };
    case 'SET_PRICE_TAB':
      return { ...state, priceTab: action.tab };
    case 'SET_WORKS':
      return { ...state, works: action.works };
    case 'VIEW_GALLERY_ITEM':
      return { ...state, galleryItem: action.item };
    default:
      return state;
  }
}

export function AppProvider({ children }) {
  const [state, reducerDispatch] = useReducer(reducer, undefined, createInitialState);
  const sessionRequestGateRef = useRef(null);
  if (!sessionRequestGateRef.current) {
    sessionRequestGateRef.current = createSessionRequestGate();
  }
  const sessionRequestGate = sessionRequestGateRef.current;
  const dispatch = useCallback((action) => {
    if (action?.type === 'SET_LOGGED') sessionRequestGate.invalidate();
    if (action?.type === 'SET_LOGGED' && !action.logged) clearPendingPaidAction();
    if (action?.type === 'CLEAR_PAYWALL') clearPendingPaidAction();
    reducerDispatch(action);
  }, [sessionRequestGate]);

  const refreshBillingBalance = useCallback(async () => {
    const requestEpoch = sessionRequestGate.capture();
    dispatch({ type: 'SET_BALANCE_REFRESH', status: 'refreshing' });
    try {
      const entitlement = normalizeEntitlement(await fetchBillingBalance());
      if (!sessionRequestGate.isCurrent(requestEpoch)) return undefined;
      dispatch({ type: 'SET_ENTITLEMENT', ...entitlement });
      dispatch({ type: 'SET_BALANCE_REFRESH', status: 'ready' });
      return entitlement;
    } catch (error) {
      if (sessionRequestGate.isCurrent(requestEpoch)) {
        dispatch({ type: 'SET_BALANCE_REFRESH', status: 'error', error: error?.message || '额度刷新失败' });
      }
      throw error;
    }
  }, [dispatch, sessionRequestGate]);

  const refreshBillingCatalog = useCallback(async () => {
    const requestEpoch = sessionRequestGate.capture();
    const catalog = await fetchBillingCatalog();
    if (!sessionRequestGate.isCurrent(requestEpoch)) return undefined;
    dispatch({ type: 'SET_BILLING_CATALOG', catalog });
    return catalog;
  }, [dispatch, sessionRequestGate]);

  const refreshBillingLedger = useCallback(async (input) => {
    const requestEpoch = sessionRequestGate.capture();
    const result = await fetchBillingLedger(input);
    if (!sessionRequestGate.isCurrent(requestEpoch)) return undefined;
    const ledger = Array.isArray(result?.entries) ? result.entries : [];
    dispatch({ type: 'SET_BILLING_LEDGER', ledger });
    return ledger;
  }, [dispatch, sessionRequestGate]);

  // Compatibility for pages that still consume the legacy content-set selector.
  const fetchCredits = useCallback(async () => {
    try {
      const entitlement = await refreshBillingBalance();
      return entitlement ? withCreditsCompatibility(entitlement) : undefined;
    } catch (error) {
      return undefined;
    }
  }, [refreshBillingBalance]);

  // 页面加载时从 localStorage 恢复登录状态
  useEffect(() => {
    if (state.browserQa) return undefined;
    const restore = async () => {
      const requestEpoch = sessionRequestGate.capture();
      // OAuth 回调引导页会把会话暂存到 localStorage，先领取再走常规校验。
      adoptOauthBootstrap();
      const session = await getSession();
      if (!sessionRequestGate.isCurrent(requestEpoch)) return;
      if (session?.token) {
        dispatch({ type: 'SET_LOGGED', logged: true, phone: session.email || '' });
        const pendingPaidAction = loadPendingPaidAction(session.email);
        dispatch({ type: 'RESTORE_PENDING_PAID_ACTION', pendingAction: pendingPaidAction });
        refreshBillingBalance().catch(() => {});
        refreshBillingCatalog().catch(() => {});
      }
    };
    restore();
  }, [refreshBillingBalance, refreshBillingCatalog, state.browserQa]);

  useEffect(() => {
    if (!state.logged || state.browserQa) return undefined;
    let active = true;
    fetchAccountAccess()
      .then((result) => {
        if (active) dispatch({ type: 'SET_ACCOUNT_ACCESS', account: result.account || null });
      })
      .catch(() => {
        if (active) dispatch({ type: 'SET_ACCOUNT_ACCESS', account: null });
      });
    return () => { active = false; };
  }, [state.logged, state.browserQa, dispatch]);

  useEffect(() => onSessionInvalid(() => {
    /* 2026-09-18：401/会话失效 = **引导重新登录**，不是「用户主动登出」。
       用 softSignOut 保留当前页面与数据（否则画布会被整段重置，
       用户看到「我的画布没了」——产品风险，见 reducer 内注释）。 */
    dispatch({ type: 'SET_LOGGED', logged: false, phone: '', softSignOut: true });
    dispatch({ type: 'SHOW_LOGIN', show: true });
  }), [dispatch]);

  // P2：登录期间静默续期 access token（定时 tick，临期 5 分钟内才真正发起 refresh）。
  useEffect(() => {
    if (!state.logged || state.browserQa) return undefined;
    startSessionAutoRefresh();
    return () => stopSessionAutoRefresh();
  }, [state.logged, state.browserQa]);

  // P2：静默刷新/OAuth 引导恢复会话后，把 UI 拉回已登录态。
  useEffect(() => onSessionRestored(session => {
    if (session?.email) dispatch({ type: 'SET_LOGGED', logged: true, phone: session.email });
  }), [dispatch]);

  return (
    <AppContext.Provider value={{
      state,
      dispatch,
      fetchCredits,
      refreshBillingBalance,
      refreshBillingCatalog,
      refreshBillingLedger,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be inside AppProvider');
  return ctx;
}

/* 便捷 hooks */
export function useNav() {
  const { dispatch } = useApp();
  return useCallback((page) => dispatch({ type: 'NAVIGATE', page }), [dispatch]);
}