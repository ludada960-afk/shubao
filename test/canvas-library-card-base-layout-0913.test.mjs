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

/* 判据（不是写法）：「头部有主次 —— 大标题 + 弱化副标题 + 留白」。
   ⚠️ 2026-09-20 重写（RTK §3.1-10：契约测试锁的必须是判据，不是写法）。
   原断言写死 `font-size: 21px` —— 那是**被取代的旧规格**：
   D19 把 21px 归并进 20px 档（D19 字号阶梯：10/11/12/13/14/16/18/20/24/32/48），
   实测现状 `.canvas-library-head strong` = 20px / 800。断言因此锁住了一个已不存在的写法。
   现改为**判据断言**（阈值取自判据本身，不取自某一次的取值）：
     · 主标题字号 ≥20px（D19 阶梯里的「大标题」起点档）
     · 主标题**严格大于**副标题（否则谈不上「主次」）
     · 字重 ≥700（「大」的一半是「重」）
     · 头部上留白 ≥24px（与下方「呼吸感」用例同源的用户批注：9-16「信息密度太大、要有呼吸感」）
   依据：D19 字号阶梯；用户批注「标题与内容要有主次、不要拥挤」（canvas-library.css 28–31 行原注）。 */
test('头部有主次：大标题 + 弱化副标题 + 留白', () => {
  const strong = ruleOf('.canvas-library-head strong');
  const span = ruleOf('.canvas-library-head span');

  const sizeOf = (rule) => Number.parseFloat(rule.match(/font-size:\s*([\d.]+)px/)?.[1] || '0');
  const weightOf = (rule) => Number.parseInt(rule.match(/font-weight:\s*(\d+)/)?.[1] || '0', 10);

  const titleSize = sizeOf(strong);
  const subSize = sizeOf(span);
  const titleWeight = weightOf(strong);

  assert.ok(titleSize >= 20, 'D19：主标题字号落在「大标题」档（≥20px），实际 ' + titleSize + 'px');
  assert.ok(titleSize > subSize, '主次：主标题必须严格大于副标题，实际 ' + titleSize + 'px vs ' + subSize + 'px');
  assert.ok(titleWeight >= 700, '主次：主标题字重 ≥700，实际 ' + titleWeight);

  const head = ruleOf('.canvas-library-head');
  const padTop = Number.parseFloat(head.match(/padding:\s*(\d+)px/)?.[1] || '0');
  assert.ok(padTop >= 24, '留白：头部上留白 ≥24px，实际 ' + padTop + 'px');
});

/* 9-16 用户批注「信息密度太大、要有呼吸感」→ 三处留白写进 CSS 并锁死：
   ① 顶部 padding ≥ 28px；② 标题与副标题间距 ≥ 8px；③ 标题区与筛选栏间距 ≥ 16px。 */
test('呼吸感：顶部留白 ≥28px、标题↔副标题 ≥8px、标题区↔筛选栏 ≥16px', () => {
  const head = ruleOf('.canvas-library.is-page .canvas-library-head');
  assert.ok(head, '整页头部规则存在');
  const padTop = Number.parseFloat(head.match(/padding: (\d+)px/)?.[1] || '0');
  assert.ok(padTop >= 28, '顶部 padding ≥ 28px，实际 ' + padTop + 'px');
  const span = ruleOf('.canvas-library-head span');
  const gap = Number.parseFloat(span.match(/margin-top: (\d+)px/)?.[1] || '0');
  assert.ok(gap >= 8, '标题与副标题间距 ≥ 8px，实际 ' + gap + 'px');
  const tabs = ruleOf('.canvas-library-tabs');
  const tabsTop = Number.parseFloat(tabs.match(/padding: (\d+)px/)?.[1] || '0');
  assert.ok(tabsTop >= 16, '标题区与筛选栏间距 ≥ 16px，实际 ' + tabsTop + 'px');
});
