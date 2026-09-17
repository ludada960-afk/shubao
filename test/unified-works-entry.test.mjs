import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
/* ⚠️ 2026-09-18 批 A：旧的悬浮图标栏 SideNav 已删除（用户批注 #1/#14：
   总页面要有常驻入口 + 平时张开可折叠），它的三个工作区入口（无限画布 / 我的作品 / 我的资产）
   原样搬进了常驻侧栏 AppSidebar。下面这两条断言的对象随之从 App.jsx 换成 AppSidebar.jsx ——
   **判据一个字没改**（素材入口仍带 tab:'assets'、登录后仍落到那一格）。 */
const sidebar = readFileSync(new URL('../src/components/layout/AppSidebar.jsx', import.meta.url), 'utf8');
const nav = readFileSync(new URL('../src/components/layout/creativeDomainNavigation.js', import.meta.url), 'utf8');
const store = readFileSync(new URL('../src/store/AppContext.jsx', import.meta.url), 'utf8');
const canvas = readFileSync(new URL('../src/pages/EcCanvas/index.jsx', import.meta.url), 'utf8');
const api = readFileSync(new URL('../src/services/api.js', import.meta.url), 'utf8');

test('legacy Works navigation resolves to the Canvas work collection', () => {
  assert.doesNotMatch(app, /WorksPage/);
  assert.doesNotMatch(app, /works:\s*WorksPage/);
  assert.match(nav, /id: 'works'[\s\S]*?OPEN_CANVAS[\s\S]*?tab: 'works'/);
  assert.match(store, /action\.page === 'works'/);
  assert.match(store, /canvasEntryTab:\s*'works'/);
  assert.match(store, /SET_CANVAS_ENTRY_TAB/);
  assert.match(canvas, /useState\(state\.canvasEntryTab \|\| 'canvas'\)/);
});

test('asset library navigation resolves directly to the Canvas asset collection', () => {
  assert.match(sidebar, /label: '我的资产'/);
  assert.match(sidebar, /OPEN_CANVAS', tab: 'assets'/);
});

test('Canvas work collection exposes extensible category filters', () => {
  assert.match(canvas, /loadCachedWorks/);
  assert.match(canvas, /WORK_CATEGORY_OPTIONS/);
  assert.match(canvas, /filterCanvasWorks\(pastWorks, workCategory\)/);
  assert.match(canvas, /全部作品/);
  assert.match(canvas, /电商商品图/);
  assert.match(canvas, /小红书图文/);
  assert.match(canvas, /自由创作/);
});

test('every save path persists an explicit normalized work type', () => {
  assert.match(api, /withWorkType\(work\)/);
});
