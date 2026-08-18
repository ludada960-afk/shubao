import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import Database from 'better-sqlite3';

const ACTIVE_STATES = new Set(['queued', 'submitting', 'processing', 'submission_unknown', 'needs_review']);

function tableExists(db, name) {
  return Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(name));
}

function rows(db, table) {
  return tableExists(db, table) ? db.prepare(`SELECT * FROM ${table}`).all() : [];
}

export function ensureVideoMigrationSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS video_job_migration_markers (
      job_id TEXT PRIMARY KEY,
      state TEXT NOT NULL,
      reason TEXT NOT NULL,
      details_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );
  `);
}

function buildInspection(db) {
  const jobs = rows(db, 'video_jobs');
  const attempts = new Map(rows(db, 'video_job_attempts').map(row => [row.job_id, row]));
  const markers = new Map(rows(db, 'video_job_migration_markers').map(row => [row.job_id, row]));
  const deliveries = new Map(rows(db, 'video_deliveries').map(row => [row.job_id, row]));
  const holdItems = rows(db, 'billing_hold_items');
  const holdItemsByHold = new Map();
  for (const item of holdItems) {
    const list = holdItemsByHold.get(item.hold_id) || [];
    list.push(item);
    holdItemsByHold.set(item.hold_id, list);
  }
  const blockingIssues = [];
  const add = (job, code, message) => blockingIssues.push({ jobId: job.id, code, message });

  for (const job of jobs) {
    if (ACTIVE_STATES.has(job.status)) {
      if (!String(job.owner_email || '').trim()) add(job, 'OWNER_MISSING', 'active job has no owner');
      if (!String(job.hold_id || '').trim()) add(job, 'HOLD_MISSING', 'active job has no billing hold');
      if (!attempts.has(job.id) && !markers.has(job.id)) add(job, 'RECOVERY_EVIDENCE_MISSING', 'active job has neither attempt nor migration marker');
    }
    if (job.status === 'completed') {
      const delivery = deliveries.get(job.id);
      if (!delivery || delivery.verification_state !== 'verified' || !String(delivery.sha256 || '').trim()) {
        add(job, 'DELIVERY_NOT_VERIFIED', 'completed job has no integrity-verified delivery');
      }
      if (job.project_projection_state !== 'projected' || job.projection_state !== 'projected') {
        add(job, 'PROJECTION_INCOMPLETE', 'completed job is not fully projected');
      }
    }
    if (['failed', 'cancelled'].includes(job.status) && job.billing_state === 'released') {
      const items = holdItemsByHold.get(job.hold_id) || [];
      if (!items.length || items.some(item => item.status !== 'released')) {
        add(job, 'REFUND_NOT_RELEASED', 'job claims a refund but its wallet item is not released');
      }
    }
  }
  return {
    counts: {
      jobs: jobs.length,
      active: jobs.filter(job => ACTIVE_STATES.has(job.status)).length,
      completed: jobs.filter(job => job.status === 'completed').length,
      migrationMarkers: markers.size,
    },
    blockingIssues,
  };
}

export function inspectVideoPlatform(db) {
  ensureVideoMigrationSchema(db);
  return buildInspection(db);
}

function backfillVerifiedDeliveries(db, jobs, { apply, assetRoot }) {
  if (!tableExists(db, 'video_assets') || !tableExists(db, 'video_deliveries')) return 0;
  const existing = new Set(rows(db, 'video_deliveries').map(row => row.job_id));
  const candidates = jobs.filter(job => job.status === 'completed' && job.result_asset_id && !existing.has(job.id));
  if (!apply) return candidates.length;

  const assetColumns = new Set(db.prepare('PRAGMA table_info(video_assets)').all().map(column => column.name));
  const updateAsset = assetColumns.has('sha256')
    ? db.prepare('UPDATE video_assets SET bytes = ?, sha256 = ? WHERE id = ?')
    : db.prepare('UPDATE video_assets SET bytes = ? WHERE id = ?');
  const insertDelivery = db.prepare(`INSERT OR IGNORE INTO video_deliveries (
    id, job_id, attempt_id, provider_source, file_name, content_type, bytes, sha256, verification_state
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'verified')`);
  let migrated = 0;
  db.transaction(() => {
    for (const job of candidates) {
      const asset = db.prepare('SELECT * FROM video_assets WHERE id = ? AND owner_email = ?').get(job.result_asset_id, job.owner_email);
      if (!asset?.file_name) continue;
      const filePath = resolve(assetRoot, 'output', asset.file_name);
      if (!existsSync(filePath) || !statSync(filePath).isFile()) continue;
      const bytes = statSync(filePath).size;
      const sha256 = createHash('sha256').update(readFileSync(filePath)).digest('hex');
      if (assetColumns.has('sha256')) updateAsset.run(bytes, sha256, asset.id);
      else updateAsset.run(bytes, asset.id);
      insertDelivery.run(
        asset.id,
        job.id,
        job.current_attempt_id || '',
        job.provider_task_id || 'legacy-provider-delivery',
        asset.file_name,
        asset.content_type || 'video/mp4',
        bytes,
        sha256,
      );
      migrated += 1;
    }
  })();
  return migrated;
}

export function backfillVideoPlatform(db, { apply = false, assetRoot = 'server/video-assets' } = {}) {
  ensureVideoMigrationSchema(db);
  const jobs = rows(db, 'video_jobs');
  const attemptJobIds = new Set(rows(db, 'video_job_attempts').map(row => row.job_id));
  const markerJobIds = new Set(rows(db, 'video_job_migration_markers').map(row => row.job_id));
  const candidates = jobs.filter(job => ACTIVE_STATES.has(job.status) && !attemptJobIds.has(job.id) && !markerJobIds.has(job.id));
  if (apply && candidates.length) {
    const insert = db.prepare(`INSERT OR IGNORE INTO video_job_migration_markers
      (job_id, state, reason, details_json) VALUES (?, 'legacy_active', 'predates durable attempt ledger', ?)`);
    db.transaction(() => {
      for (const job of candidates) {
        insert.run(job.id, JSON.stringify({ status: job.status, providerTaskIdPresent: Boolean(job.provider_task_id) }));
      }
    })();
  }
  const verifiedDeliveries = backfillVerifiedDeliveries(db, jobs, { apply, assetRoot });
  return {
    mode: apply ? 'apply' : 'dry-run',
    changes: { migrationMarkers: candidates.length, verifiedDeliveries },
    ...buildInspection(db),
  };
}

export function parseArguments(argv) {
  const databaseIndex = argv.indexOf('--database');
  const assetRootIndex = argv.indexOf('--asset-root');
  return {
    apply: argv.includes('--apply'),
    database: databaseIndex >= 0 ? argv[databaseIndex + 1] : process.env.SHUBAO_DB_PATH || 'server/works.db',
    assetRoot: assetRootIndex >= 0 ? argv[assetRootIndex + 1] : process.env.SHUBAO_VIDEO_ASSET_ROOT || 'server/video-assets',
  };
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const options = parseArguments(process.argv.slice(2));
  const db = new Database(options.database, { fileMustExist: true });
  try {
    const report = backfillVideoPlatform(db, options);
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    if (report.blockingIssues.length) process.exitCode = 1;
  } finally {
    db.close();
  }
}
