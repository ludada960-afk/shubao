import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import * as modelCatalog from '../server/ecommerceEngine/modelCatalog.mjs';

function extractCanvasRoute(source, routePath, nextMarker) {
  const start = source.indexOf(`app.post('${routePath}'`);
  assert.notEqual(start, -1, `${routePath} route must exist`);
  const end = source.indexOf(nextMarker, start);
  assert.notEqual(end, -1, `${routePath} route must have a stable closing marker`);
  return source.slice(start, end);
}

test('server Canvas generation has no Contact Sheet production dependency', async () => {
  const source = await readFile(new URL('../server/index.mjs', import.meta.url), 'utf8');

  assert.doesNotMatch(source, /referenceContactSheet|buildReferenceContactSheet/);
});

test('Canvas regeneration sends individual visual inputs through indexed provider multipart', async () => {
  const source = await readFile(new URL('../server/index.mjs', import.meta.url), 'utf8');
  const route = extractCanvasRoute(source, '/api/canvas/regenerate', 'async function readCanvasImage');

  assert.match(route, /resolvedInputs\.push\(await imageInputReader\.read\(input\)\)/);
  assert.match(route, /ecommerceProviderAdapter\.submitEdit\(/);
  assert.match(route, /inputAssets:\s*resolvedInputs\.map\(/);
  assert.match(route, /ecommerceProviderAdapter\.pollUntilReady\(/);
  assert.doesNotMatch(route, /imageBufferToDataUrl|contact\s*sheet/i);
});

test('shared catalog resolves every Canvas size to an exact legal entry', () => {
  assert.equal(typeof modelCatalog.resolveGenerationSize, 'function');

  for (const resolution of ['1K', '2K', '4K', '8K', undefined]) {
    for (const ratio of ['1:1', '3:4', '4:3', '9:16', '2:3', undefined]) {
      const selected = modelCatalog.resolveGenerationSize({ resolution, ratio });
      assert.equal(
        selected.size,
        modelCatalog.LEGAL_IMAGE_SIZES[selected.resolution][selected.ratio],
        `${resolution || 'default'} ${ratio || 'default'}`,
      );
      assert.equal(modelCatalog.validateGenerationSize(selected.size), true);
    }
  }

  assert.deepEqual(modelCatalog.resolveGenerationSize({ resolution: '1K', ratio: '9:16' }), {
    resolution: '1K',
    ratio: '1:1',
    size: '1024x1024',
  });
});

test('server Canvas generation imports the shared size resolver without a local size table', async () => {
  const source = await readFile(new URL('../server/index.mjs', import.meta.url), 'utf8');

  assert.match(source, /import\s*\{\s*resolveGenerationSize\s*\}\s*from\s*['"]\.\/ecommerceEngine\/modelCatalog\.mjs['"]/);
  assert.doesNotMatch(source, /function\s+canvasSizeForRatio|const\s+sizes\s*=\s*\{\s*['"]1K['"]/);
});
