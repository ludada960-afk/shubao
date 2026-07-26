import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { compileAssetRequest } from '../server/ecommerceEngine/promptCompiler.mjs';

function productTruth(overrides = {}) {
  return {
    category: 'beauty',
    productName: 'Aurora Serum',
    silhouette: 'tapered frosted-glass bottle with a silver pump',
    primaryColors: ['pearl white', 'silver'],
    materials: ['frosted glass', 'brushed aluminum'],
    components: ['silver pump', 'clear cap'],
    confirmedFacts: {
      color: { value: 'pearl white', source: 'user' },
      capacity: { value: '30 ml', source: 'user' },
      price: { value: '¥199', source: 'user' },
      certification: { value: 'TEST-2026-88', source: 'ocr', sourceAssetId: 'proof-report' },
    },
    uncertainFacts: [
      { name: 'efficacy', value: 'repairs skin in seven days', source: 'vision' },
      { name: 'ingredients', value: 'retinol', source: 'vision' },
    ],
    forbiddenMutations: [
      'silhouette: tapered frosted-glass bottle with a silver pump',
      'logo: circular aurora mark',
      'package text: 极光精华',
    ],
    sourceAssetIds: ['product-front', 'product-side'],
    ...overrides,
  };
}

function campaignBible(overrides = {}) {
  return {
    directionId: 'quiet-luxury',
    title: 'Quiet luxury',
    editableBrief: 'Keep the product dominant and leave restrained copy space.',
    commercialObjective: 'premium conversion',
    audience: 'ingredient-conscious skincare buyers',
    visualKeywords: ['editorial', 'precise', 'calm'],
    palette: ['#f4f0e8', '#9ea6ad'],
    lighting: 'large diffused key light with a narrow silver rim light',
    composition: 'centered three-quarter hero with generous negative space',
    backgroundLanguage: 'warm mineral surface with a soft tonal gradient',
    typographyIntent: 'quiet editorial hierarchy',
    copyTone: 'restrained and factual',
    consistencyLocks: ['palette', 'soft shadow direction'],
    prohibitedStyles: ['neon cyberpunk', 'busy collage'],
    referenceAssetIds: ['style-editorial', 'style-lighting'],
    confirmed: true,
    ...overrides,
  };
}

function assetPlanItem(overrides = {}) {
  return {
    id: 'main-3x4',
    role: 'main_3x4',
    purpose: 'Create the representative campaign image while preserving the real product identity.',
    ratio: '3:4',
    generationSize: '1536x2048',
    exportTargets: [{
      platform: 'taobao',
      categoryScope: 'beauty',
      role: 'main',
      ratio: '1:1',
      width: 800,
      height: 800,
      format: 'jpg',
      maxFileBytes: 5_000_000,
      fit: 'cover',
    }],
    generationMode: 'edit',
    productAssetIds: ['product-front', 'product-side'],
    styleReferenceIds: ['style-editorial', 'style-lighting'],
    proofAssetIds: [],
    requiredFacts: [
      { name: 'productName', value: 'Aurora Serum' },
      { name: 'color', value: 'pearl white' },
    ],
    riskLevel: 'high',
    qualityChecks: ['technical_dimensions', 'product_fidelity', 'platform_compliance'],
    ...overrides,
  };
}

function asset(assetId, extra = {}) {
  return { assetId, url: `/assets/${assetId}.png`, ...extra };
}

function parseStructuredPrompt(prompt) {
  const newline = prompt.indexOf('\n');
  assert.ok(newline > 0, 'prompt must start with a ratio-first instruction');
  return {
    ratioLine: prompt.slice(0, newline),
    schema: JSON.parse(prompt.slice(newline + 1)),
  };
}

test('ranks indexed multipart assets deterministically with product before style before proof and a ten-image cap', () => {
  const item = assetPlanItem({
    productAssetIds: ['product-3', 'product-1', 'product-6', 'product-2', 'product-5', 'product-4'],
    styleReferenceIds: ['style-3', 'style-1', 'style-4', 'style-2'],
    proofAssetIds: ['proof-2', 'proof-1', 'proof-3'],
  });
  const assets = {
    product: ['product-1', 'product-2', 'product-3', 'product-4', 'product-5', 'product-6']
      .map((id) => asset(id)),
    reference: ['style-1', 'style-2', 'style-3', 'style-4'].map((id) => asset(id)),
    proof: ['proof-1', 'proof-2', 'proof-3'].map((id) => asset(id)),
    protection: ['protect-logo', 'protect-package'].map((id) => asset(id)),
  };

  const first = compileAssetRequest({
    assetPlanItem: item,
    productTruth: productTruth(),
    campaignBible: campaignBible(),
    assets,
  });
  const reversed = compileAssetRequest({
    assetPlanItem: item,
    productTruth: productTruth(),
    campaignBible: campaignBible(),
    assets: Object.fromEntries(Object.entries(assets).map(([key, values]) => [key, [...values].reverse()])),
  });
  const snapshot = (result) => result.inputAssets.map(({ index, assetId, kind, responsibility }) => ({
    index, assetId, kind, responsibility,
  }));

  assert.equal(first.inputAssets.length, 10);
  assert.deepEqual(snapshot(first), snapshot(reversed));
  assert.deepEqual(first.inputAssets.map(({ assetId }) => assetId), [
    'product-3', 'product-1', 'product-6', 'product-2', 'product-5',
    'style-3', 'style-1', 'style-4',
    'proof-2', 'proof-1',
  ]);
  assert.deepEqual(first.inputAssets.map(({ kind }) => [
    kind,
  ]), [
    ['product'], ['product'], ['product'], ['product'], ['product'],
    ['style'], ['style'], ['style'],
    ['proof'], ['proof'],
  ]);
});

