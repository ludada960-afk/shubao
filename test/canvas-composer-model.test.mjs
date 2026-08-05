import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildCanvasSuitePlan,
  updateCanvasSuitePlanField,
} from '../src/pages/EcCanvas/canvasSuitePlanModel.js';
import {
  closeCanvasComposerSurface,
  toggleCanvasComposerSurface,
} from '../src/pages/EcCanvas/canvasStudioModel.js';

test('composer surfaces are mutually exclusive and close on demand', () => {
  assert.equal(toggleCanvasComposerSurface('', 'ratio'), 'ratio');
  assert.equal(toggleCanvasComposerSurface('ratio', 'suite:sizing'), 'suite:sizing');
  assert.equal(toggleCanvasComposerSurface('suite:sizing', 'suite:sizing'), '');
  assert.equal(closeCanvasComposerSurface('suite:sizing'), '');
});

test('suite plans normalize one overall brief and editable shot responsibilities', () => {
  const plan = buildCanvasSuitePlan({
    title: '轻盈日常',
    one_liner: '让商品进入真实生活',
    commercial_objective: '提升转化',
    audience: '高意向用户',
    visual_system: { composition: '主体居中，留出文案区', visual_style: '清透自然' },
    product_strategy: { hero_focus: '主体轮廓', scenario_plan: '日常场景' },
    deliverables: [{
      role: 'main_text',
      label: '商品主图',
      count: 1,
      ratio: '1:1',
      shots: [{ label: '商品识别主图', purpose: '看清商品', visual_execution: '正面展示商品' }],
    }],
  }, '请保持商品外观一致');

  assert.equal(plan.title, '整体设计方案');
  assert.equal(plan.visualDirection, '清透自然');
  assert.equal(plan.productStrategy, '主体轮廓；日常场景');
  assert.equal(plan.audience, '高意向用户');
  assert.equal(plan.composition, '主体居中，留出文案区');
  assert.equal(plan.shots[0].dimension, '1:1');
  assert.equal(plan.shots[0].responsibility, '正面展示商品');
  assert.equal(plan.shots[0].purpose, '看清商品');
});

test('suite plan field edits are immutable and do not discard shot plans', () => {
  const plan = buildCanvasSuitePlan({ deliverables: [{ role: 'detail', label: '详情图', count: 1, ratio: '3:4', shots: [{ label: '材质细节', visual_execution: '靠近展示纹理' }] }] });
  const originalComposition = plan.composition;
  const updated = updateCanvasSuitePlanField(plan, 'composition', '右侧留出统一文案区');
  assert.equal(plan.composition, originalComposition);
  assert.equal(updated.composition, '右侧留出统一文案区');
  assert.equal(updated.shots[0].dimension, '3:4');
  assert.equal(updated.shots[0].title, '材质细节');
});
