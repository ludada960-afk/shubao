// test/home-mode-chooser-anchor-0912.test.mjs
// 2026-09-12 用户批注：「带设计方案 / 快速生成」两个选项歪在左边，应该居中吸附在「下一步」按钮正上方。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/pages/Home/Home.css', import.meta.url), 'utf8');
const jsx = readFileSync(new URL('../src/pages/Home/EcMode.jsx', import.meta.url), 'utf8');

test('选项面板水平居中于触发按钮、贴其上方', () => {
  const rule = css.match(/\.ec-mode-chooser \{([^}]*)\}/);
  assert.ok(rule, '找到规则');
  const body = rule[1];
  assert.match(body, /left: 50%/, '水平居中');
  assert.match(body, /transform: translateX\(-50%\)/, '居中修正');
  assert.match(body, /bottom: calc\(100% \+ 8px\)/, '紧贴按钮上沿');
  assert.doesNotMatch(body, /right: 0/, '不再贴右边');
  assert.match(body, /width: min\(296px, calc\(100vw - 32px\)\)/, '窄屏不溢出');
});

test('面板与按钮同属一个相对定位容器（锚点正确）', () => {
  assert.match(jsx, /className="ec-workbench-submit-actions" style=\{\{ position: 'relative' \}\}/);
  assert.match(jsx, /className="ec-mode-chooser" role="menu"/);
});
