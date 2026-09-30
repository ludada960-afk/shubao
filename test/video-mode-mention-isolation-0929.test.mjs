import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ');
const read = p => strip(readFileSync(new URL('../' + p, import.meta.url), 'utf8'));
const vs = read('src/pages/VideoStudio/index.jsx');
const field = read('src/components/creation/MentionPromptField.jsx');

/* ══════════════════════════════════════════════════════════════════════════════
   智能成片 / 首尾帧 两档的 @ 提及不得互相串（批 CY-㉝）

   用户 2026-09-30 逐字：
     「我在首尾帧那边上传了一张图片，然后在 @ 按钮里面添加了一个图片的样式到了输入框这里。
       为什么我切换到智能成片这边，他这个样式还是会跟着过来啊。
       ……一定要把它们给分开呀，绝对不能够共同使用呀，共同使用就会乱掉的。」

   逐条核对后的真实情况（**和用户的猜测不完全一样，如实记**）：
     · **@ 菜单本身是分开的** —— `mentionedAssets` 按 mode 分支：
         frame 档只列 files.first / files.last；其余档只列 materialEntries。
       用户看到菜单里没有「图片1」了，所以问题不在菜单。
     · **真正被共用、并且串档的是提示词框**：prompt 是这一层的单一 state，
       两档共用；首尾帧档 @ 进去的「@图片1」写进了 prompt，
       切到智能成片后那串文字还在 —— 而它指向的条目**在另一档不存在**
       ⇒ 一个悬空引用。
   ══════════════════════════════════════════════════════════════════════════════ */

test('① @ 菜单按档分支（这条本来就是对的，钉住别被改坏）', () => {
  assert.match(vs, /if \(mode === 'frame'\) \{[\s\S]{0,300}files\.first, \.\.\.files\.last/, 'frame 档只列首尾帧');
  assert.match(vs, /const mentionedAssets = useMemo\(\(\) => \{[\s\S]{0,120}if \(mode === 'frame'\)/, 'mentionedAssets 必须按 mode 分支');
});

test('② 切档必须清掉提示词（那串 @ 提及在另一档是悬空引用）', () => {
  assert.match(vs, /const switchVideoMode = nextMode => \{[\s\S]{0,600}?setMode\(nextMode\)/,
    '必须有 switchVideoMode');
  const body = vs.slice(vs.indexOf('const switchVideoMode'), vs.indexOf('const switchVideoMode') + 700);
  assert.match(body, /setPrompt\(''\)/,
    '切档必须清空 prompt —— @ 提及属于上一个档的素材清单');
  // 页签必须走这个函数，而不是各自 setMode
  assert.match(vs, /onClick=\{\(\) => \{\s*if \(mode !== item\.id\) switchVideoMode\(item\.id\);/,
    '页签点击必须走 switchVideoMode');
  assert.doesNotMatch(vs, /onClick=\{\(\) => \{ setPlanReviewed\(false\); setMode\(item\.id\); \}\}/,
    '旧写法（只 setMode 不清提示词）必须已消失');
});

test('③ 只清提示词、**不清素材**（素材本来就是分桶的，切回去还能用）', () => {
  const body = vs.slice(vs.indexOf('const switchVideoMode'), vs.indexOf('const switchVideoMode') + 700);
  assert.doesNotMatch(body, /setFiles\(|clearMaterials\(/,
    '切档**不得**清空素材 —— 那会让用户白白丢掉已上传的东西');
  // 而素材确实是分桶的（两档各存各的）
  assert.match(vs, /mode === 'frame'\s*\?\s*\{ first: files\.first, last: files\.last, images: \[\], videos: \[\], audios: \[\] \}/,
    '提交时两档取的素材本就不同 —— 佐证「素材是分桶的、只需清提示词」');
});

test('④ 不得用 promptFieldRef.current?.setValue?.() —— 那个 API 不存在，静默无效', () => {
  /* 写第一版时我按这个写的：`MentionPromptField` 是**受控**组件
     （`value={prompt}` + `onChange`），useImperativeHandle 只暴露了
     `focus()` 与 `insertMention()`，**没有 setValue**。
     `?.` 会把不存在的属性安静吞掉 ⇒ 一行看起来对、实际什么都没做的代码。 */
  assert.doesNotMatch(field, /setValue\s*[:(]/,
    'MentionPromptField 没有 setValue 这个 API（它只暴露 focus/insertMention）');
  assert.doesNotMatch(vs, /promptFieldRef\.current\?\.setValue/,
    '不得调用不存在的 setValue —— 那是静默无效的写法');
  assert.match(field, /useImperativeHandle\(ref, \(\) => \(\{[\s\S]{0,400}insertMention\(/,
    '受控组件的 imperative 面只有 focus + insertMention，清空只能走 state');
});