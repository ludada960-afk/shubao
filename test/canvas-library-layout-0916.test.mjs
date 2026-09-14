// test/canvas-library-layout-0916.test.mjs
// 2026-09-16 用户批注（图11）三条结构性问题，逐条落成可回归的断言：
//   ①「左边要搞这么挤呢？左右两边都弄得好挤，然后整个页面中间都是一大片白」
//      → 内容必须装在一个**居中的定宽容器**里：头部/筛选栏/栅格三段共用同一个
//        内边距式子 max(--cl-pad, (100% - --cl-content-max)/2)，于是
//        左留白 == 右留白；窗口比容器宽时两侧留白相等（>0），等宽时等于安全边距。
//   ②「你这个按钮又搞得那么的边缘」
//      → 关闭按钮跟随同一坐标：右边距 = max(--cl-pad, (100% - --cl-content-max)/2) ≥ 28px。
//   ③「新建做的就很死板，加号和新建成两个字都嵌死的感觉，完全就是打上去的」
//      → 加号必须有**独立圆形载体**（56px 真圆 + 自身 hover 反馈），
//        与「新建」文字之间有 ≥16px 的明确间距，整体可垂直居中。
// 静态契约（本文件）守 CSS 结构；真实浏览器像素与对比度见
// .qa/verify-canvas-library-design.mjs / .qa/pixel-canvas-library.mjs。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/pages/EcCanvas/components/canvas-library.css', import.meta.url), 'utf8');
const jsx = readFileSync(new URL('../src/pages/EcCanvas/components/CanvasLibraryModal.jsx', import.meta.url), 'utf8');

/** 取出某条规则体（选择器精确匹配，避免 is-page 变体串味） */
function ruleBody(selector) {
  const index = css.indexOf(selector + ' {');
  assert.ok(index >= 0, '缺少规则：' + selector);
  return css.slice(index + selector.length + 2, css.indexOf('}', index));
}

