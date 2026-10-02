// test/canvas-upload-local-size-1002.test.mjs
// 2026-10-02：上传前必须**本地探真实尺寸**，建框要用它。
// ─────────────────────────────────────────────────────────────────────────────
// 用户原话：「素材的尺寸要跟你的框是同等适配的……这些你自己要想明白。」
//
// 改之前的真实情况（读代码读出来的，不是猜的）：
//   `canvasStudioModel.js` 的 `createUploadedVideoNodes` 里 `const width = 320` 写死，
//   `aspectRatio` 只从 `asset.width/height` 取 —— 而那是**上传完成后服务器才有的信息**。
//   ⇒ 9:16 的竖屏片子先躺进 320×180 的 16:9 框，再由 `<video onLoadedMetadata>` 校正，
//     **用户看得见框跳一下**。原注释自己写了「拿不到的部分交给 onLoadedMetadata 事后校正」。
//
// 而本地就能拿到：`URL.createObjectURL(file)` + `<video preload="metadata">` 读
// `videoWidth/videoHeight/duration`，毫秒级、不走服务器。
// ─────────────────────────────────────────────────────────────────────────────
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { probeLocalMediaSize } from '../src/pages/EcCanvas/canvasUploadPrepare.js';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const index = read('src/pages/EcCanvas/index.jsx');
const prepare = read('src/pages/EcCanvas/canvasUploadPrepare.js');
const model = read('src/pages/EcCanvas/canvasStudioModel.js');

test('① 探测只读 metadata，不抽帧（上传路径不需要那三张图）', () => {
  assert.match(prepare, /preload = 'metadata'/, '必须 preload=metadata（只读元信息，不拉流）');
  assert.doesNotMatch(prepare, /getContext\('2d'|toBlob|frameTimes/,
    '上传路径不抽帧 —— 抽帧是 VideoStudio 那个模块的事，带过来会白拖慢上传');
  assert.match(prepare, /videoWidth/, '必须读 videoWidth');
  assert.match(prepare, /videoHeight/, '必须读 videoHeight');
  assert.match(prepare, /createImageBitmap/, '图片优先走 createImageBitmap');
});

test('② 探测失败绝不能挡住上传（尺寸是锦上添花，传不上去才是硬伤）', () => {
  assert.match(prepare, /catch \{[\s\S]{0,120}?return null/, '探测必须兜住异常并返回 null');
  assert.match(prepare, /return null;?\s*\}\s*\n?\s*export async function probeLocalMediaSize|probeLocalMediaSize[\s\S]{0,400}return null/,
    '非图片/视频（如音频）必须返回 null 而不是抛');
  /* 真跑一次：给一个根本不是媒体的东西，必须安静地 null */
  return probeLocalMediaSize({ type: 'text/plain', size: 1 }).then(r => {
    assert.equal(r, null, '不支持的类型 ⇒ null，不抛');
  });
});

test('③ 上传路径真的接上了探测，且尺寸会进到建节点所读的字段', () => {
  assert.match(index, /import \{ probeLocalMediaSizes \} from '\.\/canvasUploadPrepare\.js'/,
    'index.jsx 必须 import 探测');
  assert.ok((index.match(/probeLocalMediaSizes\(/g) || []).length >= 2,
    '至少两条上传路径要接（单视频上传 + 拖拽/「上传素材」的混传路径）');
  /* 关键：探测结果要**摊在 asset 上**，因为 createUploadedVideoNodes 读的就是 asset.width/height */
  assert.match(index, /\.\.\.\(probed\w*\[\w+\] \|\| \{\}\)/,
    '探测结果必须摊进 asset 对象（...probed），否则 createUploadedVideoNodes 读不到');
});

test('④ 建框那一侧确实会用 asset 的真实宽高（否则探测白探）', () => {
  /* createUploadedVideoNodes 用 mediaRatioFor({ ratio, width, height }) 取比例 */
  assert.match(model, /mediaRatioFor\(\{ ratio: asset\.aspectRatio, width: asset\.width, height: asset\.height \}\)/,
    '建节点必须按 asset 的真实 width/height 取比例');
  assert.match(model, /h: Math\.round\(width \/ ratioValue\(aspectRatio, 16 \/ 9\)\)/,
    '框高必须按取到的比例算，而不是固定 16:9');
  /* ⚠️ 反向：width 写死 320 本身不是错（那是画布上的显示宽度），
     错的是**比例**拿不到时直接落回 16:9 —— 现在探测能在上传前就填上真实宽高。 */
  assert.match(model, /上传时就用能拿到的尺寸/, '注释要留着"上传时就用能拿到的尺寸"这个约定');
});