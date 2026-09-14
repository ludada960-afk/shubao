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

test('① 定位权威必须提供 place="right"（锚触发元素向右展开）', () => {
  assert.match(studio, /export function CanvasPopoverPortal\(\{[^}]*place = 'above'/,
    'CanvasPopoverPortal 必须暴露 place 参数');
  assert.match(studio, /if \(place === 'right'\)/, '必须实现 right 分支');
  /* 向右展开 = 左缘取锚点**右缘** + 间距；绝不能用「水平居中」当右展开 */
  assert.match(studio, /anchor\.right != null \? anchor\.right \+ gap/, '左缘必须 = 锚点右缘 + 间距');
});

test('② 权威：右展开分支**不许出现向左翻**的兜底（不得取锚点左缘）', () => {
  const start = studio.indexOf("if (place === 'right')");
  assert.ok(start > 0, '必须能找到 right 分支');
  const branch = studio.slice(start, start + 900);
  assert.doesNotMatch(branch, /anchor\.x\s*-\s*width/, '不得把面板放到锚点左侧（那就是「向左翻」）');
  /* 只允许「向下展开」：top 由 anchor.y 起，且被视口下界回夹 */
  assert.match(branch, /const belowTop = anchor\.y;/, '竖直基准必须是锚点 y（向下展开）');
  assert.match(branch, /window\.innerHeight - height - gutter/, '必须用视口下界回夹，避免超出屏幕');
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

test('⑥ portal 化的派生菜单必须清掉「反向 scale」（否则二次缩放）', () => {
  const css = read('src/pages/EcCanvas/EcCanvas.css').replace(/\/\*[\s\S]*?\*\//g, ' ');
  assert.match(css, /\.ec-canvas-derive-menu\.is-portaled \{[^}]*transform:\s*none/,
    'portal 化的派生菜单必须 transform: none（它已脱离缩放层）');
});
