// test/canvas-suite-param-row-0917.test.mjs
// 2026-09-17 用户批注（第 1 项 + 第 2 项），两条都是**按钮文案与排版**的口径：
//
// ① 不要用省略号
//   「你这些按钮上面的文案为什么都要用省略号呀？都用省略号的话基本就没多少文案能被看到。
//    你这些按钮每个也就四个字，四个字也有必要用省略号吗？完全可以展示全呀。
//    像模型那一块字有点多，你就字往后面去挤，显示不全也没关系，但真的不要用省略号。
//    你看视频生成那个就没有用省略号，它那个方式是对的。」
//   → 规则：短文案（≤4 字）**必须完整显示**；长文案（模型名）允许被按钮右缘**纯裁切**
//     （overflow:hidden），**绝不出现 text-overflow: ellipsis / 「…」**。
//
// ② @ 键放最前 + 排版照抄首页
//   「这个艾特键也一样，做到最前面去，做到那个智能…的前面。而且你这个排版也不太对呀：
//    你首页那边电商生成的那个排版是什么样的？你就按他那个排版去排这些按钮才对呀。
//    你现在为什么把模型放到最后了呢？然后把技能又放到最下面来呢？
//    …一定要有一个统一性：这个地方改了，那个地方也得跟着改呀。」
//   → 规则：@ 引用在参数行最前；四个生成框同一顺序，且与首页 EcMode DEFAULT_BUTTONS 同序。
//
// 真源 = src/pages/Home/EcMode.jsx 的 DEFAULT_BUTTONS（本测试直接读它，不硬编码"我以为是"的顺序）。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const studio = read('src/pages/EcCanvas/components/CanvasStudio.jsx');
const css = read('src/pages/EcCanvas/EcCanvas.css');
const ecMode = read('src/pages/Home/EcMode.jsx');

/* ── 首页权威顺序：从 DEFAULT_BUTTONS 里按声明顺序抽 key ── */
function homepageOrder() {
  const start = ecMode.indexOf('const DEFAULT_BUTTONS = [');
  assert.ok(start > 0, '必须能在 EcMode.jsx 里读到 DEFAULT_BUTTONS');
  const block = ecMode.slice(start, ecMode.indexOf('\n  ];', start));
  return [...block.matchAll(/key:\s*'([a-z]+)'/g)].map(m => m[1]);
}

/* 组件里参数行的渲染顺序：@ → slice(0,2) → 技能 → slice(2) */
const PARAM_KEYS = (() => {
  const start = studio.indexOf('const SUITE_PARAM_BUTTONS = Object.freeze([');
  assert.ok(start > 0, '必须有 SUITE_PARAM_BUTTONS（参数行的短文案按钮）');
  const block = studio.slice(start, studio.indexOf(']);', start));
  return [...block.matchAll(/key:\s*'([a-z]+)'/g)].map(m => m[1]);
})();

test('首页 DEFAULT_BUTTONS 权威顺序：生成设置 → 套图方案 → SKU变体 → 技能库 → 商品信息 → 内容规范', () => {
  assert.deepEqual(homepageOrder(), ['settings', 'sizing', 'sku', 'skills', 'params', 'copy']);
});

test('画布套图参数行顺序 = 首页顺序（技能在第 4 位；商品信息/内容规范已按用户口径拿掉）', () => {
  /* ═══ 2026-09-27 批 CU：这是**用户改向**，不是把断言放宽 ══════════════════════════════════════
     用户原话（逐字）：「像这个**商品信息**AI规划这些按钮现在其实都是**失效的状态**。我点击了是没有反应的，
     那我觉得这些东西**可以不要了，你就直接拿掉吧**。然后**模型的选择和生成配置的那些按钮，
     你看是不是应该拿上来呢**？」
     事实（`.qa/cu-suite-diag5.mjs`，DOM 级 click 逐颗点、绕开层叠）：商品信息 / 内容规范(AI规划) 两颗
     点了 is-active 会翻转、**但没有任何 popover** —— 根因是按钮渲染在 `.slice(2)` 那一支、
     而面板 JSX 只写在 `.slice(0,2)` 那一支（那一支的 `item.key` 永远命中不了 params/copy）。
     也就是说这两颗**从来没接上过**；用户已明确要求拿掉，并把「生成设置」从底栏拿到参数行。
     ⇒ 参数行 = 套图方案 → 商品规格 → 技能 → 生成设置。 */
  const home = homepageOrder().filter(k => !['settings', 'params', 'copy'].includes(k));
  assert.deepEqual(PARAM_KEYS, ['sizing', 'sku'],
    '参数行短文案按钮只剩 套图方案 → 商品规格（商品信息/内容规范按用户口径拿掉）');

  /* 拼出画布侧实际渲染顺序：[@] + slice(0,2) + [技能] + [生成设置(参数行内)] */
  const actual = [PARAM_KEYS[0], PARAM_KEYS[1], 'skills'];
  assert.deepEqual(actual, home, '画布参数行顺序必须与首页 DEFAULT_BUTTONS（去掉生成设置/商品信息/内容规范）一致');

  /* 渲染代码顺序：技能在 slice(0,2) 之后，生成设置在技能之后（都在参数行内） */
  const rowStart = studio.indexOf('className="ec-canvas-suite-controls"');
  const body = studio.slice(rowStart, studio.indexOf('\nfunction CanvasSuiteSettingsControl'));
  const iHead = body.indexOf('SUITE_PARAM_BUTTONS.slice(0, 2)');
  const iSkill = body.indexOf('ec-canvas-suite-skill-control');
  const iSettings = body.indexOf('ec-canvas-suite-settings-in-row');
  assert.ok(iHead > 0 && iSkill > iHead, '渲染顺序必须是 slice(0,2) → 技能');
  assert.ok(iSettings > iSkill, '生成设置必须在参数行里、排在技能之后（用户：「你看是不是应该拿上来呢？」）');
});

