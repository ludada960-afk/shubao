// test/canvas-upload-progress-on-node-1002.test.mjs
// 2026-10-02：上传进度要**长在素材自己身上**（用户照知渔提的）。
// ─────────────────────────────────────────────────────────────────────────────
// 用户原话：「他上传的进度是在整个素材里面的。我觉得他们这种做法可能更合理一些，
//           我们现在是在整个画布的最下方，我觉得可能不太对。」
//
// **为什么之前做不到**（读代码读出来的）：节点是**最后**才进画布的 ——
//   上传 → 入库 → 建节点 → `.concat(uploadedNodes)`。
//   进度发生在上传那一步，而那一刻画布上**还没有这个节点**，所以无处可挂，
//   只能做成一块全局横条 `.ec-canvas-upload-progress`（fixed 在画布底部）。
//
// ⇒ 顺序倒过来：**本地探尺寸 → 建占位节点 → 再上传**，进度写回节点自己。
//   传完按 id 就地更新（换持久 url / 清进度），**不再 concat 新节点**。
// ─────────────────────────────────────────────────────────────────────────────
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
/* ⚠️⚠️ 下面所有**反向**断言（"某样东西不许出现"）都必须跑在**剥掉注释**的副本上。
   这不是假设，是本文件第一版的真实失败：我自己的解释性注释里写了
   「所以这里不能再无条件 `.concat(uploadedNodes)`」——
   而那条反向断言直接把**注释里的这串字**当成了代码，判了一个假红。
   （今晚第六次栽在"判据匹配到了文字而不是代码"。）
   ⇒ 正向断言读原文（剥了反而可能读不到），反向断言一律用 strip 过的。 */
const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, '');
const index = read('src/pages/EcCanvas/index.jsx');
const indexCode = strip(index);
const studio = read('src/pages/EcCanvas/components/CanvasStudio.jsx');
const css = read('src/pages/EcCanvas/EcCanvas.css');

const flowStart = index.indexOf('const imageFiles = accepted.filter');
const flowEnd = index.indexOf('const importedAudios =');
assert.ok(flowStart > 0, '要能定位到上传流程起点');
const flow = index.slice(flowStart, flowEnd);

test('① 占位节点必须**先于**上传创建（否则进度无处可挂）', () => {
  const probeAt = flow.indexOf('probeLocalMediaSizes(videoFiles)');
  const placeholderAt = flow.indexOf('setNodes(previous => previous.concat(placeholders');
  const firstUploadAt = flow.indexOf('uploadVideoAsset(');
  assert.ok(probeAt > 0, '必须先本地探尺寸');
  assert.ok(placeholderAt > 0, '必须把占位节点 concat 进画布');
  assert.ok(firstUploadAt > 0, '必须找到第一个上传调用');
  assert.ok(probeAt < firstUploadAt, '探尺寸在上传之前');
  assert.ok(placeholderAt < firstUploadAt, '**建占位节点必须在上传之前** —— 这是这一批的全部要害');
});

