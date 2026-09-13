// test/canvas-library-page-and-asset-modal-0912.test.mjs
// 2026-09-12 用户批注：
//  ① 资产库要改成弹窗（不再是整页 + 一堆标题/副标题）
//  ② 画布库要改成整页（不是弹窗），卡片 hover 上浮放大并浮出四个操作
//  ③ 左侧「+」菜单要分组：添加资源 / 用 AI 生成
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('资产库改弹窗', () => {
  const canvas = read('src/pages/EcCanvas/index.jsx');
  assert.ok(canvas.includes('canvas-asset-library-overlay'), '弹窗外壳存在');
  assert.ok(canvas.includes('canvas-asset-library-modal'), '弹窗卡片存在');
  const css = read('src/styles/canvas-supervisor.css');
  assert.ok(/\.canvas-asset-library-overlay \{[^}]*position: fixed/.test(css), '弹窗固定全屏');
  assert.ok(/\.canvas-asset-library-modal \{[^}]*max-height/.test(css), '弹窗限高可滚动');
});

test('画布库改整页 + hover 动效', () => {
  const canvas = read('src/pages/EcCanvas/index.jsx');
  assert.ok(canvas.includes('variant="page"'), '以整页形态挂载');
  const modal = read('src/pages/EcCanvas/components/CanvasLibraryModal.jsx');
  assert.ok(modal.includes("variant = 'modal'") && modal.includes('is-page'), '支持整页变体');
  const css = read('src/pages/EcCanvas/components/canvas-library.css');
  /* 9-13 修正：用户要求「新建画布是独立页面」→ 固定全屏（不再是画布内的绝对定位层） */
  assert.ok(/canvas-library-overlay\.is-page \{[^}]*position: fixed/.test(css), '独立整页（固定全屏）');
  assert.ok(/canvas-library-card:hover \{[^}]*translateY\(-8px\) scale\(1\.03\)/.test(css), 'hover 上浮放大');
  /* 9-13 修复：封面固定高度（原 aspect-ratio 会让卡片塌成细条） */
  assert.ok(/canvas-library-cover \{[^}]*height: 230px/.test(css), '封面固定高度');
});

test('左侧「+」菜单分组', () => {
  const studio = read('src/pages/EcCanvas/components/CanvasStudio.jsx');
  assert.ok(studio.includes("const RESOURCE_ACTION_IDS = new Set(['upload', 'upload-video', 'upload-audio', 'works', 'asset-library'])"), '资源分组定义');
  assert.ok(studio.includes('添加资源') && studio.includes('用 AI 生成'), '两组标题');
  const css = read('src/styles/canvas-supervisor.css');
  assert.ok(css.includes('.ec-canvas-menu-group-title'), '分组标题样式');
});
