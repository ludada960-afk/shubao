import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';

import { buildAssetPlan } from '../server/ecommerceEngine/assetPlanner.mjs';

async function planModel() {
  return import(`../src/pages/Home/ec/ecommercePlanModel.js?billing-ui=${Date.now()}-${Math.random()}`);
}

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
    { key: 'detail', count: 5, ratio: '3:4' },
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
    { key: 'detail', count: 4, ratio: '3:4' },
    { key: 'transparent', count: 1, ratio: '1:1' },
  ]);
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
  assert.equal(new Set(serverPlan.map(item => item.id)).size, serverPlan.length);
  assert.deepEqual(serverPlan, buildAssetPlan({
    productTruth: productTruth(),
    campaignBible: { confirmed: true, referenceAssetIds: [] },
    platform: input.platform,
    sizing: { ...input.sizing, resolution: input.resolution },
    skus: input.skus,
  }));
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

test('quote copy is product-facing and keeps unlimited owner non-numeric', async () => {
  const { formatEcommerceQuote } = await planModel();

  assert.equal(formatEcommerceQuote({
    quantity: 9,
    quote: { totalUnits: 9000, currency: 'ec_points' },
  }), '生成 9 张 · 9 AI 积分');
  assert.equal(formatEcommerceQuote({
    quantity: 9,
    quote: { totalUnits: 9000, currency: 'ec_points' },
    unlimited: true,
  }), '生成 9 张 · 无限内测');
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
      { assetId: 'product-original-1', url: '/api/generated-assets/product-original-1.png', file: rawFile },
    ],
    supplementalProductAssets: [
      { assetId: 'product-supplement-1', previewUrl: 'blob:supplement' },
    ],
    originalReferenceAssets: [
      { assetId: 'reference-original-1', url: 'data:image/png;base64,REFERENCE' },
    ],
    supplementalReferenceAssets: [
      { assetId: 'reference-supplement-1', bytes: new Uint8Array([1, 2, 3]) },
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
        original: ['product-original-1'],
        supplemental: ['product-supplement-1'],
      },
      reference: {
        original: ['reference-original-1'],
        supplemental: ['reference-supplement-1'],
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

test('direction confirmation requests an authoritative quote instead of embedding prices', async () => {
  const source = await fs.readFile(new URL('../src/pages/Home/ec/DesignDirection.jsx', import.meta.url), 'utf8');

  assert.match(source, /quoteBillingAction/);
  assert.match(source, /formatEcommerceQuote/);
  assert.match(source, /billingQuoteId:\s*billingQuote\.quoteId/);
  assert.match(source, /buildEcommercePendingAction/);
  assert.match(source, /ownerEmail:\s*state\.(?:email|phone)/);
  assert.match(source, /draftId:\s*params\?\.draftId/);
  assert.match(source, /quoteId:\s*billingQuote\.quoteId/);
  assert.doesNotMatch(source, /providerCost|milli|gpt-image|中转站/);
});

test('first step creates one stable ecommerce draft id and passes it into direction confirmation', async () => {
  const source = await fs.readFile(new URL('../src/pages/Home/EcMode.jsx', import.meta.url), 'utf8');

  assert.match(source, /createEcommerceDraftId/);
  assert.match(source, /useState\(\(\)\s*=>\s*createEcommerceDraftId\(\)\)/);
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
