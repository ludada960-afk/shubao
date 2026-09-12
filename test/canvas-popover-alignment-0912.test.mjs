// test/canvas-popover-alignment-0912.test.mjs
// 2026-09-12 用户批注（第三次）：向上张开的弹层没有居中；模型弹层图标与文字间距过大。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/pages/EcCanvas/EcCanvas.css', import.meta.url), 'utf8');
const home = readFileSync(new URL('../src/pages/Home/Home.css', import.meta.url), 'utf8');

test('画布参数弹层：向上张开并相对触发按钮水平居中', () => {
  const rule = css.match(/\.ec-canvas-parameter-popover \{([^}]*)\}/);
  assert.ok(rule, '规则存在');
  assert.match(rule[1], /left: 50%/);
  assert.match(rule[1], /transform: translateX\(-50%\)/);
  assert.match(rule[1], /bottom: calc\(100% \+ 9px\)/);
  assert.doesNotMatch(rule[1], /left: 0;/, '不得再左对齐');
  assert.match(css, /\.ec-canvas-parameter-item \{ position: relative; \}/, '锚点是每个参数项自身');
});

test('模型弹层：图标列宽 = 品牌标尺寸（20px），不留 44px 空档', () => {
  const rule = css.match(/\.ec-canvas-model-popover button \{([^}]*)\}/);
  assert.ok(rule, '规则存在');
  assert.match(rule[1], /grid-template-columns: 20px minmax\(0,1fr\)/);
  assert.match(rule[1], /gap: 8px/);
  assert.doesNotMatch(rule[1], /44px/, '不得再为旧的大缩略图预留 44px');
});

test('首页「下一步」二选一弹层：向上张开且相对按钮居中', () => {
  const rule = home.match(/\.ec-mode-chooser \{([^}]*)\}/);
  assert.ok(rule, '规则存在');
  assert.match(rule[1], /left: 50%/);
  assert.match(rule[1], /transform: translateX\(-50%\)/);
  assert.match(rule[1], /bottom: calc\(100% \+ 8px\)/);
});
