import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CANVAS_CREATION_OPTIONS,
  getCanvasFocusIds,
  getContextMenuPosition,
  getContextPanelPosition,
  moveCanvasNodes,
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
    { x: 555, y: 420, width: 520, placement: 'below' },
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
