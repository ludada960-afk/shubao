// test/canvas-asset-picker-0912.test.mjs
// 2026-09-12 用户批注：画布必须能「从资产库选择」把素材放到画布上（此前没有任何入口），
// 且交互照竞品：平时不显示，鼠标悬停才出现打勾。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('画布有空态入口 + 左侧菜单项，都会打开「从资产库选择」', () => {
  const canvas = read('src/pages/EcCanvas/index.jsx');
  assert.ok(canvas.includes('从资产库选择'), '存在入口文案');
  assert.ok(canvas.includes('setAssetPickerOpen(true)'), '入口会打开选择器');
  assert.ok(canvas.includes("actionId === 'asset-library'"), '左侧菜单项已接上');
  assert.ok(canvas.includes('<CanvasAssetPickerModal'), '选择器已渲染');
  assert.ok(canvas.includes('await handleImportProjectAssets(picked)'), '选中后加入画布复用既有导入链路');
  const studio = read('src/pages/EcCanvas/components/CanvasStudio.jsx');
  assert.ok(studio.includes("id: 'asset-library'"), '菜单定义含 asset-library');
});

test('选择器交互：悬停才出现打勾、可多选、确认后关闭', () => {
  const modal = read('src/pages/EcCanvas/components/CanvasAssetPickerModal.jsx');
  assert.ok(modal.includes('createPortal'), 'portal 到 body，避免被祖先上下文影响');
  assert.ok(modal.includes('aria-pressed={isSelected}'), '卡片有选中态');
  assert.ok(modal.includes('listProjectAssetLibrary'), '读取资产库');
  const css = read('src/pages/EcCanvas/components/canvas-asset-picker.css');
  const check = css.match(/\.canvas-asset-picker-check \{([^}]*)\}/);
  assert.ok(check, '打勾样式存在');
  assert.ok(/opacity: 0/.test(check[1]), '默认不显示');
  assert.ok(/canvas-asset-picker-card:hover \.canvas-asset-picker-check/.test(css), '悬停才显示');
  assert.ok(/canvas-asset-picker-card\.is-selected \.canvas-asset-picker-check/.test(css), '选中后保持显示');
});
