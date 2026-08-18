import crypto from 'node:crypto';

function clean(value, max = 500) {
  return String(value ?? '').trim().slice(0, max);
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function requestHash(payload) {
  return crypto.createHash('sha256').update(stableJson(payload)).digest('hex');
}

export function createVideoAttemptStore({ db } = {}) {
  if (!db) throw new TypeError('video attempt store requires a database');
  db.exec(`
    CREATE TABLE IF NOT EXISTS video_job_attempts (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL,
      attempt_number INTEGER NOT NULL,
      submission_key TEXT NOT NULL,
      request_hash TEXT NOT NULL,
      provider TEXT NOT NULL,
      model TEXT NOT NULL,
      capability_json TEXT NOT NULL DEFAULT '{}',
      provider_task_id TEXT NOT NULL DEFAULT '',
      state TEXT NOT NULL,
      error_class TEXT NOT NULL DEFAULT '',
      error_message TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      UNIQUE(job_id, attempt_number),
      UNIQUE(submission_key)
    );
    CREATE INDEX IF NOT EXISTS idx_video_attempts_job ON video_job_attempts(job_id, attempt_number DESC);
    CREATE INDEX IF NOT EXISTS idx_video_attempts_state ON video_job_attempts(state, updated_at);
  `);
  const selectById = db.prepare('SELECT * FROM video_job_attempts WHERE id = ?');

  function update(id, values) {
    const entries = Object.entries(values);
    if (!entries.length) return selectById.get(id);
    db.prepare(`UPDATE video_job_attempts SET ${entries.map(([key]) => `${key} = ?`).join(', ')}, updated_at = datetime('now', 'localtime') WHERE id = ?`)
      .run(...entries.map(([, value]) => value), id);
    return selectById.get(id);
  }

  return {
    begin({ jobId, submissionKey, payload, provider, model, capability = {} }) {
      const normalizedJobId = clean(jobId, 140);
      const normalizedKey = clean(submissionKey, 200);
      const existing = db.prepare('SELECT * FROM video_job_attempts WHERE submission_key = ?').get(normalizedKey);
      if (existing) {
        if (existing.job_id !== normalizedJobId || existing.request_hash !== requestHash(payload)) {
          throw Object.assign(new Error('video submission key conflicts with another request'), { code: 'VIDEO_ATTEMPT_CONFLICT' });
        }
        return existing;
      }
      const attemptNumber = Number(db.prepare('SELECT COALESCE(MAX(attempt_number), 0) AS value FROM video_job_attempts WHERE job_id = ?').get(normalizedJobId)?.value || 0) + 1;
      const id = `${normalizedJobId}:${attemptNumber}`;
      db.prepare(`INSERT INTO video_job_attempts (
        id, job_id, attempt_number, submission_key, request_hash, provider, model,
        capability_json, state
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'submitting')`).run(
        id,
        normalizedJobId,
        attemptNumber,
        normalizedKey,
        requestHash(payload),
        clean(provider, 120),
        clean(model, 120),
        stableJson(capability),
      );
      return selectById.get(id);
    },
    get(id) { return selectById.get(clean(id, 180)); },
    listForJob(jobId) {
      return db.prepare('SELECT * FROM video_job_attempts WHERE job_id = ? ORDER BY attempt_number').all(clean(jobId, 140));
    },
    markAccepted(id, providerTaskId) {
      return update(id, { state: 'accepted', provider_task_id: clean(providerTaskId, 200), error_class: '', error_message: '' });
    },
    attachProviderTask(id, providerTaskId) {
      return update(id, { state: 'accepted', provider_task_id: clean(providerTaskId, 200), error_class: '', error_message: '' });
    },
    markUncertain(id, error) {
      return update(id, { state: 'uncertain', error_class: 'submission_unknown', error_message: clean(error?.message, 500) });
    },
    markNotSubmitted(id, reason = '') {
      return update(id, {
        state: 'confirmed_not_submitted',
        provider_task_id: '',
        error_class: 'confirmed_not_submitted',
        error_message: clean(reason, 500),
      });
    },
    markFailed(id, error) {
      return update(id, { state: 'failed', error_class: clean(error?.code || 'provider', 120), error_message: clean(error?.message, 500) });
    },
    markDelivered(id) {
      return update(id, { state: 'delivered', error_class: '', error_message: '' });
    },
  };
}
