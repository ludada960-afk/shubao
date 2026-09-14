// test/canvas-visual-language-parity-0917.test.mjs
// 2026-09-17 用户要求：「首页面板刚刚定稿的统一视觉语言规范，请在画布侧对齐
//   —— 同一维度必须同一套视觉语言」。
// 规范真源 = src/pages/Home/ec/panelVisualLanguage.js。
// 本测试把「画布侧必须与首页同口径」钉成契约，防止两条线以后各自漂移。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  SPACING, FONT_SIZE, CONTROL_HEIGHT, PANEL_WIDTH, RADIUS, TEXTAREA_RESIZE, resolvePanelWidth,
} from '../src/pages/Home/ec/panelVisualLanguage.js';
import * as canvasVL from '../src/pages/EcCanvas/canvasVisualLanguage.js';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

const canvasCss = read('src/pages/EcCanvas/EcCanvas.css');
const rightPanelCss = read('src/styles/canvas-right-panel.css');
const deriveMenuCss = read('src/styles/canvas-derive-menu.css');
const canvasPage = read('src/pages/EcCanvas/index.jsx');
const canvasStudio = read('src/pages/EcCanvas/components/CanvasStudio.jsx');

/* 三个 CSS 文件里所有 font-size 取值 */
function fontSizes(css) {
  return [...css.matchAll(/font-size:\s*([0-9.]+)px/g)].map(m => Number(m[1]));
}

test('画布视觉语言模块直接转出首页规范（不重新定义数值）', () => {
  assert.equal(canvasVL.SPACING, SPACING, 'SPACING 必须是首页同一个对象');
  assert.equal(canvasVL.FONT_SIZE, FONT_SIZE, 'FONT_SIZE 必须是首页同一个对象');
  assert.equal(canvasVL.CONTROL_HEIGHT, CONTROL_HEIGHT, 'CONTROL_HEIGHT 必须是首页同一个对象');
  assert.equal(canvasVL.PANEL_WIDTH, PANEL_WIDTH, 'PANEL_WIDTH 必须是首页同一个对象');
  assert.equal(canvasVL.RADIUS, RADIUS, 'RADIUS 必须是首页同一个对象');
  assert.equal(canvasVL.MIN_HIT_AREA, CONTROL_HEIGHT.compact, '点击区下限 = 紧凑控件 32px');
});

test('面板宽度：画布与首页同一口径（480 / 窄屏 min(480,视口-32)）', () => {
  /* 逐视口对照：画布的 canvasPanelWidth 必须与首页 resolvePanelWidth 完全一致 */
  for (const vw of [1920, 1440, 1280, 1100, 768, 480, 390, 360, 320]) {
    assert.equal(canvasVL.canvasPanelWidth(vw), resolvePanelWidth(vw), vw + 'px 视口下面板宽度必须与首页一致');
  }
  assert.equal(canvasVL.canvasPanelWidth(1920), PANEL_WIDTH.standard, '宽屏 = 标准档 480');
  assert.ok(canvasVL.canvasPanelWidth(390) <= 390 - 32 + 1, '窄屏不横向溢出');
});

test('右侧面板让位宽度由规范推导（面板宽 + 28）', () => {
  assert.equal(canvasVL.canvasRightPanelReserved(1920), PANEL_WIDTH.standard + canvasVL.CANVAS_RIGHT_PANEL_MARGIN_PX);
  const vars = canvasVL.canvasVisualLanguageCssVars(1920);
  assert.equal(vars['--cvl-panel-width'], PANEL_WIDTH.standard + 'px');
  assert.equal(vars['--canvas-right-panel-width'], PANEL_WIDTH.standard + 'px',
    '画布让位用的既有变量必须跟着规范走，不能再写死 360');
});

test('CSS 变量齐备：间距 6 档 / 字号 4 档 / 控件 3 档 / 圆角 3 档', () => {
  const vars = canvasVL.canvasVisualLanguageCssVars(1440);
  for (const key of ['sp1', 'sp2', 'sp3', 'sp4', 'sp5', 'sp6']) {
    assert.ok(vars['--cvl-' + key], '缺少间距变量 ' + key);
  }
  assert.equal(vars['--cvl-sp6'], SPACING.sp6 + 'px', '面板内边距 = 24');
  assert.equal(vars['--cvl-font-helper'], FONT_SIZE.helper + 'px', '辅助字号 = 11');
  assert.equal(vars['--cvl-control-compact'], CONTROL_HEIGHT.compact + 'px', '紧凑控件 = 32');
  assert.equal(vars['--cvl-control-base'], CONTROL_HEIGHT.base + 'px', '标准控件 = 36');
  assert.equal(vars['--cvl-control-large'], CONTROL_HEIGHT.large + 'px', '主控件 = 40');
  assert.equal(vars['--cvl-radius-panel'], RADIUS.panel + 'px', '面板圆角 = 20');
});

