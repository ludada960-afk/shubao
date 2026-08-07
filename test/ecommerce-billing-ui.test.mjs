import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';

import { buildAssetPlan } from '../server/ecommerceEngine/assetPlanner.mjs';
import { validatePlanContract } from '../server/ecommerceEngine/planContract.mjs';

async function planModel() {
  return import(`../src/pages/Home/ec/ecommercePlanModel.js?billing-ui=${Date.now()}-${Math.random()}`);
}

const PRODUCT_ORIGINAL_ID = `${'a'.repeat(64)}.png`;
const PRODUCT_SUPPLEMENT_ID = `${'b'.repeat(64)}.jpg`;
const REFERENCE_ORIGINAL_ID = `${'c'.repeat(64)}.webp`;
const REFERENCE_SUPPLEMENT_ID = `${'d'.repeat(64)}.png`;

function productTruth() {
  return {
    category: '数码3C',
    productName: 'Nova Hub',
    sourceAssetIds: ['product-front'],
    confirmedFacts: {},
  };
}

test('sizing UI exposes only production roles and ratios', async () => {
  const source = await fs.readFile(new URL('../src/pages/Home/ec/SizingPanel.jsx', import.meta.url), 'utf8');

  assert.doesNotMatch(source, /key:\s*['"]poster['"]/);
  for (const unsupported of ['16:9', '2:3', '21:9', '5:4', '4:5', '32:9']) {
    assert.doesNotMatch(source, new RegExp(unsupported.replace(':', '\\:')));
  }
  assert.match(source, /resolveSizingImages/);
});

test('smart and custom sizing resolve to explicit legal production images', async () => {
  const { resolveSizingImages } = await planModel();

  const smart = resolveSizingImages('淘宝', { smart: true, images: [], resolution: '2K' });
  assert.deepEqual(smart.map(({ key, count, ratio }) => ({ key, count, ratio })), [
    { key: 'white_bg', count: 1, ratio: '1:1' },
    { key: 'main_text', count: 3, ratio: '1:1' },
    { key: 'transparent', count: 1, ratio: '1:1' },
    { key: 'detail', count: 5, ratio: '9:16' },
  ]);

  const custom = resolveSizingImages('淘宝', {
    smart: false,
    resolution: '1K',
    images: [
      { key: 'poster', count: 5, ratio: '3:4' },
      { key: 'main_text', count: 2, ratio: '16:9' },
      { key: 'detail', count: 4, ratio: '9:16' },
      { key: 'transparent', count: 1, ratio: '1:1' },
    ],
  });
  assert.deepEqual(custom.map(({ key, count, ratio }) => ({ key, count, ratio })), [
    { key: 'main_text', count: 2, ratio: '1:1' },
    { key: 'detail', count: 4, ratio: '9:16' },
    { key: 'transparent', count: 1, ratio: '1:1' },
  ]);
});

test('smart package disclosure, quote quantity, and server plan all describe the same ten deliverables', async () => {
  const { PLATFORM_PRESETS, resolveEcommercePlan, resolveSizingImages } = await planModel();
  const images = resolveSizingImages('smart', { smart: true, images: [], resolution: '2K' });
  const uiPlan = resolveEcommercePlan({
    platform: 'smart',
    resolution: '2K',
    sizing: { smart: true, images },
  });
  const serverPlan = buildAssetPlan({
    productTruth: productTruth(),
    campaignBible: { confirmed: true, referenceAssetIds: [] },
    platform: 'smart',
    sizing: { resolution: '2K', smart: true, images },
  });

  assert.equal(images.reduce((sum, image) => sum + image.count, 0), 10);
  assert.equal(uiPlan.quantity, 10);
  assert.equal(uiPlan.quoteRequest.quantity, 10);
  assert.equal(serverPlan.length, 10);
  assert.match(PLATFORM_PRESETS.smart.desc, /1.*白底.*3.*主图.*1.*透明.*5.*详情.*10/);

  const sizingSource = await fs.readFile(new URL('../src/pages/Home/ec/SizingPanel.jsx', import.meta.url), 'utf8');
  assert.match(sizingSource, /planSummary/);
  assert.match(sizingSource, /总计.*totalImages|totalImages.*张/);
});

test('UI plan quantity matches the production asset plan and all IDs are deterministic and unique', async () => {
  const { resolveEcommercePlan } = await planModel();
  const input = {
    platform: '淘宝',
    resolution: '2K',
    sizing: {
      smart: false,
      images: [
        { key: 'white_bg', count: 2, ratio: '1:1' },
        { key: 'main_text', count: 2, ratio: '1:1' },
        { key: 'main_3x4', count: 1, ratio: '3:4' },
        { key: 'transparent', count: 2, ratio: '1:1' },
        { key: 'detail', count: 6, ratio: '3:4' },
      ],
    },
    skus: [
      { color: '曜石黑' },
      { size: '标准版' },
      { color: '   ' },
    ],
  };
  const uiPlan = resolveEcommercePlan(input);
  const serverPlan = buildAssetPlan({
    productTruth: productTruth(),
    campaignBible: { confirmed: true, referenceAssetIds: [] },
    platform: input.platform,
    sizing: { ...input.sizing, resolution: input.resolution },
    skus: input.skus,
  });

  assert.equal(uiPlan.quantity, 15);
  assert.equal(uiPlan.quantity, serverPlan.length);
  assert.equal(validatePlanContract(serverPlan), serverPlan);
  assert.equal(new Set(serverPlan.map(item => item.id)).size, serverPlan.length);
  assert.deepEqual(serverPlan, buildAssetPlan({
    productTruth: productTruth(),
    campaignBible: { confirmed: true, referenceAssetIds: [] },
    platform: input.platform,
    sizing: { ...input.sizing, resolution: input.resolution },
    skus: input.skus,
  }));
});

test('UI-supported detail counts six and ten quote and validate exactly', async () => {
  const { IMAGE_TYPES, resolveEcommercePlan } = await planModel();
  const detailType = IMAGE_TYPES.find(type => type.key === 'detail');

  assert.equal(detailType.maxCount, 10);
  for (const count of [6, 10]) {
    const input = {
      platform: '\u6dd8\u5b9d',
      resolution: '2K',
      sizing: {
        smart: false,
        images: [{ key: 'detail', count, ratio: '3:4' }],
      },
    };
    const uiPlan = resolveEcommercePlan(input);
    const serverPlan = buildAssetPlan({
      productTruth: productTruth(),
      campaignBible: { confirmed: true, referenceAssetIds: [] },
      platform: input.platform,
      sizing: { ...input.sizing, resolution: input.resolution },
    });

    assert.equal(uiPlan.quantity, count);
    assert.equal(uiPlan.quoteRequest.quantity, count);
    assert.equal(serverPlan.length, count);
    assert.equal(validatePlanContract(serverPlan), serverPlan);
  }
});

test('quote request uses the formal resolution SKU and exact planned quantity', async () => {
  const { resolveEcommercePlan } = await planModel();
  const sizing = {
    smart: false,
    images: [
      { key: 'white_bg', count: 1, ratio: '1:1' },
      { key: 'main_text', count: 3, ratio: '1:1' },
      { key: 'detail', count: 5, ratio: '3:4' },
    ],
  };

  assert.deepEqual(resolveEcommercePlan({ platform: '淘宝', sizing, resolution: '1K' }).quoteRequest, {
    sku: 'ec_image_2k',
    quantity: 9,
  });
  assert.deepEqual(resolveEcommercePlan({ platform: '淘宝', sizing, resolution: '2K' }).quoteRequest, {
    sku: 'ec_image_2k',
    quantity: 9,
  });
  assert.deepEqual(resolveEcommercePlan({ platform: '淘宝', sizing, resolution: '4K' }).quoteRequest, {
    sku: 'ec_image_4k',
    quantity: 9,
  });
});

test('quote copy always shows the market price, including internal unlimited accounts', async () => {
  const { formatEcommerceQuote } = await planModel();

  assert.equal(formatEcommerceQuote({
    quantity: 9,
    quote: { totalUnits: 9000, currency: 'ec_points' },
  }), '生成 9 张 · 9 AI 积分');
  assert.equal(formatEcommerceQuote({
    quantity: 9,
    quote: { totalUnits: 9000, currency: 'ec_points' },
    unlimited: true,
  }), '生成 9 张 · 9 AI 积分');
});

test('creates a stable draft id and a complete reference-only ecommerce pending action', async () => {
  const {
    buildEcommercePendingAction,
    createEcommerceDraftId,
  } = await planModel();
  const draftId = createEcommerceDraftId({
    randomUUID: () => '123e4567-e89b-12d3-a456-426614174000',
  });
  const rawFile = new File(['original'], 'product.png', { type: 'image/png' });

  assert.equal(draftId, 'ec-draft-123e4567-e89b-12d3-a456-426614174000');
  assert.deepEqual(buildEcommercePendingAction({
    platform: '淘宝',
    direction: {
      id: 'direction-premium',
      title: '不可编辑标题',
      description: '用户修改后的执行说明',
      previewUrl: 'blob:direction-preview',
    },
    sizing: {
      smart: false,
      resolution: '4K',
      images: [
        { key: 'main_text', count: 2, ratio: '1:1', preview: 'data:image/png;base64,AAAA' },
        { key: 'detail', count: 3, ratio: '3:4' },
      ],
    },
    skus: [
      { id: 'sku-runtime-id', color: '曜石黑', size: '标准版', capacity: '256GB', dimLabel: '', count: 1, file: rawFile },
      { color: '', size: '', capacity: '', dimLabel: '', count: 1 },
    ],
    customColors: ['#112233', '#F4E9D8', 'data:image/png;base64,COLOR'],
    originalProductAssets: [
      { assetId: PRODUCT_ORIGINAL_ID, url: `/api/generated-assets/${PRODUCT_ORIGINAL_ID}`, file: rawFile },
      { assetId: 'product-original-1', url: '/api/generated-assets/product-original-1.png' },
    ],
    supplementalProductAssets: [
      { assetId: PRODUCT_SUPPLEMENT_ID, previewUrl: 'blob:supplement' },
      { assetId: `iVBORw0KGgo${'A'.repeat(128)}` },
    ],
    originalReferenceAssets: [
      { assetId: REFERENCE_ORIGINAL_ID, url: 'data:image/png;base64,REFERENCE' },
      { assetId: `${'e'.repeat(63)}.png` },
    ],
    supplementalReferenceAssets: [
      { assetId: REFERENCE_SUPPLEMENT_ID, bytes: new Uint8Array([1, 2, 3]) },
      { assetId: `${'f'.repeat(64)}.gif` },
    ],
    promptText: '让主图更突出材质与尺寸感',
    promptReferences: [
      { key: 'product_name', text: 'Nova Hub', image: rawFile },
      { key: 'selling_points', text: '金属机身，接口丰富' },
      { key: 'unsafe', text: 'blob:prompt-preview' },
    ],
  }), {
    type: 'ecommerce_generate',
    direction: {
      id: 'direction-premium',
      brief: '用户修改后的执行说明',
    },
    sizing: {
      platform: '淘宝',
      smart: false,
      resolution: '4K',
      images: [
        { key: 'main_text', count: 2, ratio: '1:1' },
        { key: 'detail', count: 3, ratio: '3:4' },
      ],
    },
    skus: [
      { color: '曜石黑', size: '标准版', capacity: '256GB', dimLabel: '', count: 1 },
    ],
    customColors: ['#112233', '#F4E9D8'],
    assetIds: {
      product: {
        original: [PRODUCT_ORIGINAL_ID],
        supplemental: [PRODUCT_SUPPLEMENT_ID],
      },
      reference: {
        original: [REFERENCE_ORIGINAL_ID],
        supplemental: [REFERENCE_SUPPLEMENT_ID],
      },
    },
    prompt: {
      text: '让主图更突出材质与尺寸感',
      references: [
        { key: 'product_name', text: 'Nova Hub' },
        { key: 'selling_points', text: '金属机身，接口丰富' },
      ],
    },
  });
});

test('ecommerce pending action rejects actual image payloads without deleting normal encoded-looking text', async () => {
  const { buildEcommercePendingAction } = await planModel();
  const rawPngBase64 = `iVBORw0KGgoAAAANSUhEUgAA${'A'.repeat(180)}`;
  const rawJpegBase64 = `/9j/4AAQSkZJRgABAQAAAQABAAD${'B'.repeat(180)}`;
  const shortPngBase64 = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).toString('base64');
  const shortJpegBase64Url = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46])
    .toString('base64url');
  const longNoPunctuation = 'ProductMaterialStructureAccuracy'.repeat(12);
  const sha256Text = '0123456789abcdef'.repeat(4);
  const preservedChinese = '保留商品真实结构、中文包装信息和材质细节，避免虚构参数。'.repeat(60);

  const sanitized = buildEcommercePendingAction({
    platform: '淘宝',
    direction: {
      id: '方向'.repeat(70),
      brief: '方'.repeat(1400),
    },
    sizing: { resolution: '2K' },
    skus: [
      { color: '银'.repeat(180), size: '标准版' },
      { color: rawJpegBase64 },
      { color: sha256Text },
      { color: `说明文字 blob:https://shuimg.cn/temporary-preview` },
    ],
    originalProductAssets: [
      { assetId: PRODUCT_ORIGINAL_ID },
      { assetId: rawPngBase64 },
      { assetId: 'not-a-server-asset.png' },
    ],
    originalReferenceAssets: [
      { assetId: REFERENCE_ORIGINAL_ID },
      { assetId: sha256Text },
    ],
    promptText: '中'.repeat(7000),
    promptReferences: [
      { key: '键'.repeat(120), text: preservedChinese },
      { key: 'binary_png', text: rawPngBase64 },
      { key: 'short_png', text: ` \n ${shortPngBase64} \t ` },
      { key: 'short_jpeg_url', text: shortJpegBase64Url },
      { key: 'embedded_data_url', text: `正常前缀 data:image/png;base64,${shortPngBase64} 正常后缀` },
      { key: 'embedded_blob_url', text: '正常前缀 blob:https://shuimg.cn/temporary-preview 正常后缀' },
      { key: 'long_plain_english', text: longNoPunctuation },
      { key: 'sha256', text: sha256Text },
    ],
  });

  assert.equal(sanitized.direction.id.length, 96);
  assert.equal(sanitized.direction.brief.length, 1200);
  assert.equal(sanitized.skus.length, 2);
  assert.equal(sanitized.skus[0].color.length, 120);
  assert.equal(sanitized.skus[1].color, sha256Text);
  assert.deepEqual(sanitized.assetIds.product.original, [PRODUCT_ORIGINAL_ID]);
  assert.deepEqual(sanitized.assetIds.reference.original, [REFERENCE_ORIGINAL_ID]);
  assert.equal(sanitized.prompt.text.length, 6000);
  assert.deepEqual(sanitized.prompt.references, [
    {
      key: '键'.repeat(80),
      text: preservedChinese,
    },
    { key: 'long_plain_english', text: longNoPunctuation },
    { key: 'sha256', text: sha256Text },
  ]);

  const binaryPrompt = buildEcommercePendingAction({
    direction: {
      id: shortJpegBase64Url,
      brief: `普通前缀 data:image/png;base64,${shortPngBase64}`,
    },
    skus: [{ color: `\r\n${shortPngBase64}\n` }],
    promptText: rawPngBase64,
  });
  assert.deepEqual(binaryPrompt.direction, { id: 'smart', brief: '' });
  assert.deepEqual(binaryPrompt.skus, []);
  assert.equal(binaryPrompt.prompt.text, '');
});

