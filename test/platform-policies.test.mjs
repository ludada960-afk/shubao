import test from 'node:test';
import assert from 'node:assert/strict';

import {
  EXPORT_TARGET_VERSION,
  PLATFORM_POLICY_REGISTRY_VERSION,
  getPlatformPolicy,
  planExportTargets,
  verifyVersionedExportTarget,
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

test('ignores inherited policy fields while planning export targets', () => {
  const policy = Object.create({
    platform: 'inherited-platform',
    categoryScope: 'inherited-category',
    role: 'inherited-role',
    allowedRatios: ['9:16'],
    exportSizes: [{ width: 900, height: 1600 }],
    formats: ['webp'],
    maxFileBytes: 1,
    sourceUrl: 'https://inherited.example/',
    confidence: 'high',
    enforcement: 'hard',
  });

  const [target] = planExportTargets(policy, { generationSize: '2048x2048' });
  assert.deepEqual({
    platform: target.platform,
    categoryScope: target.categoryScope,
    role: target.role,
    ratio: target.ratio,
    width: target.width,
    height: target.height,
    format: target.format,
    maxFileBytes: target.maxFileBytes,
    fit: target.fit,
  }, {
    platform: 'unknown',
    categoryScope: 'all',
    role: 'all',
    ratio: '1:1',
    width: 800,
    height: 800,
    format: 'jpg',
    maxFileBytes: 5_000_000,
    fit: 'inside',
  });
  assert.equal(target.targetVersion, EXPORT_TARGET_VERSION);
  assert.equal(verifyVersionedExportTarget(target), true);
});

test('layers a category policy over the selected role policy', () => {
  const rolePolicy = getPlatformPolicy('taobao', 'main', 'all');
  const categoryPolicy = getPlatformPolicy('taobao', 'main', 'beauty');

  assert.deepEqual(categoryPolicy.allowedRatios, rolePolicy.allowedRatios);
  assert.deepEqual(categoryPolicy.exportSizes, rolePolicy.exportSizes);
  assert.deepEqual(categoryPolicy.formats, rolePolicy.formats);
  assert.equal(categoryPolicy.maxFileBytes, rolePolicy.maxFileBytes);
  assert.equal(categoryPolicy.textPolicy, rolePolicy.textPolicy);
  assert.match(categoryPolicy.backgroundPolicy, /beauty-category/);
  assert.deepEqual(categoryPolicy.requiredFacts, ['product identity', 'user-confirmed shade or variant']);
});

test('requires own generation inputs and ignores inherited role, category, and ratio', () => {
  const prototypeOnlyGeneration = Object.create({
    generationSize: '2048x2048',
    size: '2048x2048',
    ratio: '1:1',
    role: 'detail',
    category: 'beauty',
  });
  const inheritedSizeOnly = Object.create({ size: '2048x2048' });

  assert.throws(
    () => planExportTargets('taobao', prototypeOnlyGeneration),
    /generationSize must be a legal WIDTHxHEIGHT string/,
  );
  assert.throws(
    () => planExportTargets('taobao', inheritedSizeOnly),
    /generationSize must be a legal WIDTHxHEIGHT string/,
  );

  const generation = Object.create({ ratio: '9:16', role: 'detail', category: 'beauty' });
  generation.generationSize = '2048x2048';

  const targets = planExportTargets('taobao', generation);
  assert.ok(targets.every((target) => (
    target.role === 'main'
    && target.categoryScope === 'all'
    && target.ratio === '1:1'
  )));
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
    && /^et_[a-f0-9]{64}$/.test(target.targetId)
    && verifyVersionedExportTarget(target)
    && Number.isInteger(target.width)
    && Number.isInteger(target.height)
    && !Object.hasOwn(target, 'generationSize')
    && !Object.hasOwn(target, 'modelSize')
  )));
  assert.deepEqual(policy, getPlatformPolicy('douyin', 'main', 'all'));
});
