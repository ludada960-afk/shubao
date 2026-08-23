import assert from 'node:assert/strict';
import test from 'node:test';

import {
  approvedAssetVersions,
  approvedAudioAssetVersions,
  audioTrackDurationMs,
  audioTrackForAsset,
  availableUploadedAssets,
  candidateJobsForProject,
  normalizeSubtitleCues,
  nextShotPosition,
  nextTimelinePosition,
  reusableProjectAssets,
  selectedCandidateForShot,
  subtitleCueDrafts,
  videoProjects,
  workbenchStageSummary,
} from '../src/pages/VideoStudio/videoProjectWorkbenchModel.js';

test('approved audio assets are limited to confirmed voice/music versions', () => {
  const workbench = { assets: [
    { id: 'voice', kind: 'voice', approvedVersionId: 'voice-v1', versions: [{ id: 'voice-v1', mimeType: 'audio/mpeg' }] },
    { id: 'music', kind: 'music', approvedVersionId: 'music-v1', versions: [{ id: 'music-v1', mimeType: 'audio/wav' }] },
    { id: 'image', kind: 'product', approvedVersionId: 'image-v1', versions: [{ id: 'image-v1', mimeType: 'audio/mpeg' }] },
    { id: 'bad', kind: 'voice', approvedVersionId: 'bad-v1', versions: [{ id: 'bad-v1', mimeType: 'image/png' }] },
  ] };
  assert.deepEqual(approvedAudioAssetVersions(workbench).map(({ asset }) => asset.id), ['voice', 'music']);
});

test('audio track helpers keep duplicate detection and bounded timeline duration', () => {
  const workbench = {
    timelineClips: [{ status: 'active', trimEndMs: 4200 }, { status: 'stale', trimEndMs: 99999 }],
    audioTracks: [{ id: 'track-1', assetId: 'music', assetVersionId: 'music-v1' }],
  };
  assert.equal(audioTrackDurationMs(workbench), 4200);
  assert.equal(audioTrackForAsset(workbench, 'music', 'music-v1')?.id, 'track-1');
  assert.equal(audioTrackForAsset(workbench, 'voice', 'voice-v1'), null);
  assert.equal(audioTrackDurationMs({ timelineClips: [{ status: 'active', trimEndMs: 999999 }] }), 120000);
  assert.equal(audioTrackDurationMs({ timelineClips: [] }), 500);
});

test('subtitle cue drafts normalize seconds to bounded sorted milliseconds', () => {
  assert.deepEqual(normalizeSubtitleCues([
    { start: '0.2', end: '1.4', text: '开场' },
    { start: '1.4', end: '2.8', text: '展示细节' },
  ], 3000), [
    { startMs: 200, endMs: 1400, text: '开场' },
    { startMs: 1400, endMs: 2800, text: '展示细节' },
  ]);
  assert.throws(() => normalizeSubtitleCues([
    { start: '1.5', end: '1.2', text: '倒序' },
  ], 3000), /字幕时间范围无效/);
  assert.throws(() => normalizeSubtitleCues([
    { start: '0', end: '3.1', text: '超出音轨' },
  ], 3000), /字幕时间范围无效/);
});

test('subtitle cue drafts provide stable editable values without mutating persisted cues', () => {
  const persisted = [{ startMs: 250, endMs: 1250, text: '先讲重点' }];
  assert.deepEqual(subtitleCueDrafts(persisted), [{ start: '0.25', end: '1.25', text: '先讲重点' }]);
  assert.deepEqual(persisted, [{ startMs: 250, endMs: 1250, text: '先讲重点' }]);
  assert.deepEqual(subtitleCueDrafts([]), []);
});

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

test('all reusable media project assets enter the video import list', () => {
  const base = {
    project: { id: 'commerce-1', kind: 'ecommerce', title: '商品项目' },
    mediaKind: 'image', projectAssetId: 'asset-1', contentHash: 'hash-1',
  };
  const result = reusableProjectAssets([
    { ...base, retentionState: 'active' },
    { ...base, projectAssetId: 'asset-marked', contentHash: 'hash-marked', retentionState: 'marked' },
    { ...base, projectAssetId: 'asset-isolated', contentHash: 'hash-isolated', retentionState: 'isolated' },
    { ...base, project: { id: 'video-1', kind: 'video' }, projectAssetId: 'asset-video', contentHash: 'hash-video' },
    { ...base, project: null, projectAssetId: 'asset-no-project', contentHash: 'hash-no-project' },
    { ...base, projectAssetId: '', contentHash: 'hash-no-id' },
    { ...base, projectAssetId: 'asset-no-hash', contentHash: '' },
  ]);
  assert.deepEqual(result.map(asset => asset.projectAssetId), ['asset-1', 'asset-video']);
  assert.equal(result[0].sourceProject.id, 'commerce-1');
  assert.equal(result[1].sourceProject.kind, 'video');
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
