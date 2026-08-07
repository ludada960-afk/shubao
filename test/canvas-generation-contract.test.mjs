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

test('Canvas text generation is signed and sends ordered owned images to the vision model', async () => {
  const source = await readFile(new URL('../server/index.mjs', import.meta.url), 'utf8');
  const route = extractCanvasRoute(source, '/api/canvas/regenerate-text', '// 画布图文分层');

  assert.match(route, /authenticateEcommerceRequest/);
  assert.match(route, /reference_images:\s*referenceImages/);
  assert.match(route, /count\s*=\s*1/);
  assert.match(route, /生成\s*\$\{outputCount\}\s*个版本/);
  assert.match(route, /imageInputReader\.read\(imageUrl\)/);
  assert.match(route, /createEcommerceVlmClient\(\)\.completeText\(/);
  assert.match(route, /images:\s*visualInputs/);
  assert.doesNotMatch(route, /contentAnalysis\([^)]*@图片/);
});

test('Canvas generated node geometry uses the shared ratio parser for every supported ratio', async () => {
  const source = await readFile(new URL('../src/pages/EcCanvas/index.jsx', import.meta.url), 'utf8');

  assert.match(source, /ratioValue\(ratio/);
  assert.doesNotMatch(source, /ratio === '3:4' \? 3 \/ 4/);
});

test('Canvas pixel transforms honor requested grid size and split direction', async () => {
  const source = await readFile(new URL('../server/index.mjs', import.meta.url), 'utf8');
  const route = extractCanvasRoute(source, '/api/canvas/transform', '// 画布图文分层');
  assert.match(route, /grid\s*=\s*2/);
  assert.match(route, /direction\s*=\s*['"]vertical['"]/);
  assert.match(route, /pixelActions\s*=\s*new Set\(\[['"]crop['"],\s*['"]grid-split['"],\s*['"]split-image['"],\s*['"]annotation['"]\]\)/);
  assert.match(route, /gridRectsFromGuides\(width, height, gridSize, gridSize, gridVertical, gridHorizontal\)/);
  assert.match(route, /gridRects\(width, height, direction === ['"]vertical['"] \? 2 : 1, direction === ['"]horizontal['"] \? 2 : 1\)/);
  assert.match(route, /crop_rect:\s*cropRect/);
  assert.match(route, /split_position:\s*splitPosition/);
  assert.match(route, /annotations\s*=\s*\[\]/);
});

test('Canvas browser segmentation plan is signed and final layer analysis is billed', async () => {
  const source = await readFile(new URL('../server/index.mjs', import.meta.url), 'utf8');
  const planRoute = extractCanvasRoute(source, '/api/canvas/segmentation-plan', '// 画布图文分层');
  const route = extractCanvasRoute(source, '/api/canvas/analyze-layers', '// 画布像素分层');

  assert.doesNotMatch(source, /createFalSegmentationClient\(/);
  assert.match(source, /createCanvasSegmentationPlanTokenService\(\{/);
  assert.match(source, /createCanvasLayeringService\(\{/);
  assert.match(planRoute, /canvasLayeringService\.createSegmentationPlan\(\{/);
  assert.match(planRoute, /canvasSegmentationPlanTokens\.issue\(\{/);
  assert.match(route, /canvasOneShotBilling\.execute\(\{/);
  assert.match(route, /sku:\s*['"]ec_smart_layer['"]/);
  assert.match(route, /canvasSegmentationPlanTokens\.verify\(\{/);
  assert.match(route, /decodeBrowserSegmentationMasks\(/);
  assert.match(route, /canvasLayeringService\.createLayers\(\{/);
  assert.doesNotMatch(route, /segmentUniformBackground|parseVisionLayers|analyzeSceneCapabilities/);
});

test('Canvas background removal prefers real product segmentation before legacy fallbacks', async () => {
  const source = await readFile(new URL('../server/index.mjs', import.meta.url), 'utf8');
  const route = extractCanvasRoute(source, '/api/remove-bg', '// 详情切片');

  assert.match(route, /canvasLayeringService\.removeBackground\(\{/);
  assert.match(route, /canvasSegmentationPlanTokens\.verify\(\{/);
  assert.match(route, /decodeBrowserSegmentationMasks\(/);
  assert.match(route, /sku:\s*['"]ec_remove_bg['"]/);
  assert.match(route, /REMOVE_BG_KEY/);
  assert.match(route, /removeLightBackground/);
});

test('Canvas OCR uses the formal ecommerce vision gateway instead of the legacy LLM-only path', async () => {
  const source = await readFile(new URL('../server/index.mjs', import.meta.url), 'utf8');
  const route = extractCanvasRoute(source, '/api/canvas/ocr', '// 文字替换产出新的图片版本');

  assert.match(route, /app\.post\('\/api\/canvas\/ocr',\s*authenticateEcommerceRequest/);
  assert.match(route, /createEcommerceVlmClient\(\)\.analyzeJson\(/);
  assert.doesNotMatch(route, /callLLMWithVision\(/);
  assert.match(route, /parseVisionTextBlocks\(JSON\.stringify\(visionResult\)\)/);
  assert.match(route, /status:\s*['"]已识别['"]/);
});

test('Canvas image text replacement is owner-authenticated before reading source pixels', async () => {
  const source = await readFile(new URL('../server/index.mjs', import.meta.url), 'utf8');
  const route = extractCanvasRoute(source, '/api/canvas/replace-text', '// 画布像素分层');

  assert.match(route, /app\.post\('\/api\/canvas\/replace-text',\s*authenticateEcommerceRequest/);
  assert.match(route, /readCanvasImage\(imageUrl\)/);
  assert.match(route, /generatedAssetStore\.persistBuffer/);
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
    resolution: '2K',
    ratio: '9:16',
    size: '1152x2048',
  });
});

test('server Canvas generation imports the shared size resolver without a local size table', async () => {
  const source = await readFile(new URL('../server/index.mjs', import.meta.url), 'utf8');

  assert.match(source, /import\s*\{\s*resolveGenerationSize\s*\}\s*from\s*['"]\.\/ecommerceEngine\/modelCatalog\.mjs['"]/);
  assert.doesNotMatch(source, /function\s+canvasSizeForRatio|const\s+sizes\s*=\s*\{\s*['"]1K['"]/);
});
