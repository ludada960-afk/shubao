/* ═══ 「AI 结论框」门禁 —— 2026-09-29 批 DC 续-8 **整条反转**（推翻批 CY-⑪）══════════════════════════
   批 CY-⑪ 当时守的是「空态不渲染」，用户 2026-09-28 的原话里**有一半是对的、有一半是错的**：

   ✅ 仍然成立的一半：「他应该是一个一键解析风格的按钮**在中心**」
      ⇒ 按钮居中、落在**这一档内容框的下方**（`.media-workbench-field-action`），这一条保留不动。

   ❌ 被推翻的一半：「设计风格要求它**不应该是一个提示词输入框**」⇒ 把输入框拿掉。
      同一位用户 2026-09-29 逐字改回（完整）：
      「你看他们的做法是这里会有一个相应的**提示词输入框的一个背景**。然后中间再去放这个一键生成的这个按钮。
        它的逻辑就是当用户点击这个按钮之后，它会生成出来的内容就是在这个框里面，然后是以**提示词输入区
        的那个形式**把内容输入在里面的。**用户可以随时去改这个你生成出来的文字。你现在的情况就做的是不对的，
        就是你把这个文字输入框给拿掉了。**你要明白他跟第三个按钮的那个「自定义要求」，他们的逻辑其实是类似的，
        那个自定义要求就是用户他自己去写一段提示词。你这个一键分析的这个按钮，它是用来相当于由 AI 来给他写
        这个提示词。AI 去分析它上面给到的各种条件，不管是上传的素材图还是它的配置，由 AI 去帮他进行一个方案的
        分析。然后分析的结果就会给到这个位置的输入框里面的。」

   ⚠️ 为什么上一批的「同类排查」把结论搞反了：它是按 **placeholder 措辞**筛的
     （找"点…后结论会写在这里"这种句子）。而那句话之所以那么写，**正因为框一直在** ——
     框一直在，才需要告诉用户"点上面那颗会把结论写进来"。

   ⚠️ 支撑这次反转的证据在**竞品自己的 DOM**（docs/design/data/quantv-image-builtin-pages.json:46）：
     详情图那一页的顺序是 `爆款风格 / 参考·自定义风格 / **AI推荐风格选择** / 爆款风格分析 · 0.10积分`
     —— 那个**具名结论框在分析之前就渲染在页面上**，按钮在它下面。

   新判据守四件事：
     ① 引擎里**不再有** `hideWhenEmpty`（不留死分支）；
     ② 声明源：三处 AI 产出的结论框**都不标**它，且**都是可编辑的 textarea**；
     ③ 「哪一档才出现」仍由 `visibleWhen` 管（那一半是对的，必须还在）；
     ④ 按钮仍在**框的下方且居中**（点之前就看得见"框 + 按钮"这一对）。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = rel => readFileSync(new URL('../' + rel, import.meta.url), 'utf8');
const code = rel => read(rel).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

test('① 引擎里没有 hideWhenEmpty 了（推翻 CY-⑪，不留死分支）', () => {
  const renderer = code('src/components/media/FieldRenderer.jsx');
  assert.doesNotMatch(renderer, /field\.hideWhenEmpty/, '引擎分支必须删干净（留着就是一条没人调用的死代码）');
  assert.doesNotMatch(code('src/skills/imageSkills.js'), /hideWhenEmpty: true/, '声明源也不许再标');
  /* ⚠️ 与 visibleWhen 的分工没变：「哪一档才出现」仍然要判 —— 那一半 CY-⑪ 是对的。 */
  assert.match(renderer, /field\.visibleWhen && values/, 'visibleWhen 必须还在（决定这一档出不出现）');
});

