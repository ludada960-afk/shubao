import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import sharp from 'sharp';

import {
  HOME_SHOWCASE_COMPOSITES,
  SOCIAL_SHOWCASE_ADAPTATIONS,
  TRYON_LAYOUT_PLANS,
  buildHomeShowcaseComposites,
  buildSocialShowcaseAdaptations,
} from '../scripts/build-home-showcase-composites.mjs';

test('try-on showcase composites preserve complete production assets in fixed wide formats', async () => {
  const outputRoot = await mkdtemp(join(tmpdir(), 'shubao-showcase-'));
  try {
    const outputs = await buildHomeShowcaseComposites({ outputRoot, writeThumbs: false });
    assert.deepEqual(outputs.map(output => output.id), HOME_SHOWCASE_COMPOSITES.map(output => output.id));
    for (const output of outputs) {
      const metadata = await sharp(await readFile(output.path)).metadata();
      assert.equal(`${metadata.width}:${metadata.height}`, output.pixelRatio);
      assert.ok(metadata.width >= 1200);
      assert.ok(output.sources.length >= 2);
    }
    const multiAngle = outputs.find(output => output.kind === 'multi-angle');
    const reference = outputs.find(output => output.kind === 'reference-workflow');
    assert.equal(multiAngle.ratio, '16:9');
  assert.equal(multiAngle.id, 'editorial-multi-angle-v6');
  assert.equal(multiAngle.sources.length, 5);
    assert.deepEqual(multiAngle.sources, [
      'editorial-flatlay-matched-v1.webp',
      'angle-front.png',
      'angle-motion.png',
      'angle-side.png',
      'angle-back.png',
    ]);
    assert.equal(reference.ratio, '16:9');
    assert.equal(reference.sources.length, 3);
  } finally {
    await rm(outputRoot, { recursive: true, force: true });
  }
});

test('try-on layout plans match the product-to-angle reference without cropped content', () => {
  const multiAngle = TRYON_LAYOUT_PLANS['editorial-multi-angle-v6'];
  const rotatedBounds = ({ left, top, width, height, rotation }) => {
    const radians = Math.abs(rotation * Math.PI / 180);
    const rotatedWidth = (width * Math.cos(radians)) + (height * Math.sin(radians));
    const rotatedHeight = (width * Math.sin(radians)) + (height * Math.cos(radians));
    return {
      left: left - ((rotatedWidth - width) / 2),
      top: top - ((rotatedHeight - height) / 2),
      right: left + ((rotatedWidth + width) / 2),
      bottom: top + ((rotatedHeight + height) / 2),
    };
  };
  assert.deepEqual(multiAngle.stages, ['product', 'arrow', 'result-fan']);
  assert.equal(multiAngle.resultCards.length, 4);
  assert.deepEqual(multiAngle.resultCards.map(card => card.rotation), [-8, -3, 3, 8]);
  assert.equal(multiAngle.product.fit, 'contain');
  assert.ok(multiAngle.resultCards.every(card => card.width >= 290));
  assert.ok(multiAngle.resultCards.every(card => card.height >= 680));
  assert.ok(multiAngle.resultCards.at(-1).left + multiAngle.resultCards.at(-1).width <= 1600);
  assert.ok(multiAngle.product.width >= 340);
  assert.ok(multiAngle.product.height >= 480);
  assert.ok(multiAngle.product.left >= 48);
  assert.ok(multiAngle.product.left + multiAngle.product.width <= 600);
  assert.ok(multiAngle.resultCards.every(card => card.fit === 'contain'));
  assert.ok([multiAngle.product, ...multiAngle.resultCards].every((card) => {
    const bounds = rotatedBounds(card);
    return bounds.left >= 0 && bounds.top >= 0 && bounds.right <= 1600 && bounds.bottom <= 900;
  }));
  assert.ok(multiAngle.visualBounds.top >= 24);
  assert.ok(multiAngle.visualBounds.bottom <= 876);
  assert.ok(multiAngle.visualBounds.right - multiAngle.visualBounds.left >= 1504);

  const reference = TRYON_LAYOUT_PLANS['tryon-reference-workflow'];
  assert.deepEqual(reference.stages, ['product', 'reference-model', 'result']);
  assert.equal(reference.fit, 'cover');
  assert.equal(reference.blurPadding, false);
  assert.ok(reference.visualBounds.right - reference.visualBounds.left >= 1504);
});

test('social showcase adaptations preserve the complete production cover in a symmetric frame', async () => {
  const outputRoot = await mkdtemp(join(tmpdir(), 'shubao-social-showcase-'));
  try {
    const outputs = await buildSocialShowcaseAdaptations({ outputRoot, writeThumbs: false });
    assert.deepEqual(outputs.map(output => output.id), SOCIAL_SHOWCASE_ADAPTATIONS.map(output => output.id));
    const output = outputs[0];
    const metadata = await sharp(await readFile(output.path)).metadata();
    assert.equal(`${metadata.width}:${metadata.height}`, '1200:1600');
    assert.equal(output.ratio, '3:4');
    assert.equal(output.provenance, 'production-composite');
  } finally {
    await rm(outputRoot, { recursive: true, force: true });
  }
});
