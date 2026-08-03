import test from 'node:test';
import assert from 'node:assert/strict';

import sharp from 'sharp';

import {
  createCanvasBackgroundCleanPlate,
  nearestCanvasGenerationRatio,
} from '../server/canvasBackgroundCleanPlate.mjs';

test('background clean-plate generation selects the nearest supported ratio', () => {
  assert.equal(nearestCanvasGenerationRatio(1200, 1200), '1:1');
  assert.equal(nearestCanvasGenerationRatio(900, 1200), '3:4');
  assert.equal(nearestCanvasGenerationRatio(1200, 900), '4:3');
  assert.equal(nearestCanvasGenerationRatio(720, 1280), '9:16');
});

test('background clean-plate generation sends source and union mask through the existing edit gateway', async () => {
  const submitted = [];
  const sourceBuffer = await sharp({
    create: { width: 900, height: 1200, channels: 4, background: '#ffffff' },
  }).png().toBuffer();
  const maskBuffer = await sharp({
    create: { width: 900, height: 1200, channels: 3, background: '#ffffff' },
  }).png().toBuffer();
  const outputBuffer = await sharp({
    create: { width: 768, height: 1024, channels: 4, background: '#f8f8f8' },
  }).png().toBuffer();
  const generate = createCanvasBackgroundCleanPlate({
    model: 'gpt-image-2',
    providerAdapter: {
      async submitEdit(request) {
        submitted.push(request);
        return { jobId: 'job-clean-plate' };
      },
      async pollUntilReady(jobId) {
        assert.equal(jobId, 'job-clean-plate');
        return { jobId, status: 'completed', outputUrl: 'https://assets.example/clean.png' };
      },
    },
    imageInputReader: {
      async read(url) {
        assert.equal(url, 'https://assets.example/clean.png');
        return { buffer: outputBuffer, contentType: 'image/png' };
      },
    },
  });

  const result = await generate({
    sourceBuffer,
    maskBuffer,
    textBlocks: [{ text: '三色盖子可选择' }],
  });

  assert.equal(result, outputBuffer);
  assert.equal(submitted.length, 1);
  assert.equal(submitted[0].modelRoute.model, 'gpt-image-2');
  assert.equal(submitted[0].modelRoute.size, '1536x2048');
  assert.equal(submitted[0].inputAssets.length, 2);
  assert.equal(submitted[0].inputAssets[0].fileName, 'canvas-source.png');
  assert.equal(submitted[0].inputAssets[1].fileName, 'canvas-product-mask.png');
  assert.match(submitted[0].prompt, /white pixels/i);
  assert.match(submitted[0].prompt, /三色盖子可选择/);
  assert.match(submitted[0].idempotencyKey, /^canvas-clean-plate-[0-9a-f]{64}$/);
});

test('background clean-plate generation rejects mismatched provider job results', async () => {
  const sourceBuffer = await sharp({ create: { width: 64, height: 64, channels: 4, background: '#fff' } }).png().toBuffer();
  const generate = createCanvasBackgroundCleanPlate({
    providerAdapter: {
      async submitEdit() { return { jobId: 'expected-job' }; },
      async pollUntilReady() { return { jobId: 'wrong-job', status: 'completed', outputUrl: 'https://assets.example/clean.png' }; },
    },
    imageInputReader: { async read() { throw new Error('must not read mismatched output'); } },
  });

  await assert.rejects(
    () => generate({ sourceBuffer, maskBuffer: sourceBuffer }),
    error => error.code === 'PROVIDER_JOB_ID_MISMATCH',
  );
});
