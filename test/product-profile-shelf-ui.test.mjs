import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const ecMode = await readFile(new URL('../src/pages/Home/EcMode.jsx', import.meta.url), 'utf8');
const shelf = await readFile(new URL('../src/pages/Home/ec/ProductProfileShelf.jsx', import.meta.url), 'utf8');
const css = await readFile(new URL('../src/pages/Home/ec/ProductProfileShelf.css', import.meta.url), 'utf8');

test('ecommerce workbench exposes the signed product profile shelf without replacing SKU controls', () => {
  assert.match(ecMode, /<ProductProfileShelf/);
  assert.match(ecMode, /listProductProfiles/);
  assert.match(ecMode, /createProductProfile/);
  assert.match(ecMode, /getProjectAsset\(/);
  assert.match(ecMode, /purpose=reuse|, 'reuse'/);
  assert.match(ecMode, /buildProductProfileMediaState/);
  assert.match(ecMode, /applyProductProfileToEcState/);
  assert.match(ecMode, /const profileAccess = Boolean\(state\.logged && ownerEmail\)/);
  assert.match(ecMode, /<SkuPanel skus={skus}/);
});

test('product profile shelf has named actions and a mobile-safe responsive contract', () => {
  assert.match(shelf, /aria-label="商品档案"/);
  assert.match(shelf, /aria-controls="ec-product-profile-panel"/);
  assert.match(shelf, /aria-label="刷新商品档案"/);
  assert.match(shelf, /保存当前商品/);
  assert.match(shelf, /应用/);
  assert.match(shelf, /归档/);
  assert.match(shelf, /正在带入/);
  assert.match(shelf, /disabled=\{Boolean\(applying\)\}/);
  assert.match(css, /@media \(max-width: 620px\)[\s\S]*?\.ec-product-profile-trigger \{[\s\S]*?width: 100%/);
  assert.match(css, /\.ec-product-profile-list \{[\s\S]*?max-height: 260px/);
  assert.match(css, /\.ec-product-profile-row \{[\s\S]*?min-width: 0/);
});
