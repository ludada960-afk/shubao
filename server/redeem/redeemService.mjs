import { ensureRedeemSchema } from './schema.mjs';

/**
 * 兑换码服务（2026-09-10）
 * 并发安全：整段校验 + 落流水 + 加积分在同一事务内完成（better-sqlite3 同步事务）。
 * 幂等：同一用户对同一码重复提交时命中唯一流水，不重复加分。
 */
export function createRedeemService(db, { wallet, now = () => new Date().toISOString(), randomUUID = () => globalThis.crypto?.randomUUID?.() || String(Date.now()) } = {}) {
  if (!db || typeof db.prepare !== 'function') throw new TypeError('db must be a better-sqlite3 database');
  if (!wallet || typeof wallet.grant !== 'function') throw new TypeError('wallet service is required');
  ensureRedeemSchema(db);

  const normalizeCode = value => String(value || '').trim().toUpperCase().replace(/\s+/g, '');
  const fail = (code, message, extra = {}) => Object.assign(new Error(message), { code, ...extra });

  function createCode({ code, grantUnits, currency = 'ec_points', maxUses = 0, perUserLimit = 1, expiresAt = null, note = '', createdBy = '' }) {
    const normalized = normalizeCode(code);
    if (!/^[A-Z0-9-]{4,40}$/.test(normalized)) throw fail('REDEEM_CODE_INVALID', '兑换码格式无效');
    if (!Number.isSafeInteger(grantUnits) || grantUnits <= 0) throw fail('REDEEM_UNITS_INVALID', '积分数量必须为正整数');
    db.prepare(`
      INSERT INTO redeem_codes (code, grant_units, currency, max_uses, per_user_limit, expires_at, note, created_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(normalized, grantUnits, String(currency), Number(maxUses) || 0, Math.max(1, Number(perUserLimit) || 1), expiresAt || null, String(note || ''), String(createdBy || ''), now(), now());
    return getCode(normalized);
  }

  function getCode(code) {
    const row = db.prepare('SELECT * FROM redeem_codes WHERE code = ?').get(normalizeCode(code));
    if (!row) return null;
    return {
      code: row.code,
      grantUnits: row.grant_units,
      currency: row.currency,
      maxUses: row.max_uses,
      usedCount: row.used_count,
      perUserLimit: row.per_user_limit,
      expiresAt: row.expires_at,
      status: row.status,
      note: row.note,
    };
  }

  const redeemTx = db.transaction((ownerEmail, rawCode) => {
    const code = normalizeCode(rawCode);
    if (!code) throw fail('REDEEM_CODE_REQUIRED', '请输入兑换码');
    const row = db.prepare('SELECT * FROM redeem_codes WHERE code = ?').get(code);
    if (!row || row.status !== 'active') throw fail('REDEEM_CODE_NOT_FOUND', '兑换码无效或已失效');
    if (row.expires_at && Date.parse(row.expires_at) <= Date.now()) throw fail('REDEEM_CODE_EXPIRED', '兑换码已过期');
    if (row.max_uses > 0 && row.used_count >= row.max_uses) throw fail('REDEEM_CODE_EXHAUSTED', '兑换码已被领完');
    const usedByUser = db.prepare('SELECT COUNT(*) AS total FROM redeem_records WHERE code = ? AND owner_email = ?').get(code, ownerEmail).total;
    if (usedByUser >= Math.max(1, row.per_user_limit)) throw fail('REDEEM_ALREADY_USED', '你已经兑换过这个码了');

    const ledgerKey = `redeem:${code}:${ownerEmail}`;
    const grant = wallet.grant({
      ownerEmail,
      currency: row.currency,
      units: row.grant_units,
      sourceType: 'redeem',
      sourceId: code,
      idempotencyKey: ledgerKey,
      metadata: { code, note: row.note || '' },
    });
    db.prepare('INSERT INTO redeem_records (id, code, owner_email, grant_units, ledger_key, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(`rdm_${randomUUID()}`, code, ownerEmail, row.grant_units, ledgerKey, now());
    db.prepare('UPDATE redeem_codes SET used_count = used_count + 1, updated_at = ? WHERE code = ?').run(now(), code);
    return { code, units: row.grant_units, currency: row.currency, balance: grant?.balance ?? null };
  });

  function redeem({ ownerEmail, code }) {
    const email = String(ownerEmail || '').trim().toLowerCase();
    if (!email) throw fail('REDEEM_AUTH_REQUIRED', '请先登录');
    return redeemTx(email, code);
  }

  function listRecords({ ownerEmail, limit = 20 } = {}) {
    const email = String(ownerEmail || '').trim().toLowerCase();
    if (!email) return [];
    return db.prepare('SELECT code, grant_units, created_at FROM redeem_records WHERE owner_email = ? ORDER BY created_at DESC LIMIT ?')
      .all(email, Math.max(1, Math.min(100, Number(limit) || 20)))
      .map(row => ({ code: row.code, units: row.grant_units, createdAt: row.created_at }));
  }

  return { createCode, getCode, redeem, listRecords };
}
