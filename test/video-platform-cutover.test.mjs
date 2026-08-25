import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { readVideoPlatformFlags, VIDEO_PLATFORM_FLAG_NAMES } from '../server/config.mjs';
import { backfillVideoPlatform, inspectVideoPlatform } from '../scripts/backfill-video-platform.mjs';
import { verifyVideoPlatformDatabase } from '../scripts/verify-video-platform.mjs';

function createLegacyDatabase() {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE video_jobs (
      id TEXT PRIMARY KEY,
      owner_email TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL,
      hold_id TEXT NOT NULL DEFAULT '',
      billing_state TEXT NOT NULL DEFAULT 'held',
      delivery_state TEXT NOT NULL DEFAULT 'none',
      project_projection_state TEXT NOT NULL DEFAULT 'none',
      projection_state TEXT NOT NULL DEFAULT 'none',
      current_attempt_id TEXT NOT NULL DEFAULT '',
      provider_task_id TEXT NOT NULL DEFAULT '',
      result_asset_id TEXT NOT NULL DEFAULT '',
      error TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE video_job_attempts (id TEXT PRIMARY KEY, job_id TEXT NOT NULL, state TEXT NOT NULL);
    CREATE TABLE video_deliveries (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL UNIQUE,
      attempt_id TEXT NOT NULL DEFAULT '',
      provider_source TEXT NOT NULL DEFAULT '',
      file_name TEXT NOT NULL,
      content_type TEXT NOT NULL,
      bytes INTEGER NOT NULL,
      verification_state TEXT NOT NULL,
      sha256 TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE video_assets (
      id TEXT PRIMARY KEY,
      owner_email TEXT NOT NULL,
      kind TEXT NOT NULL,
      content_type TEXT NOT NULL,
      bytes INTEGER NOT NULL,
      sha256 TEXT NOT NULL DEFAULT '',
      file_name TEXT NOT NULL
    );
    CREATE TABLE billing_hold_items (
      id TEXT PRIMARY KEY,
      hold_id TEXT NOT NULL,
      item_key TEXT NOT NULL,
      status TEXT NOT NULL
    );
  `);
  return db;
}

test('P0 video platform flags default on while live workbench remains default-off', () => {
  const defaults = readVideoPlatformFlags({});
  assert.deepEqual(Object.keys(defaults).sort(), [...VIDEO_PLATFORM_FLAG_NAMES].sort());
  assert.equal(defaults.VIDEO_PLATFORM_P1_WORKBENCH, false);
  // UI/工作台类 flag（未过QA前）允许默认关闭；数据链路类 flag 必须默认开启
  const uiFlags = new Set(['VIDEO_PLATFORM_P1_WORKBENCH', 'VIDEO_PLATFORM_DIRECTOR_UI']);
  assert.ok(Object.entries(defaults)
    .filter(([name]) => !uiFlags.has(name))
    .every(([, enabled]) => enabled));
  for (const uiFlag of uiFlags) {
    if (Object.prototype.hasOwnProperty.call(defaults, uiFlag)) {
      assert.equal(defaults[uiFlag], false, uiFlag + ' should default off until QA signs off');
    }
  }

  const rolledBack = readVideoPlatformFlags({
    VIDEO_PLATFORM_OWNER_READS: 'false',
    VIDEO_PLATFORM_ATTEMPTS: '0',
    VIDEO_PLATFORM_OUTBOX: 'off',
    VIDEO_PLATFORM_PROJECT_BRIDGE: 'no',
    VIDEO_PLATFORM_TUS_UPLOAD: 'FALSE',
    VIDEO_PLATFORM_READ_NEW_STATE: 'disabled',
    VIDEO_PLATFORM_P1_PLANNING: 'false',
  });
  assert.ok(Object.values(rolledBack).every(value => value === false));
  assert.throws(() => readVideoPlatformFlags({ VIDEO_PLATFORM_OUTBOX: 'sometimes' }), /VIDEO_PLATFORM_OUTBOX/);
});

test('backfill marks legacy active jobs without inventing a provider attempt', () => {
  const db = createLegacyDatabase();
  db.prepare("INSERT INTO video_jobs (id, owner_email, status, hold_id) VALUES ('legacy-active', 'owner@example.com', 'processing', 'hold-1')").run();
  db.prepare("INSERT INTO billing_hold_items VALUES ('item-1', 'hold-1', 'video', 'held')").run();

  const dryRun = backfillVideoPlatform(db, { apply: false });
  assert.equal(dryRun.changes.migrationMarkers, 1);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM video_job_migration_markers').get().count, 0);

  const applied = backfillVideoPlatform(db, { apply: true });
  assert.equal(applied.changes.migrationMarkers, 1);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM video_job_attempts').get().count, 0);
  assert.equal(db.prepare("SELECT state FROM video_job_migration_markers WHERE job_id = 'legacy-active'").get().state, 'legacy_active');
  assert.equal(inspectVideoPlatform(db).blockingIssues.length, 0);
});

test('invariants reject fabricated delivery and refund claims', () => {
  const db = createLegacyDatabase();
  db.prepare(`INSERT INTO video_jobs (
    id, owner_email, status, hold_id, billing_state, delivery_state,
    project_projection_state, projection_state, result_asset_id
  ) VALUES ('bad-complete', 'owner@example.com', 'completed', 'hold-1', 'settled', 'verified', 'projected', 'projected', 'asset-1')`).run();
  db.prepare("INSERT INTO video_jobs (id, owner_email, status, hold_id, billing_state) VALUES ('bad-refund', 'owner@example.com', 'failed', 'hold-2', 'released')").run();
  db.prepare("INSERT INTO billing_hold_items VALUES ('item-1', 'hold-1', 'video', 'settled')").run();
  db.prepare("INSERT INTO billing_hold_items VALUES ('item-2', 'hold-2', 'video', 'held')").run();

  const report = inspectVideoPlatform(db);
  assert.ok(report.blockingIssues.some(issue => issue.jobId === 'bad-complete' && issue.code === 'DELIVERY_NOT_VERIFIED'));
  assert.ok(report.blockingIssues.some(issue => issue.jobId === 'bad-refund' && issue.code === 'REFUND_NOT_RELEASED'));
});

test('backfill verifies a real legacy output file instead of fabricating delivery evidence', () => {
  const root = mkdtempSync(join(tmpdir(), 'shubao-video-cutover-'));
  mkdirSync(join(root, 'output'));
  writeFileSync(join(root, 'output', 'legacy.mp4'), Buffer.from('real legacy video bytes'));
  const db = createLegacyDatabase();
  try {
    db.prepare(`INSERT INTO video_jobs (
      id, owner_email, status, hold_id, billing_state, delivery_state,
      project_projection_state, projection_state, result_asset_id
    ) VALUES ('legacy-complete', 'owner@example.com', 'completed', 'hold-1', 'settled', 'verified', 'projected', 'projected', 'asset-1')`).run();
    db.prepare("INSERT INTO video_assets VALUES ('asset-1', 'owner@example.com', 'output', 'video/mp4', 0, '', 'legacy.mp4')").run();

    const applied = backfillVideoPlatform(db, { apply: true, assetRoot: root });
    assert.equal(applied.changes.verifiedDeliveries, 1);
    const delivery = db.prepare("SELECT * FROM video_deliveries WHERE job_id = 'legacy-complete'").get();
    assert.equal(delivery.verification_state, 'verified');
    assert.equal(delivery.bytes, Buffer.byteLength('real legacy video bytes'));
    assert.match(delivery.sha256, /^[a-f0-9]{64}$/);
    assert.equal(applied.blockingIssues.length, 0);
  } finally {
    db.close();
    rmSync(root, { recursive: true, force: true });
  }
});

test('local verifier proves zero provider submissions and fails without the paid-generation guard', () => {
  const db = createLegacyDatabase();
  try {
    const report = verifyVideoPlatformDatabase(db, { noPaidGeneration: true });
    assert.equal(report.ok, true);
    assert.equal(report.providerSubmissions, 0);
    assert.equal(report.paidGenerationRequested, false);

    const unsafe = verifyVideoPlatformDatabase(db, { noPaidGeneration: false });
    assert.equal(unsafe.ok, false);
    assert.ok(unsafe.blockingIssues.some(issue => issue.code === 'PAID_GENERATION_GUARD_MISSING'));
  } finally {
    db.close();
  }
});
