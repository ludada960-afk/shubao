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

test('server Canvas regeneration is a thin route over the executable durable service', async () => {
  const source = await readFile(new URL('../server/index.mjs', import.meta.url), 'utf8');
  const route = extractCanvasRoute(source, '/api/canvas/regenerate', 'async function readCanvasImage');

  assert.match(source, /createCanvasGenerationStore\(db\)/);
  assert.match(source, /createCanvasGenerationService\(\{[\s\S]*?imageGenerationPool,[\s\S]*?providerAdapter:\s*ecommerceProviderAdapter/);
  assert.match(source, /createCanvasRegenerateHandler\(\{\s*service:\s*canvasGenerationService,\s*billing:\s*canvasOneShotBilling,?\s*\}\)/);
  assert.match(route, /app\.post\('\/api\/canvas\/regenerate',\s*canvasRegenerateHandler\)/);
  assert.doesNotMatch(route, /submitEdit|pollUntilReady|imageInputReader|generatedAssetStore/);
});

test('Canvas AI transforms reuse the durable provider-job service instead of direct image submission', async () => {
  const source = await readFile(new URL('../server/index.mjs', import.meta.url), 'utf8');
  const route = extractCanvasRoute(source, '/api/canvas/transform', '// 画布图文分层');

  assert.match(route, /canvasGenerationService\.regenerate\(\{[\s\S]*?ownerEmail:[\s\S]*?body:/);
  assert.doesNotMatch(route, /callImageAPI\(/);
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
