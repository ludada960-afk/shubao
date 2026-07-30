import assert from 'node:assert/strict';
import test from 'node:test';

import { cubicEdgePath, getNodePortCenter, layoutAssetLanes, mediaHeightForRatio } from '../src/pages/EcCanvas/canvasGeometry.js';

test('model geometry keeps a node port synchronized with its rectangle', () => {
  const node = { x: 10, y: 20, w: 200, h: 100 };
  assert.deepEqual(getNodePortCenter(node, 'input'), { x: 10, y: 70 });
  assert.deepEqual(getNodePortCenter(node, 'output'), { x: 210, y: 70 });
  assert.equal(cubicEdgePath({ x: 210, y: 70 }, { x: 410, y: 130 }), 'M 210 70 C 310 70, 310 130, 410 130');
});

test('asset lanes retain ratio geometry and place same-category outputs horizontally', () => {
  const nodes = layoutAssetLanes({
    sourceNode: { x: 30, w: 248 },
    assets: [
      { id: 'white-a', group: '白底图', ratio: '1:1' },
      { id: 'main-a', group: '主图', ratio: '1:1' },
      { id: 'main-b', group: '主图', ratio: '3:4' },
      { id: 'detail-a', group: '详情图', ratio: '3:4' },
    ],
  });
  const main = nodes.filter(node => node.group === '主图');
  assert.ok(nodes.find(node => node.id === 'white-a').y < main[0].y);
  assert.equal(main[0].y, main[1].y);
  assert.ok(main[1].x > main[0].x);
  assert.equal(main[1].h, mediaHeightForRatio('3:4', main[1].w));
  assert.ok(nodes.find(node => node.id === 'detail-a').y > main[0].y);
});
