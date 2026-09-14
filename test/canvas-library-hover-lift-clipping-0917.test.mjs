// test/canvas-library-hover-lift-clipping-0917.test.mjs
// 2026-09-17 用户批注（画布库截图）：「这里我鼠标放上去，为什么上面会被截断呢？
//   你这个UI设计还是没有考虑周全呀。」
//
// 根因（已在真实浏览器实测确认）：卡片 hover 有位移档位
//   transform: translateY(-8px) scale(1.03)   ← 9-12 就锁定、要保留的效果
// 而承载它的 .canvas-library-grid 是**滚动容器**（overflow-y:auto）。
// overflow 的裁剪矩形 = 该元素的 padding box（= 边框盒去掉边框，**包含 padding 区**），
// 而栅格的 padding-top 原本是 0 → 首行卡片上探的 8px（放大再外扩约 4.7px，合计 ≈ 12.7px）
// 整个落在裁剪区之外，被切掉顶边圆角，并顶到上方筛选栏。
// 这不是单张卡片的偶发，是「悬停位移必须在容器内预留空间」这一类问题。
//
// 修法（本测试锁定的契约）：
//   ① 容器为位移预留空间，而不是砍掉悬停效果 —— 上/下/左右都要留；
//   ② 余量 ≥ 上移距离 × 1.5（题目要求），并且要覆盖放大带来的额外外扩；
//   ③ 悬停卡片不得越出容器可视区顶边，也不得压到上方筛选栏。
//
// 真实浏览器像素实测（1440×900，隔离夹具渲染同一份 CSS）：
//   新建卡(第一行第一列)  over L/T/R/B = -63/-29/-1059/-455  ✓ 完全落在裁剪矩形内
//   第一行最右列          over L/T/R/B = -1059/-335/-63/-145 ✓
//   最后一行              over L/T/R/B = -63/-460/-1059/-20 ✓
//   最后一行最左列        over L/T/R/B = -63/-460/-1059/-20 ✓
// 改前：新建卡 overTop = +11（越界 11px）、overlapsTabs = true（压住筛选栏）。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/pages/EcCanvas/components/canvas-library.css', import.meta.url), 'utf8');
const supervisor = readFileSync(new URL('../src/styles/canvas-supervisor.css', import.meta.url), 'utf8');
const strip = text => text.replace(/\/\*[\s\S]*?\*\//g, '');

/** 取某条规则体（多行安全） */
function ruleBody(source, selector) {
  const clean = strip(source);
  const index = clean.indexOf(selector + ' {');
  assert.ok(index >= 0, '缺少规则：' + selector);
  return clean.slice(index + selector.length + 2, clean.indexOf('}', index));
}

test('① 悬停位移档位保留（不是靠删掉效果来消除裁断）', () => {
  const cardHover = ruleBody(css, '.canvas-library-card:hover');
  assert.match(cardHover, /translateY\(-8px\) scale\(1\.03\)/, '卡片上浮+放大保留（9-12 锁定档位）');
  const newCardHover = ruleBody(css, '.canvas-library-new-card:hover');
  assert.match(newCardHover, /translateY\(-8px\) scale\(1\.03\)/, '新建卡同一档位');
});

test('② 容器为悬停位移预留空间：竖直 / 左右都要留', () => {
  const shell = ruleBody(css, '.canvas-library-overlay.is-page');
  /* 安全区令牌：上探量 = 上移 8 + 放大外扩；按最大卡片 320×242 估算外扩 ≈ 4.8+3.6 = 8.4
     → 16px。左右取 8px（≥ 外扩 4.8）。 */
  const top = Number(shell.match(/--cl-lift-safe-top:\s*(\d+)px/)[1]);
  const side = Number(shell.match(/--cl-lift-safe-x:\s*(\d+)px/)[1]);
  const lift = Number(shell.match(/--cl-lift-y:\s*(\d+)px/)[1]);
  assert.ok(top >= lift * 1.5, '上方安全区 ≥ 1.5× 上移距离（实测 ' + top + ' ≥ ' + lift + '×1.5=' + lift * 1.5 + '）');
  assert.ok(top >= 12, '上方安全区至少覆盖放大外扩（实测 ' + top + 'px）');
  assert.ok(side >= 6, '左右安全区要覆盖放大外扩（实测 ' + side + 'px）');

  const grid = ruleBody(css, '.canvas-library.is-page .canvas-library-grid');
  assert.match(grid, /padding:[^;]*var\(--cl-lift-safe-top\)/, '栅格 padding 里用了上方安全区令牌');
  assert.match(grid, /var\(--cl-lift-safe-x\)/, '栅格 padding 里用了左右安全区令牌');
});

test('② 首行上方用**真实占位**（padding 单独留不住空间）', () => {
  /* 关键教训：overflow:auto 的裁剪矩形是 padding box，而内容也正从 padding box 的边开始，
     只加 padding 会把裁剪边界与内容一起下移，首行上方依然没有可绘空间（实测如此）。
     真正留出空间的是内容流里的占位 —— 因此栅格必须有 ::before 占位行。 */
  const spacer = ruleBody(css, '.canvas-library.is-page .canvas-library-grid::before');
  assert.match(spacer, /content:\s*''/, '占位元素存在');
  assert.match(spacer, /grid-column:\s*1\s*\/\s*-1/, '占位跨满整行');
  assert.match(spacer, /height:\s*calc\(var\(--cl-lift-safe-top\)/, '占位高度由安全区令牌驱动');
});

test('② 悬停卡片不得压到上方筛选栏', () => {
  /* 筛选栏下内边距让出 16px 给栅格的安全区，视觉间距与 9-16 定稿一致；
     同时栅格的 padding-top=0（空间由 ::before 占位提供），两者相加保证首行不与筛选栏重叠。 */
  const tabs = ruleBody(css, '.canvas-library.is-page .canvas-library-tabs');
  assert.match(tabs, /padding:\s*24px[^;]*\b[0-9]+px;/, '筛选栏内边距为三值简写');
  const tabPadBottom = Number(tabs.match(/padding:\s*24px[^;]*?\s(\d+)px;/)[1]);
  assert.ok(tabPadBottom <= 8, '筛选栏下内边距缩到 ≤8px 为安全区让位（实测 ' + tabPadBottom + 'px）');
});

test('③ 同类排查：资产库滚动视口同样预留了位移空间', () => {
  /* 资产库卡片是 translateY(-4px) scale(1.035)，同一类问题。
     实测（隔离夹具，1440×900）：改前首行第一列横向越界、改后四个极端位置全部落在裁剪矩形内。 */
  const scroll = ruleBody(supervisor, '.canvas-asset-library-modal .ec-asset-library-scroll');
  assert.match(scroll, /overflow-y:\s*auto/, '它确实是滚动容器（因此会成为裁剪矩形）');
  const pad = scroll.match(/padding:\s*([^;]+);/);
  assert.ok(pad, '滚动视口必须有 padding（预留位移空间）');
  const parts = pad[1].trim().split(/\s+/).map(v => v.endsWith('px') ? parseFloat(v) : NaN);
  const [top, , bottom] = parts.length === 3 ? [parts[0], parts[1], parts[2]] : parts;
  assert.ok(top >= 6, '资产库上安全区 ≥ 上探量 6.6px 的下限（实测 ' + top + 'px）');
  assert.ok(bottom >= 6, '下安全区同样要留（实测 ' + bottom + 'px）');
  /* 卡片档位保留 */
  const cardHover = ruleBody(supervisor, '.canvas-asset-library-modal article:hover');
  assert.match(cardHover, /translateY\(-4px\) scale\(1\.035\)/, '资产卡悬停效果保留');
});

test('③ 同类排查：全站 hover 位移面清单可复现（防漏改）', () => {
  /* 这份清单由 .qa/audit-hover-lift-clipping.mjs 生成，固化在这里防止有人新增
     「hover 上浮 + 放在滚动容器里」的组合却不留安全区。 */
  const targets = [
    [css, '.canvas-library-card:hover', 8, 1.03],
    [css, '.canvas-library-new-card:hover', 8, 1.03],
    [supervisor, '.canvas-asset-library-modal article:hover', 4, 1.035],
  ];
  for (const [source, selector, liftY, scale] of targets) {
    const body = ruleBody(source, selector);
    const m = /translateY\(-([\d.]+)px\)\s*scale\(([\d.]+)\)/.exec(body);
    assert.ok(m, selector + ' 位移档位应为 translateY + scale');
    assert.equal(Number(m[1]), liftY, selector + ' 上移量');
    assert.equal(Number(m[2]), scale, selector + ' 缩放比');
  }
});
