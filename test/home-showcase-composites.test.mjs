import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import sharp from 'sharp';

import {
  HOME_SHOWCASE_COMPOSITES,
  SOCIAL_SHOWCASE_ADAPTATIONS,
  buildHomeShowcaseComposites,
  buildSocialShowcaseAdaptations,
} from '../scripts/build-home-showcase-composites.mjs';

test('try-on showcase composites preserve complete production assets in fixed wide formats', async () => {
  const outputRoot = await mkdtemp(join(tmpdir(), 'shubao-showcase-'));
  try {
    const outputs = await buildHomeShowcaseComposites({ outputRoot, writeThumbs: false });
    assert.deepEqual(outputs.map(output => output.id), HOME_SHOWCASE_COMPOSITES.map(output => output.id));
    for (const output of outputs) {
      const metadata = await sharp(output.path).metadata();
      assert.equal(`${metadata.width}:${metadata.height}`, output.pixelRatio);
      assert.ok(metadata.width >= 1200);
      assert.ok(output.sources.length >= 2);
    }
    assert.deepEqual(
      outputs.filter(output => output.kind === 'selector').map(output => output.ratio),
      ['4:3', '4:3', '4:3'],
    );
    assert.equal(outputs.find(output => output.kind === 'workflow').ratio, '16:9');
  } finally {
    await rm(outputRoot, { recursive: true, force: true });
  }
});

test('social showcase adaptations preserve the complete production cover in a symmetric frame', async () => {
  const outputRoot = await mkdtemp(join(tmpdir(), 'shubao-social-showcase-'));
  try {
    const outputs = await buildSocialShowcaseAdaptations({ outputRoot, writeThumbs: false });
    assert.deepEqual(outputs.map(output => output.id), SOCIAL_SHOWCASE_ADAPTATIONS.map(output => output.id));
    const output = outputs[0];
    const metadata = await sharp(output.path).metadata();
    assert.equal(`${metadata.width}:${metadata.height}`, '1200:1600');
    assert.equal(output.ratio, '3:4');
    assert.equal(output.provenance, 'production-composite');
  } finally {
    await rm(outputRoot, { recursive: true, force: true });
  }
});
