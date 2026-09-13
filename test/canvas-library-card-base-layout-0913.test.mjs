// test/canvas-library-card-base-layout-0913.test.mjs
// 2026-09-13 生产复现（用户截图：卡片依然是细条、封面张不开）：
//   上一版把卡片布局写在 `.canvas-library.is-page` 作用域里，线上没吃到 → 仍然塌陷。
//   修法：卡片/封面/遮罩/按钮**全部写进基础规则**，任何作用域组合下都能正确渲染。
//   已用静态 HTML 实测两种场景：A(is-page) 卡片 232px / 封面 230px；B(无 is-page) 卡片 222px / 封面 220px。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/pages/EcCanvas/components/canvas-library.css', import.meta.url), 'utf8');
const ruleOf = selector => {
  const line = css.split('\n').find(l => l.startsWith(selector + ' {'));
  return line || '';
};

test('卡片与封面用基础规则（不依赖变体作用域）', () => {
  const card = ruleOf('.canvas-library-card');
  assert.ok(card.includes('display: block'), '卡片基础布局');
  assert.ok(card.includes('position: relative'), '卡片是定位参照');
  const cover = ruleOf('.canvas-library-cover');
  assert.ok(/height: 220px/.test(cover), '封面基础高度');
  assert.ok(!/aspect-ratio/.test(cover), '不依赖 aspect-ratio');
});

test('标题/时间是底部遮罩，操作按钮悬停才浮现（基础规则）', () => {
  const body = ruleOf('.canvas-library-card-body');
  assert.ok(body.includes('position: absolute'), '信息为遮罩');
  assert.ok(body.includes('linear-gradient'), '底部渐变');
  const actions = ruleOf('.canvas-library-card-actions');
  assert.ok(actions.includes('opacity: 0'), '按钮默认隐藏');
  assert.ok(actions.includes('display: flex'), '按钮用 flex 不靠 display:none 切换');
  assert.ok(css.includes(':hover .canvas-library-card-actions,') || css.includes(':focus-within .canvas-library-card-actions'), '悬停/聚焦显示');
  const btn = ruleOf('.canvas-library-card-actions button');
  assert.ok(/width: 34px/.test(btn) && /height: 34px/.test(btn), '按钮够大够清楚');
});

test('头部有主次：大标题 + 弱化副标题 + 留白', () => {
  assert.ok(/font-size: 21px/.test(ruleOf('.canvas-library-head strong')), '标题更大更重');
  assert.ok(/padding: 22px 26px 18px/.test(ruleOf('.canvas-library-head')), '头部留白充足');
});
