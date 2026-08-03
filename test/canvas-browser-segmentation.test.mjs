import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';

import {
  createBrowserSegmentationPrompts,
  createCanvasSegmentationPlanTokenService,
  decodeBrowserSegmentationMasks,
} from '../server/canvasSegmentationPlan.mjs';
import { normalizeSegmentationCropMask } from '../server/canvasSegmentation.mjs';

const SECRET = 'canvas-browser-segmentation-test-secret-1234567890';
const NOW = Date.parse('2026-08-03T08:00:00.000Z');

function planFixture() {
  return {
    productGroup: { name: '三色盒', box: [0.05, 0.1, 0.9, 0.72], confidence: 0.99 },
    instances: [
      { id: 'gray', name: '灰色盒', kind: 'product', box: [0.2, 0.15, 0.2, 0.3], confidence: 0.96 },
      { id: 'blue', name: '蓝色盒', kind: 'product', box: [0.05, 0.45, 0.25, 0.35], confidence: 0.95 },
      { id: 'orange', name: '橙色盒', kind: 'product', box: [0.62, 0.42, 0.28, 0.36], confidence: 0.94 },
    ],
    textBlocks: [{
      id: 'caption', text: '三色盖子可选择', box: [0.2, 0.85, 0.6, 0.08], confidence: 0.91,
      color: '#ffffff', background: '#efb64e',
    }],
  };
}

function pngDataUrl(buffer) {
  return `data:image/png;base64,${buffer.toString('base64')}`;
}

test('creates bounded padded crop prompts from server-normalized product boxes', () => {
  const prompts = createBrowserSegmentationPrompts(planFixture(), { width: 1000, height: 800, paddingRatio: 0.1 });

  assert.deepEqual(prompts.map(prompt => prompt.id), ['gray', 'blue', 'orange']);
  assert.deepEqual(prompts[0], {
    id: 'gray',
    name: '灰色盒',
    box: [180, 96, 420, 384],
  });
  assert.deepEqual(prompts[1].box, [25, 332, 325, 668]);
  assert.ok(prompts.every(prompt => prompt.box[0] >= 0 && prompt.box[1] >= 0));
  assert.ok(prompts.every(prompt => prompt.box[2] <= 1000 && prompt.box[3] <= 800));
});

test('signs plans to the owner and source and rejects expiry or tampering', () => {
  const tokens = createCanvasSegmentationPlanTokenService({ secret: SECRET, now: () => NOW, ttlMs: 60_000 });
  const prompts = createBrowserSegmentationPrompts(planFixture(), { width: 1000, height: 800 });
  const issued = tokens.issue({
    ownerEmail: 'Owner@Example.com',
    imageUrl: '/api/generated-assets/source.png',
    source: { width: 1000, height: 800 },
    plan: planFixture(),
    prompts,
  });

  const verified = tokens.verify({
    token: issued.planToken,
    ownerEmail: 'owner@example.com',
    imageUrl: '/api/generated-assets/source.png',
  });
  assert.equal(verified.ownerEmail, 'owner@example.com');
  assert.deepEqual(verified.prompts, prompts);
  assert.equal(issued.expiresAt, '2026-08-03T08:01:00.000Z');

  assert.throws(
    () => tokens.verify({ token: issued.planToken, ownerEmail: 'other@example.com', imageUrl: '/api/generated-assets/source.png' }),
    error => error.code === 'CANVAS_SEGMENTATION_PLAN_MISMATCH',
  );
  assert.throws(
    () => tokens.verify({ token: `${issued.planToken.slice(0, -1)}x`, ownerEmail: 'owner@example.com', imageUrl: '/api/generated-assets/source.png' }),
    error => error.code === 'CANVAS_SEGMENTATION_PLAN_INVALID',
  );

  const expired = createCanvasSegmentationPlanTokenService({ secret: SECRET, now: () => NOW + 60_000 });
  assert.throws(
    () => expired.verify({ token: issued.planToken, ownerEmail: 'owner@example.com', imageUrl: '/api/generated-assets/source.png' }),
    error => error.code === 'CANVAS_SEGMENTATION_PLAN_EXPIRED',
  );
});

test('accepts only one bounded PNG mask for each signed prompt id', async () => {
  const mask = await sharp(Buffer.alloc(32 * 32, 255), {
    raw: { width: 32, height: 32, channels: 1 },
  }).png().toBuffer();
  const prompts = [{ id: 'gray', name: '灰色盒', box: [10, 10, 50, 50] }];
  const decoded = decodeBrowserSegmentationMasks([
    { prompt_id: 'gray', data: pngDataUrl(mask) },
  ], prompts);

  assert.equal(decoded.length, 1);
  assert.equal(decoded[0].promptId, 'gray');
  assert.deepEqual(decoded[0].box, [10, 10, 50, 50]);
  assert.ok(decoded[0].buffer.equals(mask));

  assert.throws(
    () => decodeBrowserSegmentationMasks([{ prompt_id: 'unknown', data: pngDataUrl(mask) }], prompts),
    error => error.code === 'CANVAS_SEGMENTATION_MASK_UNKNOWN',
  );
  assert.throws(
    () => decodeBrowserSegmentationMasks([
      { prompt_id: 'gray', data: pngDataUrl(mask) },
      { prompt_id: 'gray', data: pngDataUrl(mask) },
    ], prompts),
    error => error.code === 'CANVAS_SEGMENTATION_MASK_DUPLICATE',
  );
  assert.throws(
    () => decodeBrowserSegmentationMasks([{ prompt_id: 'gray', data: 'data:image/jpeg;base64,AA==' }], prompts),
    error => error.code === 'CANVAS_SEGMENTATION_MASK_FORMAT',
  );
});

test('expands a crop mask into its signed source-image rectangle', async () => {
  const crop = Buffer.alloc(20 * 10, 0);
  for (let y = 2; y < 8; y += 1) {
    for (let x = 4; x < 16; x += 1) crop[y * 20 + x] = 255;
  }
  const cropPng = await sharp(crop, { raw: { width: 20, height: 10, channels: 1 } }).png().toBuffer();

  const normalized = await normalizeSegmentationCropMask(cropPng, {
    width: 100,
    height: 80,
    box: [20, 10, 60, 50],
  });

  assert.deepEqual(normalized.bounds, { x: 28, y: 18, width: 24, height: 24 });
  assert.equal(normalized.data[17 * 100 + 28], 0);
  assert.equal(normalized.data[18 * 100 + 28], 255);
  assert.equal(normalized.data[41 * 100 + 51], 255);
  assert.equal(normalized.data[42 * 100 + 51], 0);
});
