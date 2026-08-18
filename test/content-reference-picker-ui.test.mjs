import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

test('content reference picker exposes semantic style and source slots', async () => {
  const source = await fs.readFile(new URL('../src/components/creation/ContentReferencePicker.jsx', import.meta.url), 'utf8');
  assert.match(source, /风格参考/);
  assert.match(source, /我的素材|生活素材/);
  assert.match(source, /styleMax/);
  assert.match(source, /sourceMax/);
  assert.match(source, /multiple/);
  assert.match(source, /onRemove/);
});

test('XHS and Plog pages use grouped reference assets instead of a single Plog image', async () => {
  const [home, standalone] = await Promise.all([
    fs.readFile(new URL('../src/pages/Home/XhsContentMode.jsx', import.meta.url), 'utf8'),
    fs.readFile(new URL('../src/pages/Plog/index.jsx', import.meta.url), 'utf8'),
  ]);
  assert.match(home, /ContentReferencePicker/);
  assert.match(home, /referenceAssets/);
  assert.match(standalone, /ContentReferencePicker/);
  assert.match(standalone, /referenceAssets/);
  assert.doesNotMatch(home, /最多 1 张/);
});
