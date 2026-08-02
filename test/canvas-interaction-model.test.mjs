import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CANVAS_CREATION_OPTIONS,
  getCanvasFocusIds,
  getContextMenuPosition,
  getContextPanelPosition,
  expandCanvasDragSelection,
  isCanvasConnectionVisible,
  multiSelectionActionsForNodes,
  moveCanvasNodes,
  MULTI_SELECTION_ACTIONS,
  applyMultiSelectionAction,
  shouldPersistCanvasMutation,
} from '../src/pages/EcCanvas/canvasInteractionModel.js';

test('hover focus keeps the active node and its direct relations visible', () => {
  const focused = getCanvasFocusIds('main-a', [
    { fromNodeId: 'source', toNodeId: 'main-a' },
    { fromNodeId: 'main-a', toNodeId: 'edit-a' },
    { fromNodeId: 'other', toNodeId: 'detail-a' },
  ]);
  assert.deepEqual([...focused].sort(), ['edit-a', 'main-a', 'source']);
  assert.equal(getCanvasFocusIds('', []).size, 0);
});

test('contextual composer anchors below the selected node and stays in visible world bounds', () => {
  assert.deepEqual(
    getContextPanelPosition({
      node: { x: 700, y: 100, w: 230, h: 307 },
      viewport: { x: -500, y: -260, scale: 1.5 },
      bounds: { width: 1280, height: 800 },
      panel: { width: 520, height: 238 },
    }),
    { left: 555, top: 420, width: 520, placement: 'below' },
  );
});

test('context menu is clamped to the browser viewport', () => {
  assert.deepEqual(
    getContextMenuPosition({ x: 1250, y: 780, viewportWidth: 1280, viewportHeight: 800, width: 240, height: 360 }),
    { x: 1028, y: 428 },
  );
  assert.deepEqual(
    getContextMenuPosition({ x: -40, y: -20, viewportWidth: 390, viewportHeight: 844, width: 240, height: 360 }),
    { x: 12, y: 12 },
  );
});

test('node port presents only the three Shubao creation capabilities', () => {
  assert.deepEqual(CANVAS_CREATION_OPTIONS.map(option => option.id), [
    'text-generation',
    'image-edit',
    'ecommerce-suite',
  ]);
  assert.equal(CANVAS_CREATION_OPTIONS.some(option => /video|workflow/i.test(option.id)), false);
});

test('drag frames update geometry without persistence and drag end persists once', () => {
  const nodes = [
    { id: 'a', x: 10, y: 20 },
    { id: 'b', x: 30, y: 40 },
  ];
  assert.deepEqual(moveCanvasNodes(nodes, new Set(['a']), { x: 15, y: -5 }), [
    { id: 'a', x: 25, y: 15 },
    { id: 'b', x: 30, y: 40 },
  ]);
  assert.equal(shouldPersistCanvasMutation('drag-frame'), false);
  assert.equal(shouldPersistCanvasMutation('drag-end'), true);
});

test('multi selection matches the observed commerce editing surface', () => {
  assert.deepEqual(MULTI_SELECTION_ACTIONS.map(action => action.id), [
    'align-left',
    'align-center',
    'align-right',
    'auto-layout',
    'bind-elements',
    'group-elements',
    'export-selection',
    'merge-layers',
    'delete-selection',
  ]);
});

test('multi selection only advertises pixel export and merge for image-only selections', () => {
  const images = [
    { id: 'a', kind: 'image', status: 'ready', url: '/a.png' },
    { id: 'b', kind: 'output', status: 'completed', url: '/b.png' },
  ];
  const imageActions = multiSelectionActionsForNodes(images, new Set(['a', 'b'])).map(action => action.id);
  assert.equal(imageActions.includes('export-selection'), true);
  assert.equal(imageActions.includes('merge-layers'), true);

  const mixed = [...images, { id: 'text', kind: 'text', text: '卖点' }];
  const mixedActions = multiSelectionActionsForNodes(mixed, new Set(['a', 'text'])).map(action => action.id);
  assert.equal(mixedActions.includes('export-selection'), false);
  assert.equal(mixedActions.includes('merge-layers'), false);
});

test('multi selection geometry is deterministic and keeps non-selected nodes untouched', () => {
  const nodes = [
    { id: 'a', x: 100, y: 90, w: 100, h: 100 },
    { id: 'b', x: 280, y: 160, w: 160, h: 80 },
    { id: 'outside', x: 900, y: 900, w: 20, h: 20 },
  ];
  const ids = new Set(['a', 'b']);
  const aligned = applyMultiSelectionAction(nodes, ids, 'align-center');
  assert.equal(aligned[0].x + aligned[0].w / 2, aligned[1].x + aligned[1].w / 2);
  assert.deepEqual(aligned[2], nodes[2]);
  const laidOut = applyMultiSelectionAction(nodes, ids, 'auto-layout', { gap: 24 });
  assert.equal(laidOut[0].y, laidOut[1].y);
  assert.equal(laidOut[1].x, laidOut[0].x + laidOut[0].w + 24);
});

test('dragging one grouped object expands the drag selection to the complete group', () => {
  const nodes = [
    { id: 'a', groupId: 'group-1' },
    { id: 'b', groupId: 'group-1' },
    { id: 'c', groupId: 'group-2' },
  ];
  assert.deepEqual([...expandCanvasDragSelection(nodes, 'a', new Set(['a']))].sort(), ['a', 'b']);
  assert.deepEqual([...expandCanvasDragSelection(nodes, 'c', new Set(['a', 'c']))].sort(), ['a', 'c']);
});

test('connections disappear when either endpoint is hidden', () => {
  const edge = { fromNodeId: 'a', toNodeId: 'b' };
  assert.equal(isCanvasConnectionVisible(edge, [{ id: 'a' }, { id: 'b' }]), true);
  assert.equal(isCanvasConnectionVisible(edge, [{ id: 'a', hidden: true }, { id: 'b' }]), false);
  assert.equal(isCanvasConnectionVisible(edge, [{ id: 'a' }, { id: 'b', hidden: true }]), false);
  assert.equal(isCanvasConnectionVisible(edge, [{ id: 'a' }]), false);
});
