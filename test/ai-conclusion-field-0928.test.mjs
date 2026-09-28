/* ═══ 批 CY-⑪ 门禁：**"AI 结论框"空态不渲染**（用户当面纠正）═══════════════════════════════════════
   用户原话（逐字）：「下面这个一键解析风格，它应该是在这个**设计风格要求**这里的。也就是说设计风格要求
     它**不应该是一个提示词输入框**。他应该是一个一键解析风格的按钮**在中心**……只有当用户点击这个
     一键解析风格的按钮之后，他才会去解析，解析之后的**生成结果才会出现在这个输入框里面**。
     你看一下知鱼他们就是这样做的呀。你是不是没有看你后面那个**自定义要求**，那个按钮里面是什么情况呀？
     那个自定义要求他才是你现在的这个情况呀，就是用户可以自动输入他想要的各种各样的提示词。」
   + 「你现在做的任何改动你都要搞明白，背后是很多部分可能都有类似的东西的，如果有类似的东西，那你就得
      类似的去改」（⇒ 本批按这条做了**同类排查**，见 ③）

   判据守三件事：
     ① 引擎能力："内容由动作产出的字段"（`hideWhenEmpty`）在空值时**整格不渲染**（文本按 trim、数组按长度）；
     ② 声明源：**三处**由 AI 产出的风格结论框都标了它；而**用户自己写**的那两处（自定义要求的设计要求、
        视频侧那个"可以自己写、也可以点生成脚本"的脚本框）**不许**标 —— 这条界线是用户原话划的；
     ③ 按钮那一格仍在（`.media-workbench-field-action` 居中），所以"点之前"看到的就是**一颗居中的按钮**。
   ══════════════════════════════════════════════════════════════════════════════════════════════ */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = rel => readFileSync(new URL('../' + rel, import.meta.url), 'utf8');
const code = rel => read(rel).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

test('① FieldRenderer 支持 hideWhenEmpty：空文本 / 空数组 / null 都不渲染，有内容才渲染', () => {
  const renderer = code('src/components/media/FieldRenderer.jsx');
  assert.match(renderer, /if \(field\.hideWhenEmpty\) \{/, '引擎里要有这一条');
  assert.match(renderer, /Array\.isArray\(value\)[\s\S]{0,80}value\.length === 0/, '数组类（上传位）按长度判空');
  assert.match(renderer, /value == null \|\| String\(value\)\.trim\(\) === ''/, '文本类按 trim 判空');
  /* 与 visibleWhen 是"与"的关系：先判档位、再判有没有内容（顺序不影响语义，但两条都要在） */
  const iVisible = renderer.indexOf('field.visibleWhen');
  const iEmpty = renderer.indexOf('field.hideWhenEmpty');
  assert.ok(iVisible > 0 && iEmpty > iVisible, '两条判定都要在（顺序：先档位、后空态）');
});

test('② 声明源：三处"AI 产出"的风格结论框都标了 hideWhenEmpty；用户自己写的那两处不标', () => {
  const skills = read('src/skills/imageSkills.js');
  const marked = skills.match(/hideWhenEmpty: true/g) || [];
  assert.equal(marked.length, 3, '恰好三处（设计风格要求 + 两处 AI推荐风格选择）—— 实测 '.concat(marked.length));
  /* 三处都是 styleBrief（由动作产出的结论框）。
     ⚠️ 窗口要留够：第一处 `styleBrief` 后面跟着一大段解释性注释（用户原话），400 字窗口会漏掉它。 */
  const briefs = skills.match(/\{ key: 'styleBrief'[\s\S]{0,1400}?hideWhenEmpty: true/g) || [];
  assert.equal(briefs.length, 3, '标在 styleBrief 上（内容由「一键解析风格/风格分析」产出）—— 实测 '.concat(briefs.length));
  /* ⚠️ 用户自己写的字段不许标：自定义要求档的「设计要求」 */
  const styleNote = skills.slice(skills.indexOf("key: 'styleNote'"), skills.indexOf("key: 'styleNote'") + 400);
  assert.doesNotMatch(styleNote, /hideWhenEmpty/, '「设计要求」是用户自己写的（用户原话点名过）—— 不许标');
  /* ⚠️ 视频侧那个脚本框也是"用户可自己写"⇒ 不标（它的 placeholder 明确写着"或点击…由 AI 帮你写"） */
  const video = read('src/skills/videoWorkbenches.js');
  assert.doesNotMatch(video, /hideWhenEmpty/, '视频侧脚本框不标：用户也能自己写（同类排查的结论）');
  assert.match(video, /或点击上面的「生成脚本」由 AI 帮你写/, '前提：它的 placeholder 明确写了"也可以自己写"');
});

test('③ 点之前那一格看到的是一颗**居中的按钮**（不是空输入框）', () => {
  const css = code('src/components/media/WorkbenchShell.css');
  const rule = (css.match(/\.media-workbench-field-action \{[^}]*\}/) || [''])[0];
  assert.match(rule, /justify-content: center;/, '动作行居中（知渔那颗就在正中）');
  const shell = code('src/components/media/WorkbenchShell.jsx');
  assert.match(shell, /bigActionAfter\(groups, paidActions\)/, '按钮的挂载规则仍在（CY-⑥ 那条）');
  assert.match(shell, /field\.kind !== 'segmented'/, '只挂分段档位字段（风格三档这一族）');
});
