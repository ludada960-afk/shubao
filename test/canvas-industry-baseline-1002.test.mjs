// test/canvas-industry-baseline-1002.test.mjs
// 门禁：画布交互**对齐业界口径**这一批（2026-10-02）。
//
// 起因是用户那句：「既然有可以参考的成熟方案，就去把我们画布上面隐性存在的问题
// 补充进来」。做法是先查证 React Flow / tldraw / Excalidraw / draw.io 四家源码，
// 把口径钉在门禁里，避免以后又被改回"自己拍脑袋"。
//
// 这里守的是**判据本身**（阈值怎么算、吸附先看谁、连线端点取整卡中线），
// 不是某一段具体写法 —— 实现换了，只要口径还在就放过。
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  canvasSnapThreshold,
  CANVAS_SNAP_SCREEN,
  snapCanvasDrag,
  canvasAlignmentSnap,
  calcCanvasAutoPan,
  CANVAS_AUTOPAN_EDGE,
} from '../src/pages/EcCanvas/canvasSnapModel.js';
import {
  canvasWheelIntent,
  normalizeCanvasWheelDelta,
  canvasZoomAtPoint,
  canvasZoomAtCenter,
  canvasZoomToScale,
  canvasKeyboardZoomIntent,
  canvasDragExceeded,
  CANVAS_DRAG_THRESHOLD,
  clampCanvasZoom,
} from '../src/pages/EcCanvas/canvasViewportModel.js';
import { canvasNodeFootprint } from '../src/pages/EcCanvas/canvasMediaFitModel.js';
import { CANVAS_CARD_FOOTER_H } from '../src/pages/EcCanvas/canvasGeometry.js';
import { wouldCreateCanvasCycle, canConnectCanvasNodes, CANVAS_SHORTCUTS } from '../src/pages/EcCanvas/canvasQuantvExtensions.js';
import { applyMultiSelectionAction, selectedCanvasBounds, MULTI_SELECTION_ACTIONS } from '../src/pages/EcCanvas/canvasInteractionModel.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const INDEX = read('src/pages/EcCanvas/index.jsx');
/* 断言"源码里不该再有某个写法"时必须先剥掉注释 ——
   否则本文件里"原来写死 +60"那句**说明性注释**自己就把门禁炸了（踩过）。 */
const stripComments = source => source
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|[^:])\/\/.*$/gm, '$1');

/* ───────────────────────── ① 整卡高度只有一个口径 ───────────────────────── */
test('① 整卡高度只有一个定义：框选/裁剪/组框/连线端点必须同源', () => {
  const withFooter = canvasNodeFootprint({ x: 0, y: 0, w: 200, h: 100, showMeta: true });
  const withoutFooter = canvasNodeFootprint({ x: 0, y: 0, w: 200, h: 100, showMeta: false });
  assert.equal(withFooter.h, 100 + CANVAS_CARD_FOOTER_H);
  assert.equal(withoutFooter.h, 100, 'showMeta=false 不渲染 footer，就不能给它留高度');

  /* 曾经 canvasMediaFitModel 里另有一份 34，canvasGeometry 里是 46 ——
     框选按 34、连线端点按 46 ⇒ 「框明明盖住了整张卡片却没选中」。
     现在不许再出现第二份 footer 高度常量。 */
  const mediaFit = stripComments(read('src/pages/EcCanvas/canvasMediaFitModel.js'));
  assert.doesNotMatch(mediaFit, /CANVAS_MEDIA_FOOTER_HEIGHT\s*=/,
    'canvasMediaFitModel 不许再自带一份 footer 高度，必须走 getCanvasCardHeight');

  /* fitViewport 原先自己写死 `n.h + 60`（第三份口径） */
  const state = stripComments(read('src/pages/EcCanvas/canvasState.js'));
  assert.doesNotMatch(state, /\.h\s*\+\s*60/, 'fitViewport 不许再写死 +60，必须走 footprint');

  /* 组框/多选框也不许用裸 node.h */
  const interaction = read('src/pages/EcCanvas/canvasInteractionModel.js');
  const boundsFns = interaction.slice(interaction.indexOf('export function canvasGroupBounds'));
  assert.ok(boundsFns.includes('canvasNodeFootprint'), '组框/多选框必须按整卡算');
});

