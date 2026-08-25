/**
 * P2 账号体系 — OAuth 身份与授权状态存储
 *
 * - auth_identities：第三方身份与 auth_users 绑定。(provider, provider_account_id)
 *   唯一；unionid 列为跨同主体应用的归并预留（微信 open/unionid 模型），
 *   归并顺序：同 provider+account -> 同 unionid -> 已验证邮箱命中既有用户 -> 新建用户。
 * - auth_oauth_states：authorize 阶段下发的 CSRF state（只存 sha256），单次消费、
 *   10 分钟过期，DB 化以支持多实例。
 */
import { createHash, randomBytes } from 'node:crypto';

export const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

function sha256Hex(value) {
  return createHash('sha256').update(String(value)).digest('hex');
}

function iso(ms) {
  return new Date(ms).toISOString();
}

function finiteNow(now) {
  const value = now();
  if (!Number.isFinite(value)) throw new TypeError('now must return a finite timestamp');
  return value;
}

function safeJson(value) {
  try {
    const text = JSON.stringify(value ?? {});
    return text && text.length <= 8000 ? text : '{}';
  } catch {
    return '{}';
  }
}

export function ensureOAuthSchema(db) {
  if (!db || typeof db.prepare !== 'function') {
    throw new TypeError('db must be a better-sqlite3 database');
  }
  db.exec(`
    CREATE TABLE IF NOT EXISTS provider_configs (
      provider TEXT PRIMARY KEY,
      enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN (0,1)),
      config_json TEXT NOT NULL DEFAULT '{}',
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS auth_identities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider TEXT NOT NULL,
      provider_account_id TEXT NOT NULL,
      unionid TEXT NOT NULL DEFAULT '',
      user_id INTEGER NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
      email TEXT NOT NULL DEFAULT '',
      nickname TEXT NOT NULL DEFAULT '',
      avatar_url TEXT NOT NULL DEFAULT '',
      raw_profile TEXT NOT NULL DEFAULT '{}',
      last_login_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(provider, provider_account_id)
    );
    CREATE INDEX IF NOT EXISTS idx_auth_identities_user ON auth_identities(user_id);
    CREATE INDEX IF NOT EXISTS idx_auth_identities_unionid ON auth_identities(unionid) WHERE unionid <> '';
    CREATE TABLE IF NOT EXISTS auth_oauth_states (
      state_hash TEXT PRIMARY KEY,
      provider TEXT NOT NULL,
      redirect_to TEXT NOT NULL DEFAULT '/',
      expires_at TEXT NOT NULL,
      consumed_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_auth_oauth_states_provider ON auth_oauth_states(provider, expires_at);
  `);
}

function shapeUser(row) {
  return row ? { id: row.id, email: row.primary_email, nickname: row.nickname } : null;
}

