import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  CANVAS_ACTIONS,
  actionsForSurface,
} from '../src/pages/EcCanvas/canvasActionRegistry.js';

const pageSource = () => readFileSync(new URL('../src/pages/EcCanvas/index.jsx', import.meta.url), 'utf8');
const studioSource = () => readFileSync(new URL('../src/pages/EcCanvas/components/CanvasStudio.jsx', import.meta.url), 'utf8');

test('contract: selection opens the object toolbar, derive menu and right panel together', () => {
  const page = pageSource();
  // 一个共享谓词, 三块面板各用一次 (4c183cd4 续命 画布深度重构: 加 EcCanvasRightPanel 跟上面 toolbar + 派生菜单同步张合)
  // 出现/消失永远同步, 用户 8-29 硬性要求 "上面跟右边的面板都同时张开"
  assert.match(page, /const selectionPanelsVisible = /);
  const uses = page.match(/selectionPanelsVisible && </g) || [];
  assert.equal(uses.length, 3, 'object toolbar + derive menu + right panel must all share the same predicate (双面板联动 + 右面板)');
  assert.match(page, /selectionPanelsVisible && <CanvasObjectToolbar/);
  assert.match(page, /selectionPanelsVisible && <EcCanvasRightPanel/);
  assert.match(page, /selectionPanelsVisible && <CanvasDeriveMenu/);
  // 谓词本身覆盖：非聚焦编辑、无连线选择、单选、存在选中节点、排除文本与 composer
  const declaration = page.slice(page.indexOf('const selectionPanelsVisible'), page.indexOf('; ', page.indexOf('const selectionPanelsVisible')));
  for (const guard of ['!focusedEditor', '!connectionPicker', 'multiSelected.size <= 1', 'selectedNode']) {
    assert.match(declaration, new RegExp(guard.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), guard);
  }
});

test('contract: delete stays out of the selection surface (lone-trash regression)', () => {
  const deleteAction = CANVAS_ACTIONS.find(action => action.id === 'delete');
  assert.deepEqual([...deleteAction.surfaces], ['context']);
  const ready = { id: 'n1', kind: 'image', status: 'ready', url: '/a.png' };
  assert.equal(actionsForSurface({ surface: 'selection', node: ready }).some(action => action.id === 'delete'), false);
});

test('derive menu rows use the balanced card anatomy with badge + arrow', () => {
  const source = studioSource();
  assert.match(source, /ec-canvas-derive-chip/);
  assert.match(source, /ec-canvas-derive-copy/);
  assert.match(source, /ec-canvas-derive-meta/);
  assert.match(source, /priceBadge/);
  assert.match(source, /<ArrowUpRight size=\{14\} \/>/);
  // 每行仍是 role=menuitem 且带 data-derive-action 钩子
  assert.match(source, /data-derive-action=\{action\.id\}/);
});

test('derive card css keeps three-column grid on token greys', () => {
  const css = readFileSync(new URL('../src/pages/EcCanvas/EcCanvas.css', import.meta.url), 'utf8');
  assert.match(css, /\.ec-canvas-derive-menu > button \{ grid-template-columns: 38px minmax\(0, 1fr\) auto;/);
  assert.match(css, /\.ec-canvas-derive-menu \{ width: 324px; \}/);
  assert.match(css, /\.ec-canvas-derive-meta em \{/);
});