test('① 内容容器：最大宽度与安全边距用同一组变量，三段共享同一条内边距式子', () => {
  const shell = ruleBody('.canvas-library-overlay.is-page');
  assert.match(shell, /--cl-content-max:\s*1320px/, '内容容器最大宽度 1320px');
  assert.match(shell, /--cl-pad:\s*32px/, '左右安全边距 32px');

  const centered = /padding:[^;]*max\(var\(--cl-pad\),\s*calc\(\(100% - var\(--cl-content-max\)\) \/ 2\)\)/;
  for (const selector of [
    '.canvas-library.is-page .canvas-library-head',
    '.canvas-library.is-page .canvas-library-tabs',
    '.canvas-library.is-page .canvas-library-grid',
  ]) {
    const body = ruleBody(selector);
    assert.match(body, centered, selector + ' 必须用居中的容器内边距式子（左右同式才是对称的）');
    assert.match(body, /padding:(?:[^;]*?) max\(/, selector + ' 左右内边距都走 max()，不是单边写死');
    /* 不允许出现写死的单边内边距（padding-left / padding-right / padding-inline-*），
       否则三段各写一套数字，左右立刻就不对称了。 */
    assert.ok(!/padding-(left|right|inline(-start|-end)?)\s*:/.test(body), selector + ' 不得残留写死的单边内边距');
  }
  /* 容器最大宽度必须落在题目给的 1200-1320px 区间 */
  const max = Number(shell.match(/--cl-content-max:\s*(\d+)px/)[1]);
  assert.ok(max >= 1200 && max <= 1320, '容器最大宽度应在 1200-1320px（实测 ' + max + 'px）');
  /* 安全边距必须 ≥ 28px（用户要求关闭按钮距视口边缘 ≥28px） */
  const pad = Number(shell.match(/--cl-pad:\s*(\d+)px/)[1]);
  assert.ok(pad >= 28, '左右安全边距 ≥28px（实测 ' + pad + 'px）');
  /* 消歧：关掉老的无作用域规则，避免选择器打架 */
  assert.match(css, /\.canvas-library\.is-page \.canvas-library-head \{/, '头部规则限定在整页模式');
});

test('① 栅格：内边距归零 + 列数随容器宽度自适应，卡片吃满容器宽', () => {
  const grid = ruleBody('.canvas-library.is-page .canvas-library-grid');
  assert.match(grid, /repeat\(auto-fill,\s*minmax\(\d+px,\s*1fr\)\)/, '列数随宽度自适应');
  /* 列宽下限：容器 (1320 - 2*32) = 1256；4 列 + 3 个 24px 列间距 → 每列 286px。
     下限取 248px（既有的 4 列几何），保证 1320 容器稳定落在 4 列而不是 5 列。 */
  const min = Number(grid.match(/minmax\((\d+)px/)[1]);
  assert.ok(min >= 248 && min <= 286, '列宽下限应在 248-286px（实测 ' + min + 'px）');
  assert.match(grid, /column-gap:\s*var\(--cl-gap-x\)|gap:\s*var\(--cl-gap/);
  assert.match(grid, /row-gap:\s*var\(--cl-gap-y\)/);
  /* 关键：栅格自己不再加一层内边距（否则卡片右侧会多出一段空档） */
  assert.ok(!/padding:\s*\d+px/.test(grid), '栅格内边距必须交给容器式子，不能写死');
});

test('② 关闭按钮：距离跟内容容器右缘同一坐标，且 ≥28px 安全边距', () => {
  /* 这是**唯一**决定 × 横向位置的规则：容器右边距 = max(--cl-pad, (100%-1320)/2)，
     所以 1440 视口 → 60px；1920 → 300px；1366 → 32px。 */
  const close = ruleBody('.canvas-library.is-page .canvas-library-close');
  assert.ok(!/right:\s*\d+px/.test(close), '关闭按钮不得再用写死的 right 贴边');
  assert.ok(!/position:\s*absolute/.test(close), '关闭按钮跟随头部流式布局，不绝对定位到视口角落');
  const head = ruleBody('.canvas-library.is-page .canvas-library-head');
  assert.match(head, /justify-content:\s*space-between/, '头部两端对齐 → × 落在容器右缘');
  assert.match(head, /max\(var\(--cl-pad\),\s*calc/, '头部的右侧内边距 = 容器右边距');
  /* 命中区不小于 40×40 */
  assert.match(close, /width:\s*40px/);
  assert.match(close, /height:\s*40px/);
});

test('③ 新建卡：加号有独立圆形载体（真圆 + 自身 hover 反馈）', () => {
  const plus = ruleBody('.canvas-library-new-card-plus');
  assert.match(plus, /border-radius:\s*50%/, '加号载体必须是圆');
  assert.match(plus, /width:\s*56px/);
  assert.match(plus, /height:\s*56px/);
  assert.match(plus, /background:\s*#fff/, '载体自带底色（不是直接打在框里）');
  assert.match(plus, /border:\s*[\d.]+px solid/, '载体自带描边');
  assert.match(plus, /box-shadow:/, '载体自带投影，与卡片底分离');
  /* 加号字形由伪元素绘制（不再依赖字体基线，也不再是裸文本节点） */
  assert.match(css, /\.canvas-library-new-card-plus::before,\s*\n\.canvas-library-new-card-plus::after \{ content: '';/, '两条伪元素画加号');
  assert.match(css, /rotate\(90deg\)/, '竖笔由 ::after 旋转得到');
  /* hover 时载体**自己**也要有反馈（不只是整卡变色） */
  assert.match(css, /\.canvas-library-new-card:hover \.canvas-library-new-card-plus \{[^}]*background:\s*#7c3aed/, 'hover 时载体填充实心');
  assert.match(css, /\.canvas-library-new-card:hover \.canvas-library-new-card-plus \{[^}]*color:\s*#fff/, 'hover 时加号反白');
});

test('③ 新建卡：加号与文字有明确层级与间距，整体垂直居中', () => {
  const card = ruleBody('.canvas-library-new-card');
  assert.match(card, /flex-direction:\s*column/);
  assert.match(card, /align-items:\s*center/);
  assert.match(card, /justify-content:\s*center/, '整组图标+文字在卡内垂直居中（不再「嵌死」）');
  const gap = Number(card.match(/gap:\s*(\d+)px/)[1]);
  assert.ok(gap >= 16, '加号载体到文字的间距 ≥16px（实测 ' + gap + 'px）');
  assert.ok(gap <= 24, '间距不超过 24px，否则圆与文字会散（实测 ' + gap + 'px）');
  /* 层级：加号（主）> 「新建」（辅）—— 载体 56px 远大于文字，文字字号小于封面标题 14px */
  const label = ruleBody('.canvas-library-new-card-label');
  const labelSize = Number(label.match(/font-size:\s*([\d.]+)px/)[1]);
  assert.ok(labelSize < 14, '「新建」是辅助级文字，字号应小于卡片标题的 14px（实测 ' + labelSize + 'px）');
  assert.match(label, /letter-spacing:\s*\.0[4-9]em/, '辅助文字放开字距，不再和加号挤在一起');
  /* 呼吸感：卡片有内边距，不是零留白 */
  assert.match(card, /padding:\s*24px/);
});

test('③ 新建卡：hover 有上浮 + 阴影 + 描边加深（三重反馈，不是只换底色）', () => {
  const hover = ruleBody('.canvas-library-new-card:hover');
  /* 档位沿用上一轮已锁定的值（上浮 8px / 放大 1.03），本轮只加强描边与底色 */
  assert.match(hover, /transform:\s*translateY\(-8px\) scale\(1\.03\)/, '上浮');
  assert.match(hover, /box-shadow:/, '阴影');
  assert.match(hover, /border-color:\s*rgba\(124,\s*58,\s*237,\s*\.62\)/, '描边加深');
  assert.match(ruleBody('.canvas-library-new-card'), /transition:/, '过渡存在（动效是位移+阴影+描边+底色）');
});

test('③ 新建卡：可聚焦 + 键盘焦点环 + 减少动态降级', () => {
  assert.match(css, /\.canvas-library-new-card:focus-visible \{[^}]*outline:\s*2px solid #7c3aed/, '键盘焦点环');
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/, '减少动态必须有降级');
  const reduce = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));
  assert.match(reduce, /\.canvas-library-new-card:hover \{ transform: none; \}/, '减少动态取消上浮');
});

test('③ 新建卡 JSX：载体是空 span，字形由 CSS 画，无障碍名只剩「新建」', () => {
  assert.match(jsx, /<span className="canvas-library-new-card-plus" aria-hidden="true" \/>/, '加号载体是空元素 + aria-hidden');
  assert.ok(!/>\+<\/span>/.test(jsx), '不再把裸「+」文本打进去');
  assert.match(jsx, /<span className="canvas-library-new-card-label">新建<\/span>/, '可读文案只在标签上');
});
