const path = require('node:path');

const dbPath = process.argv[2] || path.resolve(__dirname, '..', 'server', 'works.db');
const projectRoot = process.argv[3] || path.resolve(path.dirname(dbPath), '..');
const Database = require(require.resolve('better-sqlite3', { paths: [projectRoot] }));
const db = new Database(dbPath, { readonly: true, fileMustExist: true });

function parse(value) {
  try { return value ? JSON.parse(value) : {}; } catch { return {}; }
}

function collectIssueCodes(value, output = new Set(), depth = 0) {
  if (depth > 10 || value === null || value === undefined) return output;
  if (Array.isArray(value)) {
    for (const item of value) collectIssueCodes(item, output, depth + 1);
    return output;
  }
  if (typeof value !== 'object') return output;
  for (const [key, item] of Object.entries(value)) {
    if (/issuecodes?/i.test(key) && Array.isArray(item)) {
      for (const code of item) {
        if (typeof code === 'string' && code.trim()) output.add(code.trim());
      }
    } else {
      collectIssueCodes(item, output, depth + 1);
    }
  }
  return output;
}

function findRepairType(value, depth = 0) {
  if (depth > 10 || value === null || typeof value !== 'object') return '';
  if (!Array.isArray(value) && value.repairAction && typeof value.repairAction === 'object') {
    const type = String(value.repairAction.type || '').trim();
    if (type) return type;
  }
  for (const item of Array.isArray(value) ? value : Object.values(value)) {
    const found = findRepairType(item, depth + 1);
    if (found) return found;
  }
  return '';
}

const jobs = db.prepare(`
  SELECT id, status, error, progress, created_at, updated_at
  FROM ecommerce_jobs
  ORDER BY created_at DESC
  LIMIT 12
`).all();
const assetsForJob = db.prepare(`
  SELECT asset_id, state, attempt_count, error, request_snapshot, created_at, updated_at
  FROM ecommerce_job_assets
  WHERE job_id = ?
  ORDER BY asset_id
`);

const output = jobs.map(job => ({
  id: job.id,
  status: job.status,
  error: job.error,
  createdAt: job.created_at,
  updatedAt: job.updated_at,
  progress: (() => {
    const progress = parse(job.progress);
    return {
      current: progress.current,
      total: progress.total,
      completed: progress.completed,
      needsReview: progress.needsReview,
      failed: progress.failed,
    };
  })(),
  assets: assetsForJob.all(job.id).map(asset => {
    const snapshot = parse(asset.request_snapshot);
    return {
      id: asset.asset_id,
      state: asset.state,
      attemptCount: asset.attempt_count,
      error: asset.error,
      executionCount: snapshot.executionCount || {},
      issueCodes: [...collectIssueCodes(snapshot)],
      repairType: findRepairType(snapshot),
      createdAt: asset.created_at,
      updatedAt: asset.updated_at,
    };
  }),
}));

process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
db.close();
