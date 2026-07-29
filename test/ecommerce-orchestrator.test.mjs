import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import Database from 'better-sqlite3';

import { createEcommerceOrchestrator } from '../server/ecommerceEngine/orchestrator.mjs';
import { createVisualAnalysisService } from '../server/ecommerceEngine/visualAnalysisService.mjs';
import { createVisualAnalysisStore } from '../server/ecommerceEngine/visualAnalysisStore.mjs';
import { createGenerationJobs } from '../server/generationJobs.mjs';

const OWNER = '867550189@qq.com';
const PNG_A = `/api/generated-assets/${'a'.repeat(64)}.png`;
const PNG_B = `/api/generated-assets/${'b'.repeat(64)}.png`;
const IMAGE_BUFFER = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function planItem(id, role = 'main') {
  return {
    id,
    role,
    purpose: `${role} purpose`,
    generationSize: '2048x2048',
    ratio: '1:1',
    generationMode: 'edit',
    productAssetIds: ['product-front'],
    styleReferenceIds: [],
    requiredFacts: [],
    riskLevel: 'low',
    qualityChecks: ['technical_dimensions'],
    exportTargets: [],
  };
}

async function createHarness(t, {
  items = [planItem('main-one')],
  analyze,
  campaign,
  buildPlan,
  quality,
  poll,
  hold,
  settle,
  release,
  releaseRemainder,
  stableContentType = 'image/png',
  orchestratorOptions = {},
  jobsOptions = {},
} = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'shubao-orchestrator-'));
  const jobs = createGenerationJobs(join(directory, 'jobs.db'), jobsOptions);
  t.after(async () => {
    jobs.close();
    await rm(directory, { recursive: true, force: true });
  });
  const calls = {
    analyze: 0,
    campaign: 0,
    plan: 0,
    compile: [],
    compileAssets: [],
    analyzePayloads: [],
    submit: [],
    poll: [],
    persist: [],
    persistBuffer: [],
    read: [],
    quality: [],
    repair: [],
    hold: [],
    settle: [],
    release: [],
    releaseRemainder: [],
    sequence: [],
    scheduled: 0,
  };
  let providerIndex = 0;
  let stableIndex = 0;
  const billingHolds = new Map();
  const deps = {
    jobs,
    schedule: () => {
      calls.scheduled += 1;
    },
    analyzeVisualInputs: async payload => {
      calls.analyze += 1;
      calls.analyzePayloads.push(payload);
      calls.sequence.push('analyze');
      const productTruth = analyze ? await analyze({ payload, calls }) : {
          productName: payload.product_name,
          category: payload.category,
          sourceAssetIds: (payload.assets?.product || []).map(asset => asset.assetId),
          fingerprint: 'truth-fingerprint',
          confirmedFacts: {},
          forbiddenMutations: [],
        };
      return {
        productTruth,
        styleReferenceProfile: {
          palette: ['#f5f0eb'],
          lighting: 'soft studio',
          composition: 'centered hero',
          sourceAssetIds: (payload.assets?.reference || []).map(asset => asset.assetId),
          prohibitedTransfers: ['reference products', 'brands', 'logos', 'source copy'],
          confidence: 0.9,
        },
        cache: { product: 'product-cache-key', style: 'style-cache-key' },
      };
    },
    compileCampaignBible: (direction, overrides, styleReferenceProfile) => {
      calls.campaign += 1;
      calls.sequence.push('campaign');
      if (campaign) return campaign({ direction, overrides, styleReferenceProfile, calls });
      return {
        directionId: direction.id,
        title: direction.title,
        editableBrief: overrides.editableBrief,
        palette: styleReferenceProfile.palette,
        referenceAssetIds: styleReferenceProfile.sourceAssetIds,
        confirmed: true,
      };
    },
    buildAssetPlan: input => {
      calls.plan += 1;
      calls.sequence.push('plan');
      if (buildPlan) return buildPlan({ input, calls });
      return items;
    },
    compileAssetRequest: ({ assetPlanItem, assets }) => {
      calls.compile.push(assetPlanItem.id);
      calls.compileAssets.push(assets);
      calls.sequence.push(`compile:${assetPlanItem.id}`);
      return {
        prompt: `generate ${assetPlanItem.id}`,
        modelRoute: {
          model: 'gpt-image-2',
          size: assetPlanItem.generationSize,
          async: true,
          mode: 'edit',
        },
        inputAssets: [{
          assetId: 'product-front',
          buffer: IMAGE_BUFFER,
          contentType: 'image/png',
          fileName: 'product-front.png',
        }],
      };
    },
    compileRepairRequest: ({ request, repairAction, attempt }) => ({
      ...request,
      prompt: `${request.prompt}; repair ${repairAction.type}; attempt ${attempt}`,
    }),
    providerAdapter: {
      async submitEdit(request) {
        calls.submit.push(request);
        calls.sequence.push(`submit:${request.idempotencyKey}`);
        providerIndex += 1;
        return { jobId: `provider-${providerIndex}`, status: 'queued' };
      },
      async pollUntilReady(providerJobId) {
        calls.poll.push(providerJobId);
        calls.sequence.push(`poll:${providerJobId}`);
        if (poll) return poll({ providerJobId, calls });
        return {
          jobId: providerJobId,
          status: 'completed',
          outputUrl: `https://provider.example/${providerJobId}.png`,
        };
      },
    },
    generatedAssetStore: {
      async persist({ sourceUrl, taskId, label }) {
        calls.persist.push({ sourceUrl, taskId, label });
        calls.sequence.push(`persist:${label}`);
        stableIndex += 1;
        const url = stableIndex % 2 === 1 ? PNG_A : PNG_B;
        return { id: url.split('/').pop(), url, contentType: stableContentType, label };
      },
      async read(assetId) {
        calls.read.push(assetId);
        calls.sequence.push(`read:${assetId}`);
        return { buffer: IMAGE_BUFFER, contentType: stableContentType };
      },
      async persistBuffer({ buffer, contentType, taskId, label }) {
        calls.persistBuffer.push({ buffer, contentType, taskId, label });
        calls.sequence.push(`persist-buffer:${label}`);
        stableIndex += 1;
        const url = stableIndex % 2 === 1 ? PNG_A : PNG_B;
        return { id: url.split('/').pop(), url, contentType, label };
      },
    },
    evaluateAsset: async input => {
      calls.quality.push(input);
      calls.sequence.push(`quality:${input.assetPlanItem.id}`);
      if (quality) return quality({ input, calls });
      return {
        passed: true,
        checks: {},
        repairAction: { type: 'none', focusIssueCodes: [], userCharge: false },
        confidence: 'high',
      };
    },
    planRepair: result => result.repairAction,
    canRetry: (attempt, repairAction = {}) => Number.isInteger(attempt)
      && attempt >= 0
      && attempt < (repairAction.type === 'sharp_repair' ? 2 : 1),
    billing: {
      async hold({ job, assetPlan }) {
        calls.hold.push({ jobId: job.id, itemIds: assetPlan.map(item => item.id) });
        if (hold) return hold({ job, assetPlan, calls });
        if (!billingHolds.has(job.id)) billingHolds.set(job.id, { id: `hold-${job.id}` });
        return billingHolds.get(job.id);
      },
      async settle({ holdId, item, stableAsset }) {
        calls.settle.push({ holdId, itemId: item.id, stableUrl: stableAsset.url });
        calls.sequence.push(`settle:${item.id}`);
        if (settle) return settle({ holdId, item, stableAsset, calls });
        return { status: 'settled', itemKey: item.id };
      },
      async release({ holdId, item, reason }) {
        calls.release.push({ holdId, itemId: item.id, reason });
        calls.sequence.push(`release:${item.id}`);
        if (release) return release({ holdId, item, reason, calls });
        return { status: 'released', itemKey: item.id };
      },
      async releaseRemainder({ holdId, job, reason }) {
        calls.releaseRemainder.push({ holdId, jobId: job.id, reason });
        calls.sequence.push(`release-remainder:${job.id}`);
        if (releaseRemainder) return releaseRemainder({ holdId, job, reason, calls });
        return { status: 'released', holdId };
      },
    },
  };
  return {
    jobs,
    calls,
    orchestrator: createEcommerceOrchestrator({ ...deps, ...orchestratorOptions }),
  };
}

