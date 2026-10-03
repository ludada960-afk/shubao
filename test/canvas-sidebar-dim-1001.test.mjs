// 门禁：画布弹窗打开时，左侧导航与「生成过程」那颗按钮必须被压暗（用户 2026-10-01 批注）
//
// 用户原话：
//   「而且你这个生成过程的这个按钮为什么会跟他**在同一层**呢。这个按钮不是应该暗下去吗？」
//
// 真因是**两套层级表根本不可比**：
//   · 画布弹窗走画布自己的表（canvasVisualLanguage.js）：modalScrim 70 / modal 71；
//   · 「生成过程」按钮走应用外壳的表（TaskSidebar.jsx）：`--sb-z-panel` = 40000000。
// 40000000 > 71 ⇒ 按钮永远浮在画布弹窗之上，遮罩盖不到它。
// 而且画布原有的 `.is-dialog-open` 规则够不着它 —— TaskSidebar 是 createPortal 挂到
// 侧栏底部插槽里的，在 `.ec-canvas-page` 之外。
//
// ⇒ 由 EcCanvas 把「有弹窗」复制到 <html data-cvl-dialog-open>，CSS 统一压暗。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = rel => readFileSync(join(ROOT, rel), 'utf8');
const code = rel => read(rel).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const CANVAS = 'src/pages/EcCanvas/index.jsx';
const CSS = 'src/styles/app-sidebar.css';

test('① 画布弹窗打开时必须把状态写到根节点（选择在 .ec-canvas-page 之外才管得到 portal）', () => {
  const src = code(CANVAS);
  assert.match(src, /setAttribute\('data-cvl-dialog-open', 'true'\)/,
    '必须写到 documentElement 上 —— TaskSidebar 是 portal 出去的，在 .ec-canvas-page 之外');
  assert.match(src, /removeAttribute\('data-cvl-dialog-open'\)/,
    '关闭时必须清掉，否则离开画布后侧栏会一直暗着');
  assert.match(src, /\}, \[dialogOpen\]\)/,
    '必须依赖 dialogOpen（canvasHudHidden 的结果），不能是一次性的');
});

test('② 画布左下角那颗任务按钮必须**隐藏**，不是压暗（2026-10-03 用户第三次说清）', () => {
  const css = code(CSS);
  /* 用户原话：「如果是隐藏起来的话，那这个按钮也应该是隐藏起来啊，
     我说的暗下去，指的是不该在前台展示啊…并且颜色不该是暗下去，改回来」

     ⇒ 之前把"暗下去"做成 `opacity:.45` 是**理解错了**。
       画布 HUD 那一档（小地图/缩放条/左栏/底部工具栏）用的就是 display:none，
       「其他是隐藏了，那这个也要隐藏」。
       压暗还留着两个毛病：仍在前台（z-index 4e7 压住遮罩）、仍可点。 */
  const hideRule = /html\[data-cvl-dialog-open\][^{]*\.task-sidebar[^{]*\{[^}]*\}/.exec(css);
  assert.ok(hideRule, '必须有针对 .task-sidebar 的规则');
  assert.match(hideRule[0], /display:\s*none/,
    '任务按钮必须是**隐藏**（display:none）—— 与画布 HUD 同一待遇，不是压暗');
  assert.doesNotMatch(hideRule[0], /opacity/,
    '不许再压暗：它仍会浮在遮罩上面，而且还要额外补 pointer-events');

  /* 全站侧栏（不属于画布）保持压暗 —— 那是导航，不是画布 HUD */
  const dimRule = /html\[data-cvl-dialog-open\]\s*\.app-sidebar\s*\{[^}]*\}/.exec(css);
  assert.ok(dimRule, '全局侧栏仍走压暗');
  assert.match(dimRule[0], /opacity:\s*\.\d+/);
  assert.match(dimRule[0], /pointer-events:\s*none/);
});

test('③ 检测器自证：删掉属性或删掉规则，都必须判红', () => {
  const noAttr = code(CANVAS).replace(/setAttribute\('data-cvl-dialog-open', 'true'\)/, "setAttribute('data-gone', 'true')");
  assert.doesNotMatch(noAttr, /setAttribute\('data-cvl-dialog-open', 'true'\)/, '变异 A：改属性名后 ① 必须红');
  /* ⚠️ 2026-10-03：规则现在有**两条**（全局侧栏压暗 + 任务按钮隐藏），
     所以变异必须**全部**删掉（g 标志）；只删第一条会让第二条还在 ⇒ 判不出红，
     等于这个自证已经失效了。 */
  const noRule = code(CSS).replace(/html\[data-cvl-dialog-open\][^{]*\{[^}]*\}/g, '');
  assert.doesNotMatch(noRule, /html\[data-cvl-dialog-open\]/, '变异 B：删掉规则后 ② 必须红');
});

test('④ 图层入口必须离开底部 dock、落到左下角缩放条里', () => {
  /* 用户原话：「你这个图层为什么点击之后会弹到上面去呀？……你还不如把它放到左下角的那个栏里面。」 */
  const chrome = read('src/pages/EcCanvas/components/CanvasChrome.jsx');
  const bottom = /export function CanvasBottomToolbar\([\s\S]*?\n\}/.exec(chrome);
  assert.ok(bottom, '要能定位到 CanvasBottomToolbar');
  assert.doesNotMatch(bottom[0], /'layers'/,
    '底部 dock 里不许再有「图层」—— 面板会落到画面中间');
  assert.doesNotMatch(bottom[0], /onLayers|layersOpen/,
    '图层相关的 props 也不该再挂在底部 dock 上');

  const canvas = code(CANVAS);
  assert.match(canvas, /trailing=\{<>[\s\S]{0,900}?aria-label="图层"/,
    '「图层」按钮必须挂进 CanvasZoomControls 的 trailing 槽（左下角那个栏）');
  /* 面板锚点必须跟着那颗按钮，不能还指着已经不存在的底部 dock 按钮 */
  assert.match(canvas, /\.ec-canvas-zoom-controls button\[aria-label\*="图层"\]/,
    '图层面板的锚点必须量左下角那颗新按钮，否则它会按旧位置定位');
});