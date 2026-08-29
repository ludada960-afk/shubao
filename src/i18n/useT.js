// src/i18n/useT.js
// 薯包 P-H 国际化基础 (4c183cd4 续命)
// React hook: useT(key) -> 当前 locale 文案
// 依赖: locales.js 的 STRINGS / DEFAULT_LOCALE / SUPPORTED_LOCALES
// 状态来源优先级: localStorage('shubao.locale') > navigator.language > DEFAULT_LOCALE
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  DEFAULT_LOCALE,
  LOCALE_META,
  STRINGS,
  SUPPORTED_LOCALES,
  translate as translateCore,
} from './locales.js';

const STORAGE_KEY = 'shubao.locale';

function isSupported(locale) {
  return typeof locale === 'string' && SUPPORTED_LOCALES.indexOf(locale) !== -1;
}

function readInitialLocale() {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return DEFAULT_LOCALE;
  }
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (isSupported(stored)) return stored;
  } catch (_) { /* storage blocked */ }
  // navigator.language 兜底: 取前缀匹配
  if (typeof navigator !== 'undefined' && navigator.language) {
    const raw = navigator.language;
    if (isSupported(raw)) return raw;
    const prefix = raw.split('-')[0].toLowerCase();
    for (const l of SUPPORTED_LOCALES) {
      if (l.toLowerCase().startsWith(prefix)) return l;
    }
  }
  return DEFAULT_LOCALE;
}

// 全局订阅: 让多个 hook 实例共享同一 locale
const listeners = new Set();
let currentLocale = readInitialLocale();

function setGlobalLocale(next) {
  if (!isSupported(next) || next === currentLocale) return;
  currentLocale = next;
  if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
    try { window.localStorage.setItem(STORAGE_KEY, next); } catch (_) { /* noop */ }
  }
  for (const l of listeners) {
    try { l(next); } catch (e) { if (typeof console !== 'undefined') console.warn('[i18n] listener error', e); }
  }
}

// 主 hook: 返回 [t, setLocale, locale]
// t(key): 取当前 locale 文案
// setLocale(next): 切换语言, 同步 localStorage + 通知订阅者
export function useT() {
  const [locale, setLocaleState] = useState(currentLocale);

  useEffect(() => {
    // 首次挂载时: 重新同步 (可能别的 tab 改了 localStorage)
    const next = readInitialLocale();
    if (next !== currentLocale) {
      setGlobalLocale(next);
    }
    if (next !== locale) setLocaleState(next);
    const cb = (l) => setLocaleState(l);
    listeners.add(cb);
    return () => { listeners.delete(cb); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setLocale = useCallback((next) => {
    setGlobalLocale(next);
    setLocaleState(next);
  }, []);

  const t = useCallback((key) => translateCore(key, locale), [locale]);

  return useMemo(() => [t, setLocale, locale], [t, setLocale, locale]);
}

// 便捷 hook: 仅取 locale
export function useLocale() {
  const [, , locale] = useT();
  return locale;
}

// 切换语言函数: 不在 hook 上下文 (e.g. 顶层初始化) 用
export function switchLocale(next) {
  setGlobalLocale(next);
  return currentLocale;
}

export function getCurrentLocale() {
  return currentLocale;
}

export { DEFAULT_LOCALE, LOCALE_META, STRINGS, SUPPORTED_LOCALES };
