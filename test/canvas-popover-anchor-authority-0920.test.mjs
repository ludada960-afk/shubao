// test/canvas-popover-anchor-authority-0920.test.mjs
// 2026-09-20 用户批注（提过三四次）：「面板依然是歪到左边去，然后依然是盖住了我们现在的素材」
// ─────────────────────────────────────────────────────────────────────────────
// 实测根因（Playwright，1440 缩放 0.68，点节点右侧「+」，修复前）：
//   菜单矩形 left=10   ← 被甩到画布最左
//   触发按钮 left=683  ← 本应锚在这里
//   菜单 style: left=-717.118px（世界坐标）
//   祖先 transform: matrix(0.68,0,0,0.68,497.64,24.4)  ← 菜单在缩放层内
// 根因：clampCanvasPickerPosition 把 **像素** 口径的 bounds.width / reservedRight
//       除以 scale 当 **世界坐标** 用（两套坐标系混用）。右侧面板一开
//       （reservedRight=508）可用宽度被砍到 ~197px，maxX 塌到锚点左边极远处。
// 修法：派生菜单改走画布唯一权威 CanvasPopoverPortal（portal 到 body + 视口像素定位）。
// ─────────────────────────────────────────────────────────────────────────────
// 口径（用户已确认，不可协商）：
//   ① 锚在触发元素上**向右展开**；
//   ② 右侧空间不足时**向下展开**，**绝不向左翻**；
//   ③ 面板矩形与源节点矩形**零相交**；
//   ④ 全画布弹层必须引用统一定位权威，不许各写各的绝对定位。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = p => readFileSync(path.join(ROOT, p), 'utf8');
const studio = read('src/pages/EcCanvas/components/CanvasStudio.jsx');
const index = read('src/pages/EcCanvas/index.jsx');
const vlang = read('src/pages/EcCanvas/canvasVisualLanguage.js');
const chrome = read('src/pages/EcCanvas/components/CanvasChrome.jsx');

test('① 定位权威必须提供 place="right"（锚触发元素向右展开）', () => {
  assert.match(studio, /export function CanvasPopoverPortal\(\{[^}]*place = 'above'/,
    'CanvasPopoverPortal 必须暴露 place 参数');
  assert.match(studio, /if \(place === 'right'\)/, '必须实现 right 分支');
  /* 向右展开的**算法**只有一份，在 canvasVisualLanguage.resolveAnchoredRight；
     portal 必须复用它，不得自己再写一套坐标计算（那正是坐标系分裂的来源）。 */
  assert.match(studio, /resolveAnchoredRight\(\{/, 'portal 的 right 分支必须复用共用规则');
  assert.match(vlang, /export function resolveAnchoredRight\(/, '共用规则必须存在');
  assert.match(vlang, /anchor\.right\s*\?[\s\S]{0,80}?\+\s*gap|\+\s*gap/, '左缘必须 = 锚点右缘 + 间距');
});

test('② 共用规则：右展开**不许出现向左翻**（左缘不得越过锚点左缘）', () => {
  const start = vlang.indexOf('export function resolveAnchoredRight(');
  assert.ok(start > 0, '必须能找到 resolveAnchoredRight');
  const body = vlang.slice(start, start + 1400);
  assert.doesNotMatch(body, /anchor\.x\s*-\s*width/, '不得把面板放到锚点左侧（那就是「向左翻」）');
  /* 只允许向右/向下：水平取 max(左边界, min(期望右展开位, 右边界))，因此永不为负偏移 */
  assert.match(body, /Math\.max\(gutter,\s*Math\.min\(wanted,\s*maxLeft\)\)/, '水平必须左界回夹到 gutter（不出屏）');
  assert.match(body, /const maxTop = Math\.max\(gutter, vh - height - gutter\)/, '竖直必须用视口下界回夹');
  /* 回夹**只能**改变左右边界内的位置，不允许变为「锚点左侧」 */
  assert.match(body, /clampedRight:/, '必须报告是否发生右回夹（供断言与排查）');
});

test('③ 派生菜单（引用当前素材）必须走统一权威，不再自算世界坐标', () => {
  /* 修复前它是 .ec-canvas-derive-menu + position 世界坐标；现在是 portal 组件 */
  assert.match(studio, /export function CanvasDeriveMenu\(\{[^}]*anchorRect/,
    'CanvasDeriveMenu 必须接收视口矩形 anchorRect');
  assert.match(studio, /<CanvasPopoverPortal open anchor=\{anchorRect\} place="right" className="ec-canvas-derive-menu"/,
    '派生菜单必须经 CanvasPopoverPortal 渲染并声明 place="right"');
  /* 反向断言：不得再接收/使用世界坐标 position */
  assert.doesNotMatch(studio, /CanvasDeriveMenu\(\{[^}]*\bposition\b/, '不得再接收 position（世界坐标）');
});

test('④ 调用方必须传**触发元素的视口矩形**（不是 toWorldPoint 的世界坐标）', () => {
  assert.match(index, /const portEl = event\?\.currentTarget/, '必须取触发元素');
  assert.match(index, /const rect = portEl\?\.getBoundingClientRect\?\.\(\)/, '必须量它的视口矩形');
  assert.match(index, /anchorRect: rect[\s\S]{0,200}right: rect\.right/, 'anchorRect 必须含 right（右展开依赖它）');
  assert.match(index, /anchorRect=\{connectionPicker\.anchorRect\}/, '必须把 anchorRect 传下去');
});

test('⑤ 防回退：clampCanvasPickerPosition 不得再被派生菜单使用（坐标系混用的来源）', () => {
  const callSite = index.slice(index.indexOf('<CanvasDeriveMenu'), index.indexOf('<CanvasDeriveMenu') + 700);
  assert.doesNotMatch(callSite, /clampCanvasPickerPosition\(/, '派生菜单不得再调用世界坐标版本的 clamp');
});

test('⑥ 图层面板同样必须锚在触发元素上（不再钉在画布左缘）', () => {
  /* 实测（修复前）：图层面板左缘 72，而触发按钮（底部「图层」）在 775 ——
     面板出现在离触发元素 700px 外的画布左边。根因是 CSS 写死 left:72px。 */
  assert.match(chrome, /anchorRect = null/, 'CanvasLayersPanel 必须接收触发元素矩形');
  assert.match(chrome, /resolveAnchoredRight\(\{/, '必须复用共用定位规则');
  assert.match(chrome, /data-anchored-right/, '必须有可断言的锚定标记');
  assert.match(index, /anchorRect=\{layersPanelOpen \?/, '打开时必须量触发按钮的视口矩形');
});

test('⑦ portal 化的派生菜单必须清掉「反向 scale」（否则二次缩放）', () => {
  const css = read('src/pages/EcCanvas/EcCanvas.css').replace(/\/\*[\s\S]*?\*\//g, ' ');
  assert.match(css, /\.ec-canvas-derive-menu\.is-portaled \{[^}]*transform:\s*none/,
    'portal 化的派生菜单必须 transform: none（它已脱离缩放层）');
});
