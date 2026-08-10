import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';

import { createCanvasGenerationService } from '../server/canvasGenerationService.mjs';
import { createCanvasGenerationStore } from '../server/canvasGenerationStore.mjs';

function createHarness({
  imageInputReader,
  providerAdapter,
  imageGenerationPool = { run: task => task() },
  generatedAssetStore = {
    async persist({ taskId }) {
      return { url: `/api/generated-assets/${taskId}.png` };
    },
  },
  storeOptions = {},
  serviceOptions = {},
} = {}) {
  const db = new Database(':memory:');
  const store = createCanvasGenerationStore(db, {
    randomUUID: () => 'canvas-lease-token',
    ...storeOptions,
  });
  const serviceDependencies = {
    store,
    imageInputReader,
    providerAdapter,
    imageGenerationPool,
    generatedAssetStore,
    model: 'gpt-image-2',
  };
  const createService = (overrides = {}) => createCanvasGenerationService({
    ...serviceDependencies,
    ...serviceOptions,
    ...overrides,
  });
  const service = createService();
  return {
    db,
    store,
    service,
    createService,
    close() {
      db.close();
    },
  };
}

function createManualPool() {
  const queued = [];
  return {
    run(task) {
      return new Promise((resolve, reject) => {
        queued.push({ task, resolve, reject });
      });
    },
    async runNext() {
      const entry = queued.shift();
      assert.ok(entry, 'manual pool must contain a queued task');
      try {
        entry.resolve(await entry.task());
      } catch (error) {
        entry.reject(error);
      }
    },
    get queuedCount() {
      return queued.length;
    },
  };
}

function createManualIntervalScheduler() {
  const handles = new Set();
  return {
    setInterval(fn, intervalMs) {
      const handle = {
        fn,
        intervalMs,
        unrefCalled: false,
        unref() {
          this.unrefCalled = true;
        },
      };
      handles.add(handle);
      return handle;
    },
    clearInterval(handle) {
      handles.delete(handle);
    },
    async tick() {
      for (const handle of [...handles]) await handle.fn();
    },
    get activeCount() {
      return handles.size;
    },
  };
}

test('Canvas service preserves primary and supplementary input order for indexed provider edits', async t => {
  const reads = [];
  let submittedRequest;
  const harness = createHarness({
    imageInputReader: {
      async read(source) {
        reads.push(source);
        return {
          buffer: Buffer.from(source),
          contentType: source.endsWith('.jpg') ? 'image/jpeg' : 'image/png',
        };
      },
    },
    providerAdapter: {
      async submitEdit(request) {
        submittedRequest = request;
        return { jobId: 'provider-canvas-order', status: 'queued' };
      },
      async pollUntilReady(jobId) {
        return {
          jobId,
          status: 'completed',
          outputUrl: 'https://provider.example/canvas-order.png',
          error: '',
        };
      },
    },
  });
  t.after(() => harness.close());

  const result = await harness.service.regenerate({
    ownerEmail: 'owner@example.com',
    body: {
      prompt: '保留商品结构，改成夏日场景',
      image_url: 'primary.png',
      reference_images: ['lighting.jpg', 'layout.png'],
      ratio: '3:4',
    },
  });

  assert.deepEqual(reads, ['primary.png', 'lighting.jpg', 'layout.png']);
  assert.deepEqual(
    submittedRequest.inputAssets.map(asset => asset.buffer.toString()),
    ['primary.png', 'lighting.jpg', 'layout.png'],
  );
  assert.deepEqual(
    submittedRequest.inputAssets.map(asset => asset.fileName),
    ['canvas-reference-1.png', 'canvas-reference-2.jpg', 'canvas-reference-3.png'],
  );
  assert.match(submittedRequest.prompt, /Image 0 is the authoritative product view/);
  assert.match(submittedRequest.prompt, /Images 1 through 2 are indexed visual references/);
  assert.equal(result.url, `/api/generated-assets/${result.taskId}.png`);
});

