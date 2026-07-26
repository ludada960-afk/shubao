import React, { createContext, useContext, useReducer, useCallback, useEffect, useRef } from 'react';
import { getSession } from '../services/auth';
import { fetchBillingBalance, fetchBillingCatalog, fetchBillingLedger } from '../services/billing';
import {
  createSessionRequestGate,
  normalizeEntitlement,
  withCreditsCompatibility,
} from './entitlementState';

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
  billingCatalog: null,
  billingLedger: [],
  // UI
  showLogin: false,
  loginIntent: null,
  showPrice: false,
  priceReason: null,
  pendingPaidAction: null,
  // 模式
  mode: 'ecommerce',  // content | ecommerce — 默认电商生图
  priceTab: 'content',
  // 作品集
  works: [],
  // 展示
  galleryItem: null,
  // 输入
  inputText: '',
  scrollPos: 0,
};

function reducer(state, action) {
  switch (action.type) {
    case 'NAVIGATE':
      return { ...state, page: action.page, galleryItem: null };
    case 'NEW_WORK':
      return { ...state, page: 'home', genState: 'idle', result: null, galleryItem: null, _workVersion: (state._workVersion || 0) + 1 };
    case 'SET_MODE':
      return { ...state, mode: action.mode };
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
          ecPoints: 0,
          contentSets: 0,
          credits: 0,
          unlimited: false,
          billingCatalog: null,
          billingLedger: [],
          pendingPaidAction: null,
        }),
      };
    case 'SET_ENTITLEMENT':
      return {
        ...state,
        ecPoints: action.ecPoints,
        contentSets: action.contentSets,
        credits: action.contentSets,
        unlimited: Boolean(action.unlimited),
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
      return { ...state, showPrice: true, priceTab: action.tab || 'ecommerce', priceReason: action.reason || 'INSUFFICIENT_CREDITS', pendingPaidAction: action.pendingAction || null };
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
  const [state, reducerDispatch] = useReducer(reducer, initialState);
  const sessionRequestGateRef = useRef(null);
  if (!sessionRequestGateRef.current) {
    sessionRequestGateRef.current = createSessionRequestGate();
  }
  const sessionRequestGate = sessionRequestGateRef.current;
  const dispatch = useCallback((action) => {
    if (action?.type === 'SET_LOGGED') sessionRequestGate.invalidate();
    reducerDispatch(action);
  }, [sessionRequestGate]);

  const refreshBillingBalance = useCallback(async () => {
    const requestEpoch = sessionRequestGate.capture();
    const entitlement = normalizeEntitlement(await fetchBillingBalance());
    if (!sessionRequestGate.isCurrent(requestEpoch)) return undefined;
    dispatch({ type: 'SET_ENTITLEMENT', ...entitlement });
    return entitlement;
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
    const restore = async () => {
      const session = await getSession();
      if (session?.token) {
        dispatch({ type: 'SET_LOGGED', logged: true, phone: session.email || '' });
        refreshBillingBalance().catch(() => {});
        refreshBillingCatalog().catch(() => {});
      }
    };
    restore();
  }, [refreshBillingBalance, refreshBillingCatalog]);

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
