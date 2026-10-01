// test/canvas-free-form-connection-0930.test.mjs
// 画布「任意两个节点都能手动连线」+ 媒体类型互斥（批 CY-㊴ · 用户 2026-09-30 图4/图5）
// ─────────────────────────────────────────────────────────────────────────────
// 用户逐字（这一批的判据来源）：
//   「他为什么不能够跟我们当前的任意节点创建连接呢？…你应该允许他手动拉到任意一个素材的
//     左边或者右边的加号这里时给一个吸附的能力，让它可以吸附上去，然后创建成连接。」
//   「当他把一个新的节点拉到这个共同的节点里面去之后，你是不是也得在他的这个上传素材
//     这个地方去同步显示出来呢？」
//   「这个图片生成，它只能上传图片去作为他的素材。那你就不应该让画布里面的任意视频也跟他
//     进行连接匹配。因为视频是跟他互斥的。」
//
// ⚠️ 这条门禁守的是四件**曾经互相掩盖**的事，少修一件用户就会撞上另一个：
//   ① side 透传：父组件把两侧的 onPortPointerUp 都写死成 'out'，handler 一律丢弃
//   ② 端口可见：未选中节点的端口 pointer-events:none，线落不上去
//   ③ 吸附：用**模型坐标**判定（不是 DOM 实测 —— 那是批 CY-㉕/㉖ 的事故源）
//   ④ 边 → 素材卡：面板那排小卡只读 sourceNodeIds，手拉线不产生数组项
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { pickCanvasConnectionSnapTarget, CANVAS_SNAP_RADIUS, getNodePortCenter } from '../src/pages/EcCanvas/canvasGeometry.js';
import { canConnectCanvasNodes, describeAcceptedTypes } from '../src/pages/EcCanvas/canvasQuantvExtensions.js';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const index = read('src/pages/EcCanvas/index.jsx');
const studio = read('src/pages/EcCanvas/components/CanvasStudio.jsx');
const css = read('src/pages/EcCanvas/EcCanvas.css');

const IMG = { id: 'img', kind: 'image', x: 0, y: 0, w: 200, h: 200 };
const COMPOSER = { id: 'composer', kind: 'image-composer', x: 400, y: 0, w: 240, h: 240 };

test('① 吸附判定：选中最近的**输入端口**，且用的是连线端点同一个模型口径', () => {
  const center = getNodePortCenter(COMPOSER, 'input');   // x = 400 − 17
  const near = { x: center.x + 6, y: center.y - 4 };
  const hit = pickCanvasConnectionSnapTarget([IMG, COMPOSER], near, { fromId: 'img' });
  assert.ok(hit, '进入加号附近必须吸住');
  assert.equal(hit.nodeId, 'composer');
  assert.deepEqual(hit.center, center, '吸附点必须就是连线端点那个坐标（否则"吸上了线却没接上"）');
  /* 太远就不吸 —— 否则整张画布的节点都会被"最近的那个"抢走 */
  assert.equal(pickCanvasConnectionSnapTarget([IMG, COMPOSER], { x: center.x + CANVAS_SNAP_RADIUS + 10, y: center.y }, { fromId: 'img' }), null);
  /* 不能连到自己 */
  assert.equal(pickCanvasConnectionSnapTarget([COMPOSER], { x: getNodePortCenter(COMPOSER, 'input').x, y: COMPOSER.y + 100 }, { fromId: 'composer' }), null);
  /* 隐藏节点不参与吸附（隐藏的东西不该被吸住） */
  assert.equal(pickCanvasConnectionSnapTarget([{ ...COMPOSER, hidden: true }], { x: getNodePortCenter(COMPOSER, 'input').x, y: COMPOSER.y + 120 }, { fromId: 'img' }), null);
  /* 两个候选时取更近的那个（两者纵向错开，指针落在下边那个的邻域里） */
  const other = { id: 'other', kind: 'image', x: 400, y: -100, w: 200, h: 200 };
  const c1 = getNodePortCenter(COMPOSER, 'input');   // (383, 120)
  const c2 = getNodePortCenter(other, 'input');      // (383,   0)
  const pick = pickCanvasConnectionSnapTarget([COMPOSER, other], { x: c2.x + 3, y: c2.y + 2 }, { fromId: 'img' });
  assert.equal(pick.nodeId, 'other', '更近的候选优先（这里离 other 3.6、离 composer 118）');
});

