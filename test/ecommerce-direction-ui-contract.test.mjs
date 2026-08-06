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

test('方案页面使用统一可编辑的整体设计方案，并保留补充素材入口', () => {
  assert.match(pageSource, /EcommerceDesignPlanEditor/);
  assert.match(pageSource, /整体设计规范与图片规划/);
  assert.match(pageSource, /ec-direction-plan-stack/);
  assert.match(pageSource, /execution_guide: plan\.brief/);
  assert.doesNotMatch(pageSource, /<DirectionOptionCard/);
  assert.doesNotMatch(pageSource, /ec-direction-grid/);
});

test('方案编辑器突出每张图可编辑的重点，并在中等桌面宽度保持可收缩布局', () => {
  const editorSource = readFileSync(new URL('../src/pages/Home/ec/EcommerceDesignPlanEditor.jsx', import.meta.url), 'utf8');
  const editorCss = readFileSync(new URL('../src/pages/Home/ec/EcommerceDesignPlanEditor.css', import.meta.url), 'utf8');
  const homeCss = readFileSync(new URL('../src/pages/Home/Home.css', import.meta.url), 'utf8');

  assert.match(editorSource, /生成规格/);
  assert.match(editorSource, /本图重点/);
  assert.doesNotMatch(editorSource, /本图差异/);
  assert.match(editorSource, /ec-shared-shot-field--primary/);
  assert.match(editorSource, /商品依据/);
  assert.match(editorCss, /#f4efe5/i);
  assert.match(editorCss, /@media \(max-width: 900px\)/);
  assert.match(editorCss, /grid-template-columns: 30px minmax\(0, 1fr\) auto 20px/);
  assert.match(editorCss, /\.ec-direction-supplement[^{]*\{[^}]*min-width: 0/);
  assert.match(homeCss, /--ec-prompt-inline/);
});
