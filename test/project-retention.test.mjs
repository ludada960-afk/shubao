import assert from 'node:assert/strict';
import test from 'node:test';
import Database from 'better-sqlite3';

import { ensureBillingSchema } from '../server/billing/schema.mjs';
import { ensureProjectSchema } from '../server/projects/schema.mjs';
import { createRetentionService } from '../server/projects/retentionService.mjs';

test('schema migrates legacy project assets before creating the retention index', () => {
  const db = new Database(':memory:');
  db.exec(`CREATE TABLE project_assets (
    id TEXT PRIMARY KEY,
    owner_email TEXT NOT NULL,
    project_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content_hash TEXT NOT NULL,
    stable_url TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    retention_class TEXT NOT NULL,
    created_at TEXT NOT NULL,
    deleted_at TEXT
  )`);

  ensureProjectSchema(db);

  const columns = db.prepare('PRAGMA table_info(project_assets)').all().map(column => column.name);
  assert.ok(columns.includes('retention_state'));
  assert.ok(columns.includes('retention_class_before_pin'));
  assert.ok(columns.includes('retention_pinned'));
  assert.ok(columns.includes('expires_at_before_pin'));
  assert.ok(columns.includes('marked_at'));
  assert.ok(columns.includes('isolated_at'));
  const indexes = db.prepare('PRAGMA index_list(project_assets)').all().map(index => index.name);
  assert.ok(indexes.includes('idx_project_assets_retention'));
  db.close();
});

function createHarness() {
  const db = new Database(':memory:');
  ensureBillingSchema(db);
  ensureProjectSchema(db);
  db.prepare(`INSERT INTO projects (id, owner_email, kind, title, status, created_at, updated_at)
    VALUES ('project-1', 'owner@example.com', 'ecommerce', '', 'completed', '2026-06-01T00:00:00.000Z', '2026-06-01T00:00:00.000Z')`).run();
  const removed = [];
  const retention = createRetentionService({
    db,
    assetStore: { remove: assetId => { removed.push(assetId); } },
    now: () => new Date('2026-07-30T12:00:00.000Z'),
  });
  return { db, removed, retention };
}

function insertAsset(db, { id, projectId = 'project-1', retentionState = 'isolated', markedAt = '2026-07-28T12:00:00.000Z', isolatedAt = '2026-07-28T12:00:00.000Z' } = {}) {
  db.prepare(`INSERT INTO project_assets
    (id, asset_id, owner_email, project_id, role, stable_url, mime_type, content_hash, retention_class, retention_state, marked_at, isolated_at, created_at)
    VALUES (?, ?, 'owner@example.com', ?, 'generated', ?, 'image/png', ?, 'completed', ?, ?, ?, '2026-06-01T00:00:00.000Z')`).run(
    `link-${id}`, id, projectId, `/api/generated-assets/${id}.png`, id, retentionState, markedAt, isolatedAt,
  );
}

