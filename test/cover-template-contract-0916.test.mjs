import assert from 'node:assert/strict';
import test from 'node:test';

import { COVER_ASPECT, COVER_SIZE, COVER_TEMPLATES, COVER_ACCENTS, COVER_STYLE_RULES, IMAGE_COVER_PLAN, buildCoverPrompt } from '../src/skills/coverTemplates.js';
import { IMAGE_SKILLS } from '../src/skills/imageSkills.js';

/* ═══ 封面产线契约 ═══
   守两件事：① 每个 Skill 都有封面计划（否则 Hub 上会出现没有封面的空卡）；
   ② 提示词必须真的把 4:3、色相、标题、禁止项写进去（不能是个模板却少了关键约束）。 */

test('① 每个图片 Skill 都有封面计划，且模板/色相都在白名单里', () => {
  const planned = new Set(IMAGE_COVER_PLAN.map(item => item.skillId));
  for (const skill of IMAGE_SKILLS) {
    assert.ok(planned.has(skill.id), '缺封面计划的 Skill：' + skill.id);
  }
  const templates = new Set(COVER_TEMPLATES.map(item => item.id));
  const accents = new Set(Object.keys(COVER_ACCENTS));
  for (const item of IMAGE_COVER_PLAN) {
    assert.ok(templates.has(item.template), '未登记的模板：' + item.template);
    assert.ok(accents.has(item.accent), '未登记的色相：' + item.accent);
    assert.ok(item.title && item.title.length <= 8, '封面标题不得超过 8 字：' + item.skillId);
    assert.ok(item.subject && item.subject.length >= 6, '主体描述要具体，不能是空话：' + item.skillId);
  }
});

test('② 封面规格统一 4:3，且规则里写明了缩到卡片尺寸仍要认得出来', () => {
  assert.equal(COVER_ASPECT, '4:3');
  assert.deepEqual(COVER_SIZE, { width: 1600, height: 1200 });
  const rules = COVER_STYLE_RULES.join(' ');
  assert.match(rules, /4:3/);
  assert.match(rules, /274×205|274x205/, '必须写明缩到卡片尺寸仍可辨认');
  assert.match(rules, /水印|logo|二维码/, '必须写明禁用水印/logo/二维码');
});

test('③ 提示词真的带上了版式、色相、标题与禁止项', () => {
  const prompt = buildCoverPrompt({ template: 'case-3up', accent: 'warm', subject: '同一款商品的三种电商成品图', title: '电商套图', subtitle: '白底+场景+卖点成套' });
  assert.match(prompt, /4:3（1600×1200）|4:3\(1600×1200\)/);
  assert.match(prompt, /三张成品图/);
  assert.match(prompt, /暖调/);
  assert.match(prompt, /电商套图/);
  assert.match(prompt, /不要水印/);
  /* 未知模板/色相要回退到默认，而不是拼出半截提示词 */
  const fallback = buildCoverPrompt({ template: 'nope', accent: 'nope', subject: '主体' });
  assert.match(fallback, /三张成品图/);
  assert.match(fallback, /中性/);
});
