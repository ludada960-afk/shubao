import assert from 'node:assert/strict';
import test from 'node:test';

import { placeDerivedRightOfSources } from '../src/pages/EcCanvas/canvasDerivedPlacement.js';

test('derived output is placed to the right of the complete source union', () => {
  const result = placeDerivedRightOfSources({
    sources: [
      { id: 'a', x: 20, y: 40, w: 200, h: 300 },
      { id: 'b', x: 260, y: 80, w: 200, h: 300 },
    ],
    occupied: [],
    width: 240,
    height: 1200,
    gap: 80,
  });
  assert.deepEqual(result, { x: 540, y: 40 });
});
test('right-side placement skips collisions without falling below the source group', () => {
  const result = placeDerivedRightOfSources({
    sources: [{ id: 'source', x: 0, y: 100, w: 200, h: 400 }],
    occupied: [{ id: 'blocker', x: 280, y: 100, w: 240, h: 1200 }],
    width: 240,
    height: 1200,
    gap: 80,
  });
  assert.deepEqual(result, { x: 600, y: 100 });
});

test('source nodes are ignored as blockers and invalid geometry is rejected', () => {
  assert.deepEqual(placeDerivedRightOfSources({
    sources: [{ id: 'source', x: 10, y: 20, w: 100, h: 100 }],
    occupied: [{ id: 'source', x: 10, y: 20, w: 100, h: 100 }],
    width: 80,
    height: 160,
    gap: 20,
  }), { x: 130, y: 20 });
  assert.throws(() => placeDerivedRightOfSources({ sources: [], width: 0, height: 20 }), /尺寸无效/);
});
