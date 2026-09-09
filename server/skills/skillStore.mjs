import { ensureSkillSchema } from './schema.mjs';

/**
 * 用户自建 Skill 存储（owner 隔离；归档式删除）
 * 所有写入前必须已通过 validateUserSkill()。
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
    version: row.version,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  } : null);

  function createSkill({ ownerEmail, skill }) {
    const email = String(ownerEmail || '').trim().toLowerCase();
    if (!email) throw new TypeError('ownerEmail is required');
    const id = `usk_${randomUUID()}`;
    const timestamp = now();
    db.prepare(`
      INSERT INTO user_skills (id, owner_email, kind, name, summary, body, params_json, version, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, 'active', ?, ?)
    `).run(id, email, skill.kind, skill.name, skill.summary || '', skill.body, JSON.stringify(skill.params || {}), timestamp, timestamp);
    return getSkill({ ownerEmail: email, id });
  }

  function getSkill({ ownerEmail, id }) {
    const email = String(ownerEmail || '').trim().toLowerCase();
    const row = db.prepare('SELECT * FROM user_skills WHERE id = ? AND owner_email = ?').get(String(id || ''), email);
    return rowToSkill(row);
  }

  function listSkills({ ownerEmail, kind = '', includeArchived = false } = {}) {
    const email = String(ownerEmail || '').trim().toLowerCase();
    if (!email) return [];
    const clauses = ['owner_email = ?'];
    const values = [email];
    if (kind) { clauses.push('kind = ?'); values.push(String(kind)); }
    if (!includeArchived) clauses.push("status = 'active'");
    const rows = db.prepare(`SELECT * FROM user_skills WHERE ${clauses.join(' AND ')} ORDER BY updated_at DESC`).all(...values);
    return rows.map(rowToSkill);
  }

  function updateSkill({ ownerEmail, id, skill }) {
    const email = String(ownerEmail || '').trim().toLowerCase();
    const existing = getSkill({ ownerEmail: email, id });
    if (!existing || existing.status !== 'active') return null;
    const timestamp = now();
    db.prepare(`
      UPDATE user_skills
         SET kind = ?, name = ?, summary = ?, body = ?, params_json = ?, version = version + 1, updated_at = ?
       WHERE id = ? AND owner_email = ?
    `).run(skill.kind, skill.name, skill.summary || '', skill.body, JSON.stringify(skill.params || {}), timestamp, String(id), email);
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

  return { createSkill, getSkill, listSkills, updateSkill, archiveSkill };
}
