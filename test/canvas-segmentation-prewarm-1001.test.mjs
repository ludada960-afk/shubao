// test/canvas-segmentation-prewarm-1001.test.mjs
// 2026-10-01 性能批之二。用户原话：「整个网站各个地方进行操作都会有延迟」。
//
// 这一条守的是**一个 18MB 的自动下载**：
// 画布挂载后约 1.8 秒无条件预热抠图模型 ⇒ 拉 ort-wasm-simd-threaded-*.wasm
// （13,479,978 字节）+ /models/u2netp-v1.onnx（4,574,861 字节）+ 对 4.5MB 算 SHA-256。
// 实测（Chromium 14 秒窗口）：画布一进去就传了 16,325 KB。
// 而**绝大多数人根本不会用抠图** —— 为一个可能一辈子不点的功能先赔 18MB。
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

/* ⚠️ 拿正则去匹源码前**必须先剥注释** —— 这次就栽在这上面：
   我在 index.jsx 里写了一段解释"原来怎么写的"的注释，里面正好含有
   `requestIdleCallback(prewarm` 这段原文，于是"不许再出现它"判成了
   **我自己的注释里有**。（同一个坑第三次：nginx 那次、这次、以及
   之前测 JSX 注释那次。判据读源码时，注释不是代码。） */
const stripComments = text => text
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/^[ \t]*\/\/.*$/gm, ' ');

const canvas = stripComments(read('src/pages/EcCanvas/index.jsx'));
const taskStore = stripComments(read('src/store/taskStore.jsx'));
const videoService = stripComments(read('src/services/video.js'));

test('① 抠图模型不许再"挂载即自动下载"，必须由用户意图触发', () => {
  /* 找出所有触发 prewarm 的地方，逐个看条件。 */
  const callSites = [...canvas.matchAll(/canvasSegmentationRuntime\.prewarm\(/g)];
  assert.ok(callSites.length >= 2, '至少应有两处 prewarm（意图触发 + 真正执行抠图）');

  /* ❌ 绝不许再出现"挂载后定时/空闲就预热"这种形状 */
  assert.doesNotMatch(canvas, /requestIdleCallback\(\s*prewarm/,
    '不许再用 requestIdleCallback 在空闲时预热 —— 空闲不等于会用抠图');
  assert.doesNotMatch(canvas, /setTimeout\(\s*prewarm/,
    '不许再在挂载后用 setTimeout 预热');

  /* 意图触发的那一处必须挂在 hoveredNodeId（用户把指针放到一张图上）上 */
  assert.match(canvas, /if \(!hoveredNodeId \|\| hoverIntentRef\.current\) return undefined;/,
    '预热必须由「指针第一次落到图上」触发');
  assert.match(canvas, /\}, \[hoveredNodeId, result\.browserQa\]\);/,
    '这个 effect 必须依赖 hoveredNodeId');

  /* saveData 用户依旧完全不下 */
  assert.match(canvas, /navigator\?\.connection\?\.saveData/,
    '必须尊重 saveData（省流量模式）');

  /* 卸载时要把预热停掉，否则"开一次画布就走"也是白下 18MB */
  assert.match(canvas, /segmentationPrewarmAbortRef\.current\?\.abort\(\)/,
    '离开画布必须中止预热');
});

test('② 意图触发的预热不许在指针移开时被 abort（那会让抠图永远冷启动）', () => {
  /* 这条是修一个**我自己刚引入**的 bug，记在这里免得再犯：
     effect 里 `return () => controller.abort()` 会在 hoveredNodeId 变化时
     （指针移开 → null）跑 cleanup；预热被打断，而 hoverIntentRef 已经是 true
     不会再触发 ⇒ 用户第一次抠图永远要冷启动 18MB。 */
  const effect = canvas.slice(
    canvas.indexOf('const hoverIntentRef = useRef(false);'),
    canvas.indexOf('}, [hoveredNodeId, result.browserQa]);'),
  );
  assert.doesNotMatch(effect, /return \(\) => controller\.abort\(\)/,
    '意图触发的 effect 不得返回 abort cleanup —— 指针移开会把它打断');
  assert.match(effect, /return undefined;/,
    '必须显式 return undefined 并把中止交给卸载时的 cleanup');
  /* 但中止本身必须存在于卸载路径里 */
  assert.match(canvas, /segmentationPrewarmAbortRef\.current\?\.abort\(\);\s*\n\s*segmentationPrewarmAbortRef\.current = null;/,
    '卸载路径必须 abort 预热并清空 ref');
});

test('③ 真正点「抠图」那条路径必须仍然自己预热（否则首次点击要多等 18MB）', () => {
  const action = canvas.slice(canvas.indexOf('createCanvasSegmentationPlan'));
  assert.match(action, /canvasSegmentationRuntime\.prewarm\(/,
    '执行抠图时必须自己调 prewarm（不能只靠"悬停预热"那一条）');
});

test('④ 没有活跃任务时，任务轮询不许再是 15 秒', () => {
  /* 15 秒一次、而且**永久**；每次 tick 都 dispatch 一个新数组
     ⇒ 触发所有订阅者重渲染。用户挂在页面上不动时这是纯浪费。 */
  assert.match(taskStore, /hasActiveTasks \? 3000 : 60000/,
    '无活跃任务时退到 60 秒一次（有任务时仍保持 3 秒）');
  assert.doesNotMatch(taskStore, /hasActiveTasks \? 3000 : 15000/,
    '15 秒轮询已经改掉了');
});

test('⑤ 能力配置（静态）必须缓存，不要每次上传都重拉', () => {
  assert.match(videoService, /CAPABILITIES_TTL_MS/,
    '必须有 TTL');
  assert.match(videoService, /if \(!force && fresh\) return capabilitiesCache;/,
    '命中新鲜缓存时必须直接返回，不发请求');
  assert.match(videoService, /capabilitiesCache = capabilities;/,
    '成功后要写缓存');
  /* 失败不写缓存：这样服务端改了配置，重试一次就能拿到新的 */
  assert.match(videoService, /const capabilities = await request\('\/api\/video\/capabilities'\);\s*\n\s*capabilitiesCache = capabilities;/,
    '只有请求成功才写缓存（失败时保持旧值，让下次重试能拿到新的）');
});
