// test/canvas-library-hover-lift-clipping-0917.test.mjs
// 2026-09-17 用户批注（画布库截图）：「这里我鼠标放上去，为什么上面会被截断呢？
//   你这个UI设计还是没有考虑周全呀。」
//
// 根因（已在真实浏览器实测确认）：卡片 hover 有位移档位
//   transform: translateY(-8px) scale(1.03)   ← 9-12 就锁定、要保留的效果
// 而承载它的 .canvas-library-grid 是**滚动容器**（overflow-y:auto）。
// overflow 的裁剪矩形 = 该元素的 padding box（= 边框盒去掉边框，**包含 padding 区**），
// 首行卡片上探量（上移 8 + 放大外扩 ≈ 6.7 → ≈ 14.7px）落在裁剪区之外 → 顶边圆角被切平。
//
// ⚠️ 9-17 二次修正（本文件的核心）：组件有**两种形态**
//   （CanvasLibraryModal.jsx：isPage ? ' is-page' : ''，variant = 'page' | 'modal'）。
//   第一版只把安全区写在 .is-page 作用域里，**弹窗形态（isPage=false）依旧被裁**——
//   而用户截图给的正是弹窗形态。因此安全区令牌与 ::before 占位必须覆盖**两种形态**。
//
// 真实浏览器实测（隔离夹具渲染同一份 CSS，1440×900，offset* 度量 + transform 矩阵换算）：
//   page  形态：新建卡 T/L/R/B = -29/-63/-1059/-455 ✓
//   modal 形态：新建卡 T/L/R/B = -21/-26/-878/-325 ✓（**修前上边距仅 -7px**，几乎贴死裁剪边）
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/pages/EcCanvas/components/canvas-library.css', import.meta.url), 'utf8');
const supervisor = readFileSync(new URL('../src/styles/canvas-supervisor.css', import.meta.url), 'utf8');
const publicTemplates = readFileSync(new URL('../src/pages/PublicTemplates/index.css', import.meta.url), 'utf8');
const strip = text => text.replace(/\/\*[\s\S]*?\*\//g, '');

/** 取某条规则体（多行安全）。
    必须**精确匹配选择器**：用 indexOf 会把 `.canvas-library-grid` 误配到
    `.canvas-library.is-page .canvas-library-grid`（前缀命中），所以这里按行首匹配。 */
function ruleBody(source, selector) {
  const clean = strip(source);
  const needle = selector + ' {';
  const lines = clean.split('\n');
  /* 选择器必须**精确**等于 selector（后面紧跟 ' {'）：
       - 不能只是 startsWith —— `.canvas-library-card:hover .canvas-library-card-actions {`
         也以 `.canvas-library-card:hover` 开头，会被误配；
       - 取**最后一条**同名规则（.canvas-library-overlay 出现两次，安全区令牌在后者），
         但要**跳过 @media (prefers-reduced-motion) 块内的覆盖**——那里是 `transform: none`，
         属于无障碍降级，不是位移档位本身。 */
  const reducedFrom = clean.indexOf('@media (prefers-reduced-motion');
  let startLine = -1;
  for (let i = 0; i < lines.length; i++) {
    if (reducedFrom >= 0 && clean.indexOf(lines[i]) > reducedFrom) {
      /* 只跳过 reduced-motion 之后、且确实位于该块内的行 */
      const linePos = clean.indexOf(lines[i]);
      if (linePos > reducedFrom) continue;
    }
    const text = lines[i].trim();
    if (text === needle || text.startsWith(needle + ' ')) startLine = i;
  }
  assert.ok(startLine >= 0, '缺少规则：' + selector);
  /* 从选择器行开始，一直吃到该规则的 '}' */
  let text = '';
  for (let i = startLine; i < lines.length; i++) {
    const line = lines[i];
    const body = i === startLine ? line.trim().slice(needle.length) : line;
    const end = body.indexOf('}');
    if (end >= 0) { text += body.slice(0, end); break; }
    text += body + '\n';
  }
  return text;
}

test('① 悬停位移档位保留（不是靠删掉效果来消除裁断）', () => {
  const cardHover = ruleBody(css, '.canvas-library-card:hover');
  assert.match(cardHover, /translateY\(-8px\) scale\(1\.03\)/, '卡片上浮+放大保留（9-12 锁定档位）');
  const newCardHover = ruleBody(css, '.canvas-library-new-card:hover');
  assert.match(newCardHover, /translateY\(-8px\) scale\(1\.03\)/, '新建卡同一档位');
});

test('② 安全区令牌挂在**两种形态共用**的作用域上（二次修正的核心）', () => {
  const shell = ruleBody(css, '.canvas-library-overlay');
  const top = Number(shell.match(/--cl-lift-safe-top:\s*(\d+)px/)[1]);
  const side = Number(shell.match(/--cl-lift-safe-x:\s*(\d+)px/)[1]);
  const lift = Number(shell.match(/--cl-lift-y:\s*(\d+)px/)[1]);
  assert.ok(top >= lift * 1.5, '上方安全区 ≥ 1.5× 上移距离（实测 ' + top + ' ≥ ' + lift * 1.5 + '）');
  assert.ok(top >= 12, '上方安全区至少覆盖放大外扩（实测 ' + top + 'px）');
  assert.ok(side >= 6, '左右安全区要覆盖放大外扩（实测 ' + side + 'px）');
  /* 反向断言：令牌不得只存在 is-page 里（正是二次修正前的缺陷） */
  const pageOnly = ruleBody(css, '.canvas-library-overlay.is-page');
  assert.ok(!/--cl-lift-safe-top/.test(pageOnly), '安全区令牌不得只写在 .is-page（弹窗形态会拿不到）');
});

test('② 基础栅格（弹窗形态走的那条）同样预留了位移空间', () => {
  const base = ruleBody(css, '.canvas-library-grid');
  assert.match(base, /overflow-y:\s*auto/, '它确实是滚动容器（裁剪矩形 = 它的 padding box）');
  assert.match(base, /padding:\s*var\(--cl-lift-safe-top/, '上方内边距走安全区令牌');
  assert.match(base, /var\(--cl-lift-safe-x/, '左右内边距走安全区令牌');
  assert.ok(!/padding:\s*18px 22px 22px/.test(base), '不得回退到写死的 18px 22px 22px');
});

test('② 基础栅格与整页栅格都必须有 ::before 真实占位行', () => {
  /* 关键教训：只加 padding 会把裁剪边界与内容一起下移，首行上方依然没有可绘空间。
     真正留出空间的是内容流里的占位 —— **两种形态都要有**。 */
  for (const selector of ['.canvas-library-grid::before', '.canvas-library.is-page .canvas-library-grid::before']) {
    const spacer = ruleBody(css, selector);
    assert.match(spacer, /content:\s*''/, selector + ' 占位元素存在');
    assert.match(spacer, /grid-column:\s*1\s*\/\s*-1/, selector + ' 占位跨满整行');
    assert.match(spacer, /height:\s*calc\(var\(--cl-lift-safe-top/, selector + ' 占位高度由安全区令牌驱动');
  }
});

test('② 整页形态：栅格 padding 用安全区令牌 + 不压筛选栏', () => {
  const grid = ruleBody(css, '.canvas-library.is-page .canvas-library-grid');
  assert.match(grid, /padding:[^;]*var\(--cl-lift-safe-top\)/, '上方安全区令牌');
  assert.match(grid, /var\(--cl-lift-safe-x\)/, '左右安全区令牌');
  const tabs = ruleBody(css, '.canvas-library.is-page .canvas-library-tabs');
  const tabPadBottom = Number(tabs.match(/padding:\s*24px[^;]*?\s(\d+)px;/)[1]);
  assert.ok(tabPadBottom <= 8, '筛选栏下内边距让位给安全区（实测 ' + tabPadBottom + 'px）');
});

test('③ 同类排查：资产库滚动视口同样预留了位移空间', () => {
  const scroll = ruleBody(supervisor, '.canvas-asset-library-modal .ec-asset-library-scroll');
  assert.match(scroll, /overflow-y:\s*auto/, '它确实是滚动容器');
  const pad = scroll.match(/padding:\s*([^;]+);/);
  assert.ok(pad, '滚动视口必须有 padding（预留位移空间）');
  const parts = pad[1].trim().split(/\s+/).map(v => v.endsWith('px') ? parseFloat(v) : NaN);
  const top = parts.length === 3 ? parts[0] : parts[0];
  const bottom = parts.length === 3 ? parts[2] : parts[2];
  assert.ok(top >= 6, '资产库上安全区 ≥ 上探量下限（实测 ' + top + 'px）');
  assert.ok(bottom >= 6, '下安全区同样要留（实测 ' + bottom + 'px）');
  const cardHover = ruleBody(supervisor, '.canvas-asset-library-modal article:hover');
  assert.match(cardHover, /translateY\(-4px\) scale\(1\.035\)/, '资产卡悬停效果保留');
});

test('③ 同类排查：公共模板弹窗的滚动容器也为卡片上浮留了空间', () => {
  /* .tpl-modal 是 overflow:auto 的滚动容器，内部卡片悬停上浮 2px；原 padding 为 0。 */
  const modal = ruleBody(publicTemplates, '.tpl-modal');
  assert.match(modal, /overflow:\s*auto/, '它确实是滚动容器');
  const pad = modal.match(/padding:\s*([^;]+);/);
  assert.ok(pad, '.tpl-modal 必须有 padding（预留位移空间）');
  const parts = pad[1].trim().split(/\s+/).map(v => parseFloat(v));
  assert.ok(parts[0] >= 3, '上方留白 ≥ 1.5× 上移量 2px = 3px（实测 ' + parts[0] + 'px）');
  assert.match(ruleBody(publicTemplates, '.popular-card:hover'), /translateY\(-2px\)/, 'popular-card 上浮保留');
  assert.match(ruleBody(publicTemplates, '.grid-item:hover'), /translateY\(-2px\)/, 'grid-item 上浮保留');
});

test('③ 同类排查：全站 hover 位移面清单可复现（防漏改）', () => {
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
