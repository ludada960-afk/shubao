import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildEcommerceTaskWork,
  createEcommerceTaskWorkPersistence,
} from '../server/ecommerceEngine/workPersistence.mjs';
import { createEcommerceProjectLifecycle } from '../server/ecommerceEngine/projectLifecycle.mjs';

const URL_A = `/api/generated-assets/${'a'.repeat(64)}.png`;
const URL_B = `/api/generated-assets/${'b'.repeat(64)}.jpg`;

function job(overrides = {}) {
  return {
    id: 'task-123',
    ownerEmail: 'owner@example.com',
    status: 'generating',
    progress: {
      projectId: 'project-1',
      sourceVersionId: 'source-version-1',
      generationRunId: 'task-123',
      assetPlanFingerprint: 'plan-fingerprint',
    },
    payload: {
      product_name: 'Nova Hub',
      category: '数码3C',
      platform: '淘宝',
      selling_points: '双接口快充，铝合金机身',
      material: '阳极氧化铝',
      restrictions: '不得改变接口数量',
      skus: [{ color: '深空灰', capacity: '8 合 1' }],
      detail_plan: { material: true, feature: true },
      maintenance: '避免液体进入接口',
      direction: { id: 'direction-premium', title: '科技轻奢' },
      assets: {
        product: [
          { assetId: 'product-front', url: '/api/ecommerce-assets/product-front', role: 'product', name: '产品正面' },
          { assetId: 'product-side', url: '/api/ecommerce-assets/product-side', role: 'product', name: '产品侧面' },
        ],
        reference: [{ assetId: 'style-1', url: '/api/ecommerce-assets/style-1', role: 'reference' }],
      },
    },
    ...overrides,
  };
}

function asset(assetId, state, stableUrl, role, purpose, extra = {}) {
  return {
    assetId,
    state,
    stableUrl,
    requestSnapshot: {
      assetPlanItem: { id: assetId, role, purpose, ...extra },
    },
  };
}

test('work snapshots preserve source roles and complete buyer-facing delivery metadata', () => {
  const work = buildEcommerceTaskWork({
    job: job(),
    status: 'generating',
    assets: [
      asset('main-1', 'completed', URL_A, 'main_text', '商品识别主图', { ratio: '1:1', generationSize: '2048x2048' }),
      asset('white-1', 'completed', URL_B, 'white_background', '白底首图', { ratio: '1:1', generationSize: '2048x2048' }),
      asset('detail-1', 'quality_check', URL_B, 'detail_slice_material', '材质细节'),
      asset('detail-2', 'failed', '', 'detail_slice_usage', '使用场景'),
    ],
  });

  assert.equal(work._saveKey, 'ec-task-task-123');
  assert.equal(work.taskId, 'task-123');
  assert.equal(work.generationStatus, 'generating');
  assert.equal(work.projectId, 'project-1');
  assert.equal(work.sourceVersionId, 'source-version-1');
  assert.equal(work.generationRunId, 'task-123');
  assert.equal(work.assetPlanFingerprint, 'plan-fingerprint');
  assert.deepEqual(work.productAssets, [
    { assetId: 'product-front', url: '/api/ecommerce-assets/product-front', role: 'product', name: '产品正面' },
    { assetId: 'product-side', url: '/api/ecommerce-assets/product-side', role: 'product', name: '产品侧面' },
  ]);
  assert.deepEqual(work.referenceAssets, [
    { assetId: 'style-1', url: '/api/ecommerce-assets/style-1', role: 'reference' },
  ]);
  assert.equal(work.selling_points, '双接口快充，铝合金机身');
  assert.equal(work.material, '阳极氧化铝');
  assert.equal(work.restrictions, '不得改变接口数量');
  assert.deepEqual(work.skus, [{ color: '深空灰', capacity: '8 合 1' }]);
  assert.deepEqual(work.detail_plan, { material: true, feature: true });
  assert.equal(work.maintenance, '避免液体进入接口');
  assert.deepEqual(work.direction, { id: 'direction-premium', title: '科技轻奢' });
  assert.deepEqual(work.images, [{
    key: 'main-1',
    label: '商品识别主图',
    displayName: '商品识别主图',
    role: 'main_text',
    style: '商品识别主图',
    name: '商品识别主图',
    group: '主图',
    ratio: '1:1',
    size: '2048x2048',
    width: 2048,
    height: 2048,
    url: URL_A,
  }, {
    key: 'white-1',
    label: '白底首图',
    displayName: '白底首图',
    role: 'white_background',
    style: '白底首图',
    name: '白底首图',
    group: '白底图',
    ratio: '1:1',
    size: '2048x2048',
    width: 2048,
    height: 2048,
    url: URL_B,
  }]);
});

