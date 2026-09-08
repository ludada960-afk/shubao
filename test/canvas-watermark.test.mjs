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
} from '../src/pages/EcCanvas/canvasWatermarkModel.js';

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

test('material watermark models normalize and create preview tiles', () => {
  const image = normalizeImageWatermark({ enabled: true, text: '  商品水印  ', opacity: 2, fontWeight: '700' });
  const video = normalizeVideoWatermark({ enabled: true, type: 'dynamic', dynamic: { enabled: true, speed: 20 } });
  assert.equal(image.text, '商品水印');
  assert.equal(image.opacity, 1);
  assert.equal(image.fontWeight, 700);
  assert.equal(video.type, 'dynamic');
  assert.equal(video.dynamic.speed, 10);
  assert.ok(buildImageWatermarkTiles(image, { width: 800, height: 600 }).length > 0);
  assert.equal(buildVideoWatermarkTiles(video, { width: 800, height: 600 }).length, 1);
});
test('watermark contract: separate material panels, node previews and minimap wiring', () => {
  const index = fs.readFileSync('src/pages/EcCanvas/index.jsx', 'utf8');
  const panel = fs.readFileSync('src/pages/EcCanvas/components/WatermarkPanel.jsx', 'utf8');
  const studio = fs.readFileSync('src/pages/EcCanvas/components/CanvasStudio.jsx', 'utf8');
  const minimap = fs.readFileSync('src/pages/EcCanvas/components/CanvasContextMenuPanel.jsx', 'utf8');
  const css = fs.readFileSync('src/pages/EcCanvas/EcCanvas.css', 'utf8');

  assert.equal(DEFAULT_IMAGE_WATERMARK.enabled, false);
  assert.equal(DEFAULT_VIDEO_WATERMARK.enabled, false);
  assert.ok(index.includes('ImageWatermarkPanel') && index.includes('VideoWatermarkPanel'));
  assert.ok(index.includes('handleImageWatermarkChange') && index.includes('handleVideoWatermarkChange'));
  assert.ok(index.includes('node.imageWatermark') && index.includes('node.videoWatermark'));
  assert.ok(studio.includes('MaterialWatermarkOverlay'));
  assert.ok(studio.includes('isVideo && <MaterialWatermarkOverlay'));
  assert.ok(panel.includes('aria-label="图片水印设置"') && panel.includes('aria-label="视频水印设置"'));
  assert.ok(css.includes('.ec-material-watermark-overlay'));
  assert.ok(minimap.includes('const canvasWidth') && minimap.includes('rawVisibleRect'));
});