export function createOAuthStore(db, { now = Date.now, ensureUserByEmail, stateTtlMs = OAUTH_STATE_TTL_MS } = {}) {
  if (!db || typeof db.prepare !== 'function') {
    throw new TypeError('db must be a better-sqlite3 database');
  }
  if (typeof ensureUserByEmail !== 'function') {
    throw new TypeError('ensureUserByEmail(email) is required');
  }
  ensureOAuthSchema(db);

  // -- CSRF state（哈希落库，单次消费）--
  function issueState(providerId, { redirectTo = '/' } = {}) {
    const at = finiteNow(now);
    const raw = randomBytes(32).toString('base64url');
    let safeRedirect = String(redirectTo || '/');
    if (!safeRedirect.startsWith('/') || safeRedirect.startsWith('//')) safeRedirect = '/';
    db.prepare(`
      INSERT INTO auth_oauth_states (state_hash, provider, redirect_to, expires_at)
      VALUES (?, ?, ?, ?)
    `).run(sha256Hex(raw), String(providerId), safeRedirect.slice(0, 300), iso(at + stateTtlMs));
    return { state: raw, redirectTo: safeRedirect };
  }

  function consumeState(providerId, rawState) {
    if (typeof rawState !== 'string' || !rawState || rawState.length > 512) return null;
    const at = finiteNow(now);
    const hash = sha256Hex(rawState);
    const row = db.prepare('SELECT * FROM auth_oauth_states WHERE state_hash = ?').get(hash);
    if (!row || row.provider !== String(providerId)) return null;
    // 原子单次消费：并发重放同一 state 只有一个请求能置位。
    const claimed = db.prepare(
      'UPDATE auth_oauth_states SET consumed_at = ? WHERE state_hash = ? AND consumed_at IS NULL',
    ).run(iso(at), hash).changes;
    if (claimed !== 1) return null;
    if (Date.parse(row.expires_at) <= at) return null;
    return { provider: row.provider, redirectTo: row.redirect_to };
  }

  function purgeExpiredStates() {
    return db.prepare('DELETE FROM auth_oauth_states WHERE expires_at <= ?')
      .run(iso(finiteNow(now))).changes;
  }

  // -- 身份绑定（unionid 归并预留）--
  function upsertIdentity(profile) {
    const provider = String(profile?.provider || '').trim();
    const providerAccountId = String(profile?.providerAccountId ?? profile?.providerUserId ?? '').trim();
    if (!provider || !providerAccountId) {
      throw Object.assign(new Error('OAuth profile 缺少 provider 或账号标识'), { code: 'AUTH_OAUTH_PROFILE_INVALID' });
    }
    const at = iso(finiteNow(now));
    const email = String(profile.email || '').trim().toLowerCase();
    const nickname = String(profile.nickname || '').trim().slice(0, 64);
    const avatarUrl = String(profile.avatarUrl || '').trim().slice(0, 500);
    const unionid = String(profile.unionid || '').trim();

    return db.transaction(() => {
      const existing = db.prepare(
        'SELECT * FROM auth_identities WHERE provider = ? AND provider_account_id = ?',
      ).get(provider, providerAccountId);
      if (existing) {
        db.prepare(`
          UPDATE auth_identities SET
            email = ?,
            nickname = CASE WHEN ? <> '' THEN ? ELSE nickname END,
            avatar_url = CASE WHEN ? <> '' THEN ? ELSE avatar_url END,
            unionid = CASE WHEN ? <> '' THEN ? ELSE unionid END,
            last_login_at = ?
          WHERE provider = ? AND provider_account_id = ?
        `).run(email, nickname, nickname, avatarUrl, avatarUrl, unionid, unionid, at, provider, providerAccountId);
        const row = db.prepare('SELECT * FROM auth_users WHERE id = ?').get(existing.user_id);
        const identityRow = db.prepare('SELECT * FROM auth_identities WHERE id = ?').get(existing.id);
        return { user: shapeUser(row), identityRow, created: false, mergedByEmail: false };
      }
      // unionid 归并预留：同主体另一身份已绑定用户时挂到同一用户下。
      let userId = null;
      if (unionid) {
        userId = db.prepare(
          'SELECT user_id FROM auth_identities WHERE unionid = ? ORDER BY id LIMIT 1',
        ).get(unionid)?.user_id || null;
      }
      let mergedByEmail = false;
      if (!userId && email) {
        // 仅显式声明 emailVerified 的 profile 才与既有邮箱账号归并，防未验证邮箱劫持。
        const candidate = db.prepare('SELECT * FROM auth_users WHERE primary_email = ?').get(email);
        if (candidate && profile.emailVerified === true) {
          userId = candidate.id;
          mergedByEmail = true;
        }
      }
      if (!userId) {
        let primaryEmail = '';
        if (email) {
          const emailTaken = db.prepare('SELECT id FROM auth_users WHERE primary_email = ?').get(email);
          // 已验证邮箱可直接建/并；未验证邮箱若已被占用必须走隔离占位邮箱，防止账号劫持。
          primaryEmail = (!emailTaken || profile.emailVerified === true)
            ? email
            : (provider + '-' + sha256Hex(providerAccountId).slice(0, 16) + '@' + provider + '.oauth.local');
        } else {
          primaryEmail = provider + '-' + sha256Hex(providerAccountId).slice(0, 16) + '@' + provider + '.oauth.local';
        }
        const ensured = ensureUserByEmail(primaryEmail, { nickname: nickname || undefined });
        userId = ensured.id;
      }
      const result = db.prepare(`
        INSERT INTO auth_identities (
          provider, provider_account_id, unionid, user_id, email, nickname, avatar_url, raw_profile, last_login_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(provider, providerAccountId, unionid, userId, email, nickname, avatarUrl, safeJson(profile.raw), at);
      return {
        user: shapeUser(db.prepare('SELECT * FROM auth_users WHERE id = ?').get(userId)),
        identityRow: db.prepare('SELECT * FROM auth_identities WHERE id = ?').get(result.lastInsertRowid),
        created: true,
        mergedByEmail,
      };
    })();
  }

  function listIdentitiesByUser(userId) {
    return db.prepare(
      'SELECT id, provider, provider_account_id AS providerAccountId, unionid, email, nickname, avatar_url AS avatarUrl, last_login_at AS lastLoginAt FROM auth_identities WHERE user_id = ? ORDER BY id',
    ).all(userId);
  }

  return { issueState, consumeState, purgeExpiredStates, upsertIdentity, listIdentitiesByUser, _internal: { sha256Hex } };
}