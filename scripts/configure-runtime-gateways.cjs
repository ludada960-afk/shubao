const fs = require('node:fs');
const path = require('node:path');

const {
  EXPECTED_RUNTIME_CONFIG,
  parseEnv,
  validateRuntimeConfig,
  verifyRuntimeConfigFiles,
} = require('./verify-runtime-config.cjs');

const SECRET_KEYS = Object.freeze(['IMAGE_API_KEY', 'MINI_API_KEY', 'NANO_BANANA_API_KEY', 'VIDEO_API_KEY']);
const OPTIONAL_SECRET_KEYS = Object.freeze(['MINIMAX_VIDEO_API_KEY']);
const MAX_STDIN_BYTES = 16 * 1024;

function validateSecretPayload(payload) {
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('runtime secret payload must be an object');
  }
  const keys = Object.keys(payload).sort();
  const allowed = [...SECRET_KEYS, ...OPTIONAL_SECRET_KEYS].sort();
  if (keys.some(key => !allowed.includes(key)) || SECRET_KEYS.some(key => !keys.includes(key))) {
    throw new Error('runtime secret payload has unexpected fields');
  }
  for (const key of [...SECRET_KEYS, ...OPTIONAL_SECRET_KEYS]) {
    if (!Object.hasOwn(payload, key)) continue;
    const value = payload[key];
    if (typeof value !== 'string' || /[\r\n\0]/.test(value)) {
      throw new Error(`${key} is invalid`);
    }
  }
  const values = { ...EXPECTED_RUNTIME_CONFIG, ...payload };
  validateRuntimeConfig(values);
  return values;
}

function validateVisionSecretPayload(payload) {
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('runtime secret payload must be an object');
  }
  const keys = Object.keys(payload).sort();
  if (keys.length !== 1 || keys[0] !== 'MINI_API_KEY') {
    throw new Error('runtime secret payload has unexpected fields');
  }
  if (typeof payload.MINI_API_KEY !== 'string' || /[\r\n\0]/.test(payload.MINI_API_KEY)) {
    throw new Error('MINI_API_KEY is invalid');
  }
  return { miniApiKey: payload.MINI_API_KEY };
}

function validatePartialSecretPayload(payload) {
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('runtime secret payload must be an object');
  }
  const keys = Object.keys(payload);
  if (!keys.length || keys.some(key => ![...SECRET_KEYS, ...OPTIONAL_SECRET_KEYS].includes(key))) {
    throw new Error('runtime secret payload has unexpected fields');
  }
  for (const key of keys) {
    if (typeof payload[key] !== 'string' || /[\r\n\0]/.test(payload[key])) {
      throw new Error(`${key} is invalid`);
    }
  }
  return payload;
}

function renderRuntimeConfig(source, values) {
  parseEnv(source);
  const pending = new Map(Object.entries(values));
  const lines = String(source ?? '').replace(/^\uFEFF/, '').split(/\r?\n/);
  const rendered = lines.map((line) => {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/.exec(line);
    if (!match || !pending.has(match[1])) return line;
    const key = match[1];
    const value = pending.get(key);
    pending.delete(key);
    return `${key}=${value}`;
  });
  while (rendered.length && rendered[rendered.length - 1] === '') rendered.pop();
  if (pending.size) {
    if (rendered.length) rendered.push('');
    for (const [key, value] of pending) rendered.push(`${key}=${value}`);
  }
  return `${rendered.join('\n')}\n`;
}

function writePrivateAtomic(filePath, content) {
  const absolutePath = path.resolve(filePath);
  const temporaryPath = path.join(
    path.dirname(absolutePath),
    `.${path.basename(absolutePath)}.gateway-${process.pid}-${Date.now()}.tmp`,
  );
  try {
    fs.writeFileSync(temporaryPath, content, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
    fs.chmodSync(temporaryPath, 0o600);
    fs.renameSync(temporaryPath, absolutePath);
  } finally {
    fs.rmSync(temporaryPath, { force: true });
  }
}

function configureRuntimeFiles(filePaths, payload) {
  if (!Array.isArray(filePaths) || filePaths.length !== 2) {
    throw new Error('exactly two runtime config files are required');
  }
  const values = validateSecretPayload(payload);
  const originals = filePaths.map(filePath => ({
    filePath: path.resolve(filePath),
    source: fs.readFileSync(path.resolve(filePath), 'utf8'),
  }));
  const updates = originals.map(entry => ({
    ...entry,
    next: renderRuntimeConfig(entry.source, values),
  }));
  try {
    for (const update of updates) writePrivateAtomic(update.filePath, update.next);
    verifyRuntimeConfigFiles(updates[0].filePath, updates[1].filePath);
  } catch (error) {
    const rollbackErrors = [];
    for (const original of originals) {
      try {
        writePrivateAtomic(original.filePath, original.source);
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError);
      }
    }
    if (rollbackErrors.length) throw new Error('runtime configuration failed and rollback was incomplete');
    throw error;
  }
}

