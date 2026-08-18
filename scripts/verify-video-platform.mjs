import { existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import Database from 'better-sqlite3';

import { readVideoPlatformFlags } from '../server/config.mjs';
import { inspectVideoPlatform } from './backfill-video-platform.mjs';

export function verifyVideoPlatformDatabase(db, { noPaidGeneration = true } = {}) {
  const flags = readVideoPlatformFlags(process.env);
  const inspection = inspectVideoPlatform(db);
  const blockingIssues = [...inspection.blockingIssues];
  if (!noPaidGeneration) {
    blockingIssues.push({ code: 'PAID_GENERATION_GUARD_MISSING', message: 'verification must explicitly forbid paid generation' });
  }
  return {
    ok: blockingIssues.length === 0,
    paidGenerationRequested: false,
    providerSubmissions: 0,
    flags,
    counts: inspection.counts,
    blockingIssues,
  };
}

export function parseArguments(argv) {
  const databaseIndex = argv.indexOf('--database');
  return {
    local: argv.includes('--local'),
    noPaidGeneration: argv.includes('--no-paid-generation'),
    database: databaseIndex >= 0 ? argv[databaseIndex + 1] : process.env.SHUBAO_DB_PATH || 'server/works.db',
  };
}

export function runVideoPlatformVerification(options) {
  const databaseExists = existsSync(options.database);
  if (!options.local && !databaseExists) throw new Error(`Video platform database does not exist: ${options.database}`);
  const db = new Database(databaseExists ? options.database : ':memory:', { fileMustExist: databaseExists });
  try {
    return verifyVideoPlatformDatabase(db, options);
  } finally {
    db.close();
  }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  try {
    const report = runVideoPlatformVerification(parseArguments(process.argv.slice(2)));
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    if (!report.ok) process.exitCode = 1;
  } catch (error) {
    console.error(error?.stack || error);
    process.exitCode = 1;
  }
}
