import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CANVAS_CREATION_OPTIONS,
  getCanvasFocusIds,
  getContextMenuPosition,
  getContextPanelPosition,
  expandCanvasDragSelection,
  expandCanvasLayerGroup,
  isCanvasConnectionVisible,
  pickCanvasLayerAtPoint,
  multiSelectionActionsForNodes,
  moveCanvasNodes,
  MULTI_SELECTION_ACTIONS,
  applyMultiSelectionAction,
  shouldPersistCanvasMutation,
  replaceCanvasNodeWithLayerResult,
} from '../src/pages/EcCanvas/canvasInteractionModel.js';

test('layer extraction picks the visible semantic layer without moving the collapsed source', () => {
  const nodes = [
    { id: 'source', kind: 'layer-group', x: 100, y: 80, w: 240, h: 320, layerChildIds: ['products', 'background', 'copy'] },
    { id: 'products', parentLayerGroupId: 'source', semanticType: 'product-group', x: 124, y: 118, w: 192, h: 166, hidden: true },
    { id: 'background', parentLayerGroupId: 'source', semanticType: 'background', x: 100, y: 80, w: 240, h: 320, hidden: true },
    { id: 'copy', parentLayerGroupId: 'source', semanticType: 'text', kind: 'text', x: 143, y: 342, w: 154, h: 26, hidden: true },
  ];

  assert.equal(pickCanvasLayerAtPoint(nodes, 'source', { x: 180, y: 180 })?.id, 'products');
  assert.equal(pickCanvasLayerAtPoint(nodes, 'source', { x: 180, y: 350 })?.id, 'copy');
  assert.equal(pickCanvasLayerAtPoint(nodes, 'source', { x: 110, y: 390 })?.id, 'background');
  assert.equal(pickCanvasLayerAtPoint(nodes, 'source', { x: 500, y: 500 }), null);
});

test('hover focus keeps the active node and its direct relations visible', () => {
  const focused = getCanvasFocusIds('main-a', [
    { fromNodeId: 'source', toNodeId: 'main-a' },
    { fromNodeId: 'main-a', toNodeId: 'edit-a' },
    { fromNodeId: 'other', toNodeId: 'detail-a' },
  ]);
  assert.deepEqual([...focused].sort(), ['edit-a', 'main-a', 'source']);
  assert.equal(getCanvasFocusIds('', []).size, 0);
});

test('contextual composer remains below the selected node even when it extends beyond the viewport', () => {
  assert.deepEqual(
    getContextPanelPosition({
      node: { x: 700, y: 500, w: 230, h: 307 },
      viewport: { x: -500, y: -260, scale: 1.5 },
      bounds: { width: 1280, height: 800 },
      panel: { width: 520, height: 238 },
    }),
    { left: 555, top: 820, width: 520, placement: 'below' },
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

test('node port presents Shubao image, text, ecommerce, and video capabilities', () => {
  assert.deepEqual(CANVAS_CREATION_OPTIONS.map(option => option.id), [
    'text-generation',
    'image-edit',
    'ecommerce-suite',
    'video-upload',
    'video-generation',
  ]);
  assert.equal(CANVAS_CREATION_OPTIONS.find(option => option.id === 'video-generation')?.priceLabel, '32积分起');
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
    'stitch-details',
    'delete-selection',
  ]);
});

test('multi selection only advertises delivery and long-detail stitching for eligible outputs', () => {
  const images = [
    { id: 'a', kind: 'output', group: '详情图', status: 'ready', url: '/a.png' },
    { id: 'b', kind: 'output', group: '详情图', status: 'completed', url: '/b.png' },
  ];
  const imageActions = multiSelectionActionsForNodes(images, new Set(['a', 'b'])).map(action => action.id);
  assert.equal(imageActions.includes('export-selection'), true);
  assert.equal(imageActions.includes('stitch-details'), true);

  const mixed = [...images, { id: 'text', kind: 'text', text: '卖点' }];
  const mixedActions = multiSelectionActionsForNodes(mixed, new Set(['a', 'text'])).map(action => action.id);
  assert.equal(mixedActions.includes('export-selection'), false);
  assert.equal(mixedActions.includes('stitch-details'), false);
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

test('successful smart layering replaces the source and pending nodes without disturbing unrelated canvas state', () => {
  const state = replaceCanvasNodeWithLayerResult({
    nodes: [
      { id: 'source', kind: 'image' },
      { id: 'pending', kind: 'layer-group', status: 'processing' },
      { id: 'other', kind: 'image' },
    ],
    connections: [
      { id: 'source-pending', fromNodeId: 'source', toNodeId: 'pending' },
      { id: 'other-source', fromNodeId: 'other', toNodeId: 'source' },
      { id: 'source-output', fromNodeId: 'source', toNodeId: 'other-output' },
      { id: 'unrelated', fromNodeId: 'other', toNodeId: 'other-output' },
    ],
    sourceNodeId: 'source',
    pendingNodeId: 'pending',
    groupNode: { id: 'group', kind: 'layer-group' },
    childNodes: [{ id: 'child', kind: 'image', parentLayerGroupId: 'group' }],
    resultConnections: [{ id: 'group-child', fromNodeId: 'group', toNodeId: 'child' }],
  });

  assert.deepEqual(state.nodes.map(node => node.id), ['other', 'group', 'child']);
  assert.deepEqual(state.connections, [
    { id: 'other-source', fromNodeId: 'other', toNodeId: 'group' },
    { id: 'source-output', fromNodeId: 'group', toNodeId: 'other-output' },
    { id: 'unrelated', fromNodeId: 'other', toNodeId: 'other-output' },
    { id: 'group-child', fromNodeId: 'group', toNodeId: 'child' },
  ]);
});

test('extracting a smart layer hides the collapsed composite and reveals every real child layer', () => {
  const nodes = [
    { id: 'group', kind: 'layer-group', layerExpanded: false, hidden: false },
    { id: 'background', parentLayerGroupId: 'group', hidden: true },
    { id: 'product', parentLayerGroupId: 'group', hidden: true },
    { id: 'copy', parentLayerGroupId: 'group', hidden: true },
    { id: 'unrelated', kind: 'image', hidden: false },
  ];

  assert.deepEqual(expandCanvasLayerGroup(nodes, 'group'), [
    { id: 'group', kind: 'layer-group', layerExpanded: true, hidden: true },
    { id: 'background', parentLayerGroupId: 'group', hidden: false },
    { id: 'product', parentLayerGroupId: 'group', hidden: false },
    { id: 'copy', parentLayerGroupId: 'group', hidden: false },
    { id: 'unrelated', kind: 'image', hidden: false },
  ]);
});
