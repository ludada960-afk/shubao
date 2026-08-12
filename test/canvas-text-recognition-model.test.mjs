import test from 'node:test';
import assert from 'node:assert/strict';

import {
  canvasTextRecognitionCacheKey,
  readCanvasTextRecognitionCache,
  writeCanvasTextRecognitionCache,
} from '../src/pages/EcCanvas/canvasTextRecognitionModel.js';

test('canvas OCR cache reuses successful blocks for the same image content', () => {
  const cache = new Map();
  const node = { id: 'image-1', assetId: 'asset-1', url: '/generated/source.png' };
  const blocks = [{ id: 'title', text: '夏日上新' }];

  assert.equal(readCanvasTextRecognitionCache(cache, node), undefined);
  writeCanvasTextRecognitionCache(cache, node, blocks);
  assert.deepEqual(readCanvasTextRecognitionCache(cache, { ...node, id: 'duplicate-node' }), blocks);
  assert.equal(canvasTextRecognitionCacheKey(node), 'asset-1|/generated/source.png');
});

test('canvas OCR cache does not reuse blocks after image content changes', () => {
  const cache = new Map();
  const node = { id: 'image-1', assetId: 'asset-1', url: '/generated/source.png' };
  writeCanvasTextRecognitionCache(cache, node, []);

  assert.deepEqual(readCanvasTextRecognitionCache(cache, node), []);
  assert.equal(readCanvasTextRecognitionCache(cache, { ...node, url: '/generated/revised.png' }), undefined);
  assert.equal(readCanvasTextRecognitionCache(cache, { id: 'empty' }), undefined);
});
