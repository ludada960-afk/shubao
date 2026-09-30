/* ═══ 2026-09-29 批 DC 续-18：**滚轮一滚，浮层就关**（全局口径，用户实测知渔后定的）══════════════════
   用户逐字：
   > 「他们好像全局都是把这种按钮张开面板的时候，如果用户去滚动鼠标滚轮的话，**面板就会自动关闭**。
   >   我们现在的情况是不管首页的两个板块，还是各种子页面，还是画布里面？所有的地方我们的面板逻辑
   >   跟他们都不一样。现在我们滚动我们的滚轮的话，这个面板只要是张开的状态，**它会跟着滚动**，
   >   这其实可能会造成很多的 bug。我觉得还不如就照他那种做法……
   >   **你全局都要去实现这个方案。**」

   浮层总数 **56 个**（`.tmp/overlay-inventory.md`），其中 ~28 是一次性实现。
   本门禁守的是**机制**与**已接的面**，不是"全部 56 个都接完了"——
   后者还没做到（见下面 ④），写成"必须全绿"只会让判据永远红、等于把它废掉。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = rel => readFileSync(new URL('../' + rel, import.meta.url), 'utf8');
const code = rel => read(rel).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

test('① 只有一个全局监听（不是每处一份）', () => {
  const bus = code('src/components/media/useDismissOverlay.js');
  /* 三条"用户动页面了"的信号都收：主动滚轮 / 代码滚动 / 视口变化 */
  assert.match(bus, /addEventListener\('wheel', dismiss, \{ capture: true/,
    '要收 wheel，且用 capture（左栏、面板内部都是独立滚动容器，冒泡阶段收不到）');
  assert.match(bus, /addEventListener\('scroll', dismiss, \{ capture: true/, '也要兜住 scroll');
  assert.match(bus, /addEventListener\('resize', dismiss/, '视口变了也要收');
  /* 幂等：多处调用只装一个 */
  assert.match(bus, /if \(installed \|\| typeof document === 'undefined'\) return;/,
    '安装必须幂等（56 个浮层都会用到，装 56 次就成了 56 个监听）');
  /* 面板内部的滚动不许关自己 */
  assert.match(bus, /OVERLAY_ROOT_ATTR/, '要有一个"浮层根"标记，供内部滚动豁免用');
  assert.match(bus, /composedPath\(\)/, '豁免判据必须用事件路径（那个节点在不在浮层里）');
  /* onClose 走 ref 转发，调用方不必把它塞进依赖数组 */
  assert.match(bus, /const latest = useRef\(onClose\)/, 'onClose 要走 ref 转发，否则每次渲染都退订重订');
});

test('② 已经接上的三处：子页面 / 首页 / 画布（EcMode）', () => {
  /* 子页面（生图模型 · 画面规格）*/
  const sub = code('src/components/media/ConfigTriggers.jsx');
  assert.match(sub, /useDismissOverlay\(Boolean\(open\), \(\) => setOpen\(null\)\)/, '子页面面板要接');
  assert.match(sub, /\[OVERLAY_ROOT_ATTR\]/, '子页面面板要标浮层根（面板内部滚动不关自己）');
  assert.doesNotMatch(sub, /addEventListener\('scroll'/,
    '子页面面板**不许再跟着滚** —— 那一行就是"面板跟着滚动"的全部来源');

  /* 首页两个板块 */
  const home = code('src/pages/Home/VisualCreationMode.jsx');
  assert.match(home, /useDismissOverlay\(Boolean\(activeConfigPanel\), \(\) => setActiveConfigPanel\(null\)\)/, '首页面板要接');
  assert.match(home, /id="visual-floating-panel"[\s\S]{0,200}?data-overlay-root="true"/, '首页面板要标浮层根');
  assert.doesNotMatch(home, /addEventListener\('scroll', repositionConfigPanel/,
    '首页面板**不许再跟着滚**');

  /* 画布 / 电商模式 */
  const ec = code('src/pages/Home/EcMode.jsx');
  assert.match(ec, /useDismissOverlay\(Boolean\(activePanel\), \(\) => setActivePanel\(null\)\)/, '画布那块面板要接');
  assert.match(ec, /id="ec-floating-panel"[\s\S]{0,240}?data-overlay-root="true"/, '画布面板要标浮层根');
});

test('③ `usePanelScrollLock` 的"把滚轮喂给面板"已经删掉（那正是要改掉的行为）', () => {
  const lock = code('src/components/ui/usePanelScrollLock.js');
  assert.doesNotMatch(lock, /addEventListener\('wheel'/, '不许再自己监听 wheel（全局总线已经有一份）');
  assert.doesNotMatch(lock, /preventDefault/, '不许再 preventDefault 滚轮');
  assert.doesNotMatch(lock, /scrollTop \+= delta/, '**这条就是"面板跟着滚"的全部来源**，必须删');
  /* 但页面锁要留着：面板开着时底下别跟着滚。 */
  assert.match(lock, /acquirePageScrollLock\(\)/, '页面滚动锁要保留（面板开着时底下别跟着滚）');
  /* 签名保持不变 ⇒ 两处调用点不用动 */
  assert.match(lock, /export function usePanelScrollLock\(open, \{ panelSelector = DEFAULT_PANEL_SELECTOR \}/,
    '导出签名不能变（EcMode.jsx:538 与 VisualCreationMode.jsx:403 两处调用点靠它兼容）');
});

test('④ 渲染按钮的字段**不许包 <label>**（用户点名的"点空地就张开面板"那一族）', () => {
  const fr = code('src/components/media/FieldRenderer.jsx');
  /* 判据是"这一格有没有一个可关联的表单控件"，不是逐个 kind 列举 ——
     逐个列举过一次（只列了 segmented/choice/cards/multi），结果漏了 config/stepper/counts/slot。 */
  assert.match(fr, /const hasOwnControl = kind === 'select'[\s\S]{0,160}?kind === 'upload';/,
    '要按"有没有自己的表单控件"来判定');
  assert.match(fr, /const Wrapper = hasOwnControl \? 'label' : 'div';/,
    '渲染按钮的 kind 一律 <div>（<label> 的隐式关联控件是第一个 labelable 后代，而 <button> 就是）');
  assert.match(fr, /role: 'group'/, '改用 <div> 时要补 role="group"（语义不丢）');
  assert.match(fr, /const labelId = hasOwnControl \? undefined :/,
    '走 <div> 的那几格也要有可访问名（labelId 要按实际 Wrapper 算，不是按 isOptionGroup）');
  /* config 就是这次点名的那个（生图模型 / 画面规格）——
     ⚠️ `ConfigTriggers` 出现在 80+ 行之后（中间有注释与逻辑），所以窗口放宽。 */
  assert.match(fr, /if \(kind === 'config'\)[\s\S]{0,1200}?<ConfigTriggers/,
    '生成设置那一格走 ConfigTriggers（两颗按钮）—— 它正是被点名的那个');
});
