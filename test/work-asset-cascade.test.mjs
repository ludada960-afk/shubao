import assert from 'node:assert/strict';
import test from 'node:test';

import { initDB, upsertWork, softDeleteWork, getAllWorks } from '../server/db.mjs';
import { createRetentionService } from '../server/projects/retentionService.mjs';
import {
  createWorkAssetCascade,
  registerWorkDeleteCascade,
  getRegisteredWorkDeleteCascade,
  isWorkAssetCascadeEnabled,
} from '../server/workAssetCascade.mjs';

const NOW = () => new Date('2026-09-01T00:00:00.000Z');
const CREATED = '2026-08-01T00:00:00.000Z';

const db = initDB(':memory:');
const removed = [];
const retention = createRetentionService({ db, assetStore: { remove: assetId => { removed.push(assetId); } }, now: NOW });
registerWorkDeleteCascade(createWorkAssetCascade({ db, retention }));

function insertProject(id, owner) {
  db.prepare(`INSERT INTO projects (id, owner_email, kind, title, status, created_at, updated_at)
    VALUES (?, ?, 'ecommerce', '', 'completed', ?, ?)`).run(id, owner, CREATED, CREATED);
}

function insertAsset({ id, projectId, owner, stableUrl, contentHash = id, retentionClass = 'unfinished', retentionPinned = 0 }) {
  db.prepare(`INSERT INTO project_assets
    (id, asset_id, owner_email, project_id, role, stable_url, mime_type, content_hash, retention_class, retention_state, retention_pinned, created_at)
    VALUES (?, ?, ?, ?, 'generated', ?, 'image/png', ?, ?, 'active', ?, ?)`)
    .run(id, `bin-${id}`, owner, projectId, stableUrl, contentHash, retentionClass, retentionPinned, CREATED);
}

function assetRow(id) {
  return db.prepare('SELECT * FROM project_assets WHERE id = ?').get(id);
}

let workSeq = 0;
function saveWork({ owner, imageUrls = [], coverUrl = '', projectAssetRefs = [] }) {
  workSeq += 1;
  const work = {
    _saveKey: `cascade-work-${workSeq}`,
    title: `cascade-${workSeq}`,
    cover_url: coverUrl,
    image_urls: imageUrls,
    ...(projectAssetRefs.length ? { projectAssetRefs } : {}),
  };
  upsertWork(work, { ownerEmail: owner });
  return work;
}

test('WORK_ASSET_CASCADE defaults to enabled and registers an explicit hook', () => {
  assert.equal(isWorkAssetCascadeEnabled(), true);
  assert.equal(typeof getRegisteredWorkDeleteCascade(), 'function');
});

test('deleting one of two works sharing a stable URL leaves the asset untouched', () => {
  const owner = 'share-cascade@example.com';
  insertProject('p-share-cascade', owner);
  insertAsset({ id: 'pa-shared-url', projectId: 'p-share-cascade', owner, stableUrl: '/api/generated-assets/shared-url.png' });
  const url = '/api/generated-assets/shared-url.png';
  const first = saveWork({ owner, imageUrls: [url] });
  const second = saveWork({ owner, imageUrls: [url] });

  assert.equal(softDeleteWork(first._saveKey, { ownerEmail: owner }), true);

  const row = assetRow('pa-shared-url');
  assert.equal(row.retention_class, 'unfinished');
  assert.equal(row.retention_state, 'active');
  assert.equal(row.expires_at, null);
  assert.ok(row.deleted_at === null || row.deleted_at === undefined);

  assert.equal(softDeleteWork(second._saveKey, { ownerEmail: owner }), true);
  const recycled = assetRow('pa-shared-url');
  assert.equal(recycled.retention_class, 'completed');
  assert.equal(recycled.retention_state, 'active');
  assert.deepEqual(removed, []);
});

