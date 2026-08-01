import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import Database from 'better-sqlite3';

import { buildAssetPlan } from '../server/ecommerceEngine/assetPlanner.mjs';
import { compileCampaignBible } from '../server/ecommerceEngine/campaignBible.mjs';
import { createEcommerceOrchestrator } from '../server/ecommerceEngine/orchestrator.mjs';
import { createLegacyVisualAssetMigration } from '../server/ecommerceEngine/legacyVisualAssetMigration.mjs';
import { createVisualAnalysisService } from '../server/ecommerceEngine/visualAnalysisService.mjs';
import { createVisualAnalysisStore } from '../server/ecommerceEngine/visualAnalysisStore.mjs';
import { createGenerationJobs } from '../server/generationJobs.mjs';

const OWNER = '867550189@qq.com';
const PNG_A = `/api/generated-assets/${'a'.repeat(64)}.png`;
const PNG_B = `/api/generated-assets/${'b'.repeat(64)}.png`;
const IMAGE_BUFFER = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const SEMANTIC_SINGLE_PRODUCT = Object.freeze({
  verdict: 'single_product',
  confidence: 0.98,
  evidence: ['one coherent product view'],
});

function withSemanticSingleProduct(result) {
  if (!result?.passed) return result;
  const visualQuality = result.checks?.visualQuality;
  if (visualQuality?.details?.layout) return result;
  return {
    ...result,
    checks: {
      ...(result.checks || {}),
      visualQuality: {
        status: 'pass',
        passed: true,
        issueCodes: [],
        metrics: {},
        details: { layout: SEMANTIC_SINGLE_PRODUCT },
        ...(visualQuality || {}),
      },
    },
  };
}

function planItem(id, role = 'main') {
  return {
    id,
    role,
    purpose: `${role} purpose`,
    communicationGoal: `${role} commercial duty for ${id}`,
    generationSize: '2048x2048',
    ratio: '1:1',
    generationMode: 'edit',
    productAssetIds: ['product-front'],
    styleReferenceIds: [],
    requiredFacts: [],
    riskLevel: 'low',
    qualityChecks: ['technical_dimensions'],
    exportTargets: [],
    shotIntent: {
      type: 'identity',
      camera: { azimuth: 12 },
      crop: 'complete product crop',
      interactionState: 'stationary',
      sceneFamily: 'studio_identity',
      evidenceTier: 'safe',
    },
  };
}