test('Canvas visual intent uses an allowlisted skill prompt and persists intent in the durable fingerprint', async t => {
  const submitted = [];
  const harness = createHarness({
    imageInputReader: { async read(source) { return { buffer: Buffer.from(source), contentType: 'image/png' }; } },
    providerAdapter: {
      async submitEdit(request) {
        submitted.push(request);
        return { jobId: `provider-visual-${submitted.length}`, status: 'queued' };
      },
      async pollUntilReady(jobId) {
        return { jobId, status: 'completed', outputUrl: `https://provider.example/${jobId}.png`, error: '' };
      },
    },
  });
  t.after(() => harness.close());

  const base = {
    prompt: '夏日音乐节，标题为 SUNSET LIVE',
    image_url: 'subject.png',
    creation_intent: 'visual',
    request_key: 'visual-run:1',
  };
  const poster = await harness.service.regenerate({
    ownerEmail: 'owner@example.com',
    body: { ...base, skill_id: 'poster' },
  });
  const free = await harness.service.regenerate({
    ownerEmail: 'owner@example.com',
    body: { ...base, skill_id: 'free' },
  });

  assert.notEqual(poster.taskId, free.taskId);
  assert.match(submitted[0].prompt, /poster/i);
  assert.match(submitted[0].prompt, /clear visual hierarchy/i);
  assert.doesNotMatch(submitted[0].prompt, /ecommerce/i);
  const snapshot = harness.store.get(poster.taskId).requestSnapshot;
  assert.equal(snapshot.creationIntent, 'visual');
  assert.equal(snapshot.skillId, 'poster');
});

test('Canvas service carries a normalized local-edit target into the durable provider request', async t => {
  let submittedRequest;
  const harness = createHarness({
    imageInputReader: { async read() { return { buffer: Buffer.from('primary'), contentType: 'image/png' }; } },
    providerAdapter: {
      async submitEdit(request) {
        submittedRequest = request;
        return { jobId: 'provider-canvas-selection', status: 'queued' };
      },
      async pollUntilReady(jobId) {
        return { jobId, status: 'completed', outputUrl: `https://provider.example/${jobId}.png`, error: '' };
      },
    },
  });
  t.after(() => harness.close());

  await harness.service.regenerate({
    ownerEmail: 'owner@example.com',
    body: {
      prompt: '把包装颜色改成绿色',
      image_url: 'primary.png',
      selection: { mode: 'rectangle', rect: { x: -0.2, y: 0.1, w: 1.4, h: 0.5 } },
    },
  });

  assert.match(submittedRequest.prompt, /仅修改归一化区域/);
  assert.match(submittedRequest.prompt, /x=0\.000/);
  assert.match(submittedRequest.prompt, /w=1\.000/);
});

test('Canvas durable request preserves the selected resolution in its fingerprint and provider route', async t => {
  const submitted = [];
  const harness = createHarness({
    imageInputReader: {
      async read(source) {
        return { buffer: Buffer.from(source), contentType: 'image/png' };
      },
    },
    providerAdapter: {
      async submitEdit(request) {
        submitted.push(request);
        return { jobId: `provider-resolution-${submitted.length}`, status: 'queued' };
      },
      async pollUntilReady(jobId) {
        return { jobId, status: 'completed', outputUrl: `https://provider.example/${jobId}.png`, error: '' };
      },
    },
  });
  t.after(() => harness.close());

  const first = await harness.service.regenerate({
    ownerEmail: 'owner@example.com',
    body: { prompt: '保持主体', image_url: 'primary.png', ratio: '3:4', resolution: '2K' },
  });
  const second = await harness.service.regenerate({
    ownerEmail: 'owner@example.com',
    body: { prompt: '保持主体', image_url: 'primary.png', ratio: '3:4', resolution: '4K' },
  });

  assert.notEqual(first.taskId, second.taskId);
  assert.deepEqual(submitted.map(request => request.modelRoute.size), ['1536x2048', '2448x3264']);
});

