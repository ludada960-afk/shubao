import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  ECOMMERCE_FORMATS,
  formatsFor,
  normalizeCommerceFormat,
} from '../src/pages/Home/ec/ecommerceFormatRegistry.js';

test('offers a complete ecommerce format set instead of four global ratios', () => {
  assert.deepEqual(ECOMMERCE_FORMATS.map(format => format.key), [
    '1:1', '4:5', '3:4', '2:3', '9:16', '4:3', '3:2', '16:9',
  ]);
  assert.equal(formatsFor({ role: 'detail', platform: '淘宝' }).some(format => format.key === '9:16'), true);
  assert.equal(formatsFor({ role: 'detail', platform: '淘宝' }).some(format => format.key === '16:9'), true);
  assert.equal(formatsFor({ role: 'main_text', platform: '淘宝' }).length >= 6, true);
});

test('promotes unsupported target formats to the closest legal generation ratio', () => {
  assert.deepEqual(normalizeCommerceFormat({ ratio: '4:5', resolution: '2K', role: 'main_text' }), {
    targetRatio: '4:5',
    generationRatio: '3:4',
    cropPolicy: 'cover-center',
  });
  assert.deepEqual(normalizeCommerceFormat({ ratio: '16:9', resolution: '2K', role: 'main_text' }), {
    targetRatio: '16:9',
    generationRatio: '4:3',
    cropPolicy: 'cover-center',
  });
  assert.deepEqual(normalizeCommerceFormat({ ratio: '9:16', resolution: '1K', role: 'detail' }), {
    targetRatio: '9:16',
    generationRatio: '9:16',
    cropPolicy: 'none',
  });
});

test('ratio picker renders through a shared viewport portal', () => {
  const sizing = readFileSync(new URL('../src/pages/Home/ec/SizingPanel.jsx', import.meta.url), 'utf8');
  const portal = readFileSync(new URL('../src/components/ui/AnchoredPortal.jsx', import.meta.url), 'utf8');

  assert.match(sizing, /AnchoredPortal/);
  assert.doesNotMatch(sizing, /position:\s*'absolute',\s*top:\s*30/);
  assert.match(portal, /createPortal/);
  assert.match(portal, /getBoundingClientRect/);
  assert.match(portal, /addEventListener\('scroll'/);
  assert.match(portal, /Escape/);
});
