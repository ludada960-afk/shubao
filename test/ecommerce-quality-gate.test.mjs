import assert from 'node:assert/strict';
import test from 'node:test';
import sharp from 'sharp';

import {
  evaluateAsset,
} from '../server/ecommerceEngine/qualityGate.mjs';
import {
  canRetry,
  planRepair,
} from '../server/ecommerceEngine/repairPlanner.mjs';
import {
  checkQuality,
} from '../server/ecommerceEngine/qualityCheck.mjs';
import * as ecommerceEngine from '../server/ecommerceEngine/index.mjs';

async function productFixture({
  width = 128,
  height = 128,
  background = '#ffffff',
  product = '#e34b38',
  format = 'png',
  productWidthRatio = 0.4,
  productHeightRatio = 0.6,
} = {}) {
  const productWidth = Math.round(width * productWidthRatio);
  const productHeight = Math.round(height * productHeightRatio);
  const productX = Math.round((width - productWidth) / 2);
  const productY = Math.round((height - productHeight) / 2);
  const image = sharp({
    create: {
      width,
      height,
      channels: 3,
      background,
    },
  }).composite([{
    input: Buffer.from(`
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <rect x="${productX}" y="${productY}"
          width="${productWidth}" height="${productHeight}"
          rx="8" fill="${product}"/>
        <rect x="${Math.round(productX + productWidth * 0.22)}" y="${Math.round(productY + productHeight * 0.13)}"
          width="${Math.round(productWidth * 0.56)}" height="${Math.max(4, Math.round(productHeight * 0.13))}"
          fill="#ffffff"/>
      </svg>
    `),
  }]);
  return format === 'jpeg' ? image.jpeg({ quality: 92 }).toBuffer() : image.png().toBuffer();
}

async function checkerFixture({ blurred = false } = {}) {
  const width = 128;
  const height = 128;
  const channels = 3;
  const pixels = Buffer.alloc(width * height * channels);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const value = (Math.floor(x / 8) + Math.floor(y / 8)) % 2 ? 245 : 20;
      const offset = (y * width + x) * channels;
      pixels[offset] = value;
      pixels[offset + 1] = value;
      pixels[offset + 2] = value;
    }
  }
  const image = sharp(pixels, { raw: { width, height, channels } });
  return (blurred ? image.blur(9) : image).png().toBuffer();
}