test('retention deletes only expired unprotected binary assets', () => {
  const { db, removed, retention } = createHarness();
  insertAsset(db, { id: 'expired-unreferenced' });
  insertAsset(db, { id: 'active-canvas' });
  insertAsset(db, { id: 'billing-dispute' });
  insertAsset(db, { id: 'rendered-composition' });
  db.prepare(`INSERT INTO canvas_sessions
    (id, owner_email, project_id, base_version_id, snapshot, expires_at, created_at, updated_at)
    VALUES ('canvas-1', 'owner@example.com', 'project-1', 'version-1', '{"assetId":"active-canvas"}', '2026-08-01T00:00:00.000Z', '2026-07-01T00:00:00.000Z', '2026-07-01T00:00:00.000Z')`).run();
  db.prepare(`INSERT INTO billing_holds
    (id, owner_email, currency, quote_id, status, total_units, idempotency_key, expires_at, metadata)
    VALUES ('hold-1', 'owner@example.com', 'ecommerce_points', 'quote-1', 'disputed', 1, 'hold-key', '2026-08-01T00:00:00.000Z', '{"taskId":"task-1","dispute":true}')`).run();
  db.prepare(`INSERT INTO billing_hold_items (id, hold_id, item_key, sku, units, status, reference_id)
    VALUES ('hold-item-1', 'hold-1', 'billing-dispute', 'ec_image_2k', 1, 'settled', 'billing-dispute')`).run();
  db.prepare(`INSERT INTO composition_documents
    (id, owner_email, project_id, version_id, width, height, created_at, updated_at)
    VALUES ('document-1', 'owner@example.com', 'project-1', 'version-1', 100, 100, '2026-07-01T00:00:00.000Z', '2026-07-01T00:00:00.000Z')`).run();
  db.prepare(`INSERT INTO composition_revisions (document_id, revision, layers, rendered_asset_id, created_at)
    VALUES ('document-1', 1, '[]', 'rendered-composition', '2026-07-01T00:00:00.000Z')`).run();

  const report = retention.deleteIsolated();

  assert.deepEqual(report.deletedAssetIds, ['expired-unreferenced']);
  assert.deepEqual(removed, ['expired-unreferenced']);
  assert.deepEqual(report.protectedAssetIds.sort(), ['active-canvas', 'billing-dispute', 'rendered-composition']);
  assert.equal(db.prepare("SELECT retention_state FROM project_assets WHERE asset_id = 'expired-unreferenced'").get().retention_state, 'deleted');
  db.close();
});

test('expired project versions retain metadata without retaining the binary forever', () => {
  const { db, removed, retention } = createHarness();
  insertAsset(db, { id: 'version-asset', retentionState: 'active', markedAt: null, isolatedAt: null });

  const first = retention.sweep();
  assert.deepEqual(first.markedAssetIds, ['version-asset']);
  assert.deepEqual(first.deletedAssetIds, []);
  db.prepare("UPDATE project_assets SET isolated_at = '2026-07-28T12:00:00.000Z' WHERE asset_id = 'version-asset'").run();
  const second = retention.sweep();

  const version = retention.listProjectAssets('project-1')[0];
  assert.equal(version.expired, true);
  assert.deepEqual(second.deletedAssetIds, ['version-asset']);
  assert.deepEqual(removed, ['version-asset']);
  db.close();
});

test('shared stable bytes remain until every project reference is eligible for deletion', () => {
  const { db, removed, retention } = createHarness();
  db.prepare(`INSERT INTO projects (id, owner_email, kind, title, status, created_at, updated_at)
    VALUES ('project-2', 'owner@example.com', 'ecommerce', '', 'completed', '2026-06-01T00:00:00.000Z', '2026-06-01T00:00:00.000Z')`).run();
  insertAsset(db, { id: 'shared-byte' });
  db.prepare(`INSERT INTO project_assets
    (id, asset_id, owner_email, project_id, role, stable_url, mime_type, content_hash, retention_class, retention_state, created_at)
    VALUES ('link-shared-byte-2', 'shared-byte', 'owner@example.com', 'project-2', 'generated', '/api/generated-assets/shared-byte.png', 'image/png', 'shared-byte', 'completed', 'active', '2026-07-29T00:00:00.000Z')`).run();

  const report = retention.deleteIsolated();

  assert.deepEqual(report.deletedAssetIds, []);
  assert.deepEqual(removed, []);
  assert.equal(db.prepare("SELECT retention_state FROM project_assets WHERE id = 'link-shared-byte'").get().retention_state, 'isolated');
  db.close();
});

test('a formerly protected asset receives a fresh isolation grace period before deletion', () => {
  const { db, removed, retention } = createHarness();
  insertAsset(db, { id: 'released-canvas', retentionState: 'marked', isolatedAt: null });
  db.prepare(`INSERT INTO canvas_sessions
    (id, owner_email, project_id, base_version_id, snapshot, expires_at, created_at, updated_at)
    VALUES ('canvas-release', 'owner@example.com', 'project-1', 'version-1', '{"assetId":"released-canvas"}', '2026-08-01T00:00:00.000Z', '2026-07-01T00:00:00.000Z', '2026-07-01T00:00:00.000Z')`).run();
  assert.deepEqual(retention.sweep().deletedAssetIds, []);
  db.prepare("UPDATE canvas_sessions SET status = 'discarded' WHERE id = 'canvas-release'").run();

  const released = retention.sweep();

  assert.deepEqual(released.isolatedAssetIds, ['released-canvas']);
  assert.deepEqual(released.deletedAssetIds, []);
  assert.deepEqual(removed, []);
  db.close();
});