test('Canvas request keys separate deliberate variants while retries with one key replay', async t => {
  let submitCalls = 0;
  const harness = createHarness({
    imageInputReader: { async read() { return { buffer: Buffer.from('primary'), contentType: 'image/png' }; } },
    providerAdapter: {
      async submitEdit() {
        submitCalls += 1;
        return { jobId: `provider-variant-${submitCalls}`, status: 'queued' };
      },
      async pollUntilReady(jobId) {
        return { jobId, status: 'completed', outputUrl: `https://provider.example/${jobId}.png`, error: '' };
      },
    },
  });
  t.after(() => harness.close());
  const base = { prompt: '保持商品结构', image_url: 'primary.png', ratio: '1:1' };
  const first = await harness.service.regenerate({ ownerEmail: 'owner@example.com', body: { ...base, request_key: 'run-1:1' } });
  const replay = await harness.service.regenerate({ ownerEmail: 'owner@example.com', body: { ...base, request_key: 'run-1:1' } });
  const secondVariant = await harness.service.regenerate({ ownerEmail: 'owner@example.com', body: { ...base, request_key: 'run-1:2' } });
  assert.equal(submitCalls, 2);
  assert.equal(replay.replay, true);
  assert.equal(first.url, replay.url);
  assert.notEqual(first.url, secondVariant.url);
});

test('Canvas regeneration defaults to the billed 2K provider route', async t => {
  let submittedRequest;
  const harness = createHarness({
    imageInputReader: {
      async read(source) {
        return { buffer: Buffer.from(source), contentType: 'image/png' };
      },
    },
    providerAdapter: {
      async submitEdit(request) {
        submittedRequest = request;
        return { jobId: 'provider-default-2k', status: 'queued' };
      },
      async pollUntilReady(jobId) {
        return { jobId, status: 'completed', outputUrl: 'https://provider.example/default-2k.png', error: '' };
      },
    },
  });
  t.after(() => harness.close());

  const result = await harness.service.regenerate({
    ownerEmail: 'owner@example.com',
    body: { prompt: '保持主体', image_url: 'primary.png', ratio: '1:1' },
  });

  assert.equal(submittedRequest.modelRoute.size, '2048x2048');
  assert.equal(result.resolution, '2K');
});

test('Canvas provider submit and poll both execute inside the shared image generation pool', async t => {
  let insidePool = false;
  const sequence = [];
  const harness = createHarness({
    imageInputReader: {
      async read() {
        return { buffer: Buffer.from('primary'), contentType: 'image/png' };
      },
    },
    imageGenerationPool: {
      async run(task) {
        sequence.push('pool:start');
        insidePool = true;
        try {
          return await task();
        } finally {
          insidePool = false;
          sequence.push('pool:end');
        }
      },
    },
    providerAdapter: {
      async submitEdit() {
        assert.equal(insidePool, true);
        sequence.push('submit');
        return { jobId: 'provider-canvas-pool', status: 'queued' };
      },
      async pollUntilReady(jobId) {
        assert.equal(insidePool, true);
        sequence.push('poll');
        return {
          jobId,
          status: 'completed',
          outputUrl: 'https://provider.example/canvas-pool.png',
          error: '',
        };
      },
    },
  });
  t.after(() => harness.close());

  await harness.service.regenerate({
    ownerEmail: 'owner@example.com',
    body: { prompt: '保持主体', image_url: 'primary.png', ratio: '1:1' },
  });

  assert.deepEqual(sequence, ['pool:start', 'submit', 'poll', 'pool:end']);
});

