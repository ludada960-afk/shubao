import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { analyzeSceneCapabilities, buildCanvasTransformPrompt, canvasAnnotationSvg, cropRectForRatio, gridRects, gridRectsFromGuides, normalizeCanvasLayerPlan, parseVisionLayers, parseVisionTextBlocks, resolveGridDimensions } from '../server/canvasTools.mjs';
import { segmentUniformBackground } from '../server/canvasSegmentation.mjs';

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

test('supports configurable grids and directional image splits', () => {
  const nine = gridRects(1001, 1000, 3, 3);
  assert.equal(nine.length, 9);
  assert.equal(nine.reduce((sum, rect) => sum + rect.width * rect.height, 0), 1001 * 1000);
  assert.deepEqual(gridRects(1000, 600, 2, 1), [
    { left: 0, top: 0, width: 500, height: 600 },
    { left: 500, top: 0, width: 500, height: 600 },
  ]);
  assert.deepEqual(gridRects(1000, 600, 1, 2), [
    { left: 0, top: 0, width: 1000, height: 300 },
    { left: 0, top: 300, width: 1000, height: 300 },
  ]);
});

test('builds non-uniform grid rectangles from draggable guide positions', () => {
  const rects = gridRectsFromGuides(1000, 800, 3, 3, [0.2, 0.75], [0.35, 0.6]);
  assert.deepEqual(rects, [
    { left: 0, top: 0, width: 200, height: 280 },
    { left: 200, top: 0, width: 550, height: 280 },
    { left: 750, top: 0, width: 250, height: 280 },
    { left: 0, top: 280, width: 200, height: 200 },
    { left: 200, top: 280, width: 550, height: 200 },
    { left: 750, top: 280, width: 250, height: 200 },
    { left: 0, top: 480, width: 200, height: 320 },
    { left: 200, top: 480, width: 550, height: 320 },
    { left: 750, top: 480, width: 250, height: 320 },
  ]);
  assert.equal(rects.reduce((sum, rect) => sum + rect.width * rect.height, 0), 1000 * 800);
});

test('grid dimensions relax to independent rows and columns bounded by eight', () => {
  assert.deepEqual(resolveGridDimensions({ grid: 3 }), { columns: 3, rows: 3 });
  assert.deepEqual(resolveGridDimensions({ grid: 3, verticalPositions: [], horizontalPositions: [0.2, 0.4, 0.6, 0.8] }), { columns: 1, rows: 5 });
  assert.deepEqual(resolveGridDimensions({ grid: 2, verticalPositions: [0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875], horizontalPositions: [0.5] }), { columns: 8, rows: 2 });
  assert.deepEqual(resolveGridDimensions({ grid: 99, rows: 2, columns: 7 }), { columns: 7, rows: 2 });
  assert.deepEqual(resolveGridDimensions({ grid: 4, columns: 99, rows: null }), { columns: 8, rows: 4 });
  const tall = gridRectsFromGuides(1000, 1000, 1, 3, [], [1 / 3, 2 / 3]);
  assert.equal(tall.length, 3);
  assert.ok(tall.every(rect => rect.width === 1000 && rect.height > 300));
  const wide = gridRectsFromGuides(1600, 900, 8, 1, Array.from({ length: 7 }, (_, index) => (index + 1) / 8), []);
  assert.equal(wide.length, 8);
  assert.equal(wide.reduce((sum, rect) => sum + rect.width * rect.height, 0), 1600 * 900);
});

