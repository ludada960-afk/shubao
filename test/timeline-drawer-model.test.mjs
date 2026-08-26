import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  activeTimelineClips,
  clipDurationMs,
  clipRebindOptions,
  clipTrimBounds,
  clampTrimPatch,
  exportManifestSummary,
  exportReadiness,
  timelineTotalDurationMs,
} from '../src/pages/VideoStudio/timelineDrawerModel.js';

const source = path => readFile(new URL(path, import.meta.url), 'utf8');

const workbench = {
  timelineClips: [
    { id: 'c2', position: 1, shotId: 's1', candidateId: 'cd-A', trimStartMs: 1000, trimEndMs: 4000, muted: true, status: 'active' },
    { id: 'c1', position: 0, shotId: 's1', candidateId: 'cd-B', trimStartMs: 0, trimEndMs: 5000, muted: false, status: 'active' },
    { id: 'c3', position: 2, shotId: 's9', candidateId: 'cd-X', trimStartMs: 0, trimEndMs: 900, status: 'stale' },
  ],
  shots: [{ id: 's1', position: 0, purpose: '开场', durationMs: 6000, selectedCandidateId: 'cd-B', candidates: [
    { id: 'cd-B', stableUrl: 'https://x/b.mp4' },
    { id: 'cd-A', playbackUrl: 'https://x/a.mp4' },
    { id: 'cd-C' },
  ] }],
};

test('timeline clips: active-only ordering and duration math', () => {
  const clips = activeTimelineClips(workbench);
  assert.deepEqual(clips.map(clip => clip.id), ['c1', 'c2']); // stale 不进时间线，按 position 排序
  assert.equal(clipDurationMs(clips[0]), 5000);
  assert.equal(timelineTotalDurationMs(clips), 8000);
});

test('trim handles: bounds follow shot duration; invalid patches rejected with readable copy', () => {
  const clips = activeTimelineClips(workbench);
  const bounds = clipTrimBounds(clips[0], workbench.shots[0]);
  assert.deepEqual(bounds, { startMs: 0, endMs: 5000, minMs: 0, maxMs: 6000 });

  assert.deepEqual(
    clampTrimPatch({ clip: clips[0], shot: workbench.shots[0], trimStartMs: 250.4, trimEndMs: 5300.6 }),
    { trimStartMs: 250, trimEndMs: 5301 },
  );
  assert.throws(() => clampTrimPatch({ clip: clips[0], shot: workbench.shots[0], trimStartMs: -1, trimEndMs: 300 }), /不能早于/);
  assert.throws(() => clampTrimPatch({ clip: clips[0], shot: workbench.shots[0], trimStartMs: 0, trimEndMs: 9999 }), /不能超过镜头时长/);
  assert.throws(() => clampTrimPatch({ clip: clips[0], shot: workbench.shots[0], trimStartMs: 100, trimEndMs: 150 }), /至少保留 0.2 秒/);
  assert.throws(() => clampTrimPatch({ clip: clips[0], shot: workbench.shots[0], trimStartMs: 'x', trimEndMs: 500 }), /整数毫秒/);
});

test('candidate rebind: only other candidates of the same shot are offered', () => {
  const clips = activeTimelineClips(workbench);
  const optionsForSecondClip = clipRebindOptions(workbench, clips[1]); // c2 已绑 cd-A
  assert.deepEqual(optionsForSecondClip.map(option => option.candidateId), ['cd-B', 'cd-C']);
  assert.equal(optionsForSecondClip[0].isCurrentSelected, true); // cd-B 是镜头当前选定候选
  assert.equal(optionsForSecondClip[0].previewUrl, 'https://x/b.mp4');
  assert.equal(clipRebindOptions(workbench, { shotId: 'ghost', candidateId: 'x' }).length, 0);
});

test('export manifest summary: counts clips/tracks/cues and stays honest about rendering (P3)', () => {
  const manifest = {
    schemaVersion: 1,
    manifestHash: 'a'.repeat(64),
    options: { format: 'mp4', resolution: '1080p', fps: 30, includeAudio: true },
    timeline: { durationMs: 8000, clips: [{ durationMs: 5000 }, { durationMs: 3000 }] },
    audio: { includeAudio: true, tracks: [
      { subtitleCues: [{ startMs: 0, endMs: 1000, text: 'hi' }] },
      {},
    ] },
    delivery: { renderer: 'external-worker', providerSubmission: false, billingMutation: false },
    replayed: true,
  };
  const summary = exportManifestSummary(manifest);
  assert.equal(summary.clipCount, 2);
  assert.equal(summary.totalDurationMs, 8000);
  assert.equal(summary.audioTrackCount, 2);
  assert.equal(summary.subtitleCueCount, 1);
  assert.equal(summary.rendered, false);
  assert.equal(summary.replayed, true);
  assert.equal(exportManifestSummary(null), null);
  assert.equal(exportReadiness({ timelineClips: [] }).ok, false);
  assert.equal(exportReadiness(workbench).ok, true);
});

test('contract: drawer wires trim fields, rebind and export manifest in the canvas workbench', async () => {
  const jsx = await source('../src/pages/VideoStudio/VideoCanvasWorkbench.jsx');
  assert.match(jsx, /data-testid="timeline-drawer"/);
  // trim 手柄接字段：入点/出点输入 → updateClipDraft → clampTrimPatch → updateTimelineClip patch
  assert.match(jsx, /updateClipDraft\(clip, 'start'/);
  assert.match(jsx, /updateClipDraft\(clip, 'end'/);
  assert.match(jsx, /clampTrimPatch\(/);
  assert.match(jsx, /patch,/);
  // 候选换绑 + 加入时间线
  assert.match(jsx, /handleReplaceTimelineClipCandidate\(clip, option\.candidateId\)/);
  assert.match(jsx, /applyShotCandidateToTimeline/);
  assert.match(jsx, /加入时间线/);
  // 导出清单完善（真渲染留 P3）
  assert.match(jsx, /createVideoExportManifest\(projectId\)/);
  assert.match(jsx, /data-testid="export-manifest-panel"/);
  assert.match(jsx, /ffmpeg 真渲染在 P3 接入|P3 真渲染接入前不产出成片/s);
});