function seedPreUpgradeJobs(dbPath, entries) {
  if (!entries.length) return;
  const db = new Database(dbPath);
  db.exec(`
    CREATE TABLE ecommerce_jobs (
      id TEXT PRIMARY KEY,
      owner_email TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'queued',
      payload TEXT NOT NULL DEFAULT '{}',
      output TEXT NOT NULL DEFAULT '{}',
      error TEXT NOT NULL DEFAULT '',
      progress TEXT NOT NULL DEFAULT '{}',
      lease_token TEXT,
      lease_expires_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  const insert = db.prepare(`
    INSERT INTO ecommerce_jobs (id, owner_email, status, payload)
    VALUES (?, ?, ?, ?)
  `);
  for (const entry of entries) {
    insert.run(entry.id, entry.ownerEmail, entry.status || 'queued', JSON.stringify(entry.payload));
  }
  db.close();
}

async function createHarness(t, {
  items = [planItem('main-one')],
  analyze,
  campaign,
  buildPlan,
  quality,
  submit,
  poll,
  hold,
  settle,
  release,
  releaseRemainder,
  persist,
  persistBuffer,
  migrateLegacyVisualAsset,
  stableContentType = 'image/png',
  orchestratorOptions = {},
  jobsOptions = {},
  preUpgradeJobs = [],
} = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'shubao-orchestrator-'));
  const dbPath = join(directory, 'jobs.db');
  seedPreUpgradeJobs(dbPath, preUpgradeJobs);
  const jobs = createGenerationJobs(dbPath, jobsOptions);
  t.after(async () => {
    jobs.close();
    await rm(directory, { recursive: true, force: true });
  });
  const calls = {
    analyze: 0,
    campaign: 0,
    plan: 0,
    compile: [],
    compilePlanItems: [],
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
    migrate: [],
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
    migrateLegacyVisualAsset: async input => {
      calls.migrate.push(input);
      if (migrateLegacyVisualAsset) return migrateLegacyVisualAsset(input);
      throw Object.assign(new Error('历史图片无法读取，请重新上传'), {
        code: 'VISUAL_ANALYSIS_INVALID_INPUT',
        status: 400,
        retryable: false,
      });
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
      calls.compilePlanItems.push(assetPlanItem);
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
        if (submit) return submit({ request, calls, providerIndex });
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
        if (persist) {
          const result = await persist({ sourceUrl, taskId, label, calls });
          if (result) return result;
        }
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
        if (persistBuffer) {
          const result = await persistBuffer({ buffer, contentType, taskId, label, calls });
          if (result) return result;
        }
        const url = stableIndex % 2 === 1 ? PNG_A : PNG_B;
        return { id: url.split('/').pop(), url, contentType, label };
      },
    },
    evaluateAsset: async input => {
      calls.quality.push(input);
      calls.sequence.push(`quality:${input.assetPlanItem.id}`);
      const result = quality ? await quality({ input, calls }) : {
        passed: true,
        checks: {},
        repairAction: { type: 'none', focusIssueCodes: [], userCharge: false },
        confidence: 'high',
      };
      return withSemanticSingleProduct(result);
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

function orchestrationSnapshot(items, holdId, schemaVersion = 3) {
  return {
    schemaVersion,
    productTruth: {
      productName: '测试商品',
      category: '数码3C',
      sourceAssetIds: ['product-front'],
      fingerprint: 'truth-fingerprint',
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
    visualAnalysisCache: { product: 'product-cache-key', style: 'style-cache-key' },
    campaignBible: {
      directionId: 'direction-one',
      title: '专业棚拍',
      editableBrief: '克制、清晰、突出商品结构',
    },
    assetPlan: items,
    deterministicInputs: {
      assets: { product: [{ assetId: 'product-front', url: '/api/ecommerce/assets/front' }], reference: [], proof: [], protection: [] },
      platform: '淘宝',
      sizing: {},
      skus: [],
    },
    holdId,
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

test('preserves the confirmed direction plan through orchestration and asset execution', async t => {
  const { orchestrator, jobs, calls } = await createHarness(t, {
    campaign: ({ direction, overrides, styleReferenceProfile }) => compileCampaignBible(
      direction,
      overrides,
      styleReferenceProfile,
    ),
    buildPlan: ({ input }) => buildAssetPlan(input),
  });
  const input = jobInput('job-confirmed-creative-plan');
  input.payload.direction = {
    id: 'breakfast-benefit',
    title: '早餐场景转化方案',
    execution_guide: '以清晰识别为起点，用早餐台尺度关系解释容量收益。',
    commercial_objective: '提升用户对容量和日常使用价值的理解',
    audience: '重视早餐效率的家庭用户',
    product_strategy: {
      hero_focus: '主体结构与容量收益',
      angle_plan: '正面识别后使用安全轻侧角度',
      interaction_plan: '只展示已确认的开合状态',
      scenario_plan: '早餐台真实使用环境',
    },
    deliverables: [{
      role: 'main',
      label: '商品主图',
      count: 1,
      ratio: '1:1',
      group_strategy: '首图只承担商品识别与核心收益说明',
      shots: [{
        index: 0,
        label: '早餐容量利益主图',
        purpose: '用真实尺度说明容量优势',
        visual_execution: '商品置于早餐台，以餐具建立尺度关系并保留文案区',
        variation_key: 'breakfast-scale-benefit',
        depends_on: ['product_truth', 'campaign_bible'],
      }],
    }],
    risk_guards: ['不得虚构商品容量数值'],
  };

  const completed = await orchestrator.runJob(orchestrator.createJob(input).id);
  const snapshot = jobs.get(input.id).progress.orchestrationSnapshot;
  const main = completed.assetPlan.find(item => item.role === 'main');

  assert.equal(completed.status, 'completed');
  assert.equal(snapshot.schemaVersion, 4);
  assert.equal(snapshot.campaignBible.productStrategy.heroFocus, '主体结构与容量收益');
  assert.equal(snapshot.campaignBible.deliverables[0].shots[0].label, '早餐容量利益主图');
  assert.deepEqual(snapshot.campaignBible.riskGuards, ['不得虚构商品容量数值']);
  assert.equal(main.label, '早餐容量利益主图');
  assert.equal(main.purpose, '用真实尺度说明容量优势');
  assert.equal(main.shotIntent.creativeExecution, '商品置于早餐台，以餐具建立尺度关系并保留文案区');
  assert.equal(main.shotIntent.variationKey, 'breakfast-scale-benefit');
  assert.equal(calls.compilePlanItems.find(item => item.id === main.id).shotIntent.creativeExecution,
    '商品置于早餐台，以餐具建立尺度关系并保留文案区');
});

test('public completed assets expose the same buyer-facing delivery metadata as Works', async t => {
  const items = [
    { ...planItem('white-background', 'white_background'), label: '白底首图' },
    { ...planItem('main-text', 'main_text'), label: '核心卖点主图' },
    {
      ...planItem('detail-feature', 'detail_slice_feature'),
      label: '细节功能图',
      ratio: '3:4',
      generationSize: '1536x2048',
    },
  ];
  const { orchestrator } = await createHarness(t, { items });

  const completed = await orchestrator.runJob(orchestrator.createJob(jobInput('job-public-delivery-metadata')).id);

  assert.deepEqual(completed.assets.map(asset => ({
    assetId: asset.assetId,
    displayName: asset.displayName,
    role: asset.role,
    group: asset.group,
    ratio: asset.ratio,
    size: asset.size,
    width: asset.width,
    height: asset.height,
  })), [{
    assetId: 'detail-feature',
    displayName: '细节功能图',
    role: 'detail_slice_feature',
    group: '详情图',
    ratio: '3:4',
    size: '1536x2048',
    width: 1536,
    height: 2048,
  }, {
    assetId: 'main-text',
    displayName: '核心卖点主图',
    role: 'main_text',
    group: '主图',
    ratio: '1:1',
    size: '2048x2048',
    width: 2048,
    height: 2048,
  }, {
    assetId: 'white-background',
    displayName: '白底首图',
    role: 'white_background',
    group: '白底图',
    ratio: '1:1',
    size: '2048x2048',
    width: 2048,
    height: 2048,
  }]);
});

test('production planner default fallback validates before hold with exact execution counts', async t => {
  const { orchestrator, jobs, calls } = await createHarness(t, {
    buildPlan: ({ input }) => buildAssetPlan(input),
  });
  const created = orchestrator.createJob(jobInput('job-production-default-plan'));

  const completed = await orchestrator.runJob(created.id);

  assert.equal(completed.status, 'completed');
  assert.equal(completed.assetPlan.length, 7);
  assert.equal(calls.hold.length, 1);
  assert.equal(calls.hold[0].itemIds.length, 7);
  assert.equal(jobs.assets.listAssets(created.id).length, 7);
  assert.equal(calls.submit.length, 7);
  assert.deepEqual(completed.progress.executionCount, {
    planItems: 7,
    quoteUnits: 7,
    visibleAssetRows: 7,
    initialProviderSubmissions: 7,
    providerSubmissions: 7,
    providerRepairs: 0,
    submissionsByAsset: Object.fromEntries(completed.assetPlan
      .map(item => [item.id, 1])
      .sort(([left], [right]) => left.localeCompare(right))),
  });
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
  const { orchestrator, jobs, calls } = await createHarness(t, {
    orchestratorOptions: {
      analyzeVisualInputs: payload => service.analyze({
        productAssets: payload.assets.product,
        styleAssets: payload.assets.reference,
        userFacts: { productName: payload.product_name },
      }),
    },
  });
  const created = orchestrator.createJob(jobInput('job-invalid-visual-result'));

  await orchestrator.runJob(created.id);

  assert.equal(calls.hold.length, 0);
  assert.equal(calls.submit.length, 0);
  assert.equal(jobs.get(created.id).status, 'failed');
  assert.match(jobs.get(created.id).error, /confidence must be a finite number from 0 to 1/);
  assert.equal(jobs.get(created.id).output.errors[0].code, 'VISUAL_ANALYSIS_INVALID_RESPONSE');
  assert.equal(jobs.get(created.id).output.errors[0].retryable, false);
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
      label: 'reference entry uses a non-contract ID alias',
      mutate: payload => { payload.assets.reference = [{ id: 'style-alias', url: '/style-alias.png' }]; },
    },
    {
      label: 'reference entry uses a non-contract URL alias',
      mutate: payload => {
        payload.assets.reference = [{ assetId: 'style-url-alias', sourceUrl: '/style-alias.png' }];
      },
    },
    {
      label: 'product entry has no URL',
      mutate: payload => { payload.assets.product = [{ assetId: 'product-no-url' }]; },
    },
    {
      label: 'arbitrary remote legacy reference is untrusted',
      mutate: payload => {
        delete payload.assets.reference;
        payload.reference_images = ['https://untrusted.example/style.png'];
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

test('rejects legacy string aliases on current jobs before migration or paid work', async t => {
  const migratedProduct = {
    assetId: `${'c'.repeat(64)}.png`,
    url: `/api/generated-assets/${'c'.repeat(64)}.png`,
  };
  const { orchestrator, jobs, calls } = await createHarness(t, {
    migrateLegacyVisualAsset: async () => migratedProduct,
  });
  const created = orchestrator.createJob({
    id: 'job-current-legacy-string',
    ownerEmail: OWNER,
    payload: {
      product_name: '测试商品',
      category: '数码3C',
      real_shots: ['/api/ec-temp-img/current-product.png'],
    },
  });

  const failed = await orchestrator.runJob(created.id);

  assert.equal(jobs.get(created.id).visualInputSchemaVersion, 1);
  assert.equal(failed.status, 'failed');
  assert.equal(failed.output.errors[0].code, 'VISUAL_ANALYSIS_INVALID_INPUT');
  assert.equal(calls.migrate.length, 0);
  assert.equal(calls.analyze, 0);
  assert.equal(calls.persistBuffer.length, 0);
  assert.equal(calls.hold.length, 0);
  assert.equal(calls.submit.length, 0);
});

test('resumes queued and analyzing pre-upgrade jobs through trusted legacy asset migration', async t => {
  const migratedProduct = {
    assetId: `${'c'.repeat(64)}.png`,
    url: `/api/generated-assets/${'c'.repeat(64)}.png`,
  };
  const migratedReference = {
    assetId: `${'d'.repeat(64)}.png`,
    url: `/api/generated-assets/${'d'.repeat(64)}.png`,
  };

  for (const initialStatus of ['queued', 'analyzing']) {
    await t.test(initialStatus, async t => {
      const input = {
        id: `job-legacy-${initialStatus}`,
        ownerEmail: OWNER,
        payload: {
          product_name: '测试商品',
          category: '数码3C',
          platform: '淘宝',
          real_shots: ['/api/ec-temp-img/product.png'],
          reference_images: ['/api/ec-temp-img/reference.png'],
        },
      };
      const { orchestrator, jobs, calls } = await createHarness(t, {
        preUpgradeJobs: [{ ...input, status: initialStatus }],
        migrateLegacyVisualAsset: async ({ source }) => source.includes('product')
          ? migratedProduct
          : migratedReference,
      });
      const created = jobs.get(input.id);

      const completed = await orchestrator.runJob(created.id);

      assert.equal(completed.status, 'completed');
      assert.deepEqual(calls.migrate.map(({ source, type, index, jobId, job, ownerEmail }) => ({
        source,
        type,
        index,
        jobId,
        hasCallerOwner: Boolean(job || ownerEmail),
      })), [
        {
          source: '/api/ec-temp-img/product.png',
          type: 'product',
          index: 0,
          jobId: created.id,
          hasCallerOwner: false,
        },
        {
          source: '/api/ec-temp-img/reference.png',
          type: 'reference',
          index: 0,
          jobId: created.id,
          hasCallerOwner: false,
        },
      ]);
      const expectedAssets = {
        product: [migratedProduct],
        reference: [migratedReference],
        proof: [],
        protection: [],
      };
      assert.deepEqual(calls.analyzePayloads[0].assets, expectedAssets);
      assert.deepEqual(jobs.get(created.id).progress.visualInputSnapshot, {
        schemaVersion: 1,
        assets: expectedAssets,
      });
      assert.equal(calls.hold.length, 1);
      assert.equal(calls.submit.length, 1);
    });
  }
});

test('reuses checkpointed legacy inputs after a pre-analysis crash without duplicate work or hold', async t => {
  const migratedProduct = {
    assetId: `${'e'.repeat(64)}.png`,
    url: `/api/generated-assets/${'e'.repeat(64)}.png`,
  };
  const input = {
    id: 'job-legacy-checkpoint-crash',
    ownerEmail: OWNER,
    payload: {
      product_name: '测试商品',
      category: '数码3C',
      platform: '淘宝',
      real_shots: ['/api/ec-temp-img/product.png'],
    },
  };
  const { orchestrator, jobs, calls } = await createHarness(t, {
    preUpgradeJobs: [input],
    migrateLegacyVisualAsset: async () => migratedProduct,
  });
  const created = jobs.get(input.id);
  const checkpoint = jobs.checkpoint;
  let injectedCrash = false;
  jobs.checkpoint = (...args) => {
    const result = checkpoint(...args);
    const progress = args[1]?.progress;
    if (!injectedCrash && progress?.visualInputSnapshot && !progress?.orchestrationSnapshot) {
      injectedCrash = true;
      throw Object.assign(new Error('simulated crash after visual input checkpoint'), {
        retryable: true,
      });
    }
    return result;
  };

  await assert.rejects(
    () => orchestrator.runJob(created.id),
    /simulated crash after visual input checkpoint/,
  );
  assert.equal(calls.migrate.length, 1);
  assert.equal(calls.analyze, 0);
  assert.equal(calls.hold.length, 0);
  assert.deepEqual(jobs.get(created.id).progress.visualInputSnapshot.assets.product, [migratedProduct]);

  jobs.checkpoint = checkpoint;
  const completed = await orchestrator.runJob(created.id);

  assert.equal(completed.status, 'completed');
  assert.equal(calls.migrate.length, 1);
  assert.equal(calls.analyze, 1);
  assert.equal(calls.hold.length, 1);
  assert.equal(calls.submit.length, 1);
});

test('keeps a pre-upgrade job resumable when stable migration storage is transiently unavailable', async t => {
  const migratedProduct = {
    assetId: `${'f'.repeat(64)}.png`,
    url: `/api/generated-assets/${'f'.repeat(64)}.png`,
  };
  const input = {
    id: 'job-legacy-storage-resume',
    ownerEmail: OWNER,
    payload: {
      product_name: '测试商品',
      category: '数码3C',
      real_shots: ['/api/ec-temp-img/product.png'],
    },
  };
  let attempts = 0;
  const { orchestrator, jobs, calls } = await createHarness(t, {
    preUpgradeJobs: [input],
    migrateLegacyVisualAsset: async () => {
      attempts += 1;
      if (attempts === 1) {
        throw Object.assign(new Error('stable storage unavailable'), {
          code: 'VISUAL_ANALYSIS_UNAVAILABLE',
          status: 503,
          retryable: true,
        });
      }
      return migratedProduct;
    },
  });

  await assert.rejects(
    () => orchestrator.runJob(input.id),
    error => error?.code === 'VISUAL_ANALYSIS_UNAVAILABLE' && error?.retryable === true,
  );
  assert.equal(jobs.get(input.id).status, 'analyzing');
  assert.equal(calls.hold.length, 0);
  assert.equal(calls.submit.length, 0);

  const completed = await orchestrator.runJob(input.id);

  assert.equal(completed.status, 'completed');
  assert.equal(calls.migrate.length, 2);
  assert.equal(calls.analyze, 1);
  assert.equal(calls.hold.length, 1);
  assert.equal(calls.submit.length, 1);
});

test('resumes after a transient legacy input read without duplicate pre-billing work', async t => {
  const source = '/api/ec-temp-img/transient-read.png';
  const input = {
    id: 'job-legacy-read-resume',
    ownerEmail: OWNER,
    payload: {
      product_name: '测试商品',
      category: '数码3C',
      real_shots: [source],
    },
  };
  let migrate;
  const { orchestrator, jobs, calls } = await createHarness(t, {
    preUpgradeJobs: [input],
    migrateLegacyVisualAsset: request => migrate(request),
  });
  const readError = Object.assign(new Error('temporary input read failure'), { code: 'EIO' });
  let readCalls = 0;
  let persistCalls = 0;
  const digest = createHash('sha256').update(IMAGE_BUFFER).digest('hex');
  const assetId = `${digest}.png`;
  const stableUrl = `/api/generated-assets/${assetId}`;
  migrate = createLegacyVisualAssetMigration({
    imageInputReader: {
      async read() {
        readCalls += 1;
        if (readCalls === 1) throw readError;
        return { buffer: IMAGE_BUFFER, contentType: 'image/png' };
      },
    },
    generatedAssetStore: {
      async persistBuffer() {
        persistCalls += 1;
        return { id: assetId, url: stableUrl, contentType: 'image/png' };
      },
    },
    getJob: id => jobs.get(id),
    getOwnedAsset: async () => { throw new Error('temp migration must not use owner lookup'); },
  });

  await assert.rejects(
    () => orchestrator.runJob(input.id),
    error => error?.code === 'VISUAL_ANALYSIS_UNAVAILABLE'
      && error?.retryable === true
      && error?.cause === readError,
  );
  assert.equal(jobs.get(input.id).status, 'analyzing');
  assert.equal(jobs.get(input.id).progress.visualInputSnapshot, undefined);
  assert.equal(persistCalls, 0);
  assert.equal(calls.analyze, 0);
  assert.equal(calls.hold.length, 0);
  assert.equal(calls.submit.length, 0);

  const completed = await orchestrator.runJob(input.id);

  assert.equal(completed.status, 'completed');
  assert.equal(readCalls, 2);
  assert.equal(persistCalls, 1);
  assert.equal(calls.migrate.length, 2);
  assert.equal(calls.analyze, 1);
  assert.equal(calls.hold.length, 1);
  assert.equal(calls.submit.length, 1);
  assert.deepEqual(jobs.get(input.id).progress.visualInputSnapshot.assets.product, [{
    assetId,
    url: stableUrl,
  }]);
});

test('fails without charging when protected-copy review service is unavailable', async t => {
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

  assert.equal(result.status, 'failed');
  assert.deepEqual(calls.quality[0].requiredText, ['S-100']);
  assert.deepEqual(calls.quality[0].requiredLogos, ['SHUBAO']);
  assert.equal(calls.settle.length, 0);
  assert.equal(calls.release.length, 1);
  assert.equal(calls.release[0].reason, 'quality_service_unavailable');
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

test('serializes memory-heavy quality review while provider tasks remain concurrent', async t => {
  let providerActive = 0;
  let maxProviderActive = 0;
  let qualityActive = 0;
  let maxQualityActive = 0;
  const { orchestrator } = await createHarness(t, {
    items: [planItem('a'), planItem('b'), planItem('c')],
    orchestratorOptions: { assetConcurrency: 3 },
    poll: async ({ providerJobId }) => {
      providerActive += 1;
      maxProviderActive = Math.max(maxProviderActive, providerActive);
      await new Promise(resolve => setTimeout(resolve, 10));
      providerActive -= 1;
      return { jobId: providerJobId, status: 'completed', outputUrl: `https://provider.example/${providerJobId}.png` };
    },
    quality: async () => {
      qualityActive += 1;
      maxQualityActive = Math.max(maxQualityActive, qualityActive);
      await new Promise(resolve => setTimeout(resolve, 10));
      qualityActive -= 1;
      return {
        passed: true,
        checks: {},
        repairAction: { type: 'none', focusIssueCodes: [], userCharge: false },
        confidence: 'high',
      };
    },
  });

  const completed = await orchestrator.runJob(orchestrator.createJob(jobInput('job-quality-memory')).id);

  assert.equal(completed.status, 'completed');
  assert.equal(maxProviderActive, 3);
  assert.equal(maxQualityActive, 1);
});

