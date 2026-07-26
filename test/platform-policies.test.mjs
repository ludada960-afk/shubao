import test from 'node:test';
import assert from 'node:assert/strict';

import {
  PLATFORM_POLICY_REGISTRY_VERSION,
  getPlatformPolicy,
  planExportTargets,
} from '../server/ecommerceEngine/platformPolicies.mjs';

const POLICY_FIELDS = [
  'platform', 'categoryScope', 'role', 'recommendedCount', 'allowedRatios', 'exportSizes',
  'maxFileBytes', 'formats', 'backgroundPolicy', 'textPolicy', 'requiredFacts', 'sourceUrl',
  'verifiedAt', 'confidence', 'enforcement',
];

test('returns a provenance-bearing policy for supported platform roles', () => {
  assert.match(PLATFORM_POLICY_REGISTRY_VERSION, /^\d{4}\.\d{2}(\.\d{2})?$/);
  const policy = getPlatformPolicy('taobao', 'main', 'beauty');

  for (const field of POLICY_FIELDS) assert.ok(Object.hasOwn(policy, field), `missing ${field}`);
  assert.equal(policy.platform, 'taobao');
  assert.equal(policy.role, 'main');
  assert.equal(policy.categoryScope, 'beauty');
  assert.match(policy.sourceUrl, /^https:\/\//);
  assert.match(policy.verifiedAt, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(['high', 'medium', 'low'].includes(policy.confidence));
  assert.ok(['hard', 'recommendation'].includes(policy.enforcement));
});

test('uses category then role then platform fallbacks without fabricating hard category rules', () => {
  const categorySpecific = getPlatformPolicy('taobao', 'main', 'beauty');
  const roleFallback = getPlatformPolicy('taobao', 'main', 'unlisted-category');
  const platformFallback = getPlatformPolicy('taobao', 'unlisted-role', 'unlisted-category');

  assert.equal(categorySpecific.categoryScope, 'beauty');
  assert.equal(roleFallback.categoryScope, 'all');
  assert.equal(roleFallback.role, 'main');
  assert.equal(platformFallback.categoryScope, 'all');
  assert.equal(platformFallback.role, 'all');
  assert.equal(categorySpecific.enforcement, 'recommendation');
});

test('returns a conservative recommendation for unknown or inherited registry names', () => {
  for (const [platform, role, category] of [
    ['future-market', 'hero', 'regulated'],
    ['toString', 'constructor', '__proto__'],
  ]) {
    const policy = getPlatformPolicy(platform, role, category);
    assert.equal(policy.enforcement, 'recommendation');
    assert.equal(policy.confidence, 'low');
    assert.equal(policy.categoryScope, 'all');
    assert.match(policy.sourceUrl, /^https:\/\//);
  }
});

test('returns isolated policy data with deduplicated validated values', () => {
  const first = getPlatformPolicy('jd', 'white_background', 'all');
  const second = getPlatformPolicy('jd', 'white_background', 'all');
  first.allowedRatios.push('9:16');
  first.exportSizes[0].width = 1;
  first.formats.push('gif');

  assert.equal(second.allowedRatios.includes('9:16'), false);
  assert.notEqual(second.exportSizes[0].width, 1);
  assert.equal(second.formats.includes('gif'), false);
  assert.equal(new Set(second.allowedRatios).size, second.allowedRatios.length);
  assert.equal(new Set(second.formats).size, second.formats.length);
  assert.ok(second.exportSizes.every(({ width, height }) => Number.isInteger(width) && width > 0 && Number.isInteger(height) && height > 0));
});

test('plans deterministic post-process exports from a legal generation source without model target sizes', () => {
  const policy = getPlatformPolicy('douyin', 'main', 'all');
  const source = { ratio: '1:1', generationSize: '2048x2048' };
  const first = planExportTargets(policy, source);
  const second = planExportTargets(policy, source);

  assert.deepEqual(first, second);
  assert.ok(first.length > 0);
  assert.ok(first.every((target) => (
    target.platform === 'douyin'
    && target.ratio === '1:1'
    && Number.isInteger(target.width)
    && Number.isInteger(target.height)
    && !Object.hasOwn(target, 'generationSize')
    && !Object.hasOwn(target, 'modelSize')
  )));
  assert.deepEqual(policy, getPlatformPolicy('douyin', 'main', 'all'));
});
