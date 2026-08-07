import assert from 'node:assert/strict';
import test from 'node:test';

import {
  isLongDetailCandidate,
  moveDetailItem,
  orderDetailNodes,
} from '../src/pages/EcCanvas/detailCompositionModel.js';

test('detail order prefers explicit plan sequence over canvas placement', () => {
  const nodes = [
    { id: 'third', kind: 'output', status: 'completed', url: '/3.png', group: '详情图', sequence: 3, x: 0, y: 0 },
    { id: 'first', kind: 'output', status: 'completed', url: '/1.png', group: '详情图', sequence: 1, x: 500, y: 500 },
    { id: 'second', kind: 'output', status: 'completed', url: '/2.png', group: '详情图', sequence: 2, x: 200, y: 200 },
  ];
  assert.deepEqual(orderDetailNodes(nodes).map(node => node.id), ['first', 'second', 'third']);
});

test('legacy detail nodes use top-to-bottom and left-to-right visual reading order', () => {
  const nodes = [
    { id: 'bottom-right', kind: 'output', status: 'completed', url: '/4.png', group: '详情图', x: 500, y: 420, w: 200, h: 356 },
    { id: 'top-right', kind: 'output', status: 'completed', url: '/2.png', group: '详情图', x: 320, y: 20, w: 200, h: 356 },
    { id: 'bottom-left', kind: 'output', status: 'completed', url: '/3.png', group: '详情图', x: 20, y: 400, w: 200, h: 356 },
    { id: 'top-left', kind: 'output', status: 'completed', url: '/1.png', group: '详情图', x: 10, y: 0, w: 200, h: 356 },
  ];
  assert.deepEqual(orderDetailNodes(nodes).map(node => node.id), ['top-left', 'top-right', 'bottom-left', 'bottom-right']);
});

test('long detail candidates reject sources and non-detail outputs', () => {
  assert.equal(isLongDetailCandidate({ kind: 'output', group: '详情图', status: 'completed', url: '/detail.png' }), true);
  assert.equal(isLongDetailCandidate({ kind: 'image', group: '详情图', isProductSource: true, status: 'ready', url: '/source.png' }), false);
  assert.equal(isLongDetailCandidate({ kind: 'output', group: '主图', status: 'completed', url: '/main.png' }), false);
});

test('detail preview order can be changed without mutating the input', () => {
  const ids = ['a', 'b', 'c'];
  assert.deepEqual(moveDetailItem(ids, 2, 0), ['c', 'a', 'b']);
  assert.deepEqual(ids, ['a', 'b', 'c']);
  assert.deepEqual(moveDetailItem(ids, -1, 2), ids);
});
