import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildRouteHistoryStats,
  normalizeRouteHistory,
  recommendVideoRoute,
} from '../server/videoModelRouter.mjs';

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

// ---- VID-P3-05 data-driven routing history ----

function attemptRow(productId, state, createdIso, updatedIso, provider = 'seedance', model = 'fast-v1') {
  return { provider, model, state, productId, createdAt: createdIso, updatedAt: updatedIso };
}

test('route history normalization keeps bounded known-state rows and drops the rest', () => {
  const rows = normalizeRouteHistory([
    attemptRow('seedance_fast', 'delivered', '2026-08-20T08:00:00Z', '2026-08-20T08:01:00Z'),
    attemptRow('seedance_fast', 'failed', '2026-08-20T09:00:00Z', '2026-08-20T09:00:20Z'),
    { provider: '', state: 'delivered', productId: 'x' },
    { provider: 'p', state: 'teleported', productId: 'x' },
    'garbage',
    null,
  ]);
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0], {
    provider: 'seedance', model: 'fast-v1', state: 'delivered', productId: 'seedance_fast',
    createdAtMs: Date.parse('2026-08-20T08:00:00Z'), updatedAtMs: Date.parse('2026-08-20T08:01:00Z'),
  });
  const flood = Array.from({ length: 700 }, (_, i) => attemptRow(`p-${i}`, 'accepted', '2026-08-20T08:00:00Z', '2026-08-20T08:00:05Z'));
  assert.equal(normalizeRouteHistory(flood).length, 500);
  assert.equal(normalizeRouteHistory('not-an-array').length, 0);
});

test('route history stats aggregate success rate and median delivery seconds per product', () => {
  const stats = buildRouteHistoryStats(normalizeRouteHistory([
    attemptRow('seedance_fast', 'delivered', '2026-08-20T08:00:00Z', '2026-08-20T08:01:00Z'),
    attemptRow('seedance_fast', 'delivered', '2026-08-20T09:00:00Z', '2026-08-20T09:02:00Z'),
    attemptRow('seedance_fast', 'delivered', '2026-08-20T10:00:00Z', '2026-08-20T10:04:00Z'),
    attemptRow('seedance_fast', 'failed', '2026-08-20T11:00:00Z', '2026-08-20T11:00:10Z'),
    attemptRow('seedance_standard', 'failed', '2026-08-20T07:00:00Z', '2026-08-20T07:00:30Z'),
    attemptRow('', 'delivered', '2026-08-20T07:00:00Z', '2026-08-20T07:01:00Z'),
  ]));
  assert.deepEqual(stats, {
    attemptsConsidered: 6,
    products: {
      seedance_fast: { attempts: 4, delivered: 3, successRate: 0.75, medianDeliverySeconds: 120 },
      seedance_standard: { attempts: 1, delivered: 0, successRate: 0, medianDeliverySeconds: null },
    },
  });
});

test('history blending boosts proven products and leaves low-signal products untouched', () => {
  const request = { mode: 'reference', resolution: '720p', durationSec: 8 };
  const base = recommendVideoRoute({ request });
  const history = [
    ...Array.from({ length: 9 }, (_, i) => attemptRow('seedance_fast', i % 3 === 2 ? 'failed' : 'delivered', '2026-08-20T08:00:00Z', '2026-08-20T08:00:40Z')),
    ...Array.from({ length: 2 }, () => attemptRow('seedance_standard', 'failed', '2026-08-20T08:00:00Z', '2026-08-20T08:00:40Z')),
  ];
  const driven = recommendVideoRoute({ request, history });
  assert.ok(driven.historySummary, 'expected a history summary');
  assert.equal(driven.historySummary.attemptsConsidered, 11);
  assert.equal(driven.historySummary.weight, 0.3);
  assert.equal(driven.historySummary.minAttempts, 3);
  const fastBase = base.candidates.find(candidate => candidate.productId === 'seedance_fast');
  const fastDriven = driven.candidates.find(candidate => candidate.productId === 'seedance_fast');
  const standardDriven = driven.candidates.find(candidate => candidate.productId === 'seedance_standard');
  assert.ok(fastDriven.score > fastBase.score, 'proven fast product should gain score');
  assert.equal(fastDriven.historyApplied, true);
  assert.equal(standardDriven.historyApplied, false, 'below minAttempts the static score stands');
  assert.equal(driven.providerSubmission, false);
  assert.equal(driven.billingMutation, false);
});

test('without history the recommendation stays byte-identical to the legacy contract', () => {
  const request = { mode: 'smart', resolution: '720p', durationSec: 8 };
  const legacy = recommendVideoRoute({ request });
  expectNoHistory(legacy);
  expectNoHistory(recommendVideoRoute({ request, history: [] }));
});

function expectNoHistory(result) {
  assert.equal(result.historySummary, undefined);
  assert.ok(result.candidates.every(candidate => candidate.historyApplied === false));
}