test('queued identical Canvas requests claim authority inside the pool and submit only once after the original lease window', async t => {
  let clock = 0;
  let leaseSequence = 0;
  let submitCalls = 0;
  const pool = createManualPool();
  const body = {
    prompt: '保留商品结构，替换为夏日背景',
    image_url: 'primary.png',
    ratio: '1:1',
  };
  const harness = createHarness({
    storeOptions: {
      now: () => clock,
      leaseMs: 100,
      randomUUID: () => `canvas-lease-${++leaseSequence}`,
    },
    imageGenerationPool: pool,
    imageInputReader: {
      async read(source) {
        return { buffer: Buffer.from(source), contentType: 'image/png' };
      },
    },
    providerAdapter: {
      async submitEdit() {
        submitCalls += 1;
        return { jobId: `provider-queued-${submitCalls}`, status: 'queued' };
      },
      async pollUntilReady(jobId) {
        return {
          jobId,
          status: 'completed',
          outputUrl: 'https://provider.example/queued-result.png',
          error: '',
        };
      },
    },
  });
  t.after(() => harness.close());

  const first = harness.service.regenerate({ ownerEmail: 'owner@example.com', body });
  assert.equal(pool.queuedCount, 1);
  clock += 101;
  const second = harness.service.regenerate({
    ownerEmail: 'owner@example.com',
    body: { ...body },
  });
  assert.equal(pool.queuedCount, 2);

  await pool.runNext();
  await pool.runNext();
  const [firstOutcome, secondOutcome] = await Promise.allSettled([first, second]);

  assert.equal(firstOutcome.status, 'fulfilled');
  assert.equal(secondOutcome.status, 'fulfilled');
  assert.equal(submitCalls, 1);
  assert.equal(firstOutcome.value.url, secondOutcome.value.url);
  assert.equal(secondOutcome.value.replay, true);
});

test('active Canvas submit renews its fenced lease so a concurrent identical request cannot resubmit', async t => {
  let clock = 0;
  let leaseSequence = 0;
  let submitCalls = 0;
  let markSubmitStarted;
  let releaseFirstSubmit;
  const submitStarted = new Promise(resolve => {
    markSubmitStarted = resolve;
  });
  const firstSubmitGate = new Promise(resolve => {
    releaseFirstSubmit = resolve;
  });
  const scheduler = createManualIntervalScheduler();
  const body = {
    prompt: '保留包装，只调整背景光线',
    image_url: 'primary.png',
    ratio: '4:3',
  };
  const harness = createHarness({
    storeOptions: {
      now: () => clock,
      leaseMs: 100,
      randomUUID: () => `canvas-lease-${++leaseSequence}`,
    },
    serviceOptions: {
      now: () => clock,
      leaseHeartbeatMs: 50,
      setIntervalFn: scheduler.setInterval,
      clearIntervalFn: scheduler.clearInterval,
    },
    imageInputReader: {
      async read(source) {
        return { buffer: Buffer.from(source), contentType: 'image/png' };
      },
    },
    providerAdapter: {
      async submitEdit() {
        submitCalls += 1;
        if (submitCalls === 1) {
          markSubmitStarted();
          await firstSubmitGate;
        }
        return { jobId: `provider-heartbeat-${submitCalls}`, status: 'queued' };
      },
      async pollUntilReady(jobId) {
        return {
          jobId,
          status: 'completed',
          outputUrl: 'https://provider.example/heartbeat-result.png',
          error: '',
        };
      },
    },
  });
  t.after(() => harness.close());
  const concurrentService = harness.createService({
    imageGenerationPool: { run: task => task() },
  });

  const first = harness.service.regenerate({ ownerEmail: 'owner@example.com', body });
  await submitStarted;
  clock += 60;
  await scheduler.tick();
  clock += 50;
  const second = concurrentService.regenerate({
    ownerEmail: 'owner@example.com',
    body: { ...body },
  });
  const [secondOutcome] = await Promise.allSettled([second]);
  releaseFirstSubmit();
  const [firstOutcome] = await Promise.allSettled([first]);

  assert.equal(firstOutcome.status, 'fulfilled');
  assert.equal(secondOutcome.status, 'rejected');
  assert.equal(secondOutcome.reason.code, 'CANVAS_REQUEST_IN_PROGRESS');
  assert.equal(submitCalls, 1);
  assert.equal(scheduler.activeCount, 0);
});

