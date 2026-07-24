import Database from 'better-sqlite3';
import crypto from 'node:crypto';

const STATES = new Set(['queued', 'analyzing', 'generating', 'completed', 'failed', 'cancelled']);
const TRANSITIONS = {
  queued: new Set(['analyzing', 'cancelled']),
  analyzing: new Set(['generating', 'failed', 'cancelled', 'queued']),
  generating: new Set(['completed', 'failed', 'cancelled', 'queued']),
  completed: new Set(),
  failed: new Set(['queued']),
  cancelled: new Set(),
};

function parse(value, fallback) {
  try { return value ? JSON.parse(value) : fallback; } catch { return fallback; }
}

export function createGenerationJobs(dbPath = ':memory:') {
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS ecommerce_jobs (
      id TEXT PRIMARY KEY,
      owner_email TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'queued',
      payload TEXT NOT NULL DEFAULT '{}',
      output TEXT NOT NULL DEFAULT '{}',
      error TEXT NOT NULL DEFAULT '',
      progress TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_ecommerce_jobs_status ON ecommerce_jobs(status, created_at);
  `);

  const api = {
    create({ id = crypto.randomUUID(), ownerEmail, payload = {} }) {
      if (!ownerEmail) throw new Error('ownerEmail is required');
      db.prepare('INSERT INTO ecommerce_jobs (id, owner_email, payload) VALUES (?, ?, ?)').run(id, ownerEmail, JSON.stringify(payload));
      return api.get(id);
    },
    get(id) {
      const row = db.prepare('SELECT * FROM ecommerce_jobs WHERE id = ?').get(id);
      if (!row) return null;
      return {
        id: row.id,
        ownerEmail: row.owner_email,
        status: row.status,
        payload: parse(row.payload, {}),
        output: parse(row.output, {}),
        error: row.error,
        progress: parse(row.progress, {}),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    },
    transition(id, status, patch = {}) {
      if (!STATES.has(status)) throw new Error(`unknown status: ${status}`);
      const current = api.get(id);
      if (!current) throw new Error('job not found');
      if (!TRANSITIONS[current.status]?.has(status)) throw new Error(`invalid transition ${current.status} -> ${status}`);
      db.prepare(`UPDATE ecommerce_jobs SET status = ?, output = ?, error = ?, progress = ?, updated_at = datetime('now') WHERE id = ?`)
        .run(status, JSON.stringify(patch.output ?? current.output), patch.error ?? current.error, JSON.stringify(patch.progress ?? current.progress), id);
      return api.get(id);
    },
    claimNext() {
      const tx = db.transaction(() => {
        const row = db.prepare("SELECT id FROM ecommerce_jobs WHERE status = 'queued' ORDER BY created_at ASC LIMIT 1").get();
        if (!row) return null;
        db.prepare("UPDATE ecommerce_jobs SET status = 'analyzing', updated_at = datetime('now') WHERE id = ? AND status = 'queued'").run(row.id);
        return api.get(row.id);
      });
      return tx();
    },
    recoverInterrupted() {
      return db.prepare("UPDATE ecommerce_jobs SET status = 'queued', updated_at = datetime('now') WHERE status IN ('analyzing', 'generating')").run().changes;
    },
    close() { db.close(); },
  };
  return api;
}
