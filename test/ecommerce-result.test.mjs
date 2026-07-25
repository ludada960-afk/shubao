import test from 'node:test';
import assert from 'node:assert/strict';

import { summarizeEcommerceResult } from '../server/ecommerceResult.mjs';

test('classifies a completed ecommerce result with usable images as successful', () => {
  assert.deepEqual(summarizeEcommerceResult({ main: '/api/generated-assets/main.png' }), {
    imageCount: 1,
    hasImages: true,
  });
});

test('classifies empty or blank ecommerce results as failed instead of successful', () => {
  assert.deepEqual(summarizeEcommerceResult({ main: '', scene: null }), {
    imageCount: 0,
    hasImages: false,
  });
});
