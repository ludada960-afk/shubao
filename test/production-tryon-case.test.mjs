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

test('production try-on submission is protected by a stable idempotency key', () => {
  const source = readFileSync(new URL('../scripts/generate-production-tryon-case.mjs', import.meta.url), 'utf8');
  assert.match(source, /const SUBMISSION_ID = 'ec_production_tryon_reference_20260813'/);
  assert.match(source, /'idempotency-key': SUBMISSION_ID/);
});