test('three quoted plan items create exactly three visible assets and three provider submissions', async t => {
  const plan = [planItem('main-1'), planItem('main-2'), planItem('main-3')];
  const { orchestrator, calls } = await createHarness(t, {
    items: plan,
    orchestratorOptions: { assetConcurrency: 1 },
  });

  const result = await orchestrator.runJob(orchestrator.createJob(jobInput('job-exact-count')).id);

  assert.equal(result.assetPlan.length, 3);
  assert.equal(result.assets.length, 3);
  assert.equal(calls.submit.length, 3);
  assert.equal(result.quote.units, 3);
  assert.deepEqual(result.progress.executionCount, {
    planItems: 3,
    quoteUnits: 3,
    visibleAssetRows: 3,
    initialProviderSubmissions: 3,
    providerSubmissions: 3,
    providerRepairs: 0,
    submissionsByAsset: { 'main-1': 1, 'main-2': 1, 'main-3': 1 },
  });
});

test('incomplete-suite retry creates a newly quoted job for the whole uncharged suite', async t => {
  let rejectSecondOnce = true;
  const { orchestrator, calls } = await createHarness(t, {
    items: [planItem('main-one'), planItem('main-two')],
    quality: async ({ input }) => {
      if (input.assetPlanItem.id === 'main-two' && rejectSecondOnce) {
        rejectSecondOnce = false;
        return {
          passed: false,
          checks: {},
          repairAction: { type: 'none', focusIssueCodes: ['product_fidelity'], userCharge: false },
          confidence: 'high',
        };
      }
      return {
        passed: true,
        checks: {},
        repairAction: { type: 'none', focusIssueCodes: [], userCharge: false },
        confidence: 'high',
      };
    },
  });
  orchestrator.createJob(jobInput('job-retry-source'));
  const original = await orchestrator.runJob('job-retry-source');
  assert.equal(original.status, 'needs_review');
  assert.deepEqual(calls.compile, ['main-one', 'main-two']);

  const retryPlan = orchestrator.getFailedRetryPlan({ id: original.id, ownerEmail: OWNER });
  assert.deepEqual(retryPlan.itemIds, ['main-one', 'main-two']);
  assert.equal(retryPlan.quantity, 2);

  const retryJob = orchestrator.createFailedRetryJob({
    id: original.id,
    ownerEmail: OWNER,
    billingQuoteId: 'quote-for-one-failed-item',
  });
  const completed = await orchestrator.runJob(retryJob.id);
  assert.equal(completed.status, 'completed');
  assert.deepEqual(calls.compile, ['main-one', 'main-two', 'main-one', 'main-two']);
  assert.deepEqual(calls.hold.at(-1).itemIds, ['main-one', 'main-two']);
  assert.equal(calls.submit.length, 4);
});

test('failed-item retry claim is idempotent for concurrent duplicate quote submissions', async t => {
  let rejectSecondOnce = true;
  const { orchestrator, calls } = await createHarness(t, {
    items: [planItem('main-one'), planItem('main-two')],
    quality: async ({ input }) => {
      if (input.assetPlanItem.id === 'main-two' && rejectSecondOnce) {
        rejectSecondOnce = false;
        return {
          passed: false,
          checks: {},
          repairAction: { type: 'none', focusIssueCodes: ['product_fidelity'], userCharge: false },
          confidence: 'high',
        };
      }
      return {
        passed: true,
        checks: {},
        repairAction: { type: 'none', focusIssueCodes: [], userCharge: false },
        confidence: 'high',
      };
    },
  });
  const source = orchestrator.createJob(jobInput('job-idempotent-retry-source'));
  assert.equal((await orchestrator.runJob(source.id)).status, 'needs_review');
  const beforeRetry = {
    compile: calls.compile.length,
    hold: calls.hold.length,
    settle: calls.settle.length,
    submit: calls.submit.length,
  };

  const [firstRetry, duplicateRetry] = await Promise.all([
    Promise.resolve().then(() => orchestrator.createFailedRetryJob({
      id: source.id,
      ownerEmail: OWNER,
      billingQuoteId: 'quote-idempotent-retry',
    })),
    Promise.resolve().then(() => orchestrator.createFailedRetryJob({
      id: source.id,
      ownerEmail: OWNER,
      billingQuoteId: 'quote-idempotent-retry',
    })),
  ]);

  assert.equal(firstRetry.id, duplicateRetry.id);
  await Promise.all([
    orchestrator.runJob(firstRetry.id),
    orchestrator.runJob(duplicateRetry.id),
  ]);

  assert.equal(orchestrator.getJob(firstRetry.id, { ownerEmail: OWNER }).status, 'completed');
  assert.deepEqual(calls.compile.slice(beforeRetry.compile), ['main-one', 'main-two']);
  assert.deepEqual(calls.hold.slice(beforeRetry.hold).map(call => call.itemIds), [['main-one', 'main-two']]);
  assert.equal(calls.submit.length, beforeRetry.submit + 2);
  assert.equal(calls.settle.length, beforeRetry.settle + 2);
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
  assert.deepEqual(lifecycle, [['terminate', 'needs_review']]);
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
  assert.equal(calls.submit.filter(request => request.prompt.startsWith('generate main-one')).length, 1);
  assert.equal(calls.submit.filter(request => request.prompt.startsWith('generate main-two')).length, 2);
  assert.equal(result.assets.length, 2);
  assert.deepEqual(result.progress.executionCount.submissionsByAsset, {
    'main-one': 1,
    'main-two': 2,
  });
});