function jobInput(id) {
  return {
    id,
    ownerEmail: OWNER,
    payload: {
      product_name: '测试商品',
      category: '数码3C',
      platform: '淘宝',
      direction: {
        id: 'direction-one',
        title: '专业棚拍',
        editableBrief: '克制、清晰、突出商品结构',
      },
      assets: {
        product: [{ assetId: 'product-front', url: '/api/ecommerce/assets/front' }],
        reference: [],
      },
    },
  };
}

test('runs the required sequence, persists stable bytes, and settles one successful item', async t => {
  const { orchestrator, jobs, calls } = await createHarness(t);
  const created = orchestrator.createJob(jobInput('job-success'));
  assert.equal(created.status, 'queued');

  const completed = await orchestrator.runJob(created.id);

  assert.equal(completed.status, 'completed');
  assert.equal(calls.submit.length, 1);
  assert.equal(calls.poll.length, 1);
  assert.equal(calls.persist.length, 1);
  assert.equal(calls.quality.length, 1);
  assert.equal(calls.settle.length, 1);
  assert.equal(calls.release.length, 0);
  assert.ok(calls.sequence.indexOf('analyze') < calls.sequence.indexOf('campaign'));
  assert.ok(calls.sequence.indexOf('campaign') < calls.sequence.indexOf('plan'));
  assert.ok(calls.sequence.findIndex(value => value.startsWith('submit:'))
    < calls.sequence.findIndex(value => value.startsWith('poll:')));
  assert.ok(calls.sequence.findIndex(value => value.startsWith('persist:'))
    < calls.sequence.findIndex(value => value.startsWith('quality:')));
  assert.ok(calls.sequence.findIndex(value => value.startsWith('quality:'))
    < calls.sequence.findIndex(value => value.startsWith('settle:')));
  assert.deepEqual(jobs.assets.listAssets(created.id).map(asset => ({
    state: asset.state,
    stableUrl: asset.stableUrl,
  })), [{ state: 'completed', stableUrl: PNG_A }]);
});

test('visual failure stops before billing and never submits provider work', async t => {
  const failure = Object.assign(new Error('图片分析服务暂时不可用'), {
    code: 'VISUAL_ANALYSIS_UNAVAILABLE',
    status: 503,
    retryable: true,
  });
  const { orchestrator, jobs, calls } = await createHarness(t, {
    orchestratorOptions: {
      analyzeVisualInputs: async () => { throw failure; },
    },
  });
  const created = orchestrator.createJob(jobInput('job-visual-failure'));

  await assert.rejects(
    () => orchestrator.runJob(created.id),
    error => error?.code === 'VISUAL_ANALYSIS_UNAVAILABLE',
  );

  assert.equal(calls.hold.length, 0);
  assert.equal(calls.submit.length, 0);
  assert.equal(jobs.get(created.id).status, 'analyzing');
  assert.equal(jobs.get(created.id).progress.orchestrationSnapshot, undefined);
});

test('invalid visual result stops before billing and never submits provider work', async t => {
  const analysisDb = new Database(':memory:');
  t.after(() => analysisDb.close());
  const service = createVisualAnalysisService({
    store: createVisualAnalysisStore(analysisDb),
    model: 'gpt-5.6-terra',
    promptVersion: 'invalid-result-test',
    readAsset: async () => ({ buffer: IMAGE_BUFFER, contentType: 'image/png' }),
    callVision: async () => ({ productName: 'Untrusted Product', confidence: 'high' }),
  });
  const { orchestrator, calls } = await createHarness(t, {
    orchestratorOptions: {
      analyzeVisualInputs: payload => service.analyze({
        productAssets: payload.assets.product,
        styleAssets: payload.assets.reference,
        userFacts: { productName: payload.product_name },
      }),
    },
  });
  const created = orchestrator.createJob(jobInput('job-invalid-visual-result'));

  await assert.rejects(
    () => orchestrator.runJob(created.id),
    error => error?.code === 'VISUAL_ANALYSIS_INVALID_RESPONSE',
  );

  assert.equal(calls.hold.length, 0);
  assert.equal(calls.submit.length, 0);
});

test('rejects malformed formal product and reference payloads before billing', async t => {
  const malformedCases = [
    {
      label: 'reference group is not an array',
      mutate: payload => { payload.assets.reference = { assetId: 'style-one', url: '/style-one.png' }; },
    },
    {
      label: 'reference entry has no URL',
      mutate: payload => { payload.assets.reference = [{ assetId: 'style-no-url' }]; },
    },
    {
      label: 'reference entry has no ID',
      mutate: payload => { payload.assets.reference = [{ url: '/style-no-id.png' }]; },
    },
    {
      label: 'reference entry has an invalid ID',
      mutate: payload => {
        payload.assets.reference = [{ assetId: 'invalid style id', url: '/style-invalid-id.png' }];
      },
    },
    {
      label: 'product entry has no URL',
      mutate: payload => { payload.assets.product = [{ assetId: 'product-no-url' }]; },
    },
    {
      label: 'legacy reference URL has no durable ID',
      mutate: payload => {
        delete payload.assets.reference;
        payload.reference_images = ['/api/ec-temp-img/style.png'];
      },
    },
  ];

  for (const [index, current] of malformedCases.entries()) {
    await t.test(current.label, async t => {
      const analysisDb = new Database(':memory:');
      t.after(() => analysisDb.close());
      const service = createVisualAnalysisService({
        store: createVisualAnalysisStore(analysisDb),
        model: 'gpt-5.6-terra',
        promptVersion: 'orchestrator-payload-validation-test',
        readAsset: async () => ({ buffer: IMAGE_BUFFER, contentType: 'image/png' }),
        callVision: async ({ type }) => type === 'product'
          ? { productName: 'Vision Product', confidence: 0.9 }
          : { palette: ['#ffffff'], confidence: 0.9 },
      });
      const { orchestrator, calls } = await createHarness(t, {
        orchestratorOptions: {
          analyzeVisualInputs: payload => service.analyze({
            productAssets: payload.assets.product,
            styleAssets: payload.assets.reference,
            userFacts: { productName: payload.product_name },
          }),
        },
      });
      const input = jobInput(`job-malformed-visual-assets-${index + 1}`);
      current.mutate(input.payload);
      const created = orchestrator.createJob(input);

      const failed = await orchestrator.runJob(created.id);

      assert.equal(failed.status, 'failed');
      assert.equal(failed.output.errors[0].code, 'VISUAL_ANALYSIS_INVALID_INPUT');
      assert.equal(failed.output.errors[0].status, 400);
      assert.equal(failed.output.errors[0].retryable, false);
      assert.equal(calls.hold.length, 0);
      assert.equal(calls.submit.length, 0);
    });
  }
});

