import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  CANVAS_ACTIONS,
  actionsForSurface,
  getCanvasAction,
} from '../src/pages/EcCanvas/canvasActionRegistry.js';

const completedOutput = { id: 'output-1', kind: 'output', status: 'completed', url: '/result.png' };

test('hover is visual only and never duplicates commands inside a node', () => {
  assert.deepEqual(actionsForSurface({ surface: 'hover', node: completedOutput }), []);
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
    ['image-info', 'download', 'add-reference', 'crop', 'annotation'],
  );
  assert.deepEqual(
    actionsForSurface({ surface: 'context', node: completedOutput }).map(action => action.id),
    ['duplicate', 'delete'],
  );
  const selection = new Set(actionsForSurface({ surface: 'selection', node: completedOutput }).map(action => action.id));
  const context = actionsForSurface({ surface: 'context', node: completedOutput }).map(action => action.id);
  assert.equal(context.some(id => selection.has(id)), false);
  assert.equal(getCanvasAction('rename'), null);
  assert.equal(getCanvasAction('classify'), null);
});

test('only ready source images and completed outputs expose deep workflow actions', () => {
  const sourceGroup = { id: 'source-1', kind: 'source_group', status: 'ready', assets: [{ url: '/product.png' }] };
  const runningOutput = { id: 'output-2', kind: 'output', status: 'generating', url: '/still-running.png' };

  assert.deepEqual(
    actionsForSurface({ surface: 'image-editor', node: sourceGroup }).map(action => action.id),
    ['product-remix', 'outpaint', 'inpaint', 'remove-background', 'layer-edit', 'translate', 'upscale'],
  );
  assert.deepEqual(actionsForSurface({ surface: 'image-editor', node: runningOutput }), []);
  assert.equal(actionsForSurface({ surface: 'image-editor', node: { kind: 'process', status: 'ready', url: '/derived.png' } }).length, 0);
});

test('outpaint records its required ratio and prompt before a quote can run', () => {
  assert.deepEqual(getCanvasAction('outpaint').execute.requires, { ratio: true, prompt: true });
});

test('workflow view models contain no fallback command registry', () => {
  const viewModel = readFileSync(new URL('../src/pages/EcCanvas/components/workflowNodes/modular/workflowNodeViewModel.js', import.meta.url), 'utf8');
  const workflowNode = readFileSync(new URL('../src/pages/EcCanvas/components/workflowNodes/modular/CanvasWorkflowNode.jsx', import.meta.url), 'utf8');
  assert.doesNotMatch(viewModel, /DEFAULT_ACTIONS/);
  assert.match(workflowNode, /getCanvasAction\(node\?\.actionId\)/);
});

test('the product remix visible name is sourced only from CANVAS_ACTIONS', () => {
  const legacyNodes = readFileSync(new URL('../src/pages/EcCanvas/components/workflowNodes/index.jsx', import.meta.url), 'utf8');
  const modularNode = readFileSync(new URL('../src/pages/EcCanvas/components/workflowNodes/modular/SmartRemixNodeCard.jsx', import.meta.url), 'utf8');
  const workflowNode = readFileSync(new URL('../src/pages/EcCanvas/components/workflowNodes/modular/CanvasWorkflowNode.jsx', import.meta.url), 'utf8');
  assert.equal(getCanvasAction('smart-remix').label, '商品图改造');
  assert.doesNotMatch(`${legacyNodes}\n${modularNode}`, /智能二创/);
  assert.match(workflowNode, /getCanvasAction\(node\?\.actionId\)/);
  assert.match(modularNode, /title=\{action\?\.label\}/);
});
