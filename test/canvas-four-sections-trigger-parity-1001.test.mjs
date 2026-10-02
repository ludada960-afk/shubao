// test/canvas-four-sections-trigger-parity-1001.test.mjs
// 批 CY-㊴（2026-10-01）：画布里四个板块的模型/配置/技能触发器**同一套尺寸与字号**
// 用户原话：「画布里面的文案生成，图片生成，电商套图，视频生成这四个板块……宽度、高度、
//   间距、字体、UI样式等等都没有去做一个同等级的策划……这个你得全面的去重新的规划呀」
//
// 统一后的实测（1600×1000，四个板块各建一个生成节点、选中后量真实渲染值）：
//              文案      图片      套图        视频
//   触发器高    27.2     27.2      27.2       27.2
//   值字号      12/700   12/700    12/700     12/700
//   标题字号    11/600   11/600    11/600     11/600
//   图标        12.24    12.24     12.24      12.24
//   面板宽      435.2    435.2     435.2      435.2
//
// 统一前有两处分叉（都是"后加的例外"压过了共用档）：
//   ① 视频侧 height 32 / gap 0 / padding 0 6 → 渲染 21.76（比其余三侧矮 5.44）
//   ② 套图侧「套图方案」「商品规格」的值 11/700（同面板另两颗是 12/700）
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const canvasCss = read('src/pages/EcCanvas/EcCanvas.css');
const code = canvasCss.replace(/\/\*[\s\S]*?\*\//g, '');

test('① 视频侧不得再有触发器专属尺寸覆盖（统一前它比其余三侧矮 5.44px）', () => {
  assert.doesNotMatch(
    code,
    /\.ec-canvas-video-controls\s*>\s*\.ec-canvas-parameter-item\s*>\s*\.ec-canvas-config-trigger\s*\{/,
    '视频侧的触发器专属覆盖必须删除',
  );
  assert.doesNotMatch(
    code,
    /\.ec-canvas-video-controls\s*>\s*\.ec-canvas-parameter-item\s*>\s*\.ec-canvas-config-trigger-copy\s*\{/,
    '视频侧不得再单独把两行间距收成 0',
  );
});

test('② 套图侧那颗 11px 必须收窄到"直接子元素"（统一前同面板里两种字号）', () => {
  /* 根因：`.ec-canvas-suite-control > button strong` 里的 strong 是**后代**选择器，
     那是旧单行按钮时代写的；换成两行摘要触发器后 `<strong>` 成了**孙节点**被误伤，
     于是「套图方案」「商品规格」= 11px，而同面板「技能」「生成配置」= 12px
     （它们祖先是 `.ec-canvas-parameter-item`，压根不匹配那条）。 */
  assert.doesNotMatch(code, /\.ec-canvas-suite-control\s*>\s*button\s+strong\s*\{/,
    'strong 必须是**直接子元素**（`> button > strong`），后代选择器会误伤两行触发器');
  assert.match(code, /\.ec-canvas-suite-control\s*>\s*button\s*>\s*strong\s*\{/,
    '旧写法的原意（直接子元素的单行 strong）必须保留');
});

test('③ 四个板块共用的档位不得被任何板块级规则改掉', () => {
  /* 共用档：small 11/600（标题）+ strong 12/700（值）+ 行间距 2px。
     这三个值是"四侧一致"的唯一定义点 —— 任何一个板块级规则改它们就会重新分叉。 */
  const vp = code.match(/\.ec-canvas-config-trigger-copy\s*\{([^}]*)\}/);
  assert.ok(vp, '找不到 .ec-canvas-config-trigger-copy');
  assert.match(vp[1], /gap:\s*2px/, '两行间距固定 2px');
  const small = code.match(/\.ec-canvas-config-trigger-copy\s+small\s*\{([^}]*)\}/);
  const strong = code.match(/\.ec-canvas-config-trigger-copy\s+strong\s*\{([^}]*)\}/);
  assert.match(small[1], /font-size:\s*var\(--cvl-font-helper, 11px\)/, '标题 11px');
  assert.match(strong[1], /font-size:\s*12px/, '值 12px');
  assert.match(strong[1], /font-weight:\s*700/, '值字重 700（比标题重，符合主次阶梯）');
  /* 值必须比标题重 —— 仓库 panelVisualLanguage 写明的主次阶梯 */
  assert.ok(!/font-size:\s*1[01]px/.test(strong[1]), '值不得被压到 11px 以下（会低于标题）');
});

test('④ 值字号不得被任何 `.ec-canvas-config-trigger` 作用域的规则改小', () => {
  /* 统一前的两处分叉都是"某条更晚/更具体的规则改了 strong 的字号"。
     这里直接扫：凡是选择器里带 config-trigger 的规则，都不许改 strong 的 font-size。 */
  const offenders = [...code.matchAll(/([^{}]+)\.ec-canvas-config-trigger[^{}]*\{([^}]*)\}/g)]
    .filter(m => /strong[^{]*\{[^}]*font-size/.test(m[2]))
    .map(m => m[1].trim().slice(-50));
  assert.deepEqual(offenders, [],
    'config-trigger 作用域内不得再有改 strong 字号的规则；当前命中：' + JSON.stringify(offenders));
});
