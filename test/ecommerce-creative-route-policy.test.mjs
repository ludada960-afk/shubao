import assert from 'node:assert/strict';
import test from 'node:test';

import {
  creativeRouteFingerprint,
  creativeRouteSimilarity,
  selectCreativeRoute,
} from '../server/ecommerceEngine/creativeRoutePolicy.mjs';

const evidence = Object.freeze({
  productName: '便携焖烧杯',
  category: '家居日用',
  platform: '淘宝',
  userPrompt: '突出通勤便携和多规格差异',
  productObservations: Object.freeze(['银色圆柱杯身', '顶部提手清晰可见']),
  referenceStyle: Object.freeze(['自然窗光', '留白版式']),
});

test('same creative attempt deterministically preserves the route for retries', () => {
  const first = selectCreativeRoute({ evidence, attemptId: 'attempt-fixed' });
  const retry = selectCreativeRoute({ evidence, attemptId: 'attempt-fixed' });

  assert.deepEqual(retry, first);
  assert.equal(first.fingerprint, creativeRouteFingerprint(first.route));
});

test('a deliberate new attempt avoids the recently used creative route', () => {
  const first = selectCreativeRoute({ evidence, attemptId: 'attempt-one' });
  const next = selectCreativeRoute({
    evidence,
    attemptId: 'attempt-two',
    recentRoutes: [first.route],
  });

  assert.notEqual(next.fingerprint, first.fingerprint);
  assert.ok(creativeRouteSimilarity(first.route, next.route) < 0.75);
  assert.match(next.rationale, /便携焖烧杯/);
  assert.match(next.rationale, /通勤便携|多规格/);
  assert.ok(next.difference.length > 0);
});

test('creative route selection never mutates product evidence', () => {
  const before = JSON.stringify(evidence);
  const selected = selectCreativeRoute({ evidence, attemptId: 'attempt-truth' });

  assert.equal(JSON.stringify(evidence), before);
  assert.deepEqual(selected.evidence, evidence);
  assert.equal(Object.isFrozen(evidence.productObservations), true);
});

test('route similarity compares bounded creative dimensions instead of prose', () => {
  const route = selectCreativeRoute({ evidence, attemptId: 'attempt-similarity' }).route;
  const proseChanged = { ...route, title: '换了标题但执行一致', rationale: '换了一句解释' };
  const compositionChanged = { ...route, composition: `${route.composition}-alternate` };

  assert.equal(creativeRouteSimilarity(route, proseChanged), 1);
  assert.ok(creativeRouteSimilarity(route, compositionChanged) < 1);
});
