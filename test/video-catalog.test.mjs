import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DEFAULT_VIDEO_PRODUCT_ID,
  VIDEO_CATALOG_VERSION,
  VIDEO_PRODUCTS,
  getVideoProduct,
  publicVideoProducts,
  validateVideoProductInput,
  videoFeatureSku,
} from '../server/videoCatalog.mjs';

test('video products expose one curated stable contract', () => {
  assert.match(VIDEO_CATALOG_VERSION, /^video-products-/);
  assert.equal(DEFAULT_VIDEO_PRODUCT_ID, 'seedance_standard');
  assert.deepEqual(Object.keys(VIDEO_PRODUCTS), [
    'seedance_fast',
    'seedance_standard',
    'minimax_h3_2k',
  ]);
  assert.equal(getVideoProduct('seedance_standard').default, true);
  assert.equal(getVideoProduct('minimax_h3_2k').public, false);
  assert.equal(Object.isFrozen(VIDEO_PRODUCTS), true);
  assert.equal(Object.isFrozen(getVideoProduct('seedance_standard').limits), true);
  assert.throws(() => getVideoProduct('__proto__'), /未知视频产品/);
});

test('video feature sku follows product and duration without raw resolution pricing', () => {
  assert.equal(videoFeatureSku({ productId: 'seedance_fast', duration: 8 }), 'video_seedance_fast_short');
  assert.equal(videoFeatureSku({ productId: 'seedance_fast', duration: 9 }), 'video_seedance_fast_long');
  assert.equal(videoFeatureSku({ productId: 'seedance_standard', duration: 15 }), 'video_seedance_standard_long');
  assert.equal(videoFeatureSku({ productId: 'minimax_h3_2k', duration: 5 }), 'video_minimax_h3_2k_short');
});

test('video product validation rejects unsupported duration, mode, resolution, and frame audio', () => {
  assert.throws(
    () => validateVideoProductInput({ productId: 'minimax_h3_2k', duration: 4, mode: 'script', resolution: '2k' }),
    /5 到 15 秒/,
  );
  assert.throws(
    () => validateVideoProductInput({ productId: 'seedance_standard', duration: 8, mode: 'unknown', resolution: '720p' }),
    /创作模式/,
  );
  assert.throws(
    () => validateVideoProductInput({ productId: 'seedance_fast', duration: 8, mode: 'script', resolution: '480p' }),
    /清晰度/,
  );
  assert.throws(
    () => validateVideoProductInput({ productId: 'minimax_h3_2k', duration: 8, mode: 'frame', resolution: '2k', generateAudio: true }),
    /首尾帧.*声音/,
  );
  assert.deepEqual(
    validateVideoProductInput({ productId: 'seedance_standard', duration: 8, mode: 'reference', resolution: '720P', generateAudio: true }),
    { productId: 'seedance_standard', duration: 8, mode: 'reference', resolution: '720p', generateAudio: true },
  );
});

test('public products omit hidden routes and private provider details', () => {
  const products = publicVideoProducts();
  assert.deepEqual(products.map(product => product.id), ['seedance_fast', 'seedance_standard']);
  assert.equal(products.find(product => product.default)?.id, DEFAULT_VIDEO_PRODUCT_ID);
  assert.equal(products.every(product => !('routeId' in product) && !('credential' in product)), true);
  assert.equal(products.every(product => !JSON.stringify(product).includes('providerCostCny')), true);
  assert.deepEqual(products.find(product => product.id === 'seedance_fast').quotes.short, {
    sku: 'video_seedance_fast_short', units: 40000, points: 40,
  });
});
