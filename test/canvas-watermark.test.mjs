import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import {
  CANVAS_WATERMARK_DEFAULTS,
  CANVAS_WATERMARK_DEFAULT_TEXT,
  DEFAULT_IMAGE_WATERMARK,
  DEFAULT_VIDEO_WATERMARK,
  buildCanvasWatermarkTiles,
  buildImageWatermarkTiles,
  buildVideoWatermarkTiles,
  normalizeCanvasWatermark,
  normalizeImageWatermark,
  normalizeVideoWatermark,
  WATERMARK_MOTION_MODES,
  buildWatermarkTiles,
  normalizeWatermark,
  watermarkFontSizePx,
  watermarkLogoWidthPx,
  watermarkMotionAnimation,
} from '../src/pages/EcCanvas/canvasWatermarkModel.js';
import { alphaForDistance, estimateBackgroundColor } from '../src/pages/EcCanvas/watermarkBackgroundRemoval.js';

test('watermark defaults: disabled, default compliance text, sane ranges', () => {
  assert.equal(CANVAS_WATERMARK_DEFAULTS.enabled, false);
  assert.equal(CANVAS_WATERMARK_DEFAULTS.text, CANVAS_WATERMARK_DEFAULT_TEXT);
  const defaults = normalizeCanvasWatermark(null);
  assert.equal(defaults.enabled, false);
  assert.equal(defaults.text, CANVAS_WATERMARK_DEFAULT_TEXT);
  assert.ok(defaults.opacity > 0 && defaults.opacity < 1);
  assert.ok(defaults.size >= 10 && defaults.size <= 48);
  assert.ok(defaults.rotation >= -90 && defaults.rotation <= 90);
});

test('watermark normalize: clamps out-of-range values and trims text', () => {
  const w = normalizeCanvasWatermark({
    enabled: true,
    text: '  自定义水印  ',
    opacity: 5,
    size: 999,
    rotation: 500,
    gapX: 1,
    gapY: 99999,
  });
  assert.equal(w.enabled, true);
  assert.equal(w.text, '自定义水印');
  assert.equal(w.opacity, 0.6);
  assert.equal(w.size, 48);
  assert.equal(w.rotation, 90);
  assert.equal(w.gapX, 90);
  assert.equal(w.gapY, 520);
});

test('watermark normalize: empty text falls back to default, overlong text is sliced', () => {
  assert.equal(normalizeCanvasWatermark({ text: '   ' }).text, CANVAS_WATERMARK_DEFAULT_TEXT);
  assert.equal(normalizeCanvasWatermark({ text: 'x'.repeat(60) }).text.length, 40);
});

test('watermark tiles: disabled yields no tiles', () => {
  assert.deepEqual(buildCanvasWatermarkTiles({ enabled: false }, { width: 1600, height: 900 }), []);
  assert.deepEqual(buildCanvasWatermarkTiles(null, { width: 1600, height: 900 }), []);
});

test('watermark tiles: enabled covers the viewport with staggered rows', () => {
  const tiles = buildCanvasWatermarkTiles({ enabled: true }, { width: 1600, height: 900 });
  assert.ok(tiles.length > 0);
  const w = normalizeCanvasWatermark({ enabled: true });
  const cols = Math.ceil(1600 / w.gapX) + 1;
  const rows = Math.ceil(900 / w.gapY) + 1;
  assert.equal(tiles.length, cols * rows);
  const maxX = Math.max(...tiles.map(t => t.x));
  const maxY = Math.max(...tiles.map(t => t.y));
  assert.ok(maxX >= 1600, 'tiles must reach past the right edge');
  assert.ok(maxY >= 900, 'tiles must reach past the bottom edge');
  // 奇数行横向错位半个间距（砖缝排布，避免同列直线感）
  const row0 = tiles.filter(t => t.y === 0).map(t => t.x);
  const row1 = tiles.filter(t => t.y === w.gapY).map(t => t.x);
  assert.equal(row1[0], row0[0] + w.gapX / 2);
});

test('unified watermark model: image and video share one shape, legacy fields migrate', () => {
  const image = normalizeWatermark({ enabled: true, text: '  商品水印  ', opacity: 2, fontWeight: '700' });
  const video = normalizeWatermark({ enabled: true, motion: { mode: 'marquee', speed: 9 } }, { material: 'video' });
  assert.equal(image.text, '商品水印');
  assert.equal(image.opacity, 1);
  assert.equal(image.fontWeight, 700);
  assert.equal(video.motion.mode, 'marquee');
  assert.equal(video.motion.speed, 4);
  // 旧九宫格位置 → 百分比位置
  assert.deepEqual(
    { xPercent: normalizeWatermark({ position: 'bottom-right', offsetX: 0 }).xPercent },
    { xPercent: 88 },
  );
  // 旧平铺枚举 → 铺满开关
  assert.equal(normalizeWatermark({ tilePattern: 'grid' }).tile, true);
  // 旧动态模式 → 新动态模式
  assert.equal(normalizeWatermark({ dynamic: { mode: 'bounce' } }, { material: 'video' }).motion.mode, 'drift');
});

test('watermark tiles: single position vs 铺满网格', () => {
  const single = buildWatermarkTiles({ enabled: true, xPercent: 78, yPercent: 26 }, { width: 800, height: 600 });
  assert.equal(single.length, 1);
  assert.equal(single[0].xPercent, 78);
  assert.equal(single[0].yPercent, 26);
  const tiled = buildWatermarkTiles({ enabled: true, tile: true, tileGapXPercent: 25, tileGapYPercent: 25 }, { width: 800, height: 600 });
  assert.ok(tiled.length >= 16, '铺满时应覆盖整张素材, 实际 ' + tiled.length);
  assert.ok(tiled.every(tile => tile.xPercent >= 0 && tile.xPercent <= 100));
  assert.deepEqual(buildWatermarkTiles({ enabled: false }, { width: 800, height: 600 }), []);
});

