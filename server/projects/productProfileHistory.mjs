// server/projects/productProfileHistory.mjs
// 续命 P2：商品档案的 history 门面。
// 4c183cd4 时代 product_profile 修改是 DELETE+INSERT，旧版无法回看。
// 续命阶段改为 PATCH 不覆盖：先在 product_profile_history 落一条"前态"快照，
// 再执行现有的 UPDATE/DELETE/INSERT 流程，保留每次变化以便回看或回滚。

export const PRODUCT_PROFILE_HISTORY_KINDS = Object.freeze(['init', 'update', 'archive']);

function codedError(code, message) {
  return Object.assign(new Error(message), { code });
}

function parseJson(value, fallback) {
  try { return value ? JSON.parse(value) : fallback; } catch { return fallback; }
}

function normalizeKind(value) {
  const kind = String(value || '').trim().toLowerCase();
  if (!PRODUCT_PROFILE_HISTORY_KINDS.includes(kind)) {
    throw codedError('PRODUCT_PROFILE_HISTORY_KIND_INVALID', `unsupported change kind: ${value}`);
  }
  return kind;
}

function normalizeLimit(value) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) return 50;
  return Math.min(parsed, 200);
}

export function recordProductProfileHistory(db, {
  profileId,
  ownerEmail,
  changeKind,
  payload = null,
  actorEmail = '',
  createdAt = null,
  idFactory,
} = {}) {
  if (!db) throw new TypeError('db is required');
  const profileKey = String(profileId || '').trim();
  if (!profileKey) throw new TypeError('profileId is required');
  const owner = String(ownerEmail || '').trim().toLowerCase();
  if (!owner) throw new TypeError('ownerEmail is required');
  const kind = normalizeKind(changeKind);
  const when = String(createdAt || '').trim() || new Date().toISOString();
  const id = typeof idFactory === 'function'
    ? String(idFactory() || '').trim()
    : '';
  if (!id) throw new TypeError('idFactory is required');
  db.prepare(`INSERT INTO product_profile_history
    (id, profile_id, owner_email, change_kind, payload_json, actor_email, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
    id,
    profileKey,
    owner,
    kind,
    JSON.stringify(payload && typeof payload === 'object' ? payload : {}),
    String(actorEmail || '').trim().toLowerCase(),
    when,
  );
  return { id, profileId: profileKey, ownerEmail: owner, changeKind: kind, createdAt: when };
}

export function listProductProfileHistory(db, { profileId, limit = 50 } = {}) {
  if (!db) throw new TypeError('db is required');
  const profileKey = String(profileId || '').trim();
  if (!profileKey) throw new TypeError('profileId is required');
  const boundedLimit = normalizeLimit(limit);
  return db.prepare(`SELECT id, profile_id, owner_email, change_kind, payload_json, actor_email, created_at
    FROM product_profile_history
    WHERE profile_id = ?
    ORDER BY created_at DESC, id DESC
    LIMIT ?`).all(profileKey, boundedLimit).map(row => ({
    id: row.id,
    profileId: row.profile_id,
    ownerEmail: row.owner_email,
    changeKind: row.change_kind,
    payload: parseJson(row.payload_json, {}),
    actorEmail: row.actor_email || '',
    createdAt: row.created_at,
  }));
}
