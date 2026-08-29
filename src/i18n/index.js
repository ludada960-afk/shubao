// src/i18n/index.js
// 薯包 P-H 国际化基础 (4c183cd4 续命): 统一入口
export {
  DEFAULT_LOCALE,
  LOCALE_META,
  STRINGS,
  SUPPORTED_LOCALES,
  listKeys,
  translate,
  validateLocale,
} from './locales.js';

export {
  useT,
  useLocale,
  switchLocale,
  getCurrentLocale,
} from './useT.js';
