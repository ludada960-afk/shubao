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

test('④ 不许照抄「可勾选模块」：张数与报价由方案算死，勾选会让钱对不上', () => {
  assert.doesNotMatch(skills + media, /selectedModules|moduleSelector|包含模块/);
  for (const skill of IMAGE_SKILLS) {
    assert.equal(skill.selectableModules, undefined, skill.id + ' 不许出现可勾选模块');
  }
  assert.match(read('docs/design/47-quantv-workbench-teardown.md'), /明确不照抄/, '拆解文档要写清哪些没抄、为什么');
});