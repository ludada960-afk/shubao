import test from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  configureRuntimeFiles,
  configureRuntimeFilesFromExisting,
  replaceRuntimeSecrets,
  replaceVisionSecret,
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
  MINI_API_KEY: 'opaque-vision-key-that-is-long-enough',
  NANO_BANANA_API_KEY: 'sk-nano-test-key-that-is-long-enough',
  VIDEO_API_KEY: 'sk-video-test-key-that-is-long-enough',
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
  assert.equal(parsed.NANO_BANANA_API_KEY, SECRETS.NANO_BANANA_API_KEY);
  assert.equal(parsed.VIDEO_API_KEY, SECRETS.VIDEO_API_KEY);
  assert.match(rendered, /^# existing/m);
});

test('runtime updater rejects malformed or line-breaking secrets', () => {
  assert.throws(() => validateSecretPayload({ ...SECRETS, IMAGE_API_KEY: 'short' }), /IMAGE_API_KEY/i);
  assert.doesNotThrow(
    () => validateSecretPayload({ ...SECRETS, MINI_API_KEY: 'vision-test-key-that-is-long-enough' }),
  );
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

test('runtime updater migrates the gateway contract while retaining existing production secrets', () => {
  const directory = mkdtempSync(join(tmpdir(), 'shubao-runtime-migrate-'));
  const primary = join(directory, '.env');
  const peer = join(directory, 'server.env');
  const legacy = [
    'PORT=3001',
    'MINI_MODEL=gpt-5.5',
    `IMAGE_API_KEY=${SECRETS.IMAGE_API_KEY}`,
    `MINI_API_KEY=${SECRETS.MINI_API_KEY}`,
    `NANO_BANANA_API_KEY=${SECRETS.NANO_BANANA_API_KEY}`,
    `VIDEO_API_KEY=${SECRETS.VIDEO_API_KEY}`,
    '',
  ].join('\n');
  try {
    writeFileSync(primary, legacy, { mode: 0o600 });
    writeFileSync(peer, legacy, { mode: 0o600 });

    configureRuntimeFilesFromExisting([primary, peer]);

    const migrated = parseEnv(readFileSync(primary, 'utf8'));
    assert.doesNotThrow(() => verifyRuntimeConfigFiles(primary, peer));
    assert.equal(migrated.MINI_MODEL, 'gpt-5.6-luna');
    assert.equal(migrated.IMAGE_API_KEY, SECRETS.IMAGE_API_KEY);
    assert.equal(migrated.MINI_API_KEY, SECRETS.MINI_API_KEY);
    assert.equal(migrated.NANO_BANANA_API_KEY, SECRETS.NANO_BANANA_API_KEY);
    assert.equal(migrated.VIDEO_API_KEY, SECRETS.VIDEO_API_KEY);
    assert.equal(migrated.PORT, '3001');
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('runtime updater refuses to retain divergent peer secrets', () => {
  const directory = mkdtempSync(join(tmpdir(), 'shubao-runtime-divergent-'));
  const primary = join(directory, '.env');
  const peer = join(directory, 'server.env');
  try {
    writeFileSync(primary, `IMAGE_API_KEY=${SECRETS.IMAGE_API_KEY}\nMINI_API_KEY=${SECRETS.MINI_API_KEY}\nNANO_BANANA_API_KEY=${SECRETS.NANO_BANANA_API_KEY}\nVIDEO_API_KEY=${SECRETS.VIDEO_API_KEY}\n`, { mode: 0o600 });
    writeFileSync(peer, `IMAGE_API_KEY=${SECRETS.IMAGE_API_KEY}\nMINI_API_KEY=another-vision-key-that-is-long-enough\nNANO_BANANA_API_KEY=${SECRETS.NANO_BANANA_API_KEY}\nVIDEO_API_KEY=${SECRETS.VIDEO_API_KEY}\n`, { mode: 0o600 });

    assert.throws(
      () => configureRuntimeFilesFromExisting([primary, peer]),
      /MINI_API_KEY differs between runtime config files/i,
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('runtime updater replaces only the vision secret while retaining the image secret', () => {
  const directory = mkdtempSync(join(tmpdir(), 'shubao-runtime-vision-'));
  const primary = join(directory, '.env');
  const peer = join(directory, 'server.env');
  const legacy = [
    'PORT=3001',
    'MINI_BASE_URL=https://old-vision.example',
    'MINI_MODEL=gpt-5.5',
    `IMAGE_API_KEY=${SECRETS.IMAGE_API_KEY}`,
    `MINI_API_KEY=${SECRETS.MINI_API_KEY}`,
    `NANO_BANANA_API_KEY=${SECRETS.NANO_BANANA_API_KEY}`,
    `VIDEO_API_KEY=${SECRETS.VIDEO_API_KEY}`,
    '',
  ].join('\n');
  try {
    writeFileSync(primary, legacy, { mode: 0o600 });
    writeFileSync(peer, legacy, { mode: 0o600 });

    replaceVisionSecret([primary, peer], { MINI_API_KEY: 'production-vision-key-that-is-long-enough' });

    const updated = parseEnv(readFileSync(primary, 'utf8'));
    assert.doesNotThrow(() => verifyRuntimeConfigFiles(primary, peer));
    assert.equal(updated.IMAGE_API_KEY, SECRETS.IMAGE_API_KEY);
    assert.equal(updated.MINI_API_KEY, 'production-vision-key-that-is-long-enough');
    assert.equal(updated.NANO_BANANA_API_KEY, SECRETS.NANO_BANANA_API_KEY);
    assert.equal(updated.VIDEO_API_KEY, SECRETS.VIDEO_API_KEY);
    assert.equal(updated.MINI_BASE_URL, 'https://api2.65535.space');
    assert.equal(updated.MINI_MODEL, 'gpt-5.6-luna');
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('vision-only replacement rejects unexpected fields and divergent image secrets', () => {
  const directory = mkdtempSync(join(tmpdir(), 'shubao-runtime-vision-divergent-'));
  const primary = join(directory, '.env');
  const peer = join(directory, 'server.env');
  try {
    writeFileSync(primary, `IMAGE_API_KEY=${SECRETS.IMAGE_API_KEY}\nMINI_API_KEY=${SECRETS.MINI_API_KEY}\nNANO_BANANA_API_KEY=${SECRETS.NANO_BANANA_API_KEY}\nVIDEO_API_KEY=${SECRETS.VIDEO_API_KEY}\n`, { mode: 0o600 });
    writeFileSync(peer, `IMAGE_API_KEY=another-image-key-that-is-long-enough\nMINI_API_KEY=another-vision-key-that-is-long-enough\nNANO_BANANA_API_KEY=${SECRETS.NANO_BANANA_API_KEY}\nVIDEO_API_KEY=${SECRETS.VIDEO_API_KEY}\n`, { mode: 0o600 });

    assert.throws(
      () => replaceVisionSecret([primary, peer], { MINI_API_KEY: 'production-vision-key-that-is-long-enough' }),
      /IMAGE_API_KEY differs between runtime config files/i,
    );
    assert.throws(
      () => replaceVisionSecret([primary, primary], { MINI_API_KEY: SECRETS.MINI_API_KEY, EXTRA: 'nope' }),
      /unexpected fields/i,
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('runtime updater can add only the Nano Banana secret while retaining peer secrets', () => {
  const directory = mkdtempSync(join(tmpdir(), 'shubao-runtime-nano-'));
  const primary = join(directory, '.env');
  const peer = join(directory, 'server.env');
  const legacy = `IMAGE_API_KEY=${SECRETS.IMAGE_API_KEY}\nMINI_API_KEY=${SECRETS.MINI_API_KEY}\nVIDEO_API_KEY=${SECRETS.VIDEO_API_KEY}\n`;
  try {
    writeFileSync(primary, legacy, { mode: 0o600 });
    writeFileSync(peer, legacy, { mode: 0o600 });
    replaceRuntimeSecrets([primary, peer], { NANO_BANANA_API_KEY: SECRETS.NANO_BANANA_API_KEY });
    const updated = parseEnv(readFileSync(primary, 'utf8'));
    assert.equal(updated.NANO_BANANA_API_KEY, SECRETS.NANO_BANANA_API_KEY);
    assert.doesNotThrow(() => verifyRuntimeConfigFiles(primary, peer));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
