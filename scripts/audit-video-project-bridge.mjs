import Database from 'better-sqlite3';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { auditLegacyVideoAssets } from '../server/videoProjectBridge.mjs';

function databasePath(argv) {
  const explicit = argv.find(value => value.startsWith('--db='))?.slice(5);
  return resolve(explicit || process.env.SHUBAO_DB_PATH || 'server/works.db');
}

const path = databasePath(process.argv.slice(2));
if (!existsSync(path)) {
  console.error(JSON.stringify({ mode: 'dry-run', ok: false, database: path, error: 'database_not_found' }, null, 2));
  process.exitCode = 2;
} else {
  const db = new Database(path, { readonly: true, fileMustExist: true });
  try {
    const report = auditLegacyVideoAssets(db);
    console.log(JSON.stringify({ ok: true, database: path, ...report }, null, 2));
    if (report.missingOwners || report.missingAssetReferences || report.unsupportedRows) process.exitCode = 1;
  } finally {
    db.close();
  }
}
