import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import sharp from 'sharp';

import {
  HOME_SHOWCASE_COMPOSITES,
  buildHomeShowcaseComposites,
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
