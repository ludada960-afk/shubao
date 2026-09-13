// test/visual-composer-unify-0912.test.mjs
// 2026-09-12 用户批注：自由创作的上传区与输入区必须做进「同一个框」（照小红书图文样式）。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/pages/Home/VisualCreationMode.css', import.meta.url), 'utf8');

test('上传区 + 输入区在同一个卡片里（单边框、内部分隔线）', () => {
  const composer = css.match(/\.visual-creation-composer \{([^}]*)\}/);
  assert.ok(composer, '容器样式存在');
  assert.ok(/background: #fff/.test(composer[1]), '统一白底卡片');
  assert.ok(/border-radius: 12px/.test(composer[1]), '统一圆角');
  assert.ok(/overflow: hidden/.test(composer[1]), '内容不溢出圆角');
  const zone = css.match(/\.visual-reference-zone \{([^}]*)\}/);
  assert.ok(/border-bottom: 1px dashed/.test(zone[1]), '内部用弱分隔线而不是两段式');
});

test('按钮灰态下积分依然显眼（主次分明）', () => {
  const cta = readFileSync(new URL('../src/styles/generate-cta.css', import.meta.url), 'utf8');
  const disabledPoints = cta.match(/\.shubao-gen-cta:disabled \.shubao-gen-cta-points \{([^}]*)\}/);
  assert.ok(disabledPoints, '禁用态积分的专属样式存在');
  assert.ok(/opacity: 1/.test(disabledPoints[1]), '禁用态不降低积分可见度');
  assert.ok(/color: #6d28d9/.test(disabledPoints[1]), '禁用态积分仍有强调色');
});
