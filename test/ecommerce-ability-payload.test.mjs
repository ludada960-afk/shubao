import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeEcommerceAbilityPayload } from '../server/ecommerceEngine/abilityPayload.mjs';

function asset(id, role) {
  return { assetId: id, url: `/api/generated-assets/${id}.png`, role };
}

test('normalizes anything_tryon into versioned semantic groups without losing backward-compatible product inputs', () => {
  const payload = normalizeEcommerceAbilityPayload({
    product_name: '春季穿搭',
    ability_recipe: { id: 'anything_tryon', version: 1 },
    person_mode: 'reference',
    assets: {
      items: [asset('item-jacket', 'product'), asset('item-bag', 'product')],
      person: [asset('person-model', 'person')],
      scene: [asset('scene-street', 'scene')],
    },
    asset_roles: [
      { assetId: 'item-jacket', role: 'items', ordinal: 0 },
      { assetId: 'item-bag', role: 'items', ordinal: 1 },
      { assetId: 'person-model', role: 'person', ordinal: 0 },
      { assetId: 'scene-street', role: 'scene', ordinal: 0 },
    ],
  });

  assert.deepEqual(payload.ability_recipe, { id: 'anything_tryon', version: 1 });
  assert.equal(payload.person_mode, 'reference');
  assert.deepEqual(payload.asset_roles, [
    { assetId: 'item-jacket', role: 'items', ordinal: 0 },
    { assetId: 'item-bag', role: 'items', ordinal: 1 },
    { assetId: 'person-model', role: 'person', ordinal: 0 },
    { assetId: 'scene-street', role: 'scene', ordinal: 0 },
  ]);
  assert.deepEqual(payload.assets.items.map(({ assetId }) => assetId), ['item-jacket', 'item-bag']);
  assert.deepEqual(payload.assets.person.map(({ assetId }) => assetId), ['person-model']);
  assert.deepEqual(payload.assets.scene.map(({ assetId }) => assetId), ['scene-street']);
  assert.deepEqual(payload.assets.product.map(({ assetId }) => assetId), ['item-jacket', 'item-bag']);
  assert.deepEqual(payload.assets.reference, []);
});

test('rejects try-on requests before billing when item input is missing or a role is ambiguous', () => {
  assert.throws(
    () => normalizeEcommerceAbilityPayload({
      product_name: '无商品穿搭',
      ability_recipe: { id: 'anything_tryon', version: 1 },
      assets: { person: [asset('person-only', 'person')] },
    }),
    error => error?.status === 400 && error?.code === 'ECOMMERCE_ABILITY_INVALID',
  );

  assert.throws(
    () => normalizeEcommerceAbilityPayload({
      product_name: '角色混用',
      ability_recipe: { id: 'anything_tryon', version: 1 },
      assets: {
        items: [asset('item-one', 'product')],
        reference: [asset('ambiguous-reference', 'reference')],
      },
    }),
    error => error?.status === 400 && error?.code === 'ECOMMERCE_ABILITY_INVALID',
  );
});

test('leaves legacy ecommerce payloads byte-for-byte compatible at the boundary', () => {
  const payload = {
    product_name: '旧商品',
    assets: {
      product: [asset('product-one', 'product')],
      reference: [asset('reference-one', 'reference')],
    },
  };
  assert.deepEqual(normalizeEcommerceAbilityPayload(payload), payload);
});
