import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeCanvasNode,
  normalizeCanvasConnection,
  createDerivedNode,
  createChildConnection,
  isDerivedAction,
  shouldShowQuickCanvasAction,
  canDeriveFromNode,
  getConnectionLabel,
  validateWorkflowActionInputs,
  clampCanvasPickerPosition,
  getCanvasPortCenter,
} from '../src/pages/EcCanvas/nodeWorkflow.js';
import { CANVAS_ACTIONS } from '../src/pages/EcCanvas/canvasActionRegistry.js';

test('legacy image assets normalize as image nodes', () => {
  const node = normalizeCanvasNode({ id: 'asset-1', url: '/a.png', x: 10, y: 20, w: 200, h: 200 });
  assert.equal(node.kind, 'image');
  assert.equal(node.status, 'ready');
  assert.equal(node.url, '/a.png');
});

test('legacy connections normalize without losing relation', () => {
  const edge = normalizeCanvasConnection({ from: 'a', to: 'b', type: 'reference' });
  assert.deepEqual(
    {
      id: edge.id,
      fromNodeId: edge.fromNodeId,
      fromPort: edge.fromPort,
      toNodeId: edge.toNodeId,
      toPort: edge.toPort,
      relation: edge.relation,
    },
    {
      id: 'edge_a_b_reference',
      fromNodeId: 'a',
      fromPort: 'output',
      toNodeId: 'b',
      toPort: 'input',
      relation: 'reference',
    },
  );
  assert.equal(edge.from, 'a');
  assert.equal(edge.to, 'b');
  assert.equal(edge.type, 'reference');
});

test('derived actions exclude video and create a child node', () => {
  assert.equal(CANVAS_ACTIONS.some(action => action.id === 'video'), false);
  assert.equal(isDerivedAction('smart-remix'), true);
  const child = createDerivedNode({ sourceNodeIds: ['asset-1'], actionId: 'smart-remix', x: 300, y: 100 });
  assert.equal(child.kind, 'smart-remix');
  assert.deepEqual(child.sourceNodeIds, ['asset-1']);
  assert.equal(child.status, 'draft');
  assert.equal(child.x, 300);
  assert.equal(child.y, 100);
  assert.equal(createChildConnection('asset-1', child.id, 'smart-remix').relation, 'derived');
});

test('legacy quick actions never duplicate the registry-driven command surfaces', () => {
  for (const actionId of ['rename', 'classify', 'crop', 'grid-split', 'annotation', 'reference', 'remove-bg', 'reverse-prompt', 'retouch', 'extend', 'translate', 'upscale', 'layers', 'download']) {
    assert.equal(shouldShowQuickCanvasAction(actionId), false, actionId);
  }
});

test('only source and ready output images can create workflow children', () => {
  assert.equal(canDeriveFromNode({ kind: 'source_group', status: 'ready', assets: [{ url: '/product.png' }] }), true);
  assert.equal(canDeriveFromNode({ kind: 'image', status: 'ready', url: '/image.png' }), true);
  assert.equal(canDeriveFromNode({ kind: 'layer-group', status: 'success', url: '/group.png' }), true);
  assert.equal(canDeriveFromNode({ kind: 'output', status: 'completed', url: '/output.png' }), true);
  assert.equal(canDeriveFromNode({ kind: 'output', status: 'ready', url: '/ready-output.png' }), true);
  assert.equal(canDeriveFromNode({ kind: 'output', status: 'generating', url: '/output.png' }), false);
  for (const status of ['draft', 'analyzing', 'running', 'error']) {
    assert.equal(canDeriveFromNode({ kind: 'smart-remix', status }), false, status);
  }
  assert.equal(canDeriveFromNode({ kind: 'smart-remix', status: 'success', output: { url: '/x.png' } }), false);
});

test('successful process cards remain provenance steps rather than derivation sources', () => {
  assert.equal(canDeriveFromNode({ kind: 'remove-bg', status: 'success', output: { url: '/result.png' } }), false);
  assert.equal(canDeriveFromNode({ kind: 'image', status: 'ready', sourceNodeIds: ['process-1'], url: '/result.png' }), true);
});

test('derived connections expose their semantic action label', () => {
  const edge = createChildConnection('source', 'child', 'smart-remix');
  assert.equal(getConnectionLabel(edge), '商品图改造');
  assert.equal(getConnectionLabel({ relation: 'reference' }), '引用素材');
});

test('outpaint cannot run until ratio and prompt are configured', () => {
  assert.deepEqual(validateWorkflowActionInputs('outpaint', {}), {
    ok: false,
    missing: ['ratio', 'prompt'],
  });
  assert.deepEqual(validateWorkflowActionInputs('outpaint', { ratio: '3:4', prompt: '向上扩展留白' }), {
    ok: true,
    missing: [],
  });
});

test('action picker stays within the visible Canvas world rectangle', () => {
  assert.deepEqual(
    clampCanvasPickerPosition({
      world: { x: 1000, y: 800 },
      viewport: { x: -200, y: -100, scale: 2 },
      bounds: { width: 390, height: 844 },
    }),
    { x: 105, y: 55, width: 185, maxHeight: 412 },
  );
});

test('connection endpoints use the node geometry that is updated during drag', () => {
  assert.deepEqual(
    getCanvasPortCenter({ x: 10, y: 20, w: 200, h: 220, renderedWidth: 240, renderedHeight: 300 }, 'output'),
    { x: 210, y: 130 },
  );
  assert.deepEqual(
    getCanvasPortCenter({ x: 10, y: 20, w: 200, h: 220, renderedWidth: 240, renderedHeight: 300 }, 'input'),
    { x: 10, y: 130 },
  );
});

test('connection endpoints ignore stale DOM measurements and stay deterministic', () => {
  assert.deepEqual(
    getCanvasPortCenter({
      x: 10,
      y: 20,
      w: 200,
      h: 220,
      portCenters: { input: { x: 7, y: 101 }, output: { x: 237, y: 103 } },
    }, 'output'),
    { x: 210, y: 130 },
  );
});
