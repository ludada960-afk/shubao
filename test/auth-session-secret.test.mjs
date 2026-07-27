import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { resolveAuthSessionSecret } from '../server/authSessionSecret.mjs';

test('persists a generated session secret across process restarts', async t => {
  const directory = mkdtempSync(join(tmpdir(), 'shubao-auth-secret-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const filePath = join(directory, 'session-secret');

  const first = resolveAuthSessionSecret({ envSecret: '', filePath });
  const second = resolveAuthSessionSecret({ envSecret: '', filePath });

  assert.equal(first, second);
  assert.equal(first.length, 64);
  assert.equal(readFileSync(filePath, 'utf8').trim(), first);
});

test('uses the configured environment secret without writing a runtime file', () => {
  const configured = 'configured-auth-secret-with-at-least-32-bytes';
  assert.equal(resolveAuthSessionSecret({ envSecret: configured, filePath: 'unused' }), configured);
});
