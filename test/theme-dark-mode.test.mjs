// test/theme-dark-mode.test.mjs — P3 双主题 (4c183cd4 续命)
//
// 覆盖:
// - src/utils/themeMode.js 全部纯函数 (normalize / read / write / resolve / apply / set / init)
// - localStorage / matchMedia / document 缺失/异常的健壮性
// - 三态循环 nextMode
// - setThemeMode 在 DOM 上正确写入 data-theme

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// ── 1. 静态断言: 关键文件存在并导出 ─────────────────────────────
test('P3 双主题: 关键文件存在', async () => {
  const css = await readFile(resolve(ROOT, 'src/styles/theme.css'), 'utf8');
  assert.ok(css.includes('[data-theme="dark"]'), 'theme.css 缺 [data-theme="dark"] 块');
  assert.ok(css.includes('[data-theme="auto"]') || css.includes('prefers-color-scheme: dark'),
    'theme.css 缺 auto/system 探测');
  assert.ok(css.includes('.theme-switcher'), 'theme.css 缺 .theme-switcher 样式');

  const jsx = await readFile(resolve(ROOT, 'src/components/layout/ThemeSwitcher.jsx'), 'utf8');
  assert.ok(jsx.includes('export default function ThemeSwitcher'), 'ThemeSwitcher 缺默认导出');
  assert.ok(jsx.includes('lucide-react'), 'ThemeSwitcher 没用 lucide-react 图标');

  const tm = await readFile(resolve(ROOT, 'src/utils/themeMode.js'), 'utf8');
  assert.ok(tm.includes('THEME_MODES'), 'themeMode.js 缺 THEME_MODES');
  assert.ok(tm.includes('export function initThemeMode'), 'themeMode.js 缺 initThemeMode');
  assert.ok(tm.includes('export function setThemeMode'), 'themeMode.js 缺 setThemeMode');

  const main = await readFile(resolve(ROOT, 'src/main.jsx'), 'utf8');
  assert.ok(main.includes("'./styles/theme.css'"), 'main.jsx 没 import theme.css');
  assert.ok(main.includes('initThemeMode'), 'main.jsx 没调用 initThemeMode');

  const app = await readFile(resolve(ROOT, 'src/App.jsx'), 'utf8');
  assert.ok(app.includes("import ThemeSwitcher"), 'App.jsx 没 import ThemeSwitcher');
  assert.ok(app.includes('<ThemeSwitcher'), 'App.jsx 没渲染 ThemeSwitcher');
});

// ── 2. normalizeThemeMode ───────────────────────────────────────
test('normalizeThemeMode: 接受 light/dark/auto, 其他回退 auto', async () => {
  const { normalizeThemeMode, THEME_MODES } = await import('../src/utils/themeMode.js');
  assert.equal(normalizeThemeMode('light'), 'light');
  assert.equal(normalizeThemeMode('dark'), 'dark');
  assert.equal(normalizeThemeMode('auto'), 'auto');
  assert.equal(normalizeThemeMode('LIGHT'), 'light', '大写归一化');
  assert.equal(normalizeThemeMode(' Auto '), 'auto', '空白+大写');
  assert.equal(normalizeThemeMode('unknown'), 'auto', '未知值回退 auto');
  assert.equal(normalizeThemeMode(null), 'auto', 'null 回退 auto');
  assert.equal(normalizeThemeMode(undefined), 'auto');
  assert.equal(normalizeThemeMode(42), 'auto', '数字回退 auto');
  assert.equal(normalizeThemeMode({}), 'auto');
  assert.deepEqual([...THEME_MODES], ['light', 'dark', 'auto'], 'THEME_MODES 顺序');
});

