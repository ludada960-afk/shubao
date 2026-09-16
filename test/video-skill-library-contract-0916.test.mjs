import assert from 'node:assert/strict';
import test from 'node:test';

import { VIDEO_SKILLS, VIDEO_CAPABILITIES, VIDEO_PIPELINES, VIDEO_AVAILABILITY, VIDEO_SKILL_CATEGORIES, getVideoSkill } from '../src/skills/videoSkills.js';
import { IMAGE_COVER_PLAN } from '../src/skills/coverTemplates.js';
import { FIELD_KINDS } from '../src/skills/imageSkills.js';

/* ═══ 视频 Skill 库契约 ═══
   用户批注（图 #9）：保留智能成片/首尾帧，爆款复刻转 skill；并要「找现在最前沿的视频 skill」。
   最容易犯的错是**把跑不通的玩法写成能用**（9-16 那批"8 条死路由"就是这么来的），
   所以本门禁把 availability 变成硬约束：声明里必须如实标注，且不许出现"未标注"的档位。 */

test('① 每条声明形状合法：id 前缀、复杂度、pipeline、封面、字段', () => {
  assert.ok(VIDEO_SKILLS.length >= 8, '一期视频 skill 至少 8 条');
  const ids = new Set();
  for (const skill of VIDEO_SKILLS) {
    assert.match(skill.id, /^video\.[a-z0-9_]+$/);
    assert.equal(ids.has(skill.id), false, 'id 唯一：' + skill.id);
    ids.add(skill.id);
    assert.equal(skill.board, 'video');
    assert.ok(VIDEO_SKILL_CATEGORIES.includes(skill.category));
    assert.ok(['simple', 'standard', 'heavy'].includes(skill.complexity));
    assert.ok(VIDEO_PIPELINES.includes(skill.pipeline), 'pipeline 必须指向既有引擎：' + skill.id);
    assert.ok(skill.cover && skill.cover.template);
    assert.ok(skill.fields.length >= 3, '视频 skill 至少要模型/清晰度/时长：' + skill.id);
    for (const field of skill.fields) {
      assert.ok(FIELD_KINDS.includes(field.kind), '未登记字段档位：' + skill.id + '/' + field.key);
      assert.ok(field.label.length <= 6, '字段名要短：' + skill.id + '/' + field.key);
    }
  }
});

test('② 能力标签必须在白名单，且"能不能真出片"必须如实标注', () => {
  for (const skill of VIDEO_SKILLS) {
    assert.ok(Array.isArray(skill.capability) && skill.capability.length >= 1, '必须声明能力：' + skill.id);
    for (const cap of skill.capability) {
      assert.ok(VIDEO_CAPABILITIES.includes(cap), '未登记能力：' + skill.id + ' / ' + cap);
    }
    assert.ok(VIDEO_AVAILABILITY.includes(skill.availability), 'availability 必须如实标注：' + skill.id);
  }
  /* 一期必须至少有一条 ready 且覆盖智能成片与首尾帧（用户点名保留的两个入口） */
  assert.equal(getVideoSkill('video.smart').availability, 'ready');
  assert.equal(getVideoSkill('video.frame').availability, 'ready');
  /* blocked 的必须注明原因，不能只写一个词 */
  for (const skill of VIDEO_SKILLS.filter(item => item.availability === 'blocked')) {
    assert.ok(skill.summary && skill.summary.length > 4, 'blocked 也要写清用途：' + skill.id);
  }
});

test('③ 用词与入口口径：叫「首尾帧」不叫「参考」，爆款复刻已是 skill', () => {
  const names = VIDEO_SKILLS.map(skill => skill.name);
  assert.ok(names.includes('首尾帧'));
  assert.ok(names.includes('智能成片'));
  assert.ok(names.includes('爆款复刻'), '爆款复刻必须作为 skill 存在（用户批注 图#9）');
  for (const skill of VIDEO_SKILLS) {
    assert.doesNotMatch(skill.name, /^参考$/, '入口不许再叫「参考」（统一叫全能参考）');
  }
});

test('④ 未登记的 id 返回 null，不返回半成品', () => {
  assert.equal(getVideoSkill('video.smart').name, '智能成片');
  assert.equal(getVideoSkill('nope'), null);
  assert.equal(getVideoSkill('__proto__'), null);
});

test('⑤ 案例位为将来占位预留：允许为空，但必须是数组（Hub 渲染要能遍历）', () => {
  for (const skill of VIDEO_SKILLS) {
    assert.ok(Array.isArray(skill.cases), 'cases 必须是数组：' + skill.id);
  }
  assert.ok(IMAGE_COVER_PLAN.length >= 7, '图片侧封面计划仍在（两侧不能互相覆盖）');
});
