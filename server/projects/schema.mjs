export function ensureProjectSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      asset_id TEXT NOT NULL DEFAULT '',
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
      metadata_json TEXT NOT NULL DEFAULT '{}',
      expires_at TEXT,
      retention_class TEXT NOT NULL,
      retention_class_before_pin TEXT,
      retention_pinned INTEGER NOT NULL DEFAULT 0,
      expires_at_before_pin TEXT,
      created_at TEXT NOT NULL,
      deleted_at TEXT,
      retention_state TEXT NOT NULL DEFAULT 'active',
      production_state TEXT NOT NULL DEFAULT 'draft',
      marked_at TEXT,
      isolated_at TEXT,
      FOREIGN KEY(project_id) REFERENCES projects(id)
    );
    CREATE INDEX IF NOT EXISTS idx_project_assets_owner
      ON project_assets(owner_email, project_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_project_assets_owner_created
      ON project_assets(owner_email, created_at DESC);

    CREATE TABLE IF NOT EXISTS project_asset_lineage (
      project_id TEXT NOT NULL,
      source_asset_id TEXT NOT NULL,
      target_asset_id TEXT NOT NULL,
      relation TEXT NOT NULL,
      generation_run_id TEXT,
      created_at TEXT NOT NULL,
      PRIMARY KEY(project_id, source_asset_id, target_asset_id, relation),
      FOREIGN KEY(project_id) REFERENCES projects(id),
      FOREIGN KEY(source_asset_id) REFERENCES project_assets(id),
      FOREIGN KEY(target_asset_id) REFERENCES project_assets(id)
    );
    CREATE INDEX IF NOT EXISTS idx_project_asset_lineage_target
      ON project_asset_lineage(project_id, target_asset_id);

    CREATE TABLE IF NOT EXISTS product_profiles (
      id TEXT PRIMARY KEY,
      owner_email TEXT NOT NULL,
      name TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT '',
      facts_json TEXT NOT NULL DEFAULT '{}',
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_product_profiles_owner_status
      ON product_profiles(owner_email, status, updated_at DESC);

    CREATE TABLE IF NOT EXISTS product_profile_variants (
      id TEXT PRIMARY KEY,
      profile_id TEXT NOT NULL,
      ordinal INTEGER NOT NULL,
      label TEXT NOT NULL DEFAULT '',
      color TEXT NOT NULL DEFAULT '',
      spec TEXT NOT NULL DEFAULT '',
      size TEXT NOT NULL DEFAULT '',
      capacity TEXT NOT NULL DEFAULT '',
      dim_label TEXT NOT NULL DEFAULT '',
      count INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      UNIQUE(profile_id, ordinal),
      FOREIGN KEY(profile_id) REFERENCES product_profiles(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_product_profile_variants_profile
      ON product_profile_variants(profile_id, ordinal);

    CREATE TABLE IF NOT EXISTS product_profile_assets (
      profile_id TEXT NOT NULL,
      owner_email TEXT NOT NULL,
      project_id TEXT NOT NULL,
      project_asset_id TEXT NOT NULL,
      role TEXT NOT NULL,
      expected_content_hash TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY(profile_id, project_id, project_asset_id, role),
      FOREIGN KEY(profile_id) REFERENCES product_profiles(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_product_profile_assets_owner_asset
      ON product_profile_assets(owner_email, project_id, project_asset_id);

    CREATE TABLE IF NOT EXISTS product_profile_idempotency_keys (
      owner_email TEXT NOT NULL,
      route TEXT NOT NULL,
      idempotency_key TEXT NOT NULL,
      response TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY(owner_email, route, idempotency_key)
    );

    CREATE TABLE IF NOT EXISTS product_profile_history (
      id TEXT PRIMARY KEY,
      profile_id TEXT NOT NULL,
      owner_email TEXT NOT NULL,
      change_kind TEXT NOT NULL,
      payload_json TEXT NOT NULL DEFAULT '{}',
      actor_email TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      FOREIGN KEY(profile_id) REFERENCES product_profiles(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_product_profile_history_profile
      ON product_profile_history(profile_id, created_at DESC);
  `);
  const assetColumns = db.prepare('PRAGMA table_info(project_assets)').all().map(column => column.name);
  if (!assetColumns.includes('asset_id')) db.exec("ALTER TABLE project_assets ADD COLUMN asset_id TEXT NOT NULL DEFAULT ''");
  if (!assetColumns.includes('metadata_json')) db.exec("ALTER TABLE project_assets ADD COLUMN metadata_json TEXT NOT NULL DEFAULT '{}'");
  if (!assetColumns.includes('retention_state')) db.exec("ALTER TABLE project_assets ADD COLUMN retention_state TEXT NOT NULL DEFAULT 'active'");
  if (!assetColumns.includes('production_state')) db.exec("ALTER TABLE project_assets ADD COLUMN production_state TEXT NOT NULL DEFAULT 'draft'");
  if (!assetColumns.includes('retention_class_before_pin')) db.exec('ALTER TABLE project_assets ADD COLUMN retention_class_before_pin TEXT');
  if (!assetColumns.includes('retention_pinned')) db.exec('ALTER TABLE project_assets ADD COLUMN retention_pinned INTEGER NOT NULL DEFAULT 0');
  if (!assetColumns.includes('expires_at_before_pin')) db.exec('ALTER TABLE project_assets ADD COLUMN expires_at_before_pin TEXT');
  if (!assetColumns.includes('marked_at')) db.exec('ALTER TABLE project_assets ADD COLUMN marked_at TEXT');
  if (!assetColumns.includes('isolated_at')) db.exec('ALTER TABLE project_assets ADD COLUMN isolated_at TEXT');
  db.exec(`CREATE INDEX IF NOT EXISTS idx_project_assets_retention
    ON project_assets(retention_state, marked_at)`);
  const projectColumns = db.prepare('PRAGMA table_info(projects)').all().map(column => column.name);
  if (!projectColumns.includes('legacy_work_key')) db.exec('ALTER TABLE projects ADD COLUMN legacy_work_key TEXT');
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_legacy_work ON projects(owner_email, legacy_work_key) WHERE legacy_work_key IS NOT NULL');
}