test('storyboard first/last frame and video version references keep their canonical assets', () => {
  const owner = 'video-cascade@example.com';
  insertProject('p-video-cascade', owner);
  db.exec(`CREATE TABLE video_storyboard_shots (
    id TEXT PRIMARY KEY,
    owner_email TEXT NOT NULL,
    project_id TEXT NOT NULL,
    first_frame_ref TEXT NOT NULL DEFAULT '',
    last_frame_ref TEXT NOT NULL DEFAULT ''
  )`);
  db.exec(`CREATE TABLE video_workbench_asset_versions (
    id TEXT PRIMARY KEY,
    owner_email TEXT NOT NULL,
    project_id TEXT NOT NULL,
    source_project_asset_id TEXT
  )`);
  insertAsset({ id: 'pa-frame-first', projectId: 'p-video-cascade', owner, stableUrl: '/api/generated-assets/frame-first.png' });
  insertAsset({ id: 'pa-version-source', projectId: 'p-video-cascade', owner, stableUrl: '/api/generated-assets/version-source.png' });
  insertAsset({ id: 'pa-unprotected', projectId: 'p-video-cascade', owner, stableUrl: '/api/generated-assets/unprotected.png' });
  db.prepare(`INSERT INTO video_storyboard_shots (id, owner_email, project_id, first_frame_ref, last_frame_ref)
    VALUES (?, ?, ?, ?, '')`).run(
    'shot-1', owner, 'p-video-cascade',
    JSON.stringify({ projectId: 'p-video-cascade', projectAssetId: 'pa-frame-first', stableUrl: '/api/generated-assets/frame-first.png' }),
  );
  db.prepare(`INSERT INTO video_workbench_asset_versions (id, owner_email, project_id, source_project_asset_id)
    VALUES ('version-1', ?, ?, 'pa-version-source')`).run(owner, 'p-video-cascade');

  const work = saveWork({
    owner,
    imageUrls: ['/api/generated-assets/frame-first.png', '/api/generated-assets/version-source.png', '/api/generated-assets/unprotected.png'],
  });

  assert.equal(softDeleteWork(work._saveKey, { ownerEmail: owner }), true);
  assert.equal(assetRow('pa-frame-first').retention_class, 'unfinished');
  assert.equal(assetRow('pa-version-source').retention_class, 'unfinished');
  assert.equal(assetRow('pa-unprotected').retention_class, 'completed');
  assert.deepEqual(removed, []);
});

test('a disputed billing hold blocks the cascade downgrade', () => {
  const owner = 'dispute-cascade@example.com';
  insertProject('p-dispute-cascade', owner);
  insertAsset({ id: 'pa-disputed', projectId: 'p-dispute-cascade', owner, stableUrl: '/api/generated-assets/disputed.png' });
  db.prepare(`INSERT INTO billing_holds
    (id, owner_email, currency, quote_id, status, total_units, idempotency_key, expires_at, metadata)
    VALUES ('hold-cascade', ?, 'ecommerce_points', 'quote-cascade', 'disputed', 1, 'hold-key-cascade', '2026-09-30T00:00:00.000Z', '{}')`).run(owner);
  db.prepare(`INSERT INTO billing_hold_items (id, hold_id, item_key, sku, units, status, reference_id)
    VALUES ('hold-item-cascade', 'hold-cascade', 'disputed-bin', 'ec_image_2k', 1, 'settled', 'bin-pa-disputed')`).run();

  const work = saveWork({ owner, imageUrls: ['/api/generated-assets/disputed.png'] });
  assert.equal(softDeleteWork(work._saveKey, { ownerEmail: owner }), true);

  assert.equal(assetRow('pa-disputed').retention_class, 'unfinished');
  assert.equal(assetRow('pa-disputed').retention_state, 'active');
  assert.deepEqual(removed, []);
});