test('work retention reflects the earliest durable asset expiry and rejects an invalid grace period', () => {
  const { db, retention } = createHarness();
  insertAsset(db, { id: 'work-asset', retentionState: 'active', markedAt: null, isolatedAt: null });
  const expired = retention.describeWork({
    ownerEmail: 'owner@example.com',
    work: { images: [{ url: '/api/generated-assets/work-asset.png' }] },
  });

  assert.equal(expired.expired, true);
  const noGrace = createRetentionService({ db, assetStore: { remove() {} }, now: () => new Date('2026-07-30T12:00:00.000Z'), graceMs: 0 });
  assert.deepEqual(noGrace.deleteIsolated().deletedAssetIds, []);
  db.close();
});

test('a non-deleted Work keeps its referenced binary available beyond the nominal expiry', () => {
  const { db, retention } = createHarness();
  insertAsset(db, { id: 'preserved-work', retentionState: 'active', markedAt: null, isolatedAt: null });
  db.exec(`CREATE TABLE works (deleted_at TEXT, payload TEXT)`);
  db.prepare("INSERT INTO works (deleted_at, payload) VALUES ('', ?)").run(JSON.stringify({ images: [{ url: '/api/generated-assets/preserved-work.png' }] }));

  assert.deepEqual(retention.describeWork({
    ownerEmail: 'owner@example.com',
    work: { images: [{ url: '/api/generated-assets/preserved-work.png' }] },
  }), { expiresAt: null, preserved: true, expired: false });
  db.close();
});

test('a Work from another owner cannot protect an expired project asset', () => {
  const { db, removed, retention } = createHarness();
  db.exec(`CREATE TABLE works (owner_email TEXT, deleted_at TEXT, payload TEXT)`);
  insertAsset(db, { id: 'owner-isolated', retentionState: 'marked' });
  db.prepare("INSERT INTO works (owner_email, deleted_at, payload) VALUES ('other@example.com', '', ?)")
    .run(JSON.stringify({ images: [{ url: '/api/generated-assets/owner-isolated.png' }] }));

  const report = retention.isolateMarked();

  assert.deepEqual(report.protectedAssetIds, []);
  assert.deepEqual(report.isolatedAssetIds, ['owner-isolated']);
  assert.deepEqual(removed, []);
  db.close();
});

test('a Canvas session from another owner cannot protect an expired project asset', () => {
  const { db, removed, retention } = createHarness();
  insertAsset(db, { id: 'canvas-owner-isolated', retentionState: 'marked' });
  db.prepare(`INSERT INTO canvas_sessions
    (id, owner_email, project_id, base_version_id, snapshot, expires_at, created_at, updated_at)
    VALUES ('foreign-canvas', 'other@example.com', 'project-1', 'version-1', ?, '2026-08-01T00:00:00.000Z', '2026-07-01T00:00:00.000Z', '2026-07-01T00:00:00.000Z')`)
    .run(JSON.stringify({ assetId: 'canvas-owner-isolated' }));

  const report = retention.isolateMarked();

  assert.deepEqual(report.protectedAssetIds, []);
  assert.deepEqual(report.isolatedAssetIds, ['canvas-owner-isolated']);
  assert.deepEqual(removed, []);
  db.close();
});

