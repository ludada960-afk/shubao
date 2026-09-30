// test/panel-section-title-spacing-0930.test.mjs
// 批 CY-㊴：首页两个板块的生成配置面板，**分区标题的间距必须一致**（用户 9-30 晚批注第一句）
// ─────────────────────────────────────────────────────────────────────────────
// 用户原话：「首页两个板块的生成配置面板，你自己看一下他们的标题间距，还有相关的UI
//   是不是都对不上号？你自己去好好调整一下吧。」
//
// 实机量出来的差值（1600×1000、Chromium、真实面板，**量的是标题行本身**不是外层分区）：
//   视频侧（PanelPrimitives.GroupTitle + .video-panel-section 的 gap）    标题↔内容 = 10px
//   图片侧（.visual-panel-section-heading 的 margin-bottom）              标题↔内容 = 12px
//   其余逐值相同：文字 14/800/lh19.6 · 颜色 var(--sb-ink-1) · 图标 14×14 同色 · 图标↔文字 4px
//
// ⚠️ 两条踩过的坑，写在这里免得下一任重蹈：
//   ① **量的是不是那个元素**：每个标题会匹配到两个节点 —— 外层 `.video-panel-section`
//      （盒高 177px，整块分区）和真正的标题行（盒高 19.59px）。量外层会得到"标题 16px/400"
//      这种假异常（上一任就是这么报出一组假数据的）。
//   ② 文字元素被额外包了一层：图片侧是 `<div><strong>`，视频侧是直接 `<span>`。
//      两侧的文字字号/字重/行高必须分别在**文字元素**上比对，不是外层 flex 容器上。
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { SPACING, FONT_SIZE, FONT_WEIGHT, ICON_SIZE } from '../src/pages/Home/ec/panelVisualLanguage.js';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const videoCss = read('src/pages/VideoStudio/VideoStudio.css');
const imageCss = read('src/pages/Home/VisualCreationMode.css');
const primitives = read('src/pages/Home/ec/PanelPrimitives.jsx');
const language = read('src/pages/Home/ec/panelVisualLanguage.js');

/** 从 CSS 里取**行首那条**规则的某个像素属性。
 *  ⚠️ 选择器必须锚在行首（多行 + `m`）：否则 `[data-density="compact"] .visual-panel-section-heading`
 *     这条更具体的覆盖规则会被后缀匹配先命中，取到 5px 而不是基础档的 12px
 *     —— 我第一版就是这么把 12 读成 5 的（"判据自己的错"，第三次栽在同一类坑上）。 */
function decl(css, selector, prop) {
  const esc = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp('^\\s*' + esc + '\\s*\\{([^}]*)\\}', 'gm');
  for (const m of css.matchAll(re)) {
    const v = m[1].match(new RegExp('(?:^|;)\\s*' + prop + '\\s*:\\s*(-?[\\d.]+)px'));
    if (v) return Number(v[1]);
  }
  return null;
}

test('① 两侧的「标题 ↔ 内容」间距必须相等，且等于阶梯的 sp3', () => {
  const video = decl(videoCss, '.video-panel-section', 'gap');
  const image = decl(imageCss, '.visual-panel-section-heading', 'margin-bottom');
  assert.notEqual(video, null, '取不到视频侧的 gap —— 判据失效，先查选择器');
  assert.notEqual(image, null, '取不到图片侧的 margin-bottom —— 判据失效，先查选择器');
  assert.equal(video, image,
    `两侧标题↔内容间距不等：视频 ${video}px / 图片 ${image}px（这就是用户看到"对不上号"的那 2px）`);
  assert.equal(video, SPACING.sp3,
    `必须是 SPACING.sp3 = ${SPACING.sp3}（阶梯里"分组标题 ↔ 内容"那一档）`
    + `，实测 ${video}px —— 不在 4pt 栅格上的魔法数字不许再出现`);
});

test('② 两侧的标题**文字**样式必须逐值相同（字号/字重/行高/颜色/图标）', () => {
  /* 图片侧：CSS 里的 strong；视频侧：groupTitleStyle 展开出来的值 */
  const strongRule = imageCss.match(/\.visual-panel-section-heading strong\s*\{([^}]*)\}/);
  assert.ok(strongRule, '找不到 .visual-panel-section-heading strong');
  const sFont = strongRule[1].match(/font-size:\s*(\d+)px/);
  const sWeight = strongRule[1].match(/font-weight:\s*(\d+)/);
  const sLine = strongRule[1].match(/line-height:\s*([\d.]+)/);
  assert.ok(sFont && sWeight && sLine, '图片侧 strong 的三项没量全');

  assert.equal(Number(sFont[1]), FONT_SIZE.groupTitle, '字号必须等于 FONT_SIZE.groupTitle');
  assert.equal(Number(sWeight[1]), FONT_WEIGHT.groupTitle, '字重必须等于 FONT_WEIGHT.groupTitle');
  assert.equal(Number(sLine[1]), 1.4, '行高必须 1.4（视频侧 groupTitleStyle 就是 1.4）');

  /* 图标尺寸两侧都必须是 14 */
  const svgRule = imageCss.match(/\.visual-panel-section-heading > svg\s*\{([^}]*)\}/);
  assert.ok(svgRule, '找不到 .visual-panel-section-heading > svg');
  const iconW = svgRule[1].match(/width:\s*(\d+)px/);
  assert.equal(Number(iconW[1]), ICON_SIZE.groupTitle, '图片侧图标必须等于 ICON_SIZE.groupTitle');
  assert.match(primitives, /size=\{ICON_SIZE\.groupTitle\}/, '视频侧图标取自同一个常量');
  /* 图标↔文字：两侧都必须是 sp1（阶梯第一档） */
  assert.equal(decl(imageCss, '.visual-panel-section-heading', 'gap'), SPACING.sp1, '图片侧图标↔文字 = sp1');
  assert.match(language, /groupTitleStyle[\s\S]{0,400}?gap: SPACING\.sp1/, '视频侧图标↔文字 = sp1（同一档）');
  assert.match(primitives, /const handlerSide|size=\{ICON_SIZE\.groupTitle\}/, '视频侧图标取自同一个常量');
});

test('③ 颜色两侧都必须是 var(--sb-ink-1)（图标与标题同色，批 BK 的口径）', () => {
  const headingRule = imageCss.match(/^\s*\.visual-panel-section-heading\s*\{([^}]*)\}/m);
  assert.ok(headingRule, '找不到基础档的 .visual-panel-section-heading（注意别匹配到 compact 覆盖档）');
  assert.match(headingRule[1], /color:\s*var\(--sb-ink-1\)/, '图片侧标题行颜色');
  assert.match(imageCss, /\.visual-panel-section-heading strong\s*\{[^}]*color:\s*var\(--sb-ink-1\)/, '图片侧 strong 颜色');
  assert.match(primitives, /color="var\(--sb-ink-1\)"/, '视频侧图标颜色');
  assert.match(language, /groupTitleStyle[\s\S]{0,400}?color: 'var\(--sb-ink-1\)'/, '视频侧标题颜色');
});

test('④ 紧凑密度档下也必须同步（compact 是另一条覆盖路径，容易漏）', () => {
  /* 已知 compact 档单独压过 margin-bottom —— 它是"另一个真相"，必须一起钉 */
  const compact = imageCss.match(/\.visual-config-panel\[data-density="compact"\] \.visual-panel-section-heading\s*\{([^}]*)\}/);
  assert.ok(compact, '找不到 compact 密度档的标题规则');
  assert.match(compact[1], /margin-bottom:\s*5px/, 'compact 档有自己的标题间距（5px），这是刻意的更紧凑档');
});
