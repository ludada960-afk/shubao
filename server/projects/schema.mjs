export function ensureProjectSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      owner_email TEXT NOT NULL,
      kind TEXT NOT NULL,
      title TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'editing',
      head_version_id TEXT,
      accepted_version_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      completed_at TEXT,
      deleted_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_projects_owner_updated
      ON projects(owner_email, updated_at DESC);

    CREATE TABLE IF NOT EXISTS project_idempotency_keys (
      owner_email TEXT NOT NULL,
      route TEXT NOT NULL,
      idempotency_key TEXT NOT NULL,
      response TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY(owner_email, route, idempotency_key)
    );

    CREATE TABLE IF NOT EXISTS project_versions (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      parent_version_id TEXT,
      reason TEXT NOT NULL,
      sequence INTEGER NOT NULL,
      input_snapshot TEXT NOT NULL DEFAULT '{}',
      plan_snapshot TEXT NOT NULL DEFAULT '{}',
      canvas_snapshot_id TEXT,
      created_at TEXT NOT NULL,
      UNIQUE(project_id, sequence),
      FOREIGN KEY(project_id) REFERENCES projects(id)
    );
    CREATE INDEX IF NOT EXISTS idx_project_versions_project
      ON project_versions(project_id, sequence DESC);

    CREATE TABLE IF NOT EXISTS project_generation_runs (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      source_version_id TEXT NOT NULL,
      result_version_id TEXT,
      owner_email TEXT NOT NULL,
      kind TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'queued',
      quote_id TEXT,
      hold_id TEXT,
      progress TEXT NOT NULL DEFAULT '{}',
      error_code TEXT,
      created_at TEXT NOT NULL,
      completed_at TEXT,
      FOREIGN KEY(project_id) REFERENCES projects(id)
    );
    CREATE INDEX IF NOT EXISTS idx_project_runs_owner
      ON project_generation_runs(owner_email, created_at DESC);

    CREATE TABLE IF NOT EXISTS recovery_checkpoints (
      id TEXT PRIMARY KEY,
      owner_email TEXT NOT NULL,
      project_id TEXT NOT NULL,
      version_id TEXT NOT NULL,
      generation_run_id TEXT,
      reason TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'available',
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY(project_id) REFERENCES projects(id)
    );
    CREATE INDEX IF NOT EXISTS idx_recovery_owner_status
      ON recovery_checkpoints(owner_email, status, expires_at);

    CREATE TABLE IF NOT EXISTS canvas_sessions (
      id TEXT PRIMARY KEY,
      owner_email TEXT NOT NULL,
      project_id TEXT NOT NULL,
      base_version_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      revision INTEGER NOT NULL DEFAULT 1,
      snapshot TEXT NOT NULL DEFAULT '{}',
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(project_id) REFERENCES projects(id)
    );
    CREATE INDEX IF NOT EXISTS idx_canvas_sessions_owner
      ON canvas_sessions(owner_email, updated_at DESC);

    CREATE TABLE IF NOT EXISTS composition_documents (
      id TEXT PRIMARY KEY,
      owner_email TEXT NOT NULL,
      project_id TEXT NOT NULL,
      version_id TEXT NOT NULL,
      width INTEGER NOT NULL,
      height INTEGER NOT NULL,
      color_space TEXT NOT NULL DEFAULT 'srgb',
      revision INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(project_id) REFERENCES projects(id)
    );
    CREATE INDEX IF NOT EXISTS idx_compositions_project
      ON composition_documents(owner_email, project_id, updated_at DESC);

    CREATE TABLE IF NOT EXISTS composition_revisions (
      document_id TEXT NOT NULL,
      revision INTEGER NOT NULL,
      layers TEXT NOT NULL DEFAULT '[]',
      background_asset_id TEXT,
      rendered_asset_id TEXT,
      created_at TEXT NOT NULL,
      PRIMARY KEY(document_id, revision),
      FOREIGN KEY(document_id) REFERENCES composition_documents(id)
    );

    CREATE TABLE IF NOT EXISTS project_assets (
      id TEXT PRIMARY KEY,
      owner_email TEXT NOT NULL,
      project_id TEXT NOT NULL,
      version_id TEXT,
      generation_run_id TEXT,
      role TEXT NOT NULL,
      parent_asset_id TEXT,
      content_hash TEXT NOT NULL,
      stable_url TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      width INTEGER,
      height INTEGER,
      expires_at TEXT,
      retention_class TEXT NOT NULL,
      created_at TEXT NOT NULL,
      deleted_at TEXT,
      FOREIGN KEY(project_id) REFERENCES projects(id)
    );
    CREATE INDEX IF NOT EXISTS idx_project_assets_owner
      ON project_assets(owner_email, project_id, created_at DESC);
  `);
}
