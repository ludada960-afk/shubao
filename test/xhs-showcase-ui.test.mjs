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
