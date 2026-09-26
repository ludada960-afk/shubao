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

test('⑤ 【留档】h1 渐变与字体：**用户看过实机后要求改回**（时间线写在断言里）', () => {
  /* ═══ 时间线（两次口径都在这里，别只看一半就"顺手改回去"）═══════════════════════════════════
     · 批 BR：用户原话「首页 h1 的品牌渐变文字……和字体，这个你可以改吧，按照 Hallmark 的优化方向去改」
       ⇒ 我把三色渐变字下掉、换成品牌色 + 900 字重，判据翻成"不许再有渐变标题"。
     · 批 BS（本轮）：用户看完实机改向 ——「算了，h1 与字体这个**改回去吧，越改越不好看，
       不如之前的渐变好**」 ⇒ **恢复原样**，判据回到"登记在案、不擅自改"。
     ⚠️ 所以现在 h1 有渐变、字体是 Fredoka/ZCOOL 那套栈，**是用户权衡后的选择**；
        Hallmark 那条 critical 会复现，属于知情接受，不是漏改。 */
  const home = read('src/pages/Home/index.jsx');
  assert.match(home, /hero-gradient-text/, 'h1 用回原渐变（用户 BS 轮的明确要求）');
  assert.doesNotMatch(home, /hero-accent-text/, 'BR 那版强调类已下线，别又混着用两个');
  const v3 = read('src/styles/design-tokens-v3.css');
  assert.doesNotMatch(v3, /font-family:\s*'?Inter'?/i, '不得引入 Inter 作为正文字体');
});


test('⑥ 分段控件：hover 只作用于被悬停的那一颗（防"组级 hover 点亮第一颗"）', () => {
  const css = read('src/components/media/WorkbenchShell.css');
  /* ① 不许有"组级 hover"规则 —— 它会让鼠标停在组内任意位置都点亮某些子项 */
  const groupHover = (css.match(/\.media-field-segmented:hover[^{]*\{/g) || []);
  assert.deepEqual(groupHover, [], '不许有组级 hover 规则（实测用户看到"第一颗自己亮"就是这个形态）');
  /* ② 也不许用 :first-child / :first-of-type 给组内第一颗单独上样式 */
  assert.doesNotMatch(css, /\.media-field-segmented button:first-(child|of-type)/, '不许给组内第一颗单独上样式');
  /* ③ hover 只能挂在按钮自己身上 */
  assert.match(css, /\.media-field-segmented button:hover:not\(:disabled\)/, 'hover 必须挂在按钮自己身上');
  /* ④ hover 不许由 JS 状态实现（默认索引 0 会让第一颗常亮） */
  const renderer = read('src/components/media/FieldRenderer.jsx');
  assert.doesNotMatch(renderer, /hoverIndex|hoveredIndex/, 'hover 不许由 JS 状态实现');
});


test('⑦ 滚动期间的「假悬停」防护：状态标记 + 已安装 + 悬停规则带前缀', () => {
  /* 背景：滚轮滚动不产生鼠标事件，浏览器不会重算光标下是谁 ⇒ 滚动前停在光标下的那颗按钮
     会**保持 :hover 高亮**，用户看到的就是"我没指它，它却亮着"（本批用户报的就是这个）。
     三件套缺一不可：① 状态标记模块存在；② 它真的被安装；③ 关键控件的悬停规则带前缀。 */
  const guard = fs.readFileSync('src/utils/scrollHoverGuard.js', 'utf8');
  assert.match(guard, /export function installScrollHoverGuard/, '状态标记模块必须导出安装函数');
  assert.match(guard, /\{ passive: true, capture: true \}/, 'scroll 必须用 capture 监听（内层容器滚动不冒泡到 window）');
  assert.match(guard, /data-\$\{SCROLLING_ATTR\}/, '标记写在 <html> 的 data-scrolling 上');

  const main = fs.readFileSync('src/main.jsx', 'utf8');
  assert.match(main, /installScrollHoverGuard\(\);/, '必须在入口安装（否则等于没写）');

  const files = [
    'src/components/media/WorkbenchShell.css',
    'src/styles/generate-cta.css',
    'src/pages/VideoStudio/VideoStudio.css',
  ];
  const PREFIX = 'html:not([data-scrolling]) ';
  let prefixed = 0;
  for (const file of files) {
    prefixed += (fs.readFileSync(file, 'utf8').match(new RegExp(PREFIX.replace(/[[\]()]/g, '\\$&'), 'g')) || []).length;
  }
  assert.ok(prefixed >= 8, '关键控件的悬停规则必须都带 html:not([data-scrolling]) 前缀（当前 ' + prefixed + ' 处）');
  /* 分段控件（用户报的那个）必须在名单里 */
  const workbench = fs.readFileSync('src/components/media/WorkbenchShell.css', 'utf8');
  assert.match(workbench, /html:not\(\[data-scrolling\]\) \.media-field-segmented button:hover:not\(:disabled\)/,
    '分段控件的悬停必须受滚动防护约束');
});
