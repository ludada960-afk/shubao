import assert from 'node:assert/strict';
import test from 'node:test';
import Database from 'better-sqlite3';

import { ensureProjectSchema } from '../server/projects/schema.mjs';
import { createProjectStore } from '../server/projects/projectStore.mjs';
import { migrateLegacyWorkOnRead } from '../server/projects/legacyMigration.mjs';

test('migrates a legacy ecommerce work once without duplicating its stable assets', () => {
  const db = new Database(':memory:');
  ensureProjectSchema(db);
  const store = createProjectStore(db, { randomUUID: (() => { let n = 0; return () => `id-${++n}`; })(), now: () => new Date('2026-07-30T12:00:00.000Z') });
  const work = {
    _saveKey: 'legacy-work-1',
    _ecResult: true,
    product_name: '玻璃水杯',
    images: [{ key: 'main', url: '/api/generated-assets/stable-main.png' }],
  };

  const first = migrateLegacyWorkOnRead({ ownerEmail: 'owner@example.com', work, projectStore: store });
  const replay = migrateLegacyWorkOnRead({ ownerEmail: 'owner@example.com', work, projectStore: store });

  assert.equal(first.project.id, replay.project.id);
  assert.equal(first.version.id, replay.version.id);
  assert.equal(first.project.status, 'completed');
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM projects').get().count, 1);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM project_versions').get().count, 1);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM project_assets').get().count, 1);
  assert.equal(db.prepare('SELECT asset_id FROM project_assets').get().asset_id, 'stable-main.png');
  db.close();
});

test('migrates hashed legacy assets with their authoritative MIME and content hash', () => {
  const db = new Database(':memory:');
  ensureProjectSchema(db);
  const store = createProjectStore(db, { randomUUID: (() => { let n = 0; return () => `id-${++n}`; })(), now: () => new Date('2026-07-30T12:00:00.000Z') });
  const contentHash = 'd'.repeat(64);
  const stableUrl = `/api/generated-assets/${contentHash}.webp`;

  const result = migrateLegacyWorkOnRead({
    ownerEmail: 'owner@example.com',
    projectStore: store,
    work: { _saveKey: 'legacy-webp-work', _ecResult: true, product_name: 'WebP 历史作品', images: [{ url: stableUrl }] },
  });

  const asset = db.prepare('SELECT content_hash, mime_type, stable_url FROM project_assets WHERE project_id = ?').get(result.project.id);
  assert.deepEqual(asset, { content_hash: contentHash, mime_type: 'image/webp', stable_url: stableUrl });
  db.close();
});

test('does not create a duplicate migration project for a Work already linked to a project', () => {
  const db = new Database(':memory:');
  ensureProjectSchema(db);
  const store = createProjectStore(db, { randomUUID: () => 'unused', now: () => new Date('2026-07-30T12:00:00.000Z') });

  const result = migrateLegacyWorkOnRead({
    ownerEmail: 'owner@example.com',
    projectStore: store,
    work: { _saveKey: 'ec-task-current', _ecResult: true, projectId: 'project-current', images: [] },
  });

  assert.equal(result, null);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM projects').get().count, 0);
  db.close();
});
