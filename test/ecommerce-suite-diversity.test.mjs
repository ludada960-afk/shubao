import assert from 'node:assert/strict';
import test from 'node:test';
import sharp from 'sharp';

import {
  evaluateSuiteDiversity,
  measureSuiteImage,
  suiteSemanticKey,
  visualFingerprintDistance,
} from '../server/ecommerceEngine/suiteDiversity.mjs';

const SEMANTIC_SINGLE_PRODUCT = Object.freeze({
  verdict: 'single_product',
  confidence: 0.98,
  evidence: ['one coherent product view with one continuous scene'],
});

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

async function multiPanelAppliance() {
  const panels = ['#d8dde2', '#aeb7c0', '#e6eaed', '#b9c1c9'].map(async (color, index) => ({
    input: await sharp({
      create: { width: 54, height: 224, channels: 3, background: color },
    }).png().toBuffer(),
    left: 52 + (index * 54),
    top: 48,
  }));
  return sharp({
    create: { width: 320, height: 320, channels: 3, background: '#f5f5f3' },
  }).composite(await Promise.all(panels)).png().toBuffer();
}

async function horizontalContactStrip() {
  const cells = ['#20252a', '#d7dce0', '#5c6670'].map(async (color, index) => ({
    input: await sharp({
      create: { width: 96, height: 160, channels: 3, background: color },
    }).png().toBuffer(),
    left: index * 108,
    top: 0,
  }));
  return sharp({
    create: { width: 312, height: 160, channels: 3, background: '#ffffff' },
  }).composite(await Promise.all(cells)).png().toBuffer();
}

async function irregularTPanelMontage() {
  const panel = color => sharp({
    create: { width: 160, height: 160, channels: 3, background: color },
  }).png().toBuffer();
  return sharp({
    create: { width: 320, height: 320, channels: 3, background: '#d8dde2' },
  }).composite([
    { input: await panel('#22282e'), left: 0, top: 0 },
    { input: await panel('#e1e5e8'), left: 160, top: 0 },
    {
      input: await sharp({
        create: { width: 320, height: 160, channels: 3, background: '#727d87' },
      }).png().toBuffer(),
      left: 0,
      top: 160,
    },
  ]).png().toBuffer();
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
    semanticLayout: SEMANTIC_SINGLE_PRODUCT,
  })).passed, false);
  assert.equal((await evaluateSuiteDiversity({
    candidate: { assetId: 'main-3', role: 'main_text', buffer: different },
    existing: [{ assetId: 'main-1', role: 'main_text', buffer: original }],
    semanticLayout: SEMANTIC_SINGLE_PRODUCT,
  })).passed, true);
});

test('loads prior suite bytes lazily and accepts a cached measurement', async () => {
  const original = await scene({ accent: '#222222' });
  const nearDuplicate = await scene({ accent: '#252525' });
  const cached = await measureSuiteImage(original);
  let lazyReads = 0;

  const cachedVerdict = await evaluateSuiteDiversity({
    candidate: { assetId: 'main-cached', role: 'main_text', buffer: nearDuplicate },
    existing: [{ assetId: 'main-original', role: 'main_text', measurement: cached }],
    semanticLayout: SEMANTIC_SINGLE_PRODUCT,
  });
  const lazyVerdict = await evaluateSuiteDiversity({
    candidate: { assetId: 'main-lazy', role: 'main_text', buffer: nearDuplicate },
    existing: [{
      assetId: 'main-original',
      role: 'main_text',
      loadBuffer: async () => {
        lazyReads += 1;
        return original;
      },
    }],
    semanticLayout: SEMANTIC_SINGLE_PRODUCT,
  });

  assert.equal(cachedVerdict.passed, false);
  assert.equal(lazyVerdict.passed, false);
  assert.equal(lazyReads, 1);
});

