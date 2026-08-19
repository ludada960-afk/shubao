import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';

import { ensureProjectSchema } from '../server/projects/schema.mjs';
import { createProjectStore } from '../server/projects/projectStore.mjs';
import { createVideoWorkbenchStore } from '../server/videoWorkbenchStore.mjs';

const OWNER = 'video-stage1-acceptance@example.com';
const FIXED_NOW = new Date('2026-08-19T08:00:00.000Z');

function createHarness(db, randomUUID) {
  db.pragma('foreign_keys = ON');
  ensureProjectSchema(db);
  const now = () => FIXED_NOW;
  const projectStore = createProjectStore(db, { now, randomUUID });
  const store = createVideoWorkbenchStore({ db, projectStore, now, randomUUID });
  return { projectStore, store };
}

function seedWorkbench(store, projectId) {
  const shots = [];
  const candidates = [];
  for (let position = 0; position < 3; position += 1) {
    const shot = store.createShot({
      ownerEmail: OWNER,
      projectId,
      position,
      purpose: `Stage 1 镜头 ${position + 1}`,
      durationMs: 3000,
      cameraLanguage: '稳定中景',
      prompt: `本地验收镜头 ${position + 1}`,
    });
    shots.push(shot);
    const shotCandidates = [0, 1].map(variant => store.registerCandidate({
      ownerEmail: OWNER,
      projectId,
      shotId: shot.id,
      outputAssetId: `stage1-output-${position + 1}-${variant + 1}`,
      stableUrl: `/api/video/assets/stage1-output-${position + 1}-${variant + 1}`,
      contentHash: `stage1-hash-${position + 1}-${variant + 1}`,
      mimeType: 'video/mp4',
      provenance: { status: 'planned', source: 'local-stage1-acceptance' },
    }));
    candidates.push(...shotCandidates);
    const selected = store.selectCandidate({
      ownerEmail: OWNER,
      projectId,
      shotId: shot.id,
      candidateId: shotCandidates[0].id,
      expectedRevision: shot.revision,
    });
    assert.equal(selected.candidate.id, shotCandidates[0].id);
  }

  const clips = shots.map((shot, position) => {
    const selected = candidates.find(candidate => candidate.shotId === shot.id && candidate.outputAssetId.endsWith('-1'));
    return store.addTimelineClip({
      ownerEmail: OWNER,
      projectId,
      shotId: shot.id,
      candidateId: selected.id,
      position,
      trimStartMs: 0,
      trimEndMs: 3000,
    });
  });
  assert.equal(clips.length, 3);
  assert.equal(new Set(clips.map(clip => clip.id)).size, 3);
  return { shots, candidates, clips };
}

function assertNoPaidTables(db) {
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map(row => row.name);
  assert.equal(tables.includes('wallet_ledger'), false);
  assert.equal(tables.includes('usage_events'), false);
  assert.equal(tables.includes('billing_holds'), false);
  assert.equal(tables.includes('video_jobs'), false);
}

