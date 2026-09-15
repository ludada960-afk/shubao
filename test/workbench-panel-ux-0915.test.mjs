// test/workbench-panel-ux-0915.test.mjs
// 2026-09-15 用户对电商工作台六个面板的批注 —— 逐条落成契约。
// ─────────────────────────────────────────────────────────────────────────────
// 每条都写明「用户原话 → 根因 → 判据」，避免下一个人只看到断言不知道为什么。
// ─────────────────────────────────────────────────────────────────────────────
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

import { stripComments } from '../scripts/lib/token-scope.mjs';

/* ⚠️ 一律**先剥注释**再断言（复用 scripts/lib/token-scope.mjs 的同一份实现）。
   本文件第一条契约初版就栽在这上面：解释根因的注释里写了旧写法 `brandLocked && pickerOpen`，
   于是「不得再出现该写法」的断言被自己的注释顶红 —— 与 legacy-token-family、
   nano-model-single-source 是同一条教训：**注释是知识，不是用法**；
   门禁若把注释算进去，就是在惩罚「把来龙去脉写清楚」这件事。 */
const readRaw = rel => readFileSync(new URL('../' + rel, import.meta.url), 'utf8');
const read = rel => stripComments(readRaw(rel));
const GEN = 'src/pages/Home/ec/GenSettingsPanel.jsx';

