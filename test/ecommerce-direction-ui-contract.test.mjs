import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import * as directionUiModel from '../src/pages/Home/ec/components/directionUiModel.js';

const cardSource = readFileSync(new URL('../src/pages/Home/ec/components/DirectionOptionCard.jsx', import.meta.url), 'utf8');
const pageSource = readFileSync(new URL('../src/pages/Home/ec/DesignDirection.jsx', import.meta.url), 'utf8');

test('整套执行说明应可安全读取、更新且不改变图片配置', () => {
  assert.equal(typeof directionUiModel.getDirectionExecutionGuide, 'function');
  assert.equal(typeof directionUiModel.updateDirectionExecutionGuide, 'function');

  const direction = {
    execution_guide: '统一冷白背景，先展示轮廓，再用近景解释材质。',
    deliverables: [{ role: 'main_text', count: 1, shots: [{ label: '主图' }] }],
  };
  const updated = directionUiModel.updateDirectionExecutionGuide(direction, '先展示商品，再补充真实使用场景。');

  assert.equal(directionUiModel.getDirectionExecutionGuide(direction), '统一冷白背景，先展示轮廓，再用近景解释材质。');
  assert.equal(updated.execution_guide, '先展示商品，再补充真实使用场景。');
  assert.equal(updated.deliverables, direction.deliverables);
  assert.notEqual(updated, direction);
  assert.equal(direction.execution_guide, '统一冷白背景，先展示轮廓，再用近景解释材质。');
});

test('方案卡片应展示商品策略并提供整套执行说明编辑入口', () => {
  assert.match(cardSource, /商品策略/);
  assert.match(cardSource, /商业目标/);
  assert.match(cardSource, /目标用户/);
  assert.match(cardSource, /逐张图片计划/);
  assert.match(cardSource, /整套执行说明/);
  assert.match(cardSource, /onExecutionGuideChange/);
  assert.match(cardSource, /data-editable-area/);
  assert.match(cardSource, /aria-label=\{`编辑\$\{direction\?\.title/);
});

test('方案页面应保持编辑方案选中并使用桌面双列、移动单列布局', () => {
  assert.match(pageSource, /updateDirectionExecutionGuide/);
  assert.match(pageSource, /onExecutionGuideChange/);
  assert.match(pageSource, /setSelected\(i\)/);
  assert.match(pageSource, /ec-direction-grid/);
  assert.match(pageSource, /grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(pageSource, /@media\s*\(max-width:\s*760px\)/);
  assert.match(pageSource, /grid-template-columns:\s*1fr/);
});
