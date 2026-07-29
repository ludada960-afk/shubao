import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CANVAS_ACTIONS,
  actionsForSurface,
  getCanvasAction,
} from '../src/pages/EcCanvas/canvasActionRegistry.js';

const completedOutput = { id: 'output-1', kind: 'output', status: 'completed', url: '/result.png' };

test('hover exposes only adjust requirements and regenerate', () => {
  assert.deepEqual(
    actionsForSurface({ surface: 'hover', node: completedOutput }).map(action => action.id),
    ['adjust-requirements', 'regenerate'],
  );
});

test('every Canvas command is declared once with execution and billing metadata', () => {
  assert.equal(new Set(CANVAS_ACTIONS.map(action => action.id)).size, CANVAS_ACTIONS.length);
  for (const action of CANVAS_ACTIONS) {
    assert.equal(typeof action.label, 'string', action.id);
    assert.equal(Array.isArray(action.surfaces), true, action.id);
    assert.equal(typeof action.canRun, 'function', action.id);
    assert.equal(typeof action.requiresPrompt, 'boolean', action.id);
    assert.ok(Object.hasOwn(action, 'priceFeature'), action.id);
    assert.equal(typeof action.execute, 'object', action.id);
  }
});

test('selection and context surfaces are intentionally different', () => {
  assert.deepEqual(
    actionsForSurface({ surface: 'selection', node: completedOutput }).map(action => action.id),
    ['download', 'image-info', 'add-reference', 'delete'],
  );
  assert.ok(actionsForSurface({ surface: 'context', node: completedOutput }).some(action => action.id === 'product-remix'));
  assert.equal(getCanvasAction('rename'), null);
  assert.equal(getCanvasAction('classify'), null);
});

test('only ready source images and completed outputs expose deep workflow actions', () => {
  const sourceGroup = { id: 'source-1', kind: 'source_group', status: 'ready', assets: [{ url: '/product.png' }] };
  const runningOutput = { id: 'output-2', kind: 'output', status: 'generating', url: '/still-running.png' };

  assert.deepEqual(
    actionsForSurface({ surface: 'port', node: sourceGroup }).map(action => action.id),
    ['product-remix', 'outpaint', 'inpaint', 'remove-background', 'layer-edit', 'translate', 'upscale'],
  );
  assert.deepEqual(actionsForSurface({ surface: 'port', node: runningOutput }), []);
  assert.equal(actionsForSurface({ surface: 'port', node: { kind: 'process', status: 'ready', url: '/derived.png' } }).length, 0);
});

test('outpaint records its required ratio and prompt before a quote can run', () => {
  assert.deepEqual(getCanvasAction('outpaint').execute.requires, { ratio: true, prompt: true });
});
