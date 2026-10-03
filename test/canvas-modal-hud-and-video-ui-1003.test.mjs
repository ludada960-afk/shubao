// test/canvas-modal-hud-and-video-ui-1003.test.mjs
// 门禁：2026-10-03 那批截图批注（弹窗层级 / 区域框选器 / 视频落位）。
//
// 三条批注其实是三个独立的缺陷，但根子是同一种：
// **「坐标与状态的真相写在两个地方」** ——
//   · 弹窗是否打开写在一个 flag 里，而漏了智能去字幕的框选器 ⇒ HUD 不暗；
//   · 框选坐标系读的是**一个没约束过的祖先容器**的 offsetWidth；
//   · 视频落位量的是**媒体本体**，而节点渲染的是**整卡**（含 footer）。
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { canvasHudHidden } from '../src/pages/EcCanvas/canvasVisualLanguage.js';
import { fitRegionBox } from '../src/components/media/videoRegionGeometry.js';
import { CANVAS_CARD_FOOTER_H } from '../src/pages/EcCanvas/canvasGeometry.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const INDEX = read('src/pages/EcCanvas/index.jsx');
const PICKER = read('src/components/media/VideoRegionPicker.jsx');
const PICKER_CSS = read('src/components/media/VideoRegionPicker.css');

/* ───────── ① 智能去字幕的框选器算"弹窗打开"，HUD 与 ✨ 才一起暗下去 ───────── */
test('① 智能去字幕的区域框选器必须计入"弹窗打开"，否则 HUD 与 ✨ 都不暗', () => {
  /* 用户原话（两处截图）：
     「而且这两个为什么跟着高亮呢，不是应该暗下去吗」（小地图 + 左下缩放条）
     「这个按钮我说了好多次了…不要跟弹窗一样弹到最前面来啊，他应该回到画布那一层级去啊」
       （左侧那颗 ✨ —— 它是 TaskSidebar 的浮动触发器）

     两处的**同一个根因**：`dialogOpen` 为假。
     ✨ 渲染在 `.ec-canvas-page` **之外**（是它的兄弟节点），靠
     `html[data-cvl-dialog-open]` 压暗；HUD 靠 `.ec-canvas-page.is-dialog-open`。
     而这个布尔只由 `canvasHudHidden()` 一个函数产出 —— 它漏了这一项。 */
  assert.equal(canvasHudHidden({ videoRegionPickerOpen: true }), true,
    '框选器开着时必须判定为"弹窗打开"');
  assert.equal(canvasHudHidden({ videoRegionPickerOpen: false }), false);
  assert.match(INDEX, /videoRegionPickerOpen:\s*Boolean\(subtitlePickNodeId\)/,
    'index.jsx 必须把这个开关接进 canvasHudHidden —— 加了定义不接线等于没做');

  /* HUD 是 display:none（退出命中测试），不是压暗 —— 别降级成 opacity */
  const hudRule = PICKER_CSS /* 占位，避免 no-unused */;
  assert.ok(hudRule);
  const css = read('src/pages/EcCanvas/EcCanvas.css');
  const group = css.match(/\.ec-canvas-page\.is-dialog-open[\s\S]*?\}/)?.[0] || '';
  assert.match(group, /\.ec-canvas-minimap/, '小地图必须在 HUD 隐藏名单里');
  assert.match(group, /\.ec-canvas-zoom-controls/, '左下缩放条必须在 HUD 隐藏名单里');
  assert.match(group, /display:\s*none\s*!important/, 'HUD 用 display:none（不留在命中测试里）');
});

