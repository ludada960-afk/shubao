// test/canvas-visible-viewport-0929.test.mjs
// 小地图视窗框的取数口径 —— 纯函数语义 + 接线方式（批 CY-㉚ 建立 / 批 CY-㊴ 重写）
// ─────────────────────────────────────────────────────────────────────────────
// 用户 2026-09-30 逐字（图4-②）：
//   「当前我们用户能够看到的所有内容，它都应该成为这个视窗……
//     可是你这个视窗里却是一个被截断的状态。」
//
// 批 CY-㉚ 当初按「clientWidth 是完整布局宽，要减掉右侧面板的 margin-right」
// 写了 `readCanvasVisibleViewport`，本门禁当时逐条把这个**错误假设**断言成了「正确行为」
// （第①条的标题就是「必须扣掉 marginRight」）。批 CY-㊴ 实机复核发现那是错的，本文件整体重写。
//
// 两个缺陷（各自都能单独让视窗框错，必须一起修；详见 canvasVisibleViewport.js 顶部）：
//   ① margin 按定义在 border box 之外，而 flex / width:auto 的布局**已经**把 border box
//      缩成「父宽 − margin」⇒ 再减一遍就是减了两次（实测 1124 − 476 = 648，真值 1124）。
//   ② 调用点在组件体里直接调用 = **render 期间读 DOM** ⇒ 量到上一次提交的布局
//      （实测：面板开着时框仍按 1600 算；关掉面板那一帧反而按 648 算）。
//
// ⚠️ 本文件里 ① 的判据**故意**与旧版相反。旧版第①条断言"必须扣 margin"，
//   那条断言本身就是这次线上事故的来源之一，别手滑改回去。
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { readCanvasVisibleViewport } from '../src/pages/EcCanvas/canvasVisibleViewport.js';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const index = read('src/pages/EcCanvas/index.jsx');
const source = read('src/pages/EcCanvas/canvasVisibleViewport.js');
const css = read('src/pages/EcCanvas/EcCanvas.css');

/* ⚠️ 断言前一律先剥掉块注释 —— 否则本文件顶部那份事故记录里出现的
   `marginRight` / `readCanvasVisibleViewport` 字样会把自己顶红。
   （本仓已因此假红过两次，见 precommit-check.mjs 里 workbench-panel-ux 的注记。） */
