/* ══════════════════════════════════════════════════════════════════════════════════════════════
   2026-09-26 批 BQ 门禁：@Hallmark 全站体检里**可机械判定**的那几条必须保持绿。
   体检脚本：.qa/bq-hallmark-audit.mjs（7 个页面 × 5 个宽度，实机跑）
   依据：hallmark/references/anti-patterns.md + slop-test 的移动端非协商项。
   ⚠️ 判据来源与"为什么这样定"都写在下面各条里，便于以后复核。
   ══════════════════════════════════════════════════════════════════════════════════════════════ */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8');

test('① 移动端横向滚动的两道防线都在（全局 clip + 列可收缩）', () => {
  const theme = read('src/styles/theme.css');
  assert.match(theme, /html, body \{ overflow-x: clip; \}/, '全局必须是 clip（hidden 会连带干掉 sticky）');
  assert.doesNotMatch(theme, /html, body \{ overflow-x: hidden/, '不能写成 hidden');

  const workbench = read('src/components/media/WorkbenchShell.css');
  assert.match(workbench, /\.media-workbench-left,\s*\.media-workbench-right \{ min-width: 0; \}/,
    '工作台两列必须能收缩（grid 子项默认 min-width:auto 会把页面撑宽）');
  assert.match(workbench, /@media \(max-width: 1023px\) \{\s*\.media-workbench\.is-embedded-flow \{ grid-template-columns: minmax\(0, 1fr\); \}/,
    '嵌入流工作台的移动端单列覆盖必须在（它自己写过一遍 minmax(300px,…)）');
  assert.match(workbench, /@media \(max-width: 520px\) \{\s*\.media-workbench-fields \{ grid-template-columns: minmax\(0, 1fr\); \}/,
    '字段两列在窄屏必须单列');

  const video = read('src/pages/VideoStudio/VideoStudio.css');
  assert.match(video, /\.video-studio-page\.is-embedded,\s*\.video-composer\.is-workbench,\s*\.video-content-composer\.is-workbench \{ min-width: 0; max-width: 100%; \}/,
    '视频子页面三层面板都要能收缩（实测 320px 下曾溢出 96px）');
});

test('② 全站的 `minmax(NNNpx, 1fr)` 必须写成 min() 形式（窄容器下要肯退让）', () => {
  const walk = dir => fs.readdirSync(dir, { withFileTypes: true })
    .flatMap(entry => (entry.isDirectory() ? walk(dir + '/' + entry.name) : [dir + '/' + entry.name]));
  const offenders = [];
  for (const file of walk('src').filter(name => name.endsWith('.css'))) {
    const src = read(file);
    const hits = src.match(/minmax\(\d+px,\s*1fr\)/g);
    if (hits) offenders.push(file + ' → ' + hits.join(', '));
  }
  assert.deepEqual(offenders, [], '裸 minmax(NNNpx, 1fr) 会在窄容器里撑破页面，写成 minmax(min(NNNpx, 100%), 1fr)：' + offenders.join(' | '));
});

test('③ 可点文字的标签不许折行（hallmark gate 49）', () => {
  const workbench = read('src/components/media/WorkbenchShell.css');
  for (const selector of ['.media-field-upload-add', '.media-field-upload-library']) {
    const block = workbench.slice(workbench.indexOf(selector + ' {'), workbench.indexOf('}', workbench.indexOf(selector + ' {')));
    assert.match(block, /white-space: nowrap/, selector + ' 的标签在窄屏会折成两行');
  }
});

test('④ 点击区下限 32（全屏 / 字段级一键按钮）', () => {
  const visual = read('src/pages/Home/VisualCreationMode.css');
  assert.match(visual, /\.visual-materials-fullscreen \{[\s\S]{0,160}height: 32px;/, '全屏按钮点击区 28 → 32');
  const workbench = read('src/components/media/WorkbenchShell.css');
  assert.match(workbench, /\.media-workbench-inline-action \{[\s\S]{0,200}min-height: 32px;/, '字段级一键按钮 30 → 32');
});

test('⑤ 渐变标题已下线 + 字体栈干净（用户 9-26 批准按 Hallmark 方向改）', () => {
  /* ═══ 2026-09-26 批 BR：**用户拍板了** ═══════════════════════════════════════════════════════
     用户原话：「首页 h1 的品牌渐变文字（Hallmark 把"渐变标题"列为 critical）和字体……这个你可以改吧，
     按照 Hallmark 的优化方向去改。」
     ⇒ 判据从"已登记、不擅自改"翻成"**必须没有渐变标题**"：
        h1 的强调用品牌色 + 更重字重（Hallmark 允许的三种强调方式之一），类名也不许再叫 gradient。 */
  const home = read('src/pages/Home/index.jsx');
  assert.doesNotMatch(home, /hero-gradient-text/, 'h1 不许再用渐变文字类');
  assert.match(home, /hero-accent-text/, '强调改用 hero-accent-text（品牌色 + 重字重）');
  const tokens = read('src/styles/design-tokens.css');
  const accent = tokens.slice(tokens.indexOf('.hero-accent-text {'), tokens.indexOf('}', tokens.indexOf('.hero-accent-text {')));
  assert.doesNotMatch(accent, /linear-gradient/, '强调样式里不许有渐变');
  assert.match(accent, /color: var\(--sb-ink-brand\)/, '强调色走品牌 token');
  /* 字体：不得引入 Inter（hallmark 反对"到处 Inter"）；display 栈里不许留**没加载的网字体** */
  const v3 = read('src/styles/design-tokens-v3.css');
  assert.doesNotMatch(v3, /font-family:\s*'?Inter'?/i, '不得引入 Inter 作为正文字体');
  const display = v3.slice(v3.indexOf('--sb-font-display:'), v3.indexOf(';', v3.indexOf('--sb-font-display:')));
  assert.doesNotMatch(display, /Fredoka|ZCOOL/, 'display 栈里不许留没加载的网字体（它们从来没生效过）');
});
