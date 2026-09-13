// test/canvas-result-ports-layout-0915.test.mjs
// 2026-09-15 用户决定（复核 9-13）：
//  ① **生成前无加号、生成结果必须有加号**：四个生成框在结果未落框前左右都不挂加号；
//     结果节点（含结果落入框内的 image/video-composer）左右必须有加号，可继续派生。
//  ② 多张结果自动排版：图片/视频横向一排（同一 y，间距 = 节点宽 + 24px，超过 4 张换行）；
//     文案结果纵向一列；复用套图「右侧锚定 + 派生连线」约定。
//  ③ 生成完成后默认多选全部结果节点（multiSelected 包含全部结果；单张也选中）。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  canvasGenerationBoxHasResult,
  layoutCanvasGeneratedResults,
} from '../src/pages/EcCanvas/canvasStudioModel.js';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('生成前无加号：结果未落框的生成框不渲染左右加号', () => {
  assert.equal(canvasGenerationBoxHasResult({ kind: 'image-composer', status: 'ready', url: '' }), false, '未生成的图片框无加号');
  assert.equal(canvasGenerationBoxHasResult({ kind: 'image-composer', status: 'processing', url: 'x' }), false, '生成中无加号');
  assert.equal(canvasGenerationBoxHasResult({ kind: 'image-composer', status: 'error', url: 'x' }), false, '失败无加号');
  assert.equal(canvasGenerationBoxHasResult({ kind: 'video-composer', status: 'ready', url: '' }), false, '未生成的视频框无加号');
  assert.equal(canvasGenerationBoxHasResult({ kind: 'text-composer', status: 'success', url: 'x' }), false, '文案框是控制台，结果以独立节点出现，始终无框上加号');
  assert.equal(canvasGenerationBoxHasResult({ kind: 'suite-composer', status: 'success', url: '' }), false, '套图框是控制台，结果以独立节点出现，始终无框上加号');
});

test('生成结果必须有加号：结果落入框内的节点返回 true', () => {
  assert.equal(canvasGenerationBoxHasResult({ kind: 'image-composer', status: 'success', url: '/api/a.png' }), true, '图片结果落框有加号');
  assert.equal(canvasGenerationBoxHasResult({ kind: 'video-composer', status: 'success', url: '/api/v.mp4' }), true, '视频结果落框有加号');
  assert.equal(canvasGenerationBoxHasResult({ kind: 'video', status: 'ready', url: '/api/v.mp4' }), true, '视频素材有加号');
  assert.equal(canvasGenerationBoxHasResult({ kind: 'layer-group', status: 'ready', url: '/api/a.png' }), true, '分层结果有加号');
});

test('图片/视频结果自动排版：横向一排（同一 y，间距 = 节点宽 + 24px），超过 4 张换行', () => {
  const anchor = { x: 100, y: 200, w: 230, h: 230 };
  const items = Array.from({ length: 5 }, (_, index) => ({ id: 'r' + index, w: 230, h: 230 }));
  const placed = layoutCanvasGeneratedResults({ anchor, items, mode: 'row' });
  assert.deepEqual(
    placed.map(({ id, x, y }) => ({ id, x, y })),
    [
      { id: 'r0', x: 386, y: 200 },
      { id: 'r1', x: 640, y: 200 },
      { id: 'r2', x: 894, y: 200 },
      { id: 'r3', x: 1148, y: 200 },
      { id: 'r4', x: 386, y: 454 },
    ],
    '前 4 张同一 y 横排（386 = 100+230+56；步进 230+24=254），第 5 张换行（y = 200 + 230 + 24）',
  );
});

test('文案结果自动排版：纵向一列（同一 x，竖排更可读）', () => {
  const anchor = { x: 100, y: 200, w: 230, h: 84 };
  const items = Array.from({ length: 3 }, (_, index) => ({ id: 't' + index, w: 230, h: 84 }));
  const placed = layoutCanvasGeneratedResults({ anchor, items, mode: 'column' });
  assert.deepEqual(
    placed.map(({ id, x, y }) => ({ id, x, y })),
    [
      { id: 't0', x: 386, y: 200 },
      { id: 't1', x: 386, y: 308 },
      { id: 't2', x: 386, y: 416 },
    ],
    '同一 x（386 = 100 + 230 + 56），y 步进 84 + 24 = 108',
  );
});

test('四个生成框调用公共排版 + 生成后默认多选全部结果（用户 9-15 决定）', () => {
  const canvas = read('src/pages/EcCanvas/index.jsx');
  /* 图片：第一张落框，其余经 layoutCanvasGeneratedResults 横排 */
  const imageDemo = canvas.slice(canvas.indexOf('const handleImageComposerGenerate'), canvas.indexOf('const handleSuiteComposerGenerate'));
  assert.match(imageDemo, /layoutCanvasGeneratedResults\(\{/);
  assert.match(imageDemo, /anchor: composer/);
  assert.match(imageDemo, /mode: 'row'/);
  assert.match(imageDemo, /setMultiSelected\(new Set\(resultNodeIds\)\)/, '图片生成完成默认多选全部结果（含框内第一张）');
  /* 文案：纵向一列 + 默认多选全部结果 */
  const textDemo = canvas.slice(canvas.indexOf('const handleTextGenerationGenerate'), canvas.indexOf('const handleAddTextNode'));
  assert.match(textDemo, /mode: 'column'/, '文案结果纵向一列');
  assert.match(textDemo, /setMultiSelected\(new Set\(resultNodeIds\)\)/, '文案生成完成默认多选全部结果');
  /* 视频：结果落框，默认选中该结果 */
  const videoDemo = canvas.slice(canvas.indexOf('const handleVideoComposerGenerate'), canvas.indexOf('const handleVideoComposerAnalyze'));
  assert.match(videoDemo, /setMultiSelected\(new Set\(\[composer\.id\]\)\)/, '视频生成完成默认选中结果');
  /* 套图：控制台不参与多选，结果节点全部多选 */
  const suiteDemo = canvas.slice(canvas.indexOf('const handleSuiteComposerGenerate'), canvas.indexOf('const handleSuiteDirectionSelect'));
  assert.match(suiteDemo, /receivedNodeIds\.push\(output\.id\)/);
  assert.match(suiteDemo, /setMultiSelected\(new Set\(receivedNodeIds\)\)/, '套图结果生成后默认多选全部结果节点');
  /* 生成框结果节点可继续派生：派生判定放宽到“结果已落框的生成框” */
  assert.match(canvas, /canDeriveFromCanvasSource/);
  assert.match(canvas, /生成前无加号、生成结果必须有加号/);
});