test('allows product-only visual analysis when the optional reference group is absent', async t => {
  const analysisDb = new Database(':memory:');
  t.after(() => analysisDb.close());
  const visionTypes = [];
  const service = createVisualAnalysisService({
    store: createVisualAnalysisStore(analysisDb),
    model: 'gpt-5.6-terra',
    promptVersion: 'orchestrator-product-only-test',
    readAsset: async () => ({ buffer: IMAGE_BUFFER, contentType: 'image/png' }),
    callVision: async ({ type }) => {
      visionTypes.push(type);
      return { productName: 'Vision Product', confidence: 0.9 };
    },
  });
  const { orchestrator, calls } = await createHarness(t, {
    orchestratorOptions: {
      analyzeVisualInputs: payload => service.analyze({
        productAssets: payload.assets.product,
        styleAssets: payload.assets.reference,
        userFacts: { productName: payload.product_name },
      }),
    },
  });
  const input = jobInput('job-product-only-analysis');
  delete input.payload.assets.reference;

  const completed = await orchestrator.runJob(orchestrator.createJob(input).id);

  assert.equal(completed.status, 'completed');
  assert.deepEqual(visionTypes, ['product']);
  assert.equal(calls.hold.length, 1);
  assert.equal(calls.submit.length, 1);
});

test('passes protected product text and logos into quality review before settlement', async t => {
  const item = {
    ...planItem('main-with-label'),
    requiredFacts: [{ name: 'modelName', value: 'S-100' }],
  };
  const { orchestrator, calls } = await createHarness(t, {
    items: [item],
    analyze: ({ payload }) => ({
      productName: payload.product_name,
      category: payload.category,
      sourceAssetIds: ['product-front'],
      packageText: [{ text: 'S-100', confidence: 0.99, sourceAssetId: 'product-front' }],
      logos: [{ description: 'SHUBAO', confidence: 0.99, sourceAssetId: 'product-front' }],
      confirmedFacts: { modelName: { value: 'S-100', source: 'ocr' } },
      fingerprint: 'truth-with-protected-copy',
    }),
    quality: ({ input }) => {
      const protectedCopyReachedGate = input.requiredText?.includes('S-100')
        && input.requiredLogos?.includes('SHUBAO');
      return protectedCopyReachedGate
        ? {
            passed: false,
            retryable: true,
            checks: { copyAndLogo: { status: 'unavailable', issueCodes: ['adapter_unavailable'] } },
            repairAction: { type: 'none', focusIssueCodes: [], userCharge: false },
            confidence: 'medium',
          }
        : {
            passed: true,
            checks: {},
            repairAction: { type: 'none', focusIssueCodes: [], userCharge: false },
            confidence: 'high',
          };
    },
    orchestratorOptions: { canRetry: () => false },
  });
  const created = orchestrator.createJob(jobInput('job-protected-copy-quality'));

  const result = await orchestrator.runJob(created.id);

  assert.equal(result.status, 'needs_review');
  assert.deepEqual(calls.quality[0].requiredText, ['S-100']);
  assert.deepEqual(calls.quality[0].requiredLogos, ['SHUBAO']);
  assert.equal(calls.settle.length, 0);
  assert.equal(calls.release.length, 1);
});

test('always requires PNG quality output for transparent plan items', async t => {
  const { orchestrator, calls } = await createHarness(t, {
    items: [planItem('transparent', 'transparent')],
    stableContentType: 'image/jpeg',
  });
  const created = orchestrator.createJob(jobInput('job-transparent-format'));

  await orchestrator.runJob(created.id);

  assert.equal(calls.quality.length, 1);
  assert.equal(calls.quality[0].expectedFormat, 'png');
});

test('runs independent assets with bounded per-task concurrency', async t => {
  let active = 0;
  let maxActive = 0;
  const { orchestrator } = await createHarness(t, {
    items: [planItem('a'), planItem('b'), planItem('c'), planItem('d')],
    orchestratorOptions: { assetConcurrency: 3 },
    poll: async ({ providerJobId }) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise(resolve => setTimeout(resolve, 15));
      active -= 1;
      return { jobId: providerJobId, status: 'completed', outputUrl: `https://provider.example/${providerJobId}.png` };
    },
  });

  const created = orchestrator.createJob(jobInput('job-bounded-concurrency'));
  const completed = await orchestrator.runJob(created.id);

  assert.equal(completed.status, 'completed');
  assert.equal(maxActive, 3);
});

test('waits for in-flight asset workers to settle before releasing a failed parent runner', async t => {
  let slowWorkerCompleted = false;
  const { orchestrator, calls } = await createHarness(t, {
    items: [planItem('a'), planItem('b'), planItem('c')],
    orchestratorOptions: { assetConcurrency: 2 },
    poll: async ({ providerJobId }) => {
      if (providerJobId === 'provider-1') {
        throw Object.assign(new Error('temporary provider failure'), { retryable: true });
      }
      await new Promise(resolve => setTimeout(resolve, 25));
      slowWorkerCompleted = true;
      return { jobId: providerJobId, status: 'completed', outputUrl: `https://provider.example/${providerJobId}.png` };
    },
  });
  const created = orchestrator.createJob(jobInput('job-worker-convergence'));

  await assert.rejects(() => orchestrator.runJob(created.id), /temporary provider failure/);

  assert.equal(slowWorkerCompleted, true);
  assert.equal(calls.submit.length, 2);
});

test('createJob only persists queued work and does not start a second background runner', async t => {
  const { orchestrator, calls } = await createHarness(t);

  const created = orchestrator.createJob(jobInput('job-no-double-schedule'));

  assert.equal(created.status, 'queued');
  assert.equal(calls.scheduled, 0);
  assert.equal(calls.submit.length, 0);
});