function configureRuntimeFilesFromExisting(filePaths) {
  if (!Array.isArray(filePaths) || filePaths.length !== 2) {
    throw new Error('exactly two runtime config files are required');
  }
  const configs = filePaths.map(filePath => parseEnv(fs.readFileSync(path.resolve(filePath), 'utf8')));
  const payload = {};
  for (const key of SECRET_KEYS) {
    if (configs[0][key] !== configs[1][key]) {
      throw new Error(`${key} differs between runtime config files`);
    }
    payload[key] = configs[0][key];
  }
  for (const key of OPTIONAL_SECRET_KEYS) {
    if ((configs[0][key] || '') !== (configs[1][key] || '')) {
      throw new Error(`${key} differs between runtime config files`);
    }
    if (configs[0][key] !== undefined) payload[key] = configs[0][key];
  }
  validateSecretPayload(payload);
  configureRuntimeFiles(filePaths, payload);
}

function replaceVisionSecret(filePaths, payload) {
  if (!Array.isArray(filePaths) || filePaths.length !== 2) {
    throw new Error('exactly two runtime config files are required');
  }
  const { miniApiKey } = validateVisionSecretPayload(payload);
  replaceRuntimeSecrets(filePaths, { MINI_API_KEY: miniApiKey });
}

function replaceRuntimeSecrets(filePaths, payload) {
  if (!Array.isArray(filePaths) || filePaths.length !== 2) {
    throw new Error('exactly two runtime config files are required');
  }
  const replacements = validatePartialSecretPayload(payload);
  const configs = filePaths.map(filePath => parseEnv(fs.readFileSync(path.resolve(filePath), 'utf8')));
  const secrets = {};
  for (const key of [...SECRET_KEYS, ...OPTIONAL_SECRET_KEYS]) {
    if (Object.hasOwn(replacements, key)) {
      secrets[key] = replacements[key];
      continue;
    }
    if (configs[0][key] !== configs[1][key]) {
      throw new Error(`${key} differs between runtime config files`);
    }
    if (configs[0][key] !== undefined) secrets[key] = configs[0][key];
  }
  configureRuntimeFiles(filePaths, secrets);
}

async function readStdin() {
  process.stdin.setEncoding('utf8');
  let source = '';
  for await (const chunk of process.stdin) {
    source += chunk;
    if (Buffer.byteLength(source, 'utf8') > MAX_STDIN_BYTES) {
      throw new Error('runtime secret payload is too large');
    }
  }
  return source;
}

async function run(argv) {
  const [primaryPath, flag, peerPath, mode, ...rest] = argv;
  if (!primaryPath || flag !== '--peer' || !peerPath || rest.length
    || (mode && !['--retain-secrets', '--replace-vision-key', '--replace-secrets'].includes(mode))) {
    throw new Error('usage: node configure-runtime-gateways.cjs <runtime-env> --peer <peer-env> [--retain-secrets|--replace-vision-key|--replace-secrets]');
  }
  if (mode === '--retain-secrets') {
    configureRuntimeFilesFromExisting([primaryPath, peerPath]);
    console.log('Runtime gateway contract migrated while retaining existing secrets');
    return;
  }
  let payload;
  try {
    payload = JSON.parse(await readStdin());
  } catch (error) {
    if (error?.message === 'runtime secret payload is too large') throw error;
    throw new Error('runtime secret payload is not valid JSON');
  }
  if (mode === '--replace-vision-key') {
    replaceVisionSecret([primaryPath, peerPath], payload);
    console.log('Runtime vision gateway configuration updated for both environment files');
    return;
  }
  if (mode === '--replace-secrets') {
    replaceRuntimeSecrets([primaryPath, peerPath], payload);
    console.log('Runtime gateway secrets updated for both environment files');
    return;
  }
  configureRuntimeFiles([primaryPath, peerPath], payload);
  console.log('Runtime gateway configuration updated for both environment files');
}

module.exports = {
  configureRuntimeFiles,
  configureRuntimeFilesFromExisting,
  replaceRuntimeSecrets,
  replaceVisionSecret,
  renderRuntimeConfig,
  validateSecretPayload,
  OPTIONAL_SECRET_KEYS,
};

if (require.main === module) {
  run(process.argv.slice(2)).catch((error) => {
    console.error(`Runtime gateway configuration failed: ${error.message}`);
    process.exitCode = 1;
  });
}