test('semantic collage repairs only the failed asset once and passes its verdict to delivery', async t => {
  const qualityAttempts = new Map();
  const suiteChecks = new Map();
  const { orchestrator, calls } = await createHarness(t, {
    items: [planItem('main-one', 'main_text'), planItem('main-two', 'main_text')],
    quality: ({ input }) => {
      const assetId = input.assetPlanItem.id;
      const attempt = (qualityAttempts.get(assetId) || 0) + 1;
      qualityAttempts.set(assetId, attempt);
      if (assetId === 'main-two' && attempt === 1) {
        return {
          passed: false,
          checks: {
            visualQuality: {
              status: 'fail',
              issueCodes: ['suite_collage_layout'],
              details: {
                layout: {
                  verdict: 'collage',
                  confidence: 0.97,
                  evidence: ['three independent candidate scenes'],
                },
              },
            },
          },
          repairAction: {
            type: 'regenerate_from_product_truth',
            focusIssueCodes: ['suite_collage_layout'],
            userCharge: false,
          },
          confidence: 'low',
        };
      }
      return {
        passed: true,
        checks: {},
        repairAction: { type: 'none', focusIssueCodes: [], userCharge: false },
        confidence: 'high',
      };
    },
    orchestratorOptions: {
      assetConcurrency: 1,
      evaluateSuiteDiversity: async ({ candidate, semanticLayout }) => {
        suiteChecks.set(candidate.assetId, semanticLayout);
        assert.deepEqual(semanticLayout, SEMANTIC_SINGLE_PRODUCT);
        return { passed: true, issueCodes: [], details: { semanticLayout } };
      },
    },
  });

  const result = await orchestrator.runJob(
    orchestrator.createJob(jobInput('job-semantic-collage-repair')).id,
  );

  assert.equal(result.status, 'completed');
  assert.equal(result.assets.length, 2);
  assert.equal(calls.submit.filter(request => request.prompt.startsWith('generate main-one')).length, 1);
  assert.equal(calls.submit.filter(request => request.prompt.startsWith('generate main-two')).length, 2);
  assert.equal(calls.settle.length, 2);
  assert.equal(calls.release.length, 0);
  assert.equal(qualityAttempts.get('main-one'), 1);
  assert.equal(qualityAttempts.get('main-two'), 2);
  assert.equal(suiteChecks.size, 2);
  assert.deepEqual(result.progress.executionCount.submissionsByAsset, {
    'main-one': 1,
    'main-two': 2,
  });
});

