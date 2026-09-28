/* ══════════════════════════════════════════════════════════════════════════════════════════════
   2026-09-28 批 CY-⑥ 门禁：设计风格那一格的**整颗动作按钮**（照知渔：芯片下面那颗）

   用户原话（逐字，7 张批注图第 3 条）：
     「你看一下**人家 AI 推荐风格**，它这里是有个按钮的。他点击这个按钮才会生成结果在这里啊。
       他这个按钮其实就跟右上角那个 AI 推荐应该是同一个按钮的。」「你这里为什么跟他不一样呢？
       **不是说要照抄吗**？照抄你为什么抄着抄着又抄的不对呢？」

   知渔实测（CDP 只读：`.qa/cy5-quantv-style.mjs` + `cy5-quantv-style-frame.mjs`，?tool=product-listing-set）：
     div.rounded-xl.bg-gray-50（灰底圆角容器，padding 9.92）
       ├ 三档芯片「AI推荐 / 参考排版 / 自定义要求」各 160×45
       ├ 结论区（99px，空着等结论）—— 我们这边就是「设计风格要求」那个 textarea
       └ button「AI推荐风格分析 · 0.10 积分」272×45，父层 justify-content: center（**居中**）
           h-9=45 / min-w-[180px] / px-5(19.84) / rounded-lg(9.92) / margin-top 19.84
     他们标签行右端另有一颗小胶囊「AI推荐 · 0.10 积分」177×35（= 我们行内那颗的对应物）
     ⇒ 用户说"同一个按钮"：两颗调的是同一件事；我们缺的是**芯片下面那颗整颗的**。

   我方实测（`.qa/cy6-style-big-button.mjs`，/image-creation?id=image.product_suite，1440）：
     按钮 188×45 · 圆角 10 · 居中偏差 **0px** · 价钱在按钮上；
     三档逐档点过（点芯片不花钱）：AI推荐档按钮上方是「设计风格要求」框、参考排版档上方是
     「风格/排版参考图」上传框、自定义要求档上方是「设计要求」框 —— 都是"**该档内容在上、按钮在下**"。

   ⚠️ 判据钉的是**渲染规则本身**（分段字段 + 挂它的可运行动作），不是某一页的硬编码；
      这样以后加别的分段字段只要声明了 anchor，就自动拿到同一颗按钮，不会再各自长一个样子。
   ══════════════════════════════════════════════════════════════════════════════════════════════ */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8');
const shell = () => read('src/components/media/WorkbenchShell.jsx');
const css = () => read('src/components/media/WorkbenchShell.css');

test('① 只有「分段档位」+ 挂它的**可运行**动作才多渲染这颗（其余字段渲染一个字不变）', () => {
  const jsx = shell();
  assert.match(jsx, /function bigActionAfter\(groups, actions = \[\]\)/, '规则抽成一个纯函数（可读、可测）');
  const fn = jsx.slice(jsx.indexOf('function bigActionAfter'), jsx.indexOf('export default function WorkbenchShell'));
  assert.match(fn, /if \(field\.kind !== 'segmented'\) return;/, '只认分段档位字段（风格三档这一族）');
  assert.match(fn, /actions\.find\(a => a\.anchor === field\.key && a\.runnable\)/,
    '只认**声明了 anchor 且可运行**的动作 —— 接不通的动作仍旧走"静态说明行"，不许伪装成按钮');
  assert.match(fn, /visibleWhen\?\.key === field\.key/,
    '"档内容块" = 该字段 + 紧跟其后、visibleWhen.key 指向它的那一串（声明源里就是"切这档换出的内容"）');
  assert.match(fn, /out\.set\(group\.fields\[last\]\.key, action\)/,
    '按钮挂在**这一档内容块的最后一项**后面 —— 也就是"结果框在上、按钮在下"（与知渔同构）');
});

test('② 复用已有的整颗按钮样式与同一份 action（不新造一套、不复制一条调用链）', () => {
  const jsx = shell();
  const render = jsx.slice(jsx.indexOf('const bigAction = bigActions.get(field.key)'), jsx.indexOf('</React.Fragment>'));
  assert.match(render, /<React\.Fragment key=\{field\.key\}>/, '字段与按钮要同处一个 Fragment（网格里成一项）');
  assert.match(render, /className=\{'media-workbench-paid' \+ \(bigAction\.busy \? ' is-busy' : ''\)\}/,
    '按钮本体复用 `.media-workbench-paid`（45px 高 / 圆角 10 / 价钱写在按钮里 —— 与知渔那颗逐值同档）');
  assert.doesNotMatch(render, /media-workbench-action-button|media-workbench-big/,
    '不许为这一颗另起一个新类名（那就是"两套东西"的开头）');
  assert.match(render, /onClick=\{\(\) => bigAction\.onRun\?\.\(\)\}/, '点它走的是**同一个** onRun');
  assert.match(render, /\{bigAction\.points != null && <em>\{bigAction\.points\} 积分<\/em>\}/,
    '价钱必须写在按钮上（本仓铁律），且用的是声明里的那个数（不许在渲染层另算）');
  assert.match(jsx, /const bigActions = bigActionAfter\(groups, paidActions\);/,
    '动作来源就是同一份 paidActions（没有第二份真相）');
  assert.match(jsx, /\{groups\.map\(\(group, index\) => \(/, '分组只算一次（原来在 JSX 里现算 groupFields）');
});

test('③ 那一行的几何：跨两列 + 居中（知渔那颗父层就是 justify-content: center）', () => {
  const style = css();
  const rule = (style.match(/\.media-workbench-field-action \{[^}]*\}/) || [''])[0];
  assert.ok(rule, '.media-workbench-field-action 必须有样式');
  assert.match(rule, /grid-column: 1 \/ -1;/, '在这一栏里跨两列（不能被压成半宽）');
  assert.match(rule, /display: flex;/);
  assert.match(rule, /justify-content: center;/, '居中（知渔实测父层就是居中，不是左对齐）');
  /* 间距不另写：字段网格自己的行距就是它（批 BF 定的"站内一致优先于照抄竞品的具体数字"） */
  assert.match(style, /\.media-workbench-fields \{ display: grid;[^}]*gap: 18px 13px; \}/,
    '与上面内容的间距用字段网格自己的行距（18px，与知渔那 19.84 同档）');
});

test('④ 视频侧不受影响：那边没有 anchor 声明的付费动作 ⇒ 这条规则不会在那儿冒出新按钮', () => {
  const videoSkills = read('src/skills/videoSkills.js');
  assert.doesNotMatch(videoSkills, /anchor:/, '视频侧技能声明里没有 anchor（付费动作走的是别的一套），规则天然不触发');
  const videoPage = read('src/pages/VideoStudio/index.jsx');
  assert.doesNotMatch(videoPage, /anchor: '/, '视频侧的 paidActions 也不带 anchor');
});
