import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  SEGMENTATION_INPUT_SIZE,
  normalizeSegmentationOutput,
  preprocessSegmentationImage,
  reduceSegmentationProgress,
} from '../src/pages/EcCanvas/canvasSegmentationModel.js';

test('preprocesses RGBA pixels into U2NetP channel-first ImageNet tensors', () => {
  const tensor = preprocessSegmentationImage({
    data: new Uint8ClampedArray([255, 128, 0, 255]),
    width: 1,
    height: 1,
  });

  assert.equal(SEGMENTATION_INPUT_SIZE, 320);
  assert.equal(tensor.length, 3);
  assert.ok(Math.abs(tensor[0] - ((1 - 0.485) / 0.229)) < 1e-6);
  assert.ok(Math.abs(tensor[1] - (((128 / 255) - 0.456) / 0.224)) < 1e-6);
  assert.ok(Math.abs(tensor[2] - ((0 - 0.406) / 0.225)) < 1e-6);
});

test('normalizes model output to a stable 8-bit alpha mask', () => {
  assert.deepEqual(
    [...normalizeSegmentationOutput(new Float32Array([2, 4, 6]))],
    [0, 128, 255],
  );
  assert.deepEqual(
    [...normalizeSegmentationOutput(new Float32Array([7, 7, 7]))],
    [0, 0, 0],
  );
});

test('maps real stages to monotonic user-facing progress', () => {
  let progress = reduceSegmentationProgress(null, { stage: 'model-download', loaded: 25, total: 100 });
  assert.equal(progress.stage, 'model-download');
  assert.equal(progress.percent, 8);
  assert.equal(progress.coldStart, true);

  progress = reduceSegmentationProgress(progress, { stage: 'model-download', loaded: 75, total: 100 });
  assert.equal(progress.percent, 18);
  progress = reduceSegmentationProgress(progress, { stage: 'detecting' });
  assert.equal(progress.percent, 35);
  progress = reduceSegmentationProgress(progress, { stage: 'segmenting', completed: 2, total: 3 });
  assert.equal(progress.percent, 68);

  const stale = reduceSegmentationProgress(progress, { stage: 'model-download', loaded: 1, total: 100 });
  assert.equal(stale.percent, 68);
  assert.equal(stale.stage, 'segmenting');

  progress = reduceSegmentationProgress(progress, { stage: 'materializing' });
  assert.equal(progress.percent, 86);
  progress = reduceSegmentationProgress(progress, { stage: 'complete' });
  assert.equal(progress.percent, 100);
});

test('worker verifies the pinned model digest before populating Cache Storage', async () => {
  const worker = await readFile(new URL('../src/pages/EcCanvas/canvasSegmentationWorker.js', import.meta.url), 'utf8');

  assert.match(worker, /crypto\.subtle\.digest\('SHA-256'/);
  assert.match(worker, /SEGMENTATION_MODEL_SHA256/);
  assert.ok(
    worker.indexOf('await verifyModelIntegrity(bytes)') < worker.indexOf('cache.put(request'),
    'model integrity verification must happen before Cache Storage writes',
  );
  assert.match(worker, /cache\.delete\(request\)/);
});
