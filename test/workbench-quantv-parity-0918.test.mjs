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
test('④ 可勾选模块仍然不许出现（清单只读是因为钱：张数与报价由方案算死）', () => {
  for (const skill of IMAGE_SKILLS) {
    assert.equal(skill.selectableModules, undefined, skill.id + ' 不许出现可勾选模块');
  }
  /* 声明源里的 modules 只能是"名称 + 一句说明"（只读清单的内容），不许带 checked/selected/quantity */
  for (const skill of IMAGE_SKILLS) {
    for (const item of (skill.modules || [])) {
      assert.equal(item.checked, undefined, skill.id + ' 的模块不许带勾选状态');
      assert.equal(item.quantity, undefined, skill.id + ' 的模块不许带张数（张数由方案算）');
    }
  }
  /* 页面侧：不许有"已选模块"这种状态参与计价 */
  assert.doesNotMatch(media, /selectedModules|moduleSelection|选中模块/);
  assert.doesNotMatch(media, /modules[\s\S]{0,120}(quantity|points)\s*[:=]/, '模块不许参与张数/报价计算');
  /* 只读清单必须渲染成静态结构（li），不是按钮 */
  const shell = read('src/components/media/WorkbenchShell.jsx');
  const checklist = shell.slice(shell.indexOf('media-workbench-checklist-items'), shell.indexOf('media-workbench-checklist-items') + 900);
  assert.match(checklist, /<li key=\{item\.name\}>/, '清单条目必须是 li（静态），不许是可点的 button');
  assert.match(checklist, /media-workbench-checklist-check/, '每条前面一个勾（照竞品形态），但不可点');
  assert.match(read('docs/design/47-quantv-workbench-teardown.md'), /明确不照抄/, '拆解文档要写清哪些没抄、为什么');
});