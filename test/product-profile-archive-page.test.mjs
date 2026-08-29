import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildProductArchiveUrl,
  parseProductArchiveRoute,
} from '../src/pages/ProductArchive/productArchiveRoute.js';

test('parses the canonical product archive hash and decodes encoded ids', () => {
  assert.equal(parseProductArchiveRoute('#/product-archives/abc-123'), 'abc-123');
  assert.equal(parseProductArchiveRoute('#/product-archives/abc%20123'), 'abc 123');
  assert.equal(parseProductArchiveRoute('#/product-archives/profile_with_underscore'), 'profile_with_underscore');
});

test('accepts history-style paths and strips the leading slash', () => {
  assert.equal(parseProductArchiveRoute('/product-archives/historical-id'), 'historical-id');
  assert.equal(parseProductArchiveRoute('product-archives/no-prefix'), 'no-prefix');
});

test('rejects hashes that do not point at the product-archive route', () => {
  assert.equal(parseProductArchiveRoute(''), null);
  assert.equal(parseProductArchiveRoute('#/'), null);
  assert.equal(parseProductArchiveRoute('#/ec-canvas/foo'), null);
  assert.equal(parseProductArchiveRoute('#/product-archives/'), null);
  assert.equal(parseProductArchiveRoute(null), null);
  assert.equal(parseProductArchiveRoute(undefined), null);
});

test('rejects ids that contain control characters or exceed the server length cap', () => {
  assert.equal(parseProductArchiveRoute('#/product-archives/with\u0000null'), null);
  assert.equal(parseProductArchiveRoute('#/product-archives/' + 'a'.repeat(201)), null);
});

test('builds an absolute hash URL with the provided origin for shareable links', () => {
  assert.equal(buildProductArchiveUrl('profile-1'), '#/product-archives/profile-1');
  assert.equal(
    buildProductArchiveUrl('profile 2', { origin: 'https://shuimg.cn' }),
    'https://shuimg.cn#/product-archives/profile%202',
  );
});

test('round-trips a known id through parse -> build -> parse', () => {
  const id = 'profile-stable-7';
  const url = buildProductArchiveUrl(id, { origin: 'https://example.com' });
  assert.equal(parseProductArchiveRoute(url), id);
});

test('builds an empty string for blank ids so the share input is safely disabled', () => {
  assert.equal(buildProductArchiveUrl(''), '');
  assert.equal(buildProductArchiveUrl('   '), '');
  assert.equal(buildProductArchiveUrl(null), '');
});
