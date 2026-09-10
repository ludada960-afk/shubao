import { ensureSkillSchema, ensureDefaultSkillGroups } from './schema.mjs';

/**
 * 用户自建 Skill 存储（owner 隔离；归档式删除）
 * 所有写入前必须已通过 validateUserSkill()。
 * 2026-09-10：支持分组（group_id + skill_groups 表）。
 */
export function createSkillStore(db, {
  randomUUID = () => globalThis.crypto?.randomUUID?.() || String(Date.now()),
  now = () => new Date().toISOString(),
} = {}) {
  if (!db || typeof db.prepare !== 'function') throw new TypeError('db must be a better-sqlite3 database');
  ensureSkillSchema(db);

  const rowToSkill = row => (row ? {
    id: row.id,
    ownerEmail: row.owner_email,
    kind: row.kind,
    name: row.name,
    summary: row.summary,
    body: row.body,
    params: (() => { try { return JSON.parse(row.params_json || '{}'); } catch { return {}; } })(),
    groupId: row.group_id || '',
    groupName: row.group_name || '',
    version: row.version,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  } : null);

  const skillSelect = `
    SELECT user_skills.*, skill_groups.name AS group_name
      FROM user_skills
      LEFT JOIN skill_groups ON skill_groups.id = user_skills.group_id
     WHERE user_skills.id = ? AND user_skills.owner_email = ?
  `;

  function createSkill({ ownerEmail, skill }) {
    const email = String(ownerEmail || '').trim().toLowerCase();
    if (!email) throw new TypeError('ownerEmail is required');
    const id = `usk_${randomUUID()}`;
    const timestamp = now();
    db.prepare(`
      INSERT INTO user_skills (id, owner_email, kind, name, summary, body, params_json, version, status, created_at, updated_at, group_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, 'active', ?, ?, ?)
    `).run(id, email, skill.kind, skill.name, skill.summary || '', skill.body, JSON.stringify(skill.params || {}), timestamp, timestamp, skill.groupId || null);
    return getSkill({ ownerEmail: email, id });
  }

  function getSkill({ ownerEmail, id }) {
    const email = String(ownerEmail || '').trim().toLowerCase();
    const row = db.prepare(skillSelect).get(String(id || ''), email);
    return rowToSkill(row);
  }

  function listSkills({ ownerEmail, kind = '', includeArchived = false } = {}) {
    const email = String(ownerEmail || '').trim().toLowerCase();
    if (!email) return [];
    const clauses = ['user_skills.owner_email = ?'];
    const values = [email];
    if (kind) { clauses.push('user_skills.kind = ?'); values.push(String(kind)); }
    if (!includeArchived) clauses.push("user_skills.status = 'active'");
    const rows = db.prepare(`
      SELECT user_skills.*, skill_groups.name AS group_name
        FROM user_skills
        LEFT JOIN skill_groups ON skill_groups.id = user_skills.group_id
       WHERE ${clauses.join(' AND ')}
       ORDER BY user_skills.updated_at DESC
    `).all(...values);
    return rows.map(rowToSkill);
  }

  function updateSkill({ ownerEmail, id, skill }) {
    const email = String(ownerEmail || '').trim().toLowerCase();
    const existing = getSkill({ ownerEmail: email, id });
    if (!existing || existing.status !== 'active') return null;
    const timestamp = now();
    db.prepare(`
      UPDATE user_skills
         SET kind = ?, name = ?, summary = ?, body = ?, params_json = ?, version = version + 1, updated_at = ?, group_id = ?
       WHERE id = ? AND owner_email = ?
    `).run(skill.kind, skill.name, skill.summary || '', skill.body, JSON.stringify(skill.params || {}), timestamp, skill.groupId || null, String(id), email);
    return getSkill({ ownerEmail: email, id });
  }

  function archiveSkill({ ownerEmail, id }) {
    const email = String(ownerEmail || '').trim().toLowerCase();
    const existing = getSkill({ ownerEmail: email, id });
    if (!existing || existing.status !== 'active') return null;
    db.prepare("UPDATE user_skills SET status = 'archived', updated_at = ? WHERE id = ? AND owner_email = ?")
      .run(now(), String(id), email);
    return getSkill({ ownerEmail: email, id });
  }

  // ── 分组（2026-09-10）──
  function listGroups({ ownerEmail, includeArchived = false } = {}) {
    const email = String(ownerEmail || '').trim().toLowerCase();
    if (!email) return [];
    ensureDefaultSkillGroups(db, email, { now });
    const clauses = ['owner_email = ?'];
    if (!includeArchived) clauses.push("status = 'active'");
    const rows = db.prepare(`SELECT * FROM skill_groups WHERE ${clauses.join(' AND ')} ORDER BY created_at ASC, updated_at DESC`).all(email);
    return rows.map(row => ({
      id: row.id,
      key: row.key,
      name: row.name,
      kind: row.kind || '',
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  function createGroup({ ownerEmail, name, kind = '' }) {
    const email = String(ownerEmail || '').trim().toLowerCase();
    const label = String(name || '').trim().slice(0, 20);
    if (!email) throw new TypeError('ownerEmail is required');
    if (!label) throw Object.assign(new Error('分组名称不能为空'), { status: 400, code: 'SKILL_GROUP_NAME_REQUIRED' });
    const normalizedKind = ['image', 'video', 'canvas', 'copy'].includes(String(kind)) ? String(kind) : '';
    const key = `user_${randomUUID().slice(0, 8)}`;
    const timestamp = now();
    const id = `skg_${randomUUID()}`;
    try {
      db.prepare(`
        INSERT INTO skill_groups (id, owner_email, kind, key, name, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(id, email, normalizedKind, key, label, timestamp, timestamp);
    } catch (error) {
      if (String(error?.message || '').includes('UNIQUE')) {
        throw Object.assign(new Error('同名分组已存在'), { status: 409, code: 'SKILL_GROUP_EXISTS' });
      }
      throw error;
    }
    return getGroup({ ownerEmail: email, id });
  }

  function getGroup({ ownerEmail, id }) {
    const email = String(ownerEmail || '').trim().toLowerCase();
    const row = db.prepare('SELECT * FROM skill_groups WHERE id = ? AND owner_email = ?').get(String(id || ''), email);
    return row ? { id: row.id, key: row.key, name: row.name, kind: row.kind || '', status: row.status, createdAt: row.created_at, updatedAt: row.updated_at } : null;
  }

  function renameGroup({ ownerEmail, id, name }) {
    const email = String(ownerEmail || '').trim().toLowerCase();
    const label = String(name || '').trim().slice(0, 20);
    const existing = getGroup({ ownerEmail: email, id });
    if (!existing || existing.status !== 'active') return null;
    if (!label) throw Object.assign(new Error('分组名称不能为空'), { status: 400, code: 'SKILL_GROUP_NAME_REQUIRED' });
    db.prepare("UPDATE skill_groups SET name = ?, updated_at = ? WHERE id = ? AND owner_email = ?")
      .run(label, now(), String(id), email);
    return getGroup({ ownerEmail: email, id });
  }

  /** 删除分组（归档式）；组内技能回到未分组，不丢技能 */
  function archiveGroup({ ownerEmail, id }) {
    const email = String(ownerEmail || '').trim().toLowerCase();
    const existing = getGroup({ ownerEmail: email, id });
    if (!existing || existing.status !== 'active') return null;
    const timestamp = now();
    const tx = db.transaction(() => {
      db.prepare("UPDATE skill_groups SET status = 'archived', updated_at = ? WHERE id = ? AND owner_email = ?").run(timestamp, String(id), email);
      db.prepare("UPDATE user_skills SET group_id = NULL, updated_at = ? WHERE group_id = ? AND owner_email = ?").run(timestamp, String(id), email);
    });
    tx();
    return getGroup({ ownerEmail: email, id });
  }

  /** 校验 groupId 属于该 owner 且 active；返回 groupId 或 ''（无效一律清空，不让脏数据进库） */
  function resolveGroupId({ ownerEmail, groupId }) {
    const email = String(ownerEmail || '').trim().toLowerCase();
    const id = String(groupId || '').trim();
    if (!id) return '';
    const group = getGroup({ ownerEmail: email, id });
    return group && group.status === 'active' ? group.id : '';
  }

  return { createSkill, getSkill, listSkills, updateSkill, archiveSkill, listGroups, createGroup, getGroup, renameGroup, archiveGroup, resolveGroupId };
}