test('re-quote invalidation changes the request dependency without changing the plan', async () => {
  const {
    ecommerceQuoteRequestKey,
    invalidateEcommerceQuote,
  } = await planModel();
  assert.equal(typeof ecommerceQuoteRequestKey, 'function');
  assert.equal(typeof invalidateEcommerceQuote, 'function');
  const quoteRequest = { sku: 'ec_image_2k', quantity: 10 };
  const staleQuote = { quoteId: 'bq1.stale.quote', totalUnits: 10_000 };
  const beforeKey = ecommerceQuoteRequestKey(quoteRequest, 0);

  const invalidated = invalidateEcommerceQuote({
    quote: staleQuote,
    refreshVersion: 0,
  });

  assert.equal(invalidated.quote, null);
  assert.equal(invalidated.refreshVersion, 1);
  assert.equal(invalidated.message, '当前方案费用已更新，正在重新确认…');
  assert.notEqual(ecommerceQuoteRequestKey(quoteRequest, invalidated.refreshVersion), beforeKey);

  const source = await fs.readFile(new URL('../src/pages/Home/ec/DesignDirection.jsx', import.meta.url), 'utf8');
  assert.match(source, /ecommerceQuoteRequestKey/);
  assert.match(source, /invalidateEcommerceQuote/);
  assert.match(source, /if\s*\(e\?\.reQuoteRequired\s*===\s*true\)/);
  assert.match(source, /setBillingQuote\(null\)/);
  assert.match(source, /setQuoteRefreshVersion/);
  assert.match(source, /disabled=\{generating \|\| quoteLoading \|\| !billingQuote/);
  assert.doesNotMatch(
    source.match(/if\s*\(e\?\.reQuoteRequired\s*===\s*true\)[\s\S]{0,500}/)?.[0] || '',
    /handleConfirm\s*\(/,
  );
});

test('direction confirmation requests an authoritative quote instead of embedding prices', async () => {
  const source = await fs.readFile(new URL('../src/pages/Home/ec/DesignDirection.jsx', import.meta.url), 'utf8');

  assert.match(source, /quoteBillingAction/);
  assert.match(source, /formatEcommerceQuote/);
  assert.match(source, /billingQuoteId:\s*billingQuote\.quoteId/);
  assert.match(source, /buildEcommercePendingAction/);
  assert.match(source, /ownerEmail:\s*state\.(?:email|phone)/);
  assert.match(source, /draftId:\s*params\?\.draftId/);
  assert.match(source, /quoteId:\s*failedQuoteId/);
  assert.doesNotMatch(source, /providerCost|milli|gpt-image|中转站/);
});

test('direction generation keeps normalized per-asset progress and stable previews until a final usable task result', async () => {
  const source = await fs.readFile(new URL('../src/pages/Home/ec/DesignDirection.jsx', import.meta.url), 'utf8');

  assert.match(source, /const \[assetProgress, setAssetProgress\] = useState\(\[\]\)/);
  assert.match(source, /const \[stableImages, setStableImages\] = useState\(\[\]\)/);
  assert.match(source, /onProgress: \(task\) => \{[\s\S]{0,280}Array\.isArray\(task\.assets\)[\s\S]{0,180}setAssetProgress/s);
  assert.match(source, /onImage: \(image\) => \{[\s\S]{0,360}setStableImages/);
  assert.match(source, /asset\.role/);
  assert.match(source, /asset\.label/);
  assert.match(source, /asset\.userState/);
  assert.match(source, /stableImages\.map/);
  assert.match(source, /retry:\s*false/);
  assert.match(source, /acceptEcommerceFinalResult\(result\)/);
  assert.doesNotMatch(source, /_partialDelivery/);
  assert.doesNotMatch(source, /继续生成[”"]?修复未通过/);
  assert.doesNotMatch(source, /saveWork\(/);
  const serverSource = await fs.readFile(new URL('../server/index.mjs', import.meta.url), 'utf8');
  assert.match(serverSource, /createEcommerceTaskWorkPersistence/);
  assert.match(serverSource, /persistWorkSnapshot/);
  assert.match(source, /if \(finalDelivery\)/);
  assert.match(source, /setPreviewImageIndex\(index\)/);
  assert.match(source, /event\.key === 'ArrowLeft'/);
  assert.match(source, /event\.key === 'ArrowRight'/);
  assert.match(source, /event\.key === 'Escape'/);
  assert.doesNotMatch(source, /setExtraProductImages\(\[\]\)|setExtraReferenceImages\(\[\]\)|setDirections\(\[\]\)/);
});

test('every reachable ecommerce generation UI entry uses the durable draft and image-progress contract', async () => {
  const entrypoints = [
    '../src/pages/EcStudio/index.jsx',
    '../src/pages/EcAuto/index.jsx',
    '../src/pages/Home/EcLegacyForm.jsx',
    '../src/pages/Home/XhsContentMode.jsx',
  ];

  for (const entrypoint of entrypoints) {
    const source = await fs.readFile(new URL(entrypoint, import.meta.url), 'utf8');
    assert.match(source, /(?:generateEcommerce|autoGenerate)\(/, entrypoint);
    assert.match(source, /draftId/, entrypoint);
    assert.match(source, /onProgress\s*:/, entrypoint);
    assert.match(source, /onImage\s*:/, entrypoint);
    assert.doesNotMatch(source, /sb-last-ecommerce-task/, entrypoint);
  }

  const apiSource = await fs.readFile(new URL('../src/services/api.js', import.meta.url), 'utf8');
  for (const wrapper of ['generateEcommerceSuite', 'autoGenerate']) {
    const start = apiSource.indexOf(`export async function ${wrapper}`);
    const end = apiSource.indexOf('\n}', start);
    const body = apiSource.slice(start, end);
    assert.match(body, /draftId/, wrapper);
    assert.match(body, /onProgress/, wrapper);
    assert.match(body, /onImage/, wrapper);
  }

  const studioSource = await fs.readFile(new URL('../src/pages/EcStudio/index.jsx', import.meta.url), 'utf8');
  assert.match(studioSource, /if \(!name\.trim\(\) \|\| generating\) return/);
  assert.match(studioSource, /Object\.entries\(res\?\.images \|\| \{\}\)/);
});

test('legacy ecommerce surfaces isolate resumable tasks while the homepage always starts a fresh editor', async () => {
  const entrypoints = [
    '../src/pages/EcStudio/index.jsx',
    '../src/pages/EcAuto/index.jsx',
    '../src/pages/Home/EcLegacyForm.jsx',
  ];

  for (const entrypoint of entrypoints) {
    const source = await fs.readFile(new URL(entrypoint, import.meta.url), 'utf8');
    assert.match(source, /loadOrCreateEcommerceDraft/, entrypoint);
    assert.match(source, /rotateEcommerceDraft/, entrypoint);
    assert.match(source, /inProgressPreview/, entrypoint);
    assert.match(source, /mergeEcommerceInProgressPreview/, entrypoint);
    assert.match(source, /acceptEcommerceFinalResult/, entrypoint);
    assert.doesNotMatch(source, /useState\(\(\)\s*=>\s*createEcommerceDraftId\(\)\)/, entrypoint);
    assert.match(source, /state\._workVersion/, `${entrypoint} explicit new work`);

    const imageCallback = source.match(/onImage:\s*\(image\)\s*=>\s*\{[\s\S]{0,700}?\n\s*\},/i)?.[0] || '';
    assert.match(imageCallback, /setInProgressPreview/, `${entrypoint} onImage`);
    assert.doesNotMatch(imageCallback, /set(?:Result|Results|Res|EcResults)\s*\(/, `${entrypoint} onImage`);
  }

  const ecMode = await fs.readFile(new URL('../src/pages/Home/EcMode.jsx', import.meta.url), 'utf8');
  assert.doesNotMatch(ecMode, /loadOrCreateEcommerceDraft/);
  assert.doesNotMatch(ecMode, /loadDraftSnapshot|loadDraftFiles|saveDraftSnapshot|saveDraftFiles/);
  assert.match(ecMode, /useState\(createEcommerceDraftId\)/);
  assert.match(ecMode, /state\._workVersion/);
});

test('every running ecommerce entry binds callbacks and completion to its owner-draft generation token', async () => {
  const entries = [
    ['EcMode', '../src/pages/Home/EcMode.jsx'],
    ['DesignDirection', '../src/pages/Home/ec/DesignDirection.jsx'],
    ['EcStudio', '../src/pages/EcStudio/index.jsx'],
    ['EcAuto', '../src/pages/EcAuto/index.jsx'],
    ['EcLegacyForm', '../src/pages/Home/EcLegacyForm.jsx'],
    ['XhsContentMode', '../src/pages/Home/XhsContentMode.jsx'],
  ];

  for (const [name, relativePath] of entries) {
    const source = await fs.readFile(new URL(relativePath, import.meta.url), 'utf8');
    const usesLifecycleController = name === 'DesignDirection' || name === 'EcAuto';
    assert.match(source, usesLifecycleController ? /createEcommerceGenerationLifecycleController/ : /createEcommerceGenerationToken/, `${name} creates a generation token`);
    assert.match(source, usesLifecycleController ? /generationLifecycle\.isCurrent/ : /isEcommerceGenerationTokenCurrent/, `${name} guards callbacks`);
    assert.match(source, usesLifecycleController ? /generationLifecycle\.(?:invalidate|release)/ : /generationTokenRef\.current\s*=\s*null/, `${name} invalidates stale requests`);
    assert.match(source, usesLifecycleController ? /generationLifecycle\.unmount\(\)/ : /useEffect\(\(\)\s*=>\s*(?:\(\)\s*=>\s*\{|[\s\S]{0,80}return\s*\(\)\s*=>\s*\{)[\s\S]{0,500}(?:generationTokenRef\.current\s*=\s*null|invalidateEcommerceGenerationRequest)/, `${name} invalidates on unmount`);
  }
});

test('initial direction analysis is included while explicit refresh is authoritatively billed', async () => {
  const direction = await fs.readFile(new URL('../src/pages/Home/ec/DesignDirection.jsx', import.meta.url), 'utf8');
  const analysisSlice = direction.slice(direction.indexOf('const loadDirections'), direction.indexOf('const updateDirection'));
  assert.match(direction, /createBoundedRequestLifecycle/);
  assert.match(direction, /analysisRequestRef\s*=\s*useRef\(null\)/);
  assert.match(analysisSlice, /uploadSupplementAssetsForAnalysis\(analysisRequest\.signal\)/);
  assert.match(analysisSlice, /getDesignDirections\([\s\S]{0,900}\{\s*signal:\s*analysisRequest\.signal\s*\}\)/);
  assert.match(direction, /analysisRequestRef\.current\?\.cancel\(\)/);
  assert.match(direction, /analysisRequestRef\.current\?\.cleanup\(\)/);
  assert.match(direction, /uploadSupplementAssetsForGeneration\(generationToken/);
  assert.match(analysisSlice, /uploadedSupplement\.product/);
  assert.match(direction, /quoteBillingAction\(\{\s*sku:\s*['"]ec_direction_refresh['"],\s*quantity:\s*1\s*\}\)/);
  assert.match(direction, /quoteId:\s*quote\.quoteId/);
  assert.match(direction, /billingQuoteId:\s*refreshBilling\?\.quoteId/);
  assert.match(direction, /billingActionId:\s*refreshBilling\?\.actionId/);
  assert.match(direction, /directionRefreshActionRef\s*=\s*useRef\(null\)/);
  assert.match(direction, /loadEcommerceDirectionRefreshAction\(\{\s*ownerEmail,\s*draftId\s*\}\)/);
  assert.match(direction, /directionRefreshActionRef\.current\s*\|\|/);
  assert.match(direction, /directionRefreshActionRef\.current\s*=\s*actionId/);
  assert.match(direction, /saveEcommerceDirectionRefreshAction\(\{\s*ownerEmail,\s*draftId,\s*actionId\s*\}\)/);
  assert.match(direction, /clearEcommerceDirectionRefreshAction\(\{\s*ownerEmail,\s*draftId,\s*actionId\s*\}\)/);
  assert.match(direction, /await loadDirections\([\s\S]{0,240}directionRefreshActionRef\.current\s*=\s*null/);
  assert.match(analysisSlice, /if\s*\(refreshBilling\)\s*\{[\s\S]{0,180}throw Object\.assign\(new Error\(message\)/);
  assert.match(direction, /重新分析设计方案\s*·\s*1 AI 积分/);

  const homeStyles = await fs.readFile(new URL('../src/pages/Home/Home.css', import.meta.url), 'utf8');
  assert.match(direction, /className="ec-direction-action ec-direction-action--refresh"/);
  assert.match(direction, /className="ec-direction-action ec-direction-action--polish"/);
  assert.match(homeStyles, /\.ec-direction-action:hover:not\(:disabled\)/);
  assert.match(homeStyles, /\.ec-direction-action:focus-visible/);
  assert.match(homeStyles, /\.ec-direction-action:active:not\(:disabled\)/);
  assert.match(homeStyles, /\.ec-direction-action:disabled/);

  const entries = [
    '../src/pages/Home/EcMode.jsx',
    '../src/pages/Home/ec/DesignDirection.jsx',
    '../src/pages/EcStudio/index.jsx',
    '../src/pages/EcAuto/index.jsx',
    '../src/pages/Home/EcLegacyForm.jsx',
    '../src/pages/Home/XhsContentMode.jsx',
  ];
  for (const entrypoint of entries) {
    const source = await fs.readFile(new URL(entrypoint, import.meta.url), 'utf8');
    assert.match(source, /(?:createEcommerceGenerationPreconditionError|startEcommerceGenerationLifecycle|onPreconditionError)/, `${entrypoint} handles missing owner/draft`);
    assert.match(source, /if \(!(?:generationToken|generation)\)/, `${entrypoint} avoids a tokenless API call`);
  }

  const ecAuto = await fs.readFile(new URL('../src/pages/EcAuto/index.jsx', import.meta.url), 'utf8');
  assert.match(ecAuto, /generationLifecycle\.invalidate\(\)/);
  assert.match(ecAuto, /if \(workVersion > observedWorkVersionRef\.current\)/);

  const ecMode = await fs.readFile(new URL('../src/pages/Home/EcMode.jsx', import.meta.url), 'utf8');
  assert.match(ecMode, /generationAbortRef/);
  assert.match(ecMode, /uploadEcommerceAssets\(productImages, 'product', \{ signal: generationController\.signal \}\)/);
  assert.match(ecMode, /uploadEcommerceAssets\(refImages, 'reference', \{ signal: generationController\.signal \}\)/);
});

test('design-direction refresh is settled server-side against the signed owner', async () => {
  const server = await fs.readFile(new URL('../server/index.mjs', import.meta.url), 'utf8');
  const routeStart = server.indexOf("app.post('/api/ecommerce/design-directions'");
  assert.notEqual(routeStart, -1);
  const routeSource = server.slice(routeStart, server.indexOf('// AI 润色电商文案', routeStart));
  assert.match(routeSource, /canvasOneShotBilling\.execute\(\{/);
  assert.match(routeSource, /ownerEmail:\s*req\._userEmail/);
  assert.match(routeSource, /sku:\s*['"]ec_direction_refresh['"]/);
  assert.match(routeSource, /billing_quote_id/);
  assert.match(routeSource, /billing_action_id/);
  assert.match(routeSource, /createVlmDeadline\(\{\s*timeoutMs:\s*DESIGN_DIRECTION_SERVER_TIMEOUT_MS/);
  assert.match(server, /timeoutMs:\s*stage === 'vision' \? 18_000 : 30_000/);
  assert.match(server, /retryDelaysMs:\s*stage === 'vision' \? \[750\] : \[\]/);
  assert.match(routeSource, /generateDesignDirections\(req\.body,\s*\{\s*signal:\s*deadline\.signal\s*\}\)/);
  assert.match(routeSource, /if \(result\.degraded\)[\s\S]*DIRECTION_REFRESH_DEGRADED/);
  assert.match(routeSource, /deadline\.cleanup\(\)/);
});

test('first step creates one stable ecommerce draft id and passes it into direction confirmation', async () => {
  const source = await fs.readFile(new URL('../src/pages/Home/EcMode.jsx', import.meta.url), 'utf8');

  assert.match(source, /useState\(createEcommerceDraftId\)/);
  assert.doesNotMatch(source, /loadOrCreateEcommerceDraft/);
  assert.match(source, /draftId/);
  assert.match(source, /onStepChange\?\.\(\{[\s\S]*draftId/s);
});

test('production billing hold creates exactly one item per planned asset', async () => {
  const billing = await fs.readFile(
    new URL('../server/ecommerceEngine/ecommerceBilling.mjs', import.meta.url),
    'utf8',
  );

  assert.match(billing, /const items = assetPlan\.map\(/);
  assert.match(billing, /key:\s*item\.id/);
  assert.match(billing, /quoteService\.verify/);
  assert.match(billing, /billing_quote_id/);
});

test('commerce configuration and navigation controls keep native button semantics', async () => {
  const ecMode = await fs.readFile(new URL('../src/pages/Home/EcMode.jsx', import.meta.url), 'utf8');
  const skuPanel = await fs.readFile(new URL('../src/pages/Home/ec/SkuPanel.jsx', import.meta.url), 'utf8');
  const app = await fs.readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');

  assert.match(ecMode, /<button type="button" key=\{btn\.key\}/);
  assert.match(ecMode, /aria-expanded=\{isOpen\}/);
  assert.match(skuPanel, /<button type="button" aria-label=\{`删除变体 \$\{idx \+ 1\}`\}/);
  assert.doesNotMatch(skuPanel, /<div onClick=\{\(\) => rm\(sku\.id\)\}/);
  assert.match(app, /<button key=\{i\} type="button"[\s\S]{0,160}aria-current=/);
});
