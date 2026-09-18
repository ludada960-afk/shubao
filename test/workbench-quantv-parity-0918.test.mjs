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

test('① 上传位：两个入口 + 竞品同款文案，且真的实现了拖拽', () => {
  assert.match(field, /从资产库选择/);
  assert.match(field, /点击或拖拽上传图片/);
  assert.match(field, /最多 ' \+ maxImages \+ ' 张/);
  assert.match(field, /单张不超过 10MB/);
  assert.match(field, /onDrop=\{event => \{/);
  assert.match(field, /onDragOver=\{event => \{/);
  assert.match(field, /handleFiles\(dropped\)/, '拖进来的文件必须走与「选择文件」同一条上传逻辑');
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
  assert.match(media, /skillModules\.length\) return \{ \.\.\.base, count: Math\.max\(1, selectedModules\.length\) \}/,
    '勾选数必须以 count 注入 effectiveValues（张数的唯一真源）');
  /* ④ 报价从同一个 effectiveValues 取数 */
  assert.match(media, /skillPointsEstimate\(skill, effectiveValues\)/, '报价必须与张数同源（不许各算一份）');
  /* ⑤ 最后一个不许取消 */
  assert.match(media, /if \(next\.size >= skillModules\.length\) return previous;/, '不许把模块全部取消（0 张不能下单）');
  /* 清单必须是真能点的控件（用户批注 #10：死按钮） */
  const shell = read('src/components/media/WorkbenchShell.jsx');
  const start = shell.indexOf('media-workbench-checklist-items');
  const checklist = shell.slice(start, start + 2200);
  assert.match(checklist, /role="checkbox"/, '清单条目必须是 checkbox（用户 #10：不许是死按钮）');
  assert.match(checklist, /aria-checked=\{on\}/, '勾选态必须对读屏可见');
  assert.match(checklist, /section\.onToggle\?\.\(item\.name\)/, '点一下必须能改状态');
  assert.match(read('docs/design/47-quantv-workbench-teardown.md'), /明确不照抄/, '拆解文档要写清哪些没抄、为什么');
});