const stripBlockComments = text => text.replace(/\/\*[\s\S]*?\*\//g, '');

/* 假元素：只给 clientWidth/clientHeight，rect 由测试注入 —— 与真实 DOM 的取值口径一致 */
const el = (w, h) => ({ clientWidth: w, clientHeight: h });
const rectOf = (w, h) => () => ({ width: w, height: h });

test('① 右栏打开：宽度就是 border box 宽，**不得再减 margin**（1124 就是真值）', () => {
  /* 实测（1600×1000 窗口、右栏开）：stage 真实可见宽 1124、clientWidth 也是 1124、
     而它自己的 margin-right 是 476 —— 因为 stage 是 flex 子项，margin 参与 flex 分配，
     浏览器早就为它让好了位。1124 + 476 = 1600 才是整行。
     ⇒ 减法得到 648，比真值少 42%，视窗框被画窄（用户说的「被截断」）。 */
  const got = readCanvasVisibleViewport(el(1124, 892), undefined, rectOf(1124, 892));
  assert.equal(got.width, 1124, '看得见的宽就是 1124，不多不少');
  assert.equal(got.height, 892, '垂直方向同理：量到多少就是多少');
});

test('② 右栏关闭：宽度就是整行宽', () => {
  const got = readCanvasVisibleViewport(el(1600, 892), undefined, rectOf(1600, 892));
  assert.deepEqual(got, { width: 1600, height: 892 });
});

test('③ 关键性质：框宽必须**跟着**可见画布宽一起变，且比例一致', () => {
  /* 两个状态都合法（面板开画布确实变窄了），框**应该**变 ——
     但必须按同一个比例变。这条与"框变没变"无关，只看比例，
     所以世界窗大小、画布缩放、小地图尺寸全都不影响它。 */
  const open = readCanvasVisibleViewport(el(1124, 892), undefined, rectOf(1124, 892));
  const closed = readCanvasVisibleViewport(el(1600, 892), undefined, rectOf(1600, 892));
  assert.ok(open.width < closed.width, '面板开着时可见宽确实更小');
  assert.ok(
    Math.abs(open.width / closed.width - 1124 / 1600) < 1e-9,
    '比例必须等于 1124/1600（实测 ' + (open.width / closed.width).toFixed(4) + '）',
  );
  /* 反证：减去 margin 会得到 648/1600 = 0.405，与 0.7025 差 42% */
  assert.ok(open.width / closed.width > 0.6, '不得退回到"再减一次 margin"那个 0.405');
});

test('④ margin 无论多大都不参与计算（这是本次事故的核心，不是四边都要扣）', () => {
  /* 旧版第④条叫「四边 margin 都要扣」，并断言 1000−10−20=970。**那条判据是错的**：
     margin 不在 border box 里，扣它等于凭空少一块。
     这里反过来钉：哪怕某天有人给舞台加了 9999px 的 margin，可见宽也不许变。 */
  const withHugeMargin = { clientWidth: 1000, clientHeight: 800 };
  const got = readCanvasVisibleViewport(withHugeMargin, undefined, rectOf(1000, 800));
  assert.deepEqual(got, { width: 1000, height: 800 },
    '函数不得读 getComputedStyle / margin（源码里出现就是错）');
  const code = stripBlockComments(source);
  assert.doesNotMatch(code, /margin(Left|Right|Top|Bottom)/,
    '本函数不再解析任何 margin —— 出现即回归批 CY-㉚ 那个错误假设');
  assert.doesNotMatch(code, /getComputedStyle/,
    '本函数不再读计算样式：border box 已经包含了"看得见"的全部信息');
});

test('⑤ 拿不到有效值时兜底，绝不能返回 0（0 会让视窗框整个消失）', () => {
  assert.deepEqual(
    readCanvasVisibleViewport(null, { width: 1440, height: 900 }),
    { width: 1440, height: 900 },
    '没有容器时用兜底',
  );
  assert.deepEqual(
    readCanvasVisibleViewport(el(0, 0), { width: 1440, height: 900 }, rectOf(0, 0)),
    { width: 1440, height: 900 },
    '尺寸为 0 时也要兜底',
  );
  assert.deepEqual(
    readCanvasVisibleViewport(el(0, 0), { width: 1440, height: 900 }),
    { width: 1440, height: 900 },
    '连 getBoundingClientRect 都没有的元素也要兜底，不许抛',
  );
});

test('⑥ 测量必须发生在**提交之后**，且实现不许留在画布页里', () => {
  /* 组件体里出现 `const xxx = readCanvasVisibleViewport(containerRef.current, …)`
     就意味着每次 render 都去量 DOM —— 而 render 期间 DOM 还没提交本次的 class，
     量到的是上一帧的舞台。实测后果：面板开着时框按 1600 算，关掉那一帧反而按 648 算。 */
  const page = stripBlockComments(index);
  assert.doesNotMatch(page, /readCanvasVisibleViewport\(/,
    '画布页不得直接调用取数函数 —— 那必然是在 render 期量布局（缺陷②）');
  assert.match(page, /useCanvasVisibleViewport\(containerRef\)/,
    '画布页必须通过 hook 消费可见尺寸');
  assert.match(page, /viewportSize=\{canvasVisibleViewportSize\}/,
    'CanvasMinimap 必须收到可见视口尺寸');

  /* hook 的实现体（提交后测量 + 盯住容器尺寸变化）必须有真接线，不能只是一句承诺 */
  const hookSource = stripBlockComments(source);
  const hook = hookSource.match(/export function useCanvasVisibleViewport\([\s\S]*?\n\}/);
  assert.ok(hook, 'canvasVisibleViewport.js 必须导出 useCanvasVisibleViewport');
  assert.match(hook[0], /useLayoutEffect\(/, '必须在 useLayoutEffect 里量（提交后、绘制前）');
  assert.match(hook[0], /readCanvasVisibleViewport\(/, '且 effect 里真的调用了取数函数');
  assert.match(hook[0], /new ResizeObserver\(/,
    '必须订阅容器尺寸 —— 右栏开关与窗口缩放都只改容器尺寸、不改 state，依赖数组盯不到');
  assert.match(hook[0], /\.observe\(/, 'ResizeObserver 必须真的 observe 那个容器');
  assert.match(hook[0], /disconnect\(\)/, '且必须在 cleanup 里断开（否则每次挂载泄漏一个观察者）');
  assert.match(hook[0], /useMemo\([\s\S]*?\[\s*\],/,
    '兜底尺寸必须 memo 住，否则每次渲染都是新对象、effect 会跟着重跑');

  /* 实现放在本模块而不是画布页，是有理由的：`test/canvas-port-geometry` 与
     `test/ec-canvas-state` 各有一条断言禁止 index.jsx 出现 ResizeObserver
     （守的是"端口/连线几何不许来自 DOM 实测"）。这两条与本批无冲突 ——
     画布页一处 DOM 实测都没有，它们与本批的意图同时成立。 */
  assert.doesNotMatch(page, /ResizeObserver/,
    '画布页不应再出现 ResizeObserver：视口取数已搬进 canvasVisibleViewport.js 的 hook');
});

test('⑦ 前提守护：舞台若被改成显式 width，"margin 不参与"这条推理就不再成立', () => {
  /* 本函数不減 margin 的前提是「布局已经为 margin 让好了位」，而这只在
     flex 子项 / width:auto 的块级元素上成立。若有人给 `.ec-canvas-stage`
     写了显式 width（或把它从 flex 流里拿出来），border box 就不再收缩，
     右侧溢出的部分才是真被裁掉的 —— 那时必须**显式**处理，不许把减法悄悄加回来。
     守的就是这个前提：显式 width 一出现，这里必须先变红，提醒人重新推导。 */
  const stageRules = [...css.matchAll(/\.ec-canvas-stage\s*\{([^}]*)\}/g)].map(m => m[1]);
  assert.ok(stageRules.length, '.ec-canvas-stage 规则必须存在');
  for (const body of stageRules) {
    assert.doesNotMatch(body, /(?:^|;)\s*width\s*:/,
      '.ec-canvas-stage 出现了显式 width —— "border box 已含让位"的前提失效，'
      + '请重新推导并在 canvasVisibleViewport.js 里显式说明，不要靠减 margin 蒙混');
  }
  /* 让位量仍然由 CSS 的 margin 承担（这条没变），别有人为了"省事"改成 padding/width */
  assert.match(css, /\.ec-canvas-stage\.has-right-panel\s*\{[^}]*margin-right\s*:/,
    '右栏让位仍然是 stage 自己的 margin-right（布局据此收缩 border box）');
});

test('⑧ 小地图节点标记必须带 data-canvas-node-id（实机判据靠它对齐，不靠顺序猜）', () => {
  /* 实机门禁要逐个核对「看得见的节点都落在视窗框内」，
     而小地图标记与画布节点是**两个不同的元素**，只有 id 能把它们配对。 */
  const panel = read('src/pages/EcCanvas/components/CanvasContextMenuPanel.jsx');
  assert.match(panel, /className="ec-canvas-minimap-node"[\s\S]{0,400}?data-canvas-node-id=\{node\.id\}/,
    '.ec-canvas-minimap-node 必须带 data-canvas-node-id');
});
