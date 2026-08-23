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
    assetStore: { remove: assetId => removed.push(assetId) },
    now: () => new Date('2026-07-30T12:00:00.000Z'),
  });
  return { db, removed, retention };
}

function insertAsset(db) {
  db.prepare(`INSERT INTO project_assets
    (id, asset_id, owner_email, project_id, role, content_hash, stable_url, mime_type,
     retention_class, retention_state, marked_at, created_at)
    VALUES ('asset-1', 'asset-1', 'owner@example.com', 'project-1', 'product', 'hash-1',
      '/api/uploads/asset-1.png', 'image/png', 'completed', 'marked',
      '2026-07-28T12:00:00.000Z', '2026-06-01T00:00:00.000Z')`).run();
}

function insertProfileReference(db, status = 'active') {
  db.prepare(`INSERT INTO product_profiles
    (id, owner_email, name, category, facts_json, status, created_at, updated_at)
    VALUES ('profile-1', 'owner@example.com', '商品', '', '{}', ?, '2026-07-01T00:00:00.000Z', '2026-07-01T00:00:00.000Z')`).run(status);
  db.prepare(`INSERT INTO product_profile_assets
    (profile_id, owner_email, project_id, project_asset_id, role, expected_content_hash, created_at)
    VALUES ('profile-1', 'owner@example.com', 'project-1', 'asset-1', 'product', 'hash-1', '2026-07-01T00:00:00.000Z')`).run();
}

test('active product profile references protect canonical assets from cleanup', () => {
  const { db, removed, retention } = createHarness();
  insertAsset(db);
  insertProfileReference(db);

  const protectedReport = retention.isolateMarked();
  assert.deepEqual(protectedReport.protectedAssetIds, ['asset-1']);
  assert.equal(db.prepare("SELECT retention_state FROM project_assets WHERE id = 'asset-1'").get().retention_state, 'marked');

  db.prepare("UPDATE product_profiles SET status = 'archived' WHERE id = 'profile-1'").run();
  const releasedReport = retention.isolateMarked();
  assert.deepEqual(releasedReport.isolatedAssetIds, ['asset-1']);
  assert.deepEqual(removed, []);
  db.close();
});
