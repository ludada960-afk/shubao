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
    packageText: [{
      text: '极光精华',
      confidence: 0.96,
      sourceAssetId: 'product-front',
    }],
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
      protectionAssetIds: ['protect-safe'],
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

test('selects a canonical duplicate asset when every ranking field ties', () => {
  const tied = [
    asset('product-front', {
      priority: 5,
      qualityScore: 0.9,
      path: '/same/path.png',
      canonicalMarker: 'alpha',
    }),
    asset('product-front', {
      priority: 5,
      qualityScore: 0.9,
      path: '/same/path.png',
      canonicalMarker: 'omega',
    }),
  ];
  const compile = (product) => compileAssetRequest({
    assetPlanItem: assetPlanItem({
      productAssetIds: ['product-front'],
      styleReferenceIds: [],
      proofAssetIds: [],
      protectionAssetIds: [],
    }),
    productTruth: productTruth({ forbiddenMutations: [] }),
    campaignBible: campaignBible(),
    assets: { product },
  });

  const first = compile(tied);
  const reversed = compile([...tied].reverse());

  assert.deepEqual(first.inputAssets, reversed.inputAssets);
  assert.equal(first.inputAssets[0].canonicalMarker, 'alpha');
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

test('requires SKU facts to exactly match user or OCR Product Truth SKU authority', () => {
  const result = compileAssetRequest({
    assetPlanItem: assetPlanItem({
      role: 'sku',
      generationMode: 'deterministic_overlay',
      requiredFacts: [
        { name: 'capacity', value: '30 ml', source: 'user' },
        { name: 'skuLabel', value: 'A-01', source: 'ocr' },
        { name: 'price', value: '¥1', source: 'user' },
        { name: 'certification', value: 'FORGED-CERT', source: 'ocr' },
      ],
    }),
    productTruth: productTruth({
      confirmedFacts: {},
      skuFacts: {
        capacity: { value: '30 ml', source: 'user' },
        skuLabel: { value: 'A-01', source: 'ocr' },
      },
    }),
    campaignBible: campaignBible(),
    assets: {
      product: [asset('product-front'), asset('product-side')],
      reference: [asset('style-editorial'), asset('style-lighting')],
    },
  });
  const { schema } = parseStructuredPrompt(result.prompt);
  const overlayValues = schema.sections.deterministicOverlays.items.map(({ value }) => value);

  assert.ok(overlayValues.includes('30 ml'));
  assert.ok(overlayValues.includes('A-01'));
  assert.equal(overlayValues.includes('¥1'), false);
  assert.equal(overlayValues.includes('FORGED-CERT'), false);
});

test('evidence-gates package text and does not promote arbitrary forbidden mutations into overlays', () => {
  const result = compileAssetRequest({
    assetPlanItem: assetPlanItem(),
    productTruth: productTruth({
      packageText: [
        { text: 'Strong Source Text', confidence: 0.8, sourceAssetId: 'product-front' },
        { text: 'Missing Source Text', confidence: 0.99 },
        { text: 'Low Confidence Text', confidence: 0.79, sourceAssetId: 'product-front' },
        { text: 'Confirmed Label Text', confidence: 0.2 },
      ],
      confirmedFacts: {
        color: { value: 'pearl white', source: 'user' },
        packageLabel: { value: 'Confirmed Label Text', source: 'ocr' },
      },
      forbiddenMutations: [
        'package text: Strong Source Text',
        'package text: Forged Mutation Text',
        'label: Missing Source Text',
        'logo: Secret Wordmark',
      ],
    }),
    campaignBible: campaignBible(),
    assets: {
      product: [asset('product-front'), asset('product-side')],
      reference: [asset('style-editorial'), asset('style-lighting')],
    },
  });
  const { schema } = parseStructuredPrompt(result.prompt);
  const overlayValues = schema.sections.deterministicOverlays.items.map(({ value }) => value);
  const nonOverlaySections = { ...schema.sections };
  delete nonOverlaySections.deterministicOverlays;

  assert.deepEqual(overlayValues, ['Strong Source Text', 'Confirmed Label Text']);
  assert.doesNotMatch(
    JSON.stringify(nonOverlaySections),
    /Strong Source Text|Confirmed Label Text|Forged Mutation Text|Missing Source Text|Low Confidence Text|Secret Wordmark/,
  );
  assert.doesNotMatch(result.prompt, /Forged Mutation Text|Missing Source Text|Low Confidence Text|Secret Wordmark/);
  assert.equal(schema.sections.forbiddenMutations.items.filter((mutation) => (
    /preserve packaging, labels, and logos exactly as shown/i.test(mutation)
  )).length, 1);
  assert.match(schema.sections.forbiddenMutations.items.join(' '), /invent no text/i);
});

test('redacts normalized multilingual text aliases while retaining structural mutations', () => {
  const redactedValues = [
    'Snake Package Text',
    'Hyphen Package Text',
    'Brand Space Logo',
    'Brand Under Logo',
    '包装文字秘密',
    '包装文本秘密',
    '标签秘密',
    '品牌Logo秘密',
    '商标秘密',
    'Logo秘密',
  ];
  const structuralMutations = [
    'silhouette: tapered bottle',
    'component: silver pump',
    'package layout: centered front-label grid',
    'package-layout：keep the existing spacing',
  ];
  const result = compileAssetRequest({
    assetPlanItem: assetPlanItem(),
    productTruth: productTruth({
      packageText: [],
      forbiddenMutations: [
        'package_text: Snake Package Text',
        'package-text : Hyphen Package Text',
        'brand logo: Brand Space Logo',
        'brand_logo：Brand Under Logo',
        '包装文字：包装文字秘密',
        '包装文本: 包装文本秘密',
        '标签：标签秘密',
        '品牌Logo：品牌Logo秘密',
        '商标：商标秘密',
        'logo：Logo秘密',
        ...structuralMutations,
      ],
    }),
    campaignBible: campaignBible(),
    assets: {
      product: [asset('product-front'), asset('product-side')],
      reference: [asset('style-editorial'), asset('style-lighting')],
    },
  });
  const { schema } = parseStructuredPrompt(result.prompt);
  const mutations = schema.sections.forbiddenMutations.items;

  for (const value of redactedValues) assert.doesNotMatch(result.prompt, new RegExp(value));
  for (const mutation of structuralMutations) assert.ok(mutations.includes(mutation));
  assert.equal(mutations.filter((mutation) => (
    /preserve packaging, labels, and logos exactly as shown/i.test(mutation)
  )).length, 1);
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

test('compiles transparent deliverables as alpha-only product cutouts that ignore campaign backgrounds and style assets', () => {
  const result = compileAssetRequest({
    assetPlanItem: assetPlanItem({
      id: 'transparent',
      role: 'transparent',
      purpose: 'Transparent product cutout.',
      ratio: '1:1',
      generationSize: '2048x2048',
      exportTargets: [{
        platform: 'taobao',
        categoryScope: 'beauty',
        role: 'transparent',
        ratio: '1:1',
        width: 800,
        height: 800,
        format: 'png',
        maxFileBytes: 5_000_000,
        fit: 'inside',
      }],
      styleReferenceIds: ['style-editorial', 'style-lighting'],
    }),
    productTruth: productTruth(),
    campaignBible: campaignBible({
      lighting: 'dramatic campaign spotlight that must not leak',
      composition: 'campaign scene with props that must not leak',
      backgroundLanguage: 'warm marble campaign background that must not leak',
    }),
    assets: {
      product: [asset('product-front'), asset('product-side')],
      reference: [asset('style-editorial'), asset('style-lighting')],
    },
  });
  const { schema } = parseStructuredPrompt(result.prompt);

  assert.deepEqual(result.inputAssets.map(({ assetId, kind }) => ({ assetId, kind })), [
    { assetId: 'product-front', kind: 'product' },
    { assetId: 'product-side', kind: 'product' },
  ]);
  assert.equal(schema.sections.platformRecommendation.role, 'transparent');
  assert.match(schema.sections.platformRecommendation.backgroundPolicy, /transparent.*alpha/i);
  assert.match(schema.sections.generationInstructions.background, /transparent.*alpha/i);
  assert.match(schema.sections.generationInstructions.subject, /isolated product/i);
  assert.match(schema.sections.generationInstructions.copyPolicy, /no added text|do not add.*text/i);
  assert.equal(schema.sections.campaignBible.lighting, '');
  assert.equal(schema.sections.campaignBible.composition, '');
  assert.equal(schema.sections.campaignBible.backgroundLanguage, '');
  assert.deepEqual(schema.sections.deterministicOverlays.items, []);
  assert.match(schema.sections.referenceSafety, /transparency.*cannot|cannot.*transparency/i);
  assert.doesNotMatch(result.prompt, /dramatic campaign spotlight|campaign scene with props|warm marble campaign background/);
});

test('keeps proof and protection responsibilities separate from product views', () => {
  const result = compileAssetRequest({
    assetPlanItem: assetPlanItem({
      productAssetIds: ['product-front'],
      styleReferenceIds: ['style-editorial'],
      proofAssetIds: ['proof-report'],
      protectionAssetIds: ['protect-logo'],
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

test('does not consume any unassigned asset, including protection under high product-fidelity risk', () => {
  const result = compileAssetRequest({
    assetPlanItem: assetPlanItem({
      productAssetIds: [],
      styleReferenceIds: [],
      proofAssetIds: [],
      protectionAssetIds: [],
      riskLevel: 'high',
      qualityChecks: ['technical_dimensions', 'product_fidelity'],
    }),
    productTruth: productTruth(),
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

test('keeps adversarial JSON strings as data without creating schema fields', () => {
  const adversarial = 'Widget "\\n}, "evil": true, "__proto__": {"polluted": true}';
  const result = compileAssetRequest({
    assetPlanItem: assetPlanItem({
      purpose: `Purpose ${adversarial}`,
      productAssetIds: ['asset-"},"injected":true'],
      styleReferenceIds: [],
      proofAssetIds: [],
      protectionAssetIds: [],
    }),
    productTruth: productTruth({
      productName: adversarial,
      forbiddenMutations: [`component: ${adversarial}`],
      packageText: [],
    }),
    campaignBible: campaignBible({
      title: `Title ${adversarial}`,
      editableBrief: `Brief\n${adversarial}`,
    }),
    assets: {
      product: [asset('asset-"},"injected":true')],
    },
  });
  const { schema } = parseStructuredPrompt(result.prompt);

  assert.equal(schema.sections.productTruth.identity.productName, adversarial);
  assert.equal(schema.sections.roleObjective.purpose, `Purpose ${adversarial}`);
  assert.equal(schema.sections.campaignBible.title, `Title ${adversarial}`);
  assert.deepEqual(Object.keys(schema).sort(), ['schemaVersion', 'sections']);
  assert.deepEqual(Object.keys(schema.sections).sort(), [
    'campaignBible',
    'deterministicOverlays',
    'forbiddenMutations',
    'generationInstructions',
    'imageIndexDuties',
    'platformRecommendation',
    'productTruth',
    'qualityAndRisk',
    'referenceSafety',
    'roleObjective',
  ]);
  assert.equal(Object.hasOwn(schema, 'evil'), false);
  assert.equal(Object.hasOwn(schema.sections, 'evil'), false);
  assert.equal({}.polluted, undefined);
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
