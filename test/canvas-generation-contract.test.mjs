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

test('Canvas pixel transforms honor requested grid size and split direction', async () => {
  const source = await readFile(new URL('../server/index.mjs', import.meta.url), 'utf8');
  const route = extractCanvasRoute(source, '/api/canvas/transform', '// 画布图文分层');
  assert.match(route, /grid\s*=\s*2/);
  assert.match(route, /direction\s*=\s*['"]vertical['"]/);
  assert.match(route, /pixelActions\s*=\s*new Set\(\[['"]crop['"],\s*['"]grid-split['"],\s*['"]split-image['"],\s*['"]annotation['"]\]\)/);
  assert.match(route, /gridRects\(width, height, gridSize, gridSize\)/);
  assert.match(route, /gridRects\(width, height, direction === ['"]vertical['"] \? 2 : 1, direction === ['"]horizontal['"] \? 2 : 1\)/);
  assert.match(route, /crop_rect:\s*cropRect/);
  assert.match(route, /split_position:\s*splitPosition/);
  assert.match(route, /annotations\s*=\s*\[\]/);
});

test('Canvas layer analysis only advertises movable pixel layers after reliable segmentation', async () => {
  const source = await readFile(new URL('../server/index.mjs', import.meta.url), 'utf8');
  const route = extractCanvasRoute(source, '/api/canvas/analyze-layers', '// 画布像素分层');

  assert.match(route, /createEcommerceVlmClient\(\)\.analyzeJson\(/);
  assert.doesNotMatch(route, /callLLMWithVision\(/);
  assert.match(route, /analyzeSceneCapabilities\(\{\s*layers\s*\}\)/);
  assert.match(route, /res\.json\(\{\s*layers:[\s\S]*?capabilities/);
  assert.match(route, /const split = await segmentUniformBackground\(buffer\)/);
  assert.match(route, /pixelLayers:\s*split\.segmented/);
  assert.match(route, /movableLayers:\s*split\.segmented/);
  assert.doesNotMatch(route, /psdExport:\s*true/);
});

test('Canvas OCR uses the formal ecommerce vision gateway instead of the legacy LLM-only path', async () => {
  const source = await readFile(new URL('../server/index.mjs', import.meta.url), 'utf8');
  const route = extractCanvasRoute(source, '/api/canvas/ocr', '// 文字替换产出新的图片版本');

  assert.match(route, /createEcommerceVlmClient\(\)\.analyzeJson\(/);
  assert.doesNotMatch(route, /callLLMWithVision\(/);
  assert.match(route, /parseVisionTextBlocks\(JSON\.stringify\(visionResult\)\)/);
  assert.match(route, /status:\s*['"]已识别['"]/);
});

test('Canvas reverse prompt uses the formal ecommerce vision gateway with an editable fallback', async () => {
  const source = await readFile(new URL('../server/index.mjs', import.meta.url), 'utf8');
  const route = extractCanvasRoute(source, '/api/reverse-prompt', '// 去除背景（调用 remove.bg 或本地 rembg）');

  assert.match(route, /createEcommerceVlmClient\(\)\.completeText\(/);
  assert.doesNotMatch(route, /callLLMWithVision\(/);
  assert.match(route, /fallback\s*=\s*true/);
  assert.match(route, /clean product photography/);
});

test('Canvas pixel layering and PSD export are signed composition routes', async () => {
  const source = await readFile(new URL('../server/index.mjs', import.meta.url), 'utf8');
  const pixelRoute = extractCanvasRoute(source, '/api/canvas/pixel-layers', '// 画布 PSD 导出');
  const psdRoute = extractCanvasRoute(source, '/api/canvas/psd-export', '// ── 邮箱验证码');

  assert.match(pixelRoute, /authenticateEcommerceRequest/);
  assert.match(pixelRoute, /createPixelLayers\(\{[\s\S]*?generatedAssetStore/);
  assert.match(pixelRoute, /compositionStore\.saveRevision/);
  assert.match(psdRoute, /authenticateEcommerceRequest/);
  assert.match(psdRoute, /exportPsd\(\{[\s\S]*?generatedAssetStore/);
  assert.match(psdRoute, /validatePsdStructure\(buffer\)/);
  assert.match(psdRoute, /image\/vnd\.adobe\.photoshop/);
});

test('Canvas pixel-layer billing errors preserve an actionable payment response', async () => {
  const source = await readFile(new URL('../server/index.mjs', import.meta.url), 'utf8');
  const start = source.indexOf('function sendCompositionError');
  const end = source.indexOf("app.post('/api/compositions'", start);
  const handler = source.slice(start, end);
  assert.match(handler, /error\?\.status\s*===\s*402/);
  assert.match(handler, /required:\s*error\.required/);
  assert.match(handler, /available:\s*error\.available/);
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
