import assert from 'node:assert/strict';
import test from 'node:test';

import {
  appendImageMention,
  buildCanvasImageReferencePayload,
  buildImageMentions,
  buildRoleAwareImagePayload,
  insertImageMentionAt,
  removeImageMention,
  toggleImageMention,
} from '../src/components/creation/imageMentionModel.js';

const assets = [
  { id: 'product-a', assetId: 'asset-a', url: '/a.png', name: '正面图', role: 'product' },
  { id: 'reference-b', assetId: 'asset-b', url: '/b.png', name: '风格图', role: 'reference' },
  { id: 'product-a', assetId: 'asset-a', url: '/a.png', name: '重复图', role: 'reference' },
];

test('image mentions use role-aware canonical names instead of raw filenames', () => {
  assert.deepEqual(buildImageMentions(assets), [
    {
      sourceNodeId: 'product-a',
      assetId: 'asset-a',
      url: '/a.png',
      name: '产品图1',
      role: 'product',
      label: '@产品图1',
      order: 0,
    },
    {
      sourceNodeId: 'reference-b',
      assetId: 'asset-b',
      url: '/b.png',
      name: '参考图1',
      role: 'reference',
      label: '@参考图1',
      order: 1,
    },
  ]);
});

test('toggling a mention preserves the remaining role order and relabels it deterministically', () => {
  const selected = buildImageMentions(assets.slice(0, 2));
  assert.deepEqual(toggleImageMention(selected, assets[0]).map(item => item.label), ['@参考图1']);
  assert.deepEqual(toggleImageMention(selected.slice(0, 1), assets[1]).map(item => item.label), ['@产品图1', '@参考图1']);
});

test('canvas image requests use the first mention as source and preserve later reference order', () => {
  assert.deepEqual(buildCanvasImageReferencePayload(buildImageMentions(assets)), {
    imageUrl: '/a.png',
    referenceImages: ['/b.png'],
    sourceNodeIds: ['product-a', 'reference-b'],
    references: [
      { sourceNodeId: 'product-a', assetId: 'asset-a', url: '/a.png', displayName: '产品图1', mention: '@产品图1', role: 'product', order: 0 },
      { sourceNodeId: 'reference-b', assetId: 'asset-b', url: '/b.png', displayName: '参考图1', mention: '@参考图1', role: 'reference', order: 1 },
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
      { sourceNodeId: 'product-a', assetId: 'asset-a', url: '/a.png', displayName: '产品图1', mention: '@产品图1', role: 'product', order: 0 },
      { sourceNodeId: 'reference-b', assetId: 'asset-b', url: '/b.png', displayName: '参考图1', mention: '@参考图1', role: 'reference', order: 1 },
      { sourceNodeId: 'product-c', assetId: '', url: '/c.png', displayName: '产品图2', mention: '@产品图2', role: 'product', order: 2 },
    ],
  });
});

test('canonical role labels remain readable and deterministic for duplicate assets', () => {
  assert.deepEqual(buildImageMentions([
    { id: 'a', url: '/a.png', name: '参考图' },
    { id: 'b', url: '/b.png', name: '参考图' },
  ]).map(item => item.label), ['@参考图1', '@参考图2']);
});

test('an image mention is inserted once with readable spacing', () => {
  assert.equal(appendImageMention('', '@参考图1'), '@参考图1 ');
  assert.equal(appendImageMention('保留杯身', '@参考图2'), '保留杯身 @参考图2 ');
  assert.equal(appendImageMention('参考 @参考图1 的构图', '@参考图1'), '参考 @参考图1 的构图');
});

test('an image mention is inserted at the saved cursor instead of always appending', () => {
  assert.deepEqual(insertImageMentionAt('请保留杯身颜色', '@产品图1', 1, 1), {
    value: '请 @产品图1 保留杯身颜色',
    caret: 8,
  });
  assert.deepEqual(insertImageMentionAt('参考旧图完成构图', '@参考图1', 2, 4), {
    value: '参考 @参考图1 完成构图',
    caret: 9,
  });
  assert.deepEqual(insertImageMentionAt('参考 @参考图1 的构图', '@参考图1', 0, 0), {
    value: '参考 @参考图1 的构图',
    caret: 0,
  });
});

test('removing an image mention only removes the selected token', () => {
  assert.equal(removeImageMention('保留 @参考图1 的主体，并参考 @参考图2', '@参考图1'), '保留 的主体，并参考 @参考图2');
  assert.equal(removeImageMention('@参考图1 @参考图2', '@参考图2'), '@参考图1');
  assert.equal(removeImageMention('没有引用图片', '@参考图1'), '没有引用图片');
});

test('plain image URLs become stable mention candidates for content creation', () => {
  assert.deepEqual(buildImageMentions(['/a.png', '/b.png']).map(item => ({ label: item.label, url: item.url })), [
    { label: '@参考图1', url: '/a.png' },
    { label: '@参考图2', url: '/b.png' },
  ]);
});
