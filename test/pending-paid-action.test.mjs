import test from 'node:test';
import assert from 'node:assert/strict';

import {
  clearPendingPaidAction,
  createPendingPaidAction,
  loadPendingPaidAction,
  savePendingPaidAction,
} from '../src/utils/pendingPaidAction.js';

function createStorage() {
  const values = new Map();
  return {
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, value); },
    removeItem(key) { values.delete(key); },
    has(key) { return values.has(key); },
  };
}

test('persists only serializable action references and excludes image payloads', () => {
  const storage = createStorage();
  const action = createPendingPaidAction({
    ownerEmail: ' Creator@Example.com ',
    source: 'ecommerce',
    route: '/ecommerce',
    draftId: 'draft-42',
    quoteId: 'quote-7',
    action: {
      type: 'ecommerce_generate',
      assetIds: ['asset-1'],
      imageFile: new Blob(['raw-image']),
      previewUrl: 'blob:https://shuimg.cn/temporary-preview',
      encodedImage: `data:image/png;base64,${'a'.repeat(256)}`,
      rawBase64: 'a'.repeat(256),
      callback: () => {},
    },
  }, { now: () => 1000 });

  assert.deepEqual(action, {
    version: 1,
    ownerEmail: 'creator@example.com',
    source: 'ecommerce',
    route: '/ecommerce',
    draftId: 'draft-42',
    action: { type: 'ecommerce_generate', assetIds: ['asset-1'] },
    quoteId: 'quote-7',
    createdAt: 1000,
  });

  savePendingPaidAction(action, { storage });
  assert.deepEqual(loadPendingPaidAction('CREATOR@example.com', { storage, now: () => 1001 }), action);
});

test('keeps encoded-looking human text and hashes while stripping only real image payloads or binary fields', () => {
  const longPrompt = 'Keep the product shape and typography accurate while using a warm studio scene. '.repeat(4);
  const longChinese = '保留商品真实结构、材质、中文包装和品牌标识，不要虚构参数。'.repeat(80);
  const standardBase64 = `iVBORw0KGgoAAAANSUhEUgAA${'A'.repeat(96)}`;
  const jpegBase64 = `/9j/4AAQSkZJRgABAQAAAQABAAD${'B'.repeat(96)}`;
  const urlSafeBase64 = `eyJpbWFnZSI6${'-_'.repeat(48)}`;
  const shortPngBase64 = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).toString('base64');
  const shortJpegBase64Url = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46])
    .toString('base64url');
  const shortWebpBase64 = Buffer.from('RIFF1234WEBP', 'ascii').toString('base64');
  const longNoPunctuation = 'ProductMaterialStructureAccuracy'.repeat(12);
  const sha256Text = '0123456789abcdef'.repeat(4);
  const stableAssetId = `${'a'.repeat(64)}.png`;
  const action = createPendingPaidAction({
    ownerEmail: 'creator@example.com',
    source: 'ecommerce',
    route: '/ecommerce',
    draftId: 'draft-long-text',
    action: {
      type: 'ecommerce_generate',
      prompt: longPrompt,
      notes: longPrompt,
      chineseCopy: longChinese,
      label: standardBase64,
      sku: urlSafeBase64,
      plainLabel: longNoPunctuation,
      checksum: sha256Text,
      imageId: stableAssetId,
      harmlessKey: jpegBase64,
      urlSafeValue: urlSafeBase64,
      shortPng: ` \n${shortPngBase64}\t `,
      shortJpegUrl: shortJpegBase64Url,
      shortWebp: shortWebpBase64,
      embeddedData: `普通前缀 data:image/png;base64,${shortPngBase64} 普通后缀`,
      embeddedBlob: '普通前缀 blob:https://shuimg.cn/temporary-preview 普通后缀',
      imageData: standardBase64,
      raw_bytes: urlSafeBase64,
      buffer: standardBase64,
      objectUrl: 'https://example.com/temporary-object-reference',
      sourceImageBase64: standardBase64,
      preview_image_bytes: urlSafeBase64,
      uploadedFileBlob: standardBase64,
      nested: {
        text: longPrompt,
        blob: urlSafeBase64,
      },
    },
  }, { now: () => 1000 });

  assert.deepEqual(action.action, {
    type: 'ecommerce_generate',
    prompt: longPrompt,
    notes: longPrompt,
    chineseCopy: longChinese,
    sku: urlSafeBase64,
    plainLabel: longNoPunctuation,
    checksum: sha256Text,
    imageId: stableAssetId,
    urlSafeValue: urlSafeBase64,
    nested: { text: longPrompt },
  });
});

test('rejects complete data and blob URLs anywhere in text with surrounding whitespace', () => {
  const shortPngBase64 = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).toString('base64');
  const action = createPendingPaidAction({
    ownerEmail: 'creator@example.com',
    source: 'ecommerce',
    route: '/ecommerce',
    draftId: 'draft-whitespace-urls',
    action: {
      type: 'ecommerce_generate',
      preview: ` \n\tdata:image/png;base64,${'a'.repeat(64)} \r\n`,
      reference: '  blob:https://shuimg.cn/temporary-preview  ',
      embeddedPreview: `保留前缀 data:image/png;base64,${shortPngBase64} 保留后缀`,
      embeddedReference: '保留前缀 blob:https://shuimg.cn/temporary-preview 保留后缀',
      prompt: '  keep meaningful prompt whitespace  ',
    },
  }, { now: () => 1000 });

  assert.deepEqual(action.action, {
    type: 'ecommerce_generate',
    prompt: '  keep meaningful prompt whitespace  ',
  });
});

test('fails closed and clears records that are expired, malformed, version-mismatched, or owned by another user', () => {
  const storage = createStorage();
  const storageKey = 'shubao.pendingPaidAction.v1';
  const action = createPendingPaidAction({
    ownerEmail: 'owner@example.com', source: 'plog', route: '/plog', draftId: 'draft-1', action: { type: 'generate' },
  }, { now: () => 1 });

  savePendingPaidAction(action, { storage });
  assert.equal(loadPendingPaidAction('owner@example.com', { storage, now: () => 86_400_002 }), null);
  assert.equal(storage.has(storageKey), false);

  storage.setItem(storageKey, '{broken-json');
  assert.equal(loadPendingPaidAction('owner@example.com', { storage, now: () => 2 }), null);
  assert.equal(storage.has(storageKey), false);

  storage.setItem(storageKey, JSON.stringify({ ...action, version: 2 }));
  assert.equal(loadPendingPaidAction('owner@example.com', { storage, now: () => 2 }), null);
  assert.equal(storage.has(storageKey), false);

  savePendingPaidAction(action, { storage });
  assert.equal(loadPendingPaidAction('other@example.com', { storage, now: () => 2 }), null);
  assert.equal(storage.has(storageKey), false);

  clearPendingPaidAction({ storage });
  assert.equal(storage.has(storageKey), false);
});
