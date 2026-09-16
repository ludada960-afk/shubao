import assert from 'node:assert/strict';
import test from 'node:test';

import {
  FIELD_KINDS,
  IMAGE_PIPELINES,
  IMAGE_SKILLS,
  IMAGE_SKILL_CATEGORIES,
  SKILL_COMPLEXITIES,
  getImageSkill,
} from '../src/skills/imageSkills.js';
import { readFileSync } from 'node:fs';

/* ═══ Skill 声明契约（2026-09-16 起）══════════════════════════════════════════════
   这一条守的是整个重构的**前提**：新增一个 Skill 只能加**声明**，不许加页面、不许手写控件。
   判的是什么：声明的形状是否合法（kind 必须是 FieldRenderer 支持的档位、pipeline 必须指向
   既有引擎、复杂度只能是三档之一、id 唯一且带板块前缀）。
   为什么用测试守：声明文件是 Hub 的唯一输入，它一旦长歪，后面 40 个 Skill 会一起歪。 */

test('① 每条声明形状合法：id 唯一、板块前缀、复杂度三档、pipeline 指向既有引擎', () => {
  assert.ok(IMAGE_SKILLS.length >= 7, '一期至少 7 条（简报口径）');
  const ids = new Set();
  for (const skill of IMAGE_SKILLS) {
    assert.match(skill.id, /^image\.[a-z0-9_]+$/, 'id 必须带板块前缀：' + skill.id);
    assert.equal(ids.has(skill.id), false, 'id 必须唯一：' + skill.id);
    ids.add(skill.id);
    assert.equal(skill.board, 'image');
    assert.ok(skill.name && skill.name.length <= 12, '名称要短（卡片上只放封面+标题）：' + skill.id);
    assert.ok(IMAGE_SKILL_CATEGORIES.includes(skill.category), '分类必须在声明里出现过');
    assert.ok(SKILL_COMPLEXITIES.includes(skill.complexity), '复杂度只能是三档：' + skill.id);
    assert.ok(IMAGE_PIPELINES.includes(skill.pipeline), 'pipeline 必须指向既有引擎（不重写）：' + skill.id);
    assert.ok(Array.isArray(skill.fields) && skill.fields.length >= 1, '至少要有一个字段：' + skill.id);
    assert.ok(skill.cover && skill.cover.template, '必须有封面模板：' + skill.id);
  }
});

test('② 字段只能用 FieldRenderer 登记过的档位（页面不得手写控件）', () => {
  for (const skill of IMAGE_SKILLS) {
    const kinds = new Set();
    for (const field of skill.fields) {
      assert.ok(FIELD_KINDS.includes(field.kind), '未登记的字段档位：' + skill.id + ' / ' + field.key + ' = ' + field.kind);
      assert.equal(kinds.has(field.key), false, '同一 Skill 内 key 必须唯一：' + skill.id + ' / ' + field.key);
      kinds.add(field.key);
      assert.ok(field.label && field.label.length <= 6, '字段名要极简（实测口径：就"比例""清晰度"这种）：' + skill.id + ' / ' + field.key);
      if (field.kind === 'stepper') assert.ok(Number(field.min) >= 1 && Number(field.max) >= Number(field.min), 'stepper 必须有合法区间：' + skill.id + ' / ' + field.key);
    }
  }
  /* 档位白名单必须与 FieldRenderer 实际支持的一致（两边不许各写一份） */
  const renderer = readFileSync('src/components/media/FieldRenderer.jsx', 'utf8');
  for (const kind of FIELD_KINDS) {
    if (kind === 'text') continue; /* text 是兜底分支，没有显式 if */
    assert.match(renderer, new RegExp("kind === '" + kind + "'"), 'FieldRenderer 必须实现 ' + kind);
  }
});

test('③ 复杂度分布符合简报：简单档真的简单、重档只有电商套图', () => {
  const heavy = IMAGE_SKILLS.filter(skill => skill.complexity === 'heavy').map(skill => skill.id);
  assert.deepEqual(heavy, ['image.product_suite'], '一期只有电商套图是 heavy');
  const simple = IMAGE_SKILLS.filter(skill => skill.complexity === 'simple');
  assert.ok(simple.length >= 3, '一期至少 3 个 simple');
  for (const skill of simple) {
    assert.ok(skill.fields.length <= 4, 'simple 档字段不得超过 4 个：' + skill.id);
  }
});

test('④ 取用接口稳定：未知 id 返回 null，不抛错也不返回半成品', () => {
  assert.equal(getImageSkill('image.free').name, '自由创作');
  assert.equal(getImageSkill('nope'), null);
  assert.equal(getImageSkill(undefined), null);
  assert.equal(getImageSkill('__proto__'), null);
});
