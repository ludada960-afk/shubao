import assert from 'node:assert/strict';
import test from 'node:test';

import {
  detectSizingConflict,
  parseSizeMentions,
  ratioFromPixels,
  suggestSizingImages,
} from '../src/pages/Home/ec/promptSizeConflict.js';

const panel = [
  { key: 'main_text', count: 5, ratio: '1:1' },
  { key: 'detail', count: 9, ratio: '9:16' },
  { key: 'main_3x4', count: 3, ratio: '3:4' },
];

test('extracts explicit ratios, chinese words and pixel pairs from prompt text', () => {
  const mentions = parseSizeMentions('做一套 16:9 横版主图，另外再来 1200x1600 的竖图');
  const ratios = mentions.map(item => item.ratio);
  assert.ok(ratios.includes('16:9'), 'explicit 16:9');
  assert.ok(ratios.includes('3:4'), '1200x1600 -> 3:4');
  assert.ok(mentions.some(item => item.kind === 'word'), 'word form detected');
});

test('pixel pairs map to the nearest legal ratio', () => {
  assert.equal(ratioFromPixels(1200, 1600), '3:4');
  assert.equal(ratioFromPixels(1080, 1920), '9:16');
  assert.equal(ratioFromPixels(1024, 1024), '1:1');
  assert.equal(ratioFromPixels('', 100), '');
});

test('no conflict when the prompt mentions a ratio the panel already covers', () => {
  const result = detectSizingConflict({ promptText: '主图做成 1:1 方形', images: panel });
  assert.equal(result.conflicts.length, 0);
  assert.deepEqual(result.panelRatios.sort(), ['1:1', '3:4', '9:16']);
});

test('conflict when the prompt asks for a ratio the panel does not have', () => {
  const result = detectSizingConflict({ promptText: '请按 16:9 横版主图出图', images: panel });
  assert.equal(result.conflicts.length, 1);
  const conflict = result.conflicts[0];
  assert.equal(conflict.ratio, '16:9');
  assert.equal(conflict.canApply, true);
  assert.ok(conflict.applyCount >= 1);
  assert.deepEqual(conflict.panelRatios.sort(), ['1:1', '3:4', '9:16']);
});

test('suggestion only rewrites main-scoped images and never touches detail', () => {
  const patch = suggestSizingImages(panel, '16:9');
  assert.ok(patch);
  const detail = patch.images.find(image => image.key === 'detail');
  assert.equal(detail.ratio, '9:16', '详情比例保持不变');
  const mainText = patch.images.find(image => image.key === 'main_text');
  assert.equal(mainText.ratio, '16:9');
  assert.equal(mainText.targetRatio, '16:9');
});

test('empty prompt or empty panel produces no conflict noise', () => {
  assert.equal(detectSizingConflict({ promptText: '', images: panel }).conflicts.length, 0);
  assert.equal(detectSizingConflict({ promptText: '做成 16:9', images: [] }).conflicts.length, 0);
  assert.equal(detectSizingConflict({ promptText: '随便描述一下画面', images: panel }).conflicts.length, 0);
});
