import test from 'node:test';
import assert from 'node:assert/strict';
import { videoFeatureSku } from '../server/videoGeneration.mjs';

test('video pricing tier is derived server-side from delivery resolution and duration', () => {
  assert.equal(videoFeatureSku({ resolution: '480p', duration: 4 }), 'video_seedance_480p_short');
  assert.equal(videoFeatureSku({ resolution: '480p', duration: 15 }), 'video_seedance_480p_long');
  assert.equal(videoFeatureSku({ resolution: '720p', duration: 8 }), 'video_seedance_720p_short');
  assert.equal(videoFeatureSku({ resolution: '720p', duration: 9 }), 'video_seedance_720p_long');
});
