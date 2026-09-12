// test/canvas-css-regression-0912.test.mjs
// 2026-09-12 用户批注（"小地图又变黑了 / 你是不是返工了"）：
// 根因是任务日志样式重写时整段替换了 canvas-supervisor.css 的尾部，误删了小地图/便签/无效边/吸附等样式。
// 这个测试锁住「这些样式必须一直存在」，防止同类误删再次发生。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/styles/canvas-supervisor.css', import.meta.url), 'utf8');

test('画布监督层样式不得被误删（小地图/便签/无效边/吸附）', () => {
  for (const selector of ['.ec-canvas-minimap', '.ec-canvas-minimap-viewport', '.ec-canvas-sticker', '.ec-canvas-edge-invalid', '.ec-canvas-snap-indicator']) {
    assert.ok(css.includes(selector), '缺少样式 ' + selector);
  }
  assert.ok(css.includes('@keyframes edgeInvalidPulse'), '无效边动画缺失');
  assert.ok(css.includes('.ec-canvas-minimap-close') && css.includes('.ec-canvas-minimap-reopen'), '小地图关闭/重开按钮样式缺失');
});

test('小地图必须与底部按钮区留出间隙（吸附）', () => {
  assert.ok(/var\(--ec-canvas-bottombar-top/.test(css), '缺少底栏间距变量引用');
});
