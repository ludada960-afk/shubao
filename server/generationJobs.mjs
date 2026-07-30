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
const CURRENT_VISUAL_INPUT_SCHEMA_VERSION = 1;

function parse(value, fallback) {
  try { return value ? JSON.parse(value) : fallback; } catch { return fallback; }
}

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function safeLabel(value, fallback = '') {
  return cleanString(value).slice(0, 160) || fallback;
}

function safeProgress(value) {
  const progress = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const count = key => Number.isSafeInteger(progress[key]) && progress[key] >= 0 ? progress[key] : 0;
  return {
    current: count('current'),
    total: count('total'),
    completed: count('completed'),
    needsReview: count('needsReview'),
    failed: count('failed'),
  };
}

function publicTaskError(status) {
  if (status === 'needs_review') return '部分图片需要修订，可查看预览后仅重新生成这些图片';
  if (status === 'failed') return '任务未完成，请查看失败图片后重试';
  if (status === 'cancelled') return '任务已停止';
  return '';
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
  db.pragma('busy_timeout = 5000');
  db.exec(`
    CREATE TABLE IF NOT EXISTS ecommerce_jobs (
      id TEXT PRIMARY KEY,
      owner_email TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'queued',
      payload TEXT NOT NULL DEFAULT '{}',
      output TEXT NOT NULL DEFAULT '{}',
      error TEXT NOT NULL DEFAULT '',
      progress TEXT NOT NULL DEFAULT '{}',
      visual_input_schema_version INTEGER,
      lease_token TEXT,
      lease_expires_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_ecommerce_jobs_status ON ecommerce_jobs(status, created_at);
    CREATE TABLE IF NOT EXISTS ecommerce_job_retries (
      source_job_id TEXT NOT NULL,
      billing_quote_id TEXT NOT NULL,
      retry_job_id TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (source_job_id, billing_quote_id)
    );
  `);
  const columns = new Set(db.prepare('PRAGMA table_info(ecommerce_jobs)').all().map(column => column.name));
  if (!columns.has('lease_token')) db.exec('ALTER TABLE ecommerce_jobs ADD COLUMN lease_token TEXT');
  if (!columns.has('lease_expires_at')) db.exec('ALTER TABLE ecommerce_jobs ADD COLUMN lease_expires_at TEXT');
  if (!columns.has('visual_input_schema_version')) {
    db.exec('ALTER TABLE ecommerce_jobs ADD COLUMN visual_input_schema_version INTEGER');
  }
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
      db.prepare(`
        INSERT INTO ecommerce_jobs (id, owner_email, payload, visual_input_schema_version)
        VALUES (?, ?, ?, ?)
      `).run(id, ownerEmail, JSON.stringify(payload), CURRENT_VISUAL_INPUT_SCHEMA_VERSION);
      return api.get(id);
    },
    createRetry({ sourceJobId, billingQuoteId, id, ownerEmail, payload = {}, progress = {} } = {}) {
      const sourceId = cleanString(sourceJobId);
      const quoteId = cleanString(billingQuoteId);
      const retryId = cleanString(id);
      if (!sourceId || !quoteId || !retryId || !ownerEmail) {
        throw new TypeError('sourceJobId, billingQuoteId, id, and ownerEmail are required');
      }
      const createOrGetRetry = db.transaction(() => {
        const existing = db.prepare(`
          SELECT retry_job_id
          FROM ecommerce_job_retries
          WHERE source_job_id = ? AND billing_quote_id = ?
        `).get(sourceId, quoteId);
        if (existing) {
          const job = api.get(existing.retry_job_id);
          if (!job) throw new Error('retry job mapping is corrupt');
          return { job, created: false };
        }
        db.prepare(`
          INSERT INTO ecommerce_jobs (
            id, owner_email, payload, progress, visual_input_schema_version
          ) VALUES (?, ?, ?, ?, ?)
        `).run(
          retryId,
          ownerEmail,
          JSON.stringify(payload),
          JSON.stringify(progress),
          CURRENT_VISUAL_INPUT_SCHEMA_VERSION,
        );
        db.prepare(`
          INSERT INTO ecommerce_job_retries (source_job_id, billing_quote_id, retry_job_id)
          VALUES (?, ?, ?)
        `).run(sourceId, quoteId, retryId);
        return { job: api.get(retryId), created: true };
      });
      return createOrGetRetry.immediate();
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
        visualInputSchemaVersion: row.visual_input_schema_version,
        leaseToken: row.lease_token,
        leaseExpiresAt: row.lease_expires_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    },
    listOwner(ownerEmailInput, { limit = 20 } = {}) {
      const ownerEmail = cleanString(ownerEmailInput).toLowerCase();
      if (!ownerEmail || !ownerEmail.includes('@')) throw new TypeError('ownerEmail is required');
      const safeLimit = Number.isSafeInteger(limit) ? Math.max(1, Math.min(100, limit)) : 20;
      return db.prepare(`
        SELECT id, status, error, payload, progress, updated_at
        FROM ecommerce_jobs
        WHERE lower(owner_email) = ?
        ORDER BY updated_at DESC, created_at DESC
        LIMIT ?
      `).all(ownerEmail, safeLimit).map(row => {
        const payload = parse(row.payload, {});
        const assetRows = assets.listAssets(row.id).map(asset => ({
          state: asset.state,
          label: safeLabel(
            asset.requestSnapshot?.assetPlanItem?.label
            ?? asset.requestSnapshot?.assetPlanItem?.purpose
            ?? asset.requestSnapshot?.assetPlanItem?.role,
            '图片',
          ),
          error: asset.state === 'needs_review'
            ? '生成预览需要修订，尚未进入交付，本张不计费'
            : ['failed', 'cancelled'].includes(asset.state)
              ? '图片生成未完成，本张未计费'
              : '',
          previewUrl: asset.state === 'needs_review' ? asset.stableUrl : '',
        }));
        return {
          id: row.id,
          title: `${safeLabel(payload.product_name, '电商')}套图`,
          status: row.status,
          error: publicTaskError(row.status),
          progress: safeProgress(parse(row.progress, {})),
          updatedAt: row.updated_at,
          assets: assetRows,
        };
      });
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
          SELECT id, status FROM ecommerce_jobs
          WHERE status IN ('queued', 'analyzing', 'generating')
            AND (lease_token IS NULL OR lease_expires_at IS NULL OR lease_expires_at <= ?)
          ORDER BY CASE WHEN status = 'queued' THEN 0 ELSE 1 END, created_at ASC
          LIMIT 1
        `).get(timestamp);
        if (!row) return null;
        const leaseToken = cleanString(randomUUID());
        if (!leaseToken) throw new TypeError('randomUUID returned an invalid lease token');
        const leaseExpiresAt = new Date(timestampMs + leaseMs).toISOString();
        const nextStatus = row.status === 'queued' ? 'analyzing' : row.status;
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
          row.id,
          row.status,
          timestamp,
        ).changes;
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
