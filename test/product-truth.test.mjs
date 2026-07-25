import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildProductTruthPrompt,
  classifyFactRisk,
  mergeProductFacts,
  normalizeProductTruth,
} from '../server/ecommerceEngine/productTruth.mjs';
import {
  buildProductTruthPrompt as buildVlmProductTruthPrompt,
  buildVlmPrompt,
  parseRealShot,
  parseStyleRef,
} from '../server/ecommerceEngine/vlmSchema.mjs';

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
  for (const name of [
    'certification', 'test report', 'ingredients', 'efficacy', 'quantity', 'dimensions',
    'SKU', 'price', 'comparison claim', 'volume', 'capacity', 'net weight', 'weight', 'model',
    '容量', '净含量', '重量', '尺寸', '规格', '型号', '认证', '成分', '功效', '数量', '对比', '检测报告',
    'unknownVendorFact',
  ]) {
    assert.equal(classifyFactRisk(name), 'deterministic_only');
  }
  for (const name of ['material', 'color', 'shape', 'texture', 'component']) {
    assert.equal(classifyFactRisk(name), 'visual_ok');
  }
});

test('keeps English and Chinese vision capacity facts uncertain', () => {
  const truth = mergeProductFacts({ vision: { volume: '500ml', 容量: '500ml' } });

  assert.deepEqual(truth.confirmedFacts, {});
  assert.deepEqual(truth.uncertainFacts, [
    { name: 'volume', value: '500ml', source: 'vision' },
    { name: '容量', value: '500ml', source: 'vision' },
  ]);
});

test('gates SKU facts by source and propagates their asset IDs', () => {
  const truth = mergeProductFacts({
    vision: {
      sku_facts: {
        model: { value: 'Vision-X', confidence: 0.61, source_asset_id: 'vision-side' },
      },
    },
    ocr: {
      sku_facts: {
        capacity: { value: '500ml', visible: true, confidence: 0.97, source_asset_id: 'ocr-front' },
      },
    },
    user: {
      sku_facts: {
        colorCode: { value: 'BLK-01', source_asset_id: 'user-spec' },
      },
    },
  });

  assert.deepEqual(truth.skuFacts, {
    colorCode: { value: 'BLK-01', source: 'user', sourceAssetId: 'user-spec' },
    capacity: { value: '500ml', source: 'ocr', confidence: 0.97, sourceAssetId: 'ocr-front' },
  });
  assert.deepEqual(truth.confirmedFacts.colorCode, truth.skuFacts.colorCode);
  assert.deepEqual(truth.confirmedFacts.capacity, truth.skuFacts.capacity);
  assert.deepEqual(truth.uncertainFacts, [
    { name: 'model', value: 'Vision-X', source: 'vision', confidence: 0.61, sourceAssetId: 'vision-side' },
  ]);
  assert.deepEqual(truth.sourceAssetIds, ['user-spec', 'ocr-front', 'vision-side']);
});

test('normalizes snake-case Product Truth fields before fact collection', () => {
  const truth = mergeProductFacts({
    vision: {
      product_name: 'Bottle',
      primary_colors: [' blue '],
      package_text: [{ text: 'Fresh', source_asset_id: 'front' }],
      source_asset_ids: ['side'],
    },
  });

  assert.equal(truth.productName, 'Bottle');
  assert.deepEqual(truth.primaryColors, ['blue']);
  assert.deepEqual(truth.packageText, [{ text: 'Fresh', sourceAssetId: 'front' }]);
  assert.deepEqual(truth.sourceAssetIds, ['side', 'front']);
  assert.equal(Object.hasOwn(truth.confirmedFacts, 'product_name'), false);
  assert.equal(Object.hasOwn(truth.confirmedFacts, 'primary_colors'), false);
  assert.equal(Object.hasOwn(truth.confirmedFacts, 'package_text'), false);
  assert.equal(Object.hasOwn(truth.confirmedFacts, 'source_asset_ids'), false);
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

test('rejects trimmed dangerous keys and keeps normalized maps prototype safe', () => {
  const unsafe = JSON.parse(`{
    "confirmed_facts": {
      " __proto__ ": {"value":"polluted","source":"user"},
      " constructor ": {"value":"polluted","source":"user"},
      " prototype ": {"value":"polluted","source":"user"},
      " safeLabel ": {"value":"A","source":"user"}
    }
  }`);
  const truth = normalizeProductTruth(unsafe);

  assert.deepEqual(truth.confirmedFacts, { safeLabel: { value: 'A', source: 'user' } });
  assert.equal({}.polluted, undefined);
});

test('fingerprints equivalent objects without locale-dependent comparison', () => {
  const originalLocaleCompare = String.prototype.localeCompare;
  String.prototype.localeCompare = () => { throw new Error('localeCompare must not be used'); };
  try {
    const first = normalizeProductTruth({
      confirmedFacts: {
        zeta: { value: '2', source: 'user' },
        alpha: { value: '1', source: 'user' },
      },
    });
    const second = normalizeProductTruth({
      confirmed_facts: {
        alpha: { value: '1', source: 'user' },
        zeta: { value: '2', source: 'user' },
      },
    });
    assert.equal(first.fingerprint, second.fingerprint);
  } finally {
    String.prototype.localeCompare = originalLocaleCompare;
  }
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

test('preserves existing real-shot and style VLM prompt and parser behavior', () => {
  const realPrompt = buildVlmPrompt('real_shot', ['front']);
  const stylePrompt = buildVlmPrompt('style_ref', ['reference']);
  const real = parseRealShot({
    product: { shape: 'round', dominant_colors: ['#fff'], dimensions_hint: 'legacy hint' },
    quality: { suitability: 0.9 },
  });
  const style = parseStyleRef({
    visual_treatment: {
      lighting: { type: 'window' },
      color_palette: { dominant: ['#111'] },
    },
  });

  assert.match(realPrompt.systemPrompt, /e-commerce product image analysis expert/i);
  assert.match(realPrompt.systemPrompt, /dimensionsHint/);
  assert.match(stylePrompt.systemPrompt, /photography style analyst/i);
  assert.match(stylePrompt.systemPrompt, /transferWeights/);
  assert.equal(real.product.shape, 'round');
  assert.deepEqual(real.product.dominantColors, ['#fff']);
  assert.equal(real.product.dimensionsHint, 'legacy hint');
  assert.equal(style.visualTreatment.lighting.type, 'window');
  assert.deepEqual(style.visualTreatment.colorPalette.dominant, ['#111']);
});
