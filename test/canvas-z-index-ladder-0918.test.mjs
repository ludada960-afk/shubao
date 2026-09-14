// test/canvas-z-index-ladder-0918.test.mjs
// 2026-09-18 用户批注（层级污染 · 第 N 次同类复发）
//
// 用户原话（打开「工作流模板」弹窗，左下角小地图卡片亮着浮在它上面）：
//   「为什么我打开工作流模板，你左下角的这个地图会跟着一起进来呢？你这又是什么奇怪的
//    逻辑呀？」
//
// 根因：画布浮动层**各写各的 z-index**，没有统一的层叠权威 ——
// 实测 EcCanvas.css 原有 47 处 z-index，取值 1/2/3/4/5/7/8/9/10/11/15/30/35/40/42/
// 58/70/72/80/82/90/95/100/130/140/1900/2000/9500/10000/10002/10003 全是就地拍脑袋，
// 所以每加一个弹窗就漏一个 HUD。
//
// 两条契约：
//   A) 层叠阶梯是唯一权威（canvasVisualLanguage.js 的 CANVAS_Z），CSS 只写 var(--cvl-z-*)；
//   B) 打开画布内任何弹窗时，HUD **一律隐藏**（display:none，不是压暗），
//      由**单一状态** canvasHudHidden() 驱动（不是每个弹窗各打一次补丁）。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { CANVAS_Z, canvasZCssVars, canvasHudHidden } from '../src/pages/EcCanvas/canvasVisualLanguage.js';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const css = read('src/pages/EcCanvas/EcCanvas.css');
const canvas = read('src/pages/EcCanvas/index.jsx');