// ── 3. readStoredThemeMode + writeStoredThemeMode (内存 mock) ─────
test('read/writeStoredThemeMode: 内存 storage 往返', async () => {
  const { readStoredThemeMode, writeStoredThemeMode, THEME_STORAGE_KEY } =
    await import('../src/utils/themeMode.js');
  const store = new Map();
  const storage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { store.set(k, String(v)); },
    removeItem: (k) => { store.delete(k); },
  };

  // 初始空
  assert.equal(readStoredThemeMode({ storage }), null);

  // 写 light
  assert.equal(writeStoredThemeMode('light', { storage }), true);
  assert.equal(store.get(THEME_STORAGE_KEY), 'light');
  assert.equal(readStoredThemeMode({ storage }), 'light');

  // 写 dark
  writeStoredThemeMode('dark', { storage });
  assert.equal(readStoredThemeMode({ storage }), 'dark');

  // 写非法值 -> 归一化
  writeStoredThemeMode('LOL', { storage });
  assert.equal(readStoredThemeMode({ storage }), 'auto', '非法值归一化为 auto');

  // 写 null/undefined 不会抛
  assert.doesNotThrow(() => writeStoredThemeMode(null, { storage }));
  assert.equal(readStoredThemeMode({ storage }), 'auto');
});

test('readStoredThemeMode: 抛错时不抛异常, 返回 null', async () => {
  const { readStoredThemeMode } = await import('../src/utils/themeMode.js');
  const exploding = { getItem: () => { throw new Error('quota'); } };
  assert.equal(readStoredThemeMode({ storage: exploding }), null);
});

test('writeStoredThemeMode: storage 抛错返回 false, 不抛异常', async () => {
  const { writeStoredThemeMode } = await import('../src/utils/themeMode.js');
  const exploding = { setItem: () => { throw new Error('quota'); } };
  assert.equal(writeStoredThemeMode('dark', { storage: exploding }), false);
});

// ── 4. readSystemPrefersColor (注入 matchMedia) ─────────────────
test('readSystemPrefersColor: 优先使用注入的 matchMedia', async () => {
  const { readSystemPrefersColor } = await import('../src/utils/themeMode.js');
  const fakeMql = (q) => {
    assert.equal(q, '(prefers-color-scheme: dark)');
    return { matches: true };
  };
  assert.equal(readSystemPrefersColor({ matchMedia: fakeMql }), 'dark');
  const fakeMqlLight = () => ({ matches: false });
  assert.equal(readSystemPrefersColor({ matchMedia: fakeMqlLight }), 'light');
});

test('readSystemPrefersColor: matchMedia 抛错回退 light', async () => {
  const { readSystemPrefersColor } = await import('../src/utils/themeMode.js');
  assert.equal(
    readSystemPrefersColor({ matchMedia: () => { throw new Error('nope'); } }),
    'light'
  );
});

// ── 5. resolveEffectiveTheme ────────────────────────────────────
test('resolveEffectiveTheme: auto 解析为系统色, 显式模式直接返回', async () => {
  const { resolveEffectiveTheme } = await import('../src/utils/themeMode.js');
  assert.equal(resolveEffectiveTheme('auto', { matchMedia: () => ({ matches: true }) }), 'dark');
  assert.equal(resolveEffectiveTheme('auto', { matchMedia: () => ({ matches: false }) }), 'light');
  assert.equal(resolveEffectiveTheme('light', {}), 'light');
  assert.equal(resolveEffectiveTheme('dark', {}), 'dark');
  assert.equal(resolveEffectiveTheme('???', { matchMedia: () => ({ matches: true }) }), 'dark',
    '非法 mode 归一化到 auto 再解析');
});

// ── 6. applyThemeToDocument (最小 DOM mock) ─────────────────────
test('applyThemeToDocument: 写入 <html data-theme>, 返回 effective', async () => {
  const { applyThemeToDocument } = await import('../src/utils/themeMode.js');
  const root = {
    attrs: new Map(),
    setAttribute(k, v) { this.attrs.set(k, v); },
    getAttribute(k) { return this.attrs.has(k) ? this.attrs.get(k) : null; },
  };
  const doc = { documentElement: root };
  const eff = applyThemeToDocument('dark', { document: doc, matchMedia: () => ({ matches: false }) });
  assert.equal(root.attrs.get('data-theme'), 'dark');
  assert.equal(eff, 'dark');
});

