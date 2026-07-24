import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CANVAS_NODE_ACTIONS,
  normalizeCanvasNode,
  normalizeCanvasConnection,
  createDerivedNode,
  createChildConnection,
  isDerivedAction,
} from '../src/pages/EcCanvas/nodeWorkflow.js';

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
  assert.equal(CANVAS_NODE_ACTIONS.some(action => action.id === 'video'), false);
  assert.equal(isDerivedAction('smart-remix'), true);
  const child = createDerivedNode({ sourceNodeIds: ['asset-1'], actionId: 'smart-remix', x: 300, y: 100 });
  assert.equal(child.kind, 'smart-remix');
  assert.deepEqual(child.sourceNodeIds, ['asset-1']);
  assert.equal(child.status, 'draft');
  assert.equal(child.x, 300);
  assert.equal(child.y, 100);
  assert.equal(createChildConnection('asset-1', child.id, 'smart-remix').relation, 'derived');
});

