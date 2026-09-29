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
     ④ 按钮仍在**框的下方且居中**（点之前就看得见"框 + 按钮"这一对）。

   ══════════════════════════════════════════════════════════════════════════════════════════
   ⚠️⚠️ 2026-09-29 批 DC 续-16：**②④ 两条又被同一位用户当面推翻**，这才是最终形状。
     「这个地方的确得有一个输入框，但是这个输入框它**不能是让用户能够随便在这里输入的**。
       他这个地方是要让用户点击这个一键解析的这个按钮之后，这个输入框才会被解锁出来，
       然后内容会自动生成在里面。这个输入框平时它是一个**被锁死的状态**，然后这个一键解析的
       按钮**出现在它的表面上**。……你点击之后，他是不是得有一个**正在分析**的一个过程。
       然后分析完之后，是不是结果就会全部出现在里面了？……如果他删除里面的内容的话，
       **能不能自动跳回原来这个框没解锁，然后表面有这个一键解析的按钮的这个状态呢？**」
     ⇒ ② 改成「**平时锁住、解锁后可改**」（不是"常驻可编辑"）；
       ④ 改成「按钮在**框的表面上**、解锁之后回到框下面」；
     ⇒ 用户自己写的「自定义要求」**不锁** —— 那正是两者的区别（用户原话点名了这一点）。
     ⇒ 锁不锁**由值是不是空推导**，所以"删光自动回锁"与"退出页面不留痕"都是免费的副产品。
   ══════════════════════════════════════════════════════════════════════════════════════════ */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = rel => readFileSync(new URL('../' + rel, import.meta.url), 'utf8');
const code = rel => read(rel).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/** 取一条 CSS 规则（`selector { … }`）的**声明块**，按花括号配对。
 *  ⚠️ 不能用 indexOf 切片：同一批 CSS 里同族选择器不止一条（`.media-field-gate` 与
 *    `.media-field-textarea.is-gated > …`、还有 media query 里的重复），按位置切会取到
 *    隔壁那一条，测出来的东西看着绿、其实没测到目标规则（0925 那条门禁栽过一次）。 */
function ruleBlock(css, selector) {
  const at = css.indexOf(selector + ' {');
  assert.ok(at >= 0, `CSS 里找不到规则 ${selector}`);
  const open = css.indexOf('{', at);
  let depth = 0;
  for (let i = open; i < css.length; i += 1) {
    if (css[i] === '{') depth += 1;
    else if (css[i] === '}') {
      depth -= 1;
      if (depth === 0) return css.slice(open + 1, i);
    }
  }
  throw new Error(`规则 ${selector} 的花括号不配对`);
}

test('① 引擎里没有 hideWhenEmpty 了（推翻 CY-⑪，不留死分支）', () => {
  const renderer = code('src/components/media/FieldRenderer.jsx');
  assert.doesNotMatch(renderer, /field\.hideWhenEmpty/, '引擎分支必须删干净（留着就是一条没人调用的死代码）');
  assert.doesNotMatch(code('src/skills/imageSkills.js'), /hideWhenEmpty: true/, '声明源也不许再标');
  /* ⚠️ 与 visibleWhen 的分工没变：「哪一档才出现」仍然要判 —— 那一半 CY-⑪ 是对的。 */
  assert.match(renderer, /field\.visibleWhen && values/, 'visibleWhen 必须还在（决定这一档出不出现）');
});

