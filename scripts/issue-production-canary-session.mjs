import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

import { resolveAuthSessionSecret } from '../server/authSessionSecret.mjs';
import { createSessionTokenService } from '../server/billing/contentBilling.mjs';

function clean(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function readProcessEnvironment(processId) {
  if (!Number.isSafeInteger(processId) || processId <= 0) return {};
  const entries = fs.readFileSync(`/proc/${processId}/environ`).toString().split('\0');
  return Object.fromEntries(entries.flatMap(entry => {
    const separator = entry.indexOf('=');
    return separator > 0 ? [[entry.slice(0, separator), entry.slice(separator + 1)]] : [];
  }));
}

function readRootEnvironment(repoPath) {
  const filePath = path.join(repoPath, '.env');
  return fs.existsSync(filePath) ? dotenv.parse(fs.readFileSync(filePath)) : {};
}

export function issueProductionCanarySession({
  ownerEmail,
  processEnvironment = {},
  fallbackPath,
  now,
} = {}) {
  const secret = resolveAuthSessionSecret({
    envSecret: processEnvironment.AUTH_SESSION_SECRET,
    filePath: processEnvironment.AUTH_SESSION_SECRET_FILE || fallbackPath,
  });
  return createSessionTokenService({ secret, ...(now ? { now } : {}) }).issue(ownerEmail);
}

function parseArguments(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (!flag?.startsWith('--') || value === undefined) throw new TypeError('invalid canary issuer arguments');
    values[flag.slice(2)] = value;
  }
  const ownerEmail = clean(values['owner-email']);
  const repoPath = path.resolve(clean(values['repo-path']));
  const processId = Number(values['process-id']);
  if (!ownerEmail || !repoPath || !Number.isSafeInteger(processId) || processId <= 0) {
    throw new TypeError('owner email, repository path, and process id are required');
  }
  return { ownerEmail, repoPath, processId };
}

async function main() {
  const { ownerEmail, repoPath, processId } = parseArguments(process.argv.slice(2));
  const processEnvironment = {
    ...readRootEnvironment(repoPath),
    ...readProcessEnvironment(processId),
  };
  const configuredPath = clean(processEnvironment.AUTH_SESSION_SECRET_FILE);
  const fallbackPath = configuredPath
    ? path.resolve(repoPath, configuredPath)
    : path.join(repoPath, 'server', '.auth-session-secret');
  const issued = issueProductionCanarySession({ ownerEmail, processEnvironment, fallbackPath });
  process.stdout.write(issued.token);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  await main();
}
