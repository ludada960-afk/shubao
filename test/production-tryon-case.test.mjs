import assert from 'node:assert/strict';
import test from 'node:test';

import {
  productionTryOnDirectionPayload,
  productionTryOnGenerationPayload,
} from '../scripts/generate-production-tryon-case.mjs';
import { readFileSync } from 'node:fs';

const item = { assetId: `${'1'.repeat(64)}.png`, url: '/api/ecommerce-assets/item' };
const person = { assetId: `${'2'.repeat(64)}.png`, url: '/api/ecommerce-assets/person' };

test('production try-on analysis keeps item and person in separate semantic lanes', () => {
  const payload = productionTryOnDirectionPayload({ item, person });
  assert.equal(payload.ability_recipe.id, 'anything_tryon');
  assert.equal(payload.person_mode, 'reference');
  assert.deepEqual(payload.items, [item.url]);
  assert.deepEqual(payload.person, [person.url]);
  assert.deepEqual(payload.scene, []);
  assert.equal(payload.requested_images[0].count, 1);
});

test('production try-on generation preserves role manifest and requests one 3:4 result', () => {
  const payload = productionTryOnGenerationPayload({ item, person, direction: { id: 'city-look' }, quoteId: 'quote-1' });
  assert.deepEqual(payload.assets, { items: [item], person: [person], scene: [] });
  assert.deepEqual(payload.asset_roles, [
    { assetId: item.assetId, role: 'items', ordinal: 0 },
    { assetId: person.assetId, role: 'person', ordinal: 0 },
  ]);
  assert.equal(payload.sizing.images[0].ratio, '3:4');
  assert.equal(payload.sizing.images[0].count, 1);
  assert.equal(payload.billing_quote_id, 'quote-1');
});

test('production try-on supports a smart fictional model without a person asset', () => {
  const payload = productionTryOnGenerationPayload({
    item,
    person: null,
    personMode: 'smart',
    direction: { id: 'smart-editorial' },
    quoteId: 'quote-smart',
    productName: '都市编辑穿搭',
    brief: '创建全新的虚构成年模特，完整展示穿搭。',
  });

  assert.equal(payload.person_mode, 'smart');
  assert.deepEqual(payload.assets.person, []);
  assert.deepEqual(payload.asset_roles, [{ assetId: item.assetId, role: 'items', ordinal: 0 }]);
  assert.match(payload.selling_points, /虚构成年模特/);
});

test('production try-on submission is protected by a stable idempotency key', () => {
  const source = readFileSync(new URL('../scripts/generate-production-tryon-case.mjs', import.meta.url), 'utf8');
  assert.match(source, /submissionId: overrides\.submissionId \|\| process\.env\.SHUBAO_TRYON_SUBMISSION_ID/);
  assert.match(source, /'idempotency-key': config\.submissionId/);
  assert.match(source, /SHUBAO_TRYON_ITEM_FIXTURE/);
  assert.match(source, /SHUBAO_TRYON_PERSON_FIXTURE/);
});

test('production try-on payload can identify a new uncropped source case without replaying the old product', () => {
  const productName = '完整赤陶夹克穿搭 20260814';
  assert.equal(productionTryOnDirectionPayload({ item, person, productName }).product_name, productName);
  assert.equal(productionTryOnGenerationPayload({ item, person, direction: {}, quoteId: 'quote-2', productName }).product_name, productName);
});

test('production try-on payload accepts a native output ratio and a case-specific brief', () => {
  const item = { assetId: 'item-fashion', url: '/api/ecommerce/assets/item-fashion' };
  const person = { assetId: 'person-fashion', url: '/api/ecommerce/assets/person-fashion' };
  const payload = productionTryOnGenerationPayload({
    item,
    person,
    direction: { id: 'fashion-direction' },
    quoteId: 'quote-fashion',
    productName: '都市时装多视角',
    ratio: '16:9',
    brief: '同一模特展示正面、侧面、背面与动态步态，完整保留服饰。',
  });

  assert.equal(payload.sizing.images[0].ratio, '16:9');
  assert.equal(payload.sizing.images[0].targetRatio, '16:9');
  assert.match(payload.direction.editableBrief, /正面、侧面、背面/);
});

test('production try-on can request four independent editorial deliverables', () => {
  const shots = [
    { id: 'front', label: '正面街拍', ratio: '3:4', brief: '完整正面全身' },
    { id: 'three-quarter', label: '四分之三街拍', ratio: '3:4', brief: '完整四分之三全身' },
    { id: 'side', label: '侧面街拍', ratio: '3:4', brief: '完整侧面全身' },
    { id: 'back', label: '背面街拍', ratio: '3:4', brief: '完整背面全身' },
  ];
  const direction = productionTryOnDirectionPayload({ item, person: null, personMode: 'smart', shots });
  const generation = productionTryOnGenerationPayload({
    item,
    person: null,
    personMode: 'smart',
    direction: { id: 'editorial-angles' },
    quoteId: 'quote-angles',
    shots,
  });

  assert.deepEqual(direction.requested_images.map(image => image.key), shots.map(shot => shot.id));
  assert.deepEqual(generation.sizing.images.map(image => image.id), shots.map(shot => shot.id));
  assert.ok(generation.sizing.images.every(image => image.count === 1 && image.cropPolicy === 'none'));
});
