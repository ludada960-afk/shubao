function clean(value, max = 500) {
  return String(value ?? '').trim().slice(0, max);
}

export function createVideoOutbox({ db, now = Date.now } = {}) {
  if (!db) throw new TypeError('video outbox requires a database');
  db.exec(`
    CREATE TABLE IF NOT EXISTS video_outbox (
      id TEXT PRIMARY KEY,
      aggregate_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      payload_json TEXT NOT NULL DEFAULT '{}',
      state TEXT NOT NULL DEFAULT 'pending',
      attempts INTEGER NOT NULL DEFAULT 0,
      next_attempt_ms INTEGER NOT NULL DEFAULT 0,
      lock_owner TEXT NOT NULL DEFAULT '',
      last_error TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );
    CREATE INDEX IF NOT EXISTS idx_video_outbox_pending ON video_outbox(state, next_attempt_ms, created_at);
    CREATE INDEX IF NOT EXISTS idx_video_outbox_aggregate ON video_outbox(aggregate_id, created_at);
  `);
  db.prepare("UPDATE video_outbox SET state = 'pending', lock_owner = '' WHERE state = 'processing'").run();
  const selectById = db.prepare('SELECT * FROM video_outbox WHERE id = ?');

  return {
    ensure({ id, aggregateId, eventType, payload = {} }) {
      db.prepare(`INSERT OR IGNORE INTO video_outbox (id, aggregate_id, event_type, payload_json)
        VALUES (?, ?, ?, ?)`).run(clean(id, 240), clean(aggregateId, 140), clean(eventType, 160), JSON.stringify(payload));
      return selectById.get(clean(id, 240));
    },
    pending(limit = 50, { force = false } = {}) {
      return db.prepare(`SELECT * FROM video_outbox
        WHERE state = 'pending' AND (? = 1 OR next_attempt_ms <= ?)
        ORDER BY created_at, rowid LIMIT ?`).all(force ? 1 : 0, Number(now()) || Date.now(), Math.max(1, Math.min(200, Number(limit) || 50)));
    },
    processing(id, workerId = 'inline') {
      db.prepare(`UPDATE video_outbox SET state = 'processing', lock_owner = ?, attempts = attempts + 1,
        updated_at = datetime('now', 'localtime') WHERE id = ? AND state = 'pending'`).run(clean(workerId, 120), clean(id, 240));
      return selectById.get(clean(id, 240));
    },
    complete(id) {
      db.prepare(`UPDATE video_outbox SET state = 'done', lock_owner = '', last_error = '',
        updated_at = datetime('now', 'localtime') WHERE id = ?`).run(clean(id, 240));
      return selectById.get(clean(id, 240));
    },
    fail(id, error, delayMs = 0) {
      const nextAttempt = (Number(now()) || Date.now()) + Math.max(0, Number(delayMs) || 0);
      db.prepare(`UPDATE video_outbox SET state = 'pending', lock_owner = '', last_error = ?, next_attempt_ms = ?,
        updated_at = datetime('now', 'localtime') WHERE id = ?`).run(clean(error?.message || error, 700), nextAttempt, clean(id, 240));
      return selectById.get(clean(id, 240));
    },
  };
}