test('rejects duplicate suite intent before billing or provider submission', async t => {
  const hero = planItem('hero');
  const { orchestrator, calls } = await createHarness(t, {
    items: [hero, { ...hero, id: 'hero-2' }],
  });

  const failed = await orchestrator.runJob(orchestrator.createJob(jobInput('job-duplicate-intent')).id);

  assert.equal(failed.status, 'failed');
  assert.match(failed.output.errors[0].error, /duplicate suite intent/i);
  assert.equal(calls.hold.length, 0);
  assert.equal(calls.submit.length, 0);
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

test('publishes one task work only after every planned deliverable completes', async t => {
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

test('releases the whole suite without settlement when any planned image is not deliverable', async t => {
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
        async complete() {
          throw new Error('partial delivery must not create a result version');
        },
        async terminate({ job, status }) {
          lifecycle.push(['terminate', status]);
          return { projectId: 'project-partial', sourceVersionId: 'source-partial', generationRunId: job.id };
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
  assert.deepEqual(calls.settle.map(call => call.itemId), []);
  assert.deepEqual(calls.release.map(call => call.itemId).sort(), ['detail-fail', 'main-pass']);
  assert.deepEqual(Object.keys(completed.output.images), []);
  assert.equal(completed.progress.resultVersionId, undefined);
  const withheld = completed.assets.find(asset => asset.assetId === 'main-pass');
  assert.equal(withheld.stableUrl, undefined);
  assert.equal(withheld.previewUrl, PNG_A);
  assert.equal(withheld.error, '本轮未形成完整套图，未交付且本张不计费');
  const rejected = completed.assets.find(asset => asset.assetId === 'detail-fail');
  assert.equal(rejected.stableUrl, undefined);
  assert.equal(rejected.previewUrl, PNG_A);
  assert.equal(rejected.outputUrl, undefined);
  assert.equal(rejected.providerJobId, undefined);
  assert.equal(rejected.requestSnapshot, undefined);
  assert.equal(rejected.error, '本轮未形成完整套图，未交付且本张不计费');
  assert.equal(completed.output.errors[0].error, '本轮未形成完整套图，未交付且本张不计费');
  assert.deepEqual(lifecycle, [['terminate', 'needs_review']]);
});

test('fails and releases the whole suite when semantic review service is unavailable', async t => {
  const { orchestrator, calls } = await createHarness(t, {
    items: [planItem('main-pass'), planItem('detail-service-unavailable', 'detail')],
    quality: ({ input }) => input.assetPlanItem.id === 'main-pass'
      ? {
        passed: true,
        checks: {},
        repairAction: { type: 'none', focusIssueCodes: [], userCharge: false },
        confidence: 'high',
      }
      : {
        passed: false,
        retryable: true,
        checks: {
          productFidelity: { status: 'unavailable', issueCodes: ['adapter_error'] },
          visualQuality: { status: 'unavailable', issueCodes: ['adapter_error'] },
        },
        repairAction: { type: 'none', focusIssueCodes: [], userCharge: false },
        confidence: 'medium',
      },
  });

  const result = await orchestrator.runJob(
    orchestrator.createJob(jobInput('job-quality-service-unavailable')).id,
  );

  assert.equal(result.status, 'failed');
  assert.equal(calls.settle.length, 0);
  assert.deepEqual(calls.release.map(call => call.itemId).sort(), [
    'detail-service-unavailable',
    'main-pass',
  ]);
  assert.equal(
    calls.release.find(call => call.itemId === 'detail-service-unavailable').reason,
    'quality_service_unavailable',
  );
  assert.equal(
    calls.release.find(call => call.itemId === 'main-pass').reason,
    'suite_incomplete:failed',
  );
  assert.ok(result.assets.every(asset => asset.state === 'failed'));
  assert.deepEqual(Object.keys(result.output.images), []);
});

test('repairs a quality-rejected deliverable twice internally before completing the suite', async t => {
  let checks = 0;
  const { orchestrator, calls } = await createHarness(t, {
    quality: () => {
      checks += 1;
      if (checks >= 3) {
        return {
          passed: true,
          checks: {},
          repairAction: { type: 'none', focusIssueCodes: [], userCharge: false },
          confidence: 'high',
        };
      }
      return {
        passed: false,
        checks: { productFidelity: { status: 'fail', issueCodes: ['product_identity_mismatch'] } },
        repairAction: {
          type: 'regenerate_from_product_truth',
          focusIssueCodes: ['product_identity_mismatch'],
          userCharge: false,
        },
        confidence: 'low',
      };
    },
    orchestratorOptions: { canRetry: attempt => attempt < 2 },
  });

  const result = await orchestrator.runJob(orchestrator.createJob(jobInput('job-two-repairs')).id);

  assert.equal(result.status, 'completed');
  assert.equal(calls.quality.length, 3);
  assert.equal(calls.submit.length, 3);
  assert.equal(calls.settle.length, 1);
  assert.equal(calls.release.length, 0);
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

test('legacy local Sharp repair attempts do not become provider submission counts', async t => {
  const item = planItem('legacy-sharp');
  const { orchestrator, jobs, calls } = await createHarness(t, { items: [item] });
  const input = jobInput('job-legacy-sharp-count');
  jobs.create(input);
  jobs.transition(input.id, 'analyzing');
  jobs.transition(input.id, 'generating', {
    progress: {
      holdId: 'hold-legacy-sharp-count',
      orchestrationSnapshot: orchestrationSnapshot([item], 'hold-legacy-sharp-count'),
    },
  });
  jobs.assets.createAsset({
    jobId: input.id,
    assetId: item.id,
    requestSnapshot: { assetPlanItem: item },
  });
  const lease = jobs.assets.claimAsset(input.id, item.id);
  jobs.assets.markSubmitted(input.id, item.id, {
    providerJobId: 'provider-legacy-initial',
    requestSnapshot: { assetPlanItem: item, request: { prompt: 'legacy initial' } },
    leaseToken: lease.leaseToken,
  });
  jobs.assets.transitionAsset(input.id, item.id, 'polling', { leaseToken: lease.leaseToken });
  jobs.assets.transitionAsset(input.id, item.id, 'downloading', {
    outputUrl: 'https://provider.example/provider-legacy-initial.png',
    leaseToken: lease.leaseToken,
  });
  jobs.assets.transitionAsset(input.id, item.id, 'quality_check', {
    stableUrl: PNG_A,
    attemptCount: 1,
    requestSnapshot: {
      assetPlanItem: item,
      request: { prompt: 'legacy initial' },
      repairAction: { type: 'sharp_repair', operations: ['normalize_transparent_background'] },
    },
    leaseToken: lease.leaseToken,
  });
  jobs.assets.releaseLease(input.id, item.id, lease.leaseToken);

  const completed = await orchestrator.runJob(input.id);

  assert.equal(completed.status, 'completed');
  assert.equal(calls.submit.length, 0);
  assert.equal(completed.progress.executionCount.providerSubmissions, 1);
  assert.deepEqual(completed.progress.executionCount.submissionsByAsset, { 'legacy-sharp': 1 });
});

test('legacy repair eligibility without a submitted repair remains one provider submission', async t => {
  const item = planItem('legacy-unsubmitted-repair');
  const { orchestrator, jobs, calls } = await createHarness(t, { items: [item] });
  const input = jobInput('job-legacy-unsubmitted-repair');
  jobs.create(input);
  jobs.transition(input.id, 'analyzing');
  jobs.transition(input.id, 'generating', {
    progress: {
      holdId: 'hold-legacy-unsubmitted-repair',
      orchestrationSnapshot: orchestrationSnapshot([item], 'hold-legacy-unsubmitted-repair'),
    },
  });
  jobs.assets.createAsset({
    jobId: input.id,
    assetId: item.id,
    requestSnapshot: { assetPlanItem: item },
  });
  const lease = jobs.assets.claimAsset(input.id, item.id);
  jobs.assets.markSubmitted(input.id, item.id, {
    providerJobId: 'provider-legacy-initial-only',
    requestSnapshot: {
      assetPlanItem: item,
      request: { prompt: 'legacy initial request' },
    },
    leaseToken: lease.leaseToken,
  });
  jobs.assets.transitionAsset(input.id, item.id, 'polling', { leaseToken: lease.leaseToken });
  jobs.assets.transitionAsset(input.id, item.id, 'downloading', {
    outputUrl: 'https://provider.example/provider-legacy-initial-only.png',
    leaseToken: lease.leaseToken,
  });
  jobs.assets.transitionAsset(input.id, item.id, 'quality_check', {
    stableUrl: PNG_A,
    leaseToken: lease.leaseToken,
  });
  jobs.assets.transitionAsset(input.id, item.id, 'releasing', {
    requestSnapshot: {
      assetPlanItem: item,
      request: { prompt: 'legacy initial request' },
      repairAction: { type: 'image_edit', focusIssueCodes: ['local_artifact'] },
      release: {
        targetState: 'needs_review',
        reason: 'quality_review:local_artifact',
        error: 'quality gate failed: image_edit',
      },
    },
    leaseToken: lease.leaseToken,
  });
  jobs.assets.transitionAsset(input.id, item.id, 'needs_review', {
    error: 'quality gate failed: image_edit',
    leaseToken: lease.leaseToken,
  });

  const completed = await orchestrator.runJob(input.id);

  assert.equal(completed.status, 'needs_review');
  assert.equal(calls.submit.length, 0);
  assert.equal(completed.progress.executionCount.providerSubmissions, 1);
  assert.deepEqual(completed.progress.executionCount.submissionsByAsset, {
    'legacy-unsubmitted-repair': 1,
  });
});

test('legacy initial provider history remains when a new repair intent is added', async t => {
  const item = planItem('legacy-provider-repair');
  const { orchestrator, jobs, calls } = await createHarness(t, { items: [item] });
  const input = jobInput('job-legacy-provider-repair-intent');
  jobs.create(input);
  jobs.transition(input.id, 'analyzing');
  jobs.transition(input.id, 'generating', {
    progress: {
      holdId: 'hold-legacy-provider-repair-intent',
      orchestrationSnapshot: orchestrationSnapshot(
        [item],
        'hold-legacy-provider-repair-intent',
      ),
    },
  });
  jobs.assets.createAsset({
    jobId: input.id,
    assetId: item.id,
    requestSnapshot: { assetPlanItem: item },
  });
  const lease = jobs.assets.claimAsset(input.id, item.id);
  jobs.assets.markSubmitted(input.id, item.id, {
    providerJobId: 'provider-legacy-initial',
    requestSnapshot: {
      assetPlanItem: item,
      request: { prompt: 'legacy initial request', kind: 'initial' },
    },
    leaseToken: lease.leaseToken,
  });
  jobs.assets.transitionAsset(input.id, item.id, 'polling', { leaseToken: lease.leaseToken });
  jobs.assets.transitionAsset(input.id, item.id, 'downloading', {
    outputUrl: 'https://provider.example/provider-legacy-initial.png',
    leaseToken: lease.leaseToken,
  });
  jobs.assets.transitionAsset(input.id, item.id, 'quality_check', {
    stableUrl: PNG_A,
    leaseToken: lease.leaseToken,
  });
  jobs.assets.transitionAsset(input.id, item.id, 'repairing', {
    requestSnapshot: {
      assetPlanItem: item,
      request: { prompt: 'legacy initial request', kind: 'initial' },
      repairAction: { type: 'image_edit', focusIssueCodes: ['local_artifact'] },
    },
    leaseToken: lease.leaseToken,
  });
  jobs.assets.releaseLease(input.id, item.id, lease.leaseToken);

  const completed = await orchestrator.runJob(input.id);

  assert.equal(completed.status, 'completed');
  assert.equal(calls.submit.length, 1);
  assert.equal(completed.progress.executionCount.providerSubmissions, 2);
  assert.equal(completed.progress.executionCount.providerRepairs, 1);
  assert.deepEqual(completed.progress.executionCount.submissionsByAsset, {
    'legacy-provider-repair': 2,
  });
});

test('legacy provider repair evidence survives a later Sharp repair snapshot', async t => {
  const item = planItem('legacy-provider-then-sharp');
  const { orchestrator, jobs, calls } = await createHarness(t, { items: [item] });
  const input = jobInput('job-legacy-provider-then-sharp');
  jobs.create(input);
  jobs.transition(input.id, 'analyzing');
  jobs.transition(input.id, 'generating', {
    progress: {
      holdId: 'hold-legacy-provider-then-sharp',
      orchestrationSnapshot: orchestrationSnapshot([item], 'hold-legacy-provider-then-sharp'),
    },
  });
  jobs.assets.createAsset({
    jobId: input.id,
    assetId: item.id,
    requestSnapshot: { assetPlanItem: item },
  });
  const lease = jobs.assets.claimAsset(input.id, item.id);
  jobs.assets.markSubmitted(input.id, item.id, {
    providerJobId: 'provider-legacy-repair',
    requestSnapshot: {
      assetPlanItem: item,
      request: {
        kind: 'repair',
        prompt: 'generate item; repair image_edit; attempt 1',
      },
      repairAction: { type: 'image_edit', focusIssueCodes: ['local_artifact'] },
    },
    leaseToken: lease.leaseToken,
  });
  jobs.assets.transitionAsset(input.id, item.id, 'polling', { leaseToken: lease.leaseToken });
  jobs.assets.transitionAsset(input.id, item.id, 'downloading', {
    outputUrl: 'https://provider.example/provider-legacy-repair.png',
    leaseToken: lease.leaseToken,
  });
  jobs.assets.transitionAsset(input.id, item.id, 'quality_check', {
    stableUrl: PNG_A,
    attemptCount: 2,
    requestSnapshot: {
      assetPlanItem: item,
      request: {
        kind: 'repair',
        prompt: 'generate item; repair image_edit; attempt 1',
      },
      repairAction: {
        type: 'sharp_repair',
        operations: ['normalize_transparent_background'],
      },
    },
    leaseToken: lease.leaseToken,
  });
  jobs.assets.releaseLease(input.id, item.id, lease.leaseToken);

  const completed = await orchestrator.runJob(input.id);

  assert.equal(completed.status, 'completed');
  assert.equal(calls.submit.length, 0);
  assert.equal(completed.progress.executionCount.providerSubmissions, 2);
  assert.equal(completed.progress.executionCount.providerRepairs, 1);
  assert.deepEqual(completed.progress.executionCount.submissionsByAsset, {
    'legacy-provider-then-sharp': 2,
  });
});

test('provider repair cap violations beyond two repairs are permanent and never submit another provider job', async t => {
  const item = planItem('legacy-over-cap');
  const { orchestrator, jobs, calls } = await createHarness(t, { items: [item] });
  const input = jobInput('job-legacy-provider-over-cap');
  jobs.create(input);
  jobs.transition(input.id, 'analyzing');
  jobs.transition(input.id, 'generating', {
    progress: {
      holdId: 'hold-legacy-provider-over-cap',
      orchestrationSnapshot: orchestrationSnapshot([item], 'hold-legacy-provider-over-cap'),
    },
  });
  jobs.assets.createAsset({
    jobId: input.id,
    assetId: item.id,
    requestSnapshot: { assetPlanItem: item },
  });
  const lease = jobs.assets.claimAsset(input.id, item.id);
  jobs.assets.markSubmitted(input.id, item.id, {
    providerJobId: 'provider-legacy-over-cap',
    requestSnapshot: {
      assetPlanItem: item,
      request: { kind: 'repair', prompt: 'repair image_edit; attempt 2' },
      executionCount: { providerSubmissions: 4 },
    },
    leaseToken: lease.leaseToken,
  });
  jobs.assets.transitionAsset(input.id, item.id, 'polling', { leaseToken: lease.leaseToken });
  jobs.assets.transitionAsset(input.id, item.id, 'downloading', {
    outputUrl: 'https://provider.example/provider-legacy-over-cap.png',
    leaseToken: lease.leaseToken,
  });
  jobs.assets.transitionAsset(input.id, item.id, 'quality_check', {
    stableUrl: PNG_A,
    leaseToken: lease.leaseToken,
  });
  jobs.assets.transitionAsset(input.id, item.id, 'repairing', {
    requestSnapshot: {
      assetPlanItem: item,
      request: { kind: 'repair', prompt: 'repair image_edit; attempt 2' },
      repairAction: { type: 'image_edit', focusIssueCodes: ['local_artifact'] },
      executionCount: { providerSubmissions: 4 },
    },
    leaseToken: lease.leaseToken,
  });
  jobs.assets.releaseLease(input.id, item.id, lease.leaseToken);

  const failed = await orchestrator.runJob(input.id);

  assert.equal(failed.status, 'failed');
  assert.equal(calls.submit.length, 0);
  assert.deepEqual(calls.release.map(call => call.itemId), ['legacy-over-cap']);
  assert.equal(jobs.assets.getAsset(input.id, item.id).state, 'failed');
});

test('provider output storage EIO keeps downloading state and resumes without provider replay', async t => {
  const items = [planItem('main-ready'), planItem('detail-storage', 'detail')];
  const storageError = Object.assign(new Error('generated asset disk unavailable'), { code: 'EIO' });
  let failStorage = true;
  const { orchestrator, jobs, calls } = await createHarness(t, {
    items,
    orchestratorOptions: { assetConcurrency: 1 },
    persist: ({ label }) => {
      if (label === 'detail-storage' && failStorage) {
        failStorage = false;
        throw storageError;
      }
      return null;
    },
  });
  const created = orchestrator.createJob(jobInput('job-provider-storage-resume'));

  await assert.rejects(
    () => orchestrator.runJob(created.id),
    error => error?.code === 'GENERATED_ASSET_STORAGE_UNAVAILABLE'
      && error?.status === 503
      && error?.retryable === true
      && error?.cause === storageError,
  );

  assert.equal(jobs.get(created.id).status, 'generating');
  assert.equal(jobs.assets.getAsset(created.id, 'main-ready').state, 'verified');
  assert.equal(jobs.assets.getAsset(created.id, 'detail-storage').state, 'downloading');
  assert.equal(calls.hold.length, 1);
  assert.equal(calls.submit.length, 2);
  assert.equal(calls.poll.length, 2);
  assert.equal(calls.release.length, 0);

  const completed = await orchestrator.runJob(created.id);

  assert.equal(completed.status, 'completed');
  assert.equal(calls.hold.length, 1);
  assert.equal(calls.submit.length, 2);
  assert.equal(calls.poll.length, 2);
  assert.equal(calls.persist.filter(call => call.label === 'main-ready').length, 1);
  assert.equal(calls.persist.filter(call => call.label === 'detail-storage').length, 2);
  assert.deepEqual(calls.settle.map(call => call.itemId).sort(), ['detail-storage', 'main-ready']);
  assert.equal(calls.release.length, 0);
});

test('Sharp output storage EIO keeps repairing state and resumes without provider replay', async t => {
  const storageError = Object.assign(new Error('Sharp output disk unavailable'), { code: 'EIO' });
  let qualityAttempt = 0;
  let failStorage = true;
  const { orchestrator, jobs, calls } = await createHarness(t, {
    quality: () => {
      qualityAttempt += 1;
      if (qualityAttempt === 1) {
        return {
          passed: false,
          checks: { platformCompliance: { status: 'fail', issueCodes: ['background'] } },
          repairAction: {
            type: 'sharp_repair',
            focusIssueCodes: ['background'],
            operations: ['normalize_background'],
            userCharge: false,
          },
          confidence: 'low',
        };
      }
      return {
        passed: true,
        checks: {},
        repairAction: { type: 'none', focusIssueCodes: [], userCharge: false },
        confidence: 'high',
      };
    },
    persistBuffer: () => {
      if (failStorage) {
        failStorage = false;
        throw storageError;
      }
      return null;
    },
    orchestratorOptions: {
      repairAsset: async input => {
        calls.repair.push(input);
        return { buffer: IMAGE_BUFFER, contentType: 'image/png' };
      },
    },
  });
  const created = orchestrator.createJob(jobInput('job-sharp-storage-resume'));

  await assert.rejects(
    () => orchestrator.runJob(created.id),
    error => error?.code === 'GENERATED_ASSET_STORAGE_UNAVAILABLE'
      && error?.status === 503
      && error?.retryable === true
      && error?.cause === storageError,
  );

  assert.equal(jobs.get(created.id).status, 'generating');
  assert.equal(jobs.assets.getAsset(created.id, 'main-one').state, 'repairing');
  assert.equal(calls.hold.length, 1);
  assert.equal(calls.submit.length, 1);
  assert.equal(calls.poll.length, 1);
  assert.equal(calls.release.length, 0);

  const completed = await orchestrator.runJob(created.id);

  assert.equal(completed.status, 'completed');
  assert.equal(calls.hold.length, 1);
  assert.equal(calls.submit.length, 1);
  assert.equal(calls.poll.length, 1);
  assert.equal(calls.repair.length, 2);
  assert.equal(calls.persistBuffer.length, 2);
  assert.equal(calls.settle.length, 1);
  assert.equal(calls.release.length, 0);
  assert.equal(completed.progress.executionCount.providerSubmissions, 1);
});

test('migrates schema-3 ordinal duties into distinct commercial purposes before resume', async t => {
  const legacyPurpose = 'Product-first white background deliverable for marketplace use.';
  const first = planItem('white-background-1', 'white_background');
  first.purpose = legacyPurpose;
  first.communicationGoal = `${legacyPurpose} Dedicated white background duty 1 with its own buyer decision and composition.`;
  first.shotIntent.composition = 'centered front view';
  first.shotIntent.sceneFamily = 'white_background_catalog';
  const second = planItem('white-background-2', 'white_background');
  second.purpose = legacyPurpose;
  second.communicationGoal = `${legacyPurpose} Dedicated white background duty 2 with its own buyer decision and composition.`;
  second.shotIntent.camera = { azimuth: 48 };
  second.shotIntent.composition = 'offset side view';
  second.shotIntent.sceneFamily = 'white_background_catalog';
  const { orchestrator, jobs, calls } = await createHarness(t, { items: [first, second] });
  const input = jobInput('job-schema-three-duty-migration');
  jobs.create(input);
  jobs.transition(input.id, 'analyzing');
  jobs.transition(input.id, 'generating', {
    progress: {
      holdId: 'hold-schema-three-duty-migration',
      orchestrationSnapshot: orchestrationSnapshot(
        [first, second],
        'hold-schema-three-duty-migration',
        3,
      ),
    },
  });

  const completed = await orchestrator.runJob(input.id);

  assert.equal(completed.status, 'completed');
  assert.equal(calls.analyze, 0);
  assert.equal(calls.plan, 0);
  assert.equal(calls.hold.length, 0);
  assert.equal(calls.submit.length, 2);
  assert.equal(jobs.get(input.id).progress.orchestrationSnapshot.schemaVersion, 4);
  assert.deepEqual(completed.assetPlan.map(item => item.commercialDutyId), [
    'whitebackground:catalogrecognition',
    'whitebackground:shapeverification',
  ]);
  assert.deepEqual(completed.assetPlan.map(item => item.communicationGoal), [
    'Provide marketplace-ready complete-product catalog recognition on white.',
    'Verify the complete exterior shape and silhouette on white.',
  ]);
  assert.ok(completed.assetPlan.every(item => !/\bduty\s+\d+\b/i.test(item.communicationGoal)));
  assert.ok(completed.assetPlan.every(item => !/camera|composition|angle|\bview\b/i.test(item.communicationGoal)));
});

test('migrates every schema-3 repeated hero beyond the legacy five-duty cycle', async t => {
  const legacyHeroes = Array.from({ length: 6 }, (_, index) => {
    const item = planItem(`legacy-hero-${index + 1}`, 'main_text');
    item.purpose = 'Product identity and recognition hero.';
    item.communicationGoal = `${item.purpose} Dedicated main text duty ${index + 1} with its own buyer decision and composition.`;
    item.shotIntent.camera = { azimuth: index * 12 };
    item.shotIntent.composition = index % 2 === 0 ? 'front view' : 'side view';
    return item;
  });
  const { orchestrator, jobs, calls } = await createHarness(t, { items: legacyHeroes });
  const input = jobInput('job-schema-three-hero-cycle');
  jobs.create(input);
  jobs.transition(input.id, 'analyzing');
  jobs.transition(input.id, 'generating', {
    progress: {
      holdId: 'hold-schema-three-hero-cycle',
      orchestrationSnapshot: orchestrationSnapshot(
        legacyHeroes,
        'hold-schema-three-hero-cycle',
        3,
      ),
    },
  });

  const completed = await orchestrator.runJob(input.id);

  assert.equal(completed.status, 'completed');
  assert.equal(calls.analyze, 0);
  assert.equal(calls.hold.length, 0);
  assert.equal(calls.submit.length, 6);
  assert.deepEqual(completed.assetPlan.map(item => item.commercialDutyId), [
    'maintext:productrecognition',
    'maintext:primarybenefit',
    'maintext:usagecontext',
    'maintext:structureunderstanding',
    'maintext:materialcraft',
    'maintext:visibleoperation',
  ]);
  assert.deepEqual(completed.assetPlan.map(item => item.communicationGoal), [
    'Establish immediate complete-product recognition.',
    'Communicate one primary buyer benefit supported by Product Truth.',
    'Clarify credible use context without inventing product facts.',
    'Explain evidence-supported visible exterior structure.',
    'Demonstrate visible material and craftsmanship quality.',
    'Make visible controls and handling points easy to understand.',
  ]);
  assert.ok(completed.assetPlan.every(item => !/camera|composition|angle|\bview\b/i.test(item.communicationGoal)));
  assert.equal(jobs.get(input.id).progress.orchestrationSnapshot.schemaVersion, 4);
});

test('schema-3 migration preserves a proof-backed QC commercial duty', async t => {
  const qc = planItem('food-proof-qc', 'detail_slice_qc');
  qc.purpose = 'Quality evidence backed by an uploaded report.';
  qc.communicationGoal = 'Quality evidence duty 6 with a different composition.';
  qc.generationMode = 'deterministic_overlay';
  qc.proofAssetIds = ['food-proof-report'];
  qc.requiredFacts = [{ name: 'proofAssetId', value: 'food-proof-report' }];
  const { orchestrator, jobs, calls } = await createHarness(t, { items: [qc] });
  const input = jobInput('job-schema-three-proof-duty');
  jobs.create(input);
  jobs.transition(input.id, 'analyzing');
  const snapshot = orchestrationSnapshot([qc], 'hold-schema-three-proof-duty', 3);
  snapshot.productTruth.category = '\u98df\u54c1\u996e\u6599';
  snapshot.deterministicInputs.assets.proof = [{
    assetId: 'food-proof-report',
    url: '/api/ecommerce/assets/food-proof-report',
  }];
  jobs.transition(input.id, 'generating', {
    progress: {
      holdId: 'hold-schema-three-proof-duty',
      orchestrationSnapshot: snapshot,
    },
  });

  const completed = await orchestrator.runJob(input.id);
  const [migrated] = completed.assetPlan;

  assert.equal(completed.status, 'completed');
  assert.equal(calls.hold.length, 0);
  assert.equal(migrated.role, 'detail_slice_qc');
  assert.equal(migrated.commercialDutyId, 'detailsliceqc:proofanswer');
  assert.equal(migrated.communicationGoal, 'Communicate quality or certification information backed only by uploaded proof assets.');
  assert.deepEqual(migrated.requiredFacts, [{ name: 'proofAssetId', value: 'food-proof-report' }]);
  assert.deepEqual(migrated.proofAssetIds, ['food-proof-report']);
});

test('schema-3 migration restores distinct structured SKU variants before any new provider submission', async t => {
  const black = planItem('legacy-sku-black', 'sku');
  black.requiredFacts = [
    { name: 'color', value: 'black' },
    { name: 'capacity', value: '256GB' },
  ];
  const white = planItem('legacy-sku-white', 'sku');
  white.requiredFacts = [
    { name: 'color', value: 'white' },
    { name: 'capacity', value: '512GB' },
  ];
  const { orchestrator, jobs, calls } = await createHarness(t, { items: [black, white] });
  const input = jobInput('job-schema-three-sku-migration');
  jobs.create(input);
  jobs.transition(input.id, 'analyzing');
  jobs.transition(input.id, 'generating', {
    progress: {
      holdId: 'hold-schema-three-sku-migration',
      orchestrationSnapshot: orchestrationSnapshot(
        [black, white],
        'hold-schema-three-sku-migration',
        3,
      ),
    },
  });

  const completed = await orchestrator.runJob(input.id);

  assert.equal(completed.status, 'completed');
  assert.equal(calls.hold.length, 0);
  assert.equal(calls.submit.length, 2);
  assert.deepEqual(completed.assetPlan.map(item => ({
    id: item.id,
    commercialDutyId: item.commercialDutyId,
    variantIdentity: item.variantIdentity,
  })), [
    {
      id: 'legacy-sku-black',
      commercialDutyId: 'sku:variant',
      variantIdentity: { facts: [{ name: 'capacity', value: '256GB' }, { name: 'color', value: 'black' }] },
    },
    {
      id: 'legacy-sku-white',
      commercialDutyId: 'sku:variant',
      variantIdentity: { facts: [{ name: 'capacity', value: '512GB' }, { name: 'color', value: 'white' }] },
    },
  ]);
});

test('schema-3 migration rejects missing or duplicate SKU facts before provider work', async t => {
  const missing = planItem('legacy-sku-missing', 'sku');
  missing.requiredFacts = [];
  const duplicate = planItem('legacy-sku-duplicate', 'sku');
  duplicate.requiredFacts = [
    { name: 'color', value: 'black' },
    { name: 'color', value: 'white' },
  ];
  const { orchestrator, jobs, calls } = await createHarness(t, { items: [missing, duplicate] });
  const input = jobInput('job-schema-three-invalid-sku-migration');
  jobs.create(input);
  jobs.transition(input.id, 'analyzing');
  jobs.transition(input.id, 'generating', {
    progress: {
      holdId: 'hold-schema-three-invalid-sku-migration',
      orchestrationSnapshot: orchestrationSnapshot(
        [missing, duplicate],
        'hold-schema-three-invalid-sku-migration',
        3,
      ),
    },
  });

  const failed = await orchestrator.runJob(input.id);

  assert.equal(failed.status, 'failed');
  assert.equal(calls.hold.length, 0);
  assert.equal(calls.submit.length, 0);
  assert.equal(jobs.assets.listAssets(input.id).length, 0);
});

test('schema-3 migration does not trust a child-declared missing proof asset', async t => {
  const qc = planItem('food-untrusted-qc', 'detail_slice_qc');
  qc.generationMode = 'deterministic_overlay';
  qc.proofAssetIds = ['invented-proof'];
  qc.requiredFacts = [{ name: 'proofAssetId', value: 'invented-proof' }];
  const { orchestrator, jobs, calls } = await createHarness(t, { items: [qc] });
  const input = jobInput('job-schema-three-untrusted-proof');
  jobs.create(input);
  jobs.transition(input.id, 'analyzing');
  const snapshot = orchestrationSnapshot([qc], 'hold-schema-three-untrusted-proof', 3);
  snapshot.productTruth.category = '食品饮料';
  snapshot.deterministicInputs.assets.proof = [];
  jobs.transition(input.id, 'generating', { progress: { holdId: 'hold-schema-three-untrusted-proof', orchestrationSnapshot: snapshot } });

  const completed = await orchestrator.runJob(input.id);

  assert.equal(completed.status, 'completed');
  assert.equal(calls.hold.length, 0);
  assert.equal(completed.assetPlan.some(item => item.role === 'detail_slice_qc'), false);
  assert.equal(calls.compilePlanItems.some(item => item.requiredFacts.some(fact => fact.value === 'invented-proof')), false);
});

test('schema-3 migration replaces repeated structured detail semantic families', async t => {
  const first = planItem('legacy-parameters-1', 'detail_slice_parameters');
  const second = planItem('legacy-parameters-2', 'detail_slice_parameters');
  const { orchestrator, jobs, calls } = await createHarness(t, { items: [first, second] });
  const input = jobInput('job-schema-three-repeated-detail');
  jobs.create(input);
  jobs.transition(input.id, 'analyzing');
  const snapshot = orchestrationSnapshot([first, second], 'hold-schema-three-repeated-detail', 3);
  snapshot.productTruth.confirmedFacts = { ports: { value: 'USB-C', source: 'user' } };
  jobs.transition(input.id, 'generating', { progress: { holdId: 'hold-schema-three-repeated-detail', orchestrationSnapshot: snapshot } });

  const completed = await orchestrator.runJob(input.id);

  assert.equal(completed.status, 'completed');
  assert.equal(new Set(completed.assetPlan.map(item => item.commercialDutyId)).size, 2);
  assert.equal(completed.assetPlan.filter(item => item.role === 'detail_slice_parameters').length, 1);
  assert.equal(calls.hold.length, 0);
});

test('schema-3 ordinary detail overflow fails closed before any new call', async t => {
  const overflow = Array.from({ length: 11 }, (_, index) => (
    planItem(`legacy-detail-${index + 1}`, `detail_slice_legacy_${index + 1}`)
  ));
  const { orchestrator, jobs, calls } = await createHarness(t, { items: overflow });
  const input = jobInput('job-schema-three-detail-overflow');
  jobs.create(input);
  jobs.transition(input.id, 'analyzing');
  const snapshot = orchestrationSnapshot(overflow, 'hold-schema-three-detail-overflow', 3);
  snapshot.productTruth.category = '食品饮料';
  jobs.transition(input.id, 'generating', {
    progress: {
      holdId: 'hold-schema-three-detail-overflow',
      orchestrationSnapshot: snapshot,
    },
  });

  const failed = await orchestrator.runJob(input.id);

  assert.equal(failed.status, 'failed');
  assert.equal(calls.analyze, 0);
  assert.equal(calls.plan, 0);
  assert.equal(calls.hold.length, 0);
  assert.equal(calls.submit.length, 0);
  assert.equal(jobs.assets.listAssets(input.id).length, 0);
});

test('schema-3 mixed detail and QC resume uses the migrated parent plan without losing child history', async t => {
  const texture = planItem('food-a-texture', 'detail_slice_texture');
  const qc = planItem('food-b-qc', 'detail_slice_qc');
  qc.generationMode = 'deterministic_overlay';
  qc.proofAssetIds = ['food-proof-report'];
  qc.requiredFacts = [{ name: 'proofAssetId', value: 'food-proof-report' }];
  const packageItem = planItem('food-c-package', 'detail_slice_package');
  const flavor = planItem('food-d-flavor', 'detail_slice_flavor');
  flavor.requiredFacts = [{ name: 'flavor', value: 'Sea salt caramel' }];
  const legacyItems = [texture, qc, packageItem, flavor];
  const suiteChecks = [];
  const { orchestrator, jobs, calls } = await createHarness(t, {
    items: legacyItems,
    orchestratorOptions: {
      assetConcurrency: 1,
      evaluateSuiteDiversity: async inputValue => {
        suiteChecks.push(inputValue);
        return { passed: true, issueCodes: [], details: {} };
      },
    },
  });
  const input = jobInput('job-schema-three-mixed-detail-qc');
  jobs.create(input);
  jobs.transition(input.id, 'analyzing');
  const snapshot = orchestrationSnapshot(legacyItems, 'hold-schema-three-mixed-detail-qc', 3);
  snapshot.productTruth.category = '食品饮料';
  snapshot.productTruth.confirmedFacts = {
    flavor: { value: 'Sea salt caramel', source: 'user' },
  };
  snapshot.deterministicInputs.assets.proof = [{
    assetId: 'food-proof-report',
    url: '/api/ecommerce/assets/food-proof-report',
  }];
  jobs.transition(input.id, 'generating', {
    progress: {
      holdId: 'hold-schema-three-mixed-detail-qc',
      orchestrationSnapshot: snapshot,
    },
  });

  const seedSubmitted = (item, providerJobId, { state = 'polling', stableUrl = '', repair = false } = {}) => {
    const initialIntent = {
      assetId: item.id,
      ordinal: 0,
      kind: 'initial',
      idempotencyKey: `legacy:${item.id}:initial`,
      status: 'acknowledged',
      providerJobId: repair ? `${providerJobId}-initial` : providerJobId,
    };
    const submissionIntents = repair
      ? [initialIntent, {
          assetId: item.id,
          ordinal: 1,
          kind: 'repair',
          idempotencyKey: `legacy:${item.id}:repair`,
          status: 'acknowledged',
          providerJobId,
        }]
      : [initialIntent];
    const requestSnapshot = {
      assetPlanItem: item,
      request: { prompt: `legacy ${item.id}`, kind: repair ? 'repair' : 'initial' },
      submissionIntents,
      ...(repair ? { repairAction: { type: 'image_edit', focusIssueCodes: ['legacy_artifact'] } } : {}),
    };
    jobs.assets.createAsset({ jobId: input.id, assetId: item.id, requestSnapshot });
    const lease = jobs.assets.claimAsset(input.id, item.id);
    jobs.assets.markSubmitted(input.id, item.id, {
      providerJobId,
      requestSnapshot,
      leaseToken: lease.leaseToken,
    });
    jobs.assets.transitionAsset(input.id, item.id, 'polling', { leaseToken: lease.leaseToken });
    if (state === 'completed') {
      jobs.assets.transitionAsset(input.id, item.id, 'downloading', {
        outputUrl: `https://provider.example/${providerJobId}.png`,
        leaseToken: lease.leaseToken,
      });
      jobs.assets.transitionAsset(input.id, item.id, 'quality_check', {
        stableUrl,
        attemptCount: repair ? 1 : 0,
        leaseToken: lease.leaseToken,
      });
      jobs.assets.transitionAsset(input.id, item.id, 'settling', { leaseToken: lease.leaseToken });
      jobs.assets.transitionAsset(input.id, item.id, 'completed', { leaseToken: lease.leaseToken });
    } else {
      jobs.assets.releaseLease(input.id, item.id, lease.leaseToken);
    }
  };

  seedSubmitted(texture, 'provider-food-texture', { state: 'completed', stableUrl: PNG_A });
  seedSubmitted(qc, 'provider-food-qc');
  jobs.assets.createAsset({
    jobId: input.id,
    assetId: packageItem.id,
    requestSnapshot: { assetPlanItem: packageItem },
  });
  seedSubmitted(flavor, 'provider-food-flavor-repair', {
    state: 'completed',
    stableUrl: PNG_B,
    repair: true,
  });

  const completed = await orchestrator.runJob(input.id);
  const planById = new Map(completed.assetPlan.map(item => [item.id, item]));
  const executedItems = [
    ...calls.compilePlanItems,
    ...calls.quality.map(inputValue => inputValue.assetPlanItem),
    ...suiteChecks.flatMap(inputValue => [
      inputValue.candidate.assetPlanItem,
      ...inputValue.existing.map(existing => existing.assetPlanItem),
    ]),
  ];

  assert.equal(completed.status, 'completed');
  assert.equal(calls.analyze, 0);
  assert.equal(calls.plan, 0);
  assert.equal(calls.hold.length, 0);
  assert.equal(calls.submit.length, 1);
  assert.deepEqual(calls.poll.sort(), ['provider-1', 'provider-food-qc']);
  assert.deepEqual(calls.compile, ['food-c-package']);
  assert.deepEqual(completed.assetPlan.map(item => [item.id, item.role, item.commercialDutyId]), [
    ['food-a-texture', 'detail_slice_texture', 'detailslicetexture:texture'],
    ['food-b-qc', 'detail_slice_qc', 'detailsliceqc:proofanswer'],
    ['food-c-package', 'detail_slice_package', 'detailslicepackage:package'],
    ['food-d-flavor', 'detail_slice_flavor', 'detailsliceflavor:flavor'],
  ]);
  assert.ok(executedItems.length >= 3);
  for (const executed of executedItems) {
    const canonical = planById.get(executed.id);
    assert.equal(executed.role, canonical.role, `${executed.id} role`);
    assert.equal(executed.commercialDutyId, canonical.commercialDutyId, `${executed.id} duty id`);
    assert.equal(executed.communicationGoal, canonical.communicationGoal, `${executed.id} buyer goal`);
  }
  const preservedFlavor = jobs.assets.getAsset(input.id, flavor.id).requestSnapshot;
  assert.equal(preservedFlavor.submissionIntents.length, 2);
  assert.deepEqual(preservedFlavor.repairAction, {
    type: 'image_edit',
    focusIssueCodes: ['legacy_artifact'],
  });
  assert.deepEqual(
    jobs.assets.getAsset(input.id, qc.id).requestSnapshot.assetPlanItem,
    qc,
    'a submitted historical child keeps the exact plan snapshot sent to its provider job',
  );
  assert.equal(completed.progress.executionCount.providerSubmissions, 5);
  assert.equal(completed.progress.executionCount.providerRepairs, 1);
});

test('keeps the parent resumable while a planned child lease is temporarily held', async t => {
  const items = [planItem('main-ready'), planItem('detail-held', 'detail')];
  const { orchestrator, jobs, calls } = await createHarness(t, {
    items,
    orchestratorOptions: { assetConcurrency: 1 },
  });
  const originalCreateAsset = jobs.assets.createAsset;
  let heldLease = null;
  jobs.assets.createAsset = input => {
    const asset = originalCreateAsset(input);
    if (input.assetId === 'detail-held' && !heldLease) {
      heldLease = jobs.assets.claimAsset(input.jobId, input.assetId);
    }
    return asset;
  };
  const created = orchestrator.createJob(jobInput('job-child-lease-overlap'));

  const inProgress = await orchestrator.runJob(created.id);

  assert.equal(inProgress.status, 'generating');
  assert.equal(inProgress.assets.find(asset => asset.assetId === 'main-ready').state, 'verified');
  assert.equal(inProgress.assets.find(asset => asset.assetId === 'detail-held').state, 'queued');
  assert.equal(inProgress.progress.executionCount, undefined);
  assert.equal(calls.hold.length, 1);
  assert.deepEqual(calls.submit.map(request => request.prompt), ['generate main-ready']);
  assert.ok(heldLease?.leaseToken);

  jobs.assets.releaseLease(created.id, 'detail-held', heldLease.leaseToken);
  const completed = await orchestrator.runJob(created.id);

  assert.equal(completed.status, 'completed');
  assert.equal(calls.hold.length, 1);
  assert.deepEqual(calls.submit.map(request => request.prompt), [
    'generate main-ready',
    'generate detail-held',
  ]);
  assert.deepEqual(calls.settle.map(call => call.itemId).sort(), ['detail-held', 'main-ready']);
  assert.deepEqual(completed.progress.executionCount.submissionsByAsset, {
    'detail-held': 1,
    'main-ready': 1,
  });
});

test('reuses a durable initial submission intent after acknowledgement persistence fails', async t => {
  const providerJobs = new Map();
  const { orchestrator, jobs, calls } = await createHarness(t, {
    submit: ({ request }) => {
      if (!providerJobs.has(request.idempotencyKey)) {
        providerJobs.set(request.idempotencyKey, `provider-logical-${providerJobs.size + 1}`);
      }
      return {
        jobId: providerJobs.get(request.idempotencyKey),
        status: 'queued',
        apiKey: 'provider-secret-must-not-persist',
      };
    },
  });
  const originalMarkSubmitted = jobs.assets.markSubmitted;
  let failedOnce = false;
  jobs.assets.markSubmitted = (jobId, assetId, patch) => {
    const asset = jobs.assets.getAsset(jobId, assetId);
    if (!failedOnce && asset.state === 'queued') {
      failedOnce = true;
      throw new Error('local initial acknowledgement write failed');
    }
    return originalMarkSubmitted(jobId, assetId, patch);
  };
  const created = orchestrator.createJob(jobInput('job-initial-ack-retry'));

  await assert.rejects(
    () => orchestrator.runJob(created.id),
    error => error?.retryable === true && /initial acknowledgement write failed/.test(error.message),
  );

  const intentOnly = jobs.assets.getAsset(created.id, 'main-one');
  assert.equal(jobs.get(created.id).status, 'generating');
  assert.equal(intentOnly.state, 'queued');
  assert.equal(calls.release.length, 0);
  assert.equal(calls.submit.length, 1);
  assert.deepEqual(intentOnly.requestSnapshot.submissionIntents, [{
    assetId: 'main-one',
    ordinal: 0,
    kind: 'initial',
    idempotencyKey: calls.submit[0].idempotencyKey,
    status: 'intent',
  }]);

  const completed = await orchestrator.runJob(created.id);
  const acknowledged = jobs.assets.getAsset(created.id, 'main-one');

  assert.equal(completed.status, 'completed');
  assert.equal(providerJobs.size, 1);
  assert.equal(calls.submit.length, 2);
  assert.equal(calls.submit[1].idempotencyKey, calls.submit[0].idempotencyKey);
  assert.equal(calls.release.length, 0);
  assert.equal(completed.progress.executionCount.providerSubmissions, 1);
  assert.deepEqual(acknowledged.requestSnapshot.submissionIntents, [{
    assetId: 'main-one',
    ordinal: 0,
    kind: 'initial',
    idempotencyKey: calls.submit[0].idempotencyKey,
    status: 'acknowledged',
    providerJobId: 'provider-logical-1',
  }]);
  assert.doesNotMatch(JSON.stringify(acknowledged.requestSnapshot), /provider-secret-must-not-persist/);
  assert.doesNotMatch(JSON.stringify(completed.progress.executionCount), /provider-secret-must-not-persist/);
});

test('reuses a durable repair submission intent after acknowledgement persistence fails', async t => {
  const providerJobs = new Map();
  let qualityAttempt = 0;
  const { orchestrator, jobs, calls } = await createHarness(t, {
    submit: ({ request }) => {
      if (!providerJobs.has(request.idempotencyKey)) {
        providerJobs.set(request.idempotencyKey, `provider-logical-${providerJobs.size + 1}`);
      }
      return {
        jobId: providerJobs.get(request.idempotencyKey),
        status: 'queued',
        authorization: 'Bearer provider-secret-must-not-persist',
      };
    },
    quality: () => {
      qualityAttempt += 1;
      if (qualityAttempt === 1) {
        return {
          passed: false,
          checks: { visualQuality: { status: 'fail', issueCodes: ['local_artifact'] } },
          repairAction: { type: 'image_edit', focusIssueCodes: ['local_artifact'], userCharge: false },
          confidence: 'low',
        };
      }
      return {
        passed: true,
        checks: {},
        repairAction: { type: 'none', focusIssueCodes: [], userCharge: false },
        confidence: 'high',
      };
    },
  });
  const originalMarkSubmitted = jobs.assets.markSubmitted;
  let failedRepairAck = false;
  jobs.assets.markSubmitted = (jobId, assetId, patch) => {
    const asset = jobs.assets.getAsset(jobId, assetId);
    if (!failedRepairAck && asset.state === 'repairing') {
      failedRepairAck = true;
      throw new Error('local repair acknowledgement write failed');
    }
    return originalMarkSubmitted(jobId, assetId, patch);
  };
  const created = orchestrator.createJob(jobInput('job-repair-ack-retry'));

  await assert.rejects(
    () => orchestrator.runJob(created.id),
    error => error?.retryable === true && /repair acknowledgement write failed/.test(error.message),
  );

  const repairIntent = jobs.assets.getAsset(created.id, 'main-one');
  assert.equal(jobs.get(created.id).status, 'generating');
  assert.equal(repairIntent.state, 'repairing');
  assert.equal(calls.release.length, 0);
  assert.equal(calls.submit.length, 2);
  assert.deepEqual(repairIntent.requestSnapshot.submissionIntents.map(intent => ({
    ordinal: intent.ordinal,
    kind: intent.kind,
    status: intent.status,
  })), [
    { ordinal: 0, kind: 'initial', status: 'acknowledged' },
    { ordinal: 1, kind: 'repair', status: 'intent' },
  ]);

  const repairKey = calls.submit[1].idempotencyKey;
  const completed = await orchestrator.runJob(created.id);
  const acknowledged = jobs.assets.getAsset(created.id, 'main-one');

  assert.equal(completed.status, 'completed');
  assert.equal(providerJobs.size, 2);
  assert.equal(calls.submit.length, 3);
  assert.equal(calls.submit[2].idempotencyKey, repairKey);
  assert.equal(calls.release.length, 0);
  assert.equal(completed.progress.executionCount.providerSubmissions, 2);
  assert.equal(completed.progress.executionCount.providerRepairs, 1);
  assert.deepEqual(acknowledged.requestSnapshot.submissionIntents.map(intent => ({
    ordinal: intent.ordinal,
    kind: intent.kind,
    status: intent.status,
    providerJobId: intent.providerJobId,
  })), [
    { ordinal: 0, kind: 'initial', status: 'acknowledged', providerJobId: 'provider-logical-1' },
    { ordinal: 1, kind: 'repair', status: 'acknowledged', providerJobId: 'provider-logical-2' },
  ]);
  assert.doesNotMatch(JSON.stringify(acknowledged.requestSnapshot), /provider-secret-must-not-persist/);
  assert.doesNotMatch(JSON.stringify(completed.progress.executionCount), /provider-secret-must-not-persist/);
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
    schemaVersion: 4,
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
      communicationGoal: 'main commercial duty for main-original',
      generationSize: '2048x2048',
      ratio: '1:1',
      generationMode: 'edit',
      productAssetIds: ['product-front'],
      styleReferenceIds: [],
      requiredFacts: [],
      riskLevel: 'low',
      qualityChecks: ['technical_dimensions'],
      exportTargets: [],
      shotIntent: {
        type: 'identity',
        camera: { azimuth: 12 },
        crop: 'complete product crop',
        interactionState: 'stationary',
        sceneFamily: 'studio_identity',
        evidenceTier: 'safe',
      },
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