test('applyThemeToDocument: auto 模式下, system=dark 时 effective=dark', async () => {
  const { applyThemeToDocument } = await import('../src/utils/themeMode.js');
  const root = {
    attrs: new Map(),
    setAttribute(k, v) { this.attrs.set(k, v); },
    getAttribute(k) { return this.attrs.has(k) ? this.attrs.get(k) : null; },
  };
  const doc = { documentElement: root };
  const eff = applyThemeToDocument('auto', { document: doc, matchMedia: () => ({ matches: true }) });
  assert.equal(root.attrs.get('data-theme'), 'auto');
  assert.equal(eff, 'dark');
});

test('applyThemeToDocument: document 缺失时 graceful', async () => {
  const { applyThemeToDocument } = await import('../src/utils/themeMode.js');
  // 不传 document, globalThis.document 也不存在
  const savedDoc = globalThis.document;
  try {
    delete globalThis.document;
    const eff = applyThemeToDocument('dark', { matchMedia: () => ({ matches: false }) });
    assert.equal(eff, 'dark');
  } finally {
    if (savedDoc !== undefined) globalThis.document = savedDoc;
  }
});

// ── 7. setThemeMode: 完整流程 ───────────────────────────────────
test('setThemeMode: 写 storage + 写 DOM + 返回 effective', async () => {
  const { setThemeMode, THEME_STORAGE_KEY } = await import('../src/utils/themeMode.js');
  const store = new Map();
  const storage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { store.set(k, String(v)); },
    removeItem: (k) => { store.delete(k); },
  };
  const root = {
    attrs: new Map(),
    setAttribute(k, v) { this.attrs.set(k, v); },
    getAttribute(k) { return this.attrs.has(k) ? this.attrs.get(k) : null; },
  };
  const doc = { documentElement: root };
  const eff = setThemeMode('dark', { storage, document: doc, withTransition: false });
  assert.equal(eff, 'dark');
  assert.equal(store.get(THEME_STORAGE_KEY), 'dark');
  assert.equal(root.attrs.get('data-theme'), 'dark');
});

test('setThemeMode: 非法 mode 归一化为 auto', async () => {
  const { setThemeMode, THEME_STORAGE_KEY } = await import('../src/utils/themeMode.js');
  const store = new Map();
  const storage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { store.set(k, String(v)); },
  };
  const root = {
    attrs: new Map(),
    setAttribute(k, v) { this.attrs.set(k, v); },
    getAttribute(k) { return this.attrs.has(k) ? this.attrs.get(k) : null; },
  };
  setThemeMode('purple', { storage, document: { documentElement: root }, withTransition: false, matchMedia: () => ({ matches: true }) });
  assert.equal(store.get(THEME_STORAGE_KEY), 'auto');
  assert.equal(root.attrs.get('data-theme'), 'auto');
});

// ── 8. initThemeMode: 读 storage → 应用 ─────────────────────────
test('initThemeMode: 已存 dark 时直接用 dark', async () => {
  const { initThemeMode } = await import('../src/utils/themeMode.js');
  const store = new Map([['shubao.theme.mode', 'dark']]);
  const storage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { store.set(k, String(v)); },
  };
  const root = {
    attrs: new Map(),
    setAttribute(k, v) { this.attrs.set(k, v); },
    getAttribute(k) { return this.attrs.has(k) ? this.attrs.get(k) : null; },
  };
  const eff = initThemeMode({ storage, document: { documentElement: root }, matchMedia: () => ({ matches: false }) });
  assert.equal(eff, 'dark');
  assert.equal(root.attrs.get('data-theme'), 'dark');
});