test('画布侧不再使用 9px / 10px 字号（首页已废掉的档位）', () => {
  for (const [name, css] of [['EcCanvas.css', canvasCss], ['canvas-right-panel.css', rightPanelCss], ['canvas-derive-menu.css', deriveMenuCss]]) {
    const tooSmall = fontSizes(css).filter(v => v < FONT_SIZE.helper);
    assert.deepEqual(tooSmall, [], name + ' 仍有小于 ' + FONT_SIZE.helper + 'px 的字号：' + tooSmall.join(','));
  }
});

test('画布面板宽度统一为规范档位，不再各写各的', () => {
  /* 右侧面板 / 派生菜单 / 套图面板都必须走 --cvl-panel-width */
  assert.ok(rightPanelCss.includes('var(--canvas-right-panel-width, ' + PANEL_WIDTH.standard + 'px)'),
    '右侧面板宽度必须走规范变量');
  assert.ok(deriveMenuCss.includes('var(--cvl-panel-width, ' + PANEL_WIDTH.standard + 'px)'),
    '派生浮层宽度必须走规范变量（不再 432 自成一套）');
  const suiteWidths = [...canvasCss.matchAll(/\.ec-canvas-suite-panel-popover[^}]*?width:\s*([^;]+);/gs)].map(m => m[1].trim());
  assert.ok(suiteWidths.length > 0, '必须能找到套图面板宽度规则');
  for (const w of suiteWidths) {
    assert.ok(w.includes('var(--cvl-panel-width, ' + PANEL_WIDTH.standard + 'px)'),
      '套图面板宽度必须统一走规范变量，实际：' + w);
  }
});

test('画布根节点注入视觉语言变量（CSS 侧才能取到）', () => {
  assert.ok(canvasPage.includes('canvasVisualLanguageCssVars(panelWidth)'), '画布根节点必须注入变量');
  assert.ok(canvasPage.includes('const panelWidth = useCanvasPanelWidth()'), '面板宽度必须随视口更新');
  assert.ok(canvasPage.includes('const rightPanelReservedPx = canvasRightPanelReserved(panelWidth)'),
    '浮层避让与画布让位必须共用同一个宽度值');
});

test('输入框拉伸几何复用首页纯函数（不用 CSS resize:vertical）', () => {
  /* 首页踩过的坑：flex 弹性项 / 父级 overflow:hidden 会让 CSS resize 的 inline height 被覆写。
     画布必须走同一套受控实现，并共用 resolveResizedHeight 的容器夹逼。 */
  assert.ok(canvasStudio.includes('resolveResizedHeight'), '画布拉伸必须复用首页 resolveResizedHeight');
  assert.ok(canvasStudio.includes('TEXTAREA_RESIZE'), '画布拉伸必须复用首页 TEXTAREA_RESIZE 规格');
  assert.ok(!/\.ec-canvas-prompt-resize[^}]*resize:\s*vertical/.test(canvasCss), '不得使用 CSS resize: vertical');
  const resizeCss = canvasCss.match(/\.ec-canvas-prompt-resize > \.mention-prompt-field \{[^}]*\}/s)?.[0] || '';
  assert.ok(resizeCss.includes('resize: none'), '输入框自身必须 resize:none（手柄接管）');
  assert.ok(resizeCss.includes('overflow: auto'), '到顶后必须内部滚动，而不是被裁断');
});

test('点击区下限 32px：画布交互控件不再低于规范', () => {
  /* 抽查几个高频交互控件必须落在 32px 档 */
  assert.ok(/\.ec-canvas-count-popover button \{[^}]*var\(--cvl-control-compact, 32px\)/.test(canvasCss),
    '数量选择按钮必须 ≥32px');
  assert.ok(/\.ec-canvas-selection-mode button \{[^}]*var\(--cvl-control-compact, 32px\)/.test(canvasCss),
    '选区模式按钮必须 ≥32px');
  assert.ok(/\.ec-canvas-layer-row > button:not\(\.ec-canvas-layer-main\) \{[^}]*var\(--cvl-control-compact, 32px\)/.test(canvasCss),
    '图层行按钮必须 ≥32px');
});
