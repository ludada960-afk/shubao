import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getGridGuidePositions,
  moveGridGuide,
  resizeCanvasNodeByHandle,
} from '../src/pages/EcCanvas/canvasStudioModel.js';

test('grid guides expose one draggable position per internal split', () => {
  assert.deepEqual(getGridGuidePositions(2), [0.5]);
  assert.deepEqual(getGridGuidePositions(3), [1 / 3, 2 / 3]);
  assert.deepEqual(getGridGuidePositions(4, [0.2, 0.5, 0.8]), [0.2, 0.5, 0.8]);
});

test('grid guide movement is clamped so adjacent cells keep usable space', () => {
  const next = moveGridGuide([1 / 3, 2 / 3], 0, 0.95, 0.08);
  assert.equal(next[0], 2 / 3 - 0.08);
  assert.equal(next[1], 2 / 3);

  const moved = moveGridGuide([0.25, 0.75], 1, -0.2, 0.08);
  assert.equal(moved[0], 0.25);
  assert.equal(moved[1], 0.25 + 0.08);
});

test('text nodes resize freely from corners while media keeps its aspect ratio', () => {
  assert.deepEqual(
    resizeCanvasNodeByHandle(
      { x: 100, y: 100, w: 240, h: 80, kind: 'text' },
      { handle: 'se', dx: 80, dy: 40, preserveAspect: false },
    ),
    { x: 100, y: 100, w: 320, h: 120, kind: 'text' },
  );
  assert.deepEqual(
    resizeCanvasNodeByHandle(
      { x: 100, y: 100, w: 240, h: 80, kind: 'text' },
      { handle: 'nw', dx: 50, dy: 20, preserveAspect: false },
    ),
    { x: 150, y: 120, w: 190, h: 60, kind: 'text' },
  );
  assert.deepEqual(
    resizeCanvasNodeByHandle(
      { x: 40, y: 60, w: 240, h: 320, ratio: '3:4', kind: 'image' },
      { handle: 'e', dx: 80, dy: 0, preserveAspect: true },
    ),
    { x: 40, y: 60, w: 320, h: 427, ratio: '3:4', kind: 'image' },
  );
});

test('generation nodes resize freely even when their default ratio is square', () => {
  const suite = resizeCanvasNodeByHandle(
    { x: 40, y: 80, w: 640, h: 420, ratio: '1:1', kind: 'suite-composer' },
    { handle: 'e', dx: 80, dy: 0, preserveAspect: false },
  );
  assert.deepEqual({ x: suite.x, y: suite.y, w: suite.w, h: suite.h }, { x: 40, y: 80, w: 720, h: 420 });
});
