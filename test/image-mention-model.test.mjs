import assert from 'node:assert/strict';
import test from 'node:test';

import {
  appendImageMention,
  buildCanvasImageReferencePayload,
  buildImageMentions,
  buildRoleAwareImagePayload,
  toggleImageMention,
} from '../src/components/creation/imageMentionModel.js';

const assets = [
  { id: 'product-a', assetId: 'asset-a', url: '/a.png', name: '正面图', role: 'product' },
  { id: 'reference-b', assetId: 'asset-b', url: '/b.png', name: '风格图', role: 'reference' },
  { id: 'product-a', assetId: 'asset-a', url: '/a.png', name: '重复图', role: 'reference' },
];

test('image mentions are ordered, deduplicated and receive stable display labels', () => {
  assert.deepEqual(buildImageMentions(assets), [
    {
      sourceNodeId: 'product-a',
      assetId: 'asset-a',
      url: '/a.png',
      name: '正面图',
      role: 'product',
      label: '@图片1',
      order: 0,
    },
    {
      sourceNodeId: 'reference-b',
      assetId: 'asset-b',
      url: '/b.png',
      name: '风格图',
      role: 'reference',
      label: '@图片2',
      order: 1,
    },
  ]);
});

test('toggling a mention preserves the remaining order and relabels it deterministically', () => {
  const selected = buildImageMentions(assets.slice(0, 2));
  assert.deepEqual(toggleImageMention(selected, assets[0]).map(item => item.label), ['@图片1']);
  assert.deepEqual(toggleImageMention(selected.slice(0, 1), assets[1]).map(item => item.label), ['@图片1', '@图片2']);
});

test('canvas image requests use the first mention as source and preserve later reference order', () => {
  assert.deepEqual(buildCanvasImageReferencePayload(buildImageMentions(assets)), {
    imageUrl: '/a.png',
    referenceImages: ['/b.png'],
    sourceNodeIds: ['product-a', 'reference-b'],
  });
});

test('ecommerce requests preserve product and reference roles', () => {
  const mentions = buildImageMentions([
    assets[0],
    assets[1],
    { id: 'product-c', url: '/c.png', role: 'product' },
  ]);
  assert.deepEqual(buildRoleAwareImagePayload(mentions), {
    productImages: ['/a.png', '/c.png'],
    referenceImages: ['/b.png'],
  });
});

test('an image mention is inserted once with readable spacing', () => {
  assert.equal(appendImageMention('', '@图片1'), '@图片1 ');
  assert.equal(appendImageMention('保留杯身', '@图片2'), '保留杯身 @图片2 ');
  assert.equal(appendImageMention('参考 @图片1 的构图', '@图片1'), '参考 @图片1 的构图');
});

test('plain image URLs become stable mention candidates for content creation', () => {
  assert.deepEqual(buildImageMentions(['/a.png', '/b.png']).map(item => ({ label: item.label, url: item.url })), [
    { label: '@图片1', url: '/a.png' },
    { label: '@图片2', url: '/b.png' },
  ]);
});