/* ───────────────────────── ② 吸附阈值 = 屏幕像素 / 缩放 ───────────────────────── */
test('② 吸附阈值必须除以缩放，任何缩放下手感一致（Excalidraw / tldraw 口径）', () => {
  assert.equal(CANVAS_SNAP_SCREEN, 8, 'Excalidraw 的 SNAP_DISTANCE 就是 8');
  assert.equal(canvasSnapThreshold(1), 8);
  assert.equal(canvasSnapThreshold(2), 4, '放大一倍 ⇒ 世界阈值减半');
  assert.equal(canvasSnapThreshold(0.5), 16, '缩小一半 ⇒ 世界阈值加倍');
  /* 核心性质：同一个**屏幕**距离，在任何缩放下都恰好越过阈值 */
  const worldAt = scale => CANVAS_SNAP_SCREEN / scale;
  assert.equal(worldAt(1) / 1, 8, 'scale=1 时 8 世界像素 = 8 屏幕像素');
  assert.equal(worldAt(2) * 2, 8, 'scale=2 时 4 世界像素 = 8 屏幕像素');
  assert.equal(worldAt(0.5) * 0.5, 8, 'scale=0.5 时 16 世界像素 = 8 屏幕像素');
});

test('③ 对齐候选点必须包含**中心**，不只比左边线（tldraw BoundsSnaps / Excalidraw 口径）', () => {
  const selection = { x: 100.06, y: 50, w: 40, h: 20 };
  const others = [{ x: 0, y: 0, w: 100, h: 100 }];
  const snap = canvasAlignmentSnap(selection, others, 1);
  assert.ok(Math.abs(snap.dx - (100 - 100.06)) < 1e-9, '贴近左边线就吸到左边线');
  assert.ok(snap.guides.some(g => g.axis === 'x' && Math.abs(g.value - 100) < 1e-9));

  /* 关键性质：只有**中心**能接住时也要吸 ——
     右边缘 49 距对方的中心 50 只差 1，但它距对方右边 100 差了 51。 */
  const byCenter = canvasAlignmentSnap({ x: 29, y: 0, w: 20, h: 20 }, [{ x: 0, y: 0, w: 100, h: 100 }], 1);
  assert.ok(Math.abs(byCenter.dx - 1) < 1e-9, '必须能吸到对方的**中心**（50），而不是只有边');
  assert.ok(byCenter.guides.some(g => g.axis === 'x' && Math.abs(g.value - 50) < 1e-9));

  /* 超出阈值绝不吸（否则会一路粘着走） */
  const far = canvasAlignmentSnap({ x: 300, y: 300, w: 10, h: 10 }, [{ x: 0, y: 0, w: 10, h: 10 }], 1);
  assert.equal(far.dx, 0);
  assert.equal(far.guides.length, 0);

  /* 阈值随缩放变化：放大后同样大小的**世界**偏差就吸不上了
     （阈值是屏幕像素除以缩放 ⇒ scale=4 时阈值 2 世界像素） */
  const zoomedIn = canvasAlignmentSnap({ x: 102.5, y: 0, w: 10, h: 10 }, [{ x: 0, y: 0, w: 100, h: 100 }], 4);
  assert.equal(zoomedIn.dx, 0, '放大 4 倍后 2.5 的偏差超过阈值 2，不该再吸');
  const zoomedOut = canvasAlignmentSnap({ x: 102.5, y: 0, w: 10, h: 10 }, [{ x: 0, y: 0, w: 100, h: 100 }], 1);
  assert.ok(Math.abs(zoomedOut.dx + 2.5) < 1e-9, '1:1 时阈值 8，同样的偏差要吸');
});

