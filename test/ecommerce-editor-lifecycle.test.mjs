import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

test('fresh ecommerce editor does not automatically restore or persist account-level form drafts', async () => {
  const source = await readFile(new URL('../src/pages/Home/EcMode.jsx', import.meta.url), 'utf8');

  assert.doesNotMatch(source, /loadDraftSnapshot\(/);
  assert.doesNotMatch(source, /loadDraftFiles\(/);
  assert.doesNotMatch(source, /saveDraftSnapshot\(/);
  assert.doesNotMatch(source, /saveDraftFiles\(/);
});
