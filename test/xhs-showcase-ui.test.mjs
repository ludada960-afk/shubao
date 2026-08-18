import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/pages/Home/CreationShowcase.jsx', import.meta.url), 'utf8');

test('XHS showcase exposes a full publish preview contract', () => {
  assert.match(source, /role="dialog"/);
  assert.match(source, /aria-modal="true"/);
  assert.match(source, /小红书发布预览/);
  assert.match(source, /完整正文/);
  assert.match(source, /上一张/);
  assert.match(source, /下一张/);
  assert.match(source, /Escape/);
});