test('④ 参考线与网格**互斥**：同时生效会把一组节点吸歪（RF calculateSnapOffset 解决的正是这个）', () => {
  const nodes = [
    { id: 'a', x: 0, y: 0, w: 10, h: 10 },
    { id: 'b', x: 500, y: 500, w: 10, h: 10 },
  ];
  /* b 正好落在网格上（500）→ 网格本该生效 */
  const gridOnly = snapCanvasDrag({
    nodes, movingIds: new Set(['b']), bounds: { x: 503, y: 503, w: 10, h: 10 }, dx: 0, dy: 0, scale: 1, grid: 10,
  });
  assert.equal(gridOnly.dx, -3, '没命中参考线时应吸附到网格');
  assert.equal(gridOnly.guides.length, 0, '网格吸附不画参考线');

  /* 命中参考线时不再叠网格位移 */
  const withGuide = snapCanvasDrag({
    nodes, movingIds: new Set(['a']), bounds: { x: 500.04, y: 0, w: 10, h: 10 }, dx: 0, dy: 0, scale: 1, grid: 10,
  });
  assert.ok(withGuide.guides.length > 0, '应命中参考线');
  assert.ok(Math.abs(withGuide.dx - (500 - 500.04)) < 1e-9, '命中参考线时只吃参考线位移，不叠网格');
});

/* ───────────────────────── ⑤ 边缘自动平移 ───────────────────────── */
test('⑤ 拖到视口边缘要自动平移（RF calcAutoPan：40px 边缘带、逐级加速）', () => {
  const bounds = { width: 1000, height: 800 };
  assert.equal(CANVAS_AUTOPAN_EDGE, 40);
  assert.deepEqual(calcCanvasAutoPan({ x: 500, y: 400 }, bounds), { dx: 0, dy: 0 }, '中间不推');
  const left = calcCanvasAutoPan({ x: 0, y: 400 }, bounds);
  assert.ok(left.dx < 0, '贴左边缘要往左推');
  const deeper = calcCanvasAutoPan({ x: 0, y: 400 }, bounds);
  const shallow = calcCanvasAutoPan({ x: CANVAS_AUTOPAN_EDGE - 1, y: 400 }, bounds);
  assert.ok(Math.abs(deeper.dx) > Math.abs(shallow.dx), '越靠边推得越快');
  const right = calcCanvasAutoPan({ x: 1000, y: 800 }, bounds);
  assert.ok(right.dx > 0 && right.dy > 0);
});

/* ───────────────────────── ⑥ 滚轮口径 ───────────────────────── */
test('⑥ deltaMode 必须归一化，否则鼠标滚轮与触控板差 20~400 倍', () => {
  /* React Flow wheelDelta 的同一口径。注意**符号**：它是 `-deltaY * …`，
   所以 deltaY>0（往下滚）得到负数 ⇒ 步数为负 ⇒ 缩小。 */
  assert.ok(Math.abs(normalizeCanvasWheelDelta({ deltaY: 100, deltaMode: 1 }) + 5) < 1e-9, '行 ×0.05');
  assert.ok(Math.abs(normalizeCanvasWheelDelta({ deltaY: 1, deltaMode: 0 }) + 0.002) < 1e-9, '像素 ×0.002');
  assert.ok(Math.abs(normalizeCanvasWheelDelta({ deltaY: 1, deltaMode: 2 }) + 1) < 1e-9, '页 ×1');

  const wheel = canvasWheelIntent({ deltaY: 100, deltaMode: 1 });
  assert.equal(wheel.kind, 'zoom');
  assert.ok(wheel.factor < 1, '往下滚 = 缩小');
  const wheelUp = canvasWheelIntent({ deltaY: -100, deltaMode: 1 });
  assert.ok(wheelUp.factor > 1, '往上滚 = 放大');
});

test('⑦ 触控板捏合（ctrlKey）走缩放；Shift+滚轮走水平平移（面板里宣传过，之前没实现）', () => {
  const pinch = canvasWheelIntent({ deltaY: -3, deltaMode: 0, ctrlKey: true });
  assert.equal(pinch.kind, 'zoom');
  assert.ok(pinch.factor > 1, '捏合张开要放大');

  const shiftWheel = canvasWheelIntent({ deltaY: 100, deltaMode: 0, shiftKey: true });
  assert.equal(shiftWheel.kind, 'pan-x');
  assert.ok(shiftWheel.dx !== 0, 'Shift+滚轮必须产生水平位移');
  assert.equal(shiftWheel.factor, 1, '水平平移不是缩放');

  assert.ok(INDEX.includes('canvasWheelIntent'), 'handleWheel 必须走 canvasWheelIntent');
});

