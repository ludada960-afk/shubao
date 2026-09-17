import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const shellCssPath = new URL('../src/styles/app-shell.css', import.meta.url);
const shellCss = existsSync(shellCssPath) ? readFileSync(shellCssPath, 'utf8') : '';
const desktopShellCss = shellCss.split('@media (max-width: 639px)')[0];
const topBarBlock = app.match(/className="app-topbar"[\s\S]*?style=\{\{([\s\S]*?)\}\}/)?.[1] || '';

/* ⚠️ 2026-09-18 批 A/F：这条断言的**对象换了组件**，不是判据放宽。
   用户 9-18 批注 #1 + #14 原话：「总页面必须有一个常驻入口，左边导航栏很适合做」
   「中间那一排其实是重复的」「平时张开，需要时可折叠」——
   于是**旧的悬浮图标栏 SideNav 被删除**（它只有图标、放不下技能入口），
   换成承载两个总页面与精品推荐入口的常驻侧栏 AppSidebar。
   旧断言（function SideNav() / className="app-side-nav" / page !== 'ec-canvas' && <SideNav />）
   守的是**已被产品决定删掉的组件**，继续守它等于逼下一轮把图标栏加回来。
   新契约守四件事（与旧版一一对应）：
     ① 外壳：常驻侧栏 + 主内容两列，且**画布页不吃侧栏**（画布自己整屏排版）；
     ② 侧栏承载「图片生成 / 视频生成」两个总页面 + 精品推荐入口（旧图标栏没有这个能力）；
     ③ 未登录点「我的资产 / 我的作品」先走登录，且**记住要去的画布页签**（canvasTab）；
     ④ 顶部导航不是 sticky 自遮挡（D 系列的老判据，原样保留）。 */
test('app shell uses the creative domain navigation contract', () => {
  assert.match(app, /import '\.\/styles\/app-shell\.css'/);
  assert.doesNotMatch(topBarBlock, /position:\s*'sticky'|top:\s*0/);
  assert.match(app, /CreativeDomainNav/);
  /* ① 常驻侧栏 + 画布页不吃侧栏 */
  assert.match(app, /import AppSidebar from '\.\/components\/layout\/AppSidebar\.jsx'/);
  assert.match(app, /className="app-shell"/);
  assert.match(app, /<AppSidebar \/>/);
  assert.match(app, /page === 'ec-canvas'[\s\S]{0,80}app-frame/, '画布页走独立外壳（不吃侧栏、吃满 topbar 之外的高度）');
  /* ② 侧栏承载两个总页面与精品推荐 */
  const sidebar = readFileSync(new URL('../src/components/layout/AppSidebar.jsx', import.meta.url), 'utf8');
  assert.match(sidebar, /hubPath\('image'\)|hubPath\(board\)/);
  assert.match(sidebar, /featuredSkills/);
  assert.match(sidebar, /app-sidebar/);
  assert.match(app, /const canAdmin = state\.accountAccess\?\.role === 'owner'/);
  assert.match(app, /const canAdmin = state\.accountAccess\?\.role === 'owner'/);
  assert.match(shellCss, /\.creative-nav-desktop \{/);
  assert.match(shellCss, /\.creative-nav-panel \{/);
  assert.match(shellCss, /\.creative-nav-panel\s*\{[\s\S]*?width:\s*100%/);
  assert.match(shellCss, /\.creative-nav-panel-links\s*\{[\s\S]*?flex-direction:\s*column/);
  assert.match(shellCss, /\.creative-nav-panel-links\s*\{[\s\S]*?border-left:\s*0/);
  assert.doesNotMatch(shellCss, /\.creative-nav-signature\s*\{/);
  assert.doesNotMatch(shellCss, /\.creative-nav-panel-intro\s*\{/);
  assert.doesNotMatch(shellCss, /\.creative-nav-link-index\s*\{/);
  assert.match(shellCss, /\.creative-nav-mobile-drawer \{/);
  assert.match(shellCss, /\.creative-nav-trigger:focus-visible/);
  assert.match(shellCss, /@media \(max-width:\s*639px\)[\s\S]*?\.creative-nav-mobile-trigger/);
  assert.match(shellCss, /@media \(prefers-reduced-motion:\s*reduce\)/);
});

test('asset navigation keeps its intended Canvas tab through login', () => {
  const modals = readFileSync(new URL('../src/components/business/Modals.jsx', import.meta.url), 'utf8');
  const nav = readFileSync(new URL('../src/components/layout/CreativeDomainNav.jsx', import.meta.url), 'utf8');
  /* canvasTab 的入口从 App.jsx 的 SideNav 搬到了 AppSidebar（同一份判据：登录后仍落到那一格） */
  const sidebar = readFileSync(new URL('../src/components/layout/AppSidebar.jsx', import.meta.url), 'utf8');
  assert.match(sidebar, /canvasTab: target\.tab/);
  assert.match(modals, /state\.loginIntent\.canvasTab/);
  assert.match(modals, /dispatch\(\{ type: 'OPEN_CANVAS', tab: state\.loginIntent\.canvasTab \}\)/);
  assert.match(nav, /canvasTab: action\.tab/);
});
