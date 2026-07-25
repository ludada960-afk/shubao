import test from 'node:test';
import assert from 'node:assert/strict';

import {
  LEGAL_IMAGE_SIZES,
  buildModelRoute,
  selectGenerationModel,
  validateGenerationSize,
} from '../server/ecommerceEngine/modelCatalog.mjs';

test('exposes the exact legal generation size catalog', () => {
  assert.deepEqual(LEGAL_IMAGE_SIZES, {
    '1K': { '1:1': '1024x1024', '3:4': '768x1024', '4:3': '1024x768' },
    '2K': { '1:1': '2048x2048', '3:4': '1536x2048', '4:3': '2048x1536', '9:16': '1152x2048' },
    '4K': { '1:1': '2880x2880', '3:4': '2448x3264', '4:3': '3264x2448', '9:16': '2160x3840' },
  });
});

test('uses gpt-image-2 and a 2K square for a standard formal asset', () => {
  assert.deepEqual(buildModelRoute({ resolution: '2K', assetCount: 1, batchEligible: false }), {
    model: 'gpt-image-2',
    size: '2048x2048',
    async: true,
    mode: 'edit',
  });
});

test('uses gpt-image-2-n only for confirmed same-style batches', () => {
  assert.equal(
    selectGenerationModel({ assetCount: 4, campaignConfirmed: true, sameStyle: true, highRiskFacts: false }),
    'gpt-image-2-n',
  );
  assert.equal(
    selectGenerationModel({ assetCount: 4, campaignConfirmed: true, sameStyle: true, highRiskFacts: true }),
    'gpt-image-2',
  );
  assert.equal(
    selectGenerationModel({ assetCount: 4, campaignConfirmed: true, sameStyle: true, highRiskFacts: false, resolution: '4K' }),
    'gpt-image-2',
  );
});

test('requires an explicit false high-risk assessment for batch routing', () => {
  const eligibleBatch = { assetCount: 4, campaignConfirmed: true, sameStyle: true };

  assert.equal(selectGenerationModel(eligibleBatch), 'gpt-image-2');
  for (const highRiskFacts of [undefined, 'false', [], ['certification'], true, 1, null, {}]) {
    assert.equal(selectGenerationModel({ ...eligibleBatch, highRiskFacts }), 'gpt-image-2');
  }
});

test('validates legal numeric dimensions and rejects unsafe dimensions', () => {
  for (const size of Object.values(LEGAL_IMAGE_SIZES).flatMap((ratios) => Object.values(ratios))) {
    assert.equal(validateGenerationSize(size), true);
  }

  for (const size of [
    '0x1024',
    '1025x1024',
    '1000x1000',
    '3841x1024',
    '2880x2881',
    '2048x4096',
    '4096x4096',
    '4096x7280',
    '2048x2730',
    'not-a-size',
  ]) {
    assert.throws(() => validateGenerationSize(size));
  }
});

test('defaults an unavailable ratio to the legal square ratio', () => {
  assert.deepEqual(buildModelRoute({ resolution: '1K', ratio: '9:16' }), {
    model: 'gpt-image-2',
    size: '1024x1024',
    async: true,
    mode: 'edit',
  });
});

test('defaults inherited ratio keys to the legal square ratio', () => {
  assert.deepEqual(buildModelRoute({ resolution: '2K', ratio: 'toString' }), {
    model: 'gpt-image-2',
    size: '2048x2048',
    async: true,
    mode: 'edit',
  });
});
