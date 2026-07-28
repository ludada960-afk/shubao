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
    },
    ...overrides,
  };
}

function asset(assetId, state, stableUrl, role, purpose) {
  return {
    assetId,
    state,
    stableUrl,
    requestSnapshot: {
      assetPlanItem: { id: assetId, role, purpose },
    },
  };
}

test('work snapshots include only final stable deliverables and keep one save key per task', () => {
  const work = buildEcommerceTaskWork({
    job: job(),
    status: 'generating',
    assets: [
      asset('main-1', 'completed', URL_A, 'main_text', '商品识别主图'),
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
  assert.deepEqual(work.images, [{
    key: 'main-1',
    label: '商品识别主图',
    role: 'main_text',
    style: '商品识别主图',
    url: URL_A,
  }]);
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

test('project result versions keep only public asset delivery fields', async () => {
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
        requestSnapshot: { prompt: 'private request' },
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
    { assetId: 'main-1', state: 'completed', stableUrl: URL_A },
    { assetId: 'detail-1', state: 'needs_review' },
  ]);
});