test('a confirmed video workbench version protects its canonical project asset', () => {
  const { db, removed, retention } = createHarness();
  db.exec(`CREATE TABLE video_workbench_asset_versions (
    id TEXT PRIMARY KEY,
    owner_email TEXT NOT NULL,
    project_id TEXT NOT NULL,
    source_project_asset_id TEXT,
    metadata_json TEXT NOT NULL DEFAULT '{}'
  )`);
  insertAsset(db, { id: 'video-reference', retentionState: 'marked' });
  db.prepare(`INSERT INTO video_workbench_asset_versions
    (id, owner_email, project_id, source_project_asset_id)
    VALUES ('video-version-1', 'owner@example.com', 'project-1', 'link-video-reference')`).run();

  const report = retention.isolateMarked();

  assert.deepEqual(report.protectedAssetIds, ['video-reference']);
  assert.deepEqual(report.isolatedAssetIds, []);
  assert.deepEqual(removed, []);
  assert.equal(db.prepare("SELECT retention_state FROM project_assets WHERE asset_id = 'video-reference'").get().retention_state, 'marked');
  db.close();
});

test('a video replay manifest reference protects its canonical project asset', () => {
  const { db, removed, retention } = createHarness();
  db.exec(`CREATE TABLE video_replay_manifests (
    id TEXT PRIMARY KEY,
    owner_email TEXT NOT NULL,
    project_id TEXT NOT NULL,
    manifest_json TEXT NOT NULL
  )`);
  insertAsset(db, { id: 'video-manifest-reference', retentionState: 'marked' });
  db.prepare(`INSERT INTO video_replay_manifests
    (id, owner_email, project_id, manifest_json)
    VALUES ('manifest-1', 'owner@example.com', 'project-1', ?)`).run(JSON.stringify({
      projectAssetId: 'link-video-manifest-reference',
    }));

  const report = retention.isolateMarked();

  assert.deepEqual(report.protectedAssetIds, ['video-manifest-reference']);
  assert.deepEqual(report.isolatedAssetIds, []);
  assert.deepEqual(removed, []);
  db.close();
});

test('a cross-project imported asset protects its authoritative source by owner and hash', () => {
  const { db, removed, retention } = createHarness();
  db.prepare(`INSERT INTO projects (id, owner_email, kind, title, status, created_at, updated_at)
    VALUES ('project-2', 'owner@example.com', 'video', '', 'completed', '2026-06-01T00:00:00.000Z', '2026-06-01T00:00:00.000Z')`).run();
  db.prepare(`INSERT INTO projects (id, owner_email, kind, title, status, created_at, updated_at)
    VALUES ('project-foreign', 'other@example.com', 'video', '', 'completed', '2026-06-01T00:00:00.000Z', '2026-06-01T00:00:00.000Z')`).run();
  insertAsset(db, { id: 'external-source', retentionState: 'marked' });
  insertAsset(db, { id: 'hash-mismatch-source', retentionState: 'marked' });
  insertAsset(db, { id: 'foreign-owner-source', retentionState: 'marked' });
  db.prepare(`INSERT INTO project_assets
    (id, asset_id, owner_email, project_id, role, stable_url, mime_type, content_hash, metadata_json, retention_class, retention_state, created_at)
    VALUES ('imported-copy', 'external-source', 'owner@example.com', 'project-2', 'style',
      '/api/generated-assets/external-source.png', 'image/png', 'source-hash', ?, 'source', 'active', '2026-07-29T00:00:00.000Z')`).run(JSON.stringify({
    importedFromProjectAsset: {
      projectId: 'project-1',
      projectAssetId: 'link-external-source',
      expectedContentHash: 'external-source',
    },
  }));
  db.prepare(`INSERT INTO project_assets
    (id, asset_id, owner_email, project_id, role, stable_url, mime_type, content_hash, metadata_json, retention_class, retention_state, created_at)
    VALUES ('mismatched-copy', 'hash-mismatch-source', 'owner@example.com', 'project-2', 'style',
      '/api/generated-assets/hash-mismatch-source.png', 'image/png', 'wrong-copy-hash', ?, 'source', 'active', '2026-07-29T00:00:00.000Z')`).run(JSON.stringify({
    importedFromProjectAsset: {
      projectId: 'project-1',
      projectAssetId: 'link-hash-mismatch-source',
      expectedContentHash: 'tampered-hash',
    },
  }));
  db.prepare(`INSERT INTO project_assets
    (id, asset_id, owner_email, project_id, role, stable_url, mime_type, content_hash, metadata_json, retention_class, retention_state, created_at)
    VALUES ('foreign-copy', 'foreign-owner-source', 'other@example.com', 'project-foreign', 'style',
      '/api/generated-assets/foreign-owner-source.png', 'image/png', 'foreign-copy-hash', ?, 'source', 'active', '2026-07-29T00:00:00.000Z')`).run(JSON.stringify({
    importedFromProjectAsset: {
      projectId: 'project-1',
      projectAssetId: 'link-foreign-owner-source',
      expectedContentHash: 'foreign-owner-source',
    },
  }));

  const report = retention.isolateMarked();

  assert.deepEqual(report.protectedAssetIds, ['external-source']);
  assert.deepEqual(report.isolatedAssetIds.sort(), ['foreign-owner-source', 'hash-mismatch-source']);
  assert.deepEqual(removed, []);
  db.close();
});