export function runVideoWorkbenchStage1Verification() {
  const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'shubao-video-stage1-'));
  const databasePath = path.join(tempDirectory, 'stage1.sqlite');
  let sequence = 0;
  const randomUUID = () => `stage1-${++sequence}`;
  let db;
  try {
    db = new Database(databasePath);
    const firstHarness = createHarness(db, randomUUID);
    const project = firstHarness.projectStore.createProject({ ownerEmail: OWNER, kind: 'video', title: 'Stage 1 本地闭环' });
    const seeded = seedWorkbench(firstHarness.store, project.id, randomUUID);
    assert.equal(firstHarness.store.listWorkbench({ ownerEmail: OWNER, projectId: project.id }).timelineClips.length, 3);

    const initialManifest = firstHarness.store.createExportManifest({
      ownerEmail: OWNER,
      projectId: project.id,
      options: { format: 'mp4', resolution: '720p', fps: 30, includeAudio: false },
    });
    const initialJob = firstHarness.store.createExportJob({
      ownerEmail: OWNER,
      projectId: project.id,
      manifestId: initialManifest.id,
    });
    assert.equal(initialJob.state, 'waiting_renderer');
    assert.equal(initialJob.providerSubmission, false);
    assert.equal(initialJob.billingMutation, false);
    assert.equal(initialJob.preflightHash, '');
    assertNoPaidTables(db);
    db.close();
    db = null;

    db = new Database(databasePath);
    const restartedHarness = createHarness(db, randomUUID);
    const recovered = restartedHarness.store.listWorkbench({ ownerEmail: OWNER, projectId: project.id });
    assert.equal(recovered.project.id, project.id);
    assert.deepEqual(recovered.shots.map(shot => shot.id), seeded.shots.map(shot => shot.id));
    assert.deepEqual(recovered.timelineClips.map(clip => clip.id), seeded.clips.map(clip => clip.id));
    assert.deepEqual(recovered.timelineClips.map(clip => clip.candidateId), seeded.clips.map(clip => clip.candidateId));

    const middleShot = recovered.shots.find(shot => shot.position === 1);
    const middleClip = recovered.timelineClips.find(clip => clip.shotId === middleShot.id);
    const recoveredCandidates = recovered.shots.flatMap(shot => shot.candidates || []);
    const replacementCandidate = recoveredCandidates
      .find(candidate => candidate.shotId === middleShot.id && candidate.id !== middleClip.candidateId);
    assert.ok(replacementCandidate);
    const selected = restartedHarness.store.selectCandidate({
      ownerEmail: OWNER,
      projectId: project.id,
      shotId: middleShot.id,
      candidateId: replacementCandidate.id,
      expectedRevision: middleShot.revision,
    });
    assert.equal(selected.candidate.status, 'selected');
    const staleMiddleClip = restartedHarness.store.listWorkbench({ ownerEmail: OWNER, projectId: project.id })
      .timelineClips.find(clip => clip.id === middleClip.id);
    assert.equal(staleMiddleClip.status, 'stale');
    const replaced = restartedHarness.store.replaceTimelineClipCandidate({
      ownerEmail: OWNER,
      projectId: project.id,
      clipId: staleMiddleClip.id,
      expectedRevision: staleMiddleClip.revision,
      candidateId: replacementCandidate.id,
    });
    assert.equal(replaced.status, 'active');
    assert.equal(replaced.candidateId, replacementCandidate.id);

    const afterReplacement = restartedHarness.store.listWorkbench({ ownerEmail: OWNER, projectId: project.id });
    assert.equal(afterReplacement.timelineClips.length, 3);
    assert.equal(afterReplacement.timelineClips.filter(clip => clip.status !== 'active').length, 0);
    assert.deepEqual(
      afterReplacement.timelineClips.filter(clip => clip.id !== middleClip.id).map(clip => clip.candidateId),
      seeded.clips.filter(clip => clip.id !== middleClip.id).map(clip => clip.candidateId),
    );

    assert.throws(
      () => restartedHarness.store.createExportJob({ ownerEmail: OWNER, projectId: project.id, manifestId: initialManifest.id }),
      error => error.code === 'EXPORT_JOB_STALE',
    );
    const currentManifest = restartedHarness.store.createExportManifest({
      ownerEmail: OWNER,
      projectId: project.id,
      options: { format: 'mp4', resolution: '720p', fps: 30, includeAudio: false },
    });
    assert.notEqual(currentManifest.id, initialManifest.id);
    assert.equal(currentManifest.manifest.timeline.clips.length, 3);
    assert.equal(currentManifest.manifest.timeline.clips.find(clip => clip.id === middleClip.id).candidateId, replacementCandidate.id);
    const currentJob = restartedHarness.store.createExportJob({
      ownerEmail: OWNER,
      projectId: project.id,
      manifestId: currentManifest.id,
    });
    assert.equal(currentJob.state, 'waiting_renderer');
    assert.equal(currentJob.providerSubmission, false);
    assert.equal(currentJob.billingMutation, false);
    assertNoPaidTables(db);

    return {
      ok: true,
      profile: 'local-no-paid-generation',
      projects: 1,
      shots: recovered.shots.length,
      candidates: recoveredCandidates.length,
      timelineClips: afterReplacement.timelineClips.length,
      restartRecovered: true,
      selectiveReplacement: true,
      exportQueued: true,
      providerSubmissions: 0,
      billingMutated: false,
      paidGenerationRequested: false,
      initialJobState: initialJob.state,
      currentJobState: currentJob.state,
    };
  } finally {
    if (db) db.close();
    fs.rmSync(tempDirectory, { recursive: true, force: true });
  }
}

if (process.argv[1]?.endsWith('verify-video-workbench-stage1.mjs')) {
  try {
    process.stdout.write(`${JSON.stringify(runVideoWorkbenchStage1Verification(), null, 2)}\n`);
  } catch (error) {
    console.error(error?.stack || error);
    process.exitCode = 1;
  }
}
