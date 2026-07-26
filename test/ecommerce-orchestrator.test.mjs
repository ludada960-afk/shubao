import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { createEcommerceOrchestrator } from '../server/ecommerceEngine/orchestrator.mjs';
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
  quality,
  poll,
  hold,
  settle,
  orchestratorOptions = {},
} = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'shubao-orchestrator-'));
  const jobs = createGenerationJobs(join(directory, 'jobs.db'));
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
    read: [],
    quality: [],
    repair: [],
    hold: [],
    settle: [],
    release: [],
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
    analyzeProductTruth: async payload => {
      calls.analyze += 1;
      calls.analyzePayloads.push(payload);
      calls.sequence.push('analyze');
      return {
        productName: payload.product_name,
        category: payload.category,
        sourceAssetIds: (payload.assets?.product || []).map(asset => asset.assetId),
        fingerprint: 'truth-fingerprint',
        confirmedFacts: {},
        forbiddenMutations: [],
      };
    },
    compileCampaignBible: (direction, overrides) => {
      calls.campaign += 1;
      calls.sequence.push('campaign');
      return {
        directionId: direction.id,
        title: direction.title,
        editableBrief: overrides.editableBrief,
        confirmed: true,
      };
    },
    buildAssetPlan: () => {
      calls.plan += 1;
      calls.sequence.push('plan');
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
        return { id: url.split('/').pop(), url, contentType: 'image/png', label };
      },
      async read(assetId) {
        calls.read.push(assetId);
        calls.sequence.push(`read:${assetId}`);
        return { buffer: IMAGE_BUFFER, contentType: 'image/png' };
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
    canRetry: attempt => Number.isInteger(attempt) && attempt >= 0 && attempt < 2,
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
        return { status: 'released', itemKey: item.id };
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

test('createJob only persists queued work and does not start a second background runner', async t => {
  const { orchestrator, calls } = await createHarness(t);

  const created = orchestrator.createJob(jobInput('job-no-double-schedule'));

  assert.equal(created.status, 'queued');
  assert.equal(calls.scheduled, 0);
  assert.equal(calls.submit.length, 0);
});

test('normalizes legacy product and reference URLs into stable asset identities before analysis and compilation', async t => {
  const { orchestrator, calls } = await createHarness(t);
  const created = orchestrator.createJob({
    id: 'job-legacy-assets',
    ownerEmail: OWNER,
    payload: {
      product_name: '测试商品',
      category: '数码3C',
      platform: '淘宝',
      real_shots: ['/api/ec-temp-img/front.png', '/api/ec-temp-img/side.png'],
      reference_images: ['/api/ec-temp-img/style.png'],
    },
  });

  await orchestrator.runJob(created.id);

  assert.deepEqual(calls.analyzePayloads[0].assets, {
    product: [
      { assetId: 'product-1', url: '/api/ec-temp-img/front.png' },
      { assetId: 'product-2', url: '/api/ec-temp-img/side.png' },
    ],
    reference: [
      { assetId: 'reference-1', url: '/api/ec-temp-img/style.png' },
    ],
    proof: [],
    protection: [],
  });
  assert.deepEqual(calls.compileAssets[0], calls.analyzePayloads[0].assets);
});

test('caps system repairs at two and releases a needs-review item without settlement', async t => {
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
  assert.equal(asset.attemptCount, 2);
  assert.equal(calls.submit.length, 3, 'initial provider task plus two system repairs');
  assert.equal(calls.quality.length, 3);
  assert.equal(calls.settle.length, 0);
  assert.deepEqual(calls.release.map(call => call.itemId), ['main-one']);
});

test('settles only successful assets in a partial batch and releases the failed item', async t => {
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
  });
  const created = orchestrator.createJob(jobInput('job-partial'));

  const completed = await orchestrator.runJob(created.id);

  assert.equal(completed.status, 'needs_review');
  assert.deepEqual(calls.settle.map(call => call.itemId), ['main-pass']);
  assert.deepEqual(calls.release.map(call => call.itemId), ['detail-fail']);
  assert.deepEqual(Object.keys(completed.output.images), ['main-pass']);
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
  assert.equal(jobs.assets.getAsset(created.id, 'main-one').state, 'quality_check');
  assert.equal(calls.submit.length, 1);
  assert.equal(calls.release.length, 0);

  const completed = await orchestrator.runJob(created.id);
  assert.equal(completed.status, 'completed');
  assert.equal(calls.submit.length, 1);
  assert.equal(calls.settle.length, 2);
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
    resumeable: true,
    required: 5000,
    available: 1000,
  }]);
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