test('permits a borderline-similar main image when its planned role and aspect ratio differ', async () => {
  const original = await scene({ accent: '#222222' });
  const nearDuplicate = await scene({ accent: '#464646' });
  const verdict = await evaluateSuiteDiversity({
    candidate: {
      assetId: 'main-square',
      role: 'main_text',
      buffer: nearDuplicate,
      assetPlanItem: { ratio: '1:1' },
    },
    existing: [{
      assetId: 'main-portrait',
      role: 'main_3x4',
      buffer: original,
      assetPlanItem: { ratio: '3:4' },
    }],
    semanticLayout: SEMANTIC_SINGLE_PRODUCT,
  });

  assert.equal(verdict.passed, true);
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

test('product-confined vertical panel seams are not collage evidence', async () => {
  const appliance = await multiPanelAppliance();
  const measured = await measureSuiteImage(appliance);
  const verdict = await evaluateSuiteDiversity({
    candidate: { assetId: 'appliance-hero', role: 'main_text', buffer: appliance },
    existing: [],
    semanticLayout: SEMANTIC_SINGLE_PRODUCT,
  });

  assert.ok(measured.verticalSeams >= 2);
  assert.equal(measured.likelyCollage, false);
  assert.equal(verdict.passed, true);
});

test('semantic layout rejects an irregular borderless T-shaped montage missed by seams', async () => {
  const montage = await irregularTPanelMontage();
  const measured = await measureSuiteImage(montage);
  const verdict = await evaluateSuiteDiversity({
    candidate: { assetId: 'irregular-montage', role: 'detail_slice_usage', buffer: montage },
    existing: [],
    semanticLayout: {
      verdict: 'collage',
      confidence: 0.97,
      evidence: ['three independent candidate scenes arranged as a T-shaped montage'],
    },
  });

  assert.equal(measured.likelyCollage, false);
  assert.equal(verdict.passed, false);
  assert.deepEqual(verdict.issueCodes, ['suite_collage_layout']);
  assert.equal(verdict.details.semanticLayout.verdict, 'collage');
});

test('semantic layout explicitly allows a confirmed single-view multi-panel product', async () => {
  const verdict = await evaluateSuiteDiversity({
    candidate: { assetId: 'multi-panel-product', role: 'main_text', buffer: await multiPanelAppliance() },
    existing: [],
    semanticLayout: SEMANTIC_SINGLE_PRODUCT,
  });

  assert.equal(verdict.passed, true);
  assert.equal(verdict.details.semanticLayout.verdict, 'single_product');
});

test('inconclusive deterministic layout fails closed without a valid semantic verdict', async () => {
  const buffer = await scene({ accent: '#333333' });
  for (const semanticLayout of [undefined, { verdict: 'uncertain', confidence: 0.4, evidence: [] }]) {
    const verdict = await evaluateSuiteDiversity({
      candidate: { assetId: 'semantic-unavailable', role: 'main_text', buffer },
      existing: [],
      semanticLayout,
    });

    assert.equal(verdict.passed, false);
    assert.deepEqual(verdict.issueCodes, ['suite_collage_semantic_unavailable']);
  }
});

test('semantic layout confidence rejects numeric strings instead of coercing them', async () => {
  const verdict = await evaluateSuiteDiversity({
    candidate: {
      assetId: 'string-confidence',
      role: 'main_text',
      buffer: await scene({ accent: '#333333' }),
    },
    existing: [],
    semanticLayout: {
      verdict: 'single_product',
      confidence: '0.98',
      evidence: ['one coherent product view'],
    },
  });

  assert.equal(verdict.passed, false);
  assert.deepEqual(verdict.issueCodes, ['suite_collage_semantic_unavailable']);
});

test('full-height gutters still reject an obvious one-axis contact strip', async () => {
  const contactStrip = await horizontalContactStrip();
  const measured = await measureSuiteImage(contactStrip);
  const verdict = await evaluateSuiteDiversity({
    candidate: { assetId: 'contact-strip', role: 'detail_slice_usage', buffer: contactStrip },
    existing: [],
  });

  assert.equal(measured.likelyCollage, true);
  assert.equal(verdict.passed, false);
  assert.deepEqual(verdict.issueCodes, ['suite_collage_layout']);
});

test('suite check rejects matching commercial and shot semantics before pixel comparison', async () => {
  const buffer = await scene({ accent: '#222222' });
  const assetPlanItem = {
    communicationGoal: 'Product recognition',
    shotIntent: {
      type: 'identity',
      camera: { azimuth: 12 },
      crop: 'complete product crop',
      interactionState: 'stationary',
      sceneFamily: 'studio_identity',
    },
  };
  const verdict = await evaluateSuiteDiversity({
    candidate: { assetId: 'hero-2', role: 'main_text', buffer, assetPlanItem },
    existing: [{ assetId: 'hero-1', role: 'main_text', buffer, assetPlanItem }],
  });

  assert.ok(suiteSemanticKey(assetPlanItem));
  assert.equal(verdict.passed, false);
  assert.deepEqual(verdict.issueCodes, ['suite_semantic_duplicate']);
  assert.equal(verdict.details.duplicateOf, 'hero-1');
});