test('@ 键在参数行**最前**（在第一个参数按钮之前）', () => {
  const rowStart = studio.indexOf('className="ec-canvas-suite-controls"');
  const body = studio.slice(rowStart, studio.indexOf('\nfunction CanvasSuiteSettingsControl'));
  const iMention = body.indexOf('ec-canvas-suite-mention');
  const iFirstParam = body.indexOf('SUITE_PARAM_BUTTONS.slice(0, 2)');
  assert.ok(iMention > 0, '参数行必须有 @ 引用格');
  assert.ok(iMention < iFirstParam, '@ 引用必须排在第一个参数按钮之前');
  assert.ok(body.includes('<ComposerMention'), '@ 引用复用与其它三个框同一个 ComposerMention');
});

test('四个生成框都复用同一个 ComposerMention（不各写一套 @ 键）', () => {
  const count = (studio.match(/<ComposerMention/g) || []).length;
  assert.equal(count, 4, '图片/文案/视频/套图四个框各一个 ComposerMention，实际 ' + count);
});

/* ── 文案规则：只有"模型名"这一格允许被裁，且一律不许省略号 ── */

test('参数/套图按钮基础规则：只 overflow:hidden 纯裁切，绝无 text-overflow', () => {
  const all = [...css.matchAll(/\.ec-canvas-parameter-item > button,\s*\r?\n\s*\.ec-canvas-suite-control > button \{([\s\S]*?)\}/g)];
  assert.ok(all.length > 0, '必须存在参数/套图按钮的基础规则块');
  /* 同名选择器会拆成多条规则，浏览器把声明**并起来**生效 → 断言看并集 */
  const rule = all.map(m => m[1]).join('\n');
  assert.ok(!/text-overflow/.test(rule), '按钮基础规则里不许出现 text-overflow（否则短文案变「智能…」）');
  assert.ok(/overflow:\s*hidden/.test(rule), '必须是 overflow:hidden 纯裁切');
  assert.ok(/white-space:\s*nowrap/.test(rule), '必须 nowrap');
});

test('按钮内文案 span 同样只裁不省略', () => {
  const all = [...css.matchAll(/\.ec-canvas-parameter-item > button > span,\s*\r?\n\s*\.ec-canvas-suite-control > button > span \{([\s\S]*?)\}/g)];
  assert.ok(all.length > 0, '必须存在按钮内文案 span 的规则块');
  const rule = all.map(m => m[1]).join('\n');
  assert.ok(!/text-overflow/.test(rule), 'span 上不许出现 text-overflow');
  assert.ok(/overflow:\s*hidden/.test(rule), 'span 必须 overflow:hidden');
});

test('生成设置（模型·清晰度）格：允许被右缘纯裁切，同样不省略', () => {
  const start = css.indexOf('.ec-canvas-suite-settings-control > button {');
  assert.ok(start > 0, '必须有 .ec-canvas-suite-settings-control > button 规则');
  const rule = css.slice(start, css.indexOf('\n}', start));
  assert.ok(/overflow:\s*hidden/.test(rule), '模型格必须 overflow:hidden');
  assert.ok(!/text-overflow:\s*ellipsis/.test(rule), '模型格不许用省略号（用户：显示不全没关系，但不要省略号）');
  const spanStart = css.indexOf('.ec-canvas-suite-settings-control > button > span {');
  assert.ok(spanStart > 0, '模型格内文案 span 必须有规则');
  const spanRule = css.slice(spanStart, css.indexOf('}', spanStart));
  assert.ok(!/text-overflow:\s*ellipsis/.test(spanRule), '模型格文案不许省略号');
});

