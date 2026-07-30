import test from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  configureRuntimeFiles,
  renderRuntimeConfig,
  validateSecretPayload,
} = require('../scripts/configure-runtime-gateways.cjs');
const {
  EXPECTED_RUNTIME_CONFIG,
  parseEnv,
  verifyRuntimeConfigFiles,
} = require('../scripts/verify-runtime-config.cjs');

const SECRETS = Object.freeze({
  IMAGE_API_KEY: 'sk-image-test-key-that-is-long-enough',
  MINI_API_KEY: 'vision-test-key-that-is-long-enough',
});

test('runtime updater preserves unrelated values and writes the exact gateway contract', () => {
  const source = '# existing\nPORT=3001\nIMAGE_PRIMARY_BASE_URL=https://old.example\nIMAGE_API_KEY=old-secret-that-is-long-enough\n';
  const rendered = renderRuntimeConfig(source, validateSecretPayload(SECRETS));
  const parsed = parseEnv(rendered);

  assert.equal(parsed.PORT, '3001');
  assert.deepEqual(
    Object.fromEntries(Object.keys(EXPECTED_RUNTIME_CONFIG).map(key => [key, parsed[key]])),
    EXPECTED_RUNTIME_CONFIG,
  );
  assert.equal(parsed.IMAGE_API_KEY, SECRETS.IMAGE_API_KEY);
  assert.equal(parsed.MINI_API_KEY, SECRETS.MINI_API_KEY);
  assert.match(rendered, /^# existing/m);
});

test('runtime updater rejects malformed or line-breaking secrets', () => {
  assert.throws(() => validateSecretPayload({ ...SECRETS, IMAGE_API_KEY: 'short' }), /IMAGE_API_KEY/i);
  assert.throws(
    () => validateSecretPayload({ ...SECRETS, MINI_API_KEY: `${SECRETS.MINI_API_KEY}\nINJECTED=yes` }),
    /MINI_API_KEY/i,
  );
});

test('runtime updater writes both files privately and leaves them verifier-ready', () => {
  const directory = mkdtempSync(join(tmpdir(), 'shubao-runtime-update-'));
  const primary = join(directory, '.env');
  const peer = join(directory, 'server.env');
  try {
    writeFileSync(primary, 'PORT=3001\n', { mode: 0o644 });
    writeFileSync(peer, 'PORT=3001\n', { mode: 0o644 });
    chmodSync(primary, 0o644);
    chmodSync(peer, 0o644);

    configureRuntimeFiles([primary, peer], SECRETS);

    assert.doesNotThrow(() => verifyRuntimeConfigFiles(primary, peer));
    assert.equal(parseEnv(readFileSync(primary, 'utf8')).PORT, '3001');
    if (process.platform !== 'win32') {
      assert.equal(statSync(primary).mode & 0o077, 0);
      assert.equal(statSync(peer).mode & 0o077, 0);
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
