import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { updateDirectionShotPlan } from '../src/pages/Home/ec/components/directionUiModel.js';

const direction = {
  title: '轻盈日常',
  one_liner: '把商品放进真实生活里，让人一眼看懂怎么用',
  commercial_objective: '提升转化',
  audience: '高意向用户',
  product_strategy: { hero_focus: '主体轮廓', scenario_plan: '日常场景' },
  execution_guide: '整套执行说明不应该再成为主要编辑入口',
  deliverables: [{
    role: 'main_text',
    label: '商品主图',
    count: 2,
    ratio: '1:1',
    shots: [
      { label: '主图一', purpose: '看清商品', visual_execution: '正面展示商品' },
      { label: '主图二', purpose: '理解使用', visual_execution: '放入真实场景' },
    ],
  }],
};

test('updates one image plan without mutating the direction snapshot', () => {
  const updated = updateDirectionShotPlan(direction, 'main_text-1', '改成近距离展示材质与使用动作');

  assert.equal(direction.deliverables[0].shots[1].visual_execution, '放入真实场景');
  assert.equal(updated.deliverables[0].shots[1].visual_execution, '改成近距离展示材质与使用动作');
  assert.equal(updated.deliverables[0].shots[0].visual_execution, '正面展示商品');
});

test('the direction card exposes the locked overall design system and editable per-image plan', () => {
  const source = readFileSync(new URL('../src/pages/Home/ec/components/DirectionOptionCard.jsx', import.meta.url), 'utf8');

  assert.match(source, /整体设计规范/);
  assert.match(source, /统一视觉标准，不随单张修改改变/);
  assert.match(source, /逐张图片计划/);
  assert.match(source, /onShotChange/);
});
