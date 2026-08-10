import assert from 'node:assert/strict';
import test from 'node:test';

import {
  VIDEO_CREATION_MODES,
  hasRequiredVideoInputs,
  resolveVideoApiMode,
} from '../src/pages/VideoStudio/videoStudioModel.js';

test('video creation modes expose three distinct user jobs', () => {
  assert.deepEqual(VIDEO_CREATION_MODES.map(mode => mode.id), ['smart', 'frame', 'remake']);
  assert.deepEqual(VIDEO_CREATION_MODES.map(mode => mode.label), ['智能成片', '首尾帧', '爆款重构']);
});

test('smart creation chooses the compatible upstream mode from supplied materials', () => {
  assert.equal(resolveVideoApiMode('smart', {}), 'script');
  assert.equal(resolveVideoApiMode('smart', { images: [{}] }), 'reference');
  assert.equal(resolveVideoApiMode('frame', { first: [{}], last: [{}] }), 'frame');
  assert.equal(resolveVideoApiMode('remake', { images: [{}], videos: [{}] }), 'remake');
});

test('only frame and remake have mandatory material combinations', () => {
  assert.equal(hasRequiredVideoInputs('smart', {}), true);
  assert.equal(hasRequiredVideoInputs('frame', { first: [{}], last: [] }), false);
  assert.equal(hasRequiredVideoInputs('frame', { first: [{}], last: [{}] }), true);
  assert.equal(hasRequiredVideoInputs('remake', { images: [{}], videos: [] }), false);
  assert.equal(hasRequiredVideoInputs('remake', { images: [{}], videos: [{}] }), true);
});
