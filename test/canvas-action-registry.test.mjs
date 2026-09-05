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

test('selection exposes the pure image-edit toolbar (9 项, 9-05 反馈: 生成/应用类只在素材 + 派生菜单)', () => {
  assert.deepEqual(
    actionsForSurface({ surface: 'selection', node: completedOutput }).map(action => action.id),
    [
      'add-text',
      'grid-split',
      'layer-edit',
      'remove-background',
      'move-scale',
      'reverse-prompt',
      'annotation',
      'crop',
      'download',
    ],
  );
  /* 生成/应用类不再出现在工具栏 (用户 9-05: 与派生菜单重复) */
  const ids = actionsForSurface({ surface: 'selection', node: completedOutput }).map(action => action.id);
  for (const dup of ['split-image', 'application-1click-suite', 'application-1click-video', 'application-tts', 'application-caption']) {
    assert.equal(ids.includes(dup), false, '工具栏不应含 ' + dup);
  }
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
  // 用户 9-05: 上传中节点 url 门槛即过 — 本地工具 + 派生类 (layer-edit/remove-background) 全部立即可用
  assert.deepEqual(
    actionsForSurface({ surface: 'selection', node: uploading }).map(action => action.id),
    ['add-text', 'grid-split', 'layer-edit', 'remove-background', 'move-scale', 'crop', 'download'],
  );
  // 纯 isReadyImage 门槛的动作仍等待 status=ready
  for (const gatedId of ['edit-text', 'reverse-prompt', 'annotation']) {
    assert.equal(actionsForSurface({ surface: 'selection', node: uploading }).some(action => action.id === gatedId), false, gatedId);
  }
  const failed = { id: 'upload-2', kind: 'image', status: 'upload-error', url: '' };
  assert.deepEqual(actionsForSurface({ surface: 'selection', node: failed }), []);
});

test('context menu exposes complete object operations without duplicating selection tools', () => {
  assert.deepEqual(
    actionsForSurface({ surface: 'context', node: completedOutput }).map(action => action.id),
    [
      'split-image',
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

test('ready image outputs expose deep workflow actions (5 原有 + 4 应用节点 = 9, 4c183cd4 续命 v2 + 2026-08-30 画布总统筹重审) while running outputs stay disabled', () => {
  /* 4c183cd4 续命 画布中央 + 右侧'引用当前素材生成'深度重构 v2: 5 原有 + 4 应用节点
     2026-08-30 画布总统筹重审拿掉 AI 智能组 (one-click-suite/video/tts-voiceover/caption-motion)
     改成 4 应用节点 (application-1click-suite/video/tts/caption, Quantv §10.2) */
  const sourceGroup = { id: 'source-1', kind: 'source_group', status: 'ready', assets: [{ url: '/product.png' }] };
  const runningOutput = { id: 'output-2', kind: 'output', status: 'generating', url: '/still-running.png' };
  const readyOutput = { id: 'output-3', kind: 'output', status: 'ready', url: '/ready.png' };
  const expected9 = ['product-remix', 'outpaint', 'inpaint', 'translate', 'upscale',
    'application-1click-suite', 'application-1click-video', 'application-tts', 'application-caption'];

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
