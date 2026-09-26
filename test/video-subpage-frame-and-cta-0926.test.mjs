/* ═══ 2026-09-26 批 CA 门禁：视频子页面两件事 ═══════════════════════════════════════════════════
   用户本轮批注（逐字）：
   ① 「你这里还是有一层框呀。为什么要搞这么大的一层框在这里呢？你图片生成那边的所有子页面是没有
      这层框的呀，视频生成这边为什么会有呢？你两边的规格到底对齐了没有啊？」
   ② 「你这个按钮不是必须要上传相关的素材才能实现吗？那你为什么不让他暗下去呢？应该要拥护他达到
      某种条件之后它才能亮起来吧。图片生成那边，我们不是已经做了相关的配置吗？为什么视频生成这边
      的子页面你不做这些配置呢？」
   两条都只认"事实"：框的归属由**计算样式**决定（实测见 .qa/ca-frame-diag.mjs），
   按钮的亮暗由**同一个 requires 判据**决定。 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');

test('CA-① 技能子页面（is-workbench）不再被嵌进工作台的那层框包住', () => {
  const css = read('src/pages/VideoStudio/VideoStudio.css');

  /* 框的定义处必须把 workbench 那一支排除掉 —— 权重大于 .video-composer.is-workbench，
     不排除就永远赢（这就是用户看到的那层框的真根因）。 */
  const rule = css.match(/\.video-studio-page\.is-embedded \.video-composer:not\(\.is-workbench\)\s*\{([^}]*)\}/);
  assert.ok(rule, '框的定义处必须写成 :not(.is-workbench)，否则它比 .video-composer.is-workbench 权重高、必然赢');
  assert.match(rule[1], /border:\s*1px solid/, '非子页面（首页/独立创作台）的框照图片侧的数值保留');

  /* workbench 那一支自己必须是"零框"（第 630 行附近那条），两边成对才算对齐。 */
  const plain = css.match(/\.video-composer\.is-workbench \{\s*display: flex;[\s\S]{0,400}?\}/);
  assert.ok(plain, '找不到 .video-composer.is-workbench 的零框声明');
  assert.match(plain[0], /border:\s*0/, '子页面那支必须是 border: 0');
  assert.match(plain[0], /box-shadow:\s*none/, '子页面那支必须是 box-shadow: none');

  /* 不允许别处再把框加回 workbench（双份真相等价于没改）。
     ⚠️ 先在**去掉注释**的文本上扫：注释里到处写着 `.video-composer.is-workbench`，
        不去注释会把注释当规则（第一版就踩了这个，报出 3 条假命中）。 */
  const bare = css.replace(/\/\*[\s\S]*?\*\//g, '');
  /* ⚠️ 逐条读**声明值**再判，不要用 `(?!none)` 这种写法：`\s*` 会回溯到空串，
       于是 `none` 前面那个空格让 lookahead 通过 —— 第一版就栽在这上面（0 变成了 1）。 */
  const readd = [...bare.matchAll(/\.video-composer\.is-workbench[^{]*\{([^}]*)\}/g)].filter(m => {
    const body = m[1];
    const border = body.match(/border(?:-(?:top|left|right|bottom))?:\s*([^;]+)/);
    const shadow = body.match(/box-shadow:\s*([^;]+)/);
    const borderBad = Boolean(border) && !/^0(\s|$)/.test(border[1].trim());
    const shadowBad = Boolean(shadow) && shadow[1].trim() !== 'none';
    return borderBad || shadowBad;
  });
  assert.equal(readd.length, 0, `有规则把框加回子页面工作台：${readd.map(m => m[0].slice(0, 60)).join(' | ')}`);
});

test('CA-② 必须素材的模式：缺素材时「分析并生成方案」必须暗着', () => {
  const jsx = read('src/pages/VideoStudio/index.jsx');
  const line = jsx.match(/const canAnalyze = [^;]+;/);
  assert.ok(line, '找不到 canAnalyze 判据');
  assert.match(line[0], /capabilities\.generationEnabled && selectedProduct && hasAnyInput && requires/,
    'canAnalyze 必须同时要求 requires —— 缺素材时按钮要暗着（用户：「那你为什么不让他暗下去呢？」）');
  /* 反例守护：不许退回到"只要有输入就亮"。 */
  assert.doesNotMatch(line[0], /&& hasAnyInput;/, '退回旧判据 = 缺素材也亮，用户会重新看到那颗紫按钮');
});

test('CA-③ 按钮与提示是同一件事的两半：不禁用时不能骗人、该禁时必须给理由', () => {
  const jsx = read('src/pages/VideoStudio/index.jsx');
  const hint = jsx.match(/const submitHint = \(\(\) => \{[\s\S]*?\}\)\(\);/);
  assert.ok(hint, '找不到 submitHint');
  assert.match(hint[0], /if \(!requires\) return mode === 'frame' \? '请先上传首帧和尾帧' : '请先上传参考图片和参考视频';/,
    '缺素材时的那句提示必须在（按钮暗着 + 提示说明还差什么，两条一起才叫"拥护他达到条件"）');
  /* requires 的定义来源必须仍然是那个真函数，不许被就地写死成 true。 */
  assert.match(jsx, /const requires = hasRequiredVideoInputs\(mode, files\);/,
    'requires 必须来自 hasRequiredVideoInputs(mode, files)');
});

test('CA-④ 有素材/文字之前，按钮本来就是暗的（无输入即禁用这条不能被本轮改掉）', () => {
  const jsx = read('src/pages/VideoStudio/index.jsx');
  assert.match(jsx, /const hasAnyInput = uploadedFileCount > 0 \|\| Boolean\(String\(prompt \|\| ''\)\.trim\(\)\);/,
    'hasAnyInput 的口径必须保留（用户 9-13：「什么都没做时按钮不该亮着」）');
});
