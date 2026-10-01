// test/canvas-media-fit-0929.test.mjs
// 2026-09-29 批 CY-⑭。用户在画布上指出的第 1 组问题：
//
//   「用户上传上来或者生成之后的素材，不管它是图片还是视频，你自己的这个框必须去适配它的内容呀。
//     ……它上下是有白色部分的，而且我也不确定你这张图左右两边有没有被截断的内容。
//     这就是因为你自己没有主动的去把这个框去适配它导致的呀。」
//   「你再看这张生成的图片，很明显它是被截断了。他有一部分内容是被你这个框给盖掉了。」
//
// 判据分两层：
//   ① **纯函数层**：素材真实比例怎么取、节点框怎么按它算（可直接断言，不碰 DOM）；
//   ② **接线层**：那条"量到真实尺寸就改写节点"的通路**每一处都真的接上了**
//      —— 这一层才是本批的核心，因为事故恰恰是"函数写好了、props 传了、组件签名里根本没有"。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  exactMediaRatio,
  mediaRatioFor,
  ratioValue,
  createUploadedImageNodes,
  createUploadedVideoNodes,
} from '../src/pages/EcCanvas/canvasStudioModel.js';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const canvasPage = read('src/pages/EcCanvas/index.jsx');
const studio = read('src/pages/EcCanvas/components/CanvasStudio.jsx');
const stripComments = src => src.replace(/\/\*[\s\S]*?\*\//g, '');

/* ═══ ① 纯函数层 ═══════════════════════════════════════════════════════════════ */

test('已知尺寸必须给**精确**比例，不再从 5 个预设里"挑一个最像的"', () => {
  /* 用户原话是"没有主动去适配"；事故的第一层是 `closestRatio` 把一个已知的 3:2
     硬塞成 '4:3'，框按 4:3 画、图按 contain 塞进去 ⇒ 上下/左右出现白边。 */
  assert.equal(exactMediaRatio(1200, 800), '3:2', '3:2 不能再变成 4:3');
  assert.equal(exactMediaRatio(800, 1200), '2:3');
  assert.equal(exactMediaRatio(1200, 1600), '3:4');
  assert.equal(exactMediaRatio(1600, 1200), '4:3');
  assert.equal(exactMediaRatio(1024, 768), '4:3');
  assert.equal(exactMediaRatio(1080, 1920), '9:16');
  assert.equal(exactMediaRatio(100, 100), '1:1');
});

test('量不到尺寸时才允许退到近似档（不是"永远近似"）', () => {
  assert.equal(exactMediaRatio(0, 0), '');
  assert.equal(exactMediaRatio(undefined, undefined), '');
  assert.equal(exactMediaRatio(-3, 10), '');
  /* 约分后仍然太长（不适合当标签）→ 退回近似 */
  assert.equal(exactMediaRatio(997, 991), '', '质数大尺寸退回近似档');
  assert.equal(mediaRatioFor({ width: 997, height: 991 }), '1:1', '退回的那一档来自 5 档预设表');
});

test('显式声明的 ratio 优先于量出来的尺寸', () => {
  assert.equal(mediaRatioFor({ ratio: '16:9', width: 1200, height: 800 }), '16:9');
  assert.equal(mediaRatioFor({ width: 1200, height: 800 }), '3:2');
  assert.equal(mediaRatioFor({}), '1:1');
});

test('上传的图片节点按素材真实比例建框', () => {
  const [node] = createUploadedImageNodes({
    assets: [{ url: 'https://x/a.png', width: 1200, height: 800, name: 'A' }],
    x: 0, y: 0, now: 1,
  });
  assert.equal(node.ratio, '3:2');
  assert.equal(node.h, Math.round(node.w / (3 / 2)), '框高必须由真实比例算出来');
  assert.equal(node.size, '1200×800');
});

test('上传的视频节点同样按真实比例建框（以前 videoWidth 从来没人量过）', () => {
  const [node] = createUploadedVideoNodes({
    assets: [{ url: 'https://x/a.mp4', id: 'v1', width: 1080, height: 1920, name: 'V' }],
    x: 0, y: 0, now: 1,
  });
  assert.equal(node.aspectRatio, '9:16');
  assert.equal(node.h, Math.round(node.w / (9 / 16)));
});

test('ratioValue 能解析真实比例（拖角锁定靠的就是它）', () => {
  assert.equal(ratioValue('3:2'), 1.5);
  assert.equal(ratioValue('9:16'), 9 / 16);
  assert.equal(ratioValue('自适应', 1), 1, '认不出的值走 fallback（所以发请求前必须先解掉，见另一条门禁）');
});

/* ═══ ② 接线层：这一层才是本批的核心 ═══════════════════════════════════════════ */

test('量到真实尺寸的通路**每一处都接上了**（事故：函数写了、props 传了、签名里没有）', () => {
  const page = stripComments(canvasPage);
  const code = stripComments(studio);

  /* (a) handler 存在，且只改**媒体节点**（不碰文案板/套图框这些版式对象） */
  assert.match(page, /const handleMediaNaturalSize = useCallback/, '必须有一个统一处理真实尺寸的 handler');
  assert.match(page, /const MEDIA_FIT_KINDS = new Set\(\[[^\]]*'image'[^\]]*'output'[^\]]*'video'/,
    '媒体节点白名单必须含 image / output / video');
  assert.ok(!/MEDIA_FIT_KINDS = new Set\(\[[^\]]*'text-composer'/.test(page),
    '文案板是版式对象，不许被素材比例改写（用户排好的版面会被推倒）');
  assert.ok(!/MEDIA_FIT_KINDS = new Set\(\[[^\]]*'suite-composer'/.test(page),
    '套图框同理');

  /* (b) 渲染图片/生成结果的那一支必须真的把 handler 传下去。
     ⚠️ 这正是 2026-08-13 那次断链的位置：它只传给了 layer-group，而 image/output
     （= 上传 + 生成的图片，**用户真正会用到的那一类**）压根没传。 */
  const imageBranch = page.slice(page.indexOf("if (node.kind === 'image' || node.kind === 'output')"));
  assert.ok(imageBranch.length, '找得到 image/output 渲染分支');
  assert.match(imageBranch.slice(0, 2000), /onNaturalSize=\{handleMediaNaturalSize\}/,
    '图片 / 生成结果节点必须接上 onNaturalSize —— 断链的正是这一处');

  /* (c) CanvasGenerationNode 必须在**签名里**声明并往下传 */
  /* 2026-10-01（批 CY-㊴ 之十八）：节点组件改名成 *View 并以 memo 导出，
     所以签名判据要跟着改名字 —— 守的仍然是"签名里必须声明 onNaturalSize"这件事。 */
  assert.match(code, /function CanvasGenerationNodeView\(\{[\s\S]*?onNaturalSize = null/, 'CanvasGenerationNode 签名必须声明 onNaturalSize');
  assert.match(code, /onLoadedMetadata=\{event => \{[\s\S]*?videoWidth[\s\S]*?onNaturalSize\?\./,
    '视频必须用 onLoadedMetadata 的 videoWidth/videoHeight 走同一条通路');

  /* (d) CanvasImageNode 一直在发这个事件，链路两头都要在 */
  assert.match(code, /function CanvasImageNodeView\(\{[\s\S]*?onNaturalSize,/, 'CanvasImageNode 必须保留 onNaturalSize 形参');
  assert.match(code, /onNaturalSize\?\.\(node\.id, \{ naturalWidth, naturalHeight \}\)/,
    '图片 onLoad 必须把真实尺寸发出去');
});

test('真实比例优先于"节点自己声明的比例"，且高度按比例重算（保留用户已拖的宽度）', () => {
  const page = stripComments(canvasPage);
  const handler = page.slice(page.indexOf('const handleMediaNaturalSize'), page.indexOf('const handleImageNaturalSize ='));
  assert.match(handler, /const width = Math\.max\(1, Number\(node\.w\)/, '宽度必须沿用用户已经拖出来的值');
  /* 批 CY-⑲：这里原来是裸的 `Math.round(width * measuredHeight / measuredWidth)`，
     一张 9:16 长图按 240 宽推出来是 427px，会把下面一整排节点顶没。
     改走 canvasMediaFrameHeight（同一公式 + 上限），见 canvas-media-fit-no-overlap-0929。 */
  assert.match(handler, /const height = canvasMediaFrameHeight\(width, measuredWidth, measuredHeight\);/, '高度按真实比例重算，且走带上限的公式');
  assert.match(handler, /ratio: exact/, 'ratio 必须被改写成真实比例');
  assert.match(handler, /naturalWidth: measuredWidth,/, '真实尺寸要落库（右侧面板与拖角锁定都读它）');
  assert.match(handler, /size: `\$\{measuredWidth\}×\$\{measuredHeight\}`/, '像素尺寸要显示在节点页脚');
});
