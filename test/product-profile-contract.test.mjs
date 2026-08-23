import test from 'node:test';
import assert from 'node:assert/strict';

import {
  PRODUCT_PROFILE_STATUSES,
  normalizeProductProfileAssetRef,
  normalizeProductProfileInput,
  normalizeProductProfilePatch,
} from '../server/projects/productProfileContract.mjs';

test('normalizes confirmed facts, SKU variants, and canonical asset references', () => {
  const profile = normalizeProductProfileInput({
    name: '  陶瓷杯  ',
    category: '家居',
    facts: { material: '陶瓷', capacity: '350ml', unsafe: 'x'.repeat(5000) },
    variants: [{ color: '白色', spec: '大号', size: '', capacity: '', dimLabel: '', count: 2 }],
    assets: [{ projectId: 'p1', projectAssetId: 'a1', role: 'product', expectedContentHash: 'h1' }],
  });

  assert.equal(profile.name, '陶瓷杯');
  assert.equal(profile.facts.material, '陶瓷');
  assert.equal(profile.variants[0].count, 2);
  assert.deepEqual(profile.assets[0], {
    projectId: 'p1',
    projectAssetId: 'a1',
    role: 'product',
    expectedContentHash: 'h1',
  });
  assert.equal(Object.hasOwn(profile.facts, 'unsafe'), false);
});

test('normalizes legacy SKU field names without inventing product facts', () => {
  const profile = normalizeProductProfileInput({
    name: '耳机',
    variants: [{ color: '黑色', spec: 'Pro', size: 'L', capacity: '', dimLabel: '大号', count: '3', label: '经典款' }],
  });

  assert.deepEqual(profile.variants, [{
    label: '经典款', color: '黑色', spec: 'Pro', size: 'L', capacity: '', dimLabel: '大号', count: 3,
  }]);
  assert.deepEqual(profile.facts, {});
});

test('rejects incomplete or invalid canonical asset references', () => {
  assert.throws(
    () => normalizeProductProfileAssetRef({ projectId: '', projectAssetId: 'a1', role: 'product', expectedContentHash: 'h1' }),
    error => error?.code === 'PRODUCT_PROFILE_ASSET_REF_INVALID' && /projectId/.test(error.message),
  );
  assert.throws(
    () => normalizeProductProfileAssetRef({ projectId: 'p1', projectAssetId: 'a1', role: 'unknown', expectedContentHash: 'h1' }),
    error => error?.code === 'PRODUCT_PROFILE_ASSET_REF_INVALID' && /role/.test(error.message),
  );
  assert.throws(
    () => normalizeProductProfileAssetRef({ projectId: 'p1', projectAssetId: 'a1', role: 'product', expectedContentHash: '' }),
    error => error?.code === 'PRODUCT_PROFILE_ASSET_REF_INVALID' && /expectedContentHash/.test(error.message),
  );
});

test('patch accepts only editable profile fields and known statuses', () => {
  const patch = normalizeProductProfilePatch({
    name: '新名称',
    facts: { material: '玻璃' },
    variants: [],
    assets: [],
    status: 'archived',
  });
  assert.deepEqual(patch, {
    name: '新名称',
    facts: { material: '玻璃' },
    variants: [],
    assets: [],
    status: 'archived',
  });
  assert.deepEqual(PRODUCT_PROFILE_STATUSES, ['active', 'archived']);
  assert.throws(() => normalizeProductProfilePatch({ status: 'deleted' }), /status/);
});

test('normalization removes duplicate variants and asset references deterministically', () => {
  const profile = normalizeProductProfileInput({
    name: '商品',
    variants: [
      { color: '红', spec: '标准', count: 1 },
      { color: '红', spec: '标准', count: 1 },
    ],
    assets: [
      { projectId: 'p1', projectAssetId: 'a1', role: 'product', expectedContentHash: 'h1' },
      { projectId: 'p1', projectAssetId: 'a1', role: 'product', expectedContentHash: 'h1' },
    ],
  });
  assert.equal(profile.variants.length, 1);
  assert.equal(profile.assets.length, 1);
});
