import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

test('the shared ecommerce workbench inserts real image mentions on home and step two', async () => {
  const workbench = await readFile(new URL('../src/pages/Home/ec/EcommerceWorkbench.jsx', import.meta.url), 'utf8');
  const direction = await readFile(new URL('../src/pages/Home/ec/DesignDirection.jsx', import.meta.url), 'utf8');

  assert.match(workbench, /ImageMentionPicker/);
  assert.match(workbench, /appendImageMention\(description, image\.label\)/);
  assert.match(workbench, /slot\.id === ['"]product['"] \? ['"]product['"]/);
  assert.match(workbench, /slot\.id === ['"]reference['"] \? ['"]reference['"]/);
  assert.match(direction, /<EcommerceWorkbench/);
});

test('Xiaohongshu and Plog prompts share the image mention picker', async () => {
  const source = await readFile(new URL('../src/pages/Home/XhsContentMode.jsx', import.meta.url), 'utf8');

  assert.match(source, /ImageMentionPicker/);
  assert.match(source, /appendImageMention\(inputText, image\.label\)/);
  assert.match(source, /appendImageMention\(plogText, image\.label\)/);
});
