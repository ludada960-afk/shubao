import assert from 'node:assert/strict';
import test from 'node:test';

import { buildModelRoute, normalizeImageModel, resolveGenerationSize } from '../server/ecommerceEngine/modelCatalog.mjs';
import { NANO_UPSTREAM_MODELS } from '../server/ecommerceEngine/nanoBananaProviderAdapter.mjs';

test('normalizes public image model choices and keeps smart on the existing Image2 route', () => {
  assert.equal(normalizeImageModel('nano-banana-2'), 'nano-banana-2');
  assert.equal(normalizeImageModel('nano-banana-pro'), 'nano-banana-pro');
  assert.equal(normalizeImageModel('unknown'), 'smart');
  assert.equal(buildModelRoute({ imageModel: 'smart', resolution: '2K', ratio: '1:1' }).provider, 'image2');
});

test('routes Nano Banana choices to stable Gemini models with independent resolution metadata', () => {
  assert.deepEqual(buildModelRoute({ imageModel: 'nano-banana-2', resolution: '2K', ratio: '9:16' }), {
    imageModel: 'nano-banana-2', provider: 'nano-banana', model: NANO_UPSTREAM_MODELS.flash,
    resolution: '2K', ratio: '9:16', imageSize: '2K', size: '1152x2048',
    /* 2026-10-04：显式档位照常带 aspectRatio，只有自适应才不带 */
    autoRatio: false,
    async: true, mode: 'edit',
  });
  assert.equal(buildModelRoute({ imageModel: 'nano-banana-pro', resolution: '4K' }).model, NANO_UPSTREAM_MODELS.pro);
  /* ⚠️ 2026-10-04：没传 ratio = 自适应 = 不指定，适配器据此**不带** aspectRatio，
     让 Gemini 按内容自己分配宽高（实测瓶子摆窗台 → 1376x768 横图）。 */
  assert.equal(buildModelRoute({ imageModel: 'nano-banana-2', resolution: '2K' }).autoRatio, true);
  /* 判据（不是拼写）：两档必须指向**不同**的上游模型，否则「换档」是假的。 */
  assert.notEqual(NANO_UPSTREAM_MODELS.flash, NANO_UPSTREAM_MODELS.pro, 'nano 两档不能指向同一个上游模型');
  assert.equal(resolveGenerationSize({ imageModel: 'nano-banana-2', resolution: '1K', ratio: '9:16' }).ratio, '9:16');
});
