import assert from 'node:assert/strict';
import test from 'node:test';

import {
  applyProductProfileToEcState,
  buildProductProfileSaveRequest,
  profileStatusLabel,
} from '../src/pages/Home/ec/productProfileShelfModel.js';

test('builds an idempotent profile save request from the current ecommerce editor', () => {
  const request = buildProductProfileSaveRequest({
    draftId: 'draft-1',
    editor: {
      description: '保温杯',
      productParams: { category: '家居', material: '不锈钢' },
      skus: [{ color: '黑色', count: 1 }],
      copywriting: { sellingPoints: '保温' },
    },
  });
  assert.equal(request.idempotencyKey, 'product-profile:draft-1:保温杯');
  assert.equal(request.name, '保温杯');
  assert.equal(request.facts.material, '不锈钢');
  assert.equal(request.variants[0].color, '黑色');
  assert.equal(request.assets.length, 0);
});

test('applies only durable profile editor fields and preserves current media and settings', () => {
  const result = applyProductProfileToEcState({
    name: '玻璃杯', category: '家居', facts: { material: '玻璃', dimensions: '500ml' },
    variants: [{ color: '透明', count: 2 }], assets: [],
  }, {
    description: '旧商品', platform: '抖音', genSettings: { resolution: '4K' },
    productParams: { category: '', material: '', size: '', baseColor: '', accentColor: '', craft: '' },
    skus: [], copywriting: { plan: '保留', sellingPoints: '' },
    productImages: [{ url: 'blob:current' }], referenceImages: [{ url: 'blob:reference' }],
  });
  assert.equal(result.description, '玻璃杯');
  assert.equal(result.platform, '抖音');
  assert.equal(result.productParams.material, '玻璃');
  assert.equal(result.productParams.size, '500ml');
  assert.equal(result.skus[0].color, '透明');
  assert.equal(result.copywriting.plan, '保留');
  assert.deepEqual(result.productImages, [{ url: 'blob:current' }]);
  assert.deepEqual(result.referenceImages, [{ url: 'blob:reference' }]);
  assert.deepEqual(result.genSettings, { resolution: '4K' });
});

test('uses concise user-facing profile status labels', () => {
  assert.equal(profileStatusLabel('active'), '使用中');
  assert.equal(profileStatusLabel('archived'), '已归档');
  assert.equal(profileStatusLabel('unknown'), '状态未知');
});
