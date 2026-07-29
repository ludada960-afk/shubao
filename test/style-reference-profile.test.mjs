import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildStyleReferencePrompt,
  normalizeStyleReferenceProfile,
} from '../server/ecommerceEngine/styleReferenceProfile.mjs';

test('style analysis transfers visual language but blocks reference facts', () => {
  const profile = normalizeStyleReferenceProfile({
    palette: [' #fff4e8 ', '#fff4e8'],
    lighting: 'soft window light',
    referenceProduct: 'competitor bottle',
    people: ['reference model'],
    logos: ['Other Brand'],
    visibleText: ['500ml'],
    price: '$19',
    source_asset_ids: [' style-front ', 'style-front'],
    confidence: 0.91,
  });

  assert.deepEqual(profile.palette, ['#fff4e8']);
  assert.equal(profile.lighting, 'soft window light');
  assert.deepEqual(profile.sourceAssetIds, ['style-front']);
  assert.equal(profile.confidence, 0.91);
  for (const transfer of [
    'reference products',
    'people identities',
    'brands',
    'logos',
    'prices',
    'claims',
    'parameters',
    'certifications',
    'source copy',
  ]) {
    assert.ok(profile.prohibitedTransfers.includes(transfer));
  }
  for (const blocked of ['referenceProduct', 'people', 'logos', 'visibleText', 'price']) {
    assert.equal(Object.hasOwn(profile, blocked), false);
  }
});

test('normalizes only transferable style fields without inherited or prototype keys', () => {
  const input = Object.create({ mood: 'inherited mood', palette: ['#000000'] });
  input.camera_language = ' macro detail ';
  input.typography_intent = ' quiet editorial ';
  input.information_density = ' low ';
  input.background_language = ' warm seamless paper ';
  input.composition = ' centered hero ';
  input.__protoPollution = 'ignored';

  const first = normalizeStyleReferenceProfile(input);
  const second = normalizeStyleReferenceProfile(input);
  first.palette.push('#ffffff');

  assert.equal(first.mood, '');
  assert.deepEqual(second.palette, []);
  assert.equal(second.cameraLanguage, 'macro detail');
  assert.equal(second.typographyIntent, 'quiet editorial');
  assert.equal(second.informationDensity, 'low');
  assert.equal(second.backgroundLanguage, 'warm seamless paper');
  assert.equal(second.composition, 'centered hero');
  assert.equal(Object.hasOwn(second, '__protoPollution'), false);
  assert.equal({}.polluted, undefined);
});

test('builds a JSON-only style prompt that explicitly prohibits factual transfer', () => {
  const prompt = buildStyleReferencePrompt({ sourceAssetIds: ['style-front', 'style-side'] });

  assert.match(prompt.systemPrompt, /JSON only/i);
  for (const allowed of [
    'palette',
    'lighting',
    'composition',
    'camera language',
    'typography intent',
    'information density',
    'background language',
    'mood',
  ]) {
    assert.match(prompt.systemPrompt, new RegExp(allowed, 'i'));
  }
  for (const prohibited of [
    'products',
    'people identities',
    'brands',
    'logos',
    'prices',
    'claims',
    'parameters',
    'certifications',
    'source copy',
  ]) {
    assert.match(prompt.systemPrompt, new RegExp(prohibited, 'i'));
  }
  assert.match(prompt.userPrompt, /style-front, style-side/);
});
