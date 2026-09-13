// test/canvas-library-card-layout-0913.test.mjs
// 2026-09-13 用户反馈「新建画布变成细条了」：
//   根因：照抄竞品时用 aspect-ratio 撑封面，在 button 上不稳 → 卡片塌成 ~20px 细条。
//   修法：封面改固定高度（230px）。已用「静态 HTML + 同款 CSS」渲染验证卡片高度 232px、封面 230px。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/pages/EcCanvas/components/canvas-library.css', import.meta.url), 'utf8');

test('画布库封面用固定高度（不再靠 aspect-ratio 撑）', () => {
  assert.ok(css.includes('height: 230px'), '封面固定高度');
  assert.ok(css.includes('min-height: 230px'), '最小高度兜底');
  /* 整页模式的封面规则里不得再出现 aspect-ratio */
  const lines = css.split('\n').filter(line => line.includes('.canvas-library.is-page .canvas-library-cover {') && line.includes('height'));
  assert.ok(lines.length, '找到整页模式的封面规则');
  assert.ok(!lines[0].includes('aspect-ratio'), '不再依赖 aspect-ratio（曾导致卡片塌陷）');
});

test('封面居中裁剪、信息为底部遮罩', () => {
  assert.ok(css.includes('object-position: center center'), '长图取中间而不是只露上半截');
  assert.ok(css.includes('position: absolute'), '标题/时间是遮罩');
  assert.ok(css.includes('linear-gradient(180deg, rgba(15,15,18,0), rgba(15,15,18,.72))'), '底部渐变遮罩');
});

test('操作按钮悬停才浮现（默认透明、hover 显示）', () => {
  const actions = css.split('\n').find(line => line.includes('.canvas-library-card-actions {') && line.includes('opacity: 0'));
  assert.ok(actions, '默认隐藏');
  assert.ok(css.includes(':hover .canvas-library-card-actions { opacity: 1'), '悬停显示');
});