test('preserves explicit legacy alias asset identities before analysis and compilation', async t => {
  const { orchestrator, calls } = await createHarness(t);
  const created = orchestrator.createJob({
    id: 'job-legacy-assets',
    ownerEmail: OWNER,
    payload: {
      product_name: '测试商品',
      category: '数码3C',
      platform: '淘宝',
      real_shots: [
        { assetId: 'legacy-product-front', url: '/api/ec-temp-img/front.png' },
        { assetId: 'legacy-product-side', url: '/api/ec-temp-img/side.png' },
      ],
      reference_images: [
        { assetId: 'legacy-style', url: '/api/ec-temp-img/style.png' },
      ],
    },
  });

  await orchestrator.runJob(created.id);

  assert.deepEqual(calls.analyzePayloads[0].assets, {
    product: [
      { assetId: 'legacy-product-front', url: '/api/ec-temp-img/front.png' },
      { assetId: 'legacy-product-side', url: '/api/ec-temp-img/side.png' },
    ],
    reference: [
      { assetId: 'legacy-style', url: '/api/ec-temp-img/style.png' },
    ],
    proof: [],
    protection: [],
  });
  assert.deepEqual(calls.compileAssets[0], calls.analyzePayloads[0].assets);
});

test('caps provider-backed system repair at one and releases a needs-review item without settlement', async t => {
  const { orchestrator, jobs, calls } = await createHarness(t, {
    quality: () => ({
      passed: false,
      checks: { visualQuality: { status: 'fail', issueCodes: ['local_artifact'] } },
      repairAction: {
        type: 'image_edit',
        focusIssueCodes: ['local_artifact'],
        userCharge: false,
      },
      confidence: 'low',
    }),
  });
  const created = orchestrator.createJob(jobInput('job-repair-cap'));

  const completed = await orchestrator.runJob(created.id);
  const asset = jobs.assets.getAsset(created.id, 'main-one');

  assert.equal(completed.status, 'needs_review');
  assert.equal(asset.state, 'needs_review');
  assert.equal(asset.attemptCount, 1);
  assert.equal(calls.submit.length, 2, 'initial provider task plus one bounded system repair');
  assert.equal(calls.quality.length, 2);
  assert.equal(calls.settle.length, 0);
  assert.deepEqual(calls.release.map(call => call.itemId), ['main-one']);
});

test('terminalizes a zero-delivery project before closing the task without an empty work', async t => {
  const lifecycle = [];
  const { orchestrator } = await createHarness(t, {
    quality: () => ({
      passed: false,
      checks: { productFidelity: { status: 'fail', issueCodes: ['product_identity_mismatch'] } },
      repairAction: {
        type: 'regenerate_from_product_truth',
        focusIssueCodes: ['product_identity_mismatch'],
        userCharge: false,
      },
      confidence: 'low',
    }),
    orchestratorOptions: {
      canRetry: () => false,
      projectLifecycle: {
        async begin({ job }) {
          return { projectId: 'project-empty', sourceVersionId: 'source-empty', generationRunId: job.id, assetPlanFingerprint: 'empty-fingerprint' };
        },
        async complete() {
          throw new Error('zero-delivery task must not create a result version');
        },
        async terminate({ job, status }) {
          lifecycle.push(['terminate', status]);
          return { projectId: 'project-empty', sourceVersionId: 'source-empty', generationRunId: job.id };
        },
      },
      persistWorkSnapshot: async ({ status }) => {
        lifecycle.push(['persist', status]);
        return null;
      },
    },
  });

  const completed = await orchestrator.runJob(orchestrator.createJob(jobInput('job-empty-review')).id);

  assert.equal(completed.status, 'needs_review');
  assert.deepEqual(completed.output.images, {});
  assert.deepEqual(lifecycle, [
    ['terminate', 'needs_review'],
    ['persist', 'needs_review'],
  ]);
});

test('suite diversity retries only the duplicate item before settlement and keeps the retry cap', async t => {
  const checks = new Map();
  const { orchestrator, calls } = await createHarness(t, {
    items: [planItem('main-one', 'main_text'), planItem('main-two', 'main_text')],
    orchestratorOptions: {
      assetConcurrency: 1,
      evaluateSuiteDiversity: async ({ candidate, existing }) => {
        const count = (checks.get(candidate.assetId) || 0) + 1;
        checks.set(candidate.assetId, count);
        if (candidate.assetId === 'main-two' && count === 1) {
          assert.equal(existing.length, 1);
          return {
            passed: false,
            issueCodes: ['suite_near_duplicate'],
            details: { duplicateOf: existing[0].assetId },
          };
        }
        return { passed: true, issueCodes: [], details: {} };
      },
    },
  });

  const created = orchestrator.createJob(jobInput('job-suite-diversity'));
  const result = await orchestrator.runJob(created.id);

  assert.equal(result.status, 'completed');
  assert.equal(calls.submit.length, 3, 'two initial renders plus one targeted duplicate repair');
  assert.equal(calls.settle.length, 2);
  assert.equal(calls.release.length, 0);
  assert.equal(checks.get('main-one'), 1);
  assert.equal(checks.get('main-two'), 2);
});

test('completes the immutable project result version before terminal task persistence', async t => {
  const lifecycle = [];
  const { orchestrator } = await createHarness(t, {
    orchestratorOptions: {
      projectLifecycle: {
        async begin({ job, assetPlan, holdId }) {
          lifecycle.push(['begin', job.id, assetPlan.length, holdId]);
          return {
            projectId: 'project-1',
            sourceVersionId: 'source-version-1',
            generationRunId: job.id,
            assetPlanFingerprint: 'plan-fingerprint',
          };
        },
        async complete({ job, output }) {
          lifecycle.push(['complete', job.id, Object.keys(output.images).length]);
          return { resultVersionId: 'result-version-1' };
        },
        async terminate() {
          throw new Error('completed task must not use no-result termination');
        },
      },
      persistWorkSnapshot: async ({ job, status }) => {
        lifecycle.push(['persist', status, job.progress.resultVersionId || '']);
      },
    },
  });

  const created = orchestrator.createJob(jobInput('job-project-lifecycle'));
  const result = await orchestrator.runJob(created.id);

  assert.equal(result.status, 'completed');
  assert.equal(result.progress.projectId, 'project-1');
  assert.equal(result.progress.resultVersionId, 'result-version-1');
  assert.deepEqual(lifecycle.at(-2), ['complete', created.id, 1]);
  assert.deepEqual(lifecycle.at(-1), ['persist', 'completed', 'result-version-1']);
});

test('persists each delivered asset incrementally and finalizes one task work', async t => {
  const snapshots = [];
  const { orchestrator } = await createHarness(t, {
    items: [planItem('main-one'), planItem('detail-one', 'detail_slice_material')],
    orchestratorOptions: {
      assetConcurrency: 1,
      persistWorkSnapshot: async snapshot => {
        snapshots.push({
          status: snapshot.status,
          completed: snapshot.assets.filter(asset => asset.state === 'completed').map(asset => asset.assetId),
        });
      },
    },
  });
  const created = orchestrator.createJob(jobInput('job-incremental-work'));

  const completed = await orchestrator.runJob(created.id);

  assert.equal(completed.status, 'completed');
  assert.deepEqual(snapshots, [
    { status: 'generating', completed: ['main-one'] },
    { status: 'generating', completed: ['detail-one', 'main-one'] },
    { status: 'completed', completed: ['detail-one', 'main-one'] },
  ]);
});

