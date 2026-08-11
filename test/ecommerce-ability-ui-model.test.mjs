import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAbilityUploadDeck,
  buildAbilityAssetRoles,
  createAbilityEditorState,
  switchAbilityRecipe,
  withEcommerceCanvasSources,
} from '../src/pages/Home/ec/workbenchState.js';

const image = (assetId, url = `/${assetId}.png`) => ({ assetId, url });

test('try-on upload deck exposes item, person, and scene contracts in visual order', () => {
  const deck = buildAbilityUploadDeck({
    recipeId: 'anything_tryon',
    personMode: 'smart',
    roleImages: {
      items: [image('item-1'), image('item-2')],
      person: [],
      scene: [],
    },
  });

  assert.equal(deck.recipe.id, 'anything_tryon');
  assert.equal(deck.personMode, 'smart');
  assert.deepEqual(deck.slots.map(slot => slot.id), ['items', 'person', 'scene']);
  assert.deepEqual(deck.slots.map(slot => [slot.id, slot.count, slot.max, slot.required]), [
    ['items', 2, 5, true],
    ['person', 0, 1, false],
    ['scene', 0, 1, false],
  ]);
  assert.deepEqual(deck.slots[0].images.map(item => item.assetId), ['item-1', 'item-2']);
  assert.equal(deck.slots[1].accept, 'image/*');
  assert.equal(deck.slots[1].modeOptions[0].id, 'smart');
  assert.equal(deck.slots[1].modeOptions[1].id, 'reference');
});

test('switching from product suite preserves assets and surfaces unmappable references', () => {
  const switched = switchAbilityRecipe({
    nextRecipeId: 'anything_tryon',
    productImages: [image('product-1')],
    refImages: [image('reference-1')],
    currentRoleImages: {},
  });

  assert.deepEqual(switched.roleImages.items.map(item => item.assetId), ['product-1']);
  assert.deepEqual(switched.roleImages.person, []);
  assert.deepEqual(switched.roleImages.scene, []);
  assert.deepEqual(switched.unmappedImages.map(item => item.assetId), ['reference-1']);
  assert.equal(switched.personMode, 'smart');
});

test('switching back to product suite does not destroy try-on materials', () => {
  const switched = switchAbilityRecipe({
    currentRecipeId: 'anything_tryon',
    nextRecipeId: 'product_suite',
    currentRoleImages: {
      items: [image('item-1')],
      person: [image('person-1')],
      scene: [image('scene-1')],
    },
    productImages: [],
    refImages: [],
  });

  assert.deepEqual(switched.productImages.map(item => item.assetId), ['item-1']);
  assert.deepEqual(switched.refImages.map(item => item.assetId), ['person-1', 'scene-1']);
  assert.deepEqual(switched.unmappedImages, []);
});

test('fresh ability editor state keeps the existing product suite as the default', () => {
  assert.deepEqual(createAbilityEditorState(), {
    recipeId: 'product_suite',
    personMode: 'smart',
    roleImages: { items: [], person: [], scene: [] },
    unmappedImages: [],
  });
});

test('Canvas delivery keeps semantic try-on source groups alongside legacy aliases', () => {
  const delivery = withEcommerceCanvasSources({ id: 'delivery-1' }, {
    productAssets: [image('item-1')],
    referenceAssets: [image('scene-1')],
    itemAssets: [image('item-1')],
    personAssets: [image('person-1')],
    sceneAssets: [image('scene-1')],
    abilityRecipe: { id: 'anything_tryon', version: 1 },
    personMode: 'reference',
    assetRoles: [{ assetId: 'item-1', role: 'items', ordinal: 0 }],
  });

  assert.deepEqual(delivery.productAssets.map(item => item.assetId), ['item-1']);
  assert.deepEqual(delivery.referenceAssets.map(item => item.assetId), ['scene-1']);
  assert.deepEqual(delivery.itemAssets.map(item => item.assetId), ['item-1']);
  assert.deepEqual(delivery.personAssets.map(item => item.assetId), ['person-1']);
  assert.deepEqual(delivery.sceneAssets.map(item => item.assetId), ['scene-1']);
  assert.deepEqual(delivery.abilityRecipe, { id: 'anything_tryon', version: 1 });
  assert.equal(delivery.personMode, 'reference');
});

test('ability asset roles are ordered by semantic lane and omit unresolved uploads', () => {
  assert.deepEqual(buildAbilityAssetRoles({
    items: [image('item-1'), { url: '/missing-id.png' }, image('item-2')],
    person: [image('person-1')],
    scene: [image('scene-1')],
  }), [
    { assetId: 'item-1', role: 'items', ordinal: 0 },
    { assetId: 'item-2', role: 'items', ordinal: 1 },
    { assetId: 'person-1', role: 'person', ordinal: 0 },
    { assetId: 'scene-1', role: 'scene', ordinal: 0 },
  ]);
});
