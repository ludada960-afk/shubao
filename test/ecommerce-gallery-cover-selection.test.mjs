import assert from 'node:assert/strict';
import test from 'node:test';
import { selectCoverImages } from '../scripts/import-ecommerce-gallery-case.mjs';

test('cover selection excludes production assets and favors persuasive imagery', () => {
  const selected = selectCoverImages([
    { sourceFile: '01-白底图.png', label: '白底图' },
    { sourceFile: '02-透明PNG.png', label: '透明素材' },
    { sourceFile: '03-使用场景.jpg', label: '使用场景图' },
    { sourceFile: '04-核心卖点.jpg', label: '商品主图' },
    { sourceFile: '05-材质细节.jpg', label: '材质细节图' },
  ]);
  assert.deepEqual(selected.map(item => item.sourceFile), ['04-核心卖点.jpg', '03-使用场景.jpg', '05-材质细节.jpg']);
});