test('keeps a completed asset and parent task resumable when incremental work persistence fails', async t => {
  const { orchestrator, jobs, calls } = await createHarness(t, {
    orchestratorOptions: {
      persistWorkSnapshot: async () => {
        throw new Error('works database temporarily unavailable');
      },
    },
  });
  const created = orchestrator.createJob(jobInput('job-work-persistence-retry'));

  await assert.rejects(
    () => orchestrator.runJob(created.id),
    error => error?.retryable === true && /works database/.test(error.message),
  );

  assert.equal(jobs.get(created.id).status, 'generating');
  assert.equal(jobs.assets.getAsset(created.id, 'main-one').state, 'completed');
  assert.equal(calls.settle.length, 1);
});

test('reruns product-fidelity quality after deterministic repair and never settles a failed repair', async t => {
  let qualityAttempt = 0;
  const productTruth = {
    productName: '银色测试商品',
    category: '数码3C',
    sourceAssetIds: ['product-front'],
    primaryColors: ['银色'],
    materials: ['铝合金'],
    fingerprint: 'truth-silver',
    confirmedFacts: {},
    forbiddenMutations: [],
  };
  const { orchestrator, calls } = await createHarness(t, {
    items: [planItem('transparent-one', 'transparent')],
    analyze: () => productTruth,
    quality: () => {
      qualityAttempt += 1;
      if (qualityAttempt === 1) {
        return {
          passed: false,
          checks: {
            platformCompliance: {
              status: 'fail',
              issueCodes: ['transparent_background_missing'],
            },
          },
          repairAction: {
            type: 'sharp_repair',
            focusIssueCodes: ['transparent_background_missing'],
            operations: ['normalize_transparent_background'],
            userCharge: false,
          },
          confidence: 'low',
        };
      }
      return {
        passed: false,
        checks: {
          productFidelity: {
            status: 'fail',
            issueCodes: ['product_identity_mismatch'],
          },
        },
        repairAction: {
          type: 'regenerate_from_product_truth',
          focusIssueCodes: ['product_identity_mismatch'],
          userCharge: false,
        },
        confidence: 'low',
      };
    },
    orchestratorOptions: {
      repairAsset: async input => {
        calls.repair.push(input);
        return { buffer: IMAGE_BUFFER, contentType: 'image/png' };
      },
      canRetry: attempt => attempt === 0,
    },
  });
  const created = orchestrator.createJob(jobInput('job-transparent-fidelity-review'));

  const completed = await orchestrator.runJob(created.id);

  assert.equal(completed.status, 'needs_review');
  assert.equal(calls.repair.length, 1);
  assert.deepEqual(calls.repair[0].productTruth, productTruth);
  assert.equal(calls.quality.length, 2);
  assert.equal(calls.quality[1].productTruth.fingerprint, 'truth-silver');
  assert.equal(calls.settle.length, 0);
  assert.deepEqual(calls.release.map(call => call.itemId), ['transparent-one']);
});

test('settles only successful assets in a partial batch and releases the failed item', async t => {
  const lifecycle = [];
  const { orchestrator, calls } = await createHarness(t, {
    items: [planItem('main-pass'), planItem('detail-fail', 'detail')],
    quality: ({ input }) => input.assetPlanItem.id === 'main-pass'
      ? {
        passed: true,
        checks: {},
        repairAction: { type: 'none', focusIssueCodes: [], userCharge: false },
        confidence: 'high',
      }
      : {
        passed: false,
        checks: { productFidelity: { status: 'fail', issueCodes: ['product_identity_mismatch'] } },
        repairAction: {
          type: 'regenerate_from_product_truth',
          focusIssueCodes: ['product_identity_mismatch'],
          userCharge: false,
        },
        confidence: 'low',
      },
    orchestratorOptions: {
      projectLifecycle: {
        async begin({ job }) {
          return { projectId: 'project-partial', sourceVersionId: 'source-partial', generationRunId: job.id, assetPlanFingerprint: 'partial-fingerprint' };
        },
        async complete({ job, output, status }) {
          lifecycle.push(['complete', status, Object.keys(output.images)]);
          return { resultVersionId: 'result-partial', generationRunId: job.id };
        },
        async terminate() {
          throw new Error('partial delivery must create a result version');
        },
      },
      persistWorkSnapshot: async ({ job, status }) => {
        lifecycle.push(['persist', status, job.progress.resultVersionId || '']);
      },
    },
  });
  const created = orchestrator.createJob(jobInput('job-partial'));

  const completed = await orchestrator.runJob(created.id);

  assert.equal(completed.status, 'needs_review');
  assert.deepEqual(calls.settle.map(call => call.itemId), ['main-pass']);
  assert.deepEqual(calls.release.map(call => call.itemId), ['detail-fail']);
  assert.deepEqual(Object.keys(completed.output.images), ['main-pass']);
  assert.equal(completed.progress.resultVersionId, 'result-partial');
  assert.equal(completed.assets.find(asset => asset.assetId === 'main-pass').stableUrl, PNG_A);
  const rejected = completed.assets.find(asset => asset.assetId === 'detail-fail');
  assert.equal(rejected.stableUrl, undefined);
  assert.equal(rejected.outputUrl, undefined);
  assert.equal(rejected.providerJobId, undefined);
  assert.equal(rejected.requestSnapshot, undefined);
  assert.equal(rejected.error, '图片未通过质量检查，本张未计费');
  assert.equal(completed.output.errors[0].error, '图片未通过质量检查，本张未计费');
  assert.deepEqual(lifecycle, [
    ['persist', 'generating', ''],
    ['complete', 'needs_review', ['main-pass']],
    ['persist', 'needs_review', 'result-partial'],
  ]);
});

test('validates the complete asset plan before creating a billing hold', async t => {
  const invalid = planItem('invalid id with spaces');
  const { orchestrator, calls } = await createHarness(t, {
    items: [planItem('valid-first'), invalid],
  });
  const created = orchestrator.createJob(jobInput('job-invalid-plan'));

  const failed = await orchestrator.runJob(created.id);

  assert.equal(failed.status, 'failed');
  assert.equal(calls.hold.length, 0);
  assert.equal(calls.submit.length, 0);
});

test('releases every planned hold item before terminalizing a parent setup failure', async t => {
  const items = [planItem('main-one'), planItem('detail-two', 'detail')];
  const lifecycle = [];
  const { orchestrator, jobs, calls } = await createHarness(t, {
    items,
    orchestratorOptions: {
      projectLifecycle: {
        async begin({ job }) {
          lifecycle.push(['begin', job.id]);
          return { projectId: 'project-setup', sourceVersionId: 'source-setup', generationRunId: job.id, assetPlanFingerprint: 'setup-fingerprint' };
        },
        async complete() {
          throw new Error('setup failure must not create a result version');
        },
        async terminate({ job, status }) {
          lifecycle.push(['terminate', status]);
          return { projectId: 'project-setup', sourceVersionId: 'source-setup', generationRunId: job.id };
        },
      },
    },
  });
  const createAsset = jobs.assets.createAsset;
  let setupWrites = 0;
  jobs.assets.createAsset = input => {
    if (setupWrites++ === 0) throw new Error('asset row setup failed');
    return createAsset(input);
  };
  const created = orchestrator.createJob(jobInput('job-setup-release'));

  const failed = await orchestrator.runJob(created.id);

  assert.equal(failed.status, 'failed');
  assert.equal(calls.hold.length, 1);
  assert.equal(calls.releaseRemainder.length, 1);
  assert.equal(calls.release.length, 0);
  assert.equal(calls.submit.length, 0);
  assert.deepEqual(lifecycle, [
    ['begin', created.id],
    ['terminate', 'failed'],
  ]);
});

