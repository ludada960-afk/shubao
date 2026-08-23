import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assertVideoExportManifestIntegrity,
  buildVideoExportManifest,
  videoExportManifestHash,
} from '../server/videoExportManifest.mjs';

function workbench(overrides = {}) {
  const project = { id: 'project-1', kind: 'video', title: '耳机广告' };
  const shot = {
    id: 'shot-1', purpose: '产品亮相', durationMs: 6000, status: 'draft', selectedCandidateId: 'candidate-1',
    candidates: [{
      id: 'candidate-1', outputAssetId: 'asset-video-1', contentHash: 'video-hash-1',
      stableUrl: '/api/video/assets/video-1', mimeType: 'video/mp4', status: 'available',
    }], bindings: [],
  };
  return {
    project,
    assets: [{
      id: 'audio-asset', kind: 'music', name: '配乐', approvedVersionId: 'audio-version',
      versions: [{ id: 'audio-version', mimeType: 'audio/mpeg', contentHash: 'audio-hash', stableUrl: '/private/audio' }],
    }],
    shots: [shot],
    timelineClips: [{
      id: 'clip-1', shotId: shot.id, candidateId: 'candidate-1', position: 0,
      trimStartMs: 500, trimEndMs: 5500, muted: false, status: 'active',
    }],
    audioTracks: [{
      id: 'track-1', kind: 'music', assetId: 'audio-asset', assetVersionId: 'audio-version',
      startMs: 0, durationMs: 5000, volume: 0.8, muted: false,
      language: '', voiceAnchor: '', beatMarkers: [1000, 2500],
      subtitleCues: [{ startMs: 100, endMs: 900, text: '新品上市' }],
    }],
    ...overrides,
  };
}

test('builds a stable export manifest without owner or playback URLs', () => {
  const first = buildVideoExportManifest({ workbench: workbench() });
  const second = buildVideoExportManifest({
    workbench: workbench(),
    options: { title: '耳机广告', resolution: '720p', fps: 30, format: 'mp4', includeAudio: true },
  });
  assert.equal(first.manifestHash, second.manifestHash);
  assert.equal(first.schemaVersion, 1);
  assert.equal(first.kind, 'video-export-manifest');
  assert.equal(first.timeline.durationMs, 5000);
  assert.equal(first.timeline.clips[0].candidate.contentHash, 'video-hash-1');
  assert.equal(first.timeline.clips[0].candidate.playbackUrl, undefined);
  assert.equal(first.audio.tracks[0].subtitleCues[0].text, '新品上市');
  assert.equal(first.delivery.status, 'manifest_ready');
  assert.equal(first.delivery.providerSubmission, false);
  assert.equal(first.delivery.billingMutation, false);
  assert.equal(JSON.stringify(first).includes('/private/audio'), false);
  assert.equal(JSON.stringify(first).includes('ownerEmail'), false);
  assert.equal(videoExportManifestHash(first), first.manifestHash);
  assert.equal(assertVideoExportManifestIntegrity(first, first.manifestHash), true);
});

test('fails closed when an export manifest payload or stored hash changes', () => {
  const manifest = buildVideoExportManifest({ workbench: workbench() });
  const tampered = { ...manifest, options: { ...manifest.options, fps: 60 } };
  assert.throws(() => assertVideoExportManifestIntegrity(tampered, manifest.manifestHash), error => (
    error.code === 'EXPORT_MANIFEST_INTEGRITY_INVALID'
  ));
  assert.throws(() => assertVideoExportManifestIntegrity(manifest, 'different-hash'), error => (
    error.code === 'EXPORT_MANIFEST_INTEGRITY_INVALID'
  ));
});

test('rejects empty, stale, mismatched, and non-video timeline clips', () => {
  assert.throws(() => buildVideoExportManifest({ workbench: workbench({ timelineClips: [] }) }), /时间线/);
  assert.throws(() => buildVideoExportManifest({ workbench: workbench({ timelineClips: [{ ...workbench().timelineClips[0], status: 'stale' }] }) }), /有效/);
  assert.throws(() => buildVideoExportManifest({ workbench: workbench({ timelineClips: [{ ...workbench().timelineClips[0], candidateId: 'other' }] }) }), /候选/);
  const invalid = workbench();
  invalid.shots[0].candidates[0].mimeType = 'image/png';
  assert.throws(() => buildVideoExportManifest({ workbench: invalid }), /视频/);
});

test('rejects invalid trim, duplicate positions, and malformed audio metadata', () => {
  const trim = workbench();
  trim.timelineClips[0].trimEndMs = 7000;
  assert.throws(() => buildVideoExportManifest({ workbench: trim }), /裁剪|时长/);
  const duplicate = workbench({ timelineClips: [
    ...workbench().timelineClips,
    { ...workbench().timelineClips[0], id: 'clip-2', position: 0 },
  ] });
  assert.throws(() => buildVideoExportManifest({ workbench: duplicate }), /位置/);
  const audio = workbench();
  audio.audioTracks[0].subtitleCues = [{ startMs: 0, endMs: 10, text: '' }];
  assert.throws(() => buildVideoExportManifest({ workbench: audio }), /字幕/);
  const overlap = workbench();
  overlap.audioTracks[0].subtitleCues = [
    { startMs: 0, endMs: 1200, text: '第一句' },
    { startMs: 1100, endMs: 1800, text: '重叠句' },
  ];
  assert.throws(() => buildVideoExportManifest({ workbench: overlap }), /字幕/);
  const outOfTrack = workbench();
  outOfTrack.audioTracks[0].subtitleCues = [{ startMs: 0, endMs: 5001, text: '超出轨道' }];
  assert.throws(() => buildVideoExportManifest({ workbench: outOfTrack }), /字幕/);
  const tooMany = workbench();
  tooMany.audioTracks[0].subtitleCues = Array.from({ length: 201 }, (_, index) => ({
    startMs: index * 10, endMs: index * 10 + 5, text: '字幕',
  }));
  assert.throws(() => buildVideoExportManifest({ workbench: tooMany }), /字幕/);
});

test('normalizes bounded delivery options and rejects unsupported values', () => {
  const manifest = buildVideoExportManifest({ workbench: workbench(), options: {
    format: 'webm', resolution: '1080p', fps: 60, includeAudio: false, title: '  发布片  ',
  } });
  assert.deepEqual(manifest.options, {
    format: 'webm', resolution: '1080p', fps: 60, includeAudio: false, title: '发布片',
  });
  assert.throws(() => buildVideoExportManifest({ workbench: workbench(), options: { format: 'mov' } }), /格式/);
  assert.throws(() => buildVideoExportManifest({ workbench: workbench(), options: { fps: 29 } }), /帧率/);
});
