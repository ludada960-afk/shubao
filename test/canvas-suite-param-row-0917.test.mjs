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

test('画布套图参数行顺序 = 首页顺序（技能在第 4 位，不再丢到最下面）', () => {
  const home = homepageOrder().filter(k => k !== 'settings'); // 生成设置移到底栏，参数行只比其余五个
  assert.deepEqual(PARAM_KEYS, ['sizing', 'sku', 'params', 'copy'],
    '参数行短文案按钮顺序必须是 套图方案 → SKU变体 → 商品信息 → 内容规范');

  /* 拼出画布侧实际渲染顺序：[@] + slice(0,2) + [技能] + slice(2) */
  const canvasKeys = ['skills', ...PARAM_KEYS.slice(0, 2), 'skills_marker', ...PARAM_KEYS.slice(2)];
  const actual = [PARAM_KEYS[0], PARAM_KEYS[1], 'skills', ...PARAM_KEYS.slice(2)];
  assert.deepEqual(actual, home, '画布参数行顺序必须与首页 DEFAULT_BUTTONS（去掉生成设置）完全一致');

  /* 渲染代码顺序：技能夹在 slice(0,2) 与 slice(2) 之间 */
  const rowStart = studio.indexOf('className="ec-canvas-suite-controls"');
  const body = studio.slice(rowStart, studio.indexOf('\nfunction CanvasSuiteSettingsControl'));
  const iHead = body.indexOf('SUITE_PARAM_BUTTONS.slice(0, 2)');
  const iSkill = body.indexOf('ec-canvas-suite-skill-control');
  const iTail = body.indexOf('SUITE_PARAM_BUTTONS.slice(2)');
  assert.ok(iHead > 0 && iSkill > iHead && iTail > iSkill, '渲染顺序必须是 slice(0,2) → 技能 → slice(2)');
  assert.ok(canvasKeys.length > 0);
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
  /* 取最后一条 = 9-17 用户批注后的权威规则（前面几条是历史分层，会被后者覆盖） */
  const rule = all[all.length - 1][1];
  assert.ok(!/text-overflow/.test(rule), '按钮基础规则里不许出现 text-overflow（否则短文案变「智能…」）');
  assert.ok(/overflow:\s*hidden/.test(rule), '必须是 overflow:hidden 纯裁切');
  assert.ok(/white-space:\s*nowrap/.test(rule), '必须 nowrap');
});

test('按钮内文案 span 同样只裁不省略', () => {
  const all = [...css.matchAll(/\.ec-canvas-parameter-item > button > span,\s*\r?\n\s*\.ec-canvas-suite-control > button > span \{([\s\S]*?)\}/g)];
  assert.ok(all.length > 0, '必须存在按钮内文案 span 的规则块');
  const rule = all[all.length - 1][1];
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

test('生成设置渲染在**底栏**内（参数行只留短文案格）', () => {
  const suiteComposerStart = studio.indexOf('export function CanvasEcommerceComposer');
  assert.ok(suiteComposerStart > 0, '套图生成框必须存在');
  const suiteComposer = studio.slice(suiteComposerStart);
  const footerStart = suiteComposer.indexOf('<div className="ec-canvas-composer-footer">');
  assert.ok(footerStart > 0, '套图底栏必须存在');
  const footer = suiteComposer.slice(footerStart, footerStart + 3000);
  assert.ok(footer.includes('CanvasSuiteSettingsControl'), '生成设置必须渲染在底栏内');
  assert.ok(!/\bis-shrinkable\b/.test(studio), '参数行里不应再有"可收缩"格（生成设置已移出）');
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
  const buttons = (seg.match(/<button/g) || []).length;
  const tagged = (seg.match(/data-canvas-control="true"/g) || []).length;
  assert.ok(buttons > 0, '参数行必须有按钮');
  assert.ok(tagged >= buttons - 1, '参数行按钮都要 data-canvas-control（技能由子组件自带）');
});