test('① 点色块必须能打开取色器（未锁定状态下也要能开）', () => {
  const panel = read(GEN);
  /* 用户原话（图1-②）：「我点击左边这个色盘的这个按钮，我点击之后它是没有弹出那个真正的
     色盘调整的那个部分。他现在好像是卡住的一个状态。」
     根因：色块按钮把 pickerOpen 置 true，但取色器的渲染条件是 `brandLocked && pickerOpen`，
     而默认状态是**未锁定**（原则 6.3）→ 点了什么都不渲染，观感就是「卡住」。
     判据：取色器是否渲染只看 pickerOpen，不得再被 brandLocked 门控。 */
  assert.match(panel, /onClick=\{\(\) => setPickerOpen\(open => !open\)\}/, '色块点击切换 pickerOpen');
  assert.match(panel, /\{pickerOpen && \(/, '取色器只由 pickerOpen 决定是否渲染');
  assert.ok(!/brandLocked && pickerOpen/.test(panel),
    '取色器不得再被 brandLocked 门控 —— 否则未锁定时点开无任何反应（这就是用户报的 bug）');
  /* 检测器自证：旧写法必须能被上一条判据抓到。 */
  assert.ok(/brandLocked && pickerOpen/.test('{brandLocked && pickerOpen && ('),
    '自证：旧写法确实能被该判据命中，否则这条断言等于没写');
});
/* ═══ 图2 / 图3：套图方案面板（SizingPanel）═══ */
const SIZING = 'src/pages/Home/ec/SizingPanel.jsx';
const PLAN_MODEL = 'src/pages/Home/ec/ecommercePlanModel.js';

test('② 调「数量 / 尺寸」不得把整行取消选中（事件冒泡）', () => {
  const panel = read(SIZING);
  /* 用户原话（图3-①）：「我现在只要调整它们就会直接被取消选中，你这也是一个 bug。
     我觉得可能是你这个紫框现在是完全盖住了整个的选项，可是实际上这个数量和面板它是可以被
     点击被调整的，这个逻辑你可能没有把它想进去。」
     根因：整行 onClick=toggleType（为了让整行 ≥48px 可点），而行内的数量框/比例选择器
     是**行内部**的可交互元素 —— 事件冒泡到行上，于是「调数量」被当成「点这一行」。
     判据：行内交互区必须截断 click 与 keydown（在数字框里按空格同样会冒泡）。 */
  assert.match(panel, /onClick=\{event => event\.stopPropagation\(\)\}/,
    '行内交互区必须截断 click，否则调数量会被理解成切换选中');
  assert.match(panel, /onKeyDown=\{event => event\.stopPropagation\(\)\}/,
    '键盘事件同样要截断（数字框内按空格/回车会冒泡到行的 onKeyDown）');
  /* 自证：这组判据抓得住「只有整行 onClick」的旧写法。 */
  const legacy = 'onClick={() => toggleType(typeDef.key)}';
  assert.ok(!/stopPropagation/.test(legacy), '自证：旧写法确实不含 stopPropagation');
});

test('③ 图片类型行的间距要够，相邻选中环不得贴成一条', () => {
  const panel = read(SIZING);
  /* 用户原话（图2-①）：「这 5 个类型，它们是边框这些紫色的边框已经完全重叠了。挤在一起了。
     我觉得你可以稍微留一些间距给他们吧。」
     根因：行距 sp1(4px) + 1.5px 边框 + ring 阴影 → 相邻两行都选中时两个环在视觉上相贴。 */
  assert.match(panel, /flexDirection: 'column', gap: SPACING\.sp2/, '行距必须 ≥ sp2(8px)');
  assert.ok(!/flexDirection: 'column', gap: SPACING\.sp1/.test(panel), '不得退回 sp1(4px)');
});

test('④ 面板内不得再重复渲染「当前方案」摘要（与底部按钮同一信息两处渲染）', () => {
  const panel = read(SIZING);
  /* 用户原话（图2-②）：「这个部分我觉得可以不要……因为实际上你这里调整了什么东西，
     下面的那个面板按钮它是会跟着显示跟着调整的。你没有必要在这个地方还写一套这个字，
     在这里是重复的功能。」 */
  assert.ok(!/当前方案：/.test(panel), '面板里不得再出现「当前方案：」摘要（底部按钮已实时显示）');
  assert.ok(!/planSummary/.test(panel), 'planSummary 已成死代码，不得再引用');
});

test('⑤ 图片类型图标必须是项目图标族里的语义图标，不得再用 emoji', () => {
  const model = readRaw(PLAN_MODEL);
  const panel = read(SIZING);
  /* 用户原话（图3-③）：「现在这 5 个图标他们都有点太老土了……完全就是那种很简单的那种
     demo 版的东西，我需要你……做一些相应的或者找一些相应的图标去给它换上。」
     实测原实现是 emoji（⬜🖼️📱🔲📋）—— 形状/配色随系统字体变，且自带占位感。 */
  assert.ok(!/\p{Extended_Pictographic}/u.test(read(PLAN_MODEL)),
     '图片类型定义里不得再出现 emoji（其形状与配色不可控，观感像占位）');
  assert.match(model, /iconKey:/, '图标改为语义键，由渲染层从项目图标族取');
  assert.match(panel, /from 'lucide-react'/, '渲染层必须用项目既有的 lucide 图标族');
  assert.ok(!/typeDef\.icon\b/.test(panel), '不得再直接渲染 emoji 字段');
});

test('⑥ 勾选框与图标徽章必须有大小差（状态 vs 这是什么）', () => {
  const panel = read(SIZING);
  /* 用户原话（图3-③）：「首先就是你这个打钩的框，它怎么跟你的图标是一样大的呀？
     我实在是不明白。你这样从视觉上看起来，他就又没有主次之分了呀。」 */
  const badge = /width: 28, height: 28/.test(panel);
  const box = /width: 18, height: 18/.test(panel);
  assert.ok(badge, '行图标徽章应为 28×28');
  assert.ok(box, '勾选框应为 18×18');
  assert.ok(badge && box, '两者必须不同尺寸，否则又回到「一样大 = 没有主次」');
});

test('⑦ 主次阶梯：控件值必须比字段标签更重（字号更大）', () => {
  const ladder = read('src/pages/Home/ec/panelVisualLanguage.js');
  const panel = read(SIZING);
  /* 用户原话（图3-②）：「这 8 个字跟下面的选项框的字好像是一样大的，对吧？你为什么要这样
     去设计呢？这样搞得就真的没有任何主次之分了。」
     实测根因：标签 12px/600，控件值 11px/600 —— **标签比值还大**，两者同级。 */
  assert.match(ladder, /value: Object\.freeze\(\{ size: (\d+)/, '阶梯里必须有 value 档');
  assert.match(ladder, /fieldLabel: Object\.freeze\(\{ size: (\d+)/, '阶梯里必须有 fieldLabel 档');
  const valueSize = Number(/value: Object\.freeze\(\{ size: (\d+)/.exec(ladder)[1]);
  const labelSize = Number(/fieldLabel: Object\.freeze\(\{ size: (\d+)/.exec(ladder)[1]);
  assert.ok(valueSize > labelSize,
    '控件值字号(' + valueSize + ') 必须大于字段标签(' + labelSize + ')，否则没有主次');
  assert.match(panel, /textRoleStyle\('value'\)/, '套图方案的下拉值必须走 value 档');
  assert.match(panel, /textRoleStyle\('fieldLabel'\)/, '套图方案的字段标签必须走 fieldLabel 档');
});