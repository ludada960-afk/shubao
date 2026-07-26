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
} = {}) {
  const db = new Database(':memory:');
  const store = createCanvasGenerationStore(db, {
    randomUUID: () => 'canvas-lease-token',
  });
  const service = createCanvasGenerationService({
    store,
    imageInputReader,
    providerAdapter,
    imageGenerationPool,
    generatedAssetStore,
    model: 'gpt-image-2',
  });
  return {
    db,
    store,
    service,
    close() {
      db.close();
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
