import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import Database from 'better-sqlite3';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ensureProjectSchema } from '../server/projects/schema.mjs';
import { createProjectStore } from '../server/projects/projectStore.mjs';
import { publicVideoProducts } from '../server/videoCatalog.mjs';
import { createVideoGeneration } from '../server/videoGeneration.mjs';
import { createVideoProjectBridge } from '../server/videoProjectBridge.mjs';

test('project bridge audit reports a missing video_assets schema as structured JSON', t => {
  const root = mkdtempSync(join(tmpdir(), 'video-project-audit-'));
  const database = join(root, 'works.db');
  const db = new Database(database);
  db.close();
  t.after(() => rmSync(root, { recursive: true, force: true }));

  const result = spawnSync(process.execPath, [
    join(process.cwd(), 'scripts', 'audit-video-project-bridge.mjs'),
    `--db=${database}`,
  ], { cwd: process.cwd(), encoding: 'utf8' });

  assert.equal(result.status, 1);
  const report = JSON.parse(result.stderr);
  assert.equal(report.ok, false);
  assert.equal(report.mode, 'dry-run');
  assert.equal(report.database, database);
  assert.deepEqual(report.blockingIssues, [{
    code: 'VIDEO_ASSETS_TABLE_MISSING',
    message: 'video_assets table is required',
  }]);
  assert.doesNotMatch(result.stderr, /TypeError|\bat\s+file:/);
});

