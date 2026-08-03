import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createCanvasSegmentationRuntime,
  segmentationMasksToApi,
} from '../src/pages/EcCanvas/canvasSegmentationRuntime.js';

class FakeWorker {
  constructor() {
    this.messages = [];
    this.onmessage = null;
    this.onerror = null;
  }

  postMessage(message) {
    this.messages.push(message);
  }

  emit(data) {
    this.onmessage?.({ data });
  }
}

test('prewarms once and correlates progress and masks to the requesting job', async () => {
  const worker = new FakeWorker();
  let creations = 0;
  const runtime = createCanvasSegmentationRuntime({
    createWorker() {
      creations += 1;
      return worker;
    },
  });
  const warmProgress = [];
  const warm = runtime.prewarm({ onProgress: event => warmProgress.push(event) });
  const warmMessage = worker.messages[0];
  assert.equal(warmMessage.type, 'warm');
  worker.emit({ type: 'progress', jobId: warmMessage.jobId, stage: 'model-download', loaded: 50, total: 100 });
  worker.emit({ type: 'ready', jobId: warmMessage.jobId, cached: false });
  await warm;

  const progress = [];
  const segmentation = runtime.segment({
    imageUrl: '/api/generated-assets/source.png',
    prompts: [{ id: 'product-1', box: [0, 0, 20, 20] }],
    onProgress: event => progress.push(event),
  });
  const segmentMessage = worker.messages.at(-1);
  assert.equal(segmentMessage.type, 'segment');
  worker.emit({ type: 'progress', jobId: segmentMessage.jobId, stage: 'segmenting', completed: 1, total: 1 });
  const bytes = new Uint8Array([137, 80, 78, 71]).buffer;
  worker.emit({
    type: 'result',
    jobId: segmentMessage.jobId,
    masks: [{ promptId: 'product-1', buffer: bytes }],
  });
  const result = await segmentation;

  assert.equal(creations, 1);
  assert.equal(warmProgress.length, 1);
  assert.equal(progress.length, 1);
  assert.equal(result.length, 1);
  assert.ok(result[0].blob instanceof Blob);
  assert.equal(result[0].blob.type, 'image/png');
});

test('coalesces concurrent prewarm callers and replays the latest cold-start progress', async () => {
  const worker = new FakeWorker();
  const runtime = createCanvasSegmentationRuntime({ createWorker: () => worker });
  const idleProgress = [];
  const idleWarm = runtime.prewarm({ onProgress: event => idleProgress.push(event) });
  const warmMessage = worker.messages[0];
  worker.emit({ type: 'progress', jobId: warmMessage.jobId, stage: 'model-download', loaded: 25, total: 100 });

  const clickProgress = [];
  const clickWarm = runtime.prewarm({ onProgress: event => clickProgress.push(event) });
  assert.equal(worker.messages.length, 1);
  assert.equal(clickProgress.at(-1)?.stage, 'model-download');
  assert.equal(clickProgress.at(-1)?.loaded, 25);

  worker.emit({ type: 'progress', jobId: warmMessage.jobId, stage: 'model-initialize' });
  worker.emit({ type: 'ready', jobId: warmMessage.jobId, cached: false });
  await Promise.all([idleWarm, clickWarm]);

  assert.equal(idleProgress.at(-1)?.stage, 'model-initialize');
  assert.equal(clickProgress.at(-1)?.stage, 'model-initialize');
  assert.equal(runtime.isWarm(), true);
});

test('cancels a running job and ignores its later worker result', async () => {
  const worker = new FakeWorker();
  const runtime = createCanvasSegmentationRuntime({ createWorker: () => worker });
  const controller = new AbortController();
  const pending = runtime.segment({
    imageUrl: '/source.png',
    prompts: [{ id: 'product-1', box: [0, 0, 20, 20] }],
    signal: controller.signal,
  });
  const jobId = worker.messages[0].jobId;
  controller.abort();

  await assert.rejects(pending, error => error.name === 'AbortError');
  assert.deepEqual(worker.messages.at(-1), { type: 'cancel', jobId });
  worker.emit({ type: 'result', jobId, masks: [] });
  assert.equal(runtime.activeJobCount(), 0);
});

test('serializes worker PNG blobs using the server mask contract', async () => {
  const masks = await segmentationMasksToApi([{
    promptId: 'product-1',
    blob: new Blob([new Uint8Array([137, 80, 78, 71])], { type: 'image/png' }),
  }]);

  assert.deepEqual(masks, [{
    prompt_id: 'product-1',
    data: 'data:image/png;base64,iVBORw==',
  }]);
});