test('losing the last live work reference downgrades assets exactly to the completed tier', () => {
  const owner = 'tier-cascade@example.com';
  insertProject('p-tier-cascade', owner);
  insertAsset({ id: 'pa-was-unfinished', projectId: 'p-tier-cascade', owner, stableUrl: '/api/generated-assets/was-unfinished.png', retentionClass: 'unfinished' });
  insertAsset({ id: 'pa-already-completed', projectId: 'p-tier-cascade', owner, stableUrl: '/api/generated-assets/already-completed.png', retentionClass: 'completed' });
  insertAsset({ id: 'pa-was-temporary', projectId: 'p-tier-cascade', owner, stableUrl: '/api/generated-assets/was-temporary.png', retentionClass: 'temporary' });
  insertAsset({ id: 'pa-user-pinned', projectId: 'p-tier-cascade', owner, stableUrl: '/api/generated-assets/user-pinned.png', retentionClass: 'permanent', retentionPinned: 1 });

  const work = saveWork({
    owner,
    coverUrl: '/api/generated-assets/was-unfinished.png',
    imageUrls: [
      '/api/generated-assets/already-completed.png',
      '/api/generated-assets/was-temporary.png',
      '/api/generated-assets/user-pinned.png',
    ],
    projectAssetRefs: [{
      projectId: 'p-tier-cascade',
      projectAssetId: 'pa-was-unfinished',
      contentHash: 'pa-was-unfinished',
    }],
  });

  assert.equal(softDeleteWork(work._saveKey, { ownerEmail: owner }), true);

  for (const id of ['pa-was-unfinished', 'pa-already-completed', 'pa-was-temporary']) {
    const row = assetRow(id);
    assert.equal(row.retention_class, 'completed', `${id} must land on completed`);
    assert.notEqual(row.retention_class, 'unfinished');
    assert.equal(row.expires_at, null);
    assert.equal(row.retention_state, 'active');
    assert.equal(row.marked_at, null);
    assert.equal(row.isolated_at, null);
  }
  const pinned = assetRow('pa-user-pinned');
  assert.equal(pinned.retention_class, 'permanent');
  assert.equal(Number(pinned.retention_pinned), 1);
  assert.deepEqual(removed, []);
});

test('WORK_ASSET_CASCADE=off reproduces the legacy delete behavior byte for byte', () => {
  const owner = 'flagoff-cascade@example.com';
  insertProject('p-flagoff-cascade', owner);
  insertAsset({ id: 'pa-flagoff', projectId: 'p-flagoff-cascade', owner, stableUrl: '/api/generated-assets/flagoff.png' });
  const previous = process.env.WORK_ASSET_CASCADE;
  process.env.WORK_ASSET_CASCADE = 'off';
  try {
    const work = saveWork({ owner, imageUrls: ['/api/generated-assets/flagoff.png'] });
    assert.equal(isWorkAssetCascadeEnabled(), false);
    assert.equal(softDeleteWork(work._saveKey, { ownerEmail: owner }), true);

    const row = assetRow('pa-flagoff');
    assert.equal(row.retention_class, 'unfinished');
    assert.equal(row.retention_state, 'active');
    assert.equal(row.expires_at, null);
    assert.deepEqual(removed, []);
    const trashed = getAllWorks({ includeDeleted: true, ownerEmail: owner })
      .find(item => item._saveKey === work._saveKey);
    assert.ok(trashed, 'deleted work remains listed for trash');
  } finally {
    if (previous === undefined) delete process.env.WORK_ASSET_CASCADE;
    else process.env.WORK_ASSET_CASCADE = previous;
  }
});

test('a failing cascade rolls the whole delete back inside one transaction', () => {
  const owner = 'atomic-cascade@example.com';
  insertProject('p-atomic-cascade', owner);
  insertAsset({ id: 'pa-atomic', projectId: 'p-atomic-cascade', owner, stableUrl: '/api/generated-assets/atomic.png' });
  const work = saveWork({ owner, imageUrls: ['/api/generated-assets/atomic.png'] });

  const originalHook = getRegisteredWorkDeleteCascade();
  registerWorkDeleteCascade(() => { throw new Error('cascade boom'); });
  try {
    assert.throws(() => softDeleteWork(work._saveKey, { ownerEmail: owner }), /cascade boom/);
    const stillLive = getAllWorks({ ownerEmail: owner }).find(item => item._saveKey === work._saveKey);
    assert.ok(stillLive, 'work must survive a failed cascade');
    assert.equal(assetRow('pa-atomic').retention_class, 'unfinished');
  } finally {
    registerWorkDeleteCascade(originalHook);
  }
});
