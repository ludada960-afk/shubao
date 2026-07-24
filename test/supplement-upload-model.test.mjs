/**
 * supplementUploadModel 单元测试
 * 纯函数测试，不依赖浏览器环境
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getNextProductImageSuggestion,
  getNextReferenceImageSuggestion,
  normalizeSupplementImages,
  splitInheritedAndAddedImages,
  canRemoveSupplementImage,
  appendSupplementFiles,
  removeSupplementImage,
  getImageStatusLabel,
  validateImageFile,
  getUploadPlaceholderText,
  getSupplementStats,
  PRODUCT_IMAGE_SUGGESTIONS,
  REFERENCE_IMAGE_SUGGESTIONS,
} from '../src/pages/Home/ec/components/supplementUploadModel.js';

test('getNextProductImageSuggestion - 应该按顺序返回产品图建议', () => {
  assert.deepEqual(getNextProductImageSuggestion(0), PRODUCT_IMAGE_SUGGESTIONS[0]);
  assert.deepEqual(getNextProductImageSuggestion(1), PRODUCT_IMAGE_SUGGESTIONS[1]);
  assert.deepEqual(getNextProductImageSuggestion(5), PRODUCT_IMAGE_SUGGESTIONS[5]);
});

test('getNextProductImageSuggestion - 超出范围应该返回 null', () => {
  assert.equal(getNextProductImageSuggestion(6), null);
  assert.equal(getNextProductImageSuggestion(10), null);
});

test('getNextReferenceImageSuggestion - 应该按顺序返回参考图建议', () => {
  assert.deepEqual(getNextReferenceImageSuggestion(0), REFERENCE_IMAGE_SUGGESTIONS[0]);
  assert.deepEqual(getNextReferenceImageSuggestion(2), REFERENCE_IMAGE_SUGGESTIONS[2]);
});

test('getNextReferenceImageSuggestion - 超出范围应该返回 null', () => {
  assert.equal(getNextReferenceImageSuggestion(5), null);
});

test('normalizeSupplementImages - 应该处理字符串 URL 数组', () => {
  const images = ['http://example.com/1.jpg', 'http://example.com/2.jpg'];
  const result = normalizeSupplementImages(images, { sourceType: 'product', isInherited: true });

  assert.equal(result.length, 2);
  assert.equal(result[0].url, 'http://example.com/1.jpg');
  assert.equal(result[0].sourceType, 'product');
  assert.equal(result[0].isInherited, true);
  assert.equal(result[0].isAdded, false);
  assert.ok(result[0].id);
});

test('normalizeSupplementImages - 应该处理对象数组', () => {
  const images = [
    { url: 'http://example.com/1.jpg', id: 'img-1' },
    { url: 'http://example.com/2.jpg' },
  ];
  const result = normalizeSupplementImages(images);

  assert.equal(result[0].id, 'img-1');
  assert.ok(result[1].id);
});

test('normalizeSupplementImages - 应该处理空值', () => {
  assert.deepEqual(normalizeSupplementImages(null), []);
  assert.deepEqual(normalizeSupplementImages(undefined), []);
  assert.deepEqual(normalizeSupplementImages('string'), []);
});

test('normalizeSupplementImages - 应该保留 file 对象', () => {
  const mockFile = { name: 'test.jpg', size: 1024 };
  const images = [{ url: 'blob:test', file: mockFile }];
  const result = normalizeSupplementImages(images);

  assert.equal(result[0].file, mockFile);
});

test('splitInheritedAndAddedImages - 应该正确分离继承和新增图片', () => {
  const images = [
    { id: '1', isInherited: true },
    { id: '2', isAdded: true },
    { id: '3', isInherited: false, isAdded: true },
    { id: '4', inherited: true },
  ];

  const result = splitInheritedAndAddedImages(images);

  assert.equal(result.inherited.length, 2);
  assert.equal(result.added.length, 2);
});

test('splitInheritedAndAddedImages - 应该处理空数组', () => {
  const result = splitInheritedAndAddedImages([]);
  assert.deepEqual(result.inherited, []);
  assert.deepEqual(result.added, []);
});

test('splitInheritedAndAddedImages - 应该处理非数组输入', () => {
  const result = splitInheritedAndAddedImages(null);
  assert.deepEqual(result.inherited, []);
  assert.deepEqual(result.added, []);
});

test('canRemoveSupplementImage - 继承的图片不能删除', () => {
  assert.equal(canRemoveSupplementImage({ isInherited: true }), false);
  assert.equal(canRemoveSupplementImage({ inherited: true }), false);
});

test('canRemoveSupplementImage - 新增的图片可以删除', () => {
  assert.equal(canRemoveSupplementImage({ isAdded: true }), true);
  assert.equal(canRemoveSupplementImage({ added: true }), true);
});

test('canRemoveSupplementImage - 未标记的图片默认可以删除', () => {
  assert.equal(canRemoveSupplementImage({ id: '1' }), true);
});

test('canRemoveSupplementImage - 空值不能删除', () => {
  assert.equal(canRemoveSupplementImage(null), false);
  assert.equal(canRemoveSupplementImage(undefined), false);
});

test('getImageStatusLabel - 应该返回已带入标签', () => {
  assert.equal(getImageStatusLabel({ isInherited: true }), '已带入');
  assert.equal(getImageStatusLabel({ inherited: true }), '已带入');
});

test('getImageStatusLabel - 应该返回本轮新增标签', () => {
  assert.equal(getImageStatusLabel({ isAdded: true }), '本轮新增');
  assert.equal(getImageStatusLabel({ added: true }), '本轮新增');
});

test('getImageStatusLabel - 无状态返回 null', () => {
  assert.equal(getImageStatusLabel({ id: '1' }), null);
  assert.equal(getImageStatusLabel(null), null);
});

test('validateImageFile - 应该验证通过有效的图片', () => {
  const file = { name: 'test.jpg', type: 'image/jpeg', size: 1024 * 1024 };
  const result = validateImageFile(file);

  assert.equal(result.valid, true);
  assert.equal(result.error, undefined);
});

test('validateImageFile - 应该拒绝不支持的格式', () => {
  const file = { name: 'test.gif', type: 'image/gif', size: 1024 };
  const result = validateImageFile(file);

  assert.equal(result.valid, false);
  assert.ok(result.error.includes('不支持的文件格式'));
});

test('validateImageFile - 应该拒绝过大的文件', () => {
  const file = { name: 'test.jpg', type: 'image/jpeg', size: 20 * 1024 * 1024 };
  const result = validateImageFile(file, { maxSize: 10 * 1024 * 1024 });

  assert.equal(result.valid, false);
  assert.ok(result.error.includes('文件过大'));
});

test('validateImageFile - 应该处理空文件', () => {
  const result = validateImageFile(null);
  assert.equal(result.valid, false);
  assert.equal(result.error, '文件不存在');
});

test('getUploadPlaceholderText - 产品图占位符', () => {
  assert.equal(getUploadPlaceholderText(0, 'product'), '上传产品主图');
  assert.ok(getUploadPlaceholderText(1, 'product').includes('建议:'));
});

test('getUploadPlaceholderText - 参考图占位符', () => {
  assert.equal(getUploadPlaceholderText(0, 'reference'), '上传参考图（可选）');
  assert.ok(getUploadPlaceholderText(1, 'reference').includes('建议:'));
});

test('getUploadPlaceholderText - 超出建议范围', () => {
  assert.equal(getUploadPlaceholderText(10, 'product'), '继续添加产品图');
});

test('getSupplementStats - 应该正确统计图片数量', () => {
  const productImages = [
    { isInherited: true },
    { isAdded: true },
    { isAdded: true },
  ];
  const referenceImages = [
    { isInherited: true },
  ];

  const stats = getSupplementStats(productImages, referenceImages);

  assert.equal(stats.product.total, 3);
  assert.equal(stats.product.inherited, 1);
  assert.equal(stats.product.added, 2);
  assert.equal(stats.reference.total, 1);
  assert.equal(stats.total, 4);
});

test('getSupplementStats - 应该处理空数组', () => {
  const stats = getSupplementStats([], []);

  assert.equal(stats.product.total, 0);
  assert.equal(stats.reference.total, 0);
  assert.equal(stats.total, 0);
});

test('getSupplementStats - 应该处理 null', () => {
  const stats = getSupplementStats(null, null);

  assert.equal(stats.product.total, 0);
  assert.equal(stats.total, 0);
});

// 注意：appendSupplementFiles 和 removeSupplementImage 涉及 URL.createObjectURL
// 这些测试需要在有 DOM 环境的测试框架中运行，或者需要 mock
test('appendSupplementFiles - 应该追加文件到列表', () => {
  const existing = [{ id: '1', url: 'test.jpg' }];
  const files = [{ name: 'new.jpg' }, { name: 'new2.jpg' }];

  const result = appendSupplementFiles(existing, files, { sourceType: 'product' });

  assert.equal(result.length, 3);
  assert.equal(result[0].id, '1');
});

test('appendSupplementFiles - 空文件应该返回原数组', () => {
  const existing = [{ id: '1' }];
  const result = appendSupplementFiles(existing, [], { sourceType: 'product' });

  assert.equal(result, existing);
});

test('removeSupplementImage - 应该删除可删除的图片', () => {
  const images = [
    { id: '1', isAdded: true },
    { id: '2', isAdded: true },
  ];

  const result = removeSupplementImage(images, '1');

  assert.equal(result.length, 1);
  assert.equal(result[0].id, '2');
});

test('removeSupplementImage - 不能删除继承的图片', () => {
  const images = [
    { id: '1', isInherited: true },
    { id: '2', isAdded: true },
  ];

  const result = removeSupplementImage(images, '1');

  assert.equal(result.length, 2);
});

test('removeSupplementImage - 应该处理不存在的图片', () => {
  const images = [{ id: '1', isAdded: true }];
  const result = removeSupplementImage(images, '999');

  assert.equal(result.length, 1);
});
