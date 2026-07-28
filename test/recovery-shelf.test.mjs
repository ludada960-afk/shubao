import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

test('recovery shelf lists unfinished work but requires an explicit restore command', async () => {
  const source = await readFile(new URL('../src/pages/Home/ec/RecoveryShelf.jsx', import.meta.url), 'utf8');
  assert.match(source, /listRecoveryCheckpoints\(\)/);
  assert.match(source, /onClick=\{\(\) => restore\(checkpoint\)\}/);
  assert.match(source, /consumeRecoveryCheckpoint\(checkpoint\.id\)/);
  assert.doesNotMatch(source, /useEffect\(\(\) => \{[^}]*consumeRecoveryCheckpoint/s);
});

test('home exposes the shelf outside either creation form', async () => {
  const source = await readFile(new URL('../src/pages/Home/index.jsx', import.meta.url), 'utf8');
  assert.match(source, /<RecoveryShelf/);
  assert.match(source, /onRestore=/);
  const editor = await readFile(new URL('../src/pages/Home/EcMode.jsx', import.meta.url), 'utf8');
  assert.match(editor, /restoreCheckpointIntoEditor\(recoveryCheckpoint\)/);
  const xhs = await readFile(new URL('../src/pages/Home/XhsContentMode.jsx', import.meta.url), 'utf8');
  assert.match(xhs, /recoveryCheckpoint\?\.project\?\.kind/);
});
