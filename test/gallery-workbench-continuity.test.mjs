import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('..', import.meta.url);

test('inspiration cases use an overlay state and never replace ecommerce generation state', async () => {
  const [gallery, app, context] = await Promise.all([
    readFile(new URL('./src/pages/Home/GallerySection.jsx', root), 'utf8'),
    readFile(new URL('./src/App.jsx', root), 'utf8'),
    readFile(new URL('./src/store/AppContext.jsx', root), 'utf8'),
  ]);

  assert.match(gallery, /type:\s*'VIEW_GALLERY_ITEM'/);
  assert.doesNotMatch(gallery, /type:\s*'SET_RESULT'/);
  assert.match(context, /case 'VIEW_GALLERY_ITEM':[\s\S]*galleryItem:\s*action\.item/);
  assert.match(app, /galleryItem\s*\|\|\s*\(genState === 'result'/);
  assert.match(app, /type:\s*'VIEW_GALLERY_ITEM',\s*item:\s*null/);
});

test('inspiration gallery keeps production visual cases mixed with legacy categories', async () => {
  const gallery = await readFile(new URL('./src/pages/Home/GallerySection.jsx', root), 'utf8');
  assert.match(gallery, /PRODUCTION_CASE_CATALOG/);
  assert.match(gallery, /productionPromptFor/);
  assert.match(gallery, /interleave\(\[/);
  assert.match(gallery, /IntersectionObserver/);
  assert.match(gallery, /INITIAL_VISIBLE/);
  assert.match(gallery, /loading-more|gallery-load-more/);
  assert.match(gallery, /body_text:\s*item\.body_text \|\| item\.body \|\| promptText/);
});

test('the global task dock is the only ecommerce progress surface', async () => {
  const app = await readFile(new URL('./src/App.jsx', root), 'utf8');

  assert.match(app, /<TaskSidebar\s*\/>/);
  assert.doesNotMatch(app, /<GenModal/);
  assert.doesNotMatch(app, /genModalOpen/);
});
