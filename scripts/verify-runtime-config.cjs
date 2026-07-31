const fs = require('node:fs');
const path = require('node:path');

const EXPECTED_RUNTIME_CONFIG = Object.freeze({
  IMAGE_PRIMARY_BASE_URL: 'https://task-api-1-cn.65535.space',
  IMAGE_OVERFLOW_BASE_URL: '',
  IMAGE_BASE_URL: '',
  IMAGE_AUTH_STRATEGY: 'bearer',
  IMAGE_PROVIDER_PROTOCOL: 'native-tasks',
  IMAGE_TASK_SUBMIT_PATH: '/v1/tasks',
  IMAGE_EDIT_PATH: '/v1/images/edits',
  IMAGE_TASK_PATH: '/v1/tasks/{id}',
  IMAGE_MODEL: 'gpt-image-2',
  MINI_BASE_URL: 'https://puppyrouter.com',
  MINI_MODEL: 'gpt-5.6-luna',
});

const REQUIRED_KEYS = Object.freeze(['IMAGE_API_KEY', 'MINI_API_KEY']);
const PLACEHOLDER_RE = /(?:your[-_ ]?key|example|placeholder|change[-_ ]?me|replace[-_ ]?me|x{3,})/i;

function parseEnv(source) {
  const parsed = {};
  const lines = String(source ?? '').replace(/^\uFEFF/, '').split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const trimmed = lines[index].trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = /^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(trimmed);
    if (!match) throw new Error(`invalid environment line ${index + 1}`);
    const [, key, rawValue] = match;
    if (Object.hasOwn(parsed, key)) throw new Error(`duplicate variable ${key}`);
    let value = rawValue.trim();
    if (value.length >= 2 && ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))) {
      value = value.slice(1, -1);
    }
    parsed[key] = value;
  }
  return parsed;
}

function validateRuntimeConfig(config) {
  for (const [key, expected] of Object.entries(EXPECTED_RUNTIME_CONFIG)) {
    if (config[key] !== expected) throw new Error(`${key} must match the production contract`);
  }
  for (const key of REQUIRED_KEYS) {
    const candidate = String(config[key] || '').trim();
    if (candidate.length < 24 || PLACEHOLDER_RE.test(candidate)) {
      throw new Error(`${key} is missing or looks like a placeholder`);
    }
  }
}

function validatePrivateMode(mode, fileName) {
  if ((mode & 0o077) !== 0) {
    throw new Error(`${fileName} permissions must not allow group or world access`);
  }
}

function readRuntimeConfig(filePath) {
  const absolutePath = path.resolve(filePath);
  const stat = fs.statSync(absolutePath);
  if (!stat.isFile()) throw new Error(`${path.basename(absolutePath)} is not a regular file`);
  if (process.platform !== 'win32') validatePrivateMode(stat.mode, path.basename(absolutePath));
  const config = parseEnv(fs.readFileSync(absolutePath, 'utf8'));
  validateRuntimeConfig(config);
  return { absolutePath, config };
}

function verifyRuntimeConfigFiles(primaryPath, peerPath) {
  const primary = readRuntimeConfig(primaryPath);
  if (!peerPath) return primary;
  const peer = readRuntimeConfig(peerPath);
  const comparableKeys = [...Object.keys(EXPECTED_RUNTIME_CONFIG), ...REQUIRED_KEYS];
  for (const key of comparableKeys) {
    if (primary.config[key] !== peer.config[key]) {
      throw new Error(`${key} differs between runtime config files`);
    }
  }
  return primary;
}

function run(argv) {
  const [primaryPath, flag, peerPath, ...rest] = argv;
  if (!primaryPath || rest.length || (flag && flag !== '--peer') || (flag === '--peer' && !peerPath)) {
    throw new Error('usage: node verify-runtime-config.cjs <runtime-env> [--peer <peer-env>]');
  }
  const verified = verifyRuntimeConfigFiles(primaryPath, peerPath);
  console.log(`Runtime gateway configuration passed: ${verified.absolutePath}`);
}

module.exports = {
  EXPECTED_RUNTIME_CONFIG,
  parseEnv,
  validatePrivateMode,
  validateRuntimeConfig,
  verifyRuntimeConfigFiles,
};

if (require.main === module) {
  try {
    run(process.argv.slice(2));
  } catch (error) {
    console.error(`Runtime gateway configuration failed: ${error.message}`);
    process.exitCode = 1;
  }
}