test('work snapshots preserve global commerce context for Works and Canvas recovery', () => {
  const base = job();
  const work = buildEcommerceTaskWork({
    job: job({
      payload: {
        ...base.payload,
        platform: 'amazon',
        commerce_context: {
          platform: 'amazon',
          contentType: 'detail',
          targetLanguage: 'en',
          locale: 'en-US',
          policyVersion: 'global-commerce-v1',
        },
      },
    }),
    assets: [asset('main-1', 'completed', URL_A, 'main_text', '商品识别主图')],
    status: 'completed',
  });

  assert.equal(work.platform, 'amazon');
  assert.equal(work.contentType, 'detail');
  assert.equal(work.targetLanguage, 'en');
  assert.deepEqual(work.commerceContext, {
    platform: 'amazon',
    contentType: 'detail',
    targetLanguage: 'en',
    locale: 'en-US',
    policyVersion: 'global-commerce-v1',
  });
});

test('incremental persistence serializes concurrent updates and finalizes the same work', async () => {
  const writes = [];
  const persistence = createEcommerceTaskWorkPersistence({
    upsertWork: async work => {
      await Promise.resolve();
      writes.push(structuredClone(work));
      return work._saveKey;
    },
  });
  const firstAssets = [asset('main-1', 'completed', URL_A, 'main_text', '商品识别主图')];
  const finalAssets = [
    ...firstAssets,
    asset('detail-1', 'completed', URL_B, 'detail_slice_material', '材质细节'),
  ];

  await Promise.all([
    persistence.persist({ job: job(), status: 'generating', assets: firstAssets }),
    persistence.persist({ job: job({ status: 'completed' }), status: 'completed', assets: finalAssets }),
  ]);

  assert.equal(writes.length, 2);
  assert.ok(writes.every(work => work._saveKey === 'ec-task-task-123'));
  assert.equal(writes[0].images.length, 1);
  assert.equal(writes[1].images.length, 2);
  assert.equal(writes[1].generationStatus, 'completed');
});

test('an all-rejected task never creates an empty needs-review work record', async () => {
  const writes = [];
  const persistence = createEcommerceTaskWorkPersistence({
    upsertWork: async work => writes.push(work),
  });

  const result = await persistence.persist({
    job: job({ status: 'needs_review' }),
    status: 'needs_review',
    assets: [asset('main-1', 'needs_review', URL_A, 'main_text', '商品识别主图')],
  });

  assert.equal(result, null);
  assert.deepEqual(writes, []);
});

test('project result versions keep public asset delivery metadata without private provider fields', async () => {
  let completionInput = null;
  const lifecycle = createEcommerceProjectLifecycle({
    projectStore: {
      ensureEcommerceGeneration() {},
      terminateEcommerceGeneration() {},
      completeEcommerceGeneration(input) {
        completionInput = input;
        return {
          project: { id: 'project-1' },
          sourceVersion: { id: 'source-version-1' },
          resultVersion: { id: 'result-version-1' },
          run: { id: 'task-123' },
        };
      },
    },
  });

  await lifecycle.complete({
    job: job(),
    status: 'needs_review',
    output: { images: { 'main-1': URL_A } },
    assets: [
      {
        assetId: 'main-1',
        state: 'completed',
        stableUrl: URL_A,
        outputUrl: 'https://provider.example/main.png',
        providerJobId: 'provider-main',
        requestSnapshot: {
          prompt: 'private request',
          assetPlanItem: {
            id: 'main-1',
            role: 'main_text',
            purpose: '商品识别主图',
            ratio: '1:1',
            generationSize: '2048x2048',
            productAssetIds: ['product-front', 'product-side'],
            styleReferenceIds: ['style-1'],
          },
        },
      },
      {
        assetId: 'detail-1',
        state: 'needs_review',
        stableUrl: URL_B,
        outputUrl: 'https://provider.example/detail.png',
        providerJobId: 'provider-detail',
        requestSnapshot: { prompt: 'private rejected request' },
      },
    ],
  });

  assert.equal(completionInput.terminalStatus, 'needs_review');
  assert.deepEqual(completionInput.resultInputSnapshot.assets, [
    {
      assetId: 'main-1',
      state: 'completed',
      stableUrl: URL_A,
      metadata: {
        label: '商品识别主图',
        displayName: '商品识别主图',
        name: '商品识别主图',
        role: 'main_text',
        group: '主图',
        ratio: '1:1',
        size: '2048x2048',
        width: 2048,
        height: 2048,
        source: 'ecommerce-generation',
        aigc: { generated: true, provenanceVersion: 'aigc-v1' },
        provenance: {
          type: 'ai-generated',
          route: 'ecommerce',
          planItemId: 'main-1',
          sourceAssetIds: ['product-front', 'product-side', 'style-1'],
        },
      },
    },
    { assetId: 'detail-1', state: 'needs_review' },
  ]);
});

test('project lifecycle forwards input asset identity into the canonical project boundary', async () => {
  let beginInput = null;
  const lifecycle = createEcommerceProjectLifecycle({
    projectStore: {
      ensureEcommerceGeneration(input) {
        beginInput = input;
        return {
          project: { id: 'project-1' },
          sourceVersion: { id: 'source-version-1' },
          run: { id: 'task-123' },
        };
      },
      terminateEcommerceGeneration() {},
      completeEcommerceGeneration() {},
    },
  });

  await lifecycle.begin({
    job: job(),
    assetPlan: [{ id: 'main-1' }],
    holdId: 'hold-1',
  });

  assert.deepEqual(beginInput.assets, job().payload.assets);
});
