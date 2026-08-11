import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

test('fresh ecommerce editor does not automatically restore or persist account-level form drafts', async () => {
  const source = await readFile(new URL('../src/pages/Home/EcMode.jsx', import.meta.url), 'utf8');
  const home = await readFile(new URL('../src/pages/Home/index.jsx', import.meta.url), 'utf8');

  assert.doesNotMatch(source, /loadDraftSnapshot\(/);
  assert.doesNotMatch(source, /loadDraftFiles\(/);
  assert.doesNotMatch(source, /saveDraftSnapshot\(/);
  assert.doesNotMatch(source, /saveDraftFiles\(/);
  assert.match(home, /clearLegacyEcommerceDraftState\(\)/);
});

test('direction confirmation keeps the current in-memory editor mounted for back navigation', async () => {
  const home = await readFile(new URL('../src/pages/Home/index.jsx', import.meta.url), 'utf8');

  assert.match(home, /ecStep === 2\s*&&\s*\(\s*<DesignDirection/);
  assert.match(home, /ecStep !== 2\s*&&\s*<div[\s\S]*homepage-mode-showcase/);
  assert.match(home, /isVideo\s*\?\s*<VideoStudioPage[\s\S]{0,700}isXHS\s*\?\s*<XhsContentMode[\s\S]{0,700}!isVisual\s*\?\s*\(\s*<EcMode/);
  assert.match(home, /display:\s*ecStep === 2\s*\?\s*['"]none['"]\s*:\s*undefined/);
});

test('content editors do not automatically restore or continuously persist prior form inputs', async () => {
  const [xhs, plog] = await Promise.all([
    readFile(new URL('../src/pages/Home/XhsContentMode.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/pages/Plog/index.jsx', import.meta.url), 'utf8'),
  ]);
  assert.doesNotMatch(xhs, /loadContentDraft\(/);
  assert.doesNotMatch(xhs, /saveContentDraft\(/);
  assert.doesNotMatch(plog, /loadContentDraft\(/);
  assert.doesNotMatch(plog, /saveContentDraft\(/);
});
