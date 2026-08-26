import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/pages/Home/CreationShowcase.jsx', import.meta.url), 'utf8');

test('XHS showcase reuses the shared publish modal contract', () => {
  assert.match(source, /import NoteModal from '\.\.\/\.\.\/NoteModal\.jsx'/);
  assert.match(source, /body_text: getXhsPublishBody\(entry\)/);
  assert.match(source, /hashtags: Array\.isArray\(entry\.tags\)/);
  assert.match(source, /initialImageIndex=\{initialIndex\}/);
  assert.match(source, /creation-showcase-body creation-showcase-content-body/);
  assert.match(source, /ec-product-suite-showcase xhs-case-showcase/);
  assert.match(source, /<p>\{getXhsPublishBody\(source\)\}<\/p>/);
  assert.match(source, /subMode === 'plog'/);
  assert.match(source, /案例暂未入库/);
  assert.doesNotMatch(source, /creation-showcase-content-facts/);
  assert.doesNotMatch(source, /creation-showcase-content-tabs/);
});

test('XHS case images stream thumbnails so the real case is visible within 1-2s', () => {
  // 真实案例图走 /api/gallery-image 的 thumb 派生（服务端 w640 WebP，约百 KB、
  // 首跳 ~130ms，Cache-Control immutable），等价于公共 /images/.thumbs 缩略管线
  // 在画廊 API 图上的对应实现；封面 eager+high 保证首屏 1-2s 可见，其余懒加载。
  const img = source.match(/<ResponsiveImage className="creation-showcase-content-image-media"[^>]*>/)?.[0] || '';
  assert.match(img, /src=\{page\.src\}/);
  assert.match(img, /variant="thumb"/);
  assert.match(img, /priority=\{page\.index === 0\}/);
  assert.match(img, /loading=\{page\.index === 0 \? 'eager' : 'lazy'\}/);
  assert.match(img, /fetchPriority=\{page\.index === 0 \? 'high' : 'auto'\}/);
});
