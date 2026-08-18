import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildXhsPublishPages,
  getNextXhsPublishIndex,
  getXhsPublishBody,
} from '../src/pages/Home/xhsPublishPreviewModel.js';

test('buildXhsPublishPages keeps cover first and caps the publish set at nine', () => {
  const pages = buildXhsPublishPages({
    title: '厦门',
    cover_url: '/cover.webp',
    image_urls: Array.from({ length: 11 }, (_, index) => `/page-${index + 1}.webp`),
  });
  assert.equal(pages.length, 9);
  assert.equal(pages[0].src, '/cover.webp');
  assert.equal(pages[8].index, 8);
  assert.equal(pages[8].src, '/page-8.webp');
});

test('getNextXhsPublishIndex wraps and returns an empty sentinel without pages', () => {
  assert.equal(getNextXhsPublishIndex(8, 1, 9), 0);
  assert.equal(getNextXhsPublishIndex(0, -1, 9), 8);
  assert.equal(getNextXhsPublishIndex(0, 1, 0), -1);
});

test('getXhsPublishBody preserves every line of the article', () => {
  assert.equal(getXhsPublishBody({ body: '第一段\n\n第二段\n第三段' }), '第一段\n\n第二段\n第三段');
});
