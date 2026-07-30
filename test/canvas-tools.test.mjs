import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeSceneCapabilities, buildCanvasTransformPrompt, cropRectForRatio, gridRects, parseVisionLayers } from '../server/canvasTools.mjs';

test('builds action-specific canvas prompts without losing product identity rules', () => {
  const prompt = buildCanvasTransformPrompt({ action: 'translate', targetLanguage: '英文', prompt: '保留原有价格层级' });
  assert.match(prompt, /英文/);
  assert.match(prompt, /商品主体/);
  assert.match(prompt, /价格层级/);
});

test('calculates centered crop rectangles for supported ratios', () => {
  assert.deepEqual(cropRectForRatio(1600, 1200, '1:1'), { left: 200, top: 0, width: 1200, height: 1200 });
  assert.deepEqual(cropRectForRatio(1200, 1600, '3:4'), { left: 0, top: 0, width: 1200, height: 1600 });
});

test('returns non-overlapping four grid rectangles', () => {
  const rects = gridRects(1001, 1000);
  assert.equal(rects.length, 4);
  assert.equal(rects.reduce((sum, rect) => sum + rect.width * rect.height, 0), 1001 * 1000);
  assert.deepEqual(rects[3], { left: 500, top: 500, width: 501, height: 500 });
});

test('parses valid vision layer JSON and rejects invented wrapper text', () => {
  const layers = parseVisionLayers('分析完成：{"layers":[{"name":"商品主体","description":"瓶身"},{"name":"背景","description":"白底"}]}');
  assert.deepEqual(layers, [
    { name: '商品主体', description: '瓶身' },
    { name: '背景', description: '白底' },
  ]);
  assert.deepEqual(parseVisionLayers('不是 JSON'), []);
});

test('semantic layer analysis reports no pixel or PSD capability', () => {
  assert.deepEqual(analyzeSceneCapabilities({ layers: [{ name: '商品主体' }] }), {
    semanticAnalysis: true,
    pixelLayers: false,
    psdExport: false,
  });
});