test('keeps parent hold compensation recoverable until every setup release succeeds', async t => {
  let releaseAttempts = 0;
  const { orchestrator, jobs, calls } = await createHarness(t, {
    releaseRemainder: ({ holdId }) => {
      releaseAttempts += 1;
      if (releaseAttempts <= 2) throw new Error('temporary parent release lock');
      return { status: 'released', holdId };
    },
  });
  jobs.assets.createAsset = () => {
    throw new Error('asset row setup failed');
  };
  const created = orchestrator.createJob(jobInput('job-setup-release-retry'));

  await assert.rejects(orchestrator.runJob(created.id), /temporary parent release lock/);
  assert.equal(jobs.get(created.id).status, 'analyzing');
  assert.ok(jobs.get(created.id).progress.setupRelease);

  await assert.rejects(orchestrator.runJob(created.id), /temporary parent release lock/);
  assert.equal(releaseAttempts, 2);
  assert.equal(jobs.get(created.id).status, 'analyzing');

  const failed = await orchestrator.runJob(created.id);

  assert.equal(failed.status, 'failed');
  assert.equal(releaseAttempts, 3);
  assert.equal(calls.releaseRemainder.length, 3);
  assert.equal(calls.release.length, 0);
});

test('resumes a persisted provider job without duplicate submission', async t => {
  const { orchestrator, jobs, calls } = await createHarness(t);
  jobs.create(jobInput('job-resume'));
  jobs.transition('job-resume', 'analyzing');
  jobs.transition('job-resume', 'generating', { progress: { holdId: 'hold-job-resume' } });
  jobs.assets.createAsset({
    jobId: 'job-resume',
    assetId: 'main-one',
    requestSnapshot: { assetPlanItem: planItem('main-one') },
  });
  const lease = jobs.assets.claimAsset('job-resume', 'main-one');
  jobs.assets.markSubmitted('job-resume', 'main-one', {
    providerJobId: 'provider-existing',
    leaseToken: lease.leaseToken,
  });
  jobs.assets.transitionAsset('job-resume', 'main-one', 'polling', {
    leaseToken: lease.leaseToken,
  });
  jobs.assets.releaseLease('job-resume', 'main-one', lease.leaseToken);

  const completed = await orchestrator.runJob('job-resume');

  assert.equal(completed.status, 'completed');
  assert.equal(calls.submit.length, 0);
  assert.deepEqual(calls.poll, ['provider-existing']);
  assert.equal(calls.settle.length, 1);
});

test('persists a sanitized orchestration snapshot before hold and reuses its original plan on resume', async t => {
  let pollAttempts = 0;
  const firstPlan = planItem('main-original');
  firstPlan.privatePath = 'C:\\secret\\asset.png';
  const changedPlan = planItem('main-changed');
  const { orchestrator, jobs, calls } = await createHarness(t, {
    analyze: ({ payload }) => ({
      productName: payload.product_name,
      category: payload.category,
      fingerprint: 'truth-first',
      confirmedFacts: {},
      forbiddenMutations: [],
      authorization: 'Bearer must-not-persist',
    }),
    campaign: () => ({
      directionId: 'direction-one',
      title: '专业棚拍',
      editableBrief: 'first campaign',
      dataUrl: 'data:image/png;base64,secret',
    }),
    buildPlan: ({ calls: currentCalls }) => currentCalls.plan === 1 ? [firstPlan] : [changedPlan],
    poll: async ({ providerJobId }) => {
      pollAttempts += 1;
      if (pollAttempts === 1) {
        throw Object.assign(new Error('temporary provider timeout'), { retryable: true });
      }
      return {
        jobId: providerJobId,
        status: 'completed',
        outputUrl: `https://provider.example/${providerJobId}.png`,
      };
    },
  });
  const created = orchestrator.createJob(jobInput('job-snapshot-resume'));

  await assert.rejects(orchestrator.runJob(created.id), /temporary provider timeout/);
  const afterFirstRun = jobs.get(created.id);
  assert.deepEqual(afterFirstRun.progress.orchestrationSnapshot, {
    schemaVersion: 2,
    productTruth: {
      productName: '测试商品',
      category: '数码3C',
      fingerprint: 'truth-first',
      confirmedFacts: {},
      forbiddenMutations: [],
    },
    styleReferenceProfile: {
      palette: ['#f5f0eb'],
      lighting: 'soft studio',
      composition: 'centered hero',
      sourceAssetIds: [],
      prohibitedTransfers: ['reference products', 'brands', 'logos', 'source copy'],
      confidence: 0.9,
    },
    visualAnalysisCache: {
      product: 'product-cache-key',
      style: 'style-cache-key',
    },
    campaignBible: {
      directionId: 'direction-one',
      title: '专业棚拍',
      editableBrief: 'first campaign',
    },
    assetPlan: [{
      id: 'main-original',
      role: 'main',
      purpose: 'main purpose',
      generationSize: '2048x2048',
      ratio: '1:1',
      generationMode: 'edit',
      productAssetIds: ['product-front'],
      styleReferenceIds: [],
      requiredFacts: [],
      riskLevel: 'low',
      qualityChecks: ['technical_dimensions'],
      exportTargets: [],
    }],
    deterministicInputs: {
      assets: {
        product: [{ assetId: 'product-front', url: '/api/ecommerce/assets/front' }],
        reference: [],
        proof: [],
        protection: [],
      },
      platform: '淘宝',
      sizing: {},
      skus: [],
    },
    holdId: 'hold-job-snapshot-resume',
  });
  assert.equal(afterFirstRun.progress.holdId, 'hold-job-snapshot-resume');

  const completed = await orchestrator.runJob(created.id);

  assert.equal(completed.status, 'completed');
  assert.equal(calls.analyze, 1);
  assert.equal(calls.campaign, 1);
  assert.equal(calls.plan, 1);
  assert.equal(calls.hold.length, 1);
  assert.deepEqual(jobs.assets.listAssets(created.id).map(asset => asset.assetId), ['main-original']);
});

