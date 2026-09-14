// test/generate-cta-unify-0912.test.mjs
// 2026-09-12 用户批注：各板块生成按钮的样式与「动态积分」显示必须统一；面板里已选的配置不要在按钮旁再写一遍。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('三处主 CTA 共用同一套样式类与积分写法', () => {
  const ec = read('src/pages/Home/EcMode.jsx');
  const visual = read('src/pages/Home/VisualCreationMode.jsx');
  const video = read('src/pages/VideoStudio/index.jsx');
  /* 2026-09-15 V3：电商生图 CTA 从共享的 .shubao-gen-cta（紫→粉→橙渐变，
     属 V3 明令停用的功能按钮渐变）迁到 token 化的 .ec-workbench-cta。
     横向统一的目标不变 —— 三处 CTA 仍共用同一套「能带积分的实心主按钮」语言，
     只是取值来源从 generate-cta.css 统一到 design-tokens-v3.css。
     断言改为：电商 CTA 挂类 + 三处都把积分放进统一容器 + 样式走 --sb-* token。 */
  assert.ok(ec.includes('ec-workbench-next ec-workbench-cta'), '电商生图 CTA 挂统一主按钮类');
  assert.ok(read('src/pages/Home/Home.css').includes('.ec-workbench-cta {'), '电商 CTA 样式存在');
  assert.ok(visual.includes('visual-generate-button shubao-gen-cta'), '自由创作 CTA 挂统一类');
  assert.ok(video.includes('video-generate-trigger shubao-gen-cta'), '生视频 CTA 挂统一类');
  for (const [name, source] of [['自由创作', visual], ['生视频', video]]) {
    assert.ok(source.includes('shubao-gen-cta-points'), name + ' 积分用统一容器');
  }
  /* 电商侧改为 V3 token 化的积分容器（同样是「按钮内嵌积分」的统一写法） */
  assert.ok(ec.includes('ec-workbench-cta-points'), '电商生图积分用统一容器');
  assert.ok(read('src/pages/Home/Home.css').includes('.ec-workbench-cta-points'), '电商积分样式存在');
  const css = read('src/styles/generate-cta.css');
  assert.ok(css.includes('.shubao-gen-cta {'), '统一样式存在');
  assert.ok(css.includes('.shubao-gen-cta .shubao-gen-cta-points'), '积分样式存在');
  assert.ok(read('src/main.jsx').includes("./styles/generate-cta.css"), '样式已引入入口');
});

test('不再重复展示面板里已经选过的配置摘要', () => {
  const video = read('src/pages/VideoStudio/index.jsx');
  assert.ok(!video.includes('video-submit-meta'), '生视频按钮旁的配置摘要已移除');
  const ec = read('src/pages/Home/EcMode.jsx');
  assert.ok(!ec.includes('ec-workbench-estimate'), '电商生图旁的独立积分条已移除');
  const visual = read('src/pages/Home/VisualCreationMode.jsx');
  assert.ok(!visual.includes('visual-cost'), '自由创作的独立积分条已移除');
});

test('自由创作：面板贴着触发按钮开（不再退化成全屏覆盖层）且提示词框更高', () => {
  const visual = read('src/pages/Home/VisualCreationMode.jsx');
  assert.ok(!visual.includes('needsOverlay'), '不再有覆盖层分支');
  const position = visual.match(/function getVisualPanelPosition\(panelId, button\) \{[\s\S]*?\n\}/)[0];
  assert.ok(/bottom: openAbove \? Math\.max\(12, viewportHeight - rect\.top \+ gap\)/.test(position), '向上开时贴在按钮上方');
  const css = read('src/pages/Home/VisualCreationMode.css');
  /* 9-13 更新预期：提示词框照小红书那套（104px 高 / 15px·28px 行高 / 无边框 textarea） */
  assert.ok(css.includes('min-height: 104px'), '提示词框照小红书 104px');
  assert.ok(css.includes('height: 104px'), '提示词框高度照小红书');
});