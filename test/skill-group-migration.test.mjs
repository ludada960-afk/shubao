import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { ensureSkillSchema, ensureDefaultSkillGroups } from '../server/skills/schema.mjs';
import { createSkillStore } from '../server/skills/skillStore.mjs';

test('migrates a pre-group user_skills table in place (production rollback case)', () => {
  const db = new Database(':memory:');
  // create the OLD shape exactly as shipped before 2026-09-10
  db.exec(`
    CREATE TABLE user_skills (
      id TEXT PRIMARY KEY,
      owner_email TEXT NOT NULL,
      kind TEXT NOT NULL CHECK(kind IN ('image','video','canvas','copy')),
      name TEXT NOT NULL,
      summary TEXT NOT NULL DEFAULT '',
      body TEXT NOT NULL,
      params_json TEXT NOT NULL DEFAULT '{}',
      version INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','archived')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  db.prepare(`INSERT INTO user_skills (id, owner_email, kind, name, summary, body, created_at, updated_at)
    VALUES ('usk_old', 'old@test.com', 'image', '旧技能', '', '正文', datetime('now'), datetime('now'))`).run();
  ensureSkillSchema(db);
  const store = createSkillStore(db);
  const rows = store.listSkills({ ownerEmail: 'old@test.com' });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].groupId, '');
  const groups = store.listGroups({ ownerEmail: 'old@test.com' });
  assert.equal(groups.filter(group => group.name === '主图').length, 1);
});
