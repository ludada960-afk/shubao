// test/canvas-drop-and-asset-import-0930.test.mjs
// 批 CY-㊴（用户 2026-09-30）：桌面拖入 + 资产库导入不得重置画布 + 去掉废话提示
// ─────────────────────────────────────────────────────────────────────────────
// 用户逐字：
//   「首先是图片为什么不能从外面直接拖到画布里面呢？如果用户他想从桌面或者从其他本地的
//     地方拖一张图片进来，为什么是拖不了的呢？视频也是呀。」
//   「当我画布里面有其他素材的时候，为什么我点击加号里面的上传资产库的素材，然后选中某
//     一个素材添加到画布里面的时候，它会直接重置整个画布，然后把这个素材放进来……
//     它应该是上传到当前这个画布里面来呀。」
//   「而且你这句提示也不太好呀，不会产生生成或者扣费，这一句是废话，你要把它去掉。」
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const index = read('src/pages/EcCanvas/index.jsx');
const css = read('src/pages/EcCanvas/EcCanvas.css');
const code = index.replace(/\/\*[\s\S]*?\*\//g, '');

test('① 画布必须能接住从桌面拖进来的文件（图片/视频/音频）', () => {
  /* 事故：stage 上只有 pointer 事件，没有 onDragOver/onDrop ——
     而且**没有** onDragOver 的 preventDefault 时浏览器根本不会派发 drop，
     这就是"拖了没反应"的直接原因。 */
  assert.match(code, /onDragOver=\{handleCanvasDragOver\}/);
  assert.match(code, /onDrop=\{handleCanvasDrop\}/);
  assert.match(code, /onDragLeave=\{handleCanvasDragLeave\}/);
  const dragOver = code.match(/const handleCanvasDragOver = useCallback\([\s\S]{0,700}?\}, \[\]\);/);
  assert.ok(dragOver, '找不到 onDragOver 的实现');
  assert.match(dragOver[0], /preventDefault\(\)/, '必须 preventDefault，否则浏览器不派发 drop');
  assert.match(dragOver[0], /dropEffect = 'copy'/, '光标要显示为"复制"');
  /* 窗口要够大：非贪婪 + 太短的窗口会在 asEvent 那个箭头函数的 `});` 处提前收尾，
     把真正的三条分发调用切在外面（第一版就是这么自己把自己判红的）。 */
  const drop = code.match(/const handleCanvasDrop = useCallback\([\s\S]*?\}, \[uploadCanvasMaterials\]\);/);
  assert.ok(drop, '找不到 onDrop 的实现');
  assert.match(drop[0], /dataTransfer\?\.files/, '必须读 dataTransfer.files');
  assert.match(drop[0], /mediaReplaceTargetRef\.current = null/, '拖入一律是新增，绝不能接管"替换素材"上下文');

  /* ⚠️ 2026-10-02：三条「按 MIME 分发 + 复用既有上传链路」的判据**跟着搬了位置**。
     用户批注要求底部那颗按钮也走同一套分发（一个入口收图/视/音），
     于是这段逻辑被从 `handleCanvasDrop` 里**提出来**成了共用的 `uploadCanvasMaterials` ——
     拖拽与那颗按钮现在走**同一个函数**，否则两条入口迟早走岔（批 DC 续-36 那个教训）。
     判据的**意图一个字没变**（仍要求：按三类分流、且复用既有处理函数），
     只是断言的对象从 drag handler 换成了那个共用函数。 */
  const dispatch = code.match(/const uploadCanvasMaterials = useCallback\([\s\S]*?\}, \[handleCanvasAudioUpload[\s\S]{0,200}?\]\);/);
  assert.ok(dispatch, '找不到共用的按类型分发函数 uploadCanvasMaterials');
  for (const kind of ['image/', 'video/', 'audio/']) {
    assert.ok(dispatch[0].includes("startsWith('" + kind + "')"), '必须按 ' + kind + ' 分类（用户原话：视频也是呀）');
  }
  /* 复用既有上传链路，而不是重写一套 —— 少一套上传逻辑就少一处行为漂移 */
  assert.match(dispatch[0], /handleCanvasSourceUpload\(asEvent\(images\)\)/, '图片必须走既有的上传处理函数');
  assert.match(dispatch[0], /handleCanvasVideoUpload\(asEvent\(videos\)\)/, '视频必须走既有的上传处理函数');
  assert.match(dispatch[0], /handleCanvasAudioUpload\(asEvent\(audios\)\)/, '音频必须走既有的上传处理函数');
  assert.match(drop[0], /await uploadCanvasMaterials\(dropped\)/, '拖拽必须走那个共用函数（不许再自己分发一遍）');
  assert.match(css, /\.ec-canvas-stage\.is-drop-active/, '拖入时要有可见反馈');
});

test('② 从资产库导入素材**不得**重置当前画布', () => {
  /* 根因不是 createFreshCanvasSession，是导入路径顺手写了 nextResult._saveKey ——
     画布重建 effect 的依赖是 [result.id, result._saveKey, state.creationLaunch]，
     一变就重跑 createFreshCanvasSession，而 resultMediaAssets 里只有刚导入的那一个，
     于是整张画布被重建成「空画布 + 这一个」。
     画布内三条上传路径都不写这一行，所以它们只追加不重置。 */
  assert.doesNotMatch(code, /_saveKey: result\._saveKey \|\| canvasGeneratedWorkKeyRef\.current/,
    '导入路径不得再写 _saveKey（那正是重置整张画布的开关）');
  /* 反证：重建 effect 的依赖里确实还有 _saveKey —— 说明这条判据盯着的是真的那个开关 */
  assert.match(code, /result\.id, result\._saveKey, state\.creationLaunch/,
    '重建 effect 的依赖仍然包含 _saveKey（本条门禁守的就是别去动它）');
  /* projectId / sourceVersionId 仍要带，否则导入的素材存不进云端作品 */
  assert.match(code, /projectId: projectContext\.projectId, sourceVersionId: projectContext\.baseVersionId/);
});

test('③ 导入素材的提示里不许再出现「不会产生生成或扣费」', () => {
  assert.doesNotMatch(code, /不会产生生成或扣费/, '用户原话：「这一句是废话，你要把它去掉」');
  assert.match(code, /项目素材已加入画布/, '但"已经加进画布"这个事实仍要说清楚');
});

test('④ handleComposerSourceUpload 里不得再引用未定义的标识符', () => {
  /* 事故：按下标取三类节点的数组，而那三个名字在本函数作用域里从未声明
     （其中一个是另一个上传函数里的局部变量）⇒ 触发即 ReferenceError，
     又被同一个 try 的 catch 吞成一句「参考图读取失败」，把崩溃说成了读取问题。 */
  const fn = code.match(/const handleComposerSourceUpload = useCallback\([\s\S]*?\n  \}, \[/);
  assert.ok(fn, '找不到 handleComposerSourceUpload');
  assert.doesNotMatch(fn[0], /\[imageNodes\[index\]|\[videoNodes\[index\]|\[audioNodes\[index\]/,
    '不得按下标取那些从未声明的数组');
  assert.match(fn[0], /nodeIdOf\(asset\)/, '改成按 assetId 查节点（按下标对齐本来也不成立）');
});