async function transparentProductFixture() {
  return sharp({
    create: {
      width: 128,
      height: 128,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  }).composite([{
    input: Buffer.from(`
      <svg width="128" height="128" xmlns="http://www.w3.org/2000/svg">
        <rect x="36" y="24" width="56" height="80" rx="10" fill="#e34b38"/>
        <rect x="48" y="38" width="32" height="12" rx="3" fill="#ffffff"/>
      </svg>
    `),
  }]).png().toBuffer();
}

test('passes a valid stable product image while reporting optional adapters unavailable', async () => {
  const result = await evaluateAsset({
    buffer: await productFixture(),
    role: 'main',
    generationSize: '128x128',
    expectedFormat: 'png',
  });

  assert.equal(result.passed, true);
  assert.equal(result.checks.technical.status, 'pass');
  assert.equal(result.checks.visualQuality.status, 'unavailable');
  assert.equal(result.checks.visualQuality.details.deterministicStatus, 'pass');
  assert.equal(result.checks.productFidelity.status, 'unavailable');
  assert.equal(result.checks.copyAndLogo.status, 'skipped');
  assert.equal(result.repairAction.type, 'none');
  assert.equal(result.confidence, 'medium');
});

test('rejects exact dimension or format mismatches with deterministic repair instructions', async () => {
  const result = await evaluateAsset({
    buffer: await productFixture({ width: 128, height: 96, format: 'jpeg' }),
    role: 'main',
    generationSize: '128x128',
    expectedFormat: 'png',
  });

  assert.equal(result.passed, false);
  assert.equal(result.checks.technical.status, 'fail');
  assert.deepEqual(result.checks.technical.issueCodes.sort(), [
    'dimension_mismatch',
    'format_mismatch',
  ]);
  assert.equal(result.repairAction.type, 'sharp_repair');
  assert.deepEqual(result.repairAction.operations, ['resize', 'convert_format']);
});

test('requires high near-white background coverage for white-background roles', async () => {
  const result = await evaluateAsset({
    buffer: await productFixture({ background: '#b7c4d6' }),
    role: 'white_background',
    generationSize: '128x128',
    expectedFormat: 'png',
  });

  assert.equal(result.passed, false);
  assert.equal(result.checks.platformCompliance.status, 'fail');
  assert.ok(result.checks.platformCompliance.metrics.nearWhiteCoverage < 0.7);
  assert.ok(result.checks.platformCompliance.issueCodes.includes('white_background_insufficient'));
  assert.equal(result.repairAction.type, 'sharp_repair');
  assert.ok(result.repairAction.operations.includes('normalize_white_background'));
});

test('accepts a large centered product when the surrounding white background and edges are clean', async () => {
  const result = await evaluateAsset({
    buffer: await productFixture({
      productWidthRatio: 0.78,
      productHeightRatio: 0.82,
    }),
    role: 'white_background',
    generationSize: '128x128',
    expectedFormat: 'png',
  });

  assert.equal(result.checks.platformCompliance.status, 'pass');
  assert.ok(result.checks.platformCompliance.metrics.nearWhiteCoverage > 0.25);
  assert.ok(result.checks.platformCompliance.metrics.nearWhiteCoverage < 0.7);
});

test('rejects an opaque PNG for a transparent role and plans deterministic alpha normalization', async () => {
  const result = await evaluateAsset({
    buffer: await productFixture(),
    role: 'transparent',
    generationSize: '128x128',
    expectedFormat: 'png',
  });

  assert.equal(result.passed, false);
  assert.equal(result.checks.platformCompliance.status, 'fail');
  assert.ok(result.checks.platformCompliance.issueCodes.includes('transparent_background_missing'));
  assert.equal(result.checks.platformCompliance.metrics.transparentCoverage, 0);
  assert.equal(result.repairAction.type, 'sharp_repair');
  assert.ok(result.repairAction.operations.includes('normalize_transparent_background'));
});

test('accepts a PNG with meaningful transparent background and enough opaque product pixels', async () => {
  const result = await evaluateAsset({
    buffer: await transparentProductFixture(),
    role: 'transparent',
    generationSize: '128x128',
    expectedFormat: 'png',
  });

  assert.equal(result.checks.technical.status, 'pass');
  assert.equal(result.checks.platformCompliance.status, 'pass');
  assert.ok(result.checks.platformCompliance.metrics.transparentCoverage > 0.4);
  assert.ok(result.checks.platformCompliance.metrics.opaqueCoverage > 0.1);
  assert.ok(result.checks.platformCompliance.metrics.edgeTransparentCoverage > 0.9);
});

test('rejects blank or near-uniform generated output deterministically', async () => {
  const blank = await sharp({
    create: {
      width: 128,
      height: 128,
      channels: 3,
      background: '#f4f4f4',
    },
  }).png().toBuffer();
  const result = await evaluateAsset({
    buffer: blank,
    role: 'main',
    generationSize: '128x128',
    expectedFormat: 'png',
  });

  assert.equal(result.passed, false);
  assert.equal(result.checks.visualQuality.status, 'fail');
  assert.ok(result.checks.visualQuality.issueCodes.includes('blank_or_uniform'));
  assert.equal(result.repairAction.type, 'regenerate_from_product_truth');
});

test('uses a deterministic edge metric to reject blurred output', async () => {
  const sharpResult = await evaluateAsset({
    buffer: await checkerFixture(),
    role: 'detail',
    generationSize: '128x128',
    expectedFormat: 'png',
  }, {
    visualQuality: async () => ({ passed: true, confidence: 0.9 }),
  });
  const blurredResult = await evaluateAsset({
    buffer: await checkerFixture({ blurred: true }),
    role: 'detail',
    generationSize: '128x128',
    expectedFormat: 'png',
  }, {
    visualQuality: async () => ({ passed: true, confidence: 0.9 }),
  });

  assert.equal(sharpResult.checks.visualQuality.status, 'pass');
  assert.equal(blurredResult.passed, false);
  assert.equal(blurredResult.checks.visualQuality.status, 'fail');
  assert.ok(blurredResult.checks.visualQuality.issueCodes.includes('too_blurry'));
  assert.ok(
    blurredResult.checks.visualQuality.metrics.edgeStrength
      < sharpResult.checks.visualQuality.metrics.edgeStrength,
  );
  assert.equal(blurredResult.repairAction.type, 'image_edit');
});

test('rejects provider output that violates legal generation dimensions', async () => {
  const result = await evaluateAsset({
    buffer: await productFixture({ width: 130, height: 128 }),
    role: 'main',
    generationSize: '130x128',
    expectedFormat: 'png',
  });

  assert.equal(result.passed, false);
  assert.ok(result.checks.technical.issueCodes.includes('illegal_generation_dimensions'));
  assert.equal(result.repairAction.type, 'sharp_repair');
  assert.ok(result.repairAction.operations.includes('resize'));
});

test('uses an injected visual adapter for semantic local defects', async () => {
  const result = await evaluateAsset({
    buffer: await productFixture(),
    role: 'detail',
    generationSize: '128x128',
    expectedFormat: 'png',
  }, {
    visualQuality: async () => ({
      passed: false,
      confidence: 0.92,
      issueCodes: ['local_artifact'],
      details: { region: 'lower-right' },
    }),
  });

  assert.equal(result.passed, false);
  assert.equal(result.checks.visualQuality.status, 'fail');
  assert.equal(result.checks.visualQuality.details.region, 'lower-right');
  assert.equal(result.repairAction.type, 'image_edit');
  assert.deepEqual(result.repairAction.focusIssueCodes, ['local_artifact']);
});

test('uses injected OCR and product-fidelity adapters without trusting inherited fields', async () => {
  const inheritedPass = Object.create({ passed: true, confidence: 1 });
  const result = await evaluateAsset({
    buffer: await productFixture(),
    role: 'main_text',
    generationSize: '128x128',
    expectedFormat: 'png',
    productTruth: {
      fingerprint: 'truth-one',
      confirmedFacts: { model: { value: 'S-100' } },
    },
    requiredText: ['S-100'],
  }, {
    productFidelity: async () => ({
      passed: false,
      confidence: 0.98,
      issueCodes: ['product_identity_mismatch'],
      observedFingerprint: 'different-product',
    }),
    ocr: async () => inheritedPass,
  });

  assert.equal(result.passed, false);
  assert.equal(result.checks.productFidelity.status, 'fail');
  assert.equal(result.checks.copyAndLogo.status, 'unavailable');
  assert.ok(result.checks.copyAndLogo.issueCodes.includes('invalid_adapter_result'));
  assert.equal(result.repairAction.type, 'regenerate_from_product_truth');
});

test('normalizes adapter failures without issue codes into actionable repairs', async () => {
  const result = await evaluateAsset({
    buffer: await productFixture(),
    role: 'main',
    generationSize: '128x128',
    expectedFormat: 'png',
  }, {
    productFidelity: async () => ({ passed: false, confidence: 0.8 }),
    visualQuality: async () => ({ passed: true, confidence: 0.9 }),
  });

  assert.equal(result.passed, false);
  assert.deepEqual(result.checks.productFidelity.issueCodes, ['product_fidelity_failed']);
  assert.equal(result.repairAction.type, 'regenerate_from_product_truth');
});

test('maps text defects and local visual defects to focused repair plans', () => {
  const textRepair = planRepair({
    checks: {
      technical: { issueCodes: [] },
      platformCompliance: { issueCodes: [] },
      productFidelity: { issueCodes: [] },
      copyAndLogo: { issueCodes: ['required_text_missing', 'logo_mutated'] },
      visualQuality: { issueCodes: [] },
    },
  });
  const visualRepair = planRepair({
    checks: {
      technical: { issueCodes: [] },
      platformCompliance: { issueCodes: [] },
      productFidelity: { issueCodes: [] },
      copyAndLogo: { issueCodes: [] },
      visualQuality: { issueCodes: ['local_artifact'] },
    },
  });

  assert.equal(textRepair.type, 'cleanup_and_overlay');
  assert.deepEqual(textRepair.operations, ['remove_generated_text', 'apply_deterministic_overlay']);
  assert.equal(visualRepair.type, 'image_edit');
  assert.deepEqual(visualRepair.focusIssueCodes, ['local_artifact']);
});

test('allows only two zero-based deterministic Sharp repair attempts', () => {
  assert.equal(canRetry(0, { type: 'sharp_repair' }), true);
  assert.equal(canRetry(1, { type: 'sharp_repair' }), true);
  for (const attempt of [2, 3, -1, 1.5, '1', null, undefined]) {
    assert.equal(canRetry(attempt, { type: 'sharp_repair' }), false);
  }
});

test('limits provider-backed quality repair to one automatic resubmission', () => {
  assert.equal(canRetry(0, { type: 'image_edit' }), true);
  assert.equal(canRetry(1, { type: 'image_edit' }), false);
  assert.equal(canRetry(0, { type: 'regenerate_from_product_truth' }), true);
  assert.equal(canRetry(1, { type: 'regenerate_from_product_truth' }), false);
  assert.equal(canRetry(1, { type: 'sharp_repair' }), true);
  assert.equal(canRetry(2, { type: 'sharp_repair' }), false);
});

test('compatibility quality checks fail honestly without stable image bytes', async () => {
  const result = await checkQuality({
    imageUrl: '/api/generated-assets/example.png',
    roleKey: 'main',
    retryCount: 0,
  });

  assert.equal(result.passed, false);
  assert.equal(result.verdict.checks.technical.status, 'fail');
  assert.ok(result.verdict.checks.technical.issueCodes.includes('missing_image_buffer'));
  assert.equal(result.shouldRetry, true);
  assert.equal(result.retryCount, 0);
});

test('exposes the real quality gate through the ecommerce engine entry point', () => {
  assert.equal(ecommerceEngine.evaluateAsset, evaluateAsset);
  assert.equal(ecommerceEngine.planRepair, planRepair);
  assert.equal(ecommerceEngine.canRetry, canRetry);
});
