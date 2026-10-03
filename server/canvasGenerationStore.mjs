import crypto from 'node:crypto';

const TABLE = 'canvas_generation_jobs';

function parseJson(value, fallback = null) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function rowToJob(row) {
  if (!row) return null;
  return {
    requestId: row.request_id,
    ownerEmail: row.owner_email,
    requestFingerprint: row.request_fingerprint,
    requestSnapshot: parseJson(row.request_snapshot, {}),
    status: row.status,
    providerJobId: row.provider_job_id || '',
    outputUrl: row.output_url || '',
    stableUrl: row.stable_url || '',
    error: parseJson(row.error_json, null),
    leaseToken: row.lease_token || '',
    leaseExpiresAt: row.lease_expires_at || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createCanvasGenerationStore(db, {
  now = Date.now,
  randomUUID = crypto.randomUUID,
  leaseMs = 30_000,
} = {}) {
  if (!db || typeof db.prepare !== 'function' || typeof db.transaction !== 'function') {
    throw new TypeError('db must be a better-sqlite3 database');
  }
  if (typeof now !== 'function' || typeof randomUUID !== 'function') {
    throw new TypeError('now and randomUUID must be functions');
  }
  if (!Number.isSafeInteger(leaseMs) || leaseMs <= 0) {
    throw new TypeError('leaseMs must be a positive safe integer');
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS ${TABLE} (
      request_id TEXT PRIMARY KEY,
      owner_email TEXT NOT NULL,
      request_fingerprint TEXT NOT NULL,
      request_snapshot TEXT NOT NULL DEFAULT '{}',
      status TEXT NOT NULL DEFAULT 'queued',
      provider_job_id TEXT NOT NULL DEFAULT '',
      output_url TEXT NOT NULL DEFAULT '',
      stable_url TEXT NOT NULL DEFAULT '',
      error_json TEXT NOT NULL DEFAULT 'null',
      lease_token TEXT,
      lease_expires_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_canvas_generation_owner
      ON ${TABLE}(owner_email, updated_at DESC);
  `);

  const select = db.prepare(`SELECT * FROM ${TABLE} WHERE request_id = ?`);
  const insert = db.prepare(`
    INSERT OR IGNORE INTO ${TABLE} (
      request_id, owner_email, request_fingerprint, request_snapshot,
      status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, 'queued', ?, ?)
  `);

  function nowMs() {
    const value = now();
    const timestamp = value instanceof Date ? value.getTime() : value;
    if (!Number.isFinite(timestamp)) throw new TypeError('now must return a finite timestamp');
    return timestamp;
  }

  function get(requestId) {
    return rowToJob(select.get(requestId));
  }

  function getOrCreate({ requestId, ownerEmail, requestFingerprint, requestSnapshot = {} }) {
    const timestamp = new Date(nowMs()).toISOString();
    insert.run(
      requestId,
      ownerEmail,
      requestFingerprint,
      JSON.stringify(requestSnapshot),
      timestamp,
      timestamp,
    );
    return get(requestId);
  }

  function claim(requestId) {
    const timestampMs = nowMs();
    const timestamp = new Date(timestampMs).toISOString();
    const leaseToken = String(randomUUID() || '').trim();
    const leaseExpiresAt = new Date(timestampMs + leaseMs).toISOString();
    const changed = db.prepare(`
      UPDATE ${TABLE}
      SET lease_token = ?, lease_expires_at = ?, updated_at = ?
      WHERE request_id = ?
        AND status NOT IN ('completed', 'failed')
        AND (lease_token IS NULL OR lease_expires_at IS NULL OR lease_expires_at <= ?)
    `).run(leaseToken, leaseExpiresAt, timestamp, requestId, timestamp).changes;
    return changed === 1 ? get(requestId) : null;
  }

  function reopenForPersistence(requestId) {
    const timestamp = new Date(nowMs()).toISOString();
    const changed = db.prepare(`
      UPDATE ${TABLE}
      SET status = 'submitted', error_json = 'null', lease_token = NULL,
        lease_expires_at = NULL, updated_at = ?
      WHERE request_id = ?
        AND status = 'failed'
        AND output_url <> ''
        AND stable_url = ''
    `).run(timestamp, requestId).changes;
    return changed === 1 ? get(requestId) : null;
  }

  function renewLease(requestId, { leaseToken }) {
    const timestampMs = nowMs();
    const timestamp = new Date(timestampMs).toISOString();
    const leaseExpiresAt = new Date(timestampMs + leaseMs).toISOString();
    const changed = db.prepare(`
      UPDATE ${TABLE}
      SET lease_expires_at = ?, updated_at = ?
      WHERE request_id = ?
        AND lease_token = ?
        AND status NOT IN ('completed', 'failed')
        AND lease_expires_at > ?
    `).run(leaseExpiresAt, timestamp, requestId, leaseToken, timestamp).changes;
    if (changed !== 1) {
      throw Object.assign(new Error('Canvas generation lease is no longer owned'), {
        code: 'CANVAS_LEASE_LOST',
        retryable: true,
      });
    }
    return get(requestId);
  }

  function updateOwned(requestId, leaseToken, fields) {
    const current = get(requestId);
    if (!current || current.leaseToken !== leaseToken) {
      throw Object.assign(new Error('Canvas generation lease is no longer owned'), {
        code: 'CANVAS_LEASE_LOST',
        retryable: true,
      });
    }
    const next = { ...current, ...fields };
    const timestamp = new Date(nowMs()).toISOString();
    const changed = db.prepare(`
      UPDATE ${TABLE}
      SET status = ?, provider_job_id = ?, output_url = ?, stable_url = ?,
        error_json = ?, lease_token = ?, lease_expires_at = ?, updated_at = ?
      WHERE request_id = ? AND lease_token = ?
    `).run(
      next.status,
      next.providerJobId,
      next.outputUrl,
      next.stableUrl,
      JSON.stringify(next.error),
      next.status === 'completed' || next.status === 'failed' ? null : leaseToken,
      next.status === 'completed' || next.status === 'failed' ? null : current.leaseExpiresAt,
      timestamp,
      requestId,
      leaseToken,
    ).changes;
    if (changed !== 1) {
      throw Object.assign(new Error('Canvas generation lease changed during update'), {
        code: 'CANVAS_LEASE_LOST',
        retryable: true,
      });
    }
    return get(requestId);
  }

  return {
    get,
    getOrCreate,
    claim,
    reopenForPersistence,
    renewLease,
    markSubmitted(requestId, { providerJobId, leaseToken }) {
      return updateOwned(requestId, leaseToken, {
        status: 'submitted',
        providerJobId,
        error: null,
      });
    },
    markOutput(requestId, { outputUrl, leaseToken }) {
      return updateOwned(requestId, leaseToken, {
        status: 'submitted',
        outputUrl,
        error: null,
      });
    },
    complete(requestId, { stableUrl, leaseToken }) {
      return updateOwned(requestId, leaseToken, {
        status: 'completed',
        stableUrl,
        error: null,
      });
    },
    recordError(requestId, { error, retryable, leaseToken }) {
      const current = get(requestId);
      if (!current || current.leaseToken !== leaseToken) {
        throw Object.assign(new Error('Canvas generation lease is no longer owned'), {
          code: 'CANVAS_LEASE_LOST',
          retryable: true,
        });
      }
      /* ⚠️ 2026-10-03：这里原来是 `const status = retryable ? current.status : 'failed'`，
         把**两个不同的语义**混成了一个：
           · 「这次 HTTP 尝试失败了，值得再发一次」—— retryable 的本意
           · 「这个任务迟早会自己变好」—— 上面那行代码实际做的
         实测后果（用户 240485042@qq.com，2026-10-03 13:23）：
           上游网关返回 `PROVIDER_ERROR / No available channel for model
           image2-5-sunburst`，`retryable:true`，**provider_job_id 为空**
           —— 上游压根没受理这次请求，再重试多少次也是同一个结果。
           而 status 被留成 `queued`，于是：
             · `/api/canvas/regenerate/status` 只会返回 202 processing
               （inspect() 只认 `status==='failed'` 才给终态）；
             · 前端把 180 次轮询跑满（约 15 分钟）；
             · 用户看到的就是节点永远"图片仍在生成，请稍后继续查看"。
           同一用户同一天 image2 连着成功 6 条，只有 2.5 卡住 —— 与他反馈完全一致。

         ⇒ 判据改成「**上游有没有受理**」：没有 provider_job_id ⇒ 不可能有进展，
           无论 retryable 与否都落终态 failed，前端立刻拿到错误。
           用户再点一次是**一次新请求**（requestId 不同 ⇒ getOrCreate 建新任务），
           这才是 retryable 该有的样子。 */
      const acceptedByProvider = Boolean(current.providerJobId);
      const status = (!acceptedByProvider || !retryable) ? 'failed' : current.status;
      const timestamp = new Date(nowMs()).toISOString();
      const changed = db.prepare(`
        UPDATE ${TABLE}
        SET status = ?, error_json = ?, lease_token = NULL,
          lease_expires_at = NULL, updated_at = ?
        WHERE request_id = ? AND lease_token = ?
      `).run(
        status,
        JSON.stringify(error),
        timestamp,
        requestId,
        leaseToken,
      ).changes;
      if (changed !== 1) {
        throw Object.assign(new Error('Canvas generation lease changed during error update'), {
          code: 'CANVAS_LEASE_LOST',
          retryable: true,
        });
      }
      return get(requestId);
    },
  };
}
