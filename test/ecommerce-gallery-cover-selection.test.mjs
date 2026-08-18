import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { COVER_TILE_RESIZE_OPTIONS, resolveImageDeclaration, selectCoverImages } from '../scripts/import-ecommerce-gallery-case.mjs';

const ecommerceCasePreviewSource = readFileSync(new URL('../src/NoteModal.jsx', import.meta.url), 'utf8');

test('cover tiles preserve the complete source image inside each frame', () => {
  assert.equal(COVER_TILE_RESIZE_OPTIONS.fit, 'contain');
  assert.equal(COVER_TILE_RESIZE_OPTIONS.background, '#ffffff');
});

test('ecommerce detail preview requests the original image and contains it inside the viewport', () => {
  assert.match(ecommerceCasePreviewSource, /<ResponsiveImage src=\{current\.url\}[^>]+variant="full"/);
  assert.match(ecommerceCasePreviewSource, /imgStyle=\{\{ width: '100%', height: '100%', objectFit: 'contain' \}\}/);
});

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

test('gallery metadata replaces generated placeholders by source file', () => {
  const declaration = resolveImageDeclaration('02-generated.png', [
    { sourceFile: '02-generated.png', label: '真实使用详情图', description: '展示单手开盖' },
  ]);
  assert.equal(declaration.label, '真实使用详情图');
  assert.equal(declaration.description, '展示单手开盖');
  assert.equal(resolveImageDeclaration('03-generated.png', [{ sourceFile: '03-generated.png', label: 'generated' }]).label, '');
});
