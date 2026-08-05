import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const serverSourceUrl = new URL('../server/index.mjs', import.meta.url);

test('legacy image generation uses the configured native task adapter', async () => {
  const source = await readFile(serverSourceUrl, 'utf8');
  const start = source.indexOf('async function callImageAPI');
  const end = source.indexOf('// ============================================================', start + 1);
  const callImageApi = source.slice(start, end);

  assert.doesNotMatch(callImageApi, /\$\{IMG_BASE\}\/v1\/images\/generations/);
  assert.match(callImageApi, /ecommerceProviderAdapter\.submitEdit\(/);
  assert.match(callImageApi, /ecommerceProviderAdapter\.pollUntilReady\(/);
});
