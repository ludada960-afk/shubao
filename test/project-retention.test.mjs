import assert from 'node:assert/strict';
import test from 'node:test';
import Database from 'better-sqlite3';

import { ensureBillingSchema } from '../server/billing/schema.mjs';
import { ensureProjectSchema } from '../server/projects/schema.mjs';
import { createRetentionService } from '../server/projects/retentionService.mjs';

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
