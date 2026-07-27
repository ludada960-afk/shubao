import crypto from 'node:crypto';
import fs from 'node:fs';
import { dirname } from 'node:path';

function clean(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function readPersisted(filePath) {
  try {
    const value = clean(fs.readFileSync(filePath, 'utf8'));
    return value.length >= 32 ? value : '';
  } catch {
    return '';
  }
}

export function resolveAuthSessionSecret({ envSecret, filePath } = {}) {
  const configured = clean(envSecret);
  if (configured) return configured;
  const target = clean(filePath);
  if (!target) throw new TypeError('auth session secret file path is required');
  const persisted = readPersisted(target);
  if (persisted) return persisted;

  fs.mkdirSync(dirname(target), { recursive: true });
  const generated = crypto.randomBytes(32).toString('hex');
  try {
    fs.writeFileSync(target, `${generated}\n`, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
    return generated;
  } catch (error) {
    if (error?.code === 'EEXIST') {
      const concurrent = readPersisted(target);
      if (concurrent) return concurrent;
    }
    throw error;
  }
}
