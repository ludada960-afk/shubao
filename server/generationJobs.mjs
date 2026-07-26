import Database from 'better-sqlite3';
import crypto from 'node:crypto';
import { createEcommerceJobStore } from './ecommerceEngine/jobStore.mjs';

const STATES = new Set(['queued', 'analyzing', 'generating', 'completed', 'needs_review', 'failed', 'cancelled']);
const TRANSITIONS = {
  queued: new Set(['analyzing', 'cancelled']),
  analyzing: new Set(['generating', 'failed', 'cancelled', 'queued']),
  generating: new Set(['completed', 'needs_review', 'failed', 'cancelled', 'queued']),
  completed: new Set(),
  needs_review: new Set(['queued', 'cancelled']),
  failed: new Set(['queued']),
  cancelled: new Set(),
};
const FINAL_STATES = new Set(['completed', 'needs_review', 'failed', 'cancelled']);
const LEASE_RELEASE_STATES = new Set(['queued', ...FINAL_STATES]);

function parse(value, fallback) {
  try { return value ? JSON.parse(value) : fallback; } catch { return fallback; }
}

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function createGenerationJobs(dbPath = ':memory:', {
  now = Date.now,
  randomUUID = crypto.randomUUID,
  defaultLeaseMs = 30_000,
} = {}) {
  if (typeof now !== 'function' || typeof randomUUID !== 'function') {
    throw new TypeError('now and randomUUID must be functions');
  }
  if (!Number.isSafeInteger(defaultLeaseMs) || defaultLeaseMs <= 0) {
    throw new TypeError('defaultLeaseMs must be a positive safe integer');
  }
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS ecommerce_jobs (
      id TEXT PRIMARY KEY,
      owner_email TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'queued',
      payload TEXT NOT NULL DEFAULT '{}',
      output TEXT NOT NULL DEFAULT '{}',
      error TEXT NOT NULL DEFAULT '',
      progress TEXT NOT NULL DEFAULT '{}',
      lease_token TEXT,
      lease_expires_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_ecommerce_jobs_status ON ecommerce_jobs(status, created_at);
  `);
  const columns = new Set(db.prepare('PRAGMA table_info(ecommerce_jobs)').all().map(column => column.name));
  if (!columns.has('lease_token')) db.exec('ALTER TABLE ecommerce_jobs ADD COLUMN lease_token TEXT');
  if (!columns.has('lease_expires_at')) db.exec('ALTER TABLE ecommerce_jobs ADD COLUMN lease_expires_at TEXT');
  const assets = createEcommerceJobStore(db);

  function nowMs() {
    const value = now();
    const timestamp = value instanceof Date ? value.getTime() : value;
    if (!Number.isFinite(timestamp)) throw new TypeError('now must return a finite timestamp');
    return timestamp;
  }

  function leaseError(message) {
    return Object.assign(new Error(message), { code: 'PARENT_LEASE_LOST', retryable: true });
  }

  function validateLeaseMs(leaseMs) {
    if (!Number.isSafeInteger(leaseMs) || leaseMs <= 0) {
      throw new TypeError('leaseMs must be a positive safe integer');
    }
    return leaseMs;
  }

  const api = {
    assets,
    create({ id = crypto.randomUUID(), ownerEmail, payload = {} }) {
      if (!ownerEmail) throw new Error('ownerEmail is required');
      db.prepare('INSERT INTO ecommerce_jobs (id, owner_email, payload) VALUES (?, ?, ?)').run(id, ownerEmail, JSON.stringify(payload));
      return api.get(id);
    },
    get(id) {
      const row = db.prepare('SELECT * FROM ecommerce_jobs WHERE id = ?').get(id);
      if (!row) return null;
      return {
        id: row.id,
        ownerEmail: row.owner_email,
        status: row.status,
        payload: parse(row.payload, {}),
        output: parse(row.output, {}),
        error: row.error,
        progress: parse(row.progress, {}),
        leaseToken: row.lease_token,
        leaseExpiresAt: row.lease_expires_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    },
    transition(id, status, patch = {}) {
      if (!STATES.has(status)) throw new Error(`unknown status: ${status}`);
      const current = api.get(id);
      if (!current) throw new Error('job not found');
      if (!TRANSITIONS[current.status]?.has(status)) throw new Error(`invalid transition ${current.status} -> ${status}`);
      const timestamp = new Date(nowMs()).toISOString();
      const releasesLease = LEASE_RELEASE_STATES.has(status);
      let changed;
      if (current.leaseToken) {
        const leaseToken = cleanString(patch.leaseToken);
        if (!leaseToken || leaseToken !== current.leaseToken) {
          throw leaseError('parent lease is no longer owned by this worker');
        }
        if (!current.leaseExpiresAt || Date.parse(current.leaseExpiresAt) <= nowMs()) {
          throw leaseError('parent lease has expired');
        }
        changed = db.prepare(`
          UPDATE ecommerce_jobs
          SET status = ?, output = ?, error = ?, progress = ?,
              lease_token = ?, lease_expires_at = ?, updated_at = ?
          WHERE id = ? AND status = ? AND lease_token = ? AND lease_expires_at > ?
        `).run(
          status,
          JSON.stringify(patch.output ?? current.output),
          patch.error ?? current.error,
          JSON.stringify(patch.progress ?? current.progress),
          releasesLease ? null : current.leaseToken,
          releasesLease ? null : current.leaseExpiresAt,
          timestamp,
          id,
          current.status,
          leaseToken,
          timestamp,
        ).changes;
      } else {
        changed = db.prepare(`
          UPDATE ecommerce_jobs
          SET status = ?, output = ?, error = ?, progress = ?,
              lease_token = NULL, lease_expires_at = NULL, updated_at = ?
          WHERE id = ? AND status = ? AND lease_token IS NULL
        `).run(
          status,
          JSON.stringify(patch.output ?? current.output),
          patch.error ?? current.error,
          JSON.stringify(patch.progress ?? current.progress),
          timestamp,
          id,
          current.status,
        ).changes;
      }
      if (changed !== 1) throw leaseError('parent state or lease changed during transition');
      return api.get(id);
    },
    checkpoint(id, patch = {}) {
      const current = api.get(id);
      if (!current) throw new Error('job not found');
      const timestamp = new Date(nowMs()).toISOString();
      let changed;
      if (current.leaseToken) {
        const leaseToken = cleanString(patch.leaseToken);
        if (!leaseToken || leaseToken !== current.leaseToken) {
          throw leaseError('parent lease is no longer owned by this worker');
        }
        if (!current.leaseExpiresAt || Date.parse(current.leaseExpiresAt) <= nowMs()) {
          throw leaseError('parent lease has expired');
        }
        changed = db.prepare(`
          UPDATE ecommerce_jobs
          SET output = ?, error = ?, progress = ?, updated_at = ?
          WHERE id = ? AND status = ? AND lease_token = ? AND lease_expires_at > ?
        `).run(
          JSON.stringify(patch.output ?? current.output),
          patch.error ?? current.error,
          JSON.stringify(patch.progress ?? current.progress),
          timestamp,
          id,
          current.status,
          leaseToken,
          timestamp,
        ).changes;
      } else {
        changed = db.prepare(`
          UPDATE ecommerce_jobs
          SET output = ?, error = ?, progress = ?, updated_at = ?
          WHERE id = ? AND status = ? AND lease_token IS NULL
        `).run(
          JSON.stringify(patch.output ?? current.output),
          patch.error ?? current.error,
          JSON.stringify(patch.progress ?? current.progress),
          timestamp,
          id,
          current.status,
        ).changes;
      }
      if (changed !== 1) throw leaseError('parent state or lease changed during checkpoint');
      return api.get(id);
    },
    claim(id, { leaseMs = defaultLeaseMs } = {}) {
      validateLeaseMs(leaseMs);
      const tx = db.transaction(() => {
        const current = api.get(id);
        if (!current) throw new Error('job not found');
        if (FINAL_STATES.has(current.status)) return null;
        const timestampMs = nowMs();
        const timestamp = new Date(timestampMs).toISOString();
        const leaseToken = cleanString(randomUUID());
        if (!leaseToken) throw new TypeError('randomUUID returned an invalid lease token');
        const leaseExpiresAt = new Date(timestampMs + leaseMs).toISOString();
        const nextStatus = current.status === 'queued' ? 'analyzing' : current.status;
        const changed = db.prepare(`
          UPDATE ecommerce_jobs
          SET status = ?, lease_token = ?, lease_expires_at = ?, updated_at = ?
          WHERE id = ? AND status = ?
            AND (lease_token IS NULL OR lease_expires_at IS NULL OR lease_expires_at <= ?)
        `).run(
          nextStatus,
          leaseToken,
          leaseExpiresAt,
          timestamp,
          id,
          current.status,
          timestamp,
        ).changes;
        return changed === 1 ? api.get(id) : null;
      });
      return tx.immediate();
    },
    claimNext({ leaseMs = defaultLeaseMs } = {}) {
      validateLeaseMs(leaseMs);
      const tx = db.transaction(() => {
        const timestampMs = nowMs();
        const timestamp = new Date(timestampMs).toISOString();
        const row = db.prepare(`
          SELECT id FROM ecommerce_jobs
          WHERE status = 'queued'
            AND (lease_token IS NULL OR lease_expires_at IS NULL OR lease_expires_at <= ?)
          ORDER BY created_at ASC
          LIMIT 1
        `).get(timestamp);
        if (!row) return null;
        const leaseToken = cleanString(randomUUID());
        if (!leaseToken) throw new TypeError('randomUUID returned an invalid lease token');
        const leaseExpiresAt = new Date(timestampMs + leaseMs).toISOString();
        const changed = db.prepare(`
          UPDATE ecommerce_jobs
          SET status = 'analyzing', lease_token = ?, lease_expires_at = ?, updated_at = ?
          WHERE id = ? AND status = 'queued'
            AND (lease_token IS NULL OR lease_expires_at IS NULL OR lease_expires_at <= ?)
        `).run(leaseToken, leaseExpiresAt, timestamp, row.id, timestamp).changes;
        return changed === 1 ? api.get(row.id) : null;
      });
      return tx.immediate();
    },
    renewLease(id, leaseTokenInput, { leaseMs = defaultLeaseMs } = {}) {
      validateLeaseMs(leaseMs);
      const leaseToken = cleanString(leaseTokenInput);
      if (!leaseToken) throw leaseError('parent lease token is required');
      const timestampMs = nowMs();
      const timestamp = new Date(timestampMs).toISOString();
      const leaseExpiresAt = new Date(timestampMs + leaseMs).toISOString();
      const changed = db.prepare(`
        UPDATE ecommerce_jobs
        SET lease_expires_at = ?, updated_at = ?
        WHERE id = ? AND lease_token = ? AND lease_expires_at > ?
      `).run(leaseExpiresAt, timestamp, id, leaseToken, timestamp).changes;
      if (changed !== 1) throw leaseError('parent lease is no longer owned by this worker');
      return api.get(id);
    },
    releaseLease(id, leaseTokenInput) {
      const leaseToken = cleanString(leaseTokenInput);
      if (!leaseToken) throw leaseError('parent lease token is required');
      const changed = db.prepare(`
        UPDATE ecommerce_jobs
        SET lease_token = NULL, lease_expires_at = NULL, updated_at = ?
        WHERE id = ? AND lease_token = ?
      `).run(new Date(nowMs()).toISOString(), id, leaseToken).changes;
      if (changed !== 1) throw leaseError('parent lease is no longer owned by this worker');
      return api.get(id);
    },
    recoverInterrupted() {
      const recoverableAssets = assets.recoverInterrupted();
      const legacyChanges = db.prepare(`
        UPDATE ecommerce_jobs
        SET status = 'queued', lease_token = NULL, lease_expires_at = NULL, updated_at = ?
        WHERE status IN ('analyzing', 'generating')
          AND (lease_token IS NULL OR lease_expires_at IS NULL OR lease_expires_at <= ?)
          AND NOT EXISTS (
            SELECT 1 FROM ecommerce_job_assets AS asset
            WHERE asset.job_id = ecommerce_jobs.id
              AND asset.state IN (
                'submitted', 'polling', 'downloading', 'quality_check',
                'repairing', 'settling', 'releasing'
              )
          )
      `).run(
        new Date(nowMs()).toISOString(),
        new Date(nowMs()).toISOString(),
      ).changes;
      return legacyChanges + recoverableAssets.length;
    },
    close() { db.close(); },
  };
  api.recoveredOnStartup = api.recoverInterrupted();
  return api;
}
