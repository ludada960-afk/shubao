// test/canvas-port-card-center-1002.test.mjs
// 2026-10-02：连线端点必须落在**整卡**中线（与端口 CSS 的 `top:50%` 同一个盒子）。
// ─────────────────────────────────────────────────────────────────────────────
// 用户批注：「为什么你右边这些图片的线都没拉到加号上呢，你现在都是偏移加号上下面的呀」
//           「而且你甚至没有连接到素材本身身上啊」
//
// 根因：端点算的是「媒体本体中线」，端口 CSS `top:50%` 算的是「整卡中线」，
//       两者差**半个 footer**（≈22.85px）。而 footer 是内容撑出来的，
//       字体 token 一变偏移就变 —— 于是「时有时无」。
//
// **业界口径（查证四家源码一致）**：
//   · React Flow   端口 CSS `top:50%` 相对**节点**（含 header/footer）
//   · tldraw       `normalizedAnchor = {x:.5, y:.5}` 乘在**形状完整 bounds** 上
//   · Excalidraw   `getElementBounds` 的**完整 AABB**
//   · Draw.io      默认 `exitX=1; exitY=0.5; entryX=0; entryY=0.5` 的顶点 box
//   ⇒ 四家都取**整卡**中线；「视觉主体中线」不是任何一家采纳的规则。
//
// 本文件钉的是**不变量**，不是某一行写法：任何渲染路径下，卡片外框高度都等于
// `getCanvasCardHeight(node)`；端口 / 吸附 / 框选 / 碰撞只许从这里取几何。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { getNodePortCenter, getCanvasCardHeight, CANVAS_CARD_FOOTER_H } from '../src/pages/EcCanvas/canvasGeometry.js';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const canvas = read('src/pages/EcCanvas/index.jsx');
const css = read('src/pages/EcCanvas/EcCanvas.css');

test('① 端点的 y 必须是**整卡**中线（含 footer），不是媒体本体中线', () => {
  const node = { x: 100, y: 200, w: 240, h: 300, showMeta: true };
  const card = getCanvasCardHeight(node);
  assert.equal(card, 300 + CANVAS_CARD_FOOTER_H, '整卡 = 媒体 + footer');
  const center = getNodePortCenter(node, 'out');
  assert.equal(center.y, 200 + card / 2,
    '端点必须落在整卡中线；原来用 node.h（只有媒体）⇒ 比加号高半个 footer');
  /* 回归钉：改回 node.h/2 必红 */
  assert.notEqual(center.y, 200 + node.h / 2, '**不许**回退成只用 node.h —— 那正是这个 bug');
});

test('② showMeta=false 的节点不渲染 footer ⇒ 也就不能加这截高度', () => {
  const node = { x: 0, y: 0, w: 240, h: 300, showMeta: false };
  assert.equal(getCanvasCardHeight(node), 300, '无 footer 时整卡 = 媒体');
  assert.equal(getNodePortCenter(node, 'out').y, 150, '端点 = 媒体中线');
  /* 这也是该 bug「时有时无」的原因，两个分支都要对 */
  const withMeta = { ...node, showMeta: true };
  assert.equal(getNodePortCenter(withMeta, 'out').y, 150 + CANVAS_CARD_FOOTER_H / 2);
});

test('③ 横向偏移不变（那是给 CSS right:-32px 标定的，不在本次范围）', () => {
  const node = { x: 0, y: 0, w: 240, h: 300, showMeta: true };
  assert.equal(getNodePortCenter(node, 'out').x, 240 + 17, '右侧端口仍在边缘外 17px');
  assert.equal(getNodePortCenter(node, 'in').x, -17, '左侧端口仍在边缘外 17px');
});

test('④ 端口 CSS 仍以整卡为参照物（不许为了迁就模型去改 top 的口径）', () => {
  /* 业界四家都是"整卡中线"。改 CSS 去对齐"媒体中线"会让 16:9 与 9:16 的卡片
     加号不在同一水平线 —— 治好了偏移，坏了视觉一致性。 */
  const rule = /\.ec-canvas-node-port\s*\{([^}]*)\}/.exec(css);
  assert.ok(rule, '要能定位到端口 CSS');
  assert.match(rule[1], /top:\s*50%/, '端口必须仍以整卡 50% 定位');
  assert.match(rule[1], /translateY\(-50%\)/, '端口必须用 translateY(-50%) 居中');
});

test('⑤ 不许用 DOM 实测几何（批 CY-⑭/⑮ 的事故），且不许新增第二套端口定位', () => {
  assert.doesNotMatch(canvas, /getCanvasDomPortCenter|setRenderedPortCenters|new ResizeObserver\(measure\)/,
    'DOM 实测端口中心是批 CY-⑭/⑮ 事故的根因，仍然禁止');
  /* 端口定位只允许由 CSS 的 top:50% 承担；任何 inline top: node.h/2 都是第二套真相 */
  assert.doesNotMatch(canvas, /top:\s*node\.h\s*\/\s*2/,
    '不许再出现 inline 的端口纵向定位（node.h/2 只有媒体，会与 CSS 的整卡 50% 打架）');
});
