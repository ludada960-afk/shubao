import test from 'node:test';
import assert from 'node:assert/strict';
import { buildVideoPlan, getVideoFileKind } from '../src/pages/VideoStudio/videoPlanModel.js';

test('video planner identifies supported media without touching an upstream provider', () => {
  assert.equal(getVideoFileKind({ type: 'image/png', name: 'product.png' }), 'image');
  assert.equal(getVideoFileKind({ type: '', name: 'reference.MP4' }), 'video');
  assert.equal(getVideoFileKind({ type: 'audio/mpeg', name: 'voice.mp3' }), 'audio');
});
test('smart mode maps materials into a multimodal three-beat plan', () => {
  const plan = buildVideoPlan({
    mode: 'smart',
    prompt: '模特拿起包走向窗边，镜头从产品特写推进到使用场景',
    files: {
      images: [{ type: 'image/png', name: 'bag.png', size: 1024 }],
      videos: [{ type: 'video/mp4', name: 'pace.mp4', size: 2048 }],
      audios: [{ type: 'audio/mpeg', name: 'music.mp3', size: 512 }],
    },
  });
  assert.equal(plan.ready, true);
  assert.equal(plan.lane, 'multimodal_reference');
  assert.equal(plan.beats.length, 3);
  assert.equal(plan.materialMap[0].count, 2);
  assert.equal(plan.materialMap[1].detail, '音频素材');
});

test('frame mode blocks an incomplete pair and warns about ratio adaptation', () => {
  const plan = buildVideoPlan({ mode: 'frame', prompt: '镜头平滑推进', ratio: '16:9', files: { first: [{ name: 'start.png' }], last: [] } });
  assert.equal(plan.ready, false);
  assert.equal(plan.blockers.some(item => item.code === 'frame-pair'), true);
  assert.equal(plan.warnings.some(item => item.code === 'frame-ratio'), true);
});

test('audio cannot be the only reference and remake requires image plus video', () => {
  const audioOnly = buildVideoPlan({ prompt: '做一段有节奏的片头', files: { audios: [{ name: 'music.mp3' }] } });
  assert.equal(audioOnly.blockers.some(item => item.code === 'audio-only'), true);
  const remake = buildVideoPlan({ mode: 'remake', prompt: '保留节奏替换商品', files: { videos: [{ name: 'source.mp4' }] } });
  assert.equal(remake.blockers.some(item => item.code === 'remake-pair'), true);
});
