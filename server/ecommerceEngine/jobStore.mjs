import { randomUUID as nodeRandomUUID } from 'node:crypto';

export const ASSET_STATES = Object.freeze([
  'queued',
  'submitted',
  'polling',
  'downloading',
  'quality_check',
  'repairing',
  'settling',
  'releasing',
  'completed',
  'needs_review',
  'failed',
  'cancelled',
]);

const STATE_SET = new Set(ASSET_STATES);
const FINAL_STATES = new Set(['completed', 'failed', 'cancelled']);
const LEASE_RELEASE_STATES = new Set(['completed', 'needs_review', 'failed', 'cancelled']);
const TRANSITIONS = Object.freeze({
  queued: new Set(['submitted', 'releasing', 'failed', 'cancelled']),
  submitted: new Set(['polling', 'downloading', 'releasing', 'failed', 'cancelled']),
  polling: new Set(['downloading', 'releasing', 'failed', 'cancelled']),
  downloading: new Set(['quality_check', 'releasing', 'failed', 'cancelled']),
  quality_check: new Set(['repairing', 'settling', 'releasing', 'completed', 'needs_review', 'failed', 'cancelled']),
  repairing: new Set([
    'submitted', 'polling', 'downloading', 'quality_check',
    'releasing', 'needs_review', 'failed', 'cancelled',
  ]),
  settling: new Set(['completed']),
  releasing: new Set(['needs_review', 'failed', 'cancelled']),
  completed: new Set(),
  needs_review: new Set(['repairing', 'cancelled']),
  failed: new Set(),
  cancelled: new Set(),
});
const SAFE_ID_RE = /^[a-z0-9][a-z0-9_.:-]{0,127}$/i;
const UNSAFE_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
const SECRET_KEY_RE = /(authorization|api.?key|secret|password|credential|access.?token|bearer.?token|session.?token)/i;
const RAW_KEY_RE = /^(buffer|bytes|blob|file|image|imageData|dataUrl|localPath|privatePath|path)$/i;
const PRIVATE_PATH_RE = /^(?:[a-z]:[\\/]|\\\\|file:|\/(?:home|var|users|private|etc)\/)/i;
const DATA_URL_RE = /^data:[^,]+,/i;

function hasOwn(record, key) {
  return record !== null
    && typeof record === 'object'
    && !Array.isArray(record)
    && Object.hasOwn(record, key);
}

function own(record, key) {
  return hasOwn(record, key) ? record[key] : undefined;
}

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function validateId(value, label) {
  const id = cleanString(value);
  if (!SAFE_ID_RE.test(id)) throw new TypeError(`${label} is invalid`);
  return id;
}

function finiteNow(now) {
  const value = now();
  const timestamp = value instanceof Date ? value.getTime() : value;
  if (!Number.isFinite(timestamp)) throw new TypeError('now must return a finite timestamp');
  return timestamp;
}

function sanitizeValue(value, depth = 0) {
  if (depth > 12 || value === undefined || typeof value === 'function' || typeof value === 'symbol') {
    return undefined;
  }
  if (value === null || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value === 'string') {
    const text = value.trim();
    return DATA_URL_RE.test(text) || PRIVATE_PATH_RE.test(text) ? undefined : text;
  }
  if (Buffer.isBuffer(value)
    || value instanceof Uint8Array
    || value instanceof ArrayBuffer
    || (typeof Blob !== 'undefined' && value instanceof Blob)) {
    return undefined;
  }
  if (Array.isArray(value)) {
    return value.map(item => sanitizeValue(item, depth + 1)).filter(item => item !== undefined);
  }
  if (typeof value !== 'object') return undefined;
  const result = {};
  for (const key of Object.keys(value)) {
    if (UNSAFE_KEYS.has(key) || SECRET_KEY_RE.test(key) || RAW_KEY_RE.test(key)) continue;
    const sanitized = sanitizeValue(value[key], depth + 1);
    if (sanitized !== undefined) result[key] = sanitized;
  }
  return result;
}

function sanitizeSnapshot(value) {
  const sanitized = sanitizeValue(value);
  return sanitized && typeof sanitized === 'object' && !Array.isArray(sanitized) ? sanitized : {};
}

