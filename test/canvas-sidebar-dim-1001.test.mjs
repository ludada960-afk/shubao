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

test('② 压暗规则必须同时命中侧栏与那颗按钮', () => {
  const css = code(CSS);
  const rule = /html\[data-cvl-dialog-open\][^{]*\{[^}]*\}/.exec(css);
  assert.ok(rule, 'app-sidebar.css 里必须有这条压暗规则');
  for (const selector of ['.app-sidebar', '.task-sidebar']) {
    assert.ok(rule[0].includes(selector), `压暗规则必须覆盖 ${selector}`);
  }
  assert.match(rule[0], /opacity:\s*\.\d+/, '必须是「暗下去」而不是只藏起来');
  assert.match(rule[0], /pointer-events:\s*none/,
    '压暗的东西不该还能点 —— 否则等于穿透到弹窗后面去');
});

test('③ 检测器自证：删掉属性或删掉规则，都必须判红', () => {
  const noAttr = code(CANVAS).replace(/setAttribute\('data-cvl-dialog-open', 'true'\)/, "setAttribute('data-gone', 'true')");
  assert.doesNotMatch(noAttr, /setAttribute\('data-cvl-dialog-open', 'true'\)/, '变异 A：改属性名后 ① 必须红');
  const noRule = code(CSS).replace(/html\[data-cvl-dialog-open\][^{]*\{[^}]*\}/, '');
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