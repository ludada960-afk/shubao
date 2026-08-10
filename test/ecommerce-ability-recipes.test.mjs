import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ECOMMERCE_ABILITY_RECIPES,
  getEcommerceAbilityRecipe,
  normalizeEcommerceAbilityRequest,
} from '../shared/ecommerceAbilityRecipes.mjs';

test('legacy request normalizes to product_suite without changing product/reference semantics', () => {
  const normalized = normalizeEcommerceAbilityRequest({
    assets: {
      product: [{ assetId: 'p1', url: '/p1.png' }],
      reference: [{ assetId: 'r1', url: '/r1.png' }],
    },
  });

  assert.equal(normalized.recipe.id, 'product_suite');
  assert.equal(normalized.recipe.version, 1);
  assert.deepEqual(normalized.assetRoles, [
    { assetId: 'p1', role: 'product', ordinal: 0 },
    { assetId: 'r1', role: 'reference', ordinal: 0 },
  ]);
  assert.deepEqual(normalized.slotAssets.product.map(asset => asset.assetId), ['p1']);
  assert.deepEqual(normalized.slotAssets.reference.map(asset => asset.assetId), ['r1']);
});

test('anything_tryon keeps items, person, and scene as separate semantic roles', () => {
  const normalized = normalizeEcommerceAbilityRequest({
    ability_recipe: { id: 'anything_tryon', version: 1 },
    asset_roles: [
      { assetId: 'scene-1', role: 'scene', ordinal: 0 },
      { assetId: 'item-2', role: 'items', ordinal: 1 },
      { assetId: 'person-1', role: 'person', ordinal: 0 },
      { assetId: 'item-1', role: 'items', ordinal: 0 },
    ],
    assets: {
      product: [
        { assetId: 'item-2', url: '/item-2.png' },
        { assetId: 'item-1', url: '/item-1.png' },
      ],
      person: [{ assetId: 'person-1', url: '/person.png' }],
      scene: [{ assetId: 'scene-1', url: '/scene.png' }],
    },
  });

  assert.equal(normalized.recipe.id, 'anything_tryon');
  assert.equal(normalized.personMode, 'reference');
  assert.deepEqual(normalized.slotAssets.items.map(asset => asset.assetId), ['item-1', 'item-2']);
  assert.deepEqual(normalized.slotAssets.person.map(asset => asset.assetId), ['person-1']);
  assert.deepEqual(normalized.slotAssets.scene.map(asset => asset.assetId), ['scene-1']);
  assert.deepEqual(normalized.assetRoles, [
    { assetId: 'item-1', role: 'items', ordinal: 0 },
    { assetId: 'item-2', role: 'items', ordinal: 1 },
    { assetId: 'person-1', role: 'person', ordinal: 0 },
    { assetId: 'scene-1', role: 'scene', ordinal: 0 },
  ]);
});

test('anything_tryon can use a smart model without a person asset', () => {
  const normalized = normalizeEcommerceAbilityRequest({
    ability_recipe: { id: 'anything_tryon', version: 1 },
    person_mode: 'smart',
    assets: { product: [{ assetId: 'item-1', url: '/item.png' }] },
  });

  assert.equal(normalized.personMode, 'smart');
  assert.deepEqual(normalized.slotAssets.person, []);
  assert.deepEqual(normalized.assetRoles, [
    { assetId: 'item-1', role: 'items', ordinal: 0 },
  ]);
});

test('unknown recipes and unsupported versions fail closed', () => {
  assert.throws(
    () => getEcommerceAbilityRecipe('does-not-exist'),
    /unknown ecommerce ability recipe/i,
  );
  assert.throws(
    () => getEcommerceAbilityRecipe('anything_tryon', 99),
    /unsupported ecommerce ability recipe version/i,
  );
});

test('invalid roles, duplicate assets, missing required items, and slot overflow fail before generation', () => {
  const cases = [
    [
      'unknown role',
      {
        ability_recipe: { id: 'anything_tryon', version: 1 },
        asset_roles: [{ assetId: 'item-1', role: 'not-a-slot', ordinal: 0 }],
        assets: { product: [{ assetId: 'item-1' }] },
      },
      /asset role is not allowed/i,
    ],
    [
      'duplicate id',
      {
        ability_recipe: { id: 'anything_tryon', version: 1 },
        assets: {
          product: [{ assetId: 'same' }],
          person: [{ assetId: 'same' }],
        },
      },
      /duplicate asset id/i,
    ],
    [
      'missing item',
      {
        ability_recipe: { id: 'anything_tryon', version: 1 },
        person_mode: 'smart',
        assets: { product: [] },
      },
      /requires at least 1 asset in items/i,
    ],
    [
      'too many people',
      {
        ability_recipe: { id: 'anything_tryon', version: 1 },
        assets: {
          product: [{ assetId: 'item-1' }],
          person: [{ assetId: 'person-1' }, { assetId: 'person-2' }],
        },
      },
      /allows at most 1 asset in person/i,
    ],
  ];

  for (const [label, input, pattern] of cases) {
    assert.throws(() => normalizeEcommerceAbilityRequest(input), pattern, label);
  }
});

test('recipe metadata is immutable and exposes the two initial choices in product order', () => {
  assert.deepEqual(ECOMMERCE_ABILITY_RECIPES.map(recipe => recipe.id), [
    'product_suite',
    'anything_tryon',
  ]);
  assert.throws(() => {
    ECOMMERCE_ABILITY_RECIPES[0].label = 'changed';
  }, TypeError);
  assert.deepEqual(getEcommerceAbilityRecipe('anything_tryon').inputSlots.map(slot => slot.id), [
    'items',
    'person',
    'scene',
  ]);
});
