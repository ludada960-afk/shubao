import assert from 'node:assert/strict';
import test from 'node:test';

import {
  appendImageMention,
  buildCanvasImageReferencePayload,
  buildImageMentions,
  buildRoleAwareImagePayload,
  removeImageMention,
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
      label: '@正面图',
      order: 0,
    },
    {
      sourceNodeId: 'reference-b',
      assetId: 'asset-b',
      url: '/b.png',
      name: '风格图',
      role: 'reference',
      label: '@风格图',
      order: 1,
    },
  ]);
});

test('toggling a mention preserves the remaining order and relabels it deterministically', () => {
  const selected = buildImageMentions(assets.slice(0, 2));
  assert.deepEqual(toggleImageMention(selected, assets[0]).map(item => item.label), ['@风格图']);
  assert.deepEqual(toggleImageMention(selected.slice(0, 1), assets[1]).map(item => item.label), ['@正面图', '@风格图']);
});

test('canvas image requests use the first mention as source and preserve later reference order', () => {
  assert.deepEqual(buildCanvasImageReferencePayload(buildImageMentions(assets)), {
    imageUrl: '/a.png',
    referenceImages: ['/b.png'],
    sourceNodeIds: ['product-a', 'reference-b'],
    references: [
      { sourceNodeId: 'product-a', assetId: 'asset-a', url: '/a.png', displayName: '正面图', mention: '@正面图', role: 'product', order: 0 },
      { sourceNodeId: 'reference-b', assetId: 'asset-b', url: '/b.png', displayName: '风格图', mention: '@风格图', role: 'reference', order: 1 },
    ],
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
    assets: [
      { sourceNodeId: 'product-a', assetId: 'asset-a', url: '/a.png', displayName: '正面图', mention: '@正面图', role: 'product', order: 0 },
      { sourceNodeId: 'reference-b', assetId: 'asset-b', url: '/b.png', displayName: '风格图', mention: '@风格图', role: 'reference', order: 1 },
      { sourceNodeId: 'product-c', assetId: '', url: '/c.png', displayName: '图片3', mention: '@图片3', role: 'product', order: 2 },
    ],
  });
});

test('duplicate human labels remain readable and deterministic', () => {
  assert.deepEqual(buildImageMentions([
    { id: 'a', url: '/a.png', name: '参考图' },
    { id: 'b', url: '/b.png', name: '参考图' },
  ]).map(item => item.label), ['@参考图', '@参考图2']);
});

test('an image mention is inserted once with readable spacing', () => {
  assert.equal(appendImageMention('', '@图片1'), '@图片1 ');
  assert.equal(appendImageMention('保留杯身', '@图片2'), '保留杯身 @图片2 ');
  assert.equal(appendImageMention('参考 @图片1 的构图', '@图片1'), '参考 @图片1 的构图');
});

test('removing an image mention only removes the selected token', () => {
  assert.equal(removeImageMention('保留 @图片1 的主体，并参考 @图片2', '@图片1'), '保留 的主体，并参考 @图片2');
  assert.equal(removeImageMention('@图片1 @图片2', '@图片2'), '@图片1');
  assert.equal(removeImageMention('没有引用图片', '@图片1'), '没有引用图片');
});

test('plain image URLs become stable mention candidates for content creation', () => {
  assert.deepEqual(buildImageMentions(['/a.png', '/b.png']).map(item => ({ label: item.label, url: item.url })), [
    { label: '@图片1', url: '/a.png' },
    { label: '@图片2', url: '/b.png' },
  ]);
});