/* ───────────────────────── ⑧ 缩放锚点 ───────────────────────── */
test('⑧ 按钮/键盘缩放必须以视口中心为锚：只改 scale 会让画面朝原点漂', () => {
  const viewport = { x: 300, y: 200, scale: 1 };
  const bounds = { width: 1000, height: 800 };
  const zoomed = canvasZoomAtCenter(viewport, bounds, 1.2);
  assert.notEqual(zoomed.x, viewport.x, 'x 必须变，否则就是朝原点漂');
  assert.notEqual(zoomed.y, viewport.y);
  /* 视口中心的那个世界点，缩放后仍在同一个屏幕位置 */
  const before = { wx: (500 - viewport.x) / viewport.scale, wy: (400 - viewport.y) / viewport.scale };
  const after = { x: before.wx * zoomed.scale + zoomed.x, y: before.wy * zoomed.scale + zoomed.y };
  assert.ok(Math.abs(after.x - 500) < 1e-9 && Math.abs(after.y - 400) < 1e-9, '中心点必须钉住');

  /* 滚轮则以鼠标位置为锚 */
  const atCursor = canvasZoomAtPoint(viewport, { x: 120, y: 90 }, 1.5);
  const wx = (120 - viewport.x) / viewport.scale;
  assert.ok(Math.abs(wx * atCursor.scale + atCursor.x - 120) < 1e-9, '鼠标下的点必须钉住');

  const reset = canvasZoomToScale(viewport, bounds, 1);
  assert.equal(reset.scale, 1);
  assert.ok(Number.isFinite(reset.x) && Number.isFinite(reset.y));

  assert.ok(INDEX.includes('canvasZoomAtCenter') || INDEX.includes('canvasZoomToScale'),
    'zoomTo 必须改用居中缩放');
});

test('⑨ 键盘缩放三件套：Ctrl +/-/0，且缩放有上下限', () => {
  assert.deepEqual(canvasKeyboardZoomIntent({ key: '+', ctrlKey: true }).kind, 'step');
  assert.ok(canvasKeyboardZoomIntent({ key: '+', ctrlKey: true }).factor > 1);
  assert.ok(canvasKeyboardZoomIntent({ key: '-', ctrlKey: true }).factor < 1);
  assert.deepEqual(canvasKeyboardZoomIntent({ key: '0', metaKey: true }), { kind: 'reset', scale: 1 });
  assert.equal(canvasKeyboardZoomIntent({ key: 'a', ctrlKey: true }), null, '不相关键不得误触');
  assert.equal(canvasKeyboardZoomIntent({ key: '+' }), null, '没有 Ctrl 时不得触发（否则 '+' 字打不出来）');

  assert.equal(clampCanvasZoom(99), 4);
  assert.equal(clampCanvasZoom(0.0001), 0.15);
});

/* ───────────────────────── ⑩ 拖动阈值 ───────────────────────── */
test('⑩ 拖动要有阈值，否则 1px 抖动就会挪动节点（点选就点不准了）', () => {
  assert.ok(CANVAS_DRAG_THRESHOLD >= 2, '阈值至少 2px');
  assert.equal(canvasDragExceeded({ x: 0, y: 0 }, { x: 1, y: 1 }), false, '抖动不算拖');
  assert.equal(canvasDragExceeded({ x: 0, y: 0 }, { x: 10, y: 0 }), true);
  assert.ok(INDEX.includes('CANVAS_DRAG_THRESHOLD'), '拖动路径必须用阈值判定');
});