test('生成设置（模型·清晰度）渲染在**参数行**内（用户改向：从底栏拿上来）', () => {
  /* ═══ 2026-09-27 批 CU：**用户改向** ══════════════════════════════════════════════════════════
     用户原话（逐字）：「然后**模型的选择和生成配置的那些按钮，你看是不是应该拿上来呢**？」
     原来它渲染在底栏（`ec-canvas-composer-footer`）—— 那是"参数行 6 格会裁内容规范"时的取舍；
     商品信息/内容规范按用户口径拿掉后，这一行空出来了，模型与生成配置回到参数行
     （与首页 DEFAULT_BUTTONS 里「生成设置」同位置）。 */
  const rowStart = studio.indexOf('className="ec-canvas-suite-controls"');
  assert.ok(rowStart > 0, '套图参数行必须存在');
  const row = studio.slice(rowStart, studio.indexOf('\nfunction CanvasSuiteSettingsControl'));
  assert.ok(row.includes('CanvasSuiteSettingsControl'), '生成设置必须渲染在参数行内');
  const suiteComposerStart = studio.indexOf('export function CanvasEcommerceComposer');
  assert.ok(suiteComposerStart > 0, '套图生成框必须存在');
  const suiteComposer = studio.slice(suiteComposerStart);
  const footerStart = suiteComposer.indexOf('<div className="ec-canvas-composer-footer">');
  assert.ok(footerStart > 0, '套图底栏必须存在');
  const footer = suiteComposer.slice(footerStart, footerStart + 3000);
  assert.ok(!footer.includes('<CanvasSuiteSettingsControl'), '底栏不得再渲染生成设置（否则就是两处渲染）');
  assert.ok(!/\bis-shrinkable\b/.test(studio), '参数行里不应再有"可收缩"格');
});

test('参数行宽屏不换行（短文案格都拿得到内容宽度）', () => {
  const start = css.indexOf('.ec-canvas-suite-controls {', css.indexOf('ec-canvas-suite-control {'));
  assert.ok(start > 0, '必须有参数行规则');
  const rule = css.slice(start, css.indexOf('}', start));
  assert.ok(/flex-wrap:\s*nowrap/.test(rule) || css.includes('flex-wrap: nowrap'), '宽屏下参数行不换行');
});

/* ── 源文案核验 ── */
test('六个按钮文案与首页逐字一致，且短文案 ≤4 字', () => {
  for (const label of ['生成设置', '套图方案', 'SKU变体', '技能库', '商品信息', '内容规范']) {
    assert.ok(ecMode.includes(`label: '${label}'`), `首页必须有「${label}」`);
  }
  for (const label of ['套图方案', 'SKU变体', '商品信息', '内容规范']) {
    assert.ok(label.replace(/[A-Za-z]/g, '').length <= 4, label + ' 是短文案（≤4 字），必须完整显示');
  }
});

test('参数行按钮都带 data-canvas-control（画布手势不会误触）', () => {
  const start = studio.indexOf('function CanvasSuiteControls');
  const seg = studio.slice(start, studio.indexOf('\nfunction CanvasSuiteSettingsControl'));
  /* ═══ 2026-09-28 批 CY-⑬：这一行现在**一个裸 `<button>` 都不剩** ═══════════════════════════════════
     套图方案 / SKU变体 两格改走 <CanvasConfigTrigger>，技能走 <CanvasSkillControl>，
     两者都在自己的组件里带 data-canvas-control="true"（触发器那份见 CanvasConfigTrigger）。
     所以判据从"数这一段里有几个 <button>"改成：
       ① 这一段里出现的一律是共用触发器或子组件 —— 不许再自己写裸 <button>；
       ② 共用触发器自己必须带 data-canvas-control="true"。 */
  assert.equal((seg.match(/<button/g) || []).length, 0,
    '参数行不许再写裸 <button>（全部走共用触发器 / 子组件，标记才不会漏）');
  assert.ok((seg.match(/<CanvasConfigTrigger/g) || []).length > 0, '参数行必须有按钮（触发器）');
  const trigger = studio.slice(studio.indexOf('function CanvasConfigTrigger'));
  assert.ok(trigger.slice(0, 900).includes('data-canvas-control="true"'),
    '共用触发器必须自带 data-canvas-control（画布手势靠它识别控件）');
});
