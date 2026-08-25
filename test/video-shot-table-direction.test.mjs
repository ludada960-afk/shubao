import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeShotDirection } from '../server/videoShotDirection.mjs';

test('VID-R3: six-column shot table fields round-trip through normalization', () => {
  const normalized = normalizeShotDirection({
    hookType: 'reveal',
    continuityLink: '承接上一镜结束时的门框位置，主角从右侧入画',
    refs: {
      landmark: 'door-frame: 右侧 1/3',
      characterPositions: '主角 中景偏右，面向镜头',
      exits: '配角离屏左侧',
      lightingBaseline: '主光温暖顶光',
    },
    perSecond: [
      { t: '0-1s', action: '抬手展示材质', camera: 'dolly_in', space: '产品位于画面中央', audio: '环境音渐入', handoff: '手停在材质特写起点' },
    ],
    audioTrack: {
      narration: '无旁白',
      dialogue: '无对白',
      sfx: '布料摩擦声',
      performanceNotes: 'narrator-mouth-closed: true',
    },
  }, '');

  assert.equal(normalized.hookType, 'reveal');
  assert.equal(normalized.continuityLink, '承接上一镜结束时的门框位置，主角从右侧入画');
  assert.equal(normalized.refs.landmark, 'door-frame: 右侧 1/3');
  assert.equal(normalized.perSecond.length, 1);
  assert.deepEqual(normalized.perSecond[0], {
    t: '0-1s',
    action: '抬手展示材质',
    camera: 'dolly_in',
    space: '产品位于画面中央',
    audio: '环境音渐入',
    handoff: '手停在材质特写起点',
  });
  assert.equal(normalized.audioTrack.performanceNotes, 'narrator-mouth-closed: true');
});

test('VID-R3: invalid hook types fall back to empty and legacy payloads keep defaults', () => {
  const rejected = normalizeShotDirection({ hookType: 'not-a-hook' });
  assert.equal(rejected.hookType, '');

  const legacy = normalizeShotDirection({ primaryAction: 'legacy shot' });
  assert.equal(legacy.hookType, '');
  assert.deepEqual(legacy.refs, { landmark: '', characterPositions: '', exits: '', lightingBaseline: '' });
  assert.deepEqual(legacy.perSecond, []);
  assert.deepEqual(legacy.audioTrack, { narration: '', dialogue: '', sfx: '', performanceNotes: '' });
  // Existing director controls stay intact.
  assert.equal(legacy.shotScale, 'medium');
  assert.equal(legacy.continuity.axis, 'neutral');
});

test('VID-R3: per-second directives are capped and blank entries are dropped', () => {
  const entries = Array.from({ length: 40 }, (_, index) => ({ t: `${index}s`, action: index < 3 ? `动作${index}` : '' }));
  const normalized = normalizeShotDirection({ perSecond: entries });
  assert.ok(normalized.perSecond.length <= 30);
  const blank = normalizeShotDirection({ perSecond: [{}, { t: '2s' }] });
  assert.equal(blank.perSecond.length, 1);
  assert.equal(blank.perSecond[0].t, '2s');
});