test('watermark size scales with the material width (所见即所得)', () => {
  const config = normalizeWatermark({ enabled: true, fontSize: 30, logoScale: 0.2 });
  assert.equal(Math.round(watermarkFontSizePx(config, 1000)), 30);
  assert.equal(Math.round(watermarkFontSizePx(config, 500)), 15);
  assert.equal(Math.round(watermarkLogoWidthPx(config, 1000)), 200);
  assert.equal(Math.round(watermarkLogoWidthPx(config, 500)), 100);
});

test('video motion animation covers the researched dynamic modes', () => {
  const modes = WATERMARK_MOTION_MODES.map(mode => mode.value);
  assert.deepEqual(modes, ['static', 'rotate', 'drift', 'marquee', 'pulse', 'flicker', 'trace']);
  assert.equal(watermarkMotionAnimation({ enabled: true, motion: { mode: 'static' } }, { material: 'video' }), null);
  assert.equal(watermarkMotionAnimation({ enabled: true, motion: { mode: 'marquee' } }, { material: 'image' }), null);
  const marquee = watermarkMotionAnimation({ enabled: true, motion: { mode: 'marquee', direction: 'vertical', speed: 1 } }, { material: 'video' });
  assert.equal(marquee.animationName, 'ec-watermark-marquee-vertical');
  const rotate = watermarkMotionAnimation({ enabled: true, motion: { mode: 'rotate', intervalSec: 20 } }, { material: 'video' });
  assert.equal(rotate.animationName, 'ec-watermark-rotate');
  assert.equal(rotate.animationDuration, '20s');
  assert.equal(watermarkMotionAnimation({ enabled: true, motion: { mode: 'pulse' } }, { material: 'video' }).animationName, 'ec-watermark-pulse');
});

test('logo background removal helpers behave on sampled pixels', () => {
  assert.deepEqual(estimateBackgroundColor([{ r: 250, g: 250, b: 250 }, { r: 252, g: 250, b: 249 }]), { r: 252, g: 250, b: 250 });
  assert.deepEqual(estimateBackgroundColor([]), { r: 255, g: 255, b: 255 });
  assert.equal(alphaForDistance(4, 32, 16), 0);
  assert.equal(alphaForDistance(100, 32, 16), 1);
  const mid = alphaForDistance(40, 32, 16);
  assert.ok(mid > 0 && mid < 1, '羽化区间应产生半透明, 实际 ' + mid);
});

test('watermark contract: one panel with material switch, draggable preview and centered minimap', () => {
  const index = fs.readFileSync('src/pages/EcCanvas/index.jsx', 'utf8');
  const panel = fs.readFileSync('src/pages/EcCanvas/components/WatermarkPanel.jsx', 'utf8');
  const studio = fs.readFileSync('src/pages/EcCanvas/components/CanvasStudio.jsx', 'utf8');
  const layer = fs.readFileSync('src/pages/EcCanvas/components/WatermarkLayer.jsx', 'utf8');
  const minimap = fs.readFileSync('src/pages/EcCanvas/components/CanvasContextMenuPanel.jsx', 'utf8');
  const panelCss = fs.readFileSync('src/styles/canvas-watermark-panel.css', 'utf8');
  const supervisorCss = fs.readFileSync('src/styles/canvas-supervisor.css', 'utf8');

  assert.equal(DEFAULT_IMAGE_WATERMARK.enabled, false);
  assert.equal(DEFAULT_VIDEO_WATERMARK.enabled, false);
  // 单面板 + 素材类型切换（不再有 ImageWatermarkPanel / VideoWatermarkPanel 两套）
  assert.ok(index.includes('<WatermarkPanel') && !index.includes('ImageWatermarkPanel'));
  assert.ok(index.includes('watermarkMaterial') && index.includes('WATERMARK_VIDEO_KINDS'));
  assert.ok(index.includes('handleWatermarkCommit') && index.includes('handleWatermarkPreview'));
  assert.ok(index.includes('nodeWatermark(node'));
  assert.ok(panel.includes('aria-label="水印面板"'));
  assert.ok(panel.includes('素材类型') && panel.includes('水印类型'));
  // 拖拽定位 + 实时同步
  assert.ok(panel.includes('onPointerDown={handlePointerDown}') && panel.includes('xPercent'));
  // 去纯色背景
  assert.ok(panel.includes('removeSolidBackground'));
  // 铺满图片
  assert.ok(panel.includes('铺满图片'));
  // 视频动态水印
  assert.ok(panel.includes('动态水印'));
  // 渲染层共用
  assert.ok(studio.includes('MaterialWatermarkOverlay') && studio.includes('WatermarkLayer'));
  assert.ok(layer.includes('ec-wm-anchor') && layer.includes('watermarkMotionAnimation'));
  // 小地图：等比居中 + 自动收起 + 与底栏留间隙
  assert.ok(minimap.includes('const scale = Math.min(') && minimap.includes('padX') && minimap.includes('ResizeObserver'));
  assert.ok(index.includes('floatingCanvasPanelOpen'));
  assert.ok(panelCss.includes('.ec-wm-panel') && panelCss.includes('--ec-canvas-bottombar-top'));
  assert.ok(supervisorCss.includes('var(--ec-canvas-bottombar-top'));
});
