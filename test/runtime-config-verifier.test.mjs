import test from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  EXPECTED_RUNTIME_CONFIG,
  parseEnv,
  validatePrivateMode,
  validateRuntimeConfig,
  verifyRuntimeConfigFiles,
} = require('../scripts/verify-runtime-config.cjs');

const VALID_SECRETS = {
  IMAGE_API_KEY: 'sk-image-test-key-that-is-long-enough',
  MINI_API_KEY: 'opaque-vision-key-that-is-long-enough',
  FAL_KEY: 'fal-segmentation-key-that-is-long-enough',
};

function envText(overrides = {}) {
  return Object.entries({
    ...EXPECTED_RUNTIME_CONFIG,
    ...VALID_SECRETS,
    ...overrides,
  }).map(([key, value]) => `${key}=${value}`).join('\n');
}

test('runtime config parser supports comments and quoted values but rejects duplicates', () => {
  assert.deepEqual(parseEnv('# comment\nFOO="bar"\nEMPTY=\n'), { FOO: 'bar', EMPTY: '' });
  assert.throws(() => parseEnv('FOO=one\nFOO=two\n'), /duplicate variable FOO/i);
});

test('runtime config validator accepts only the target gateway contract', () => {
  assert.doesNotThrow(() => validateRuntimeConfig(parseEnv(envText())));
  assert.throws(
    () => validateRuntimeConfig(parseEnv(envText({ MINI_MODEL: 'gpt-5.5' }))),
    /MINI_MODEL must match the production contract/i,
  );
  assert.throws(
    () => validateRuntimeConfig(parseEnv(envText({ IMAGE_PROVIDER_PROTOCOL: 'legacy-edits' }))),
    /IMAGE_PROVIDER_PROTOCOL must match the production contract/i,
  );
  assert.throws(
    () => validateRuntimeConfig(parseEnv(envText({ IMAGE_API_KEY: 'sk-your-key-here' }))),
    /IMAGE_API_KEY is missing or looks like a placeholder/i,
  );
  assert.doesNotThrow(
    () => validateRuntimeConfig(parseEnv(envText({ MINI_API_KEY: 'vision-test-key-that-is-long-enough' }))),
  );
  assert.throws(
    () => validateRuntimeConfig(parseEnv(envText({ FAL_KEY: '' }))),
    /FAL_KEY is missing or looks like a placeholder/i,
  );
});

test('runtime config permission validator rejects group or world access', () => {
  assert.doesNotThrow(() => validatePrivateMode(0o100600, '.env'));
  assert.throws(() => validatePrivateMode(0o100640, '.env'), /permissions must not allow group or world access/i);
  assert.throws(() => validatePrivateMode(0o100604, '.env'), /permissions must not allow group or world access/i);
});

test('runtime config file verification requires private permissions and matching peers', () => {
  const directory = mkdtempSync(join(tmpdir(), 'shubao-runtime-config-'));
  const primary = join(directory, '.env');
  const peer = join(directory, 'server.env');
  try {
    writeFileSync(primary, envText(), { mode: 0o600 });
    writeFileSync(peer, envText(), { mode: 0o600 });
    chmodSync(primary, 0o600);
    chmodSync(peer, 0o600);
    assert.doesNotThrow(() => verifyRuntimeConfigFiles(primary, peer));

    if (process.platform !== 'win32') {
      chmodSync(peer, 0o644);
      assert.throws(() => verifyRuntimeConfigFiles(primary, peer), /permissions must not allow group or world access/i);
      chmodSync(peer, 0o600);
    }
    writeFileSync(peer, envText({ MINI_API_KEY: 'sk-different-vision-key-that-is-long-enough' }), { mode: 0o600 });
    assert.throws(() => verifyRuntimeConfigFiles(primary, peer), /MINI_API_KEY differs between runtime config files/i);
    writeFileSync(peer, envText({ FAL_KEY: 'fal-different-key-that-is-long-enough' }), { mode: 0o600 });
    assert.throws(() => verifyRuntimeConfigFiles(primary, peer), /FAL_KEY differs between runtime config files/i);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