test('a pinned asset stays active and is never marked by retention cleanup', () => {
  const { db, removed, retention } = createHarness();
  insertAsset(db, { id: 'pinned-reference', retentionState: 'active' });
  db.prepare(`UPDATE project_assets
    SET retention_class = 'permanent', retention_pinned = 1
    WHERE asset_id = 'pinned-reference'`).run();

  const report = retention.sweep();

  assert.deepEqual(report.markedAssetIds, []);
  assert.deepEqual(report.isolatedAssetIds, []);
  assert.deepEqual(report.deletedAssetIds, []);
  assert.deepEqual(removed, []);
  assert.equal(db.prepare("SELECT retention_state FROM project_assets WHERE asset_id = 'pinned-reference'").get().retention_state, 'active');
  db.close();
});

test('a same-named asset from another owner cannot delay cleanup or delete shared bytes', () => {
  const { db, removed, retention } = createHarness();
  db.prepare(`INSERT INTO projects (id, owner_email, kind, title, status, created_at, updated_at)
    VALUES ('project-other', 'other@example.com', 'video', '', 'completed', '2026-06-01T00:00:00.000Z', '2026-06-01T00:00:00.000Z')`).run();
  insertAsset(db, { id: 'shared-owner-key', retentionState: 'isolated' });
  db.prepare(`INSERT INTO project_assets
    (id, asset_id, owner_email, project_id, role, stable_url, mime_type, content_hash, retention_class, retention_state, created_at)
    VALUES ('link-foreign-shared-owner-key', 'shared-owner-key', 'other@example.com', 'project-other', 'generated',
      '/api/generated-assets/shared-owner-key.png', 'image/png', 'foreign-hash', 'completed', 'active', '2026-07-29T00:00:00.000Z')`).run();

  const report = retention.deleteIsolated();

  assert.deepEqual(report.deletedAssetIds, ['shared-owner-key']);
  assert.deepEqual(removed, []);
  assert.equal(db.prepare("SELECT retention_state FROM project_assets WHERE id = 'link-shared-owner-key'").get().retention_state, 'deleted');
  assert.equal(db.prepare("SELECT retention_state FROM project_assets WHERE id = 'link-foreign-shared-owner-key'").get().retention_state, 'active');
  db.close();
});

test('a disputed hold from another owner cannot protect an expired project asset', () => {
  const { db, removed, retention } = createHarness();
  db.prepare(`INSERT INTO billing_holds
    (id, owner_email, currency, quote_id, status, total_units, settled_units, released_units, idempotency_key, expires_at, metadata)
    VALUES ('foreign-dispute', 'other@example.com', 'ec_points', 'quote-foreign', 'disputed', 1, 0, 0, 'hold-foreign', '2026-08-30T00:00:00.000Z', '{}')`).run();
  db.prepare(`INSERT INTO billing_hold_items
    (id, hold_id, item_key, sku, units, status, reference_id)
    VALUES ('foreign-dispute-item', 'foreign-dispute', 'item', 'ec_image_2k', 1, 'settled', 'billing-dispute')`).run();
  insertAsset(db, { id: 'billing-dispute', retentionState: 'marked' });

  const report = retention.isolateMarked();

  assert.deepEqual(report.protectedAssetIds, []);
  assert.deepEqual(report.isolatedAssetIds, ['billing-dispute']);
  assert.deepEqual(removed, []);
  db.close();
});
