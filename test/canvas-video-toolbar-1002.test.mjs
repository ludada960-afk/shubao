// test/canvas-video-toolbar-1002.test.mjs
// 2026-10-02：视频节点的工具栏必须是**视频专属**的一套（用户照知渔提的）。
// ─────────────────────────────────────────────────────────────────────────────
// 用户原话：
//   「而且你上面的这些功能栏太少了。而且好像也不完全是为视频功能去定制的一些功能呀。
//     视频跟图片生成他们是不同的逻辑才对呀，你应该定制化的为他去开发一些功能。」
//
// **病根不是"少注册了几个动作"**，是整条筛选链路不认视频：
//   · `action()` 的默认 `canRun` 是 `isReadyImage`（只认 image / output / layer-group）
//   · `stableActionsForSurface` 的兜底 `hasPreview = canRunLocally(node)` 也只认图片
// ⇒ 视频节点进来，两道筛都把它筛掉，最后拿到的几颗是"恰好 canRun 里写了 video"的
//   （save-to-assets / replace-media），其余全是图片动作。
//
// ⚠️ 反向断言一律跑在**剥掉注释**的副本上 —— 这份文件的头部注释里就写着
//    「编辑文字 / 宫格切分 / 图片标注」这些字样，不剥会自己绊倒自己。
// ─────────────────────────────────────────────────────────────────────────────
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { stableActionsForSurface, isVideoNode, isReadyVideoNode } from '../src/pages/EcCanvas/canvasActionRegistry.js';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, '');
const index = read('src/pages/EcCanvas/index.jsx');
const indexCode = strip(index);
const registry = read('src/pages/EcCanvas/canvasActionRegistry.js');
const registryCode = strip(registry);

const VIDEO = { id: 'v1', kind: 'video', url: '/api/generated-assets/x.mp4', status: 'ready' };
const IMAGE = { id: 'i1', kind: 'image', url: '/api/generated-assets/y.png', status: 'ready' };

test('① 视频节点拿到的是**视频专属**动作，不是图片那一套', () => {
  const labels = stableActionsForSurface({ surface: 'selection', node: VIDEO }).map(a => a.label);
  assert.ok(labels.includes('预览'), '视频工具栏要有「预览」，实际 ' + JSON.stringify(labels));
  assert.ok(labels.includes('下载视频'), '视频工具栏要有「下载视频」');
  assert.ok(labels.includes('加入资产库'), '「加入资产库」两边都该有');
  /* ⚠️ 「智能去字幕」本轮**故意没上**（下一批补）：
     它的计价项还没按真实 SKU 接进 `canvasBillingModel.ACTIONS` ⇒ `priceFeature` 查表落空、
     静默回落成「免费」，而后端那条 delogo SKU 是**按秒计价**、点下去真扣积分。
     `canvas-billing` 门禁的注释写得很直白：注册表与计价表键对不上 ⇒ UI 显示免费但后端实收。
     ⇒ 这里反过来钉一道：**计价项没接好之前，这个按钮就不许出现**。 */
  assert.ok(!labels.includes('智能去字幕'),
    '去字幕在计价项按真实 SKU 接好之前不该出现（否则界面写"免费"、后端真扣积分）');
  /* 这三个是图片专属，对一条视频毫无意义 —— 用户说的"不完全是为视频定制的"就是它们 */
  for (const imageOnly of ['编辑文字', '宫格切分', '智能分层', '去除背景', '图片标注', '裁剪']) {
    assert.ok(!labels.includes(imageOnly), `视频工具栏不该有图片动作「${imageOnly}」，实际 ${JSON.stringify(labels)}`);
  }
});

test('② 图片节点的行为**一字未变**（这次不能为了视频把图片弄坏）', () => {
  const before = stableActionsForSurface({ surface: 'selection', node: IMAGE }).map(a => a.id);
  assert.ok(before.includes('grid-split'), '图片仍要有「宫格切分」');
  assert.ok(before.includes('annotation'), '图片仍要有「图片标注」');
  assert.ok(!before.includes('smart-subtitle-erase'), '图片不该有「智能去字幕」');
  assert.ok(!before.includes('preview-media'), '图片不该有视频专属的「预览」');
});

test('③ 视频动作的 canRun 必须显式认 video（不能靠默认值）', () => {
  /* `action()` 的默认 canRun 是 isReadyImage —— 只靠默认就会重演"视频拿不到动作" */
  assert.match(registryCode, /canRun: isReadyVideoNode/, '视频动作必须显式声明 canRun');
  assert.match(registryCode, /function isReadyVideoNode|export function isReadyVideoNode/,
    '必须有 isReadyVideoNode 这个判定');
  /* 失败/上传中的视频不该给动作 */
  assert.equal(isReadyVideoNode({ ...VIDEO, status: 'upload-error' }), false, '上传失败不给动作');
  assert.equal(isReadyVideoNode({ ...VIDEO, status: 'generating' }), false, '生成中不给动作');
  assert.equal(isReadyVideoNode(IMAGE), false, '图片不是视频节点');
});

test('④ handler 都真的接上了（不是只注册了个名字）', () => {
  for (const [handler, need] of [
    ['preview-media', /openImagePreview\(\{ url: node\.url, kind: 'video'/],
    ['export-video', /link\.download = node\.name/],
  ]) {
    assert.match(registryCode, new RegExp("handler: '" + handler + "'"), `注册表里要有 ${handler}`);
    assert.match(indexCode, new RegExp("handler === '" + handler + "'"), `index.jsx 要分发 ${handler}`);
    assert.match(indexCode, need, `${handler} 的实现没找到`);
  }
});

test('⑤ 预览灯箱按 kind 分渲染，且视频**不套**图片那套缩放', () => {
  /* 另起一个弹窗 = 两套关闭/缩放/滚轮逻辑，迟早打架 ⇒ 复用同一个灯箱、按 kind 分渲染 */
  assert.match(indexCode, /zoomImg\.kind === 'video'/, '灯箱必须按 kind 分渲染');
  assert.match(indexCode, /<video[\s\S]{0,300}controls/, '视频预览要有 controls（自带播放/进度/音量）');
  /* ⚠️ 视频控件层与外层 scale() 会互相干扰（点控件被当成缩放） */
  const videoBranch = /zoomImg\.kind === 'video' \? \(([\s\S]*?)\) : \(/.exec(indexCode);
  assert.ok(videoBranch, '要能截到视频那一支');
  assert.doesNotMatch(videoBranch[1], /previewScale/, '视频分支不许套图片那套 scale(previewScale)');
});