import { randomUUID as systemRandomUUID } from 'node:crypto';

function clean(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function parseRecord(row) {
  if (!row) return null;
  try {
    const value = JSON.parse(row.payload);
    return value && typeof value === 'object' ? value : null;
  } catch {
    return null;
  }
}

function codedError(message, code) {
  return Object.assign(new Error(message), { status: 409, code, retryable: true });
}

export function createCanvasBilledActionStore(db, {
  now = Date.now,
  randomUUID = systemRandomUUID,
  defaultLeaseMs = 120_000,
} = {}) {
  if (!db || typeof db.prepare !== 'function' || typeof db.transaction !== 'function') {
    throw new TypeError('SQLite database is required');
  }
  if (typeof now !== 'function' || typeof randomUUID !== 'function') {
    throw new TypeError('Action store clock and random UUID generator are required');
  }
  if (!Number.isSafeInteger(defaultLeaseMs) || defaultLeaseMs <= 0) {
    throw new TypeError('Action store lease must be a positive safe integer');
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS canvas_billed_actions (
      owner_email TEXT NOT NULL,
      action_id TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('delivered', 'settled')),
      payload TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (owner_email, action_id)
    );
    CREATE TABLE IF NOT EXISTS canvas_billed_action_claims (
      owner_email TEXT NOT NULL,
      action_id TEXT NOT NULL,
      sku TEXT NOT NULL,
      lease_token TEXT NOT NULL,
      lease_expires_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (owner_email, action_id)
    );
    CREATE INDEX IF NOT EXISTS idx_canvas_billed_action_claim_expiry
      ON canvas_billed_action_claims(lease_expires_at);
  `);

  const statements = {
    selectAction: db.prepare('SELECT payload FROM canvas_billed_actions WHERE owner_email = ? AND action_id = ?'),
    selectClaim: db.prepare('SELECT * FROM canvas_billed_action_claims WHERE owner_email = ? AND action_id = ?'),
    insertClaim: db.prepare(`
      INSERT OR IGNORE INTO canvas_billed_action_claims (
        owner_email, action_id, sku, lease_token, lease_expires_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?)
    `),
    reclaim: db.prepare(`
      UPDATE canvas_billed_action_claims
      SET sku = ?, lease_token = ?, lease_expires_at = ?, updated_at = ?
      WHERE owner_email = ? AND action_id = ?
        AND lease_token = ? AND lease_expires_at = ? AND lease_expires_at <= ?
    `),
    renew: db.prepare(`
      UPDATE canvas_billed_action_claims
      SET lease_expires_at = ?, updated_at = ?
      WHERE owner_email = ? AND action_id = ? AND lease_token = ? AND lease_expires_at > ?
    `),
    deleteClaim: db.prepare(`
      DELETE FROM canvas_billed_action_claims
      WHERE owner_email = ? AND action_id = ? AND lease_token = ?
    `),
    upsertAction: db.prepare(`
      INSERT INTO canvas_billed_actions (owner_email, action_id, status, payload, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(owner_email, action_id) DO UPDATE SET
        status = excluded.status, payload = excluded.payload, updated_at = excluded.updated_at
    `),
  };

  function currentTimeMs() {
    const value = now();
    const timestamp = value instanceof Date ? value.getTime() : value;
    if (!Number.isFinite(timestamp)) throw new TypeError('Action store clock must return a finite timestamp');
    return timestamp;
  }

  function identity(ownerEmail, actionId) {
    const owner = clean(ownerEmail).toLowerCase();
    const id = clean(actionId);
    if (!owner || !id) throw new TypeError('Valid canvas billed action owner and id are required');
    return { owner, id };
  }

  const claimTx = db.transaction((owner, id, sku, leaseMs) => {
    const terminal = parseRecord(statements.selectAction.get(owner, id));
    if (terminal?.status === 'settled') return { status: 'settled', record: terminal };

    const timeMs = currentTimeMs();
    const nowIso = new Date(timeMs).toISOString();
    const leaseToken = clean(randomUUID());
    const leaseExpiresAt = new Date(timeMs + leaseMs).toISOString();
    if (!leaseToken) throw new TypeError('Action lease token is required');
    const existing = statements.selectClaim.get(owner, id);
    if (!existing) {
      const inserted = statements.insertClaim.run(owner, id, sku, leaseToken, leaseExpiresAt, nowIso);
      if (inserted.changes === 1) {
        return { status: 'claimed', leaseToken, leaseExpiresAt, record: terminal };
      }
      return { status: 'in_progress' };
    }
    if (existing.sku !== sku) {
      throw codedError('同一收费动作不能更改功能类型', 'CANVAS_BILLING_ACTION_CONFLICT');
    }
    if (Date.parse(existing.lease_expires_at) > timeMs) {
      return { status: 'in_progress', leaseExpiresAt: existing.lease_expires_at };
    }
    const reclaimed = statements.reclaim.run(
      sku,
      leaseToken,
      leaseExpiresAt,
      nowIso,
      owner,
      id,
      existing.lease_token,
      existing.lease_expires_at,
      nowIso,
    );
    if (reclaimed.changes !== 1) return { status: 'in_progress' };
    return { status: 'claimed', leaseToken, leaseExpiresAt, reclaimed: true, record: terminal };
  });

  const saveTx = db.transaction((owner, id, value, leaseToken) => {
    const timeMs = currentTimeMs();
    const nowIso = new Date(timeMs).toISOString();
    const claim = statements.selectClaim.get(owner, id);
    if (!claim || claim.lease_token !== leaseToken || Date.parse(claim.lease_expires_at) <= timeMs) {
      throw codedError('收费动作租约已失效', 'CANVAS_BILLING_ACTION_LEASE_LOST');
    }
    statements.upsertAction.run(owner, id, value.status, JSON.stringify(value), nowIso);
    if (value.status === 'settled') statements.deleteClaim.run(owner, id, leaseToken);
    return value;
  });

  return {
    get(ownerEmail, actionId) {
      const { owner, id } = identity(ownerEmail, actionId);
      return parseRecord(statements.selectAction.get(owner, id));
    },
    claim(ownerEmail, actionId, { sku, leaseMs = defaultLeaseMs } = {}) {
      const { owner, id } = identity(ownerEmail, actionId);
      const safeSku = clean(sku);
      if (!safeSku || !Number.isSafeInteger(leaseMs) || leaseMs <= 0) {
        throw new TypeError('Valid canvas action SKU and lease are required');
      }
      return claimTx.immediate(owner, id, safeSku, leaseMs);
    },
    renew(ownerEmail, actionId, leaseToken, { leaseMs = defaultLeaseMs } = {}) {
      const { owner, id } = identity(ownerEmail, actionId);
      const token = clean(leaseToken);
      if (!token || !Number.isSafeInteger(leaseMs) || leaseMs <= 0) {
        throw new TypeError('Valid canvas action lease is required');
      }
      const timeMs = currentTimeMs();
      const nowIso = new Date(timeMs).toISOString();
      const leaseExpiresAt = new Date(timeMs + leaseMs).toISOString();
      const renewed = statements.renew.run(leaseExpiresAt, nowIso, owner, id, token, nowIso);
      if (renewed.changes !== 1) {
        throw codedError('收费动作租约已失效', 'CANVAS_BILLING_ACTION_LEASE_LOST');
      }
      return { leaseToken: token, leaseExpiresAt };
    },
    save(ownerEmail, actionId, value, { leaseToken } = {}) {
      const { owner, id } = identity(ownerEmail, actionId);
      const status = clean(value?.status);
      const token = clean(leaseToken);
      if (!token || !['delivered', 'settled'].includes(status)) {
        throw new TypeError('Valid canvas billed action lease and status are required');
      }
      return saveTx.immediate(owner, id, value, token);
    },
    release(ownerEmail, actionId, leaseToken) {
      const { owner, id } = identity(ownerEmail, actionId);
      const token = clean(leaseToken);
      if (!token) return false;
      return statements.deleteClaim.run(owner, id, token).changes === 1;
    },
  };
}