test('② 占位节点必须带上传进度字段，且 reporter 会写它', () => {
  assert.match(flow, /status: 'uploading'/, '占位节点状态要是 uploading');
  assert.match(flow, /uploadPercent: 0/, '占位节点要带 uploadPercent');
  /* reporter 收到 nodeId 才写节点；没 nodeId 的入口（「替换素材」那条）仍然只看底部横条 */
  assert.match(index, /makeUploadReporter = useCallback\(\(name, index = 0, total = 1, nodeId = ''\)/,
    'reporter 必须能接一个 nodeId');
  assert.match(index, /node\.id === nodeId \? \{ \.\.\.node, uploadPercent: percent/,
    '进度必须写回那个节点本身');
  assert.match(index, /makeUploadReporter\(file\.name, index, videoFiles\.length, placeholderFor\('video', index\)\)/,
    '视频上传必须把占位节点 id 传进 reporter');
});

test('③ 节点上真的渲染得出进度（不是只存了字段没人画）', () => {
  assert.match(studio, /node\.status === 'uploading' &&/, '节点要按 uploading 渲染进度');
  assert.match(studio, /ec-canvas-node-upload-progress/, '要有专门的进度块');
  assert.match(studio, /上传中/, '要有「上传中」文案与百分比');
  assert.match(css, /\.ec-canvas-node-upload-progress-fill/, '进度条样式要在');
  /* ⚠️ 颜色在**子规则**上（`-track` / `-small`），基础那条只有布局 ——
     第一版把 token 断言写在基础规则上，判了个假红。
     ⇒ 改成断言"整个进度块的每条颜色声明都走既有 token"，并且不许出现硬编码色值。 */
  const block = /\.ec-canvas-node-upload-progress[^{]*\{[^}]*\}/g;
  const rules = css.match(block) || [];
  assert.ok(rules.length >= 3, '进度块至少要有基础/轨道/填充三条规则，实际 ' + rules.length);
  let coloured = 0;
  for (const rule of rules) {
    /* 声明了颜色的**必须**走 token；基础那条只有布局、不该被要求有颜色
       （我第一版要求每条都有 var()，第二版又要求每条都有颜色 —— 都是把判据问错了） */
    const declares = /(background|color)\s*:\s*([^;]+)/.exec(rule);
    if (!declares) continue;
    coloured += 1;
    assert.match(declares[2].trim(), /^var\(--/, `颜色必须走既有 token：${rule.slice(0, 90)}`);
  }
  assert.ok(coloured >= 2, '轨道与填充/文案至少两处要用颜色，实际 ' + coloured);
  for (const rule of rules) {
    assert.doesNotMatch(rule, /#[0-9a-f]{3,8}\b|rgba?\(/i, `这条不许出现硬编码色：${rule.slice(0, 90)}`);
  }
});

test('④ ⚠️ 收尾必须**就地更新**，不能再 concat（否则每个节点变两份）', () => {
  /* 这是最容易写错的一步：占位节点已经在画布上了，末尾再来一次 .concat(uploadedNodes)
     就会得到「一份 uploading 的 + 一份 ready 的」，而且 **id 相同** ⇒ React key 撞车 + 连线双份。
     ⚠️ 这条断言跑在 indexCode（剥掉注释）上 —— 我的注释里正好写着「不能再无条件
        `.concat(uploadedNodes)`」，不剥就会把**注释**当成代码判红（本文件第一版的真实失败）。 */
  const tailStart = indexCode.indexOf('const uploadedIds = uploadedNodes.map');
  assert.ok(tailStart > 0, '要能定位到收尾段');
  const tail = indexCode.slice(tailStart, tailStart + 2600);
  assert.match(tail, /placeholderIds\.has\(node\.id\)/, '必须识别出「这个 id 已经在画布上」');
  assert.match(tail, /byId\.get\(node\.id\)/, '命中占位的要按 id 就地替换');
  assert.doesNotMatch(tail, /\.concat\(uploadedNodes\)/,
    '**不许**再无条件 concat(uploadedNodes) —— 那会把占位节点变成两份');
  assert.match(tail, /URL\.revokeObjectURL/, 'blob URL 必须回收（每个几十 MB，漏了就是内存泄漏）');
  /* 全文件层面：真正的 `.concat(uploadedNodes)` 一处都不该剩 */
  assert.doesNotMatch(indexCode, /\.concat\(uploadedNodes\)/,
    '全文件都不许再有 concat(uploadedNodes)（会与占位节点重复）');
});

test('⑤ 占位节点 id 必须沿用最终节点的命名规则，否则对不上', () => {
  assert.match(flow, /id: `\$\{kind\}_upload_\$\{uploadStartedAt\}_\$\{index\}`/,
    '占位节点 id 必须与 createUploadedVideoNodes / 音频节点的命名规则一致');
  const model = read('src/pages/EcCanvas/canvasStudioModel.js');
  assert.match(model, /id: `video_upload_\$\{now\}_\$\{index\}`/,
    '视频节点命名规则（占位节点要与之逐字一致）');
});