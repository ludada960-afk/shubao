import test from 'node:test';
import assert from 'node:assert/strict';

import {
  BETA_GUARDED_POST_ROUTES,
  RATE_LIMITED_POST_ROUTES,
  getGenerationRateLimit,
} from '../server/generationRouteGuard.mjs';

const EXPENSIVE_POST_ROUTES = [
  '/api/generate',
  '/api/regenerate-image',
  '/api/regenerate-text',
  '/api/analyze',
  '/api/extract-product-link',
  '/api/ecommerce/auto-recognize',
  '/api/ecommerce/design-directions',
  '/api/polish-ec-text',
  '/api/reverse-prompt',
  '/api/remove-bg',
  '/api/generate-ecommerce',
  '/api/canvas/regenerate',
  '/api/canvas/transform',
  '/api/canvas/analyze-layers',
  '/api/plog-generate',
  '/api/extension/analyze',
  '/api/extension/regenerate',
];

test('every expensive generation route requires beta access and rate limiting', () => {
  for (const route of EXPENSIVE_POST_ROUTES) {
    assert.equal(BETA_GUARDED_POST_ROUTES.has(route), true, `${route} must require beta access`);
    assert.equal(RATE_LIMITED_POST_ROUTES.has(route), true, `${route} must be rate limited`);
  }
});

test('owner beta account has a testing-friendly rate limit without disabling abuse protection', () => {
  assert.deepEqual(getGenerationRateLimit('867550189@qq.com'), { max: 60, windowMs: 60_000 });
  assert.deepEqual(getGenerationRateLimit('someone@example.com'), { max: 10, windowMs: 60_000 });
});
