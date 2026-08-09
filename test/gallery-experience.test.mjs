import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { inferImageRole, createMosaicLayout } from '../scripts/import-ecommerce-gallery-case.mjs';

test('ecommerce gallery importer infers useful image roles', () => {
  assert.equal(inferImageRole('01-白底主图.png', 0).label, '白底图');
  assert.equal(inferImageRole('02-模特使用场景.jpg', 1).label, '使用场景图');
  assert.equal(inferImageRole('03-材质细节.webp', 2).label, '材质细节图');
  assert.equal(inferImageRole('unknown.png', 3).label, '商品展示图 4');
});

test('ecommerce gallery mosaic layout stays inside the output canvas', () => {
  const layout = createMosaicLayout(7, 1200, 1600, 8);
  assert.equal(layout.length, 7);
  for (const tile of layout) {
    assert.ok(tile.x >= 0 && tile.y >= 0 && tile.width > 0 && tile.height > 0);
    assert.ok(tile.x + tile.width <= 1200 && tile.y + tile.height <= 1600);
  }
  for (let i = 0; i < layout.length; i += 1) {
    for (let j = i + 1; j < layout.length; j += 1) {
      const a = layout[i];
      const b = layout[j];
      const overlaps = a.x < b.x + b.width && a.x + a.width > b.x
        && a.y < b.y + b.height && a.y + a.height > b.y;
      assert.equal(overlaps, false);
    }
  }
});

test('gallery modal contains wheel navigation and locks page scrolling', async () => {
  const source = await readFile(new URL('../src/NoteModal.jsx', import.meta.url), 'utf8');
  assert.match(source, /document\.documentElement\.style\.overflow\s*=\s*'hidden'/);
  assert.match(source, /e\.preventDefault\(\)/);
  assert.match(source, /e\.stopPropagation\(\)/);
  assert.match(source, /_galleryType\s*===\s*'ecommerce'/);
  assert.match(source, /套图总览/);
});

test('gallery loads curated ecommerce cases and exposes same-style action', async () => {
  const source = await readFile(new URL('../src/pages/Home/GallerySection.jsx', import.meta.url), 'utf8');
  assert.match(source, /gallery\/ecommerce\/cases\.json/);
  assert.match(source, /做同款/);
  assert.match(source, /SET_MODE/);
  assert.match(source, /SET_INPUT/);
});