test('② 媒体类型互斥：图片生成框**不许**接视频，且原因要说成人话', () => {
  const nodes = [
    { id: 'v', kind: 'video', url: '/a.mp4' },
    { id: 'pic', kind: 'image', url: '/a.png' },
    { id: 'imgc', kind: 'image-composer' },
    { id: 'videoc', kind: 'video-composer' },
  ];
  const bad = canConnectCanvasNodes('v', nodes[2], nodes);
  assert.equal(bad.ok, false, '视频 → 图片生成必须被拒（用户原话：视频跟它是互斥的）');
  assert.match(bad.reason, /视频/, '拒绝原因要告诉用户接的是什么');
  assert.match(bad.reason, /只接受/, '还要告诉他这个框能接什么');
  assert.equal(canConnectCanvasNodes('pic', nodes[2], nodes).ok, true, '图片 → 图片生成必须放行');
  /* 视频生成框本来就收视频/音频（上传那条路一直是这么做的），矩阵不许再和它打架 */
  assert.equal(canConnectCanvasNodes('v', nodes[3], nodes).ok, true, '视频 → 视频生成必须放行（与上传口径一致）');
  assert.equal(canConnectCanvasNodes('pic', nodes[3], nodes).ok, true, '图片 → 视频生成必须放行');
  /* 不能连到自己 */
  assert.equal(canConnectCanvasNodes('pic', nodes[1], nodes).ok, false);
  assert.ok(describeAcceptedTypes('image-composer').length > 0, '要说得出这个框能接什么');
});

test('③ 画布页不得用 DOM 实测做端口命中（那是批 CY-㉕/㉖ 的事故源）', () => {
  const code = index.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.match(code, /pickCanvasConnectionSnapTarget\(/, '吸附必须走那个纯模型函数');
  assert.doesNotMatch(code, /renderedPortCenters/, '不得再引入"渲染期端口中心"这套');
  /* 吸附半径按缩放换算：低缩放下屏幕上的吸附范围要恒定，不能越缩越小 */
  assert.match(code, /CANVAS_SNAP_RADIUS \/ Math\.max\(0\.2, viewport\.scale\)/,
    '半径必须除以当前缩放（世界坐标 ⇄ 屏幕像素）');
});

test('④ side 必须透传，且建边前必须过互斥矩阵', () => {
  const code = index.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.doesNotMatch(code, /onPortPointerUp=\{\(\) => handlePortPointerUp\?\./,
    '不得再有"引用作用域里不存在的 event"的死 prop（它是运行时 ReferenceError）');
  assert.doesNotMatch(code, /handlePortPointerUp\(event, node\.id, 'out'\)\}\s*$/m,
    '父组件不得再把 side 写死成 out');
  assert.match(code, /onPortPointerUp=\{\(event, side\) => handlePortPointerUp\(event, node\.id, side\)\}/,
    'side 必须原样透传给 handler');
  assert.match(studio, /const handlerSide = isInput \? 'in' : 'out'/);
  /* 建边的**两条**入口都要校验（拖线松手 / 端口 pointerup） */
  const checks = code.match(/canConnectCanvasNodes\(/g) || [];
  assert.ok(checks.length >= 3, '吸附 accept + 两条建边路径都要过矩阵（实测 ' + checks.length + ' 处）');
  assert.match(code, /showToast\(check\.reason, 'info'\)/, '被拦下时要把原因告诉用户');
});

test('⑤ 边连上来的素材必须出现在面板的「上传素材」区', () => {
  const code = index.replace(/\/\*[\s\S]*?\*\//g, '');
  /* 事故：selectedComposerSources 只读 node.sourceNodeIds，而手拉线只产生 connections。
     ⇒ 线连上了、@ 菜单里能看到，面板上那排卡却是空的。 */
  const m = code.match(/const selectedComposerSources =[\s\S]{0,400}?;/);
  assert.ok(m, '找不到 selectedComposerSources');
  assert.match(m[0], /mergeGraphMentionSources\(selectedNode, connections\)/,
    '素材卡必须把「边」算进来（mergeGraphMentionSources 是边 + 显式数组的并集）');
  assert.doesNotMatch(m[0], /selectedNode\.sourceNodeIds \|\| \[\]/,
    '不得只读 sourceNodeIds —— 那正是手拉线不显示的原因');
  /* 视频生成框也要读边（改前只有它不读，是"素材看得见却不参与生成"的那种不一致） */
  const videoInputs = code.match(/mergeGraphMentionSources\(composer, connections\)/g) || [];
  assert.ok(videoInputs.length >= 2, '视频生成的输入解析（生成 + 分析分析两条路）都要读边，实测 ' + videoInputs.length + ' 处');
});

test('⑥ 拖线时目标加号必须可见可点，吸住的要高亮', () => {
  /* 未选中节点的端口原本 pointer-events:none，线根本落不上去 */
  assert.match(studio, /visible=\{presentation\.handlesVisible \|\| connectActive\}/,
    '拉线期间图片节点的加号必须亮出来');
  assert.match(studio, /<DerivePort side="input" visible=\{selected \|\| connectActive\}/,
    '生成节点的输入加号同理');
  assert.match(studio, /active=\{snapActive\}/, '吸住的那个加号要有 active 标记');
  assert.match(css, /\.ec-canvas-node-port\[data-port-active="true"\]/,
    'active 必须有真实样式（用户原话：吸上去要看得见）');
});
