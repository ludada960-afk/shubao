import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { createSkillStore } from '../server/skills/skillStore.mjs';
import { validateUserSkill } from '../server/skills/skillValidation.mjs';
import { listBuiltinSkills, getBuiltinSkill } from '../server/skills/skillCatalog.mjs';
import { SKILL_LIMITS } from '../server/skills/skillValidation.mjs';

function makeStore() {
  const db = new Database(':memory:');
  return { db, store: createSkillStore(db) };
}

const validSkill = {
  kind: 'image',
  name: '数码产品氛围',
  summary: '冷色调科技感',
  body: '- 模块名: 数码产品氛围\n- 画面任务: 突出金属质感与冷色光影',
  groupId: '',
};

test('default groups are seeded on first list and skills can join them', () => {
  const { store } = makeStore();
  const groups = store.listGroups({ ownerEmail: 'a@test.com' });
  const names = groups.map(group => group.name);
  for (const expected of ['主图', '详情图', '小红书', '视频']) {
    assert.ok(names.includes(expected), `missing default group ${expected}`);
  }
  const mainGroup = groups.find(group => group.name === '主图');
  const created = store.createSkill({ ownerEmail: 'a@test.com', skill: { ...validSkill, groupId: mainGroup.id } });
  assert.equal(created.groupId, mainGroup.id);
  assert.equal(created.groupName, '主图');
  const listed = store.listSkills({ ownerEmail: 'a@test.com', kind: 'image' });
  assert.equal(listed.length, 1);
  assert.equal(listed[0].groupName, '主图');
});

test('a groupId owned by another user is rejected (owner isolation)', () => {
  const { store } = makeStore();
  const otherGroup = store.listGroups({ ownerEmail: 'owner-b@test.com' })[0];
  assert.equal(store.resolveGroupId({ ownerEmail: 'owner-a@test.com', groupId: otherGroup.id }), '',
    'foreign groupId must resolve to empty');
});

test('users can create their own groups and archive them (skills fall back to ungrouped)', () => {
  const { store } = makeStore();
  const group = store.createGroup({ ownerEmail: 'a@test.com', name: '数码产品' });
  assert.equal(group.name, '数码产品');
  const created = store.createSkill({ ownerEmail: 'a@test.com', skill: { ...validSkill, groupId: group.id } });
  assert.equal(created.groupName, '数码产品');
  store.archiveGroup({ ownerEmail: 'a@test.com', id: group.id });
  const after = store.getSkill({ ownerEmail: 'a@test.com', id: created.id });
  assert.equal(after.groupId, '', 'skills must survive group deletion as ungrouped');
  assert.equal(after.groupName, '');
});

test('groupId passes through validation untouched (route layer owns the ownership check)', () => {
  const result = validateUserSkill({ ...validSkill, groupId: 'skg_whatever' });
  assert.equal(result.ok, true);
  assert.equal(result.skill.groupId, 'skg_whatever');
});

test('every builtin skill ships a full prompt body within the injection limit', () => {
  const builtins = listBuiltinSkills();
  assert.equal(builtins.length, 7);
  for (const skill of builtins) {
    assert.ok(skill.body && skill.body.trim().length > 100, `builtin ${skill.id} body too short`);
    assert.ok(skill.body.length <= SKILL_LIMITS.body, `builtin ${skill.id} body exceeds user limit`);
    const fetched = getBuiltinSkill(skill.id);
    assert.equal(fetched.body, skill.body);
  }
  // 派生即所得：内置正文必须与用户技能同一校验规则兼容（无越权指令）
  for (const skill of builtins) {
    const result = validateUserSkill({ kind: skill.kind, name: `${skill.name} 副本`, summary: skill.summary, body: skill.body });
    assert.equal(result.ok, true, `builtin ${skill.id} body must pass user-skill validation: ${result.message}`);
  }
});