test('② 三处 AI 结论框都是「**平时锁住、点一下解锁**」的 textarea（批 DC 续-16 改写）', () => {
  const skills = code('src/skills/imageSkills.js');
  const briefs = objectLiteralsStartingAt(skills, "{ key: 'styleBrief'");
  assert.equal(briefs.length, 3, '恰好三处（商品套图的设计风格要求 + A+/详情图的 AI推荐风格选择），实测 ' + briefs.length);
  for (const brief of briefs) {
    assert.match(brief, /kind: 'textarea'/, '结论框必须是一个 textarea（解锁之后用户要能随时改）');
    assert.match(brief, /rows: \d/, '并且有高度（textarea 的形状）');
    assert.doesNotMatch(brief, /hideWhenEmpty/, '不许再空态隐藏 —— 框一直在，只是锁着');
    /* ═══ 批 DC 续-16：用户第二次当面指出，这一条才是对的形状 ═══════════════════════════════
       原话：「这个输入框它**不能是让用户能够随便在这里输入的**。他这个地方是要让用户点击这个
       一键解析的这个按钮之后，这个输入框才会被解锁出来……这个输入框平时它是一个**被锁死的状态**，
       然后这个一键解析的按钮**出现在它的表面上**。……不然你现在这个情况，这个AI推荐和自定义要求，
       他们岂不就同样的逻辑了？」
       ⇒ `gatedByAction` 是承重的那一位：FieldRenderer 靠它决定 readOnly 与表面按钮。 */
    assert.match(brief, /gatedByAction: 'style-analysis'/, '必须声明由哪颗付费动作解锁（gatedByAction）');
    assert.match(brief, /gatedPlaceholder: '/, '锁住态要有自己的 placeholder（那句按钮就在表面上，说"点上面"是错的）');
  }
  /* ⚠️ placeholder 措辞：按钮现在**在框表面上**，不再是"上面"。
     批 DC 续-8 写的是「点上面的「一键解析风格」」—— 那时按钮在框下面，这句才成立。 */
  assert.doesNotMatch(skills, /placeholder: '点上面的「一键解析风格」/, '按钮已经浮到框表面上了，不许再说"点上面"');
  assert.match(skills, /placeholder: 'AI 分析完会把结论写在这里/, '改成描述"会写进来"，因为入口就在这块表面上');

  /* 「自定义要求」那两处是用户自己写的，从头到尾没有那个标记 —— 这一条几批都不变。
     ⚠️ 用 `objectLiteralsStartingAt` 取**整个对象**，不要按固定长度切片：
        切片会一路吃到紧挨着的 `styleBrief` 声明（它就在下一行），于是
        「自定义档不许锁」这条反过来被 AI 档的 gatedByAction 判红。 */
  const notes = objectLiteralsStartingAt(skills, "{ key: 'styleNote'");
  assert.ok(notes.length >= 1, '至少要有一处「设计要求」');
  for (const note of notes) {
    assert.doesNotMatch(note, /hideWhenEmpty/, '「设计要求」是用户自己写的');
    assert.doesNotMatch(note, /gatedByAction/, '「设计要求」**不许**锁住 —— 那正是 AI 档与自定义档的区别');
  }
  assert.doesNotMatch(code('src/skills/videoWorkbenches.js'), /hideWhenEmpty/, '视频侧脚本框同理');
});

test('②-补 锁住态是**由值推出来的**，不是另开一个 state（删光自动回锁）', () => {
  const renderer = code('src/components/media/FieldRenderer.jsx');
  /* 判据必须同时看三样：声明要锁、有那颗按钮、**值是空的**。
     ⚠️ 少看一样都会出事：只看「声明 + 空值」而按钮没传进来 =
     用户被关进一个**没有出口**的只读框（WorkbenchShell 那侧用 key 比对兜住了这一支）。 */
  assert.match(
    renderer,
    /const gated = Boolean\(field\.gatedByAction\) && Boolean\(surfaceAction\) && !String\(text0\)\.trim\(\)/,
    '锁不锁 = 声明要锁 && 有那颗动作 && 值为空（少一条都会给出错的交互）',
  );
  assert.match(renderer, /readOnly: gated/, '锁住时 textarea 必须是 readOnly（不能打字）');
  assert.match(renderer, /\{!gated && \(\s*<PromptMetaRow/, '锁住时不渲染 @引用素材 / 放大 / 字数（空框上它们无事可做）');
  assert.match(renderer, /className=\{'media-field-textarea' \+ \(gated \? ' is-gated' : ''\)\}/, '锁住态要挂 is-gated（CSS 靠它上底色与居中按钮）');

  /* 表面那颗按钮与框下面那颗**必须是同一个 action 对象**，不能复制一份。 */
  const shell = code('src/components/media/WorkbenchShell.jsx');
  assert.match(shell, /const gateMatches = Boolean\(field\.gatedByAction\) && bigAction && bigAction\.key === field\.gatedByAction/,
    'gatedByAction 里那个 key 要与实际那颗 action 比对 —— 对不上就退回框下面，不许把别的动作浮上来');
  assert.match(shell, /surfaceAction=\{gatedEmpty \? bigAction : null\}/, '传下去的是同一个 bigAction 对象（同一次调用、同一个价钱）');
  assert.match(shell, /const showBigBelow = Boolean\(bigAction\) && !gatedEmpty/, '锁住时框下面那颗不许重复出现');

  /* CSS：按钮真的落在框**正中间**（用户原话「中间再去放这个按钮」）。 */
  const css = code('src/components/media/WorkbenchShell.css');
  const gate = ruleBlock(css, '.media-field-gate');
  assert.match(gate, /position: absolute; inset: 0/, '覆盖层要铺满整个框面');
  assert.match(gate, /place-items: center/, '按钮居中');
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