test('assigns exactly one stable duty per index and prevents duplicate or unsafe ID collisions', () => {
  const inheritedAssets = Object.create({
    product: [asset('inherited-product')],
    reference: [asset('inherited-style')],
  });
  inheritedAssets.product = [
    asset('same-id', { priority: 1 }),
    asset('same-id', { priority: 9, url: '/assets/preferred.png' }),
    asset('product-safe'),
    asset('__proto__'),
    asset(' constructor '),
  ];
  inheritedAssets.reference = [asset('same-id'), asset('style-safe'), asset('prototype')];
  inheritedAssets.proof = [asset('proof-safe')];
  inheritedAssets.protection = [asset('protect-safe', { priority: 4 })];

  const result = compileAssetRequest({
    assetPlanItem: assetPlanItem({
      productAssetIds: ['same-id', 'product-safe', '__proto__', 'constructor'],
      styleReferenceIds: ['same-id', 'style-safe', 'prototype'],
      proofAssetIds: ['proof-safe'],
    }),
    productTruth: productTruth(),
    campaignBible: campaignBible(),
    assets: inheritedAssets,
  });
  const { schema } = parseStructuredPrompt(result.prompt);
  const ids = result.inputAssets.map(({ assetId }) => assetId);
  const indexes = result.inputAssets.map(({ index }) => index);

  assert.deepEqual(ids, ['same-id', 'product-safe', 'style-safe', 'proof-safe', 'protect-safe']);
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual(indexes, [0, 1, 2, 3, 4]);
  assert.equal(result.inputAssets[0].url, '/assets/preferred.png');
  assert.equal(schema.sections.imageIndexDuties.length, result.inputAssets.length);
  assert.deepEqual(schema.sections.imageIndexDuties.map(({ index }) => index), indexes);
  assert.ok(schema.sections.imageIndexDuties.every((duty) => (
    typeof duty.responsibility === 'string'
    && duty.responsibility.length > 0
    && Object.keys(duty).filter((key) => key === 'responsibility').length === 1
  )));
  assert.equal(ids.includes('inherited-product'), false);
  assert.equal(ids.includes('inherited-style'), false);
  assert.equal({}.polluted, undefined);
});

test('includes required confirmed visual facts while excluding uncertain facts and routing exact high-risk data to overlays', () => {
  const result = compileAssetRequest({
    assetPlanItem: assetPlanItem({
      generationMode: 'deterministic_overlay',
      requiredFacts: [
        { name: 'productName', value: 'Aurora Serum' },
        { name: 'color', value: 'pearl white' },
        { name: 'capacity', value: '30 ml' },
        { name: 'price', value: '¥199' },
        { name: 'certification', value: 'TEST-2026-88' },
        { name: 'efficacy', value: 'repairs skin in seven days' },
        { name: 'comparisonClaim', value: 'twice as effective' },
      ],
    }),
    productTruth: productTruth(),
    campaignBible: campaignBible(),
    assets: {
      product: [asset('product-front'), asset('product-side')],
      reference: [asset('style-editorial'), asset('style-lighting')],
      proof: [asset('proof-report')],
    },
  });
  const { schema } = parseStructuredPrompt(result.prompt);
  const visualFacts = schema.sections.productTruth.requiredVisualFacts;
  const overlays = schema.sections.deterministicOverlays.items;
  const overlayValues = overlays.map(({ value }) => value);
  const renderRequest = JSON.stringify({
    productTruth: schema.sections.productTruth,
    generationInstructions: schema.sections.generationInstructions,
  });

  assert.ok(visualFacts.some(({ name, value }) => name === 'color' && value === 'pearl white'));
  assert.deepEqual(overlayValues, ['30 ml', '¥199', 'TEST-2026-88', '极光精华']);
  assert.doesNotMatch(renderRequest, /30 ml|¥199|TEST-2026-88|极光精华/);
  assert.doesNotMatch(result.prompt, /repairs skin in seven days|retinol|twice as effective/);
  assert.match(schema.sections.deterministicOverlays.instruction, /post-processing only/i);
  assert.match(schema.sections.deterministicOverlays.instruction, /must not render/i);
  assert.match(schema.sections.deterministicOverlays.instruction, /Chinese|price|promotion|parameter|SKU|dimension|certificate|report|comparison/i);
});

