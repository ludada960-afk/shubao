import assert from 'node:assert/strict';
import test from 'node:test';

import { decorateOwnedWorkPlayback } from '../server/projects/workMediaPlayback.mjs';

function resolver({ asset, ownerEmail }) {
  return `/api/video/media/${asset.assetId}?owner=${encodeURIComponent(ownerEmail)}&cap=test`;
}

test('Works remint nested video and audio playback while preserving canonical media identity', () => {
  const work = {
    _saveKey: 'media-work',
    owner_email: 'owner@example.com',
    video_url: '/api/video/assets/video-1',
    video: { url: '/api/video/assets/video-1', duration: 8 },
    audio_url: '/api/video/assets/audio-1',
    audio: { url: '/api/video/assets/audio-1', mimeType: 'audio/mpeg' },
    projectAssetRefs: [{
      projectAssetId: 'audio-project-1',
      assetId: 'audio-1',
      stableUrl: '/api/video/assets/audio-1',
      mimeType: 'audio/mpeg',
    }],
    imageRecords: [{
      key: 'source-image',
      url: '/api/generated-assets/image-1.webp',
      mimeType: 'image/webp',
    }],
  };

  const decorated = decorateOwnedWorkPlayback(work, {
    ownerEmail: 'owner@example.com',
    resolveAssetPlaybackUrl: resolver,
  });

  assert.equal(decorated.video_url, '/api/video/media/video-1?owner=owner%40example.com&cap=test');
  assert.equal(decorated.video.url, decorated.video_url);
  assert.equal(decorated.video.stableUrl, '/api/video/assets/video-1');
  assert.equal(decorated.audio_url, '/api/video/media/audio-1?owner=owner%40example.com&cap=test');
  assert.equal(decorated.audio.url, decorated.audio_url);
  assert.equal(decorated.audio.stableUrl, '/api/video/assets/audio-1');
  assert.equal(decorated.projectAssetRefs[0].url, '/api/video/media/audio-1?owner=owner%40example.com&cap=test');
  assert.equal(decorated.projectAssetRefs[0].playbackUrl, decorated.projectAssetRefs[0].url);
  assert.equal(decorated.projectAssetRefs[0].stableUrl, '/api/video/assets/audio-1');
  assert.equal(decorated.imageRecords[0].url, '/api/generated-assets/image-1.webp');
  assert.equal(work.video_url, '/api/video/assets/video-1');
  assert.equal(work.projectAssetRefs[0].url, undefined);
});

test('Works playback decoration fails open for non-video assets and unavailable capabilities', () => {
  const work = {
    imageRecords: [{ url: '/api/generated-assets/image-1.webp' }],
    projectAssetRefs: [{ stableUrl: '/api/video/assets/missing-audio', mimeType: 'audio/mpeg' }],
  };

  assert.deepEqual(decorateOwnedWorkPlayback(work, {
    ownerEmail: 'owner@example.com',
    resolveAssetPlaybackUrl: () => '',
  }), work);
});