/* 阶梯区块（本文件末尾新增的那一段） */
function ladderBlock() {
  const start = css.indexOf('画布层叠阶梯 · 落地');
  assert.ok(start > 0, 'CSS 里必须有层叠阶梯落地区块');
  return css.slice(start);
}
/* 去掉注释，避免把说明文字里的示例当成真实规则 */
const strippedLadder = () => ladderBlock().replace(/\/\*[\s\S]*?\*\//g, '');

/* ── A：层叠阶梯 ─────────────────────────────────────────────────── */

test('层叠阶梯存在且严格递增（canvas < overlay < panel < hud < popover < toolbar < composer < modalScrim < modal < globalToast）', () => {
  const order = ['canvas', 'overlay', 'panel', 'hud', 'popover', 'toolbar', 'composer', 'modalScrim', 'modal', 'globalToast'];
  assert.deepEqual(Object.keys(CANVAS_Z), order, '阶梯顺序必须与约定一致');
  for (let i = 1; i < order.length; i += 1) {
    assert.ok(CANVAS_Z[order[i]] > CANVAS_Z[order[i - 1]],
      `${order[i]} 必须高于 ${order[i - 1]}`);
  }
});

test('阶梯注入 CSS 变量（CSS 侧不得再写裸数字）', () => {
  const vars = canvasZCssVars();
  for (const key of Object.keys(CANVAS_Z)) {
    assert.equal(vars['--cvl-z-' + key], String(CANVAS_Z[key]), key + ' 必须注入 --cvl-z-' + key);
  }
});

test('画布根节点注入层叠变量', () => {
  assert.match(canvas, /canvasVisualLanguageCssVars\(panelWidth\)/, '根节点必须注入视觉语言变量（含 --cvl-z-*）');
});

test('每个浮动层都绑定到阶梯（HUD / 面板 / 弹出层 / 工具条 / 生成框 / 弹窗 / toast）', () => {
  const block = strippedLadder();
  const required = [
    ['hud', ['.ec-canvas-minimap', '.ec-canvas-zoom-controls', '.ec-canvas-bottom-dock', '.ec-canvas-left-rail']],
    ['panel', ['.ec-canvas-right-panel']],
    ['popover', ['.ec-canvas-parameter-popover', '.ec-canvas-option-popover', '.ec-canvas-suite-panel-popover', '.ec-canvas-add-menu', '.ec-canvas-context-menu', '.ec-canvas-layers-panel']],
    ['toolbar', ['.ec-canvas-object-toolbar', '.ec-canvas-text-toolbar', '.ec-canvas-multi-toolbar']],
    ['composer', ['.ec-canvas-node-composer', '.ec-canvas-focused-editor']],
    ['globalToast', ['.ec-canvas-toast', '.ec-canvas-pending-imports']],
  ];
  for (const [tier, selectors] of required) {
    for (const sel of selectors) {
      /* 该选择器必须出现在「z-index: var(--cvl-z-<tier>」的规则里 */
      const re = new RegExp(sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[^{}]*\\{[^}]*var\\(--cvl-z-' + tier);
      assert.match(block, re, sel + ' 必须绑定到 --cvl-z-' + tier);
    }
  }
});

test('资产库遮罩纳入阶梯（原为硬编码 9500）', () => {
  const block = strippedLadder();
  assert.match(block, /\.canvas-asset-library-overlay \{[^}]*var\(--cvl-z-modalScrim/, '资产库遮罩必须走阶梯');
  assert.match(block, /\.canvas-asset-library-modal \{[^}]*var\(--cvl-z-modal/, '资产库弹窗必须走阶梯');
});

/* ── B：单一状态驱动 HUD 隐藏 ─────────────────────────────────────── */

test('canvasHudHidden 是唯一判据：任一类弹窗打开都返回 true', () => {
  assert.equal(canvasHudHidden({}), false, '没有弹窗时不该隐藏 HUD');
  const flags = ['workflowGalleryOpen', 'canvasLibraryOpen', 'assetPickerOpen', 'skillLibraryOpen', 'imageInfoOpen', 'imagePreviewOpen', 'assetLibraryTab'];
  for (const f of flags) {
    assert.equal(canvasHudHidden({ [f]: true }), true, f + ' 打开时必须隐藏 HUD');
  }
});

test('画布把这七类弹窗状态都接进 canvasHudHidden（新增弹窗只需加这里）', () => {
  const start = canvas.indexOf('const dialogOpen = canvasHudHidden({');
  assert.ok(start > 0, '必须由 canvasHudHidden 单一判定');
  const seg = canvas.slice(start, canvas.indexOf('});', start));
  for (const f of ['workflowGalleryOpen', 'canvasLibraryOpen', 'assetPickerOpen', 'skillLibraryTarget', 'imageInfoNode', 'zoomImg', 'assets']) {
    assert.ok(seg.includes(f), '单一判定必须包含 ' + f);
  }
});

test('单一状态写到根节点 class（.is-dialog-open），供 CSS 一处开关', () => {
  assert.match(canvas, /ec-canvas-page\${dialogOpen \? ' is-dialog-open' : ''\}/, '根节点必须挂 is-dialog-open');
});

test('打开弹窗时 HUD **隐藏**（display:none），不是只压暗', () => {
  const block = strippedLadder();
  const start = block.indexOf('.ec-canvas-page.is-dialog-open');
  assert.ok(start > 0, '必须有 is-dialog-open 的 HUD 规则');
  const seg = block.slice(start, block.indexOf('\n}', start) + 2);
  for (const sel of ['.ec-canvas-minimap', '.ec-canvas-zoom-controls', '.ec-canvas-bottom-dock',
    '.ec-canvas-left-rail', '.ec-canvas-right-panel', '.ec-canvas-node-composer']) {
    assert.ok(seg.includes(sel), '弹窗打开时 ' + sel + ' 也必须隐藏');
  }
  assert.match(seg, /display:\s*none\s*!important/, '必须是 display:none（压暗不够 —— 用户要求不可见且不可点）');
  assert.doesNotMatch(seg, /opacity|visibility/, '不得用压暗/隐藏可见性的方式糊弄');
});

test('HUD 隐藏由 class 驱动，而不是每个弹窗各打一次补丁', () => {
  const block = strippedLadder();
  /* 关键不是"出现几次选择器"，而是**成组规则的条数**：
     期望恰好 1 条 { … display:none !important } 的组规则，
     组内用逗号列出所有 HUD。若有人给某个弹窗单独再写一条覆盖，条数就会 >1。 */
  const ruleStarts = [...block.matchAll(/\.ec-canvas-page\.is-dialog-open[^{}]*\{/g)];
  assert.equal(ruleStarts.length, 1, '必须恰好一条成组规则（实际 ' + ruleStarts.length + ' 条）');
  const body = block.slice(ruleStarts[0].index, block.indexOf('}', ruleStarts[0].index));
  /* 组内必须一次列全所有 HUD —— 逐个断言（而不是靠人肉记忆） */
  for (const sel of ['.ec-canvas-minimap', '.ec-canvas-zoom-controls', '.ec-canvas-bottom-dock',
    '.ec-canvas-left-rail', '.ec-canvas-right-panel', '.ec-canvas-node-composer',
    '.ec-canvas-object-toolbar', '.ec-canvas-text-toolbar', '.ec-canvas-multi-toolbar', '.ec-canvas-layers-panel']) {
    assert.ok(body.includes(sel), '成组规则里必须列出 ' + sel);
  }
});

test('全局 toast 不受弹窗影响（永远最上层）', () => {
  assert.ok(CANVAS_Z.globalToast > CANVAS_Z.modal, 'toast 必须高于弹窗');
  const block = strippedLadder();
  /* 只检查那条成组规则的**规则体**，别把后面的 toast 规则也算进来 */
  const start = block.indexOf('.ec-canvas-page.is-dialog-open');
  const body = block.slice(start, block.indexOf('}', start));
  assert.doesNotMatch(body, /\.ec-canvas-toast/, 'toast 不得被 is-dialog-open 隐藏');
});