test('migrates an unversioned pre-Task-1 snapshot without repeating analysis, planning, or billing', async t => {
  const originalPlan = planItem('main-legacy');
  const { orchestrator, jobs, calls } = await createHarness(t, {
    items: [planItem('main-new')],
  });
  const created = jobs.create(jobInput('job-legacy-snapshot'));
  jobs.transition(created.id, 'analyzing');
  jobs.transition(created.id, 'generating', {
    progress: {
      orchestrationSnapshot: {
        productTruth: {
          productName: '测试商品',
          category: '数码3C',
          fingerprint: 'legacy-truth',
          confirmedFacts: {},
          forbiddenMutations: [],
        },
        campaignBible: {
          directionId: 'direction-one',
          title: '专业棚拍',
          editableBrief: 'legacy campaign',
        },
        assetPlan: [originalPlan],
        deterministicInputs: {
          assets: {
            product: [{ assetId: 'product-front', url: '/api/ecommerce/assets/front' }],
            reference: [],
            proof: [],
            protection: [],
          },
          platform: '淘宝',
          sizing: {},
          skus: [],
        },
        holdId: 'hold-job-legacy-snapshot',
      },
      holdId: 'hold-job-legacy-snapshot',
    },
  });

  const completed = await orchestrator.runJob(created.id);

  assert.equal(completed.status, 'completed');
  assert.equal(calls.analyze, 0);
  assert.equal(calls.campaign, 0);
  assert.equal(calls.plan, 0);
  assert.equal(calls.hold.length, 0);
  assert.deepEqual(calls.compile, ['main-legacy']);
  assert.equal(jobs.get(created.id).progress.orchestrationSnapshot.schemaVersion, 1);
});

test('fails closed for a current snapshot missing required visual analysis fields', async t => {
  const { orchestrator, jobs, calls } = await createHarness(t);
  const created = jobs.create(jobInput('job-invalid-current-snapshot'));
  jobs.transition(created.id, 'analyzing');
  jobs.transition(created.id, 'generating', {
    progress: {
      orchestrationSnapshot: {
        schemaVersion: 2,
        productTruth: {
          productName: '测试商品',
          category: '数码3C',
          fingerprint: 'current-truth',
        },
        campaignBible: {
          directionId: 'direction-one',
          title: '专业棚拍',
          editableBrief: 'current campaign',
        },
        assetPlan: [planItem('main-current')],
        deterministicInputs: {
          assets: {
            product: [{ assetId: 'product-front', url: '/api/ecommerce/assets/front' }],
            reference: [],
            proof: [],
            protection: [],
          },
          platform: '淘宝',
          sizing: {},
          skus: [],
        },
        holdId: 'hold-job-invalid-current-snapshot',
      },
      holdId: 'hold-job-invalid-current-snapshot',
    },
  });

  const failed = await orchestrator.runJob(created.id);

  assert.equal(failed.status, 'failed');
  assert.equal(failed.output.errors[0].code, 'ORCHESTRATION_SNAPSHOT_INVALID');
  assert.equal(calls.analyze, 0);
  assert.equal(calls.campaign, 0);
  assert.equal(calls.plan, 0);
  assert.equal(calls.hold.length, 0);
  assert.equal(calls.submit.length, 0);
});

test('resumeJobs preserves and renews the fenced parent lease returned by claimNext', async t => {
  const { orchestrator, jobs } = await createHarness(t, {
    orchestratorOptions: {
      parentLeaseMs: 80,
      parentLeaseHeartbeatMs: 20,
    },
    poll: async ({ providerJobId }) => {
      await new Promise(resolve => setTimeout(resolve, 220));
      return {
        jobId: providerJobId,
        status: 'completed',
        outputUrl: `https://provider.example/${providerJobId}.png`,
      };
    },
  });
  const created = orchestrator.createJob(jobInput('job-parent-resume-lease'));
  const originalClaimNext = jobs.claimNext;
  const originalRenewLease = jobs.renewLease;
  let claimedToken = '';
  let renewals = 0;
  jobs.claimNext = (...args) => {
    const claimed = originalClaimNext(...args);
    if (claimed) claimedToken = claimed.leaseToken;
    return claimed;
  };
  jobs.renewLease = (...args) => {
    renewals += 1;
    return originalRenewLease(...args);
  };

  const results = await orchestrator.resumeJobs();

  assert.equal(results.length, 1);
  assert.equal(results[0].status, 'fulfilled');
  assert.ok(claimedToken);
  assert.ok(renewals >= 3);
  assert.equal(jobs.get(created.id).status, 'completed');
  assert.equal(jobs.get(created.id).leaseToken, null);
});

test('a stale parent lease owner cannot transition after another worker acquires the job', () => {
  let nowMs = Date.parse('2026-07-26T00:00:00.000Z');
  let tokenIndex = 0;
  const jobs = createGenerationJobs(':memory:', {
    now: () => nowMs,
    randomUUID: () => `parent-token-${++tokenIndex}`,
    defaultLeaseMs: 50,
  });
  try {
    jobs.create(jobInput('job-parent-stale'));
    const first = jobs.claimNext();
    nowMs += 60;
    const second = jobs.claim('job-parent-stale');

    assert.notEqual(first.leaseToken, second.leaseToken);
    assert.throws(
      () => jobs.transition('job-parent-stale', 'generating', { leaseToken: first.leaseToken }),
      /lease/i,
    );
    assert.equal(
      jobs.transition('job-parent-stale', 'generating', { leaseToken: second.leaseToken }).status,
      'generating',
    );
  } finally {
    jobs.close();
  }
});

test('a concurrent runner leaves actively leased assets generating instead of failing the parent', async t => {
  let releasePoll;
  const pollGate = new Promise(resolve => { releasePoll = resolve; });
  const { orchestrator, calls } = await createHarness(t, {
    poll: async ({ providerJobId }) => {
      await pollGate;
      return {
        jobId: providerJobId,
        status: 'completed',
        outputUrl: `https://provider.example/${providerJobId}.png`,
      };
    },
  });
  const created = orchestrator.createJob(jobInput('job-concurrent'));
  const firstRun = orchestrator.runJob(created.id);
  while (calls.poll.length === 0) await new Promise(resolve => setImmediate(resolve));

  const concurrent = await orchestrator.runJob(created.id);

  assert.equal(concurrent.status, 'generating');
  assert.equal(concurrent.assets[0].state, 'polling');
  releasePoll();
  assert.equal((await firstRun).status, 'completed');
  assert.equal(calls.submit.length, 1);
});

test('a transient settlement failure preserves quality-checked work for idempotent resume', async t => {
  let settlementAttempts = 0;
  const { orchestrator, jobs, calls } = await createHarness(t, {
    settle: ({ item }) => {
      settlementAttempts += 1;
      if (settlementAttempts === 1) throw new Error('temporary ledger lock');
      return { status: 'settled', itemKey: item.id };
    },
  });
  const created = orchestrator.createJob(jobInput('job-settlement-resume'));

  await assert.rejects(orchestrator.runJob(created.id), /temporary ledger lock/);
  assert.equal(jobs.assets.getAsset(created.id, 'main-one').state, 'settling');
  assert.equal(calls.submit.length, 1);
  assert.equal(calls.release.length, 0);

  const completed = await orchestrator.runJob(created.id);
  assert.equal(completed.status, 'completed');
  assert.equal(calls.submit.length, 1);
  assert.equal(calls.settle.length, 2);
});

