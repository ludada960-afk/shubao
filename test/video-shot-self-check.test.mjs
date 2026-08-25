import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeShotDirection } from '../server/videoShotDirection.mjs';
import { reviewShotTable, MAX_SHOT_DURATION_MS } from '../server/videoShotSelfCheck.mjs';

function shot(id, position, direction = {}, durationMs = 8000) {
  return { id, position, durationMs, status: 'draft', direction: normalizeShotDirection(direction, '') };
}
function base(index) {
  return { hookType: index === 0 ? 'reveal' : '', continuityLink: `承接镜头${index}`, refs: { landmark: 'door-frame: 右侧 1/3' }, perSecond: [], audioTrack: {} };
}

test('VID-R4: a fully compliant table passes with zero findings', () => {
  const shots = [0, 1, 2].map(index => shot(`s${index}`, index, {
    ...base(index),
    hookType: ['reveal', 'reversal', 'tender'][index],
    perSecond: [{ t: '0-1s', action: '抬手', camera: '', space: '', audio: '', handoff: '' }],
    audioTrack: { sfx: '布料声' },
  }));
  const report = reviewShotTable(shots);
  assert.equal(report.passed, true);
  assert.equal(report.issues.length, 0);
});

test('VID-R4: flags missing hooks, weak bookends and rhythm gaps', () => {
  const shots = [0, 1, 2].map(index => shot(`s${index}`, index, base(index)));
  const report = reviewShotTable(shots);
  const codes = report.issues.map(item => item.code);
  assert.ok(codes.includes('HOOK_MISSING'));
  assert.ok(codes.includes('HOOK_DENSITY_LOW') || codes.includes('BOOKEND_HOOK_WEAK'));
});

test('VID-R4: enforces the 15s per-shot cap', () => {
  const shots = [shot('long', 0, { ...base(0), hookType: 'reveal' }, MAX_SHOT_DURATION_MS + 1000)];
  const report = reviewShotTable(shots);
  assert.ok(report.issues.some(item => item.code === 'SHOT_TOO_LONG'));
});

test('VID-R4: landmark breaks must be declared as a hard cut in the link', () => {
  const shots = [
    shot('a', 0, { ...base(0), hookType: 'reveal', refs: { landmark: 'door-frame: 右侧 1/3' } }),
    shot('b', 1, { ...base(1), refs: { landmark: 'kitchen-island: 底部居中' } }),
  ];
  const silent = reviewShotTable(shots);
  assert.ok(silent.issues.some(item => item.code === 'LANDMARK_BREAK'));
  const declared = reviewShotTable([shots[0], shot('c', 1, { ...base(1), continuityLink: 'HARD CUT — 时间跳 2h', refs: { landmark: 'kitchen-island: 底部居中' }, hookType: '' })]);
  assert.ok(!declared.issues.some(item => item.code === 'LANDMARK_BREAK'));
});

test('VID-R4: chain gaps, per-second start and silent audio are surfaced', () => {
  const shots = [
    shot('open', 0, { ...base(0), hookType: 'reveal' }),
    shot('mid', 1, { hookType: 'callback', refs: { landmark: '' }, perSecond: [{ t: '1-2s', action: '走位' }] }),
  ];
  const report = reviewShotTable(shots);
  const codes = report.issues.map(item => item.code);
  assert.ok(codes.includes('CONTINUITY_CHAIN_GAP'));
  assert.ok(codes.includes('PER_SECOND_START_MISSING'));
  assert.ok(codes.includes('AUDIO_TRACK_ABSENT'));
});

test('VID-R4: empty table fails closed with an explicit finding', () => {
  const report = reviewShotTable([]);
  assert.equal(report.passed, false);
  assert.equal(report.issues[0].code, 'SHOT_TABLE_EMPTY');
});
