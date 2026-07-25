import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildProductTruthPrompt,
  classifyFactRisk,
  mergeProductFacts,
  normalizeProductTruth,
} from '../server/ecommerceEngine/productTruth.mjs';
import { buildProductTruthPrompt as buildVlmProductTruthPrompt } from '../server/ecommerceEngine/vlmSchema.mjs';

test('prefers user facts over OCR and vision facts', () => {
  const truth = mergeProductFacts({
    vision: { size: '20cm' },
    ocr: { size: '22cm' },
    user: { size: '24cm' },
  });

  assert.deepEqual(truth.confirmedFacts.size, { value: '24cm', source: 'user' });
});

test('uses explicit visible OCR for high-risk facts and marks vision inferences uncertain', () => {
  const truth = mergeProductFacts({
    vision: { quantity: '2-pack' },
    ocr: {
      certification: { value: 'CE', visible: true, confidence: 0.99, sourceAssetId: 'front' },
      size: { value: '22cm', visible: true, confidence: 0.98, sourceAssetId: 'front' },
    },
  });

  assert.deepEqual(truth.confirmedFacts.certification, {
    value: 'CE', source: 'ocr', confidence: 0.99, sourceAssetId: 'front',
  });
  assert.deepEqual(truth.confirmedFacts.size, {
    value: '22cm', source: 'ocr', confidence: 0.98, sourceAssetId: 'front',
  });
  assert.deepEqual(truth.uncertainFacts, [
    { name: 'quantity', value: '2-pack', source: 'vision' },
  ]);
});

test('treats direct OCR text as explicit evidence and blocks direct vision high-risk facts', () => {
  const merged = mergeProductFacts({ vision: { size: '20cm' }, ocr: { size: '22cm' } });
  const normalized = normalizeProductTruth({
    confirmedFacts: {
      size: { value: '20cm', source: 'vision' },
      certification: { value: 'CE', source: 'vision' },
    },
  });

  assert.deepEqual(merged.confirmedFacts.size, { value: '22cm', source: 'ocr' });
  assert.deepEqual(normalized.confirmedFacts, {});
  assert.deepEqual(normalized.uncertainFacts, [
    { name: 'size', value: '20cm', source: 'vision' },
    { name: 'certification', value: 'CE', source: 'vision' },
  ]);
});

test('classifies certification and other regulated facts as deterministic only', () => {
  for (const name of ['certification', 'test report', 'ingredients', 'efficacy', 'quantity', 'dimensions', 'SKU', 'price', 'comparison claim']) {
    assert.equal(classifyFactRisk(name), 'deterministic_only');
  }
  assert.equal(classifyFactRisk('material'), 'visual_ok');
});

test('derives deduplicated forbidden mutations from product identity details', () => {
  const truth = normalizeProductTruth({
    silhouette: 'tapered bottle with an asymmetric cap',
    components: ['USB-C port on the bottom', 'USB-C port on the bottom'],
    packageText: [{ text: 'Brightening Serum', confidence: 0.96, sourceAssetId: 'front' }],
    logos: [{ description: 'circular leaf logo', confidence: 0.91, sourceAssetId: 'front' }],
    confirmedFacts: { shadeLabel: { value: '01 Ivory', source: 'user' } },
  });

  assert.deepEqual(truth.forbiddenMutations, [
    'silhouette: tapered bottle with an asymmetric cap',
    'component: USB-C port on the bottom',
    'package text: Brightening Serum',
    'logo: circular leaf logo',
    'label: 01 Ivory',
  ]);
  assert.deepEqual(truth.packageText, [{ text: 'Brightening Serum', confidence: 0.96, sourceAssetId: 'front' }]);
  assert.deepEqual(truth.logos, [{ description: 'circular leaf logo', confidence: 0.91, sourceAssetId: 'front' }]);
});

test('normalizes defensively without prototype keys and fingerprints equivalent truth deterministically', () => {
  const unsafe = JSON.parse('{"category":" serum ","primaryColors":[" #ffffff ","#ffffff"],"__proto__":{"polluted":true}}');
  const inherited = Object.create({ category: 'inherited category', primaryColors: ['#000000'] });
  inherited.productName = 'Safe Name';
  const first = normalizeProductTruth(unsafe);
  const second = normalizeProductTruth({ category: 'serum', primaryColors: ['#ffffff'] });
  const inheritedTruth = normalizeProductTruth(inherited);

  assert.equal(first.category, 'serum');
  assert.deepEqual(first.primaryColors, ['#ffffff']);
  assert.equal(Object.hasOwn(first, '__proto__'), false);
  assert.equal({}.polluted, undefined);
  assert.equal(inheritedTruth.category, '');
  assert.equal(inheritedTruth.productName, 'Safe Name');
  assert.deepEqual(inheritedTruth.primaryColors, []);
  assert.equal(first.fingerprint, second.fingerprint);

  first.primaryColors.push('#000000');
  assert.deepEqual(second.primaryColors, ['#ffffff']);
  assert.deepEqual(unsafe.primaryColors, [' #ffffff ', '#ffffff']);
});

test('builds a JSON-only product truth prompt that prohibits risky inferred claims', () => {
  const prompt = buildProductTruthPrompt({ sourceAssetIds: ['front', 'side'] });

  assert.equal(prompt.systemPrompt, buildVlmProductTruthPrompt({ sourceAssetIds: ['front', 'side'] }).systemPrompt);
  assert.match(prompt.systemPrompt, /JSON only/i);
  for (const prohibited of ['dimensions', 'certification', 'efficacy', 'quantity', 'ingredients', 'SKU', 'test reports', 'price\/promotion', 'comparison claims']) {
    assert.match(prompt.systemPrompt, new RegExp(prohibited, 'i'));
  }
  assert.match(prompt.systemPrompt, /uncertain/i);
  assert.match(prompt.userPrompt, /2/);
});
