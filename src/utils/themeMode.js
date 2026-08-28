// src/utils/themeMode.js — P3 双主题持久化 (4c183cd4 续命)
// 纯函数模块, 不依赖 React. 用于 main.jsx 在 React 挂载前同步应用主题 (避免闪屏),
// 也用于 ThemeSwitcher 组件读 / 写当前主题.
//
// 三态: 'light' | 'dark' | 'auto'
// - 'light' / 'dark' 强制覆盖系统
// - 'auto' 跟随 prefers-color-scheme (系统设置切换)
//
// 持久化键: 'shubao.theme.mode' (顶层 key, 不区分用户, 整个站点一份)

export const THEME_MODES = Object.freeze(['light', 'dark', 'auto']);
export const THEME_STORAGE_KEY = 'shubao.theme.mode';
export const THEME_DOM_ATTRIBUTE = 'data-theme';
export const THEME_TRANSITION_CLASS = 'theme-transition';
export const THEME_TRANSITION_MS = 260;

/** 安全读 localStorage, 失败返回 null. */
function readStorage() {
  try {
    if (typeof globalThis === 'undefined' || !globalThis.localStorage) return null;
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

/** 把任意输入规整到已知 THEME_MODES 之一, 失败或未知值回退到 'auto'. */
export function normalizeThemeMode(input) {
  if (typeof input !== 'string') return 'auto';
  const v = input.trim().toLowerCase();
  if (THEME_MODES.includes(v)) return v;
  return 'auto';
}

/** 从 localStorage 读取已保存的主题.
 *  - storage.getItem 返回 null/undefined 或 key 不存在 → null (从未保存)
 *  - 存了非法值 → 归一化到 'auto'
 *  - 读取抛错 → null */
export function readStoredThemeMode({ storage } = {}) {
  const target = storage ?? readStorage();
  if (!target) return null;
  try {
    const raw = target.getItem(THEME_STORAGE_KEY);
    if (raw === null || raw === undefined || raw === '') return null;
    return normalizeThemeMode(raw);
  } catch {
    return null;
  }
}

/** 把 mode 写回 localStorage, 失败不抛 (最佳努力). */
export function writeStoredThemeMode(mode, { storage } = {}) {
  const safe = normalizeThemeMode(mode);
  const target = storage ?? readStorage();
  if (!target) return false;
  try {
    target.setItem(THEME_STORAGE_KEY, safe);
    return true;
  } catch {
    return false;
  }
}

/** 从 system 读 prefers-color-scheme, 缺失时返回 'light'. */
export function readSystemPrefersColor({ matchMedia } = {}) {
  if (typeof matchMedia === 'function') {
    try {
      const m = matchMedia('(prefers-color-scheme: dark)');
      if (m && typeof m.matches === 'boolean') return m.matches ? 'dark' : 'light';
    } catch { /* fall through */ }
  }
  if (typeof globalThis !== 'undefined' && typeof globalThis.matchMedia === 'function') {
    try {
      const m = globalThis.matchMedia('(prefers-color-scheme: dark)');
      if (m && typeof m.matches === 'boolean') return m.matches ? 'dark' : 'light';
    } catch { /* fall through */ }
  }
  return 'light';
}

/** 把 mode 解析为最终生效的 'light' / 'dark'.
 *  - 'auto' 取决于系统 prefers-color-scheme
 *  - 其他直接返回 */
export function resolveEffectiveTheme(mode, { matchMedia } = {}) {
  const safe = normalizeThemeMode(mode);
  if (safe === 'auto') return readSystemPrefersColor({ matchMedia });
  return safe;
}

/** 把 mode 同步到 <html data-theme="..."> + color-scheme.
 *  返回最终生效的 'light' / 'dark'. */
export function applyThemeToDocument(mode, { document: doc, matchMedia } = {}) {
  const d = doc ?? (typeof globalThis !== 'undefined' ? globalThis.document : null);
  if (!d || !d.documentElement) return resolveEffectiveTheme(mode, { matchMedia });
  const safe = normalizeThemeMode(mode);
  d.documentElement.setAttribute(THEME_DOM_ATTRIBUTE, safe);
  return resolveEffectiveTheme(safe, { matchMedia });
}

/** 临时给 <html> 加 transition class, 延时移除. 用于切换瞬间平滑过渡. */
export function flashThemeTransition({ document: doc, ms = THEME_TRANSITION_MS } = {}) {
  const d = doc ?? (typeof globalThis !== 'undefined' ? globalThis.document : null);
  if (!d || !d.documentElement) return;
  const root = d.documentElement;
  root.classList.add(THEME_TRANSITION_CLASS);
  setTimeout(() => root.classList.remove(THEME_TRANSITION_CLASS), ms);
}

/** 完整切换流程: 计算新 mode, 写 localStorage, 同步 DOM, 触发过渡. */
export function setThemeMode(nextMode, options = {}) {
  const { storage, document: doc, matchMedia, withTransition = true } = options;
  const safe = normalizeThemeMode(nextMode);
  writeStoredThemeMode(safe, { storage });
  if (withTransition) flashThemeTransition({ document: doc, ms: THEME_TRANSITION_MS });
  return applyThemeToDocument(safe, { document: doc, matchMedia });
}

/** 初始化: 读 localStorage, 同步到 <html>, 返回最终生效主题. */
export function initThemeMode(options = {}) {
  const { storage, document: doc, matchMedia } = options;
  const stored = readStoredThemeMode({ storage });
  const mode = stored || 'auto';
  return applyThemeToDocument(mode, { document: doc, matchMedia });
}