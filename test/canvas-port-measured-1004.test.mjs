// test/canvas-port-measured-1004.test.mjs
// 门禁：连线端点必须与**加号按钮的真实位置**对齐，而不是与模型矩形对齐。
//
// 2026-10-04 用户连续三轮报「连线还是没连上素材本身 / 没连到加号身上」。
// 离线实测（Playwright 量真实渲染盒）得到的结论很重要，分两部分：
//
//   ① 模型公式本身**是对的**：输出端口实测中心 x=436，`node.x + node.w + 17`
//      预期 437（差 1px 是边框）。`CANVAS_PORT_CENTER_OFFSET = 17` 与 CSS
//      `right:-32px; width:30px` 精确吻合。
//
//   ② 真正错位的是：**加号贴在渲染出来的元素上，而那个元素不一定等于模型矩形**。
//      生成框 / composer 面板的视觉宽度大于 `node.w`（要放参考图槽、输入框、底栏），
//      带 footer 的卡片视觉高度 = node.h + 46 —— 于是用模型 rect 算的端点
//      会落在卡片里面或旁边几十像素处，线就"没连上"。
//
// 业界口径（查证）：React Flow `nodeInternals.handleBounds` 取**实测** handle 盒子，
// 量不到才退回 `positionAbsolute + width/height`；tldraw / Excalidraw 同理。
// 三家都不以模型 rect 为准 —— 这条门禁就是把那三家的口径钉死。
import test from 'node:test';
import assert from 'node:assert/strict';

import { getNodePortCenter, CANVAS_PORT_CENTER_OFFSET, CANVAS_CARD_FOOTER_H } from '../src/pages/EcCanvas/canvasGeometry.js';
import {
  measuredPortCenter,
  registerCanvasNodeRect,
  clearCanvasNodeRect,
  screenRectToWorld,
} from '../src/pages/EcCanvas/canvasNodeRects.js';

test.afterEach(() => clearCanvasNodeRect());

test('① 模型公式与端口 CSS 精确吻合（这条原来是对的，别改坏）', () => {
  /* CSS：.ec-canvas-node-port { right:-32px; width:30px } ⇒ 中心在 right + 17 */
  assert.equal(CANVAS_PORT_CENTER_OFFSET, 17);
  const node = { x: 100, y: 200, w: 200, h: 240 };
  assert.deepEqual(getNodePortCenter(node, 'output'), { x: 317, y: 200 + (240 + CANVAS_CARD_FOOTER_H) / 2 });
  assert.deepEqual(getNodePortCenter(node, 'input'), { x: 83, y: 200 + (240 + CANVAS_CARD_FOOTER_H) / 2 });
});

test('② 实测端口优先：渲染宽度 ≠ 模型宽度时，端点必须跟着渲染走', () => {
  /* 一个 composer 面板：模型 w=200，但**渲染**宽 340（右边缘在 480 而不是 380） */
  const originRect = { left: 0, top: 0 };
  const viewport = { x: 0, y: 0, scale: 1 };
  registerCanvasNodeRect('composer-1', {
    output: { left: 451, top: 380, width: 30, height: 30 },   // 真实输出加号
    input: { left: -61, top: 380, width: 30, height: 30 },   // 真实输入加号
  });

  const out = measuredPortCenter('composer-1', 'output', originRect, viewport);
  assert.deepEqual(out, { x: 466, y: 395 }, '实测中心必须直接可用');

  /* 有实测时，端点 == 实测（渲染盒），而不是模型盒 */
  const node = { id: 'composer-1', x: 100, y: 200, w: 200, h: 240 };
  assert.deepEqual(getNodePortCenter(node, 'output', out), out);
  assert.deepEqual(getNodePortCenter(node, 'input', measuredPortCenter('composer-1', 'input', originRect, viewport)),
    { x: -46, y: 395 });

  /* 不给实测时退回模型口径（行为与旧版完全一致，断线风险为零） */
  assert.deepEqual(getNodePortCenter(node, 'output'), { x: 317, y: 200 + (240 + CANVAS_CARD_FOOTER_H) / 2 });
  assert.deepEqual(getNodePortCenter(node, 'output', null), { x: 317, y: 200 + (240 + CANVAS_CARD_FOOTER_H) / 2 });
});

test('③ 屏幕 → 世界换算要把 stage 原点与视口平移都扣掉', () => {
  const rect = { left: 451, top: 380, width: 30, height: 30 };
  assert.deepEqual(
    screenRectToWorld(rect, { left: 100, top: 200 }, { x: 50, y: -30, scale: 1 }),
    { x: 451 + 15 - 100 - 50, y: 380 + 15 - 200 + 30 },
  );
  /* 缩放 2 倍时，屏幕差要除以 scale */
  assert.deepEqual(
    screenRectToWorld(rect, { left: 0, top: 0 }, { x: 0, y: 0, scale: 2 }),
    { x: (451 + 15) / 2, y: (380 + 15) / 2 },
  );
});

test('④ 量不到（节点未渲染 / 被裁剪）必须返回 null，让调用方退回模型口径', () => {
  const originRect = { left: 0, top: 0 };
  const viewport = { x: 0, y: 0, scale: 1 };
  assert.equal(measuredPortCenter('never-registered', 'output', originRect, viewport), null);
  registerCanvasNodeRect('half', { output: null, input: { left: 10, top: 10, width: 30, height: 30 } });
  assert.equal(measuredPortCenter('half', 'output', originRect, viewport), null, '没有输出端口就返回 null');
  assert.ok(measuredPortCenter('half', 'input', originRect, viewport), '输入端口量到了就要有值');
  registerCanvasNodeRect('zero', { output: { left: 0, top: 0, width: 0, height: 0 } });
  assert.equal(measuredPortCenter('zero', 'output', originRect, viewport), null,
    '零尺寸不算量到（节点还没布局完）');
});