test('compiles campaign, role, platform, quality, risk, and anti-substitution sections without leaking route or export pixels', () => {
  const result = compileAssetRequest({
    assetPlanItem: assetPlanItem(),
    productTruth: productTruth(),
    campaignBible: campaignBible(),
    assets: {
      product: [asset('product-front'), asset('product-side')],
      reference: [asset('style-editorial'), asset('style-lighting')],
    },
  });
  const { ratioLine, schema } = parseStructuredPrompt(result.prompt);

  assert.equal(ratioLine, 'ASPECT RATIO LOCK: 3:4.');
  assert.equal(schema.sections.roleObjective.role, 'main_3x4');
  assert.match(schema.sections.roleObjective.purpose, /representative campaign image/i);
  assert.deepEqual(schema.sections.campaignBible.palette, ['#f4f0e8', '#9ea6ad']);
  assert.match(schema.sections.campaignBible.lighting, /diffused key light/i);
  assert.match(schema.sections.campaignBible.composition, /three-quarter hero/i);
  assert.match(schema.sections.generationInstructions.materials, /frosted glass/i);
  assert.deepEqual(schema.sections.qualityAndRisk.qualityChecks, [
    'technical_dimensions', 'product_fidelity', 'platform_compliance',
  ]);
  assert.equal(schema.sections.qualityAndRisk.riskLevel, 'high');
  assert.equal(schema.sections.platformRecommendation.platform, 'taobao');
  assert.equal(schema.sections.platformRecommendation.enforcement, 'recommendation');
  assert.match(schema.sections.referenceSafety, /style references/i);
  assert.match(schema.sections.referenceSafety, /must never replace/i);
  assert.match(schema.sections.referenceSafety, /user'?s real product/i);
  assert.doesNotMatch(result.prompt, /gpt-image|gemini|native/i);
  assert.doesNotMatch(result.prompt, /1536x2048|800x800|750x1000|5_?000_?000/);
});

test('keeps proof and protection responsibilities separate from product views', () => {
  const result = compileAssetRequest({
    assetPlanItem: assetPlanItem({
      productAssetIds: ['product-front'],
      styleReferenceIds: ['style-editorial'],
      proofAssetIds: ['proof-report'],
    }),
    productTruth: productTruth(),
    campaignBible: campaignBible(),
    assets: {
      product: [asset('product-front')],
      reference: [asset('style-editorial')],
      proof: [asset('proof-report')],
      protection: [asset('protect-logo')],
    },
  });
  const proof = result.inputAssets.find(({ kind }) => kind === 'proof');
  const protection = result.inputAssets.find(({ kind }) => kind === 'protection');

  assert.ok(proof);
  assert.ok(protection);
  assert.match(proof.responsibility, /evidence.*post-processing/i);
  assert.match(proof.responsibility, /not a product view/i);
  assert.match(protection.responsibility, /protect.*identity/i);
  assert.doesNotMatch(protection.responsibility, /style reference/i);
});

test('does not consume product, style, or proof assets that the plan item did not assign', () => {
  const result = compileAssetRequest({
    assetPlanItem: assetPlanItem({
      productAssetIds: [],
      styleReferenceIds: [],
      proofAssetIds: [],
      riskLevel: 'low',
      qualityChecks: ['technical_dimensions'],
    }),
    productTruth: productTruth({ forbiddenMutations: [] }),
    campaignBible: campaignBible(),
    assets: {
      product: [asset('unassigned-product')],
      reference: [asset('unassigned-style')],
      proof: [asset('unassigned-proof')],
      protection: [asset('unassigned-protection')],
    },
  });

  assert.deepEqual(result.inputAssets, []);
});

test('uses catalog-owned cost routing and exactly matches the asset item generation ratio and size', () => {
  const standard = compileAssetRequest({
    assetPlanItem: assetPlanItem({
      batchEligible: true,
      assetCount: 4,
      sameStyle: true,
      riskLevel: 'low',
    }),
    productTruth: productTruth(),
    campaignBible: campaignBible(),
    assets: { product: [asset('product-front')], reference: [] },
  });
  const fourK = compileAssetRequest({
    assetPlanItem: assetPlanItem({
      ratio: '3:4',
      generationSize: '2448x3264',
      riskLevel: 'low',
    }),
    productTruth: productTruth(),
    campaignBible: campaignBible(),
    assets: { product: [asset('product-front')], reference: [] },
  });

  assert.deepEqual(standard.modelRoute, {
    model: 'gpt-image-2',
    size: '1536x2048',
    async: true,
    mode: 'edit',
  });
  assert.deepEqual(fourK.modelRoute, {
    model: 'gpt-image-2',
    size: '2448x3264',
    async: true,
    mode: 'edit',
  });
  assert.throws(() => compileAssetRequest({
    assetPlanItem: assetPlanItem({ ratio: '1:1', generationSize: '1536x2048' }),
    productTruth: productTruth(),
    campaignBible: campaignBible(),
    assets: { product: [asset('product-front')] },
  }), /generationSize.*ratio/i);
});

test('has no Contact Sheet production dependency', async () => {
  const source = await readFile(
    new URL('../server/ecommerceEngine/promptCompiler.mjs', import.meta.url),
    'utf8',
  );

  assert.doesNotMatch(source, /referenceContactSheet|buildReferenceContactSheet|contact\s*sheet/i);
});
