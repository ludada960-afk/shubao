// test/visual-composer-unify-0912.test.mjs
// 2026-09-12 用户批注：自由创作的上传区与输入区必须做进「同一个框」（照小红书图文样式）。
// 9-13 更新预期：上传区 + 输入区做进小红书那套 ec-xhs-composer 暖色渐变单卡片里（不再是白底+分隔线）。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/pages/Home/VisualCreationMode.css', import.meta.url), 'utf8');

test('上传区 + 输入区在同一个渐变卡片里（照小红书 ec-xhs-composer）', () => {
  const wrapper = css.match(/.visual-creation-composer {([^}]*)}/);
  assert.ok(wrapper, '容器样式存在');
  assert.ok(/flex-direction: column/.test(wrapper[1]), '容器纵向排布');
  const surface = css.match(/.visual-composer-surface.ec-xhs-composer {([^}]*)}/);
  assert.ok(surface, '小红书同款渐变面存在');
  assert.ok(/linear-gradient\(90deg, #faefdf 0%/.test(surface[1]), '与小红书一致的暖黄渐变');
  assert.ok(/border-radius: 16px/.test(surface[1]), '同款 16px 圆角');
  assert.ok(/min-height: 310px/.test(surface[1]), '创作面最小高度与小红书一致');
  assert.ok(!/.visual-reference-zone {[sS]*?border-bottom: 1px dashed/.test(css), '不再用内部分隔线拼两段');
});

test('按钮灰态下积分依然显眼（主次分明）', () => {
  /* 2026-09-15 V3：电商生图 CTA 的积分容器迁到 .ec-workbench-cta-points
     （并走 --sb-* token）。「禁用态积分仍显眼」这条契约不变，两处都要守住。 */
  const cta = readFileSync(new URL('../src/styles/generate-cta.css', import.meta.url), 'utf8');
  const disabledPoints = cta.match(/.shubao-gen-cta:disabled .shubao-gen-cta-points {([^}]*)}/);
  assert.ok(disabledPoints, '禁用态积分的专属样式存在');
  assert.ok(/opacity: 1/.test(disabledPoints[1]), '禁用态不降低积分可见度');
  assert.ok(/color: (#6d28d9|var\(--sb-(text-brand|brand-\d+)\))/.test(disabledPoints[1]), '禁用态积分仍有强调色');

  const home = readFileSync(new URL('../src/pages/Home/Home.css', import.meta.url), 'utf8');
  const ecDisabled = home.match(/\.ec-workbench-cta:disabled \.ec-workbench-cta-points \{([^}]*)\}/);
  assert.ok(ecDisabled, '电商禁用态积分的专属样式存在');
  assert.ok(/var\(--sb-text-brand\)/.test(ecDisabled[1]), '电商禁用态积分仍用品牌强调色 token');
  assert.ok(/var\(--sb-brand-wash\)/.test(ecDisabled[1]), '电商禁用态积分有品牌浅底，保持醒目');
});
