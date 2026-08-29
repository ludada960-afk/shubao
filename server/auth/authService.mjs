/**
 * P1 认证底座 — 认证域服务
 *
 * 职责：
 * - auth_users / auth_credentials 用户与密码（scrypt，见 passwordCrypto.mjs）
 * - email_verification_codes：DB 化验证码（替换 mailService 内存 Map），≤5 次失败锁定
 * - password_reset_tokens：15 分钟一次性找回密码 token；重置成功即吊销该用户全部会话
 * - auth_sessions：可吊销服务端会话。access token(30min, 含 jti) + refresh token
 *   （默认 7 天 / 记住我 90 天）。刷新必轮换；已轮换/已吊销 token 再次出现视为重放，
 *   重放即吊销整个 family。
 * - createDualModeSessionTokens：存量 HMAC token 的 legacy 兼容分支
 *   （30 天宽限期内验证通过即换发新 session，见 recordAuthV2Cutover）。
 */
import { createHash, createHmac, randomBytes, randomInt, randomUUID, timingSafeEqual } from 'node:crypto';
import { ensureAuthSchema, recordAuthV2Cutover } from './authSchema.mjs';
import { assertPasswordPolicy, hashPassword, verifyPassword } from './passwordCrypto.mjs';

export const ACCESS_TOKEN_TTL_MS = 30 * 60 * 1000;
export const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const REMEMBER_REFRESH_TTL_MS = 90 * 24 * 60 * 60 * 1000;
export const RESET_TOKEN_TTL_MS = 15 * 60 * 1000;
export const CODE_TTL_MS = 5 * 60 * 1000;
export const CODE_RESEND_MS = 60 * 1000;
export const CODE_MAX_ATTEMPTS = 5;
export const LEGACY_GRACE_MS = 30 * 24 * 60 * 60 * 1000;
const LEGACY_DEVICE_TAG = 'legacy-migration';