test('an identical owner request resumes the persisted provider job without submitting twice', async t => {
  let submitCalls = 0;
  let pollCalls = 0;
  const body = {
    prompt: '保留包装和颜色，只替换背景',
    image_url: 'primary.png',
    reference_images: ['reference.png'],
    ratio: '4:3',
  };
  const harness = createHarness({
    imageInputReader: {
      async read(source) {
        return { buffer: Buffer.from(source), contentType: 'image/png' };
      },
    },
    providerAdapter: {
      async submitEdit() {
        submitCalls += 1;
        return { jobId: 'provider-canvas-resume', status: 'queued' };
      },
      async pollUntilReady(jobId) {
        pollCalls += 1;
        if (pollCalls === 1) {
          throw Object.assign(new Error('provider temporarily unavailable'), {
            status: 503,
            code: 'PROVIDER_UNAVAILABLE',
            retryable: true,
            retryAfter: 2,
            jobId,
          });
        }
        return {
          jobId,
          status: 'completed',
          outputUrl: 'https://provider.example/canvas-resume.png',
          error: '',
        };
      },
    },
  });
  t.after(() => harness.close());

  let firstError;
  await assert.rejects(
    harness.service.regenerate({ ownerEmail: 'owner@example.com', body }),
    error => {
      firstError = error;
      return error.status === 503 && error.retryable === true;
    },
  );
  assert.match(firstError.taskId, /^canvas_[a-f0-9]{64}$/);
  assert.equal(harness.store.get(firstError.taskId).providerJobId, 'provider-canvas-resume');

  const resumed = await harness.service.regenerate({
    ownerEmail: 'owner@example.com',
    body: { ...body },
  });
  const replayed = await harness.service.regenerate({
    ownerEmail: 'owner@example.com',
    body: { ...body },
  });

  assert.equal(submitCalls, 1);
  assert.equal(pollCalls, 2);
  assert.equal(resumed.url, replayed.url);
  assert.equal(replayed.replay, true);
});

test('rejects a mismatched polled provider job id before persisting or returning its output', async t => {
  let persistCalls = 0;
  const harness = createHarness({
    imageInputReader: {
      async read() {
        return { buffer: Buffer.from('primary'), contentType: 'image/png' };
      },
    },
    providerAdapter: {
      async submitEdit() {
        return { jobId: 'provider-canvas-expected', status: 'queued' };
      },
      async pollUntilReady() {
        return {
          jobId: 'provider-canvas-other',
          status: 'completed',
          outputUrl: 'https://provider.example/wrong-output.png',
          error: '',
        };
      },
    },
    generatedAssetStore: {
      async persist() {
        persistCalls += 1;
        return { url: '/api/generated-assets/should-not-exist.png' };
      },
    },
  });
  t.after(() => harness.close());

  let mismatch;
  await assert.rejects(
    harness.service.regenerate({
      ownerEmail: 'owner@example.com',
      body: { prompt: '保持主体', image_url: 'primary.png', ratio: '1:1' },
    }),
    error => {
      mismatch = error;
      return error.code === 'PROVIDER_JOB_ID_MISMATCH' && error.retryable === false;
    },
  );

  const persisted = harness.store.get(mismatch.taskId);
  assert.equal(persistCalls, 0);
  assert.equal(persisted.providerJobId, 'provider-canvas-expected');
  assert.equal(persisted.outputUrl, '');
  assert.equal(persisted.stableUrl, '');
  assert.equal(persisted.status, 'failed');
});

test('maps shared pool saturation to a retryable 503 without terminally failing the durable request', async t => {
  const harness = createHarness({
    imageInputReader: {
      async read() {
        throw new Error('image reader must not run when the pool is saturated');
      },
    },
    imageGenerationPool: {
      async run() {
        throw new Error('Image generation service is busy, please retry shortly');
      },
    },
    providerAdapter: {
      async submitEdit() {
        throw new Error('submit must not run');
      },
      async pollUntilReady() {
        throw new Error('poll must not run');
      },
    },
  });
  t.after(() => harness.close());

  let busyError;
  await assert.rejects(
    harness.service.regenerate({
      ownerEmail: 'owner@example.com',
      body: { prompt: '保持主体', image_url: 'primary.png' },
    }),
    error => {
      busyError = error;
      return error.status === 503
        && error.code === 'CANVAS_GENERATION_BUSY'
        && error.retryable === true;
    },
  );

  assert.equal(harness.store.get(busyError.taskId).status, 'queued');
});
