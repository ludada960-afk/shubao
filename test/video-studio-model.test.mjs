import assert from 'node:assert/strict';
import test from 'node:test';

import {
  VIDEO_CREATION_MODES,
  hasRequiredVideoInputs,
  quoteForVideoProduct,
  resolveVideoApiMode,
} from '../src/pages/VideoStudio/videoStudioModel.js';

test('video creation modes expose three distinct user jobs', () => {
  assert.deepEqual(VIDEO_CREATION_MODES.map(mode => mode.id), ['smart', 'frame', 'remake']);
  assert.deepEqual(VIDEO_CREATION_MODES.map(mode => mode.label), ['智能成片', '首尾帧', '爆款重构']);
});

test('smart creation chooses the compatible upstream mode from supplied materials', () => {
  assert.equal(resolveVideoApiMode('smart', {}), 'script');
  assert.equal(resolveVideoApiMode('smart', { images: [{}] }), 'reference');
  assert.equal(resolveVideoApiMode('smart', { videos: [{}] }), 'reference');
  assert.equal(resolveVideoApiMode('smart', { audios: [{}] }), 'reference');
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

test('frontend video quotes come from the selected public product contract', () => {
  const product = {
    id: 'seedance_standard',
    durations: { min: 4, max: 15 },
    quotes: {
      short: { sku: 'video_seedance_standard_short', units: 62000, points: 62 },
      long: { sku: 'video_seedance_standard_long', units: 72000, points: 72 },
    },
  };
  assert.deepEqual(quoteForVideoProduct(product, 8), product.quotes.short);
  assert.deepEqual(quoteForVideoProduct(product, 9), product.quotes.long);
  assert.throws(() => quoteForVideoProduct(product, 3), /4 到 15 秒/);
  assert.throws(() => quoteForVideoProduct({ ...product, quotes: {} }, 8), /报价/);
});