function parseJson(value, fallback) {
  try {
    const parsed = JSON.parse(value);
    return parsed !== null && typeof parsed === 'object' ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function normalizeHttpUrl(value, label, { allowEmpty = true } = {}) {
  const text = cleanString(value);
  if (!text && allowEmpty) return '';
  let url;
  try { url = new URL(text); } catch { throw new TypeError(`${label} must be an http(s) URL`); }
  if (!['http:', 'https:'].includes(url.protocol)) throw new TypeError(`${label} must be an http(s) URL`);
  return url.href;
}

function normalizeStableUrl(value) {
  const url = cleanString(value);
  if (!url) return '';
  if (!/^\/api\/generated-assets\/[a-f0-9]{64}\.(?:jpg|png|webp)$/i.test(url)) {
    throw new TypeError('stableUrl is invalid');
  }
  return url;
}

function rowToAsset(row) {
  if (!row) return null;
  return {
    jobId: row.job_id,
    assetId: row.asset_id,
    state: row.state,
    requestSnapshot: parseJson(row.request_snapshot, {}),
    providerJobId: row.provider_job_id,
    attemptCount: row.attempt_count,
    outputUrl: row.output_url,
    stableUrl: row.stable_url,
    error: row.error,
    leaseToken: row.lease_token,
    leaseExpiresAt: row.lease_expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeAttempt(value, fallback) {
  if (value === undefined) return fallback;
  if (!Number.isSafeInteger(value) || value < 0) throw new TypeError('attemptCount must be a non-negative safe integer');
  return value;
}

export function createEcommerceJobStore(db, {
  now = Date.now,
  randomUUID = nodeRandomUUID,
  defaultLeaseMs = 30_000,
} = {}) {
  if (!db || typeof db.prepare !== 'function' || typeof db.exec !== 'function') {
    throw new TypeError('a better-sqlite3 database is required');
  }
  if (typeof now !== 'function' || typeof randomUUID !== 'function') {
    throw new TypeError('now and randomUUID must be functions');
  }
  if (!Number.isSafeInteger(defaultLeaseMs) || defaultLeaseMs <= 0) {
    throw new TypeError('defaultLeaseMs must be a positive safe integer');
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS ecommerce_job_assets (
      job_id TEXT NOT NULL,
      asset_id TEXT NOT NULL,
      state TEXT NOT NULL DEFAULT 'queued',
      request_snapshot TEXT NOT NULL DEFAULT '{}',
      provider_job_id TEXT NOT NULL DEFAULT '',
      attempt_count INTEGER NOT NULL DEFAULT 0,
      output_url TEXT NOT NULL DEFAULT '',
      stable_url TEXT NOT NULL DEFAULT '',
      error TEXT NOT NULL DEFAULT '',
      lease_token TEXT,
      lease_expires_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (job_id, asset_id)
    );
    CREATE INDEX IF NOT EXISTS idx_ecommerce_job_assets_recovery
      ON ecommerce_job_assets(state, lease_expires_at, updated_at);
  `);

  const statements = {
    insert: db.prepare(`
      INSERT INTO ecommerce_job_assets (
        job_id, asset_id, state, request_snapshot, provider_job_id,
        attempt_count, output_url, stable_url, error,
        lease_token, lease_expires_at, created_at, updated_at
      ) VALUES (?, ?, 'queued', ?, '', 0, '', '', '', NULL, NULL, ?, ?)
      ON CONFLICT(job_id, asset_id) DO NOTHING
    `),
    get: db.prepare('SELECT * FROM ecommerce_job_assets WHERE job_id = ? AND asset_id = ?'),
    list: db.prepare('SELECT * FROM ecommerce_job_assets WHERE job_id = ? ORDER BY asset_id'),
    recoverable: db.prepare(`
      SELECT * FROM ecommerce_job_assets
      WHERE state IN (
        'submitted', 'polling', 'downloading', 'quality_check',
        'repairing', 'settling', 'releasing'
      )
      ORDER BY updated_at, job_id, asset_id
    `),
    claim: db.prepare(`
      UPDATE ecommerce_job_assets
      SET lease_token = ?, lease_expires_at = ?, updated_at = ?
      WHERE job_id = ? AND asset_id = ?
        AND state NOT IN ('completed', 'failed', 'cancelled')
        AND (
          lease_token IS NULL
          OR lease_expires_at IS NULL
          OR lease_expires_at <= ?
        )
    `),
    renew: db.prepare(`
      UPDATE ecommerce_job_assets
      SET lease_expires_at = ?, updated_at = ?
      WHERE job_id = ? AND asset_id = ? AND lease_token = ? AND lease_expires_at > ?
    `),
    release: db.prepare(`
      UPDATE ecommerce_job_assets
      SET lease_token = NULL, lease_expires_at = NULL, updated_at = ?
      WHERE job_id = ? AND asset_id = ? AND lease_token = ?
    `),
    checkpoint: db.prepare(`
      UPDATE ecommerce_job_assets
      SET request_snapshot = ?, updated_at = ?
      WHERE job_id = ? AND asset_id = ? AND lease_token = ?
        AND state = ?
    `),
    update: db.prepare(`
      UPDATE ecommerce_job_assets
      SET state = ?, request_snapshot = ?, provider_job_id = ?,
          attempt_count = ?, output_url = ?, stable_url = ?, error = ?,
          lease_token = ?, lease_expires_at = ?, updated_at = ?
      WHERE job_id = ? AND asset_id = ? AND lease_token = ?
        AND state = ?
    `),
  };

  function getAsset(jobIdInput, assetIdInput) {
    const jobId = validateId(jobIdInput, 'jobId');
    const assetId = validateId(assetIdInput, 'assetId');
    return rowToAsset(statements.get.get(jobId, assetId));
  }

  function createAsset(input = {}) {
    const jobId = validateId(own(input, 'jobId'), 'jobId');
    const assetId = validateId(own(input, 'assetId'), 'assetId');
    const snapshot = sanitizeSnapshot(own(input, 'requestSnapshot'));
    const timestamp = new Date(finiteNow(now)).toISOString();
    statements.insert.run(jobId, assetId, JSON.stringify(snapshot), timestamp, timestamp);
    return getAsset(jobId, assetId);
  }

  const claimTx = db.transaction((jobId, assetId, leaseMs) => {
    const current = getAsset(jobId, assetId);
    if (!current) throw new Error('asset job not found');
    if (FINAL_STATES.has(current.state)) return null;
    const nowMs = finiteNow(now);
    const leaseToken = cleanString(randomUUID());
    if (!leaseToken) throw new TypeError('randomUUID returned an invalid lease token');
    const leaseExpiresAt = new Date(nowMs + leaseMs).toISOString();
    const changed = statements.claim.run(
      leaseToken,
      leaseExpiresAt,
      new Date(nowMs).toISOString(),
      jobId,
      assetId,
      new Date(nowMs).toISOString(),
    ).changes;
    return changed === 1 ? { ...getAsset(jobId, assetId), leaseToken, leaseExpiresAt } : null;
  });

  function claimAsset(jobIdInput, assetIdInput, { leaseMs = defaultLeaseMs } = {}) {
    const jobId = validateId(jobIdInput, 'jobId');
    const assetId = validateId(assetIdInput, 'assetId');
    if (!Number.isSafeInteger(leaseMs) || leaseMs <= 0) {
      throw new TypeError('leaseMs must be a positive safe integer');
    }
    return claimTx.immediate(jobId, assetId, leaseMs);
  }

  function validateLease(current, leaseTokenInput) {
    const leaseToken = cleanString(leaseTokenInput);
    if (!leaseToken) throw new Error('asset lease token is required');
    if (current.leaseToken !== leaseToken) throw new Error('asset lease is no longer owned by this worker');
    if (!current.leaseExpiresAt || Date.parse(current.leaseExpiresAt) <= finiteNow(now)) {
      throw new Error('asset lease has expired');
    }
    return leaseToken;
  }

  function transitionAsset(jobIdInput, assetIdInput, nextStateInput, patch = {}) {
    const jobId = validateId(jobIdInput, 'jobId');
    const assetId = validateId(assetIdInput, 'assetId');
    const nextState = cleanString(nextStateInput);
    if (!STATE_SET.has(nextState)) throw new TypeError('unknown asset state');
    const current = getAsset(jobId, assetId);
    if (!current) throw new Error('asset job not found');
    const leaseToken = validateLease(current, own(patch, 'leaseToken'));
    if (!TRANSITIONS[current.state]?.has(nextState)) {
      throw new Error(`invalid transition ${current.state} -> ${nextState}`);
    }

    const providerJobId = own(patch, 'providerJobId') === undefined
      ? current.providerJobId
      : validateId(own(patch, 'providerJobId'), 'providerJobId');
    if (nextState === 'submitted' && !providerJobId) {
      throw new Error('submitted asset requires a provider job id');
    }
    const replacesProviderForRepair = current.state === 'repairing' && nextState === 'submitted';
    if (current.providerJobId
      && providerJobId
      && current.providerJobId !== providerJobId
      && !replacesProviderForRepair) {
      throw new Error('asset was already submitted with a different provider job id');
    }
    const requestSnapshot = own(patch, 'requestSnapshot') === undefined
      ? current.requestSnapshot
      : sanitizeSnapshot(own(patch, 'requestSnapshot'));
    const attemptCount = normalizeAttempt(own(patch, 'attemptCount'), current.attemptCount);
    const outputUrl = own(patch, 'outputUrl') === undefined
      ? current.outputUrl
      : normalizeHttpUrl(own(patch, 'outputUrl'), 'outputUrl');
    const stableUrl = own(patch, 'stableUrl') === undefined
      ? current.stableUrl
      : normalizeStableUrl(own(patch, 'stableUrl'));
    const error = own(patch, 'error') === undefined ? current.error : cleanString(own(patch, 'error'));
    const releasesLease = LEASE_RELEASE_STATES.has(nextState);
    const changed = statements.update.run(
      nextState,
      JSON.stringify(requestSnapshot),
      providerJobId,
      attemptCount,
      outputUrl,
      stableUrl,
      error,
      releasesLease ? null : current.leaseToken,
      releasesLease ? null : current.leaseExpiresAt,
      new Date(finiteNow(now)).toISOString(),
      jobId,
      assetId,
      leaseToken,
      current.state,
    ).changes;
    if (changed !== 1) throw new Error('asset state or lease changed during transition');
    return getAsset(jobId, assetId);
  }

  function checkpointAsset(jobIdInput, assetIdInput, patch = {}) {
    const jobId = validateId(jobIdInput, 'jobId');
    const assetId = validateId(assetIdInput, 'assetId');
    const current = getAsset(jobId, assetId);
    if (!current) throw new Error('asset job not found');
    const leaseToken = validateLease(current, own(patch, 'leaseToken'));
    const requestSnapshot = own(patch, 'requestSnapshot') === undefined
      ? current.requestSnapshot
      : sanitizeSnapshot(own(patch, 'requestSnapshot'));
    const changed = statements.checkpoint.run(
      JSON.stringify(requestSnapshot),
      new Date(finiteNow(now)).toISOString(),
      jobId,
      assetId,
      leaseToken,
      current.state,
    ).changes;
    if (changed !== 1) throw new Error('asset state or lease changed during checkpoint');
    return getAsset(jobId, assetId);
  }

  function markSubmitted(jobIdInput, assetIdInput, patch = {}) {
    const jobId = validateId(jobIdInput, 'jobId');
    const assetId = validateId(assetIdInput, 'assetId');
    const current = getAsset(jobId, assetId);
    if (!current) throw new Error('asset job not found');
    validateLease(current, own(patch, 'leaseToken'));
    const providerJobId = validateId(own(patch, 'providerJobId'), 'providerJobId');
    if (current.providerJobId) {
      if (current.state === 'repairing') {
        if (current.providerJobId === providerJobId) {
          throw new Error('repair submission requires a new provider job id');
        }
        return transitionAsset(jobId, assetId, 'submitted', {
          ...patch,
          providerJobId,
          attemptCount: own(patch, 'attemptCount') ?? current.attemptCount + 1,
        });
      }
      if (current.providerJobId !== providerJobId) {
        throw new Error('asset was already submitted with a different provider job id');
      }
      return current;
    }
    return transitionAsset(jobId, assetId, 'submitted', { ...patch, providerJobId });
  }

  function renewLease(jobIdInput, assetIdInput, leaseTokenInput, { leaseMs = defaultLeaseMs } = {}) {
    const jobId = validateId(jobIdInput, 'jobId');
    const assetId = validateId(assetIdInput, 'assetId');
    const leaseToken = cleanString(leaseTokenInput);
    if (!leaseToken) throw new Error('asset lease token is required');
    if (!Number.isSafeInteger(leaseMs) || leaseMs <= 0) throw new TypeError('leaseMs must be a positive safe integer');
    const nowMs = finiteNow(now);
    const leaseExpiresAt = new Date(nowMs + leaseMs).toISOString();
    const changed = statements.renew.run(
      leaseExpiresAt,
      new Date(nowMs).toISOString(),
      jobId,
      assetId,
      leaseToken,
      new Date(nowMs).toISOString(),
    ).changes;
    if (changed !== 1) throw new Error('asset lease is no longer owned by this worker');
    return getAsset(jobId, assetId);
  }

  function releaseLease(jobIdInput, assetIdInput, leaseTokenInput) {
    const jobId = validateId(jobIdInput, 'jobId');
    const assetId = validateId(assetIdInput, 'assetId');
    const leaseToken = cleanString(leaseTokenInput);
    if (!leaseToken) throw new Error('asset lease token is required');
    const changed = statements.release.run(
      new Date(finiteNow(now)).toISOString(),
      jobId,
      assetId,
      leaseToken,
    ).changes;
    if (changed !== 1) throw new Error('asset lease is no longer owned by this worker');
    return getAsset(jobId, assetId);
  }

  function listAssets(jobIdInput) {
    const jobId = validateId(jobIdInput, 'jobId');
    return statements.list.all(jobId).map(rowToAsset);
  }

  function recoverInterrupted() {
    return statements.recoverable.all().map(rowToAsset);
  }

  return {
    createAsset,
    getAsset,
    listAssets,
    claimAsset,
    renewLease,
    releaseLease,
    checkpointAsset,
    transitionAsset,
    markSubmitted,
    recoverInterrupted,
  };
}

export { sanitizeSnapshot };
