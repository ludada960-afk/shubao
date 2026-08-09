import assert from 'node:assert/strict';
import test from 'node:test';

import { buildModelRoute, normalizeImageModel, resolveGenerationSize } from '../server/ecommerceEngine/modelCatalog.mjs';

test('normalizes public image model choices and keeps smart on the existing Image2 route', () => {
  assert.equal(normalizeImageModel('nano-banana-2'), 'nano-banana-2');
  assert.equal(normalizeImageModel('nano-banana-pro'), 'nano-banana-pro');
  assert.equal(normalizeImageModel('unknown'), 'smart');
  assert.equal(buildModelRoute({ imageModel: 'smart', resolution: '2K', ratio: '1:1' }).provider, 'image2');
});

test('routes Nano Banana choices to stable Gemini models with independent resolution metadata', () => {
  assert.deepEqual(buildModelRoute({ imageModel: 'nano-banana-2', resolution: '2K', ratio: '9:16' }), {
    imageModel: 'nano-banana-2', provider: 'nano-banana', model: 'gemini-3.1-flash-image',
    resolution: '2K', ratio: '9:16', imageSize: '2K', size: '1152x2048', async: true, mode: 'edit',
  });
  assert.equal(buildModelRoute({ imageModel: 'nano-banana-pro', resolution: '4K' }).model, 'gemini-3-pro-image');
  assert.equal(resolveGenerationSize({ imageModel: 'nano-banana-2', resolution: '1K', ratio: '9:16' }).ratio, '9:16');
});
