// test/video-model-menu-0912.test.mjs
// 2026-09-12 用户批注：① 模型图标是深色底，看着一团黑；② 模型弹层太矮，一次只看得到 2 个模型。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/pages/VideoStudio/VideoStudio.css', import.meta.url), 'utf8');

test('模型图标改为白底细边（彩色品牌标自带配色）', () => {
  const rule = css.match(/\.video-model-mark \{([^}]*)\}/);
  assert.ok(rule, '规则存在');
  assert.match(rule[1], /background: #fff/);
  assert.doesNotMatch(rule[1], /background: #343840/, '不得再用深色底');
  assert.doesNotMatch(css, /\.video-model-mark\.is-seedance \{ background: linear-gradient/, '渐变深底必须去掉');
});

test('模型弹层一次能看到 5 个以上（高度足够）且水平居中', () => {
  const rule = css.match(/\.video-inline-menu \{([^}]*)\}/);
  assert.ok(rule, '规则存在');
  assert.match(rule[1], /max-height: min\(58vh, 460px\)/);
  assert.match(rule[1], /left: 50%/);
  assert.match(rule[1], /transform: translateX\(-50%\)/);
});