/* ───────────────────────── ⑪ 连线：防成环 + 粗命中区 ───────────────────────── */
test('⑪ 连线不许成环：图执行顺着边跑，成环后三个节点会互相等、永远转圈', () => {
  const edges = [{ from: 'a', to: 'b' }, { from: 'b', to: 'c' }, { from: 'c', to: 'd' }];
  /* 加边 from→to 会成环 ⟺ **从 to 已经能走回 from**。现有 a→b→c→d，
     所以再连 d→a 就闭环；反过来连 a→d 只是多一条并联边，不是环。 */
  assert.equal(wouldCreateCanvasCycle(edges, 'd', 'a'), true, 'd→a 会成环');
  assert.equal(wouldCreateCanvasCycle(edges, 'a', 'd'), false, 'a→d 只是并联，不是环');
  assert.equal(wouldCreateCanvasCycle(edges, 'a', 'b'), false, '重复同一条边不是新环');
  assert.equal(wouldCreateCanvasCycle(edges, 'x', 'y'), false, '不相关的两端不判环');
  assert.equal(wouldCreateCanvasCycle([], 'a', 'b'), false);

  /* canConnectCanvasNodes 必须真的接住 connections 参数 */
  const nodes = [{ id: 'a', kind: 'image' }, { id: 'b', kind: 'image' }];
  assert.equal(
    canConnectCanvasNodes('b', nodes[0], nodes, [{ from: 'a', to: 'b' }]).ok,
    false,
    '已有 a→b，再连 b→a 必须被挡（否则图执行会互相等）',
  );
  assert.equal(
    canConnectCanvasNodes('b', nodes[0], nodes, []).ok,
    true,
    '不带成环边时，b→a 本身是合法的',
  );
  const closed = canConnectCanvasNodes('d', { id: 'a', kind: 'image' }, [
    { id: 'a', kind: 'image' }, { id: 'd', kind: 'image' },
  ], [{ from: 'a', to: 'd' }]);
  assert.equal(closed.ok, false, '已有 a→d，再连 d→a 必须被挡');
  assert.match(closed.reason, /闭环|绕回/, '要给出人话理由');
});

test('⑫ 细连线要配一条粗的透明命中区，否则根本点不中（RF interactionWidth=20）', () => {
  assert.match(INDEX, /ec-canvas-edge-hitarea/, '必须渲染隐形命中层');
  assert.match(INDEX, /strokeWidth=\{20\}/, '命中区宽度按业界取 20');
  assert.match(INDEX, /selectedEdgeId/, '连线要有选中态');
  assert.match(INDEX, /handleRemoveSelectedEdge/, 'Delete 要能删选中的线');
});

/* ───────────────────────── ⑬ 撤销/重做不再是死的 ───────────────────────── */
test('⑬ 撤销/重做必须真的被 push —— 以前 push 全仓 0 命中，Ctrl+Z 静默无反应', () => {
  const pushes = INDEX.match(/pushHistoryRef\.current\?\.\(\)/g) || [];
  assert.ok(pushes.length >= 8,
    '只有 ' + pushes.length + ' 处接了历史，太少：删除/粘贴/复制/打组/建边/拖动/缩放/对齐都该记一步');

  /* 撤销必须同时能还原 connections（以前只还原 nodes，线会留在原地） */
  assert.match(INDEX, /historyRef\.current\.undo\(\{ nodes, connections \}\)/);
  assert.match(INDEX, /setConnections\(restored\.connections\)/);
});

test('⑭ 历史记的是"手势"不是"帧"，且不把视口算进去', () => {
  /* push 必须发生在 pointerup 那一段，而不是 pointermove 里 */
  const pointerUp = INDEX.slice(INDEX.indexOf('const handlePointerUp'));
  const upBlock = pointerUp.slice(0, 1600);
  assert.match(upBlock, /pushHistoryRef/, '手势结束时才记历史');
  assert.doesNotMatch(upBlock, /canvasDragExceeded[\s\S]{0,400}?pointermove/);

  /* 视口不进依赖：平移不该触发整棵树快照 + 网络保存 */
  const draftAt = INDEX.indexOf('}, 350);');
  assert.ok(draftAt > 0, '本地草稿 effect 必须还在（350ms 防抖）');
  const draftWindow = INDEX.slice(draftAt - 700, draftAt + 200);
  assert.ok(draftWindow.includes('viewportRef.current'), '快照要从 ref 读视口，而不是从闭包拿');

  const remoteDeps = INDEX.slice(
    INDEX.indexOf('remoteSaveTimerRef.current = setTimeout(() => { persistCanvasRemotely(); }, 1200);'),
  ).slice(0, 400);
  const deps = remoteDeps.match(/\}, \[([^\]]*)\]\);/);
  assert.ok(deps, '远端保存 effect 必须有依赖数组');
  assert.ok(!/\bviewport\b/.test(deps[1]),
    '远端保存的依赖数组里不许再出现 viewport（平移一次 = 发一次网络请求）');

  const localDeps = INDEX.slice(draftAt, draftAt + 400).match(/\}, \[([^\]]*)\]\);/);
  assert.ok(localDeps, '本地草稿 effect 必须有依赖数组');
  assert.ok(!/\bviewport\b/.test(localDeps[1]), '本地草稿的依赖数组里同样不许有 viewport');
});

