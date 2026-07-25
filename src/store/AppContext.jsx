import React, { createContext, useContext, useReducer, useCallback, useEffect } from 'react';
import { getSession } from '../services/auth';
import { normalizeEntitlement } from './entitlementState';

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
  credits: 0,
  unlimited: false,
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
        ...(action.logged ? {} : { credits: 0, unlimited: false }),
      };
    case 'SET_CREDITS':
      return { ...state, credits: action.credits, unlimited: Boolean(action.unlimited) };
    case 'ADD_CREDITS':
      return state.unlimited ? state : { ...state, credits: (state.credits || 0) + action.amount };
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
  const [state, dispatch] = useReducer(reducer, initialState);

  const fetchCredits = useCallback(async (email) => {
    if (!email) return;
    try {
      const r = await fetch(`/api/user/credits?email=${encodeURIComponent(email)}`);
      const d = await r.json();
      const entitlement = normalizeEntitlement(d);
      dispatch({ type: 'SET_CREDITS', ...entitlement });
      return entitlement;
    } catch(e) {}
  }, [dispatch]);

  // 页面加载时从 localStorage 恢复登录状态
  useEffect(() => {
    const restore = async () => {
      const session = await getSession();
      if (session?.email) {
        dispatch({ type: 'SET_LOGGED', logged: true, phone: session.email });
        fetchCredits(session.email);
      }
    };
    restore();
  }, [fetchCredits]);

  return (
    <AppContext.Provider value={{ state, dispatch, fetchCredits }}>
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
