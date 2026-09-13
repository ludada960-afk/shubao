// test/canvas-points-estimate-0913.test.mjs
// 2026-09-13 用户批注：画布四个生成框的积分必须和首页/后端计费目录**同源**（生成前就要看得见，且随配置变）。
// 这里锁死口径：图片 = 单价 × 张数；文案 = 0.2；套图 = 整套张数 × 单价；视频 = 产品报价 short/long。
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  estimateImageComposerPoints,
  estimateSuiteComposerPoints,
  estimateTextComposerPoints,
  estimateVideoComposerPoints,
  formatCanvasPoints,
  imagePointsPerShot,
  CANVAS_TEXT_POINTS,
} from '../src/pages/EcCanvas/canvasPointsEstimate.js';
import { generationUnits } from '../src/services/imageModelCatalog.js';
import { clampCanvasPickerPosition } from '../src/pages/EcCanvas/nodeWorkflow.js';

test('生图积分 = 单价 × 张数，且与后端计费目录同源', () => {
  assert.equal(imagePointsPerShot('image2', '2K'), generationUnits('image2', '2K') / 1000);
  assert.equal(estimateImageComposerPoints({ imageModel: 'image2', resolution: '2K', count: 3 }).points, 3);
  assert.equal(estimateImageComposerPoints({ imageModel: 'image2', resolution: '4K', count: 1 }).points, 2);
  assert.equal(estimateImageComposerPoints({ imageModel: 'midjourney', resolution: '1K', count: 1 }).points, 3);
  assert.equal(estimateImageComposerPoints({ imageModel: 'midjourney', resolution: '2K', count: 2 }).points, 7);
  assert.equal(estimateImageComposerPoints({ imageModel: 'image2-5-sunburst', resolution: '2K', count: 1 }).points, 1.5);
  // 张数缺失/非法时按 1 张算，绝不显示 0
  assert.equal(estimateImageComposerPoints({ imageModel: 'image2', resolution: '2K' }).points, 1);
  assert.equal(estimateImageComposerPoints({ imageModel: 'image2', resolution: '2K', count: 0 }).points, 1);
});

test('文案积分按次计费，与后端 ec_ai_assistant 一致', () => {
  assert.equal(CANVAS_TEXT_POINTS, 0.2);
  assert.equal(estimateTextComposerPoints().points, 0.2);
});

test('套图积分 = 整套张数 × 单价（不能退化成 1 张）', () => {
  /* 与首页同源：用 resolveSizingImages 认可的类型 key（白底 1 + 主图 3 + 详情 2 = 6 张） */
  const explicit = estimateSuiteComposerPoints({
    platform: 'taobao',
    sizing: { images: [{ key: 'white_bg', count: 1 }, { key: 'main_text', count: 3 }, { key: 'detail', count: 2 }] },
    resolution: '2K',
    imageModel: 'image2',
  });
  assert.equal(explicit.count, 6);
  assert.equal(explicit.points, 6);
  const preset = estimateSuiteComposerPoints({ platform: 'taobao', sizing: {}, resolution: '2K', imageModel: 'image2' });
  assert.ok(preset.count > 1, '平台默认整套必须多于 1 张，实际 ' + preset.count);
  assert.equal(preset.points, preset.perShot * preset.count);
});

test('视频积分取产品报价（≤8 秒 short / 更长 long）', () => {
  const products = [{ id: 'seedance_standard', quotes: { short: { points: 62 }, long: { points: 120 } } }];
  assert.equal(estimateVideoComposerPoints({ products, modelProductId: 'seedance_standard', duration: 8 }).points, 62);
  assert.equal(estimateVideoComposerPoints({ products, modelProductId: 'seedance_standard', duration: 12 }).points, 120);
  assert.equal(estimateVideoComposerPoints({ products: [], modelProductId: 'x', duration: 8 }), null);
});

test('积分展示不做四舍五入进位（1.5 / 3.5 要原样显示）', () => {
  assert.equal(formatCanvasPoints(1.5), '1.5');
  assert.equal(formatCanvasPoints(3.5), '3.5');
  assert.equal(formatCanvasPoints(3), '3');
  assert.equal(formatCanvasPoints(0), '0');
});

test('生成面板锚点：空间够时居中在按钮正上方，不够时回落右下角', () => {
  const roomy = clampCanvasPickerPosition({
    world: { x: 500, y: 600 },
    viewport: { x: 0, y: 0, scale: 1 },
    bounds: { width: 1000, height: 800 },
    anchor: 'above',
  });
  assert.equal(roomy.placement, 'above');
  assert.equal(roomy.x, 500, '水平方向要正对按钮中心');
  assert.equal(roomy.y, 600);
  /* 上方几乎没空间（< 最小可视高度）时不给 above，直接落右下角；
     放不下但还有空间的中间情况由组件渲染后复测翻到下方（is-flipped），仍然居中。 */
  const cramped = clampCanvasPickerPosition({
    world: { x: 500, y: 100 },
    viewport: { x: 0, y: 0, scale: 1 },
    bounds: { width: 1000, height: 800 },
    anchor: 'above',
  });
  assert.equal(cramped.placement, undefined, '上方放不下时不给 above，避免被顶出可视区');
  assert.deepEqual({ x: cramped.x, y: cramped.y }, { x: 500, y: 100 });
  const middle = clampCanvasPickerPosition({
    world: { x: 500, y: 200 },
    viewport: { x: 0, y: 0, scale: 1 },
    bounds: { width: 1000, height: 800 },
    anchor: 'above',
  });
  assert.equal(middle.placement, 'above', '还有空间就先按居中在按钮上方定位');
  // 默认行为（不传 anchor）必须与历史一致，避免影响其它调用方
  const legacy = clampCanvasPickerPosition({ world: { x: 1000, y: 800 }, viewport: { x: -200, y: -100, scale: 2 }, bounds: { width: 390, height: 844 } });
  assert.deepEqual(legacy, { x: 105, y: 55, width: 185, maxHeight: 412 });
});
