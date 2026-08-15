import assert from 'node:assert/strict';
import test from 'node:test';

import {
  approvedAssetVersions,
  availableUploadedAssets,
  candidateJobsForProject,
  nextShotPosition,
  nextTimelinePosition,
  selectedCandidateForShot,
  videoProjects,
  workbenchStageSummary,
} from '../src/pages/VideoStudio/videoProjectWorkbenchModel.js';

test('video projects are filtered and deterministically ordered without reshuffling', () => {
  const projects = videoProjects([
    { id: 'image', kind: 'ecommerce', status: 'active', updatedAt: '2026-08-15T12:00:00Z' },
    { id: 'done', kind: 'video', status: 'completed', updatedAt: '2026-08-15T13:00:00Z' },
    { id: 'draft-old', kind: 'video', status: 'active', updatedAt: '2026-08-15T10:00:00Z' },
    { id: 'draft-new', kind: 'video', status: 'active', updatedAt: '2026-08-15T11:00:00Z' },
  ]);
  assert.deepEqual(projects.map(project => project.id), ['draft-new', 'draft-old', 'done']);
  assert.deepEqual(videoProjects(projects).map(project => project.id), ['draft-new', 'draft-old', 'done']);
});

test('only completed supported uploads with authoritative assets are offered once', () => {
  const result = availableUploadedAssets([
    { status: 'uploading', asset: { id: 'pending', kind: 'image' } },
    { status: 'completed', asset: { id: 'image-1', kind: 'image', fileName: 'product.webp' } },
    { status: 'completed', asset: { id: 'image-1', kind: 'image', fileName: 'duplicate.webp' } },
    { status: 'completed', asset: { id: 'output-1', kind: 'output' } },
    { status: 'completed', asset: { id: 'audio-1', kind: 'audio', fileName: 'voice.wav' } },
  ]);
  assert.deepEqual(result.map(item => item.asset.id), ['image-1', 'audio-1']);
});

test('approved versions and selected candidates are derived from authoritative ids', () => {
  const workbench = {
    assets: [
      { id: 'a1', approvedVersionId: 'v2', versions: [{ id: 'v1' }, { id: 'v2', stableUrl: '/v2' }] },
      { id: 'a2', approvedVersionId: null, versions: [{ id: 'v3' }] },
    ],
  };
  assert.deepEqual(approvedAssetVersions(workbench).map(item => item.version.id), ['v2']);
  assert.equal(selectedCandidateForShot({
    selectedCandidateId: 'c2', candidates: [{ id: 'c1' }, { id: 'c2', stableUrl: '/c2' }],
  }).id, 'c2');
  assert.equal(selectedCandidateForShot({ selectedCandidateId: 'missing', candidates: [] }), null);
});

test('positions always append after the highest persisted position', () => {
  assert.equal(nextShotPosition([{ position: 4 }, { position: 1 }, { position: 'bad' }]), 5);
  assert.equal(nextShotPosition([]), 0);
  assert.equal(nextTimelinePosition([{ position: 2 }, { position: 8 }]), 9);
});

test('candidate jobs include only completed jobs from the selected project', () => {
  const jobs = candidateJobsForProject([
    { id: 'new', projectId: 'p1', status: 'completed', updatedAt: '2026-08-15T12:00:00Z' },
    { id: 'pending', projectId: 'p1', status: 'processing', updatedAt: '2026-08-15T13:00:00Z' },
    { id: 'foreign', projectId: 'p2', status: 'completed', updatedAt: '2026-08-15T14:00:00Z' },
    { id: 'old', projectId: 'p1', status: 'completed', updatedAt: '2026-08-15T10:00:00Z' },
    { id: 'new', projectId: 'p1', status: 'completed', updatedAt: '2026-08-15T12:00:00Z' },
  ], 'p1');
  assert.deepEqual(jobs.map(job => job.id), ['new', 'old']);
});

test('stage summary exposes the next real workflow boundary', () => {
  assert.equal(workbenchStageSummary(null).stage, 'project');
  assert.equal(workbenchStageSummary({ assets: [], shots: [], timelineClips: [] }).stage, 'assets');
  const approved = { id: 'a1', approvedVersionId: 'v1', versions: [{ id: 'v1' }] };
  assert.equal(workbenchStageSummary({ assets: [approved], shots: [], timelineClips: [] }).stage, 'shots');
  const shot = { id: 's1', selectedCandidateId: null, candidates: [] };
  assert.equal(workbenchStageSummary({ assets: [approved], shots: [shot], timelineClips: [] }).stage, 'candidates');
  const selected = { ...shot, selectedCandidateId: 'c1', candidates: [{ id: 'c1' }] };
  assert.equal(workbenchStageSummary({ assets: [approved], shots: [selected], timelineClips: [] }).stage, 'timeline');
  const complete = workbenchStageSummary({
    assets: [approved], shots: [selected], timelineClips: [{ id: 't1', shotId: 's1', status: 'active' }],
  });
  assert.equal(complete.stage, 'ready');
  assert.deepEqual(complete.counts, { assets: 1, approvedAssets: 1, shots: 1, selectedShots: 1, timelineClips: 1 });
});
