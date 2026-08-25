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
  mode: 'ecommerce',  // content | ecommerce — 默认电商生图
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

function createInitialState() {
  const browserQaState = createCanvasBrowserQaState({
    enabled: import.meta.env.DEV,
    search: globalThis.location?.search || '',
  });
  return browserQaState ? { ...initialState, ...browserQaState } : initialState;
}

function createEmptyCanvasResult() {
  return {
    id: 'canvas-empty-workspace',
    _ecResult: true,
    _emptyCanvas: true,
    product_name: '电商画布',
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
      return {
        ...state,
        logged: Boolean(action.logged),
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
    dispatch({ type: 'SET_LOGGED', logged: false, phone: '' });
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