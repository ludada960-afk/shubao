// server/billing/h3InviteCodes.mjs
// 2026-08-26 周一切片 · §6 #7 H3-2K 灰度邀请制
// -----------------------------------------------------------------------------
// 风险：首账单未校准即公开 = 成本估错 = 毛利跳崖。
// 默认建议：灰度邀请制 50 人 7 天 → 全量公开；邀请名单从内测账号 2 人 +
// 抖音/小红书薯包粉丝优先。落地：本表 + admin 批量生成 + 公开端校验。
// -----------------------------------------------------------------------------
// 设计要点：
//   1) 邀请码仅是「白名单凭证」，不含购买动作；公开端用 validateH3InviteCode
//      验证后决定是否放行 H3 SKU（video_minimax_h3_2k_short/long）下单。
//   2) 表结构：code 唯一、owner_email 可空（用于兑换后绑定）、max_uses / used_count
//      支持一次性码和 N 次码；status 防止恶意码被禁用；expires_at 灰度窗收口。
//   3) batchCreateH3InviteCodes 给 admin 用；CSV 导出走纯函数（tests/前端可调）。
//   4) consumeH3InviteCode 严格事务：used_count 单调递增、过期 / 用尽 / 停用都拒。
// -----------------------------------------------------------------------------
import { randomBytes } from 'node:crypto';

const SAFE_CODE = /^[A-Z0-9]{6,32}$/;
const SAFE_EMAIL = /^[^\s@]+@[^\s@]+$/;
const TABLE = 'h3_2k_invite_codes';

function normalizeCode(value) {
  if (typeof value !== 'string') return '';
  return value.trim().toUpperCase();
}

function normalizeEmail(value) {
  if (typeof value !== 'string') return '';
  return value.trim().toLowerCase();
}

function ensureH3InviteSchema(db) {
  if (!db || typeof db.exec !== 'function') throw new TypeError('db is required');
  db.exec(`
    CREATE TABLE IF NOT EXISTS ${TABLE} (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      cohort TEXT NOT NULL DEFAULT 'gray',
      max_uses INTEGER NOT NULL DEFAULT 1,
      used_count INTEGER NOT NULL DEFAULT 0,
      owner_email TEXT NOT NULL DEFAULT '',
      note TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      expires_at TEXT NOT NULL,
      consumed_at TEXT NOT NULL DEFAULT ''
    );
    CREATE INDEX IF NOT EXISTS idx_h3_invite_status ON ${TABLE}(status, expires_at);
    CREATE INDEX IF NOT EXISTS idx_h3_invite_owner ON ${TABLE}(owner_email);
  `);
}