function createHarness() {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  ensureProjectSchema(db);
  db.exec(`
    CREATE TABLE video_assets (
      id TEXT PRIMARY KEY,
      owner_email TEXT NOT NULL,
      kind TEXT NOT NULL,
      content_type TEXT NOT NULL,
      bytes INTEGER NOT NULL,
      sha256 TEXT NOT NULL DEFAULT '',
      file_name TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);
  const now = () => new Date('2026-08-15T06:00:00.000Z');
  const store = createProjectStore(db, { now });
  const bridge = createVideoProjectBridge({ db, projectStore: store, now });
  return { db, bridge };
}

function seedAsset(db, { id, kind, contentType, sha256 }) {
  db.prepare(`INSERT INTO video_assets
    (id, owner_email, kind, content_type, bytes, sha256, file_name, created_at)
    VALUES (?, 'owner@example.com', ?, ?, 128, ?, ?, '2026-08-15T05:00:00.000Z')`)
    .run(id, kind, contentType, sha256, id);
}

function draftJob() {
  return {
    id: 'video-job-1',
    owner_email: 'owner@example.com',
    prompt: '让商品在清晨城市中形成有节奏的短片',
    negative_prompt: '不要水印',
    mode: 'reference',
    product_id: 'seedance_standard',
    provider_route: 'sd5-seedance-2.0',
    catalog_version: 'video-products-v2',
    duration: 8,
    aspect_ratio: '9:16',
    resolution: '720p',
    generate_audio: 1,
    seed: 42,
    quote_id: 'quote-1',
    hold_id: 'hold-1',
    refs_json: JSON.stringify({
      firstImage: 'first.png',
      lastImage: '',
      images: ['reference.png'],
      videos: ['motion.mp4'],
      audios: [],
      urls: { ignored: 'signed-capability-must-not-be-persisted' },
    }),
  };
}

test('video draft creates one transparent project and immutable source version on replay', t => {
  const { db, bridge } = createHarness();
  t.after(() => db.close());
  seedAsset(db, { id: 'first.png', kind: 'image', contentType: 'image/png', sha256: 'hash-first' });
  seedAsset(db, { id: 'reference.png', kind: 'image', contentType: 'image/png', sha256: 'hash-reference' });
  seedAsset(db, { id: 'motion.mp4', kind: 'video', contentType: 'video/mp4', sha256: 'hash-motion' });

  const first = bridge.ensureDraft(draftJob());
  const replay = bridge.ensureDraft(draftJob());

  assert.equal(replay.project.id, first.project.id);
  assert.equal(replay.sourceVersion.id, first.sourceVersion.id);
  assert.equal(first.project.kind, 'video');
  assert.equal(first.run.id, 'video-job-1');
  assert.equal(first.sourceVersion.inputSnapshot.prompt, draftJob().prompt);
  assert.equal(first.sourceVersion.planSnapshot.model.productId, 'seedance_standard');
  assert.equal(first.sourceVersion.inputSnapshot.references[0].role, 'first_frame');
  assert.equal(first.sourceVersion.inputSnapshot.references[0].stableUrl, '/api/video/assets/first.png');
  assert.equal('urls' in first.sourceVersion.inputSnapshot, false);
  assert.equal(db.prepare('SELECT COUNT(*) AS value FROM projects').get().value, 1);
  assert.equal(db.prepare('SELECT COUNT(*) AS value FROM project_versions').get().value, 1);
  assert.equal(db.prepare('SELECT COUNT(*) AS value FROM project_assets').get().value, 3);
  assert.equal(db.prepare('SELECT COUNT(*) AS value FROM video_assets').get().value, 3);
});

test('verified video delivery appends one result version and complete source-to-output lineage', t => {
  const { db, bridge } = createHarness();
  t.after(() => db.close());
  seedAsset(db, { id: 'first.png', kind: 'image', contentType: 'image/png', sha256: 'hash-first' });
  seedAsset(db, { id: 'reference.png', kind: 'image', contentType: 'image/png', sha256: 'hash-reference' });
  seedAsset(db, { id: 'motion.mp4', kind: 'video', contentType: 'video/mp4', sha256: 'hash-motion' });
  seedAsset(db, { id: 'result.mp4', kind: 'output', contentType: 'video/mp4', sha256: 'hash-result' });
  const job = { ...draftJob(), result_asset_id: 'result.mp4', current_attempt_id: 'attempt-1', provider_task_id: 'provider-1' };
  const source = bridge.ensureDraft(job);

  const completed = bridge.projectDelivery(job);
  const replay = bridge.projectDelivery(job);

  assert.equal(completed.resultVersion.id, replay.resultVersion.id);
  assert.equal(completed.resultVersion.parentVersionId, source.sourceVersion.id);
  assert.equal(completed.project.status, 'completed');
  assert.equal(completed.resultVersion.inputSnapshot.delivery.assetId, 'result.mp4');
  assert.equal(completed.resultVersion.planSnapshot.attempt.id, 'attempt-1');
  assert.equal(db.prepare('SELECT COUNT(*) AS value FROM project_versions').get().value, 2);
  assert.equal(db.prepare("SELECT COUNT(*) AS value FROM project_assets WHERE role = 'generated_video'").get().value, 1);
  assert.equal(db.prepare('SELECT COUNT(*) AS value FROM project_asset_lineage').get().value, 3);
  assert.equal(db.prepare('SELECT COUNT(*) AS value FROM video_assets').get().value, 4);
});

test('legacy audit reports orphaned ownership, missing checksums, and unsupported asset rows without mutating them', t => {
  const { db, bridge } = createHarness();
  t.after(() => db.close());
  seedAsset(db, { id: 'valid.png', kind: 'image', contentType: 'image/png', sha256: 'same-hash' });
  seedAsset(db, { id: 'duplicate.png', kind: 'image', contentType: 'image/png', sha256: 'same-hash' });
  db.prepare(`INSERT INTO video_assets
    (id, owner_email, kind, content_type, bytes, sha256, file_name, created_at)
    VALUES ('broken.bin', '', 'binary', 'application/octet-stream', 1, '', 'broken.bin', '2026-08-15T05:00:00.000Z')`).run();
  db.exec('CREATE TABLE video_jobs (refs_json TEXT NOT NULL, result_asset_id TEXT NOT NULL)');
  db.prepare('INSERT INTO video_jobs (refs_json, result_asset_id) VALUES (?, ?)')
    .run(JSON.stringify({ images: ['valid.png', 'missing.png'] }), 'missing-result.mp4');

  const report = bridge.auditLegacyAssets();

  assert.equal(report.mode, 'dry-run');
  assert.equal(report.total, 3);
  assert.equal(report.referencedAssets, 1);
  assert.equal(report.unreferencedAssets, 2);
  assert.equal(report.missingAssetReferences, 2);
  assert.equal(report.missingOwners, 1);
  assert.equal(report.missingChecksums, 1);
  assert.equal(report.unsupportedRows, 1);
  assert.equal(report.duplicateChecksums, 1);
  assert.deepEqual(report.samples.missingReferenceIds, ['missing.png', 'missing-result.mp4']);
  assert.equal(db.prepare('SELECT COUNT(*) AS value FROM video_assets').get().value, 3);
});

test('completed video jobs converge through billing, project lineage, works projection, and finalization', async t => {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  ensureProjectSchema(db);
  const assetRoot = mkdtempSync(join(tmpdir(), 'video-project-integration-'));
  const now = () => new Date('2026-08-15T07:00:00.000Z');
  const projectStore = createProjectStore(db, { now });
  let settlementCalls = 0;
  let projectedWorks = 0;
  const registry = {
    get: () => ({
      enabled: true,
      productId: 'seedance_standard',
      routeId: 'sd5-seedance-2.0',
      submit: async () => ({ id: 'provider-project-task', progress: 0 }),
      get: async () => ({ status: 'completed', progress: 100 }),
      download: async () => new Response(Buffer.from('project-video'), {
        headers: { 'content-type': 'video/mp4', 'content-length': '13' },
      }),
    }),
    publicProducts: () => publicVideoProducts(),
  };
  const bridge = createVideoProjectBridge({ db, projectStore, now });
  const service = createVideoGeneration({
    db,
    assetRoot,
    providerRegistry: registry,
    projectBridge: bridge,
    walletService: {
      createHold: input => ({ id: `hold-${input.metadata.taskId}` }),
      getBalance: () => ({ unlimited: false, availableUnits: 999999 }),
      settleItem: () => { settlementCalls += 1; return { status: 'settled' }; },
      releaseItem: () => ({ status: 'released' }),
    },
    quoteService: { verify: ({ quoteId, expectedQuote }) => ({
      quoteId,
      currency: expectedQuote.currency,
      expiresAt: '2099-01-01T00:00:00.000Z',
    }) },
    upsertWork: () => { projectedWorks += 1; },
    pollIntervalMs: 1,
    maxConcurrent: 1,
  });
  t.after(() => {
    service.close();
    db.close();
    rmSync(assetRoot, { recursive: true, force: true });
  });

  const source = await service.uploadAsset({
    ownerEmail: 'owner@example.com',
    kind: 'image',
    contentType: 'image/png',
    buffer: Buffer.from('source-image'),
    publicBaseUrl: 'https://example.com',
  });
  const created = await service.createJob({
    ownerEmail: 'owner@example.com',
    idempotencyKey: 'project-bridge-integration',
    billingQuoteId: 'project-bridge-quote',
    publicBaseUrl: 'https://example.com',
    input: {
      productId: 'seedance_standard',
      mode: 'reference',
      prompt: '把商品素材转成节奏清晰的竖屏广告短片',
      duration: 5,
      aspectRatio: '9:16',
      resolution: '720p',
      references: { firstImage: source.id, images: [source.id] },
    },
  });

  const deadline = Date.now() + 2_000;
  let completed;
  while (Date.now() < deadline) {
    completed = service.getJob('owner@example.com', created.job.id);
    if (completed?.status === 'completed') break;
    await new Promise(resolve => setTimeout(resolve, 2));
  }

  assert.equal(completed?.status, 'completed');
  assert.equal(completed.billingState, 'settled');
  assert.equal(completed.deliveryState, 'verified');
  assert.equal(completed.projectProjectionState, 'projected');
  assert.equal(completed.projectionState, 'projected');
  assert.ok(completed.projectId);
  assert.ok(completed.sourceVersionId);
  assert.ok(completed.resultVersionId);
  assert.equal(settlementCalls, 1);
  assert.equal(projectedWorks, 1);
  assert.equal(db.prepare('SELECT COUNT(*) AS value FROM projects').get().value, 1);
  assert.equal(db.prepare('SELECT COUNT(*) AS value FROM project_versions').get().value, 2);
  assert.equal(db.prepare('SELECT COUNT(*) AS value FROM project_assets').get().value, 2);
  assert.equal(db.prepare('SELECT COUNT(*) AS value FROM project_asset_lineage').get().value, 1);
  assert.deepEqual(
    db.prepare('SELECT event_type, state FROM video_outbox WHERE aggregate_id = ? ORDER BY created_at, event_type')
      .all(created.job.id).map(row => [row.event_type, row.state]),
    [
      ['video.billing.settle.requested', 'done'],
      ['video.job.finalize.requested', 'done'],
      ['video.project.project.requested', 'done'],
      ['video.works.project.requested', 'done'],
    ],
  );
});