test('② 三处 AI 结论框都是**常驻可编辑的 textarea**（点之前就在，点完可改）', () => {
  const skills = code('src/skills/imageSkills.js');
  const briefs = objectLiteralsStartingAt(skills, "{ key: 'styleBrief'");
  assert.equal(briefs.length, 3, '恰好三处（商品套图的设计风格要求 + A+/详情图的 AI推荐风格选择），实测 ' + briefs.length);
  for (const brief of briefs) {
    assert.match(brief, /kind: 'textarea'/, '结论框必须是一个 textarea（用户要能随时改）');
    assert.match(brief, /rows: \d/, '并且有高度（textarea 的形状）');
    assert.doesNotMatch(brief, /hideWhenEmpty/, '不许再空态隐藏');
    assert.match(brief, /placeholder: '点上面的「一键解析风格」/, 'placeholder 要说清"点上面那颗会写进来"（框一直在，这句话才成立）');
  }
  /* 「自定义要求」那两处是用户自己写的，从头到尾没有那个标记 —— 这一条两批都不变。 */
  const styleNote = skills.slice(skills.indexOf("key: 'styleNote'"), skills.indexOf("key: 'styleNote'") + 500);
  assert.doesNotMatch(styleNote, /hideWhenEmpty/, '「设计要求」是用户自己写的');
  assert.doesNotMatch(code('src/skills/videoWorkbenches.js'), /hideWhenEmpty/, '视频侧脚本框同理');
});

/** 从 `needle` 处的 `{` 开始**按花括号配对**取出整个对象字面量。
 *  ⚠️ 不能用 `/needle[\s\S]{0,N}?\}/` —— 声明里第一层就嵌了 `visibleWhen: { … }`，
 *    非贪婪会在那里截断，测到的只是半个对象（第一次写就踩了）。
 *    （与 RTK 里 EcCanvas 那条"提取函数体要配对取体"是同一条纪律。） */
function objectLiteralsStartingAt(src, needle) {
  const out = [];
  let from = 0;
  for (;;) {
    const at = src.indexOf(needle, from);
    if (at < 0) return out;
    let depth = 0;
    for (let i = at; i < src.length; i += 1) {
      if (src[i] === '{') depth += 1;
      else if (src[i] === '}') {
        depth -= 1;
        if (depth === 0) { out.push(src.slice(at, i + 1)); from = i + 1; break; }
      }
    }
    if (depth !== 0) return out;   // 没配平，宁可少收也不要收半截
  }
}

test('③ 按钮仍在**框的下方且居中**（点之前看到的是"框 + 按钮"这一对，不是一颗孤零零的按钮）', () => {
  const css = code('src/components/media/WorkbenchShell.css');
  const rule = (css.match(/\.media-workbench-field-action \{[^}]*\}/) || [''])[0];
  assert.match(rule, /justify-content: center;/, '动作行居中（知渔那颗就在正中）');
  assert.match(rule, /grid-column: 1 \/ -1;/, '并且跨两列（它是那一档内容的下沿，不是又一个字段）');
  const shell = code('src/components/media/WorkbenchShell.jsx');
  assert.match(shell, /bigActionAfter\(groups, paidActions\)/, '按钮的挂载规则仍在（CY-⑥ 那条）');
  assert.match(shell, /field\.kind !== 'segmented'/, '只挂分段档位字段（风格三档这一族）');
  /* ⚠️ 顺序是判据的一半：按钮必须落在**档内容块的最后一项之后** ——
     那样它在页面上就在框的下面。`while (last + 1 < ...)` 那段就是干这个的。 */
  assert.match(shell, /while \(last \+ 1 < group\.fields\.length && group\.fields\[last \+ 1\]\.visibleWhen\?\.key === field\.key\) last \+= 1;/,
    '按钮要挂在"档内容块"的最后一项上（那一项就是结论框）—— 否则顺序反了，按钮跑到框上面');
});

test('④ 自证：把 hideWhenEmpty 塞回声明源必须被判红（否则 ① 是空转）', () => {
  const original = read('src/skills/imageSkills.js');
  const broken = original.replace(/(kind: 'textarea', rows: \d, group: '产品卖点与设计风格',\n)/, "$1      hideWhenEmpty: true,\n");
  assert.notEqual(broken, original, '替换没生效，这条自证无效');
  const stripped = broken.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  assert.match(stripped, /hideWhenEmpty: true/, '塞回去竟然没被判红 ⇒ ② 是空转');
});
