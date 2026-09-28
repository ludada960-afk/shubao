// test/canvas-surface-dismiss-0929.test.mjs
// 2026-09-29 批 CY-⑭。用户在画布上指出的第 2 组问题（浮层互不关闭 / 点空白不关 / 层级错乱）：
//
//   ① 「我点击打开水印面板的话，我再去点击其他的功能区，比如我点击我们现在画布左边的这个加号，
//        这个加号会弹出来那些选项，可是你这个水印面板并不会自己关掉。……那他们两者就打架了的一个情况。
//        这种情况他应该不是一个孤立的情况，可能还有很多其他的情况也是类似的问题。
//        所以我只是举了一个例子，你自己要全面的思考这些逻辑，要怎么去判断，怎么去解决。」
//   ② 「他们拉出来这块选项面板是没错的，但是当我点击其他空地的时候，这块面板却没有自动关掉。」
//   ③ 「生成过程的按钮……层级给搞错了……只要有任意的弹窗功能，你这个按钮会一起跟着弹出来，
//        就是其他的窗弹出来的话，它会跟着变成弹窗的那一层。会一起高亮起来。」
//
// 事故根因（逐条查出来的，不是推测）：
//   · 画布上每个浮层都是**各自独立的 useState**，一共 16 个，**没有任何登记册**；
//   · 「点空白 = 收起全部功能栏」那段代码挂在 `getCanvasPointerIntent` 走不到的 `else`(pan) 分支
//     —— 默认 select 工具 + 左键 + 空白返回的是 'marquee'，所以派生菜单点空白永远不关；
//   · 水印面板**根本没有 outside-click，也根本不接 Escape**；
//   · `CanvasPopoverPortal` 与图层面板把 z-index 写死 **10004**（inline style，压过 `CANVAS_Z` 权威块），
//     水印面板写死 **62**（不在阶梯里的裸值，且越权压过 composer）。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  CANVAS_TRANSIENT_SURFACES,
  canvasTransientSurfaceKeys,
  canvasSurfacesToDismiss,
  canvasSurfacesSuppressedBy,
} from '../src/pages/EcCanvas/canvasSurfaceDismiss.js';
import { CANVAS_Z } from '../src/pages/EcCanvas/canvasVisualLanguage.js';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const canvasPage = read('src/pages/EcCanvas/index.jsx');
const studio = read('src/pages/EcCanvas/components/CanvasStudio.jsx');
const chrome = read('src/pages/EcCanvas/components/CanvasChrome.jsx');
const canvasCss = read('src/pages/EcCanvas/EcCanvas.css');
const watermarkCss = read('src/styles/canvas-watermark-panel.css');
const stateModel = read('src/pages/EcCanvas/canvasState.js');
const stripComments = src => src.replace(/\/\*[\s\S]*?\*\//g, '');

/* ═══ ① 登记册本身 ════════════════════════════════════════════════════════════ */

test('每一个浮层 state 都登记在册（漏登记 = 那个面板永远不会自己关）', () => {
  const page = stripComments(canvasPage);
  /* 画布上所有"开一个浮层"的 useState。模态（资产库/模板广场/工作流）有自己的遮罩，不在此册。
     判据反过来写：**在册的每一个 key 都必须真的有对应的 state**（防登记册腐化），
     同时**每一个 transient 浮层 state 都必须在册**（防漏登记）。 */
  for (const key of canvasTransientSurfaceKeys()) {
    assert.match(page, new RegExp(`const \\[${key},\\s*set[A-Za-z]+\\]\\s*=\\s*useState`),
      `登记册里的 ${key} 在 index.jsx 里没有对应的 state（登记册腐化了）`);
  }
  assert.ok(canvasTransientSurfaceKeys().length >= 12, '登记册必须覆盖画布上主要浮层');
});

test('点空白与 Esc 都要能收起跟随型浮层（含水印面板与派生菜单）', () => {
  for (const trigger of ['blank', 'escape']) {
    const keys = canvasSurfacesToDismiss(trigger);
    assert.ok(keys.includes('watermarkPanelOpen'), `${trigger} 必须收起水印面板（用户 ① 的正主）`);
    assert.ok(keys.includes('connectionPicker'), `${trigger} 必须收起派生菜单（用户 ② 的正主）`);
    assert.ok(keys.includes('addMenuOpen'), `${trigger} 必须收起加号菜单`);
    assert.ok(keys.includes('activeComposerSurface'), `${trigger} 必须收起生成框弹层`);
  }
  /* 连线拖拽中不许被"点空白"打断 —— 那是一次正在进行的操作 */
  assert.ok(!canvasSurfacesToDismiss('blank').includes('connectionDraft'),
    '连线拖拽中不能被点空白打断（那是进行中的操作，不是面板）');
  assert.ok(canvasSurfacesToDismiss('escape').includes('connectionDraft'), 'Esc 仍然要能取消连线');
});

test('「开一个先关其它」：自己除外', () => {
  const suppressed = canvasSurfacesSuppressedBy('watermarkPanelOpen');
  assert.ok(!suppressed.includes('watermarkPanelOpen'), '不能把自己关掉');
  assert.ok(suppressed.includes('addMenuOpen'), '开水印面板要先把加号菜单关掉（用户 ① 的"打架"）');
  assert.ok(suppressed.includes('connectionPicker'));
});

/* ═══ ② 真的接上了 ══════════════════════════════════════════════════════════════ */

test('点空白**两条路都走**「收起全部浮层」（原来只挂在 pan 分支 = 默认工具走不到）', () => {
  const page = stripComments(canvasPage);
  const marker = "if (intent === 'marquee')";
  const at = page.indexOf(marker);
  assert.ok(at > 0, '找得到 marquee 分支');
  const before = page.slice(Math.max(0, at - 700), at);
  assert.match(before, /dismissAllCanvasSurfaces\('blank'\)/,
    '收起动作必须在 if/else **之前** —— 挂在某一支里，默认的框选工具永远走不到那支');
  /* 这条是用户 ② 的正主：派生菜单点空白不关 */
  assert.match(page, /getCanvasPointerIntent/, '确认点空白走的是 getCanvasPointerIntent');
  assert.match(stateModel, /return 'marquee';/,
    '默认 select 工具 + 左键 + 空白 = marquee（这正是原来那段代码失效的原因）');
});

test('Esc 收起全部浮层（不再只清 activeComposerSurface）', () => {
  const page = stripComments(canvasPage);
  /* 判据写 handler 的**函数体**：源码里 dismissAllCanvasSurfaces('escape') 出现在
     addEventListener 那一行**之前**（它在 handler 体内），按"listener 之后找调用"会误判。 */
  const handler = page.slice(page.indexOf('const closeOnEscape = event =>'));
  assert.match(handler, /event\.key === 'Escape'[\s\S]{0,300}?dismissAllCanvasSurfaces\('escape'\)/,
    'Esc 必须走统一仲裁，而不是只清某一个 state');
  assert.match(page, /const hasAnyTransientSurface = /, '要有一个"当前有没有浮层开着"的判定，否则 effect 永远不挂');
  assert.match(page, /if \(!hasAnyTransientSurface\) return undefined/, '没有浮层时不许挂 keydown');
});

test('「开一个关一个」接在三个真实入口上', () => {
  const page = stripComments(canvasPage);
  assert.match(page, /onAddMenuToggle=\{\(\) => \{[\s\S]{0,400}?dismissAllCanvasSurfacesExcept\('addMenuOpen'\)/,
    '加号菜单');
  assert.match(page, /const handleToggleWatermarkPanel[\s\S]{0,900}?dismissAllCanvasSurfacesExcept\('watermarkPanelOpen'\)/,
    '水印面板');
  assert.match(page, /const handleComposerSurfaceChange = useCallback\(next => \{[\s\S]{0,200}?dismissAllCanvasSurfacesExcept\('activeComposerSurface'\)/,
    '生成框弹层');
  assert.match(page, /const openConnectionPickerForNode[\s\S]{0,2000}?dismissAllCanvasSurfaces\('blank'\)/,
    '派生菜单');
  /* ⚠️ 不许在 setState 的 updater 里面调别的 setter —— updater 会被 React 渲染期重算 */
  assert.ok(!/setAddMenuOpen\(open => \{[^}]*dismissAllCanvasSurfaces/.test(page),
    '不得在 setState updater 里做副作用（会被 React 重算执行多次）');
  assert.ok(!/setWatermarkPanelOpen\(open => \{[^}]*dismissAllCanvasSurfaces/.test(page),
    '不得在 setState updater 里做副作用');
});

/* ═══ ③ z-index 必须回到权威阶梯 ══════════════════════════════════════════════ */

test('画布里不再有越权的裸 z-index 数值（10004 / 10005 / 62 一律不许）', () => {
  for (const [name, src] of [['CanvasStudio.jsx', studio], ['CanvasChrome.jsx', chrome], ['index.jsx', canvasPage]]) {
    const code = stripComments(src);
    for (const bad of [/zIndex:\s*10004/, /zIndex:\s*10005/]) {
      assert.ok(!bad.test(code), `${name} 里还有越权 z-index（${bad}）—— 它是 inline style，压过 EcCanvas.css 末尾的 CANVAS_Z 权威块`);
    }
  }
  assert.ok(!/z-index:\s*62/.test(watermarkCss), '水印面板不许再写死 62（不在 CANVAS_Z 阶梯里，且越权压过 composer）');
  assert.match(watermarkCss, /z-index:\s*var\(--cvl-z-popover, 40\)/, '水印面板必须走 --cvl-z-popover');
});

test('portal 弹层与图层面板都取 CANVAS_Z.popover（不是各自拍一个数）', () => {
  assert.match(studio, /function CanvasPopoverPortal[\s\S]*?zIndex:\s*CANVAS_Z\.popover/,
    'CanvasPopoverPortal 必须用 CANVAS_Z.popover');
  assert.match(chrome, /panelStyle[\s\S]*?zIndex:\s*CANVAS_Z\.popover/,
    '图层面板必须用 CANVAS_Z.popover');
  assert.match(studio, /import \{ resolveAnchoredRight, CANVAS_Z \}/, '必须真的 import 了权威表');
  /* 层级阶梯本身没被改松 */
  assert.ok(CANVAS_Z.popover < CANVAS_Z.modal, 'popover 必须在 modal 之下（用户 ③：按钮不该跟着弹窗一起抬层）');
  assert.ok(CANVAS_Z.popover > CANVAS_Z.hud, 'popover 仍要高于 HUD');
});

/* ═══ ④ 弹层必须吸附（用户：「不管用户怎么拖动素材，张开的面板都必须如影随形」）═════════════ */

test('弹层锚点持续跟随锚点元素（拖动画布/拖节点都不许留在原地）', () => {
  const code = stripComments(studio);
  const hook = code.slice(code.indexOf('export function useCanvasPopoverAnchor'));
  assert.match(hook, /requestAnimationFrame/, '锚点必须逐帧跟随');
  assert.match(hook, /cancelAnimationFrame/, '关闭时要停掉轮询（不许留常驻开销）');
  assert.match(hook, /if \(!openKey\) return undefined/, '弹层没开时不许轮询');
  assert.match(hook, /window\.removeEventListener\('resize', place\)/, '原来的 resize 监听必须保留');
});