function generateH3InviteCode() {
  // 8 位 base32-like（去除易混字符 0/O/1/I/L），大写，无歧义。
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(8);
  let out = '';
  for (let i = 0; i < 8; i += 1) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

function listH3InviteCodes(db, { limit = 100, offset = 0 } = {}) {
  const rows = db.prepare(`
    SELECT id, code, cohort, max_uses, used_count, owner_email, note, status,
      created_at, expires_at, consumed_at
    FROM ${TABLE} ORDER BY created_at DESC, rowid DESC LIMIT ? OFFSET ?
  `).all(limit, offset);
  return rows.map(row => ({ ...row }));
}

function getH3InviteCode(db, code) {
  const normalized = normalizeCode(code);
  if (!SAFE_CODE.test(normalized)) return null;
  return db.prepare(`SELECT * FROM ${TABLE} WHERE code = ?`).get(normalized) || null;
}

function batchCreateH3InviteCodes(db, {
  count = 50,
  maxUses = 1,
  cohort = 'gray',
  note = '',
  expiresAt,
  actorEmail = 'admin',
} = {}) {
  ensureH3InviteSchema(db);
  if (!Number.isSafeInteger(count) || count <= 0 || count > 500) {
    throw Object.assign(new TypeError('count must be 1..500'), { code: 'H3_INVITE_INVALID' });
  }
  if (!Number.isSafeInteger(maxUses) || maxUses <= 0 || maxUses > 10000) {
    throw Object.assign(new TypeError('maxUses must be 1..10000'), { code: 'H3_INVITE_INVALID' });
  }
  const expires = String(expiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()).slice(0, 19).replace('T', ' ');
  const insert = db.prepare(`
    INSERT INTO ${TABLE} (id, code, cohort, max_uses, used_count, owner_email, note, status, expires_at)
    VALUES (?, ?, ?, ?, 0, '', ?, 'active', ?)
  `);
  const created = [];
  const transaction = db.transaction(() => {
    for (let i = 0; i < count; i += 1) {
      let code = generateH3InviteCode();
      // 极端小概率冲突：再生成一次
      while (db.prepare(`SELECT 1 FROM ${TABLE} WHERE code = ?`).get(code)) {
        code = generateH3InviteCode();
      }
      const id = `h3invite-${Date.now().toString(36)}-${i.toString(36)}`;
      insert.run(id, code, String(cohort).slice(0, 64) || 'gray', maxUses, String(note).slice(0, 500), expires);
      created.push({ id, code, cohort: String(cohort).slice(0, 64) || 'gray', maxUses, note, expiresAt: expires });
    }
  });
  transaction();
  return { count: created.length, actorEmail, createdAt: new Date().toISOString(), codes: created };
}

// 公开端 / 业务端校验：返回结构化结果而非抛错，方便上游直接转 4xx 响应。
// status: 'ok' | 'missing' | 'expired' | 'exhausted' | 'disabled' | 'invalid'
function validateH3InviteCode(db, code) {
  const normalized = normalizeCode(code);
  if (!SAFE_CODE.test(normalized)) {
    return { status: 'invalid', code: normalized, message: '邀请码格式不合法' };
  }
  if (!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(TABLE)) {
    // 表未建（早期环境）：保守拒绝
    return { status: 'missing', code: normalized, message: '灰度中，请联系 wx 申请' };
  }
  const row = db.prepare(`SELECT * FROM ${TABLE} WHERE code = ?`).get(normalized);
  if (!row) return { status: 'missing', code: normalized, message: '灰度中，请联系 wx 申请' };
  if (row.status !== 'active') return { status: 'disabled', code: normalized, message: '邀请码已停用' };
  const expiresAt = Date.parse(String(row.expires_at || '').replace(' ', 'T') + 'Z');
  if (Number.isFinite(expiresAt) && expiresAt < Date.now()) {
    return { status: 'expired', code: normalized, message: '邀请码已过期' };
  }
  if (row.used_count >= row.max_uses) {
    return { status: 'exhausted', code: normalized, message: '邀请码已被使用' };
  }
  return { status: 'ok', code: normalized, cohort: row.cohort, maxUses: row.max_uses, usedCount: row.used_count };
}

// 消费码：订单成交时调用，把 used_count+1 并绑定 ownerEmail；返回结构化结果。
function consumeH3InviteCode(db, { code, ownerEmail, referenceId = '' } = {}) {
  const normalized = normalizeCode(code);
  const email = normalizeEmail(ownerEmail);
  if (!SAFE_CODE.test(normalized)) {
    return { status: 'invalid', message: '邀请码格式不合法' };
  }
  if (!SAFE_EMAIL.test(email)) {
    return { status: 'invalid_email', message: 'ownerEmail is invalid' };
  }
  // 事务包装：db.transaction 返回的函数在调用时拿不到内部 return（better-sqlite3 实现），
  // 用 closure 把 result 抬到事务外。
  let result = { ok: false, status: 'invalid', message: '邀请码格式不合法' };
  const transaction = db.transaction(() => {
    const row = db.prepare(`SELECT * FROM ${TABLE} WHERE code = ?`).get(normalized);
    if (!row) {
      result = { ok: false, status: 'missing', message: '灰度中，请联系 wx 申请' };
      return;
    }
    if (row.status !== 'active') {
      result = { ok: false, status: 'disabled', message: '邀请码已停用' };
      return;
    }
    const expiresAt = Date.parse(String(row.expires_at || '').replace(' ', 'T') + 'Z');
    if (Number.isFinite(expiresAt) && expiresAt < Date.now()) {
      result = { ok: false, status: 'expired', message: '邀请码已过期' };
      return;
    }
    if (row.used_count >= row.max_uses) {
      result = { ok: false, status: 'exhausted', message: '邀请码已被使用' };
      return;
    }
    const consumedAt = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const nextOwner = row.owner_email || email;
    db.prepare(`
      UPDATE ${TABLE}
      SET used_count = used_count + 1,
          owner_email = ?,
          consumed_at = CASE WHEN consumed_at = '' THEN ? ELSE consumed_at END
      WHERE code = ? AND used_count < max_uses
    `).run(nextOwner, consumedAt, normalized);
    result = { ok: true, code: normalized, ownerEmail: nextOwner, referenceId };
  });
  transaction();
  return result;
}

// 公开端友好文案（业务侧直接拼到错误响应或 Toast）。
function grayPhaseMessage(validation) {
  switch (validation.status) {
    case 'invalid':
    case 'missing':
      return '灰度中，请联系 wx 申请';
    case 'expired':
      return '邀请码已过期，请联系 wx 续期';
    case 'exhausted':
      return '邀请码已被使用，请联系 wx 申请新码';
    case 'disabled':
      return '邀请码已停用，请联系 wx 确认';
    case 'ok':
      return null;
    default:
      return '灰度中，请联系 wx 申请';
  }
}

// 导出 CSV：与 admin 邀请码生成器配套使用；行尾 \n，列顺序固定。
function exportH3InviteCodesCsv(rows) {
  const header = ['id', 'code', 'cohort', 'max_uses', 'used_count', 'owner_email', 'note', 'status', 'created_at', 'expires_at', 'consumed_at'];
  const escape = value => {
    const str = String(value ?? '');
    return /[",\n]/.test(str) ? '"' + str.replace(/"/g, '""') + '"' : str;
  };
  const lines = [header.join(',')];
  for (const row of rows) {
    lines.push(header.map(key => escape(row[key])).join(','));
  }
  return lines.join('\n') + '\n';
}

export const H3_INVITE = Object.freeze({
  table: TABLE,
  defaultCohort: 'gray',
  defaultMaxUses: 1,
  defaultBatchSize: 50,
  defaultExpiresInDays: 7,
});

export {
  ensureH3InviteSchema,
  generateH3InviteCode,
  listH3InviteCodes,
  getH3InviteCode,
  batchCreateH3InviteCodes,
  validateH3InviteCode,
  consumeH3InviteCode,
  grayPhaseMessage,
  exportH3InviteCodesCsv,
};
