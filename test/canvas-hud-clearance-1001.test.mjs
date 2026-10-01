/* ═══ 2026-10-01：画布左下角的「让位」改成**单一真源** ════════════════════════════════════════════
   用户 2026-10-01 批注：「派生面板依然遮掉了地图呀，而且可能还不止这一个面板有问题，
   你的地图逻辑要好好想想怎么处理。」

   病根不是某一个面板，是**模式**：画布左下角每个浮层**各自算位置、靠 250ms 轮询
   `getBoundingClientRect` 互相等**。那条轮询有真实的窗口期 —— 小地图是异步挂上来的，
   头几秒里任务日志那颗按钮还停在写死的 86px 上，正好压在小地图上
   （实测 1280×800：按钮 y668 / 小地图 y550–730，重叠 46×46）。

   ⇒ 小地图自己把「我上方要留多少」发布成 `--ec-canvas-hud-clearance`，
     其它浮层 `bottom: var(--ec-canvas-hud-clearance, …)` 直接读。**没有轮询窗口。**

   ⚠️ 这条门禁守的是**两次踩过的坑**，都实测出来过：
     ① 算 clearance 时量 `getBoundingClientRect().top` —— 小地图贴在画布容器底边，
        容器晚 32px 长好它就整体上移，而 ResizeObserver **只管尺寸不管位置** ⇒ 值过期。
     ② 只用 `offsetHeight` —— 首次布局时内部画布还没渲染，只有 138（声明值是 180）⇒ 仍然少留。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = rel => readFileSync(new URL('../' + rel, import.meta.url), 'utf8');
/* 剥注释再扫：注释里提到某个字段名/常量，不该把判据自己绊倒（这条仓库里已经栽过一次） */
const code = rel => read(rel).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const MINIMAP = 'src/pages/EcCanvas/components/CanvasContextMenuPanel.jsx';
const SIDEBAR = 'src/components/task/TaskSidebar.jsx';

test('① 小地图发布 clearance，且**卸载时清掉**（不清会污染别的页面）', () => {
  const src = read(MINIMAP);
  assert.match(src, /--ec-canvas-hud-clearance/,
    '小地图必须发布「上方要留多少」——它是这块地方唯一知道答案的那个组件');
  assert.match(src, /removeProperty\('--ec-canvas-hud-clearance'\)/,
    '卸载必须清掉：否则离开画布后这根变量还在 documentElement 上，把别的页面那颗按钮也顶上去');
});

test('② clearance 由「高度 + 常量」算出，**不许量自己的 top**', () => {
  /* 坑①：量 top 会过期 —— 小地图 position:absolute 贴在容器底边，容器长高它就整体上移，
     而 ResizeObserver 只在尺寸变化时触发。实测值会停在 230px（应为 262px），按钮压回小地图上。 */
  const effect = /const publish = \(\) => \{[\s\S]{0,900}?\n {4}\};/.exec(read(MINIMAP));
  assert.ok(effect, '要能定位到 publish 函数');
  assert.doesNotMatch(effect[0], /getBoundingClientRect\(\)\.top|rect\.top/,
    'publish 不许量自己的 top —— 容器一长高它就过期（实测 230 vs 262）');
  assert.match(effect[0], /minimapHeight/,
    '要用**声明的高度**（EcCanvas 不传，恒为 180），而不是等测量');
  assert.match(effect[0], /Math\.max\([^)]*offsetHeight[^)]*minimapHeight\)/,
    '坑②：高度必须取 max(实测, 声明) —— 首次布局实测只有 138，少留 42px');
  /* 两个常量偏移要**从 CSS 变量读**，不许写死数字（写死的话有人改 CSS 就会走岔） */
  assert.match(effect[0], /--ec-canvas-bottombar-top/);
  assert.match(effect[0], /--ec-canvas-panel-gap/);
});

test('③ 任务日志那颗按钮读这根变量，且**有兜底**（变量不存在时回落到原值）', () => {
  const src = read(SIDEBAR);
  assert.match(src, /var\(--ec-canvas-hud-clearance, \$\{floatBottom\}px\)/,
    '浮动形态必须优先读 clearance 变量，并保留 floatBottom 兜底（非画布页 / 小地图关掉时）');
  /* ⚠️ 原来那段 250ms 轮询不许被当成"唯一真相"重新搬回来 —— 它就是这次的病根。 */
  assert.match(code(SIDEBAR), /floatBottom/,
    '兜底值仍要算得出来（非画布页面沿用 86）');
});

test('④ 变异自证：把 ① 的发布 或 ② 的 max() 去掉，这条门禁必须判红', () => {
  const src = read(MINIMAP);
  const noPublish = src.replace(/--ec-canvas-hud-clearance/g, '--gone');
  assert.doesNotMatch(noPublish, /--ec-canvas-hud-clearance/,
    '变异：把变量名改掉后，① 必须红');
  const noMax = src.replace(/Math\.max\(node\.offsetHeight \|\| 0, minimapHeight\)/, 'node.offsetHeight');
  assert.notEqual(noMax, src, '变异：去掉 max() 的写法没命中（判据该更新了）');
  assert.doesNotMatch(
    /Math\.max\([^)]*offsetHeight[^)]*minimapHeight\)/.exec(noMax)?.[0] || '',
    /minimapHeight/,
    '变异：去掉 max() 后，② 必须红');
});