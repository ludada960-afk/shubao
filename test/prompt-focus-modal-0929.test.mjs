import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ');
const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const code = p => strip(read(p));

const video = code('src/pages/VideoStudio/index.jsx');
const image = code('src/pages/Home/VisualCreationMode.jsx');
const modal = code('src/components/creation/PromptFocusModal.jsx');
const modalCss = read('src/components/creation/PromptFocusModal.css');

const PAGES = [
  ['视频页 VideoStudio', video],
  ['图片页 VisualCreationMode', image],
];

/* ══════════════════════════════════════════════════════════════════════════════
   全屏按钮应当是**页内「放大输入」弹窗**（批 CY-㉞）

   用户 2026-09-30 逐字（图8）：
     「我点击输入框这里的全屏按钮，为什么你会是这样的一个展现方式呀？
       你难道没有搞明白全屏按钮是干什么的吗？
       **他是把你当前这个输入框他的输入区给放大呀。**
       你其实只需要做一个弹窗，然后这个弹窗跟我们现在的这个区域是一样的。
       只是他的输入框会变得更大。让用户可以一次性看到更多的文字。」

   并点名了范围：「可能不止电商套图存在，可能现在这里面的四个生成功能都存在这个问题。
   甚至首页的视频生成和图片生成功能也存在这个问题。」
   ⇒ 两个真正有这颗按钮的页面都要改。

   改前两边都调**浏览器原生 Fullscreen API**（`node.requestFullscreen()`）：
   用户看到的是操作系统级全屏 —— 浏览器自己的「若要退出全屏模式，请按 Esc」提示条
   压在最上面，而**输入框并没有变大**（只是整页被撑满）。
   按钮叫「全屏」、做出来也真是全屏，但**不是用户要的那个东西**。
   ══════════════════════════════════════════════════════════════════════════════ */

test('① 两处都不许再调浏览器原生全屏（那正是用户看到「按 Esc 退出」提示条的原因）', () => {
  for (const [name, src] of PAGES) {
    assert.doesNotMatch(src, /requestFullscreen/,
      `${name}：不得再调 requestFullscreen —— 用户要的是「一次看到更多文字」，不是占满显示器`);
    assert.doesNotMatch(src, /exitFullscreen/,
      `${name}：不得再调 exitFullscreen`);
  }
});

test('② 两处的「放大输入」按钮都要打开弹窗', () => {
  for (const [name, src] of PAGES) {
    assert.match(src, /promptFocusOpen/, `${name}：必须有 promptFocusOpen 状态`);
    assert.match(src, /onClick=\{toggleFullscreen\}/, `${name}：按钮必须走 toggleFullscreen`);
    assert.match(src, /<PromptFocusModal/, `${name}：必须渲染 PromptFocusModal`);
    assert.match(src, /open=\{promptFocusOpen\}/, `${name}：弹窗的 open 必须接这个状态`);
  }
});

test('③ 按钮文案要说的是「放大输入」而不是「全屏」（否则用户还会预期整页铺满）', () => {
  for (const [name, src] of PAGES) {
    assert.match(src, /title="放大输入框"/, `${name}：按钮 title 应为「放大输入框」`);
    assert.match(src, />放大输入</, `${name}：按钮文字应为「放大输入」`);
  }
});

test('④ 弹窗必须真的**把输入框变大**（这是它存在的全部理由）', () => {
  assert.ok(existsSync(new URL('../src/components/creation/PromptFocusModal.css', import.meta.url)),
    'PromptFocusModal.css 必须存在');
  // 页面里那块只有几行高；弹窗里必须显著更高
  const m = /min-height:\s*(\d+)px/.exec(modalCss.replace(/@media[\s\S]*$/, ''));
  assert.ok(m, '弹窗输入区必须有 min-height');
  assert.ok(Number(m[1]) >= 280, `弹窗输入区 min-height 应 >=280px（实际 ${m[1]}px）`);
});

test('⑤ 弹窗内容必须复用页面同一个输入组件（不是另写一个 textarea）', () => {
  /* 否则 @ 提及的蓝色高亮、字数上限、粘贴上传图片全都会与页面上那颗不一致 ——
     这正是批 CY-㉝ 那类「同一个东西两个实现」的根。 */
  assert.match(modal, /<MentionPromptField/, '弹窗内必须用 MentionPromptField');
  assert.match(modal, /import MentionPromptField from '\.\/MentionPromptField\.jsx'/, '必须静态引入那一个组件');
  assert.doesNotMatch(modal, /<textarea/, '不得另写一个 textarea');
});

test('⑥ Esc 关闭 + 点遮罩关闭（弹窗的基本礼仪）', () => {
  assert.match(modal, /event\.key === 'Escape'/, '必须支持 Esc 关闭');
  assert.match(modal, /event\.target === event\.currentTarget/, '点遮罩空白处应关闭');
  assert.match(modal, /createPortal\(/, '必须 portal 到 body（否则会被父级 overflow 裁掉）');
});

test('⑦ 视频页保留 @ 引用；图片页不凭空加（两页输入形态不同，别硬凑成一样）', () => {
  /* 视频页的提示词是 MentionPromptField（有 @ 引用）；
     图片页的是**普通 textarea**（`xhs-prompt-field`）⇒ 弹窗里传 mentions=[]、不接 onFilesPasted。 */
  assert.match(video, /mentions=\{mentionedAssets\}/, '视频页弹窗要带上 @ 引用数据源');
  assert.match(video, /onFilesPasted=\{/, '视频页弹窗要能粘贴上传素材');
  assert.doesNotMatch(image, /mentions=\{mentionedAssets\}/,
    '图片页没有 mentionedAssets 这份数据（它的提示词是普通 textarea），别硬塞');
  assert.doesNotMatch(image, /onFilesPasted=\{/,
    '图片页不支持粘贴上传素材，别凭空加');
});

test('⑧ 旧的 fullscreenchange 监听先保留但不得再驱动交互（避免连带删掉在用的 CSS）', () => {
  /* `is-fullscreen` 那套 CSS（VideoStudio.css:137-157）还挂在 fullscreen state 上，
     一次删干净会变成孤儿样式。本批只保证它**不再驱动任何交互**。 */
  for (const [name, src] of PAGES) {
    assert.doesNotMatch(src, /aria-pressed=\{fullscreen\}/,
      `${name}：按钮的 aria-pressed 不得再读 fullscreen（它恒为 false）`);
  }
});
