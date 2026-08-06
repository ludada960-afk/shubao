import fs from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createSessionTokenService } from '../server/billing/contentBilling.mjs';
import { verifyProduction } from './verify-production-billing.mjs';
import { verifyProductionEcommerce } from './verify-production-ecommerce.mjs';

const DEFAULT_BASE_URL = 'https://shuimg.cn';
const DEFAULT_OWNER_EMAIL = '867550189@qq.com';

function clean(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function readEnvFile(filePath) {
  try {
    const values = {};
    for (const line of fs.readFileSync(filePath, 'utf8').split('\n')) {
      const match = line.match(/^\s*([^#\s=]+)\s*=\s*(.+)\s*$/);
      if (match) values[match[1]] = match[2].replace(/["']/g, '');
    }
    return values;
  } catch {
    return {};
  }
}

function runtimeSettings(appDir) {
  const rootEnv = readEnvFile(resolve(appDir, '.env'));
  const serverEnv = readEnvFile(resolve(appDir, 'server/.env'));
  const get = (name) => clean(process.env[name]) || clean(rootEnv[name]) || clean(serverEnv[name]);
  return {
    secret: get('AUTH_SESSION_SECRET'),
    secretFile: get('AUTH_SESSION_SECRET_FILE'),
    ownerEmail: get('SHUBAO_CANARY_EMAIL') || DEFAULT_OWNER_EMAIL,
  };
}

function existingSessionSecret(appDir, settings) {
  if (settings.secret) return settings.secret;
  const configuredPath = settings.secretFile
    ? resolve(appDir, settings.secretFile)
    : resolve(appDir, 'server/.auth-session-secret');
  try {
    const persisted = clean(fs.readFileSync(configuredPath, 'utf8'));
    if (persisted.length >= 32) return persisted;
  } catch {
    // A production canary must never create or replace a signing secret.
  }
  throw new Error('Production auth session secret is unavailable');
}

export async function verifyProductionCanary({
  appDir,
  baseUrl = DEFAULT_BASE_URL,
  fixturePath,
} = {}) {
  const root = clean(appDir);
  const fixture = clean(fixturePath);
  if (!root) throw new TypeError('appDir is required');
  if (!fixture) throw new TypeError('fixturePath is required');

  const settings = runtimeSettings(root);
  const secret = existingSessionSecret(root, settings);
  const session = createSessionTokenService({ secret }).issue(settings.ownerEmail);

  await verifyProduction({ baseUrl, sessionToken: session.token });
  const result = await verifyProductionEcommerce({ baseUrl, sessionToken: session.token, fixturePath: fixture });
  return { taskId: result.taskId, canvasSessionId: result.canvasSessionId };
}

function parseArguments(argv) {
  const options = { appDir: '', baseUrl: DEFAULT_BASE_URL, fixturePath: '' };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--app-dir') options.appDir = argv[++index] || '';
    if (argv[index] === '--base-url') options.baseUrl = argv[++index] || DEFAULT_BASE_URL;
    if (argv[index] === '--fixture-path') options.fixturePath = argv[++index] || '';
  }
  return options;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  verifyProductionCanary(parseArguments(process.argv.slice(2))).catch(error => {
    console.error(error?.stack || error);
    process.exitCode = 1;
  });
}