/* ───────────────────────── ⑮ 快捷键清单不许骗人 ───────────────────────── */
test('⑮ ? 面板里的快捷键清单必须与真实绑定一致', () => {
  const ids = CANVAS_SHORTCUTS.map(s => s.id);
  ['duplicate', 'undo', 'redo', 'zoom-in', 'zoom-out', 'zoom-reset', 'pan-h', 'save']
    .forEach(id => assert.ok(ids.includes(id), '清单缺少 ' + id));
  assert.ok(!ids.includes('zoom'), '旧的笼统「Ctrl+滚轮」条目已被 zoom-wheel 取代');

  CANVAS_SHORTCUTS.forEach(entry => {
    assert.ok(entry.keys.length > 0, entry.id + ' 必须写清按键');
    assert.ok(entry.description.trim().length > 0, entry.id + ' 必须写清说明');
  });

  /* 宣传了就必须实现 */
  assert.match(INDEX, /zoomReset\(\)/, 'Ctrl+0 / 百分比按钮要真的能复位');
  assert.match(INDEX, /saveNowRef/, 'Ctrl+S 要走真实保存，不能是假定时器');
  assert.doesNotMatch(INDEX, /\}, 220\);/, 'Ctrl+S 的 220ms 假保存必须删掉');
});

/* ───────────────────────── ⑯ 输入框守卫 ───────────────────────── */
test('⑯ Ctrl+C 必须有输入态守卫，否则在提示词框里复制出来的是节点 JSON', () => {
  const copyBranch = INDEX.slice(INDEX.indexOf("e.key.toLowerCase() === 'c'"));
  const block = copyBranch.slice(0, 500);
  assert.match(block, /isTyping|isCanvasEditingTarget/, '复制分支必须先判输入态');
});

test('⑰ Ctrl+A 不得把隐藏节点也选上（隐藏 = 用户说"这张先不看"）', () => {
  const block = INDEX.slice(INDEX.indexOf("e.key === 'a'"));
  assert.match(block.slice(0, 400), /hidden !== true/, '全选要排除 hidden');
});

/* ───────────────────────── ⑱ 六向对齐 + 等距 ───────────────────────── */
test('⑱ 多选工具栏要六向对齐 + 水平/垂直等距', () => {
  const ids = MULTI_SELECTION_ACTIONS.map(a => a.id);
  ['align-left', 'align-center', 'align-right', 'align-top', 'align-middle', 'align-bottom']
    .forEach(id => assert.ok(ids.includes(id), '缺少 ' + id));
  assert.ok(ids.includes('distribute-h') && ids.includes('distribute-v'), '缺少等距分布');

  /* 中间那条的 label 以前写「垂直居中」而行为是水平居中 —— 标签必须说人话 */
  const center = MULTI_SELECTION_ACTIONS.find(a => a.id === 'align-center');
  assert.match(center.label, /水平/, 'align-center 的文案必须说「水平」，它算的是 x');

  const nodes = [
    { id: 'a', x: 0, y: 0, w: 20, h: 20 },
    { id: 'b', x: 30, y: 50, w: 20, h: 20 },
    { id: 'c', x: 120, y: 10, w: 20, h: 20 },
  ];
  const ids3 = new Set(['a', 'b', 'c']);
  const tops = applyMultiSelectionAction(nodes, ids3, 'align-top');
  assert.deepEqual(tops.map(n => n.y), [0, 0, 0]);

  const middles = applyMultiSelectionAction(nodes, ids3, 'align-middle');
  const bounds = selectedCanvasBounds(nodes, ids3);
  middles.forEach(node => {
    assert.ok(Math.abs(node.y - (bounds.y + (bounds.h - node.h) / 2)) < 1e-9, '垂直居中必须按整卡算');
  });

  const dist = applyMultiSelectionAction(nodes, ids3, 'distribute-h');
  const gaps = [dist[1].x - (dist[0].x + dist[0].w), dist[2].x - (dist[1].x + dist[1].w)];
  assert.ok(Math.abs(gaps[0] - gaps[1]) < 1e-9, '等距分布的两段空隙必须相等');
  assert.equal(dist[0].x, nodes[0].x, '首尾不动');
  assert.equal(dist[2].x + dist[2].w, nodes[2].x + nodes[2].w, '首尾不动');

  /* 少于 3 个没有"中间"，不动作 */
  const two = applyMultiSelectionAction(nodes.slice(0, 2), new Set(['a', 'b']), 'distribute-h');
  assert.equal(two[1].x, nodes[1].x);
});

