import assert from 'node:assert/strict';
import test from 'node:test';

import { recommendVideoRoute } from '../server/videoModelRouter.mjs';

test('prefers the requested eligible product without hiding the ranked alternatives', () => {
  const result = recommendVideoRoute({
    request: {
      preferredProductId: 'seedance_standard',
      mode: 'smart',
      resolution: '720p',
      durationSec: 8,
      generateAudio: true,
      objective: 'speed',
    },
  });

  assert.equal(result.status, 'ready');
  assert.equal(result.selected.productId, 'seedance_standard');
  assert.equal(result.selectionReason, 'preferred_product');
  assert.equal(result.request.mode, 'script');
  assert.ok(result.candidates.some(candidate => candidate.productId === 'seedance_fast'));
  assert.equal(result.providerSubmission, false);
  assert.equal(result.billingMutation, false);
});

test('speed objective ranks fast product first when there is no preference', () => {
  const result = recommendVideoRoute({
    request: { mode: 'reference', resolution: '720p', durationSec: 6, generateAudio: true, objective: 'speed' },
  });

  assert.equal(result.selected.productId, 'seedance_fast');
  assert.equal(result.candidates[0].productId, 'seedance_fast');
  assert.match(result.candidates[0].reasons.join(' '), /速度/);
});

test('fails closed when the request exceeds the public reference limit', () => {
  const result = recommendVideoRoute({
    request: {
      mode: 'reference',
      resolution: '720p',
      durationSec: 8,
      referenceCounts: { images: 10, videos: 0, audios: 0 },
    },
  });

  assert.equal(result.status, 'blocked');
  assert.equal(result.selected, null);
  assert.ok(result.blockers.some(blocker => blocker.code === 'REFERENCE_LIMIT_EXCEEDED'));
  assert.equal(result.providerSubmission, false);
  assert.equal(result.billingMutation, false);
});

test('does not expose hidden products as a public route', () => {
  const result = recommendVideoRoute({
    request: { preferredProductId: 'minimax_h3_2k', mode: 'reference', resolution: '720p', durationSec: 8 },
  });

  assert.equal(result.status, 'ready');
  assert.notEqual(result.selected.productId, 'minimax_h3_2k');
  assert.ok(result.blockers.some(blocker => blocker.code === 'PREFERRED_PRODUCT_UNAVAILABLE'));
  assert.ok(result.warnings.some(warning => /公开路线/.test(warning)));
});

test('quality and cost objectives remain deterministic and expose an estimate only', () => {
  const quality = recommendVideoRoute({ request: { resolution: '720p', durationSec: 12, objective: 'quality' } });
  const cost = recommendVideoRoute({ request: { resolution: '720p', durationSec: 12, objective: 'cost' } });

  assert.equal(quality.candidates.length, 2);
  assert.equal(cost.candidates.length, 2);
  assert.ok(quality.selected.estimatedPoints > 0);
  assert.ok(cost.selected.estimatedPoints > 0);
  assert.deepEqual(
    quality.candidates.map(candidate => candidate.productId),
    recommendVideoRoute({ request: { resolution: '720p', durationSec: 12, objective: 'quality' } }).candidates.map(candidate => candidate.productId),
  );
  assert.equal(quality.providerSubmission, false);
  assert.equal(quality.billingMutation, false);
});
