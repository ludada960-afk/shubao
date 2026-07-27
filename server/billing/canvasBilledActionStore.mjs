function clean(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function parseRecord(row) {
  if (!row) return null;
  try {
    const value = JSON.parse(row.payload);
    return value && typeof value === 'object' ? value : null;
  } catch {
    return null;
  }
}

export function createCanvasBilledActionStore(db) {
  if (!db || typeof db.prepare !== 'function') throw new TypeError('SQLite database is required');
  db.exec(`
    CREATE TABLE IF NOT EXISTS canvas_billed_actions (
      owner_email TEXT NOT NULL,
      action_id TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('delivered', 'settled')),
      payload TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (owner_email, action_id)
    )
  `);
  const select = db.prepare('SELECT payload FROM canvas_billed_actions WHERE owner_email = ? AND action_id = ?');
  const upsert = db.prepare(`
    INSERT INTO canvas_billed_actions (owner_email, action_id, status, payload, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(owner_email, action_id) DO UPDATE SET
      status = excluded.status, payload = excluded.payload, updated_at = excluded.updated_at
  `);
  return {
    get(ownerEmail, actionId) {
      return parseRecord(select.get(clean(ownerEmail).toLowerCase(), clean(actionId)));
    },
    save(ownerEmail, actionId, value) {
      const owner = clean(ownerEmail).toLowerCase();
      const id = clean(actionId);
      const status = clean(value?.status);
      if (!owner || !id || !['delivered', 'settled'].includes(status)) {
        throw new TypeError('Valid canvas billed action owner, id, and status are required');
      }
      upsert.run(owner, id, status, JSON.stringify(value), new Date().toISOString());
      return value;
    },
  };
}
