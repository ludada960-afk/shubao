import test from 'node:test';
import assert from 'node:assert/strict';

import {
  COMMERCE_CONTENT_TYPES,
  COMMERCE_LANGUAGES,
  COMMERCE_PLATFORMS,
  normalizeCommerceContext,
} from '../server/ecommerceEngine/internationalCommerceRegistry.mjs';

test('commerce registry covers domestic and cross-border platform families', () => {
  const ids = COMMERCE_PLATFORMS.map(platform => platform.id);
  assert.ok(ids.includes('taobao'));
  assert.ok(ids.includes('tmall'));
  assert.ok(ids.includes('amazon'));
  assert.ok(ids.includes('amazon-aplus-wide'));
  assert.ok(ids.includes('shopee'));
  assert.ok(ids.includes('lazada'));
  assert.ok(ids.includes('tiktok-shop'));
  assert.ok(ids.includes('ozon'));
  assert.ok(COMMERCE_PLATFORMS.filter(platform => platform.market === 'domestic').length >= 8);
  assert.ok(COMMERCE_PLATFORMS.filter(platform => platform.market === 'cross-border').length >= 8);
});

test('commerce registry exposes content types and multilingual target choices', () => {
  assert.deepEqual(COMMERCE_CONTENT_TYPES.map(item => item.id), ['main', 'detail', 'ad']);
  assert.ok(COMMERCE_LANGUAGES.length >= 20);
  assert.equal(COMMERCE_LANGUAGES[0].id, 'visual');
  assert.ok(COMMERCE_LANGUAGES.some(language => language.id === 'en'));
  assert.ok(COMMERCE_LANGUAGES.some(language => language.id === 'pt-BR'));
  assert.ok(COMMERCE_LANGUAGES.some(language => language.id === 'ar' && language.direction === 'rtl'));
});

test('commerce context normalizes legacy labels and fails closed for unknown values', () => {
  assert.deepEqual(normalizeCommerceContext({
    platform: '亚马逊A+超宽幅',
    contentType: '详情图',
    targetLanguage: '英语',
  }), {
    platform: 'amazon-aplus-wide',
    contentType: 'detail',
    targetLanguage: 'en',
    locale: 'en-US',
    policyVersion: 'global-commerce-v1',
  });

  assert.deepEqual(normalizeCommerceContext({
    platform: 'made-up-market',
    contentType: 'unknown',
    targetLanguage: 'made-up-language',
  }), {
    platform: 'smart',
    contentType: 'main',
    targetLanguage: 'visual',
    locale: 'und',
    policyVersion: 'global-commerce-v1',
  });
});
