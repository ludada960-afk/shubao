import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('Works list does not synchronously migrate every legacy ecommerce record', async () => {
  const source = await readFile(new URL('../server/index.mjs', import.meta.url), 'utf8');
  const listBlock = source.match(/listWorks:\s*ownerEmail\s*=>[\s\S]*?\n\s*listTrash:/)?.[0] || '';
  assert.match(listBlock, /getAllWorks\(\{ ownerEmail \}\)/);
  assert.doesNotMatch(listBlock, /migrateLegacyWorkOnRead/);
});
