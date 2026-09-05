import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  CANVAS_ACTIONS,
  actionsForSurface,
} from '../src/pages/EcCanvas/canvasActionRegistry.js';

const pageSource = () => readFileSync(new URL('../src/pages/EcCanvas/index.jsx', import.meta.url), 'utf8');
const studioSource = () => readFileSync(new URL('../src/pages/EcCanvas/components/CanvasStudio.jsx', import.meta.url), 'utf8');

test('contract (9-05 定稿): selection opens toolbar + right panel together; derive menu is opened only via the + port', () => {
  const page = pageSource();
  // 顶部工具栏与右面板共享同一谓词, 且派生菜单打开时两者保持出现 (双面板共存)
  assert.match(page, /const selectionPanelsVisible = /);
  const uses = page.match(/selectionPanelsVisible && </g) || [];
  assert.equal(uses.length, 2, 'object toolbar + right panel share the predicate');
  assert.match(page, /selectionPanelsVisible && <CanvasObjectToolbar/);
  assert.match(page, /selectionPanelsVisible && <EcCanvasRightPanel/);
  // 派生菜单只由 + 触发 (connectionPicker), 不再挂 selectionPanelsVisible
  assert.match(page, /connectionPicker && <CanvasDeriveMenu/);
  assert.doesNotMatch(page, /&& !connectionPicker &&/, '派生菜单不能再把工具栏藏掉 (谓词里不得有 !connectionPicker 条件)');
  // 谓词本身覆盖：非聚焦编辑、无连线选择、单选、存在选中节点、排除文本与 composer
  const declaration = page.slice(page.indexOf('const selectionPanelsVisible'), page.indexOf(';', page.indexOf('selectedNode.kind')), page.indexOf('selectedNode.kind') + 40);
  for (const guard of ['!focusedEditor', 'multiSelected.size <= 1', 'selectedNode']) {
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
