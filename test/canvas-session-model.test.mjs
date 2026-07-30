import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createCanvasSnapshot,
  createFreshCanvasSession,
  restoreCanvasSnapshot,
} from '../src/pages/EcCanvas/canvasSessionModel.js';

const workInput = {
  work: { id: 'work-1', product_name: '保温杯', platform: '天猫' },
  productAssets: [
    { assetId: 'product-front', url: '/front.png', name: '产品正面' },
    { assetId: 'product-side', url: '/side.png', name: '产品侧面' },
  ],
  outputs: [
    { assetId: 'main-1', url: '/main.png', name: '首屏主图', ratio: '1:1' },
    { assetId: 'detail-1', url: '/detail.png', name: '材质详情', ratio: '3:4' },
  ],
};

test('work import creates one product source group and parallel output edges', () => {
  const session = createFreshCanvasSession(workInput);
  const sourceGroups = session.nodes.filter(node => node.kind === 'source_group');
  assert.equal(sourceGroups.length, 1);
  assert.equal(session.nodes.filter(node => node.kind === 'output').length, 2);
  assert.ok(session.connections.every(edge => edge.from === sourceGroups[0].id));
  assert.equal(session.connections.some(edge => edge.from.startsWith('output-')), false);
});

test('fresh imports never reuse prior Canvas nodes or connections', () => {
  const first = createFreshCanvasSession(workInput);
  first.nodes.push({ id: 'stale-node' });
  first.connections.push({ id: 'stale-edge' });
  const second = createFreshCanvasSession(workInput);
  assert.equal(second.nodes.some(node => node.id === 'stale-node'), false);
  assert.equal(second.connections.some(edge => edge.id === 'stale-edge'), false);
});

test('source group retains all product references while outputs keep individual commercial names', () => {
  const session = createFreshCanvasSession(workInput);
  const source = session.nodes.find(node => node.kind === 'source_group');
  assert.deepEqual(source.assets.map(asset => asset.assetId), ['product-front', 'product-side']);
  assert.deepEqual(session.nodes.filter(node => node.kind === 'output').map(node => node.name), ['首屏主图', '材质详情']);
});

test('a source group is the only parent of imported result nodes', () => {
  const session = createFreshCanvasSession(workInput);
  const [source] = session.nodes.filter(node => node.kind === 'source_group');
  for (const output of session.nodes.filter(node => node.kind === 'output')) {
    assert.deepEqual(output.sourceNodeIds, [source.id]);
    assert.equal(session.connections.filter(edge => edge.to === output.id).length, 1);
  }
});

test('explicit Canvas snapshots preserve nodes, connections, and a valid viewport without sharing mutable state', () => {
  const source = {
    nodes: [{ id: 'source-1', x: 12 }],
    connections: [{ id: 'edge-1', from: 'source-1', to: 'output-1' }],
    viewport: { x: 20, y: 30, scale: 0.8 },
  };
  const snapshot = createCanvasSnapshot(source);
  source.nodes[0].x = 999;
  const restored = restoreCanvasSnapshot(snapshot);

  assert.deepEqual(restored, {
    nodes: [{ id: 'source-1', x: 12 }],
    connections: [{ id: 'edge-1', from: 'source-1', to: 'output-1' }],
    viewport: { x: 20, y: 30, scale: 0.8 },
  });
  assert.notEqual(restored.nodes, snapshot.nodes);
});
