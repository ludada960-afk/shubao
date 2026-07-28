import assert from 'node:assert/strict';
import test from 'node:test';
import sharp from 'sharp';

import {
  evaluateSuiteDiversity,
  measureSuiteImage,
  visualFingerprintDistance,
} from '../server/ecommerceEngine/suiteDiversity.mjs';

async function scene({ accent = '#111111', panel = false } = {}) {
  const base = sharp({
    create: { width: 128, height: 128, channels: 3, background: '#f4f4f4' },
  });
  const composites = panel
    ? [
      { input: await sharp({ create: { width: 62, height: 62, channels: 3, background: '#111111' } }).png().toBuffer(), left: 0, top: 0 },
      { input: await sharp({ create: { width: 62, height: 62, channels: 3, background: '#eeeeee' } }).png().toBuffer(), left: 66, top: 0 },
      { input: await sharp({ create: { width: 62, height: 62, channels: 3, background: '#eeeeee' } }).png().toBuffer(), left: 0, top: 66 },
      { input: await sharp({ create: { width: 62, height: 62, channels: 3, background: '#111111' } }).png().toBuffer(), left: 66, top: 66 },
    ]
    : [{ input: await sharp({ create: { width: 54, height: 84, channels: 3, background: accent } }).png().toBuffer(), left: 38, top: 22 }];
  return base.composite(composites).png().toBuffer();
}

test('perceptual suite check rejects near duplicates but keeps a materially different scene', async () => {
  const original = await scene({ accent: '#222222' });
  const nearDuplicate = await scene({ accent: '#252525' });
  const different = await scene({ accent: '#d7d7d7' });
  const first = await measureSuiteImage(original);
  const near = await measureSuiteImage(nearDuplicate);
  const far = await measureSuiteImage(different);

  assert.ok(visualFingerprintDistance(first.fingerprint, near.fingerprint) < 0.04);
  assert.ok(visualFingerprintDistance(first.fingerprint, far.fingerprint) > 0.08);
  assert.equal((await evaluateSuiteDiversity({
    candidate: { assetId: 'main-2', role: 'main_text', buffer: nearDuplicate },
    existing: [{ assetId: 'main-1', role: 'main_text', buffer: original }],
  })).passed, false);
  assert.equal((await evaluateSuiteDiversity({
    candidate: { assetId: 'main-3', role: 'main_text', buffer: different },
    existing: [{ assetId: 'main-1', role: 'main_text', buffer: original }],
  })).passed, true);
});

test('suite check rejects a visible multi-panel collage before delivery', async () => {
  const collage = await scene({ panel: true });
  const measured = await measureSuiteImage(collage);
  const verdict = await evaluateSuiteDiversity({
    candidate: { assetId: 'detail-1', role: 'detail_slice_usage', buffer: collage },
    existing: [],
  });

  assert.equal(measured.likelyCollage, true);
  assert.equal(verdict.passed, false);
  assert.deepEqual(verdict.issueCodes, ['suite_collage_layout']);
});
