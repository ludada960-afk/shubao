import assert from 'node:assert/strict';
import test from 'node:test';

import {
  applyProductProfileToEditor,
  buildProductProfileMediaState,
  buildProductProfileDraft,
  productProfileReferenceSnapshot,
  productProfileSummary,
} from '../src/pages/Home/ec/productProfileModel.js';

test('builds a reusable profile from the existing ecommerce editor without copying local URLs', () => {
  const draft = buildProductProfileDraft({
    description: '便携水杯',
    platform: '淘宝',
    productParams: { category: '家居', material: '陶瓷', size: '350ml', baseColor: '白色', craft: '磨砂' },
    skus: [{ id: 'local-only', color: '白色', size: '350ml', count: 2 }],
    copywriting: { sellingPoints: '轻便耐热' },
    productImages: [
      { url: 'blob:local-upload', projectAssetRef: { projectId: 'project-1', projectAssetId: 'asset-1', contentHash: 'hash-1' } },
      { url: 'data:image/png;base64,private' },
    ],
    referenceImages: [{ projectAssetRef: { projectId: 'project-1', projectAssetId: 'asset-2', contentHash: 'hash-2' } }],
  });

  assert.equal(draft.name, '便携水杯');
  assert.equal(draft.category, '家居');
  assert.equal(draft.facts.material, '陶瓷');
  assert.equal(draft.facts.dimensions, '350ml');
  assert.equal(draft.facts.sellingPoints, '轻便耐热');
  assert.deepEqual(draft.variants, [{ label: '', color: '白色', spec: '', size: '350ml', capacity: '', dimLabel: '', count: 2 }]);
  assert.deepEqual(draft.assets, [
    { projectId: 'project-1', projectAssetId: 'asset-1', role: 'product', expectedContentHash: 'hash-1' },
    { projectId: 'project-1', projectAssetId: 'asset-2', role: 'reference', expectedContentHash: 'hash-2' },
  ]);
});

test('applies profile facts and variants while preserving generation settings', () => {
  const result = applyProductProfileToEditor({
    profileId: 'profile-1', name: '新水杯', category: '家居',
    facts: { material: '玻璃', dimensions: '500ml', baseColor: '透明' },
    variants: [{ color: '透明', size: '500ml', count: 3 }], assets: [],
  }, {
    description: '旧描述', platform: '抖音', genSettings: { resolution: '4K' },
    productParams: { category: '', material: '', size: '', baseColor: '', accentColor: '', craft: '' },
    skus: [], productImages: [{ url: 'blob:keep-local' }],
  });

  assert.equal(result.description, '新水杯');
  assert.equal(result.platform, '抖音');
  assert.deepEqual(result.productParams, { category: '家居', material: '玻璃', size: '500ml', baseColor: '透明', accentColor: '', craft: '' });
  assert.deepEqual(result.skus, [{ color: '透明', size: '500ml', count: 3 }]);
  assert.deepEqual(result.genSettings, { resolution: '4K' });
  assert.deepEqual(result.productImages, [{ url: 'blob:keep-local' }]);
});

test('summaries and reference snapshots stay compact and canonical', () => {
  const profile = {
    name: '水杯', category: '家居', facts: { material: '玻璃', baseColor: '透明' },
    variants: [{ color: '透明', count: 2 }],
    assets: [{ projectId: 'p1', projectAssetId: 'a1', role: 'product', expectedContentHash: 'h1' }],
  };
  assert.equal(productProfileSummary(profile), '水杯 · 家居 · 玻璃 · 透明 · 1 个变体');
  assert.deepEqual(productProfileReferenceSnapshot(profile), { assets: profile.assets });
});

test('hydrates only hash-matched image assets into reusable ecommerce lanes', () => {
  const media = buildProductProfileMediaState({
    assets: [
      { projectId: 'p1', projectAssetId: 'product-1', role: 'product', expectedContentHash: 'hash-product' },
      { projectId: 'p1', projectAssetId: 'reference-1', role: 'reference', expectedContentHash: 'hash-reference' },
      { projectId: 'p1', projectAssetId: 'person-1', role: 'person', expectedContentHash: 'hash-person' },
      { projectId: 'p1', projectAssetId: 'wrong-hash', role: 'product', expectedContentHash: 'expected' },
    ],
  }, [
    { profileAsset: { projectId: 'p1', projectAssetId: 'product-1', role: 'product', expectedContentHash: 'hash-product' }, asset: { projectAssetId: 'product-1', assetId: 'original-1', contentHash: 'hash-product', stableUrl: '/api/generated-assets/product.webp', mediaKind: 'image' } },
    { profileAsset: { projectId: 'p1', projectAssetId: 'reference-1', role: 'reference', expectedContentHash: 'hash-reference' }, asset: { projectAssetId: 'reference-1', assetId: 'original-2', contentHash: 'hash-reference', stableUrl: '/api/generated-assets/reference.webp', mediaKind: 'image' } },
    { profileAsset: { projectId: 'p1', projectAssetId: 'person-1', role: 'person', expectedContentHash: 'hash-person' }, asset: { projectAssetId: 'person-1', assetId: 'person-1', contentHash: 'hash-person', stableUrl: '/api/video/assets/person-1', mediaKind: 'video' } },
    { profileAsset: { projectId: 'p1', projectAssetId: 'wrong-hash', role: 'product', expectedContentHash: 'expected' }, asset: { projectAssetId: 'wrong-hash', assetId: 'original-3', contentHash: 'actual', stableUrl: '/api/generated-assets/wrong.webp', mediaKind: 'image' } },
  ]);

  assert.equal(media.productImages.length, 1);
  assert.equal(media.referenceImages.length, 1);
  assert.equal(media.roleImages.person.length, 0);
  assert.equal(media.productImages[0].projectAssetRef.expectedContentHash, 'hash-product');
  assert.equal(media.productImages[0].locked, true);
});
