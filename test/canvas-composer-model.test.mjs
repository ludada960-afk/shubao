import assert from 'node:assert/strict';
import test from 'node:test';

import {
  applyCanvasSuitePlanToDirection,
  buildCanvasSuitePlan,
  updateCanvasSuitePlanField,
  updateCanvasSuitePlanShot,
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

test('suite plans display the requested ecommerce target ratio', () => {
  const plan = buildCanvasSuitePlan({
    deliverables: [{
      role: 'main_text',
      label: '横版商品主图',
      count: 1,
      ratio: '4:3',
      targetRatio: '16:9',
      shots: [{ label: '横版主视觉' }],
    }],
  });

  assert.equal(plan.shots[0].dimension, '16:9');
});

test('detailed per-shot edits compile into the durable generation direction', () => {
  const direction = {
    deliverables: [{
      role: 'detail',
      label: '详情图',
      count: 1,
      ratio: '3:4',
      shots: [{ label: '材质细节', purpose: '展示材质', visual_execution: '靠近展示纹理' }],
    }],
    visual_system: {},
    product_strategy: {},
  };
  const plan = buildCanvasSuitePlan(direction, '突出真实材质');
  const edited = updateCanvasSuitePlanShot(plan, 'detail-1', {
    title: '表面质感细节',
    scene: '自然侧光下的近景台面',
    negativeConstraints: '不得虚构材质认证或参数。',
  });
  const applied = applyCanvasSuitePlanToDirection(edited, direction);
  const shot = applied.deliverables[0].shots[0];

  assert.equal(shot.label, '表面质感细节');
  assert.match(shot.visual_execution, /自然侧光下的近景台面/);
  assert.match(shot.visual_execution, /不得虚构材质认证或参数/);
});

test('suite plans expose product evidence and each shot differentiator as editable generation specifications', () => {
  const plan = buildCanvasSuitePlan({
    productName: '赤霞珠干红葡萄酒',
    category: '红酒',
    analysis: {
      product_observations: ['深红色酒液', '深色玻璃瓶'],
      product_uncertainties: ['年份未确认'],
    },
    product_creative_profile: {
      id: 'red-wine',
      typography_intent: '优雅衬线体，留白克制',
      copy_tone: '礼赠感、克制、以品鉴氛围表达价值',
    },
    deliverables: [{
      role: 'main_text', label: '商品主图', count: 1, ratio: '1:1', shots: [{
        label: '礼赠主视觉', purpose: '建立高级礼赠感', variation_key: 'gift-hero',
        visual_execution: '低饱和深红背景，瓶身居中并保留左侧标题空间',
      }],
    }],
  });

  assert.deepEqual(plan.evidence.observations, ['深红色酒液', '深色玻璃瓶']);
  assert.equal(plan.creativeProfile.id, 'red-wine');
  assert.equal(plan.shots[0].differentiator, 'gift-hero');
  assert.match(plan.shots[0].copy, /优雅衬线体|礼赠感/);
});
