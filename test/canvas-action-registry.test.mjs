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

test('selection exposes the complete commerce image toolbar (11 原有 + 4 流影AI = 15, 4c183cd4 续命 v2) in observed order', () => {
  /* 4c183cd4 续命 画布中央 + 右侧'引用当前素材生成'深度重构 v2: 11 selection surface actions +
     4 新增 (流影AI LibTV 风格, 用户硬性指定) 共 15 个. 5 原有 (selection 表面已经有 11) 全部保留. */
  assert.deepEqual(
    actionsForSurface({ surface: 'selection', node: completedOutput }).map(action => action.id),
    [
      'edit-text',
      'add-text',
      'grid-split',
      'layer-edit',
      'remove-background',
      'move-scale',
      'reverse-prompt',
      'annotation',
      'crop',
      'split-image',
      'download',
      'one-click-suite',
      'one-click-video',
      'tts-voiceover',
      'caption-motion',
    ],
  );
});

test('selection never offers delete — top bar and keyboard Delete own it', () => {
  const nodes = [
    completedOutput,
    { id: 'image-1', kind: 'image', status: 'ready', url: '/product.png' },
    { id: 'upload-1', kind: 'image', status: 'uploading', url: 'data:image/jpeg;base64,preview' },
  ];
  for (const node of nodes) {
    assert.equal(
      actionsForSurface({ surface: 'selection', node }).some(action => action.id === 'delete'),
      false,
      node.id,
    );
  }
});

test('fresh uploads keep local tools immediately from their preview url', () => {
  const uploading = { id: 'upload-1', kind: 'image', status: 'uploading', url: 'data:image/jpeg;base64,preview' };
  // 双面板齐张：上传落选的第一帧就有完整本地工具，而不是只剩（或没有）垃圾桶
  assert.deepEqual(
    actionsForSurface({ surface: 'selection', node: uploading }).map(action => action.id),
    ['add-text', 'grid-split', 'move-scale', 'crop', 'split-image', 'download'],
  );
  // 服务端往返动作仍然等待持久化完成
  for (const gatedId of ['edit-text', 'layer-edit', 'remove-background', 'reverse-prompt']) {
    assert.equal(actionsForSurface({ surface: 'selection', node: uploading }).some(action => action.id === gatedId), false, gatedId);
  }
  const failed = { id: 'upload-2', kind: 'image', status: 'upload-error', url: '' };
  assert.deepEqual(actionsForSurface({ surface: 'selection', node: failed }), []);
});

test('context menu exposes complete object operations without duplicating selection tools', () => {
  assert.deepEqual(
    actionsForSurface({ surface: 'context', node: completedOutput }).map(action => action.id),
    [
      'copy',
      'paste',
      'duplicate',
      'bring-forward',
      'send-backward',
      'bring-front',
      'send-back',
      'toggle-visibility',
      'toggle-lock',
      'flip-horizontal',
      'flip-vertical',
      'export-object',
      'delete',
    ],
  );
  const selection = new Set(actionsForSurface({ surface: 'selection', node: completedOutput }).map(action => action.id));
  const context = actionsForSurface({ surface: 'context', node: completedOutput }).map(action => action.id);
  assert.deepEqual(context.filter(id => selection.has(id)), []);
  assert.equal(getCanvasAction('rename'), null);
  assert.equal(getCanvasAction('classify'), null);
});

test('context commands never advertise image-only operations on text or source groups', () => {
  const text = { id: 'text-1', kind: 'text', status: 'ready' };
  const sourceGroup = { id: 'source-1', kind: 'source_group', status: 'ready', assets: [{ url: '/product.png' }] };
  const textActions = actionsForSurface({ surface: 'context', node: text }).map(action => action.id);
  const sourceActions = actionsForSurface({ surface: 'context', node: sourceGroup }).map(action => action.id);

  for (const actions of [textActions, sourceActions]) {
    assert.equal(actions.includes('flip-horizontal'), false);
    assert.equal(actions.includes('flip-vertical'), false);
    assert.equal(actions.includes('export-object'), false);
    assert.equal(actions.includes('toggle-visibility'), true);
    assert.equal(actions.includes('toggle-lock'), true);
  }
});

test('ready image outputs expose deep workflow actions (5 原有 + 4 流影AI = 9, 4c183cd4 续命 v2) while running outputs stay disabled', () => {
  /* 4c183cd4 续命 画布中央 + 右侧'引用当前素材生成'深度重构 v2: 5 原有 + 4 流影AI (用户硬性要求保留 5 原有) */
  const sourceGroup = { id: 'source-1', kind: 'source_group', status: 'ready', assets: [{ url: '/product.png' }] };
  const runningOutput = { id: 'output-2', kind: 'output', status: 'generating', url: '/still-running.png' };
  const readyOutput = { id: 'output-3', kind: 'output', status: 'ready', url: '/ready.png' };
  const expected9 = ['product-remix', 'outpaint', 'inpaint', 'translate', 'upscale',
    'one-click-suite', 'one-click-video', 'tts-voiceover', 'caption-motion'];

  assert.deepEqual(
    actionsForSurface({ surface: 'image-editor', node: sourceGroup }).map(action => action.id),
    expected9,
  );
  assert.deepEqual(actionsForSurface({ surface: 'image-editor', node: runningOutput }), []);
  assert.deepEqual(
    actionsForSurface({ surface: 'image-editor', node: readyOutput }).map(action => action.id),
    expected9,
  );
  assert.equal(actionsForSurface({ surface: 'image-editor', node: { kind: 'process', status: 'ready', url: '/derived.png' } }).length, 0);
});

test('outpaint records its required ratio and prompt before a quote can run', () => {
  assert.deepEqual(getCanvasAction('outpaint').execute.requires, { ratio: true, prompt: true });
});

test('add-text is a free local action reserved for real inline text editing', () => {
  const action = getCanvasAction('add-text');
  assert.ok(action);
  assert.equal(action.label, '添加文字');
  assert.deepEqual(action.execute, { type: 'local', handler: 'add-text', requires: {} });
  assert.equal(action.priceFeature, null);
  assert.equal(action.priceLabel, '免费');
  assert.equal(actionsForSurface({ surface: 'selection', node: completedOutput }).filter(item => item.id === 'add-text').length, 1);
  assert.deepEqual(actionsForSurface({ surface: 'context', node: completedOutput }).filter(item => item.id === 'add-text'), []);
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