/* ───────── ② 框选器的显示框由**固有比例**算出，不由祖先容器量 ───────── */
test('② 框选坐标系不得来自"没约束过的祖先容器"—— 那是横带与整体错位的根源', () => {
  /* 用户原话：「点击擦除为什么是这样的」（画面只露出顶部一条横带，
     而字幕通常在下三分之一 ⇒ 根本框不到）。 */
  /* 纯函数住在独立模块里（.jsx 没法被 node --test 直接 import） */
  const geometry = read('src/components/media/videoRegionGeometry.js');
  assert.match(geometry, /export function fitRegionBox/);
  /* 2026-10-04：导入里多了两个常量（画布内嵌那一格要按节点尺寸 fit，得能取到默认上限），
     所以这里只认「确实从那个模块引入了 fitRegionBox」，不认整条 import 语句的原文。 */
  assert.match(PICKER, /import \{[^}]*\bfitRegionBox\b[^}]*\} from '\.\/videoRegionGeometry\.js'/,
    '组件必须真的用那个纯函数算框');
  /* 1080×1920 必须 fit 出**保持原始比例的竖框**，而不是被夹成横带。
     真正的判据是「框的比例 == 视频的比例」—— 只要比例对了，
     屏幕坐标 × scale 就等于源像素，框选与 ffmpeg delogo 才对得上。 */
  const box = fitRegionBox(1080, 1920);
  assert.ok(box.height > box.width, '9:16 的片子必须 fit 出竖框，实际 = ' + JSON.stringify(box));
  assert.ok(Math.abs(box.width / box.height - 1080 / 1920) < 0.02,
    '显示框必须保持视频原始比例，否则框选坐标与源像素对不上');
  assert.ok(box.height <= 560, '不得超过上限，否则框选器自己撑爆视口');
  assert.ok(box.width > 250, '也不该小到看不清：实际 = ' + JSON.stringify(box));
  const square = fitRegionBox(1000, 1000);
  assert.equal(square.width, square.height, '1:1 仍是方框');
  const wide = fitRegionBox(1920, 1080);
  assert.ok(wide.width > wide.height, '16:9 是横框');
  assert.deepEqual(fitRegionBox(0, 0), { width: 0, height: 0 }, 'metadata 未到时返回空，不许返回一个假框');

  /* 舞台不许再夹高度（那 280px 就是横带的直接来源） */
  const stage = PICKER_CSS.match(/\.video-region-stage \{[^}]*\}/)?.[0] || '';
  assert.doesNotMatch(stage, /max-height:\s*280px/, '舞台不许再写死 280px 高度');
  /* 视频不许加 object-fit: contain —— 信箱留白会被当成画面，坐标整体对不上 */
  const video = PICKER_CSS.match(/\.video-region-video \{[^}]*\}/)?.[0] || '';
  assert.doesNotMatch(video, /object-fit/, '视频不许 object-fit（会做信箱式留白，破坏坐标系）');

  /* 拖拽夹取用的边界必须就是这个框，不能再用 offsetWidth。
     先剥注释 —— 说明"原来错在哪"的那段话里就写着 offsetWidth。 */
  const pickerCode = PICKER.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
  assert.doesNotMatch(pickerCode, /node\.offsetWidth/, '不得再用祖先容器的 offsetWidth 当坐标系');
  assert.doesNotMatch(pickerCode, /surface\.offsetWidth/, '不得再用 surface 的 offsetWidth');
  /* ready 必须同时要求固有尺寸与显示框都有值（否则 scale=0，框全塌成 0） */
  assert.match(pickerCode, /size\.width > 0 && size\.height > 0[\s\S]{0,80}displayWidth > 0/);
});

/* ───────── ③ 上传视频按**整卡**居中 ───────── */
test('③ 上传视频必须按整卡高度居中：媒体本体比卡片矮一个 footer，居中会差 23px', () => {
  /* 用户原话：「为什么我在画布上上传视频，会这么靠下呢，现在这个视频完全不是居中的状态呀」 */
  assert.match(INDEX, /CANVAS_CARD_FOOTER_H/,
    'index.jsx 要用整卡高度常量，不能继续按媒体本体算');
  const call = INDEX.slice(INDEX.indexOf('canvasUploadFootprintSizes(importedAssets'));
  assert.match(call.slice(0, 300), /\+ CANVAS_CARD_FOOTER_H/,
    '这批视频的占位高度必须加上 footer，否则卡片中线落在视口中线下方');
  /* 空画布上那个 40%×35% 的经验锚点优先于居中，与"居中"直接冲突 */
  const block = INDEX.slice(INDEX.indexOf('canvasUploadFootprintSizes(imported.assets') - 200, INDEX.indexOf('canvasUploadFootprintSizes(imported.assets') + 400);
  assert.doesNotMatch(block, /preferred:/, '视频上传不应再用经验锚点覆盖视口居中');

  /* footer 的高度就是那个差值 */
  assert.equal(CANVAS_CARD_FOOTER_H, 46);
});

test('④ 图片上传不受影响：图片节点没有 footer（showMeta:false），媒体高度即整卡高度', () => {
  const model = read('src/pages/EcCanvas/canvasStudioModel.js');
  const imageFn = model.slice(model.indexOf('export function createUploadedImageNodes'));
  const videoFn = model.slice(model.indexOf('export function createUploadedVideoNodes'));
  /* 窗口要够宽：这两个工厂各有 30+ 行，showMeta 在函数体中段 */
  assert.match(imageFn.slice(0, 3000), /showMeta:\s*false/,
    '图片上传节点不渲染 footer —— 所以图片那条路径不该被这次改动波及');
  assert.doesNotMatch(videoFn.slice(0, 3000), /showMeta:\s*false/,
    '视频节点渲染 footer —— 这就是两者落位差 46px 的来源');
});