test('replays a confirmed settlement after the local completion transition fails without releasing the item', async t => {
  const { orchestrator, jobs, calls } = await createHarness(t);
  const transitionAsset = jobs.assets.transitionAsset;
  let completionWrites = 0;
  jobs.assets.transitionAsset = (...args) => {
    if (args[2] === 'completed' && completionWrites++ === 0) {
      throw new Error('local completion write failed');
    }
    return transitionAsset(...args);
  };
  const created = orchestrator.createJob(jobInput('job-settled-local-failure'));

  await assert.rejects(orchestrator.runJob(created.id), /local completion write failed/);
  assert.equal(jobs.assets.getAsset(created.id, 'main-one').state, 'settling');
  assert.equal(calls.settle.length, 1);
  assert.equal(calls.release.length, 0);

  const completed = await orchestrator.runJob(created.id);

  assert.equal(completed.status, 'completed');
  assert.equal(jobs.assets.getAsset(created.id, 'main-one').state, 'completed');
  assert.equal(calls.submit.length, 1);
  assert.equal(calls.settle.length, 2);
  assert.equal(calls.release.length, 0);
});

test('keeps a quality release recoverable and retries the same item on resume', async t => {
  let releaseAttempts = 0;
  const { orchestrator, jobs, calls } = await createHarness(t, {
    quality: () => ({
      passed: false,
      checks: { visualQuality: { status: 'fail', issueCodes: ['local_artifact'] } },
      repairAction: {
        type: 'image_edit',
        focusIssueCodes: ['local_artifact'],
        userCharge: false,
      },
      confidence: 'low',
    }),
    release: ({ item }) => {
      releaseAttempts += 1;
      if (releaseAttempts === 1) throw new Error('temporary release lock');
      return { status: 'released', itemKey: item.id };
    },
  });
  const created = orchestrator.createJob(jobInput('job-quality-release-resume'));

  await assert.rejects(orchestrator.runJob(created.id), /temporary release lock/);
  assert.equal(jobs.assets.getAsset(created.id, 'main-one').state, 'releasing');
  assert.equal(calls.settle.length, 0);

  const resumed = await orchestrator.runJob(created.id);

  assert.equal(resumed.status, 'needs_review');
  assert.equal(jobs.assets.getAsset(created.id, 'main-one').state, 'needs_review');
  assert.equal(calls.submit.length, 2);
  assert.deepEqual(calls.release.map(call => call.itemId), ['main-one', 'main-one']);
});

test('does not swallow a failed release or terminalize a provider failure until release succeeds', async t => {
  let releaseAttempts = 0;
  const { orchestrator, jobs, calls } = await createHarness(t, {
    poll: ({ providerJobId }) => ({
      jobId: providerJobId,
      status: 'failed',
      error: 'provider rejected image',
    }),
    release: ({ item }) => {
      releaseAttempts += 1;
      if (releaseAttempts === 1) throw new Error('temporary release lock');
      return { status: 'released', itemKey: item.id };
    },
  });
  const created = orchestrator.createJob(jobInput('job-provider-release-resume'));

  await assert.rejects(orchestrator.runJob(created.id), /temporary release lock/);
  assert.equal(jobs.assets.getAsset(created.id, 'main-one').state, 'releasing');

  const resumed = await orchestrator.runJob(created.id);

  assert.equal(resumed.status, 'failed');
  assert.equal(jobs.assets.getAsset(created.id, 'main-one').state, 'failed');
  assert.equal(calls.submit.length, 1);
  assert.deepEqual(calls.release.map(call => call.itemId), ['main-one', 'main-one']);
});

test('persists a non-retryable billing failure so polling does not leave the job analyzing forever', async t => {
  const billingError = Object.assign(new Error('AI 积分不足，请购买套餐后继续'), {
    status: 402,
    code: 'BILLING_INSUFFICIENT_CREDITS',
    resumeable: true,
    required: 5000,
    available: 1000,
  });
  const { orchestrator } = await createHarness(t, {
    hold: () => {
      throw billingError;
    },
  });
  const created = orchestrator.createJob(jobInput('job-insufficient'));

  const failed = await orchestrator.runJob(created.id);

  assert.equal(failed.status, 'failed');
  assert.deepEqual(failed.output.errors, [{
    error: 'AI 积分不足，请购买套餐后继续',
    code: 'BILLING_INSUFFICIENT_CREDITS',
    status: 402,
    resumeable: true,
    required: 5000,
    available: 1000,
  }]);
});

test('persists actionable quote failures without starting provider generation', async t => {
  const quoteError = Object.assign(new Error('当前生成方案与费用确认不一致，请重新获取费用'), {
    status: 409,
    code: 'BILLING_QUOTE_MISMATCH',
    reQuoteRequired: true,
    retryable: false,
  });
  const { orchestrator, calls } = await createHarness(t, {
    hold: () => {
      throw quoteError;
    },
  });
  const created = orchestrator.createJob(jobInput('job-quote-mismatch'));

  const failed = await orchestrator.runJob(created.id);

  assert.equal(failed.status, 'failed');
  assert.deepEqual(failed.output.errors, [{
    error: '当前生成方案与费用确认不一致，请重新获取费用',
    code: 'BILLING_QUOTE_MISMATCH',
    status: 409,
    retryable: false,
    reQuoteRequired: true,
  }]);
  assert.equal(calls.submit.length, 0);
});

test('renews the fenced asset lease while a provider poll exceeds the original lease', async t => {
  const { orchestrator, jobs } = await createHarness(t, {
    orchestratorOptions: {
      assetLeaseMs: 80,
      leaseHeartbeatMs: 20,
    },
    poll: async ({ providerJobId }) => {
      await new Promise(resolve => setTimeout(resolve, 220));
      return {
        jobId: providerJobId,
        status: 'completed',
        outputUrl: `https://provider.example/${providerJobId}.png`,
      };
    },
  });
  let renewals = 0;
  const renewLease = jobs.assets.renewLease;
  jobs.assets.renewLease = (...args) => {
    renewals += 1;
    return renewLease(...args);
  };
  const created = orchestrator.createJob(jobInput('job-long-provider'));

  const completed = await orchestrator.runJob(created.id);

  assert.equal(completed.status, 'completed');
  assert.equal(jobs.assets.getAsset(created.id, 'main-one').state, 'completed');
  assert.ok(renewals >= 3);
});

test('does not rerun a completed parent job or its completed assets', async t => {
  const { orchestrator, calls } = await createHarness(t);
  const created = orchestrator.createJob(jobInput('job-replay'));
  const first = await orchestrator.runJob(created.id);
  const snapshot = {
    submit: calls.submit.length,
    poll: calls.poll.length,
    persist: calls.persist.length,
    settle: calls.settle.length,
  };

  const replay = await orchestrator.runJob(created.id);

  assert.deepEqual(replay, first);
  assert.deepEqual({
    submit: calls.submit.length,
    poll: calls.poll.length,
    persist: calls.persist.length,
    settle: calls.settle.length,
  }, snapshot);
});

test('returns owner-scoped durable job progress and rejects another owner', async t => {
  const { orchestrator } = await createHarness(t);
  const created = orchestrator.createJob(jobInput('job-owner'));

  assert.equal(orchestrator.getJob(created.id, { ownerEmail: OWNER }).id, created.id);
  assert.throws(
    () => orchestrator.getJob(created.id, { ownerEmail: 'other@example.com' }),
    error => error?.status === 403,
  );
});