test('annotation SVG embeds the Chinese font for text shapes and escapes content', () => {
  const svg = canvasAnnotationSvg(1000, 800, [{ tool: 'text', x: 0.1, y: 0.2, text: '限时五折', color: '#ef4444', width: 3 }]);
  assert.match(svg, /@font-face/);
  assert.match(svg, /Noto Sans CJK SC/);
  assert.match(svg, /data:font\/otf;base64,/);
  assert.match(svg, /限时五折/);
  const escaped = canvasAnnotationSvg(1000, 800, [{ tool: 'text', x: 0.1, y: 0.2, text: '<b>&"x', color: '#ef4444', width: 3 }]);
  assert.match(escaped, /&lt;b&gt;&amp;&quot;x/);
  const penOnly = canvasAnnotationSvg(1000, 800, [{ tool: 'pen', x: 0.1, y: 0.1, points: [{ x: 0.1, y: 0.1 }, { x: 0.4, y: 0.6 }] }]);
  assert.doesNotMatch(penOnly, /@font-face/);
  assert.doesNotMatch(penOnly, /<text /);
  assert.throws(() => canvasAnnotationSvg(1000, 800, []), /请先在图片上完成标注/);
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

test('parses OCR blocks with bounded editable coordinates', () => {
  const blocks = parseVisionTextBlocks('结果：{"blocks":[{"id":"headline","text":"新品","x":0.1,"y":0.2,"width":0.4,"height":0.12,"color":"#112233","background":"#ffffff"}]}');
  assert.deepEqual(blocks, [{ id: 'headline', text: '新品', x: 0.1, y: 0.2, width: 0.4, height: 0.12, color: '#112233', background: '#ffffff' }]);
  assert.deepEqual(parseVisionTextBlocks('不是 JSON'), []);
});

test('normalizes a bounded merchant layer plan without promoting scene props to products', () => {
  const plan = normalizeCanvasLayerPlan({
    productGroup: { name: '三色保鲜盒', box: [0.12, 0.18, 0.72, 0.58], confidence: 0.97 },
    instances: [
      { id: 'gray-box', name: '灰色盒', kind: 'product', box: [0.36, 0.2, 0.2, 0.2], confidence: 0.96 },
      { id: 'blue-box', name: '蓝色盒', kind: 'product', box: [0.15, 0.48, 0.28, 0.25], confidence: 0.94 },
      { id: 'orange-box', name: '橙色盒', kind: 'product', box: [0.55, 0.48, 0.28, 0.25], confidence: 0.95 },
      { id: 'plate', name: '餐盘', kind: 'background', box: [0.6, 0.01, 0.35, 0.3], confidence: 0.99 },
      { id: 'outside', name: '无关物体', kind: 'product', box: [0.9, 0.9, 0.08, 0.08], confidence: 0.99 },
      { id: 'weak', name: '不确定商品', kind: 'product', box: [0.2, 0.2, 0.1, 0.1], confidence: 0.2 },
    ],
    textBlocks: [
      { id: 'caption', text: '三色盖子可选择', box: [0.16, 0.83, 0.68, 0.08], confidence: 0.93, color: '#ffffff', background: '#efb64e' },
      { id: 'empty', text: ' ', box: [0, 0, 0.2, 0.1], confidence: 1 },
    ],
  });

  assert.deepEqual(plan.instances.map(item => item.id), ['gray-box', 'blue-box', 'orange-box']);
  assert.deepEqual(plan.textBlocks.map(item => item.text), ['三色盖子可选择']);
  assert.deepEqual(plan.productGroup.box, [0.12, 0.18, 0.72, 0.58]);
});

test('separates a reliable uniform colored background into movable pixel layers', async () => {
  const width = 100;
  const height = 80;
  const pixels = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      const product = x >= 30 && x < 70 && y >= 24 && y < 60;
      pixels[offset] = product ? 24 : 208;
      pixels[offset + 1] = product ? 30 : 229;
      pixels[offset + 2] = product ? 36 : 244;
      pixels[offset + 3] = 255;
    }
  }
  const result = await segmentUniformBackground(await sharp(pixels, { raw: { width, height, channels: 4 } }).png().toBuffer());
  assert.equal(result.segmented, true);
  assert.equal(result.method, 'uniform-border-flood-fill');
  const subject = await sharp(await result.subject).raw().toBuffer({ resolveWithObject: true });
  const background = await sharp(await result.background).raw().toBuffer({ resolveWithObject: true });
  assert.equal(subject.data[3], 0);
  assert.equal(subject.data[(40 * width + 50) * 4 + 3], 255);
  assert.equal(background.data[3], 255);
  assert.equal(background.data[(40 * width + 50) * 4 + 3], 0);
});

test('does not claim pixel separation when image corners disagree', async () => {
  const width = 40;
  const height = 40;
  const pixels = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      const warm = x < width / 2 && y < height / 2;
      pixels[offset] = warm ? 224 : 32;
      pixels[offset + 1] = warm ? 198 : 92;
      pixels[offset + 2] = warm ? 164 : 180;
      pixels[offset + 3] = 255;
    }
  }
  const result = await segmentUniformBackground(await sharp(pixels, { raw: { width, height, channels: 4 } }).png().toBuffer());
  assert.equal(result.segmented, false);
  const subject = await sharp(await result.subject).raw().toBuffer();
  const background = await sharp(await result.background).raw().toBuffer();
  assert.equal(subject[3], 255);
  assert.equal(background[3], 0);
});
