import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  createCanvasTextNode,
  getCanvasNodePresentation,
  resizeCanvasNode,
} from '../src/pages/EcCanvas/canvasStudioModel.js';

test('node presentation makes hover, selection and relation focus explicit', () => {
  assert.deepEqual(getCanvasNodePresentation({ selected: false, hovered: false, focusActive: false }), {
    state: 'idle',
    dimmed: false,
    handlesVisible: false,
  });
  assert.deepEqual(getCanvasNodePresentation({ selected: true, hovered: false, focusActive: true, related: true }), {
    state: 'selected',
    dimmed: false,
    handlesVisible: true,
  });
  assert.deepEqual(getCanvasNodePresentation({ selected: false, hovered: false, focusActive: true, related: false }), {
    state: 'idle',
    dimmed: true,
    handlesVisible: false,
  });
});

test('image resize preserves the media ratio and clamps width', () => {
  assert.deepEqual(
    resizeCanvasNode({ x: 40, y: 60, w: 240, h: 320, ratio: '3:4' }, { width: 360 }),
    { x: 40, y: 60, w: 360, h: 480, ratio: '3:4' },
  );
  assert.deepEqual(
    resizeCanvasNode({ x: 40, y: 60, w: 240, h: 240, ratio: '1:1' }, { width: 40 }),
    { x: 40, y: 60, w: 160, h: 160, ratio: '1:1' },
  );
});

test('text creation produces a real editable canvas object rather than a form card', () => {
  const node = createCanvasTextNode({ x: 120, y: 160, sourceNodeId: 'source-1', now: 1234 });
  assert.deepEqual(node, {
    id: 'text_1234',
    kind: 'text',
    x: 120,
    y: 160,
    w: 420,
    h: 180,
    text: '',
    placeholder: '输入标题、卖点或生成要求',
    sourceNodeIds: ['source-1'],
    status: 'ready',
  });
});

test('studio surface owns distinct add, selection and derivation controls', () => {
  const source = readFileSync(new URL('../src/pages/EcCanvas/components/CanvasStudio.jsx', import.meta.url), 'utf8');
  assert.match(source, /ec-canvas-add-menu/);
  assert.match(source, /ec-canvas-object-toolbar/);
  assert.match(source, /ec-canvas-derive-menu/);
  assert.match(source, /contentEditable/);
  assert.doesNotMatch(source, /<header>\s*文本\s*<\/header>/);
});
