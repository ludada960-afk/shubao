import assert from 'node:assert/strict';
import Database from 'better-sqlite3';

import { ensureBillingSchema } from '../server/billing/schema.mjs';
import { ensureProjectSchema } from '../server/projects/schema.mjs';
import { createProjectStore } from '../server/projects/projectStore.mjs';
import { createVideoWorkbenchStore } from '../server/videoWorkbenchStore.mjs';

const OWNER = '867550189@qq.com';
const REQUIRED_PROJECTS = 10;

function tableCount(db, table) {
  const exists = db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(table);
  return exists ? Number(db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get().count || 0) : 0;
}

export function runVideoWorkbenchPilotVerification() {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  let sequence = 0;
  const now = () => new Date('2026-08-16T08:00:00.000Z');
  const randomUUID = () => `pilot-${++sequence}`;
  try {
    ensureProjectSchema(db);
    ensureBillingSchema(db);
    db.exec(`
      CREATE TABLE video_assets (
        id TEXT PRIMARY KEY, owner_email TEXT NOT NULL, kind TEXT NOT NULL,
        content_type TEXT NOT NULL, bytes INTEGER NOT NULL, sha256 TEXT NOT NULL,
        file_name TEXT NOT NULL
      );
      CREATE TABLE video_jobs (
        id TEXT PRIMARY KEY, owner_email TEXT NOT NULL, status TEXT NOT NULL,
        project_id TEXT NOT NULL DEFAULT '', result_asset_id TEXT NOT NULL DEFAULT ''
      );
    `);
    const projectStore = createProjectStore(db, { now, randomUUID });
    const store = createVideoWorkbenchStore({ db, projectStore, now, randomUUID });
    const before = {
      wallets: tableCount(db, 'wallet_ledger'),
      usage: tableCount(db, 'usage_events'),
      holds: tableCount(db, 'billing_holds'),
      jobs: tableCount(db, 'video_jobs'),
    };

    for (let index = 0; index < REQUIRED_PROJECTS; index += 1) {
      const suffix = index + 1;
      const project = projectStore.createProject({ ownerEmail: OWNER, kind: 'video', title: `P1 验收项目 ${suffix}` });
      const sourceId = `pilot-source-${suffix}`;
      db.prepare(`INSERT INTO video_assets
        (id, owner_email, kind, content_type, bytes, sha256, file_name)
        VALUES (?, ?, 'image', 'image/png', 2048, ?, ?)`)
        .run(sourceId, OWNER, `pilot-hash-${suffix}`, `pilot-${suffix}.png`);
      const asset = store.createAsset({ ownerEmail: OWNER, projectId: project.id, kind: 'product', name: `验收素材 ${suffix}` });
      const version = store.addAssetVersionFromVideoAsset({
        ownerEmail: OWNER, projectId: project.id, assetId: asset.id, videoAssetId: sourceId,
        metadata: { acceptance: 'non-billing-pilot', sequence: suffix },
      });
      store.approveAssetVersion({ ownerEmail: OWNER, projectId: project.id, assetId: asset.id,
        versionId: version.id, expectedRevision: 1 });
      const shot = store.createShot({ ownerEmail: OWNER, projectId: project.id, position: 0,
        purpose: '验收镜头', durationMs: 3000, cameraLanguage: '静态中景', prompt: '非计费验收' });
      store.bindShotAssetVersion({ ownerEmail: OWNER, projectId: project.id, shotId: shot.id,
        assetId: asset.id, assetVersionId: version.id, role: 'product' });
      for (const action of ['asset.create', 'asset.approve', 'shot.create', 'shot.bind']) {
        store.recordOperation({ ownerEmail: OWNER, projectId: project.id, action,
          outcome: 'success', latencyMs: 12 });
      }
    }

    const metrics = store.operationalMetrics();
    assert.equal(metrics.funnel.projectsStarted, REQUIRED_PROJECTS);
    assert.equal(metrics.funnel.approvedAssetProjects, REQUIRED_PROJECTS);
    assert.equal(metrics.funnel.storyboardReadyProjects, REQUIRED_PROJECTS);
    assert.equal(metrics.funnel.candidateReadyProjects, 0);
    assert.equal(metrics.funnel.timelineReadyProjects, 0);
    assert.equal(metrics.health.staleShots, 0);
    assert.equal(metrics.health.staleClips, 0);
    assert.equal(metrics.operations24h.failed, 0);
    assert.equal(metrics.operations24h.total, REQUIRED_PROJECTS * 4);
    assert.equal(metrics.gate.ready, true);

    const after = {
      wallets: tableCount(db, 'wallet_ledger'),
      usage: tableCount(db, 'usage_events'),
      holds: tableCount(db, 'billing_holds'),
      jobs: tableCount(db, 'video_jobs'),
    };
    assert.deepEqual(after, before);
    return { ownerEmail: OWNER, projects: REQUIRED_PROJECTS, metrics, before, after, billingMutated: false };
  } finally {
    db.close();
  }
}

if (process.argv[1]?.endsWith('verify-video-workbench-pilot.mjs')) {
  const report = runVideoWorkbenchPilotVerification();
  console.log(JSON.stringify({
    ok: true,
    ownerEmail: report.ownerEmail,
    projects: report.projects,
    funnel: report.metrics.funnel,
    operations24h: report.metrics.operations24h,
    gate: report.metrics.gate,
    billingMutated: report.billingMutated,
  }, null, 2));
}
