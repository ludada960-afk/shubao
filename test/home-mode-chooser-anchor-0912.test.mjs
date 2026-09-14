// test/home-mode-chooser-anchor-0912.test.mjs
// 2026-09-12 用户批注：「带设计方案 / 快速生成」两个选项歪在左边，应该居中吸附在「下一步」按钮正上方。
// 2026-09-14 用户决策：这个二选一浮层整个删掉 —— 电商生图与「万物上身」统一默认带设计方案，
//   点「下一步」直接走「生成设计方案 → 进画布」，不再询问。
//   原「居中 + 吸附按钮上方」的对齐阈值已无宿主元素，改为断言浮层**彻底不存在**（不放松任何阈值）。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/pages/Home/Home.css', import.meta.url), 'utf8');
const jsx = readFileSync(new URL('../src/pages/Home/EcMode.jsx', import.meta.url), 'utf8');

test('二选一浮层已彻底删除：无 DOM、无样式、无状态、无死代码路径', () => {
  assert.doesNotMatch(jsx, /ec-mode-chooser/, 'JSX 不再渲染二选一浮层');
  assert.doesNotMatch(css, /\.ec-mode-chooser/, 'CSS 不再保留死样式');
  assert.doesNotMatch(jsx, /modeChooserOpen/, '不再有浮层开关状态');
  assert.doesNotMatch(jsx, /handleNext\(true\)/, '快速通道入口（quick=true）已无调用点');
  assert.doesNotMatch(jsx, /快速生成/, '首页不再出现「快速生成」选项文案');
});

test('「下一步」按钮仍与提交组同容器（锚点容器保留，按钮本身不再需要相对定位）', () => {
  assert.match(jsx, /className="ec-workbench-submit-actions" style=\{\{ position: 'relative' \}\}/);
  assert.match(jsx, /className="ec-workbench-next shubao-gen-cta"/);
});