/* ───────────────────────── ⑲ 渲染层兑现 ───────────────────────── */
test('⑳ 导入了就必须真的调用：上一批 auto-pan 只 import 没接线（与假保存同类）', () => {
  /* `calcCanvasAutoPan` 是按 RF `calcAutoPan` 写好的纯函数，上一批只 import 了、
     从没调用 —— 和「Ctrl+S 假保存」「undo 没 push」是同一类毛病：
     造了个能用的东西，然后没接上线，用户只当它不存在。 */
  const calls = INDEX.match(/calcCanvasAutoPan\(/g) || [];
  assert.ok(calls.length >= 1, 'calcCanvasAutoPan 必须至少有一个真实调用点');
  assert.match(INDEX, /autoPanFrameRef/, '必须有一个 rAF 循环持续推进视口');
  assert.match(INDEX, /stopAutoPan\(\)/, '手势结束必须停掉自动平移，否则松手后画布还在自己走');
  /* 三种手势都要有：拖节点、框选、拖线 —— 少了任何一种，用户都会撞上"拖不到画布外" */
  assert.match(INDEX, /'drag', 'layer-extract', 'marquee', 'connect'/);
});

test('㉑ 网格吸附开关必须真的被读，且网格线跟着缩放走', () => {
  /* `snapEnabled` 原先全仓只被写、从没被读 ⇒ 右键菜单「网格吸附」点了没反应。
     拖动喂的也是 `pending.grid || 0`，而 `pending.grid` 从没赋值 ⇒ 实际一直是关的。 */
  const reads = INDEX.match(/snapEnabled/g) || [];
  assert.ok(reads.length >= 3, `snapEnabled 只出现 ${reads.length} 次 —— 开关与拖动都得读它`);
  /* 先剥注释 —— 说明"原来写的是什么"的那句话自己就会把断言炸掉（踩过）。 */
  assert.doesNotMatch(stripComments(INDEX), /grid: pending\.grid \|\| 0/,
    '拖动必须喂真实网格步长，而不是一个从没被赋值的 pending.grid');
  assert.match(INDEX, /canvasSnapGridWorld\(viewport\.scale, snapEnabled\)/);

  /* 网格点必须随缩放走：写死 background-size 的话，缩小 4 倍就糊成一片噪点 */
  const css = read('src/pages/EcCanvas/EcCanvas.css');
  assert.match(css, /--canvas-grid-size/, '网格间距要由视口注入，不能写死');
  assert.match(css, /--canvas-grid-offset-x/);
  const stage = css.match(/\.ec-canvas-stage \{[\s\S]*?\}/)?.[0] || '';
  assert.doesNotMatch(stage, /background-size:\s*20px 20px/, 'stage 不许再写死 20px 网格');
});

test('⑲ 参考线要真的画出来（不画 = 用户不知道有没有吸上）', () => {
  assert.match(INDEX, /data-canvas-alignment-guides/);
  assert.match(INDEX, /setAlignmentGuides\(\[\]\)/, '手势结束必须清掉参考线');
});