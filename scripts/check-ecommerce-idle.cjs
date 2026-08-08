const path = require('node:path');
const Database = require('better-sqlite3');

const dbPath = path.resolve(process.argv[2] || 'server/works.db');
const db = new Database(dbPath, { readonly: true, fileMustExist: true });
let exitCode = 0;

const checks = [
  {
    table: 'ecommerce_jobs',
    where: "status NOT IN ('completed', 'failed', 'cancelled', 'needs_review')",
  },
  {
    table: 'canvas_generation_jobs',
    where: "status NOT IN ('completed', 'failed')",
  },
  {
    table: 'content_generation_jobs',
    where: "status = 'processing'",
  },
  {
    table: 'tasks',
    // Pending legacy tasks can remain in the database after a browser closes.
    // Only a recently updated pending task can still be picked up by the old worker.
    where: "status = 'processing' OR (status = 'pending' AND updated_at >= datetime('now', '-15 minutes'))",
  },
];

try {
  const tableExists = db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?");
  const activeByTable = [];
  for (const check of checks) {
    if (!tableExists.get(check.table)) continue;
    const { active } = db.prepare(`SELECT COUNT(*) AS active FROM ${check.table} WHERE ${check.where}`).get();
    if (active > 0) {
      activeByTable.push(`${check.table}=${active}`);
    }
  }
  if (activeByTable.length) {
    process.stderr.write(`Waiting for active generation jobs before retiring the legacy process: ${activeByTable.join(', ')}.\n`);
    exitCode = 2;
  }
} finally {
  db.close();
}

process.exitCode = exitCode;