test('initThemeMode: 无 storage 时回退 auto, effective 跟随系统', async () => {
  const { initThemeMode } = await import('../src/utils/themeMode.js');
  const root = {
    attrs: new Map(),
    setAttribute(k, v) { this.attrs.set(k, v); },
    getAttribute(k) { return this.attrs.has(k) ? this.attrs.get(k) : null; },
  };
  const eff = initThemeMode({
    storage: { getItem: () => null, setItem: () => {} },
    document: { documentElement: root },
    matchMedia: () => ({ matches: true }),
  });
  assert.equal(eff, 'dark', 'system=dark + 无 storage → effective=dark');
  assert.equal(root.attrs.get('data-theme'), 'auto');
});

// ── 9. flashThemeTransition: 给 html 加 class + 移除 ─────────────
test('flashThemeTransition: 加 class 后用 setTimeout 移除', async () => {
  const { flashThemeTransition, THEME_TRANSITION_CLASS, THEME_TRANSITION_MS } =
    await import('../src/utils/themeMode.js');
  const classes = new Set();
  const root = {
    classList: {
      add: (c) => classes.add(c),
      remove: (c) => classes.delete(c),
    },
  };
  flashThemeTransition({ document: { documentElement: root }, ms: 10 });
  assert.ok(classes.has(THEME_TRANSITION_CLASS), '加 transition class');
  await new Promise(r => setTimeout(r, 30));
  assert.ok(!classes.has(THEME_TRANSITION_CLASS), '延时移除 transition class');
  // 兜底: THEME_TRANSITION_MS 应在合理范围
  assert.ok(THEME_TRANSITION_MS >= 100 && THEME_TRANSITION_MS <= 600, '过渡时长 100-600ms');
});

// ── 10. ThemeSwitcher 组件契约 (静态文本, 不走 import 解析 jsx) ──
test('ThemeSwitcher: 切换三态 light → dark → auto → light', async () => {
  // 不能 import React 跑完整 render (没装 jsdom), 改为静态扫描代码确认循环逻辑
  const src = await readFile(resolve(ROOT, 'src/components/layout/ThemeSwitcher.jsx'), 'utf8');
  assert.ok(src.includes('THEME_MODES[(i + 1) % THEME_MODES.length]'),
    'ThemeSwitcher 缺三态循环');
  assert.ok(src.includes('setThemeMode(next)'), 'ThemeSwitcher 缺切换调用');
  assert.ok(src.includes('aria-label=') || src.includes('ariaLabel'),
    'ThemeSwitcher 缺 aria-label');
  assert.ok(src.includes('data-theme-mode='), 'ThemeSwitcher 缺 data-theme-mode 标记');
});

// ── 11. 集成: main.jsx 必须在 React 挂载前调用 initThemeMode ────
test('main.jsx: initThemeMode 在 ReactDOM.createRoot 之前调用', async () => {
  const src = await readFile(resolve(ROOT, 'src/main.jsx'), 'utf8');
  const initIdx = src.indexOf('initThemeMode(');
  const renderIdx = src.indexOf('ReactDOM.createRoot');
  assert.ok(initIdx > 0, 'main.jsx 没调用 initThemeMode');
  assert.ok(renderIdx > 0, 'main.jsx 没 ReactDOM.createRoot');
  assert.ok(initIdx < renderIdx, 'initThemeMode 必须在 React 挂载前调用 (避免闪屏)');
});

// ── 12. App.jsx 集成 ───────────────────────────────────────────
test('App.jsx: <ThemeSwitcher /> 渲染在 topbar-actions 内', async () => {
  const src = await readFile(resolve(ROOT, 'src/App.jsx'), 'utf8');
  const importIdx = src.indexOf("import ThemeSwitcher");
  const useIdx = src.indexOf('<ThemeSwitcher');
  assert.ok(importIdx > 0, 'App.jsx 没 import ThemeSwitcher');
  assert.ok(useIdx > 0, 'App.jsx 没渲染 <ThemeSwitcher />');
  // 必须在 topbar-actions 容器内
  const actionsStart = src.indexOf('topbar-actions');
  const actionsEnd = src.indexOf('</div>', actionsStart);
  assert.ok(useIdx > actionsStart && useIdx < actionsEnd,
    '<ThemeSwitcher /> 应在 topbar-actions 容器内');
});