function sha256Hex(value) {
  return createHash('sha256').update(String(value)).digest('hex');
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function codedError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function iso(ms) {
  return new Date(ms).toISOString();
}

// 4c183cd4 续命 dev 兜底：NODE_ENV !== 'production' 时，验证码 123456 视为开发者 mock。
// 仅当 process.env.NODE_ENV 严格不等于 'production' 才生效。生产环境不接受。
// 行为：跳过 DB 行查询与 hash 校验，但保留路由层 requireAccess 的账号白名单。
// 4c183cd4 时代 mailService.mjs 硬编码 code='123456' 入 codeStore，4c183cd4 续命迁到 DB 后
// 必须显式保留这个开发者友好入口，否则 dev 流程因为真实邮件无法触达而阻塞。
export const DEV_OTP_FALLBACK = '123456';
export function isDevMockOtp(value) {
  return process.env.NODE_ENV !== 'production' && String(value ?? '') === DEV_OTP_FALLBACK;
}
function finiteNow(now) {
  const value = now();
  if (!Number.isFinite(value)) throw new TypeError('now must return a finite timestamp');
  return value;
}

function nicknameFromEmail(email) {
  return (String(email || '').split('@')[0] || '').slice(0, 64);
}

export function createAuthService({
  db,
  secret,
  now = Date.now,
  accessTtlMs = ACCESS_TOKEN_TTL_MS,
  refreshTtlMs = REFRESH_TTL_MS,
  rememberRefreshTtlMs = REMEMBER_REFRESH_TTL_MS,
  resetTokenTtlMs = RESET_TOKEN_TTL_MS,
  codeTtlMs = CODE_TTL_MS,
  codeResendMs = CODE_RESEND_MS,
  codeMaxAttempts = CODE_MAX_ATTEMPTS,
  legacyGraceMs = LEGACY_GRACE_MS,
  codeGenerator = () => String(randomInt(0, 1_000_000)).padStart(6, '0'),
  tokenGenerator = () => randomBytes(48).toString('base64url'),
} = {}) {
  if (!db || typeof db.prepare !== 'function') throw new TypeError('db must be a better-sqlite3 database');
  const secretBuffer = Buffer.isBuffer(secret) ? Buffer.from(secret) : Buffer.from(String(secret || ''));
  if (secretBuffer.length < 32) throw new TypeError('auth service secret must be at least 32 bytes');
  if (typeof now !== 'function') throw new TypeError('now must be a function');
  ensureAuthSchema(db);
  const grace = recordAuthV2Cutover(db, { now, graceMs: legacyGraceMs });
  const legacyRenewalMemo = new Set();

  // ── 用户 ──
  function getUserByEmail(email) {
    const row = db.prepare('SELECT * FROM auth_users WHERE primary_email = ?').get(normalizeEmail(email));
    return row ? { id: row.id, email: row.primary_email, nickname: row.nickname, role: row.role, status: row.status } : null;
  }

  function ensureUserByEmail(email, { role = 'member', status = 'active', nickname } = {}) {
    const normalized = normalizeEmail(email);
    db.prepare(`
      INSERT INTO auth_users (primary_email, nickname, role, status)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(primary_email) DO UPDATE SET
        nickname = CASE WHEN excluded.nickname <> '' THEN excluded.nickname ELSE auth_users.nickname END,
        updated_at = datetime('now')
    `).run(normalized, String(nickname || '').trim().slice(0, 64) || nicknameFromEmail(normalized), role, status);
    return getUserByEmail(normalized);
  }

  // ── 密码凭据 ──
  async function setPassword(userId, password) {
    assertPasswordPolicy(password);
    const passwordHash = await hashPassword(password);
    db.prepare(`
      INSERT INTO auth_credentials (user_id, password_hash, password_updated_at)
      VALUES (?, ?, datetime('now'))
      ON CONFLICT(user_id) DO UPDATE SET
        password_hash = excluded.password_hash,
        password_updated_at = datetime('now')
    `).run(userId, passwordHash);
    return true;
  }

  function getCredential(userId) {
    return db.prepare('SELECT user_id, password_hash, password_updated_at FROM auth_credentials WHERE user_id = ?').get(userId) || null;
  }

  // ── 邮箱验证码（DB 化，≤5 次尝试锁定）──
  async function issueEmailCode(email, purpose = 'login', { code, deliver } = {}) {
    const normalized = normalizeEmail(email);
    if (!['login', 'register'].includes(purpose)) throw codedError('AUTH_CODE_PURPOSE_INVALID', '验证码用途不合法');
    const at = finiteNow(now);
    const existing = db.prepare('SELECT * FROM email_verification_codes WHERE email = ? AND purpose = ?')
      .get(normalized, purpose);
    if (existing && existing.next_send_at && Date.parse(existing.next_send_at) > at && !existing.consumed_at) {
      return {
        ok: true,
        reused: true,
        retryAfterSeconds: Math.max(1, Math.ceil((Date.parse(existing.next_send_at) - at) / 1000)),
      };
    }
    const value = typeof code === 'string' ? code : codeGenerator();
    db.prepare(`
      INSERT INTO email_verification_codes (email, purpose, code_hash, attempt_count, expires_at, next_send_at)
      VALUES (?, ?, ?, 0, ?, ?)
      ON CONFLICT(email, purpose) DO UPDATE SET
        code_hash = excluded.code_hash,
        attempt_count = 0,
        expires_at = excluded.expires_at,
        next_send_at = excluded.next_send_at,
        consumed_at = NULL,
        updated_at = datetime('now')
    `).run(
      normalized,
      purpose,
      sha256Hex(`${secretBuffer.toString('hex')}:${normalized}:${purpose}:${value}`),
      iso(at + codeTtlMs),
      iso(at + codeResendMs),
    );
    if (typeof deliver === 'function') await deliver(value);
    return { ok: true, reused: false, retryAfterSeconds: Math.max(1, Math.ceil(codeResendMs / 1000)) };
  }

  function consumeEmailCode(email, purpose, value) {
    const normalized = normalizeEmail(email);
    if (!['login', 'register'].includes(purpose)) throw codedError('AUTH_CODE_INVALID', '验证码错误或已过期');
    // 4c183cd4 续命 dev 兜底：NODE_ENV !== 'production' 时 123456 直接通过。
    // 先于过期/锁定判断，避免锁定状态阻塞 dev 用户。生产环境绝不开。
    if (isDevMockOtp(value)) {
      // 顺手清掉可能存在的旧 row，避免后续真实流程被旧 dev 兜底记录干扰
      db.prepare('DELETE FROM email_verification_codes WHERE email = ? AND purpose = ?').run(normalized, purpose);
      return { ok: true, email: normalized, devMock: true };
    }
    const at = finiteNow(now);
    const row = db.prepare('SELECT * FROM email_verification_codes WHERE email = ? AND purpose = ?')
      .get(normalized, purpose);
    if (!row || row.consumed_at) throw codedError('AUTH_CODE_INVALID', '验证码不存在或已过期');
    if (Date.parse(row.expires_at) <= at) {
      db.prepare('DELETE FROM email_verification_codes WHERE email = ? AND purpose = ?').run(normalized, purpose);
      throw codedError('AUTH_CODE_EXPIRED', '验证码已过期，请重新获取');
    }
    if (row.attempt_count >= codeMaxAttempts) {
      db.prepare('DELETE FROM email_verification_codes WHERE email = ? AND purpose = ?').run(normalized, purpose);
      throw codedError('AUTH_CODE_LOCKED', '尝试次数过多，请重新获取验证码');
    }
    const providedHash = Buffer.from(sha256Hex(`${secretBuffer.toString('hex')}:${normalized}:${purpose}:${String(value ?? '')}`));
    const storedHash = Buffer.from(row.code_hash);
    const matches = providedHash.length === storedHash.length && timingSafeEqual(providedHash, storedHash);
    if (!matches) {
      const attempts = row.attempt_count + 1;
      if (attempts >= codeMaxAttempts) {
        db.prepare('DELETE FROM email_verification_codes WHERE email = ? AND purpose = ?').run(normalized, purpose);
        throw codedError('AUTH_CODE_LOCKED', '尝试次数过多，请重新获取验证码');
      }
      db.prepare("UPDATE email_verification_codes SET attempt_count = ?, updated_at = datetime('now') WHERE email = ? AND purpose = ?")
        .run(attempts, normalized, purpose);
      throw codedError('AUTH_CODE_INVALID', '验证码错误');
    }
    db.prepare('DELETE FROM email_verification_codes WHERE email = ? AND purpose = ?').run(normalized, purpose);
    return { ok: true, email: normalized };
  }

  // ── 会话 ──
  function signAccessToken(payload) {
    const payloadPart = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = createHmac('sha256', secretBuffer).update(payloadPart).digest();
    return `${payloadPart}.${signature.toString('base64url')}`;
  }

  function sessionTtlMs(remember) {
    return remember ? rememberRefreshTtlMs : refreshTtlMs;
  }

  function issueSession(userOrEmail, { remember = false, device = '', ip = '' } = {}) {
    const user = typeof userOrEmail === 'object' && userOrEmail?.id
      ? userOrEmail
      : ensureUserByEmail(userOrEmail);
    const at = finiteNow(now);
    const jti = randomUUID();
    const familyId = randomUUID();
    const refreshToken = tokenGenerator();
    db.prepare(`
      INSERT INTO auth_sessions (jti, user_id, family_id, refresh_hash, device, ip, remember, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(jti, user.id, familyId, sha256Hex(refreshToken), String(device || '').slice(0, 200),
      String(ip || '').slice(0, 64), remember ? 1 : 0, iso(at + sessionTtlMs(remember)));
    return buildTokenPair(user, jti, refreshToken, at);
  }

  function buildTokenPair(user, jti, refreshToken, at) {
    const expSeconds = Math.floor((at + accessTtlMs) / 1000);
    const accessToken = signAccessToken({
      v: 2,
      sub: user.id,
      email: user.email,
      jti,
      iat: Math.floor(at / 1000),
      exp: expSeconds,
    });
    return {
      ok: true,
      user: { id: user.id, email: user.email, nickname: user.nickname },
      accessToken,
      refreshToken,
      token: accessToken,
      expiresAt: iso(expSeconds * 1000),
      accessExpiresAt: iso(expSeconds * 1000),
      refreshExpiresAt: db.prepare('SELECT expires_at FROM auth_sessions WHERE jti = ?').get(jti)?.expires_at || '',
    };
  }

  function verifyAccessToken(token) {
    const parts = typeof token === 'string' ? token.split('.') : [];
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      throw codedError('AUTH_SESSION_INVALID', 'Session token is invalid');
    }
    let payload;
    let providedSignature;
    try {
      payload = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
      providedSignature = Buffer.from(parts[1], 'base64url');
    } catch {
      throw codedError('AUTH_SESSION_INVALID', 'Session token is invalid');
    }
    const expectedSignature = createHmac('sha256', secretBuffer).update(parts[0]).digest();
    if (providedSignature.length !== expectedSignature.length
      || !timingSafeEqual(providedSignature, expectedSignature)) {
      throw codedError('AUTH_SESSION_INVALID', 'Session token signature is invalid');
    }
    if (payload?.v !== 2) throw codedError('AUTH_SESSION_INVALID', 'Session token is invalid');
    const at = finiteNow(now);
    if (payload.exp * 1000 <= at) throw codedError('AUTH_SESSION_EXPIRED', 'Session token has expired');
    const row = db.prepare('SELECT * FROM auth_sessions WHERE jti = ?').get(String(payload.jti || ''));
    if (!row || row.revoked_at) {
      throw codedError('AUTH_SESSION_REVOKED', 'Session has been revoked');
    }
    if (Date.parse(row.expires_at) <= at) {
      throw codedError('AUTH_SESSION_EXPIRED', 'Session has expired');
    }
    const user = db.prepare('SELECT * FROM auth_users WHERE id = ?').get(row.user_id);
    if (!user || user.status === 'suspended') {
      throw codedError('AUTH_SESSION_REVOKED', 'Account is suspended');
    }
    return { userId: user.id, email: user.primary_email, jti: row.jti, familyId: row.family_id };
  }

  function revokeFamily(familyId, { at = finiteNow(now) } = {}) {
    return db.prepare('UPDATE auth_sessions SET revoked_at = ? WHERE family_id = ? AND revoked_at IS NULL')
      .run(iso(at), familyId).changes;
  }

  function rotateRefreshToken(refreshToken, { ip = '', device = '' } = {}) {
    const hash = sha256Hex(refreshToken);
    const at = finiteNow(now);
    const current = db.prepare('SELECT * FROM auth_sessions WHERE refresh_hash = ?').get(hash);
    // 已轮换历史中的任何一代 token 再次出现即判重放，吊销整个 family。
    const replayed = current
      ? null
      : db.prepare('SELECT * FROM auth_refresh_history WHERE token_hash = ?').get(hash);
    if (replayed || (current && current.revoked_at)) {
      const familyId = (replayed || current).family_id;
      const revoked = revokeFamily(familyId, { at });
      throw Object.assign(codedError('AUTH_SESSION_REPLAY', '检测到令牌重用，相关会话已全部吊销'), { revoked });
    }
    if (!current) throw codedError('AUTH_SESSION_INVALID', 'Refresh token is invalid');
    if (current.revoked_at) throw codedError('AUTH_SESSION_REPLAY', '会话已吊销');
    if (Date.parse(current.expires_at) <= at) throw codedError('AUTH_SESSION_EXPIRED', 'Refresh token has expired');
    const user = db.prepare('SELECT * FROM auth_users WHERE id = ?').get(current.user_id);
    if (!user || user.status === 'suspended') throw codedError('AUTH_SESSION_REVOKED', 'Account is suspended');
    const nextRefreshToken = tokenGenerator();
    db.transaction(() => {
      db.prepare(`
        INSERT INTO auth_refresh_history (token_hash, jti, family_id)
        VALUES (?, ?, ?)
      `).run(current.refresh_hash, current.jti, current.family_id);
      db.prepare(`
        UPDATE auth_sessions SET
          refresh_hash = ?,
          last_refreshed_at = ?,
          expires_at = ?,
          ip = COALESCE(NULLIF(?, ''), ip)
        WHERE jti = ?
      `).run(sha256Hex(nextRefreshToken), iso(at), iso(at + sessionTtlMs(Boolean(current.remember))),
        String(ip || ''), current.jti);
    })();
    return buildTokenPair(
      { id: user.id, email: user.primary_email, nickname: user.nickname },
      current.jti,
      nextRefreshToken,
      at,
    );
  }

  function revokeAllUserSessions(userId, { at = finiteNow(now) } = {}) {
    return db.prepare('UPDATE auth_sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL')
      .run(iso(at), userId).changes;
  }

  function logoutByRefreshToken(refreshToken) {
    const hash = sha256Hex(refreshToken);
    const row = db.prepare('SELECT * FROM auth_sessions WHERE refresh_hash = ?')
      .get(hash)
      || db.prepare('SELECT s.* FROM auth_sessions s JOIN auth_refresh_history h ON h.jti = s.jti WHERE h.token_hash = ?')
        .get(hash);
    if (!row) return { ok: true, revoked: 0 };
    const revoked = db.prepare('UPDATE auth_sessions SET revoked_at = ? WHERE jti = ? AND revoked_at IS NULL')
      .run(iso(finiteNow(now)), row.jti).changes;
    return { ok: true, revoked };
  }

  // ── P2 设备管理：会话列表与单设备吊销 ──
  function listUserSessions(userId, { currentJti = '' } = {}) {
    const at = iso(finiteNow(now));
    return db.prepare(`
      SELECT jti, device, ip, created_at, last_refreshed_at, expires_at
      FROM auth_sessions
      WHERE user_id = ? AND revoked_at IS NULL AND expires_at > ?
      ORDER BY created_at DESC
    `).all(userId, at).map(row => ({
      id: row.jti,
      device: row.device || '',
      ip: row.ip || '',
      current: row.jti === currentJti,
      createdAt: row.created_at,
      lastRefreshedAt: row.last_refreshed_at || '',
      expiresAt: row.expires_at,
    }));
  }

  function revokeUserSession(userId, sessionId) {
    return db.prepare(
      'UPDATE auth_sessions SET revoked_at = ? WHERE jti = ? AND user_id = ? AND revoked_at IS NULL',
    ).run(iso(finiteNow(now)), String(sessionId || ''), userId).changes;
  }

  // ── 找回密码（15 分钟一次性 token）──
  async function requestPasswordReset(userId, { deliverResetToken } = {}) {
    const at = finiteNow(now);
    const rawToken = tokenGenerator();
    db.prepare(`
      INSERT INTO password_reset_tokens (token_hash, user_id, expires_at)
      VALUES (?, ?, ?)
    `).run(sha256Hex(rawToken), userId, iso(at + resetTokenTtlMs));
    if (typeof deliverResetToken === 'function') await deliverResetToken(rawToken);
    return { ok: true, expiresInMs: resetTokenTtlMs };
  }

  async function resetPassword({ token, password }) {
    const at = finiteNow(now);
    const row = String(token || '')
      ? db.prepare('SELECT * FROM password_reset_tokens WHERE token_hash = ?').get(sha256Hex(token))
      : null;
    if (!row || row.used_at) throw codedError('AUTH_RESET_TOKEN_INVALID', '重置链接无效或已被使用');
    if (Date.parse(row.expires_at) <= at) throw codedError('AUTH_RESET_TOKEN_EXPIRED', '重置链接已过期，请重新申请');
    assertPasswordPolicy(password);
    const user = db.prepare('SELECT * FROM auth_users WHERE id = ?').get(row.user_id);
    if (!user) throw codedError('AUTH_RESET_TOKEN_INVALID', '重置链接无效或已被使用');
    // scrypt 先行，事务内只做同步写（better-sqlite3 事务不支持 async）。
    const passwordHash = await hashPassword(password);
    const sessionsRevoked = db.transaction(() => {
      db.prepare(`
        INSERT INTO auth_credentials (user_id, password_hash, password_updated_at)
        VALUES (?, ?, datetime('now'))
        ON CONFLICT(user_id) DO UPDATE SET
          password_hash = excluded.password_hash,
          password_updated_at = datetime('now')
      `).run(user.id, passwordHash);
      db.prepare('UPDATE password_reset_tokens SET used_at = ? WHERE token_hash = ?').run(iso(at), row.token_hash);
      return revokeAllUserSessions(user.id, { at });
    })();
    return { ok: true, email: user.primary_email, sessionsRevoked };
  }

  // ── legacy HMAC 分支（30 天宽限期，命中即换发新 session）──
  function mintLegacyRenewal(email, rawLegacyToken) {
    const memoKey = sha256Hex(rawLegacyToken);
    if (legacyRenewalMemo.has(memoKey)) return null;
    legacyRenewalMemo.add(memoKey);
    if (legacyRenewalMemo.size > 4096) legacyRenewalMemo.clear();
    const user = ensureUserByEmail(email);
    const active = db.prepare(`
      SELECT jti FROM auth_sessions
      WHERE user_id = ? AND device = ? AND revoked_at IS NULL AND expires_at > ?
      ORDER BY created_at DESC LIMIT 1
    `).get(user.id, LEGACY_DEVICE_TAG, iso(finiteNow(now)));
    if (active) return null; // 该 legacy token 已换发过且仍有效
    const session = issueSession(user, { remember: false, device: LEGACY_DEVICE_TAG });
    return {
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      accessExpiresAt: session.accessExpiresAt,
    };
  }

  function legacyGraceEndsAt() {
    return Date.parse(grace.graceEndsAt);
  }

  return {
    getUserByEmail,
    ensureUserByEmail,
    hasCredential: userId => Boolean(getCredential(userId)),
    verifyPassword: async (userId, password) => {
      const credential = getCredential(userId);
      if (!credential) return false;
      return verifyPassword(password, credential.password_hash);
    },
    setPassword,
    issueEmailCode,
    consumeEmailCode,
    issueSession,
    verifyAccessToken,
    rotateRefreshToken,
    revokeFamily,
    revokeAllUserSessions,
    logoutByRefreshToken,
    requestPasswordReset,
    resetPassword,
    listUserSessions,
    revokeUserSession,
    mintLegacyRenewal,
    legacyGraceEndsAt,
    cutover: grace,
    _internal: { sha256Hex },
  };
}

/**
 * 双模会话校验器：优先 v2 服务端会话（jti + 可吊销）；payload 非 v2 时进入
 * 存量 HMAC legacy 分支——仅在 30 天宽限期内放行，命中即换发一次新 session
 * （renewal 挂在返回值上，由 authenticateContentRequest 写入 req._sessionRenewal）。
 */
export function createDualModeSessionTokens({
  authService,
  legacy,
  now = Date.now,
} = {}) {
  if (typeof authService?.verifyAccessToken !== 'function') throw new TypeError('authService.verifyAccessToken is required');
  if (typeof legacy?.verify !== 'function') throw new TypeError('legacy.verify is required');

  function verify(token) {
    try {
      const session = authService.verifyAccessToken(token);
      return {
        email: session.email,
        userId: session.userId,
        jti: session.jti,
        familyId: session.familyId,
        v2: true,
      };
    } catch (error) {
      // 只有“格式/签名不识别”才允许落入 legacy 分支；过期/吊销必须原样抛出。
      if (error?.code !== 'AUTH_SESSION_INVALID') throw error;
      try {
        const legacyResult = legacy.verify(token);
        const renewal = finiteNow(now) < authService.legacyGraceEndsAt()
          ? authService.mintLegacyRenewal(legacyResult.email, token)
          : null;
        return {
          email: legacyResult.email,
          iat: legacyResult.iat,
          exp: legacyResult.exp,
          expiresAt: legacyResult.expiresAt,
          ...(renewal ? { renewal, legacy: true } : { legacy: true }),
        };
      } catch {
        throw error;
      }
    }
  }

  function issue(ownerEmail) {
    if (typeof legacy.issue === 'function') return legacy.issue(ownerEmail);
    const session = authService.issueSession(ownerEmail);
    return { email: ownerEmail.trim().toLowerCase(), token: session.accessToken, expiresAt: session.accessExpiresAt };
  }

  return { verify, issue };
}