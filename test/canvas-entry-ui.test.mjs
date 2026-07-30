import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('empty commerce canvas guides a seller to upload product originals or import works', async () => {
  const source = await readFile(new URL('../src/pages/EcCanvas/index.jsx', import.meta.url), 'utf8');
  assert.match(source, /双击画布导入商品素材/);
  assert.match(source, /上传商品原图/);
  assert.match(source, /从我的作品导入/);
  assert.match(source, /sourceRole: 'product_original'/);
  assert.match(source, /onDoubleClick=\{[\s\S]*?sourceUploadRef/);
});
