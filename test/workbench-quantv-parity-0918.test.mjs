import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { stripComments } from '../scripts/lib/token-scope.mjs';
import { IMAGE_SKILLS, getImageSkill } from '../src/skills/imageSkills.js';
import { IMAGE_TYPES } from '../src/pages/Home/ec/ecommercePlanModel.js';

/* ═══ 工作台按技能定制（对齐竞品实测）═════════════════════════════════════════════
   取证见 docs/design/47-quantv-workbench-teardown.md（登录态 CDP 实访，一次只开一个标签页）。
   守四件事：① 上传位两个入口 + 竞品同款文案，而且写了可拖拽就真的能拖；
             ② 跨境刚需字段（目标市场 / 文案语言）真的进了提示词；
             ③ 示例区有编号交付清单，且套图的清单与方案真源同源；
             ④ **不许**把竞品那种可勾选模块搬过来（张数与报价由方案算死，可勾选会让钱对不上）。 */

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const field = read('src/components/media/FieldRenderer.jsx');
const workbench = read('src/pages/Home/SkillWorkbench.jsx');
const media = stripComments(read('src/pages/MediaCreation/index.jsx'));
const skills = stripComments(read('src/skills/imageSkills.js'));

test('① 上传位：一个框、两个入口、竞品同款文案，且真的实现了拖拽', () => {
  /* ═══ 2026-09-19 批 Q：这条的**判据没变**（两个入口 + 竞品同款文案 + 真能拖），
     变的是"竞品同款文案长什么样"这个事实。上一版上传位是「一个 + 卡 + 框外一颗从资产库选择」，
     文案拼成「点击或拖拽上传图片 · 最多 N 张」；知渔实测（.tmp/laoyu2/qy-suite-layout.json）是
     **一个虚线框**，框里两行固定原文 + 两颗按钮同一排：
       「点击或拖拽上传图片」/「支持 JPG、JPEG、PNG，单张不超过 10MB」/ 选择文件 / 从资产库选择。
     用户批注 #2-5 原话：「他们这个部分是一体的……上传素材，还有从资产库里面选择，
       他们是在同一个地方的呀。同一个框里面去进行的呀。」
     ⇒「最多 N 张」这句现在由**字段自己的 hint**（挂在框下面那行）承担，框内不再拼串。 */
  assert.match(field, /media-field-upload-box/, '上传位必须是一个框');
  assert.match(field, /点击或拖拽上传图片/);
  assert.match(field, /单张不超过 10MB/);
  assert.match(field, /从资产库选择/);
  /* 两颗按钮必须在**同一个框里**（框结束标签之前出现） */
  const boxBlock = field.slice(field.indexOf('media-field-upload-box'), field.indexOf('media-field-upload-actions'));
  assert.ok(boxBlock.length > 0, '框的结构必须存在');
  const buttonsBlock = field.slice(field.indexOf('media-field-upload-actions'));
  assert.match(buttonsBlock.slice(0, 900), /media-field-upload-add/, '「选择文件」在框内');
  assert.match(buttonsBlock.slice(0, 900), /media-field-upload-library/, '「从资产库选择」在框内');
  assert.match(field, /onDrop=\{event => \{/);
  assert.match(field, /onDragOver=\{event => \{/);
  assert.match(field, /handleFiles\(dropped\)/, '拖进来的文件必须走与「选择文件」同一条上传逻辑');
  /* 上限仍然要如实写在页面上（技能自己的 hint，例如「商品图会作为一组打包参考，最多 6 张」） */
  assert.match(skills, /最多 6 张/, '上传上限要写在字段说明里（用户看得见）');
});

test('② 跨境字段真的进了提示词（套图 / A+ / 详情图）', () => {
  for (const id of ['image.product_suite', 'image.aplus', 'image.detail_page']) {
    const skill = getImageSkill(id);
    const keys = skill.fields.map(item => item.key);
    assert.ok(keys.includes('market'), id + ' 缺目标市场');
    assert.ok(keys.includes('language'), id + ' 缺文案语言');
    assert.match(skill.brief, /\{\{market\}\}/, id + ' 的提示词必须真的用到目标市场');
    assert.match(skill.brief, /\{\{language\}\}/, id + ' 的提示词必须真的用到文案语言');
  }
});

test('③ 示例区有编号交付清单，且套图的清单与方案真源同源', () => {
  assert.match(workbench, /deliverables = \[\]/);
  assert.match(workbench, /skill-deliverable-list/);
  assert.match(workbench, /String\(index \+ 1\)\.padStart\(2, '0'\)/, '编号必须是 01/02 这种两位格式（照竞品）');
  assert.match(media, /import \{ IMAGE_TYPES \} from '\.\.\/Home\/ec\/ecommercePlanModel\.js'/);
  assert.match(media, /suiteRun\?\.plan\?\.images\?\.length/);
  assert.match(media, /IMAGE_TYPES\.find\(item => item\.key === image\.key\)/);
  assert.ok(IMAGE_TYPES.length >= 4, '方案真源里至少有 4 种图（白底/主图/透明/详情）');
  for (const id of ['image.aplus', 'image.detail_page', 'image.copy']) {
    const skill = getImageSkill(id);
    assert.ok(Array.isArray(skill.deliverables) && skill.deliverables.length >= 2, id + ' 缺交付清单');
    for (const item of skill.deliverables) assert.ok(String(item.name || '').length >= 2, id + ' 的交付项要有名字');
  }
});

/* ⚠️ 2026-09-18 批 F：这条断言**改了判据**（不是为了让测试过而回退 UI）。
   起因：用户批注 17 要求「示例区是一份编号清单……你要真的去抓他们的编号交付清单，照着做」，
   于是我们把竞品 A+ 页那 16 个模块逐条抄进了声明源（skill.modules），
   并在左栏渲染成**只读**清单（标题照他们的「包含模块」+「已选 16/16」）——
   用户看到的是"这一套会交出哪几样、全都交"。
   旧断言写的是 /包含模块/ 这四个字：它拦的是**字面量**，于是把只读清单也一起拦了。
   而这条门禁真正要守的是**机制**：勾选会改变张数与报价 = 钱会对不上。
   判据改成三条可执行、且咬住机制的断言：
     ① 声明源里不许有可勾选模块字段（selectableModules / 任何 modules 选项被当参数用）；
     ② 页面里不许有"已选模块 → 张数/报价"的计算（moduleSelection / selectedModules 参与 quantity/points）；
     ③ 只读清单必须是**不可点的静态结构**（li + span），不是按钮 —— 点了不能改价钱。
   这样才能同时满足"清单内容照抄"与"钱路不许被勾选改掉"。 */
test('④ 模块可勾选（用户 2026-09-19 批 I 亲自批准），勾选数与报价必须同源', () => {
  /* ═══ 2026-09-19 批 I-9：这条门禁**按用户指示反转**，原判据与理由是反的 ═══════════════════
     原判据：「可勾选模块仍然不许出现（清单只读是因为钱：张数与报价由方案算死）」。
     用户第 14 轮批注原话（就在那张 A+ 内容的截图上）：
       「这些按钮都是不能点击的，完全是死按钮……你连按钮都没法交互，
         那背后的生成逻辑肯定也是没打通的呀，要彻底的打通逻辑呀。」
       「选中多少个模块就是多少张，并且对应他自己的模块主题不是吗，
         为什么要自己写多少张的数量呢？」
     并在对话里明确批准：「『包含模块』的勾选框——让勾选真的生效（少勾一张、报价跟着变）是可以的」。
     ⚠️ 原来那条担心的**不是能不能点，是点了以后钱会不会对不上** —— 那个担心是对的。
        所以这一版不是删掉它，而是换成一组**咬住钱路**的断言：
          ① 声明源不许出现可勾选字段（勾选是界面状态，不是声明出来的字段）；
          ② 声明源里的 modules 仍然只能是「名称 + 一句说明」，不许带 checked/quantity；
          ③ 勾选数必须**唯一地**驱动张数（注入 effectiveValues.count），不许在页面里另算一份；
          ④ 报价必须从**同一个** effectiveValues 取数 —— 勾几个出几张、收几张的钱，同源；
             这才是原来那条门禁真正要守的东西（两个数字各自演化才是会出事的地方）；
          ⑤ 一个都不许勾到底：0 张不是一个能下单的请求。 */
  for (const skill of IMAGE_SKILLS) {
    assert.equal(skill.selectableModules, undefined, skill.id + ' 不许把勾选做成声明字段（勾选是界面状态）');
  }
  for (const skill of IMAGE_SKILLS) {
    for (const item of (skill.modules || [])) {
      assert.equal(item.checked, undefined, skill.id + ' 的模块声明不许带勾选状态');
      assert.equal(item.quantity, undefined, skill.id + ' 的模块声明不许带张数');
    }
  }
  /* ③ 勾选数 → 张数：唯一入口是注入 effectiveValues */
  /* ═══ 2026-09-24 批 AW：判据从 `Math.max(1, …)` 改成**如实取勾选数** ═══════════════════════════
     用户本轮拍板「包含模块跟他们一样做就好」——知渔实采那一块写的是「已选 **0/16**」，
     默认一个都不勾。于是：
       · `Math.max(1, …)` 那个兜底必须去掉（它会在"界面 0 张"时按 1 张跑，账实不符）；
       · ⑤「最后一个不许取消」随之作废 —— 0 张现在是**合法起点**，由 moduleGate 拦住 CTA。
     守的东西没变：勾选数仍然必须**唯一地**注入 effectiveValues.count，报价仍从同一份取数
     （下面 ④ 那条断言一个字未动）。改的是"0 个算不算合法"，那是用户的口径。 */
  assert.match(media, /skillModules\.length\) return \{ \.\.\.base, count: selectedModules\.length \}/,
    '勾选数必须以 count 注入 effectiveValues（张数的唯一真源，0 个也如实传下去）');
  /* ④ 报价从同一个 effectiveValues 取数 */
  assert.match(media, /skillPointsEstimate\(skill, effectiveValues\)/, '报价必须与张数同源（不许各算一份）');
  /* ⑤ 一个都不勾：CTA 必须被拦住，且给出一句人话（不许点了没反应，也不许按 1 张偷跑） */
  /* ⚠️ 2026-09-25 批 BO：文案改人话（**用户改向**，见 MediaCreation 的 gateHint 注释）。
     判据从"钉死那句话"改成"必须在模块闸门里给一句点名勾选的可读原因"—— 语义没放宽。 */
  assert.match(media, /moduleGate = skillModules\.length > 0 && selectedModules\.length === 0[\s\S]{0,120}勾选/,
    '0 个模块时要有一句可读的原因（点名"勾选"）');
  assert.match(media, /ctaDisabled=\{busy \|\| \(!handoff && \(!validation\.ok \|\| Boolean\(moduleGate\)\)\)\}/,
    '0 个模块必须禁用主 CTA');
  /* ⑤ 原来的「最后一个不许取消」在批 AW 作废：默认就是"一个都不勾"，
       那条禁令会让用户点了没反应。现在勾选开关只剩"点一下切换"这一个语义。 */
  assert.doesNotMatch(media, /next\.size >= skillModules\.length\) return previous/,
    '「最后一个不许取消」已随默认值一起删掉（默认 0/16，0 个是合法起点）');
  assert.match(media, /if \(next\.has\(name\)\) next\.delete\(name\); else next\.add\(name\);/, '勾选开关只做切换');
  /* 默认值：进页面时**一个都不勾**（知渔实采「已选 0/16」，用户批注「跟他们一样做就好」） */
  assert.match(media, /setModuleOff\(new Set\(skillModules\.map\(module => module\.name\)\)\)/,
    '默认一个都不勾（照知渔 0/16）');
  /* 清单必须是真能点的控件（用户批注 #10：死按钮） */
  const shell = read('src/components/media/WorkbenchShell.jsx');
  const start = shell.indexOf('media-workbench-checklist-items');
  const checklist = shell.slice(start, start + 2200);
  assert.match(checklist, /role="checkbox"/, '清单条目必须是 checkbox（用户 #10：不许是死按钮）');
  assert.match(checklist, /aria-checked=\{on\}/, '勾选态必须对读屏可见');
  assert.match(checklist, /section\.onToggle\?\.\(item\.name\)/, '点一下必须能改状态');
  assert.match(read('docs/design/47-quantv-workbench-teardown.md'), /明确不照抄/, '拆解文档要写清哪些没抄、为什么');
});