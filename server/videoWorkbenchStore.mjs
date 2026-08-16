import crypto from 'node:crypto';
import { buildReplayManifest, canonicalReplayManifest } from './videoReplayManifest.mjs';
import { normalizeProjectMemoryFact, normalizeProjectMemoryList } from './videoProjectMemory.mjs';
import { buildSkillRunExecutionPlan, normalizeSkillRunSpec } from './videoSkillRun.mjs';

const ASSET_KINDS = new Set(['product', 'person', 'wardrobe', 'scene', 'prop', 'style', 'voice', 'music']);
const BINDING_ROLES = new Set([
  'subject', 'product', 'wardrobe', 'scene', 'prop', 'style', 'voice', 'music',
  'first_frame', 'last_frame', 'motion_reference',
]);
const SHOT_PATCH_FIELDS = new Set(['position', 'purpose', 'durationMs', 'cameraLanguage', 'prompt']);
const SOURCE_MEDIA_MIME_PREFIX = Object.freeze({
  image: 'image/',
  video: 'video/',
  audio: 'audio/',
});

function coded(code, message = code, current = null) {
  return Object.assign(new Error(message), { code, current });
}

function normalizeOwner(value) {
  return String(value || '').trim().toLowerCase();
}

function clean(value, max = 1000) {
  return String(value ?? '').trim().slice(0, max);
}

function replayPayload(manifest) {
  const {
    id: _id, ownerEmail: _ownerEmail, projectId: _projectId, createdAt: _createdAt,
    manifestHash: _manifestHash, ...payload
  } = manifest || {};
  return payload;
}

function assertReplayManifestIntegrity(row, project) {
  const manifest = parseJson(row?.manifest_json, null);
  if (!manifest || manifest.manifestHash !== row.manifest_hash
    || manifest.project?.id !== project.id || manifest.project?.kind !== 'video') {
    throw coded('REPLAY_MANIFEST_INTEGRITY_INVALID', 'replay manifest integrity check failed');
  }
  const canonical = canonicalReplayManifest(replayPayload(manifest));
  const hash = crypto.createHash('sha256').update(canonical).digest('hex');
  if (hash !== row.manifest_hash) throw coded('REPLAY_MANIFEST_INTEGRITY_INVALID', 'replay manifest hash mismatch');
  return manifest;
}

function parseJson(value, fallback) {
  try { return value ? JSON.parse(value) : fallback; } catch { return fallback; }
}

function replayManifestFromRow(row) {
  if (!row) return null;
  let manifest = {};
  try { manifest = JSON.parse(row.manifest_json || '{}'); } catch { manifest = {}; }
  return {
    id: row.id,
    ownerEmail: row.owner_email,
    projectId: row.project_id,
    manifestHash: row.manifest_hash,
    schemaVersion: row.schema_version,
    createdAt: row.created_at,
    ...manifest,
  };
}

function assetFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    ownerEmail: row.owner_email,
    projectId: row.project_id,
    kind: row.kind,
    name: row.name,
    status: row.status,
    approvedVersionId: row.approved_version_id,
    revision: row.revision,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function versionFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    assetId: row.asset_id,
    ownerEmail: row.owner_email,
    projectId: row.project_id,
    sequence: row.sequence,
    sourceProjectAssetId: row.source_project_asset_id,
    stableUrl: row.stable_url,
    contentHash: row.content_hash,
    mimeType: row.mime_type,
    metadata: parseJson(row.metadata_json, {}),
    createdAt: row.created_at,
  };
}

function shotFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    ownerEmail: row.owner_email,
    projectId: row.project_id,
    position: row.position,
    purpose: row.purpose,
    durationMs: row.duration_ms,
    cameraLanguage: row.camera_language,
    prompt: row.prompt,
    status: row.status,
    selectedCandidateId: row.selected_candidate_id,
    revision: row.revision,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function bindingFromRow(row) {
  return {
    shotId: row.shot_id,
    assetId: row.asset_id,
    assetVersionId: row.asset_version_id,
    ownerEmail: row.owner_email,
    projectId: row.project_id,
    role: row.role,
    createdAt: row.created_at,
  };
}

function candidateFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    ownerEmail: row.owner_email,
    projectId: row.project_id,
    shotId: row.shot_id,
    generationJobId: row.generation_job_id,
    outputAssetId: row.output_asset_id,
    stableUrl: row.stable_url,
    contentHash: row.content_hash,
    mimeType: row.mime_type,
    status: row.status,
    createdAt: row.created_at,
  };
}

function clipFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    ownerEmail: row.owner_email,
    projectId: row.project_id,
    shotId: row.shot_id,
    candidateId: row.candidate_id,
    position: row.position,
    trimStartMs: row.trim_start_ms,
    trimEndMs: row.trim_end_ms,
    muted: Boolean(row.muted),
    status: row.status,
    revision: row.revision,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function memoryFactFromRow(row) {
  if (!row) return null;
  return normalizeProjectMemoryFact({
    id: row.id,
    key: row.fact_key,
    value: parseJson(row.value_json, null),
    source: row.source,
    assetRefs: parseJson(row.asset_refs_json, []),
    status: row.status,
    revision: row.revision,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  });
}

function skillRunFromRow(row, events = []) {
  if (!row) return null;
  const plan = parseJson(row.plan_json, {});
  const completedStepIds = events
    .filter(event => event.type === 'step.completed')
    .map(event => parseJson(event.payload_json, {}).stepId)
    .filter(Boolean);
  return {
    id: row.id,
    ownerEmail: row.owner_email,
    projectId: row.project_id,
    skillId: row.skill_id,
    skillVersion: row.skill_version,
    status: row.status,
    revision: row.revision,
    input: parseJson(row.input_json, {}),
    plan,
    executionPlan: buildSkillRunExecutionPlan(plan, { completedStepIds }),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    events: events.map(event => ({
      id: event.id,
      runId: event.run_id,
      sequence: event.sequence,
      type: event.type,
      payload: parseJson(event.payload_json, {}),
      actorEmail: event.actor_email,
      createdAt: event.created_at,
    })),
  };
}

function ensureSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS video_workbench_assets (
      id TEXT PRIMARY KEY, owner_email TEXT NOT NULL, project_id TEXT NOT NULL,
      kind TEXT NOT NULL, name TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'draft',
      approved_version_id TEXT, revision INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
      FOREIGN KEY(project_id) REFERENCES projects(id)
    );
    CREATE INDEX IF NOT EXISTS idx_video_workbench_assets_project
      ON video_workbench_assets(owner_email, project_id, created_at);
    CREATE TABLE IF NOT EXISTS video_workbench_asset_versions (
      id TEXT PRIMARY KEY, asset_id TEXT NOT NULL, owner_email TEXT NOT NULL, project_id TEXT NOT NULL,
      sequence INTEGER NOT NULL, source_project_asset_id TEXT, stable_url TEXT NOT NULL,
      content_hash TEXT NOT NULL, mime_type TEXT NOT NULL, metadata_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL, UNIQUE(asset_id, sequence),
      FOREIGN KEY(asset_id) REFERENCES video_workbench_assets(id),
      FOREIGN KEY(project_id) REFERENCES projects(id)
    );
    CREATE TABLE IF NOT EXISTS video_storyboard_shots (
      id TEXT PRIMARY KEY, owner_email TEXT NOT NULL, project_id TEXT NOT NULL,
      position INTEGER NOT NULL, purpose TEXT NOT NULL, duration_ms INTEGER NOT NULL,
      camera_language TEXT NOT NULL DEFAULT '', prompt TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'draft', selected_candidate_id TEXT,
      revision INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
      UNIQUE(project_id, position), FOREIGN KEY(project_id) REFERENCES projects(id)
    );
    CREATE TABLE IF NOT EXISTS video_shot_asset_bindings (
      shot_id TEXT NOT NULL, asset_id TEXT NOT NULL, asset_version_id TEXT NOT NULL,
      owner_email TEXT NOT NULL, project_id TEXT NOT NULL, role TEXT NOT NULL, created_at TEXT NOT NULL,
      PRIMARY KEY(shot_id, role, asset_id),
      FOREIGN KEY(shot_id) REFERENCES video_storyboard_shots(id),
      FOREIGN KEY(asset_id) REFERENCES video_workbench_assets(id),
      FOREIGN KEY(asset_version_id) REFERENCES video_workbench_asset_versions(id)
    );
    CREATE TABLE IF NOT EXISTS video_shot_candidates (
      id TEXT PRIMARY KEY, owner_email TEXT NOT NULL, project_id TEXT NOT NULL, shot_id TEXT NOT NULL,
      generation_job_id TEXT, output_asset_id TEXT NOT NULL, stable_url TEXT NOT NULL,
      content_hash TEXT NOT NULL, mime_type TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'available',
      created_at TEXT NOT NULL, UNIQUE(shot_id, output_asset_id),
      FOREIGN KEY(shot_id) REFERENCES video_storyboard_shots(id)
    );
    CREATE TABLE IF NOT EXISTS video_timeline_clips (
      id TEXT PRIMARY KEY, owner_email TEXT NOT NULL, project_id TEXT NOT NULL,
      shot_id TEXT NOT NULL, candidate_id TEXT NOT NULL, position INTEGER NOT NULL,
      trim_start_ms INTEGER NOT NULL DEFAULT 0, trim_end_ms INTEGER NOT NULL,
      muted INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'active',
      revision INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
      UNIQUE(project_id, position),
      FOREIGN KEY(shot_id) REFERENCES video_storyboard_shots(id),
      FOREIGN KEY(candidate_id) REFERENCES video_shot_candidates(id)
    );
    CREATE TABLE IF NOT EXISTS video_workbench_operations (
      id TEXT PRIMARY KEY, owner_email TEXT NOT NULL, project_id TEXT NOT NULL,
      action TEXT NOT NULL, outcome TEXT NOT NULL, latency_ms INTEGER NOT NULL DEFAULT 0,
      error_code TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_video_workbench_operations_created
      ON video_workbench_operations(created_at, owner_email, project_id);
    CREATE TABLE IF NOT EXISTS video_replay_manifests (
      id TEXT PRIMARY KEY, owner_email TEXT NOT NULL, project_id TEXT NOT NULL,
      manifest_hash TEXT NOT NULL, schema_version INTEGER NOT NULL,
      skill_id TEXT NOT NULL, skill_version INTEGER NOT NULL,
      manifest_json TEXT NOT NULL, created_at TEXT NOT NULL,
      UNIQUE(owner_email, project_id, manifest_hash),
      FOREIGN KEY(project_id) REFERENCES projects(id)
    );
    CREATE INDEX IF NOT EXISTS idx_video_replay_manifests_project
      ON video_replay_manifests(owner_email, project_id, created_at);
    CREATE TABLE IF NOT EXISTS video_skill_runs (
      id TEXT PRIMARY KEY, owner_email TEXT NOT NULL, project_id TEXT NOT NULL,
      skill_id TEXT NOT NULL, skill_version INTEGER NOT NULL, status TEXT NOT NULL,
      input_json TEXT NOT NULL DEFAULT '{}', plan_json TEXT NOT NULL DEFAULT '{}',
      revision INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
      FOREIGN KEY(project_id) REFERENCES projects(id)
    );
    CREATE INDEX IF NOT EXISTS idx_video_skill_runs_project
      ON video_skill_runs(owner_email, project_id, updated_at DESC);
    CREATE TABLE IF NOT EXISTS video_skill_run_events (
      id TEXT PRIMARY KEY, run_id TEXT NOT NULL, owner_email TEXT NOT NULL, project_id TEXT NOT NULL,
      sequence INTEGER NOT NULL, type TEXT NOT NULL, payload_json TEXT NOT NULL DEFAULT '{}',
      actor_email TEXT NOT NULL, created_at TEXT NOT NULL, UNIQUE(run_id, sequence),
      FOREIGN KEY(run_id) REFERENCES video_skill_runs(id), FOREIGN KEY(project_id) REFERENCES projects(id)
    );
    CREATE INDEX IF NOT EXISTS idx_video_skill_run_events_run
      ON video_skill_run_events(owner_email, project_id, run_id, sequence);
    CREATE TABLE IF NOT EXISTS video_project_memory_facts (
      id TEXT PRIMARY KEY, owner_email TEXT NOT NULL, project_id TEXT NOT NULL,
      fact_key TEXT NOT NULL, value_json TEXT NOT NULL DEFAULT 'null',
      source TEXT NOT NULL DEFAULT 'user', asset_refs_json TEXT NOT NULL DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'active', revision INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT,
      UNIQUE(owner_email, project_id, fact_key),
      FOREIGN KEY(project_id) REFERENCES projects(id)
    );
    CREATE INDEX IF NOT EXISTS idx_video_project_memory_facts_project
      ON video_project_memory_facts(owner_email, project_id, status, updated_at DESC);
  `);
}

export function createVideoWorkbenchStore({
  db,
  projectStore,
  now = () => new Date(),
  randomUUID = crypto.randomUUID,
} = {}) {
  if (!db?.prepare || !projectStore?.getProject) throw new TypeError('video workbench requires db and projectStore');
  ensureSchema(db);

  const timestamp = () => {
    const value = now();
    const date = value instanceof Date ? value : new Date(value);
    if (!Number.isFinite(date.getTime())) throw new TypeError('now must return a valid date');
    return date.toISOString();
  };
  const requireProject = (ownerEmail, projectId) => {
    const owner = normalizeOwner(ownerEmail);
    const project = projectStore.getProject({ ownerEmail: owner, projectId });
    if (!project || project.kind !== 'video') throw coded('PROJECT_NOT_FOUND', 'video project not found');
    return { owner, project };
  };
  const requireAsset = (owner, projectId, assetId) => {
    const asset = assetFromRow(db.prepare(`SELECT * FROM video_workbench_assets
      WHERE id = ? AND owner_email = ? AND project_id = ?`).get(assetId, owner, projectId));
    if (!asset) throw coded('WORKBENCH_ASSET_NOT_FOUND', 'workbench asset not found');
    return asset;
  };
  const requireVersion = (owner, projectId, assetId, versionId) => {
    const version = versionFromRow(db.prepare(`SELECT * FROM video_workbench_asset_versions
      WHERE id = ? AND asset_id = ? AND owner_email = ? AND project_id = ?`).get(versionId, assetId, owner, projectId));
    if (!version) throw coded('ASSET_VERSION_NOT_FOUND', 'asset version not found');
    return version;
  };
  const requireShot = (owner, projectId, shotId) => {
    const shot = shotFromRow(db.prepare(`SELECT * FROM video_storyboard_shots
      WHERE id = ? AND owner_email = ? AND project_id = ?`).get(shotId, owner, projectId));
    if (!shot) throw coded('SHOT_NOT_FOUND', 'shot not found');
    return shot;
  };
  const requireCandidate = (owner, projectId, shotId, candidateId) => {
    const candidate = candidateFromRow(db.prepare(`SELECT * FROM video_shot_candidates
      WHERE id = ? AND shot_id = ? AND owner_email = ? AND project_id = ?`).get(candidateId, shotId, owner, projectId));
    if (!candidate) throw coded('CANDIDATE_NOT_FOUND', 'candidate not found');
    return candidate;
  };
  const requireSkillRun = (owner, projectId, runId) => {
    const row = db.prepare(`SELECT * FROM video_skill_runs
      WHERE id = ? AND owner_email = ? AND project_id = ?`).get(runId, owner, projectId);
    if (!row) throw coded('SKILL_RUN_NOT_FOUND', 'skill run not found');
    const events = db.prepare(`SELECT * FROM video_skill_run_events
      WHERE run_id = ? AND owner_email = ? AND project_id = ? ORDER BY sequence`).all(runId, owner, projectId);
    return { row, run: skillRunFromRow(row, events) };
  };
  const operationCutoff = () => {
    const current = new Date(timestamp()).getTime() - (24 * 60 * 60 * 1000);
    return new Date(current).toISOString();
  };
  const validatePosition = position => {
    if (!Number.isSafeInteger(position) || position < 0) throw coded('INVALID_POSITION', 'position must be a non-negative integer');
  };
  const validateDuration = durationMs => {
    if (!Number.isSafeInteger(durationMs) || durationMs < 500 || durationMs > 120_000) {
      throw coded('INVALID_DURATION', 'duration must be between 500 and 120000 milliseconds');
    }
  };

  const api = {
    createAsset({ ownerEmail, projectId, kind, name }) {
      const { owner, project } = requireProject(ownerEmail, projectId);
      if (!ASSET_KINDS.has(kind)) throw coded('INVALID_BINDING', 'unknown asset kind');
      const assetName = clean(name, 160);
      if (!assetName) throw coded('INVALID_BINDING', 'asset name is required');
      const id = randomUUID();
      const createdAt = timestamp();
      db.prepare(`INSERT INTO video_workbench_assets
        (id, owner_email, project_id, kind, name, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)`).run(id, owner, project.id, kind, assetName, createdAt, createdAt);
      return requireAsset(owner, project.id, id);
    },

    addAssetVersion({ ownerEmail, projectId, assetId, sourceProjectAssetId = null, stableUrl, contentHash, mimeType, metadata = {} }) {
      const { owner, project } = requireProject(ownerEmail, projectId);
      requireAsset(owner, project.id, assetId);
      const url = clean(stableUrl, 2000);
      const hash = clean(contentHash, 256);
      const type = clean(mimeType, 160);
      if (!url || !hash || !type) throw coded('INVALID_BINDING', 'stableUrl, contentHash and mimeType are required');
      return db.transaction(() => {
        const sequence = db.prepare(`SELECT COALESCE(MAX(sequence), 0) + 1 AS value
          FROM video_workbench_asset_versions WHERE asset_id = ?`).get(assetId).value;
        const id = randomUUID();
        db.prepare(`INSERT INTO video_workbench_asset_versions
          (id, asset_id, owner_email, project_id, sequence, source_project_asset_id,
           stable_url, content_hash, mime_type, metadata_json, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
          id, assetId, owner, project.id, sequence, clean(sourceProjectAssetId, 256) || null,
          url, hash, type, JSON.stringify(metadata || {}), timestamp(),
        );
        return versionFromRow(db.prepare('SELECT * FROM video_workbench_asset_versions WHERE id = ?').get(id));
      })();
    },

    addAssetVersionFromVideoAsset({ ownerEmail, projectId, assetId, videoAssetId, metadata = {} }) {
      const { owner, project } = requireProject(ownerEmail, projectId);
      requireAsset(owner, project.id, assetId);
      const sourceId = clean(videoAssetId, 256);
      const source = sourceId ? db.prepare(`SELECT id, kind, content_type, bytes, sha256, file_name
        FROM video_assets WHERE id = ? AND owner_email = ?`).get(sourceId, owner) : null;
      const mimePrefix = source ? SOURCE_MEDIA_MIME_PREFIX[source.kind] : null;
      if (!source || !mimePrefix) throw coded('VIDEO_ASSET_NOT_FOUND', 'uploaded media not found');
      const mimeType = clean(source.content_type, 160).toLowerCase();
      const contentHash = clean(source.sha256, 256);
      if (!mimeType.startsWith(mimePrefix) || !contentHash || !Number.isSafeInteger(source.bytes) || source.bytes <= 0) {
        throw coded('VIDEO_ASSET_NOT_READY', 'uploaded media is not durably verified');
      }
      return api.addAssetVersion({
        ownerEmail: owner,
        projectId: project.id,
        assetId,
        sourceProjectAssetId: source.id,
        stableUrl: `/api/video/assets/${encodeURIComponent(source.id)}`,
        contentHash,
        mimeType,
        metadata: {
          ...(metadata && typeof metadata === 'object' && !Array.isArray(metadata) ? metadata : {}),
          sourceKind: source.kind,
          fileName: clean(source.file_name, 500),
          bytes: source.bytes,
        },
      });
    },

    approveAssetVersion({ ownerEmail, projectId, assetId, versionId, expectedRevision }) {
      const { owner, project } = requireProject(ownerEmail, projectId);
      return db.transaction(() => {
        const asset = requireAsset(owner, project.id, assetId);
        requireVersion(owner, project.id, assetId, versionId);
        if (asset.revision !== expectedRevision) throw coded('VERSION_CONFLICT', 'asset revision conflict', asset);
        const changedAt = timestamp();
        db.prepare(`UPDATE video_workbench_assets SET approved_version_id = ?, status = 'approved',
          revision = revision + 1, updated_at = ? WHERE id = ?`).run(versionId, changedAt, assetId);
        const staleIds = db.prepare(`SELECT DISTINCT shot_id FROM video_shot_asset_bindings
          WHERE owner_email = ? AND project_id = ? AND asset_id = ? AND asset_version_id <> ?`)
          .all(owner, project.id, assetId, versionId).map(row => row.shot_id);
        if (staleIds.length) {
          const placeholders = staleIds.map(() => '?').join(',');
          db.prepare(`UPDATE video_storyboard_shots SET status = 'stale', revision = revision + 1, updated_at = ?
            WHERE owner_email = ? AND project_id = ? AND id IN (${placeholders})`)
            .run(changedAt, owner, project.id, ...staleIds);
          db.prepare(`UPDATE video_timeline_clips SET status = 'stale', revision = revision + 1, updated_at = ?
            WHERE owner_email = ? AND project_id = ? AND status = 'active' AND shot_id IN (${placeholders})`)
            .run(changedAt, owner, project.id, ...staleIds);
        }
        return requireAsset(owner, project.id, assetId);
      })();
    },

    createShot({ ownerEmail, projectId, position, purpose, durationMs, cameraLanguage = '', prompt = '' }) {
      const { owner, project } = requireProject(ownerEmail, projectId);
      validatePosition(position);
      validateDuration(durationMs);
      const id = randomUUID();
      const createdAt = timestamp();
      try {
        db.prepare(`INSERT INTO video_storyboard_shots
          (id, owner_email, project_id, position, purpose, duration_ms, camera_language, prompt, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
          id, owner, project.id, position, clean(purpose, 500), durationMs,
          clean(cameraLanguage, 2000), clean(prompt, 8000), createdAt, createdAt,
        );
      } catch (error) {
        if (/UNIQUE constraint failed/i.test(error.message)) throw coded('INVALID_POSITION', 'shot position already exists');
        throw error;
      }
      return requireShot(owner, project.id, id);
    },

    updateShot({ ownerEmail, projectId, shotId, expectedRevision, patch = {} }) {
      const { owner, project } = requireProject(ownerEmail, projectId);
      const keys = Object.keys(patch || {});
      if (!keys.length || keys.some(key => !SHOT_PATCH_FIELDS.has(key))) throw coded('INVALID_BINDING', 'shot patch contains unsupported fields');
      return db.transaction(() => {
        const shot = requireShot(owner, project.id, shotId);
        if (shot.revision !== expectedRevision) throw coded('VERSION_CONFLICT', 'shot revision conflict', shot);
        const next = { ...shot, ...patch };
        validatePosition(next.position);
        validateDuration(next.durationMs);
        try {
          db.prepare(`UPDATE video_storyboard_shots SET position = ?, purpose = ?, duration_ms = ?,
            camera_language = ?, prompt = ?, revision = revision + 1, updated_at = ? WHERE id = ?`)
            .run(next.position, clean(next.purpose, 500), next.durationMs, clean(next.cameraLanguage, 2000),
              clean(next.prompt, 8000), timestamp(), shot.id);
        } catch (error) {
          if (/UNIQUE constraint failed/i.test(error.message)) throw coded('INVALID_POSITION', 'shot position already exists');
          throw error;
        }
        return requireShot(owner, project.id, shot.id);
      })();
    },

    bindShotAssetVersion({ ownerEmail, projectId, shotId, assetId, assetVersionId, role }) {
      const { owner, project } = requireProject(ownerEmail, projectId);
      requireShot(owner, project.id, shotId);
      requireAsset(owner, project.id, assetId);
      requireVersion(owner, project.id, assetId, assetVersionId);
      if (!BINDING_ROLES.has(role)) throw coded('INVALID_BINDING', 'unknown shot asset role');
      const createdAt = timestamp();
      db.prepare(`INSERT INTO video_shot_asset_bindings
        (shot_id, asset_id, asset_version_id, owner_email, project_id, role, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(shot_id, role, asset_id) DO UPDATE SET asset_version_id = excluded.asset_version_id,
          created_at = excluded.created_at`).run(shotId, assetId, assetVersionId, owner, project.id, role, createdAt);
      return bindingFromRow(db.prepare(`SELECT * FROM video_shot_asset_bindings
        WHERE shot_id = ? AND role = ? AND asset_id = ?`).get(shotId, role, assetId));
    },

    registerCandidate({ ownerEmail, projectId, shotId, generationJobId = null, outputAssetId, stableUrl, contentHash, mimeType }) {
      const { owner, project } = requireProject(ownerEmail, projectId);
      requireShot(owner, project.id, shotId);
      const outputId = clean(outputAssetId, 256);
      if (!outputId || !clean(stableUrl, 2000) || !clean(contentHash, 256) || !clean(mimeType, 160)) {
        throw coded('INVALID_BINDING', 'candidate delivery fields are required');
      }
      const existing = candidateFromRow(db.prepare(`SELECT * FROM video_shot_candidates
        WHERE shot_id = ? AND output_asset_id = ?`).get(shotId, outputId));
      if (existing) return existing;
      const id = randomUUID();
      db.prepare(`INSERT INTO video_shot_candidates
        (id, owner_email, project_id, shot_id, generation_job_id, output_asset_id,
         stable_url, content_hash, mime_type, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
        id, owner, project.id, shotId, clean(generationJobId, 256) || null, outputId,
        clean(stableUrl, 2000), clean(contentHash, 256), clean(mimeType, 160), timestamp(),
      );
      return requireCandidate(owner, project.id, shotId, id);
    },

    registerCandidateFromJob({ ownerEmail, projectId, shotId, generationJobId }) {
      const { owner, project } = requireProject(ownerEmail, projectId);
      requireShot(owner, project.id, shotId);
      const jobId = clean(generationJobId, 256);
      const job = jobId ? db.prepare(`SELECT id, status, result_asset_id FROM video_jobs
        WHERE id = ? AND owner_email = ? AND project_id = ?`).get(jobId, owner, project.id) : null;
      if (!job) throw coded('VIDEO_JOB_NOT_FOUND', 'video generation job not found');
      if (job.status !== 'completed' || !clean(job.result_asset_id, 256)) {
        throw coded('VIDEO_JOB_NOT_READY', 'video generation job is not complete');
      }
      const output = db.prepare(`SELECT id, kind, content_type, sha256 FROM video_assets
        WHERE id = ? AND owner_email = ?`).get(job.result_asset_id, owner);
      if (!output || output.kind !== 'output' || !clean(output.sha256, 256) || !clean(output.content_type, 160)) {
        throw coded('VIDEO_JOB_NOT_READY', 'verified video delivery is missing');
      }
      return api.registerCandidate({
        ownerEmail: owner,
        projectId: project.id,
        shotId,
        generationJobId: job.id,
        outputAssetId: output.id,
        stableUrl: `/api/video/assets/${encodeURIComponent(output.id)}`,
        contentHash: output.sha256,
        mimeType: output.content_type,
      });
    },

    selectCandidate({ ownerEmail, projectId, shotId, candidateId, expectedRevision }) {
      const { owner, project } = requireProject(ownerEmail, projectId);
      return db.transaction(() => {
        const shot = requireShot(owner, project.id, shotId);
        const candidate = requireCandidate(owner, project.id, shot.id, candidateId);
        if (shot.revision !== expectedRevision) throw coded('VERSION_CONFLICT', 'shot revision conflict', shot);
        const changedAt = timestamp();
        db.prepare(`UPDATE video_shot_candidates SET status = 'available'
          WHERE owner_email = ? AND project_id = ? AND shot_id = ? AND status = 'selected'`)
          .run(owner, project.id, shot.id);
        db.prepare("UPDATE video_shot_candidates SET status = 'selected' WHERE id = ?").run(candidate.id);
        db.prepare(`UPDATE video_timeline_clips SET status = 'stale', revision = revision + 1, updated_at = ?
          WHERE owner_email = ? AND project_id = ? AND shot_id = ? AND status = 'active' AND candidate_id <> ?`)
          .run(changedAt, owner, project.id, shot.id, candidate.id);
        const hasOutdatedBinding = Boolean(db.prepare(`SELECT 1 FROM video_shot_asset_bindings b
          JOIN video_workbench_assets a ON a.id = b.asset_id
          WHERE b.owner_email = ? AND b.project_id = ? AND b.shot_id = ?
            AND (a.approved_version_id IS NULL OR a.approved_version_id <> b.asset_version_id) LIMIT 1`)
          .get(owner, project.id, shot.id));
        const status = shot.status === 'stale' || hasOutdatedBinding ? 'stale' : 'approved';
        db.prepare(`UPDATE video_storyboard_shots SET selected_candidate_id = ?, status = ?,
          revision = revision + 1, updated_at = ? WHERE id = ?`).run(candidate.id, status, changedAt, shot.id);
        return {
          shot: requireShot(owner, project.id, shot.id),
          candidate: requireCandidate(owner, project.id, shot.id, candidate.id),
        };
      })();
    },

    addTimelineClip({ ownerEmail, projectId, shotId, candidateId, position, trimStartMs = 0, trimEndMs, muted = false }) {
      const { owner, project } = requireProject(ownerEmail, projectId);
      validatePosition(position);
      const shot = requireShot(owner, project.id, shotId);
      requireCandidate(owner, project.id, shot.id, candidateId);
      if (shot.status === 'stale' || shot.selectedCandidateId !== candidateId) {
        throw coded('INVALID_TIMELINE_CANDIDATE', 'timeline clip must use the current candidate of a non-stale shot');
      }
      if (!Number.isSafeInteger(trimStartMs) || trimStartMs < 0 || !Number.isSafeInteger(trimEndMs)
        || trimEndMs <= trimStartMs || trimEndMs > shot.durationMs) {
        throw coded('INVALID_DURATION', 'timeline trim is outside shot duration');
      }
      const id = randomUUID();
      const createdAt = timestamp();
      try {
        db.prepare(`INSERT INTO video_timeline_clips
          (id, owner_email, project_id, shot_id, candidate_id, position, trim_start_ms, trim_end_ms,
           muted, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
          id, owner, project.id, shot.id, candidateId, position, trimStartMs, trimEndMs,
          muted ? 1 : 0, createdAt, createdAt,
        );
      } catch (error) {
        if (/UNIQUE constraint failed/i.test(error.message)) throw coded('INVALID_POSITION', 'timeline position already exists');
        throw error;
      }
      return clipFromRow(db.prepare('SELECT * FROM video_timeline_clips WHERE id = ?').get(id));
    },

    listProjectMemory({ ownerEmail, projectId }) {
      const { owner, project } = requireProject(ownerEmail, projectId);
      const rows = db.prepare(`SELECT * FROM video_project_memory_facts
        WHERE owner_email = ? AND project_id = ? AND status = 'active'
        ORDER BY fact_key, updated_at DESC`).all(owner, project.id);
      return normalizeProjectMemoryList(rows.map(memoryFactFromRow));
    },

    setProjectMemoryFact({ ownerEmail, projectId, key, value, source = 'user', assetRefs = [], expectedRevision = null }) {
      const { owner, project } = requireProject(ownerEmail, projectId);
      const normalized = normalizeProjectMemoryFact({ key, value, source, assetRefs, revision: 1 });
      return db.transaction(() => {
        for (const ref of normalized.assetRefs) {
          const asset = db.prepare(`SELECT approved_version_id FROM video_workbench_assets
            WHERE id = ? AND owner_email = ? AND project_id = ?`).get(ref.assetId, owner, project.id);
          if (!asset) throw coded('MEMORY_ASSET_NOT_FOUND', 'memory asset reference not found');
          if (asset.approved_version_id !== ref.assetVersionId) {
            throw coded('MEMORY_ASSET_VERSION_NOT_APPROVED', 'memory asset version is not approved');
          }
        }
        const currentRow = db.prepare(`SELECT * FROM video_project_memory_facts
          WHERE owner_email = ? AND project_id = ? AND fact_key = ?`).get(owner, project.id, normalized.key);
        if (currentRow) {
          const current = memoryFactFromRow(currentRow);
          if (expectedRevision == null || Number(expectedRevision) !== current.revision) {
            throw coded('VERSION_CONFLICT', 'project memory revision is stale', current);
          }
          const revision = current.revision + 1;
          const changedAt = timestamp();
          db.prepare(`UPDATE video_project_memory_facts SET value_json = ?, source = ?, asset_refs_json = ?,
            status = 'active', revision = ?, updated_at = ?, deleted_at = NULL WHERE id = ?`).run(
            JSON.stringify(normalized.value), normalized.source, JSON.stringify(normalized.assetRefs),
            revision, changedAt, current.id,
          );
          return memoryFactFromRow(db.prepare('SELECT * FROM video_project_memory_facts WHERE id = ?').get(current.id));
        }
        if (expectedRevision != null) throw coded('VERSION_CONFLICT', 'project memory revision is stale');
        const id = randomUUID();
        const createdAt = timestamp();
        db.prepare(`INSERT INTO video_project_memory_facts
          (id, owner_email, project_id, fact_key, value_json, source, asset_refs_json,
           status, revision, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'active', 1, ?, ?)`).run(
          id, owner, project.id, normalized.key, JSON.stringify(normalized.value), normalized.source,
          JSON.stringify(normalized.assetRefs), createdAt, createdAt,
        );
        return memoryFactFromRow(db.prepare('SELECT * FROM video_project_memory_facts WHERE id = ?').get(id));
      })();
    },

    removeProjectMemoryFact({ ownerEmail, projectId, key, expectedRevision }) {
      const { owner, project } = requireProject(ownerEmail, projectId);
      const normalizedKey = normalizeProjectMemoryFact({ key, value: null }).key;
      return db.transaction(() => {
        const row = db.prepare(`SELECT * FROM video_project_memory_facts
          WHERE owner_email = ? AND project_id = ? AND fact_key = ?`).get(owner, project.id, normalizedKey);
        if (!row) throw coded('MEMORY_FACT_NOT_FOUND', 'project memory fact not found');
        const current = memoryFactFromRow(row);
        if (expectedRevision == null || Number(expectedRevision) !== current.revision) {
          throw coded('VERSION_CONFLICT', 'project memory revision is stale', current);
        }
        const changedAt = timestamp();
        db.prepare(`UPDATE video_project_memory_facts SET status = 'deleted', value_json = 'null',
          asset_refs_json = '[]', revision = ?, updated_at = ?, deleted_at = ? WHERE id = ?`).run(
          current.revision + 1, changedAt, changedAt, current.id,
        );
        return memoryFactFromRow(db.prepare('SELECT * FROM video_project_memory_facts WHERE id = ?').get(current.id));
      })();
    },

    createReplayManifest({
      ownerEmail, projectId, skillId, skillVersion, skillRunId = null,
      modelCatalogSnapshot = {}, rightsConfirmations = [],
    }) {
      const { owner, project } = requireProject(ownerEmail, projectId);
      const skillRun = skillRunId ? requireSkillRun(owner, project.id, skillRunId).run : null;
      const manifest = buildReplayManifest({
        workbench: api.listWorkbench({ ownerEmail: owner, projectId: project.id }),
        memory: api.listProjectMemory({ ownerEmail: owner, projectId: project.id }),
        skillId,
        skillVersion,
        skillRun,
        modelCatalogSnapshot,
        rightsConfirmations,
      });
      const existing = db.prepare(`SELECT * FROM video_replay_manifests
        WHERE owner_email = ? AND project_id = ? AND manifest_hash = ?`)
        .get(owner, project.id, manifest.manifestHash);
      if (existing) return replayManifestFromRow(existing);
      const id = randomUUID();
      const createdAt = timestamp();
      try {
        db.prepare(`INSERT INTO video_replay_manifests
          (id, owner_email, project_id, manifest_hash, schema_version, skill_id, skill_version,
           manifest_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
          .run(id, owner, project.id, manifest.manifestHash, manifest.schemaVersion,
            manifest.skill.id, manifest.skill.version, JSON.stringify(manifest), createdAt);
      } catch (error) {
        if (/UNIQUE constraint failed/i.test(error.message)) {
          const raced = db.prepare(`SELECT * FROM video_replay_manifests
            WHERE owner_email = ? AND project_id = ? AND manifest_hash = ?`)
            .get(owner, project.id, manifest.manifestHash);
          if (raced) return replayManifestFromRow(raced);
        }
        throw error;
      }
      return replayManifestFromRow(db.prepare('SELECT * FROM video_replay_manifests WHERE id = ?').get(id));
    },

    getReplayManifest({ ownerEmail, projectId, manifestId }) {
      const { owner, project } = requireProject(ownerEmail, projectId);
      const row = db.prepare(`SELECT * FROM video_replay_manifests
        WHERE id = ? AND owner_email = ? AND project_id = ?`).get(manifestId, owner, project.id);
      if (!row) throw coded('REPLAY_MANIFEST_NOT_FOUND', 'replay manifest not found');
      return replayManifestFromRow(row);
    },

    cloneReplayManifest({ ownerEmail, projectId, manifestId, idempotencyKey, title = '' }) {
      const { owner, project } = requireProject(ownerEmail, projectId);
      const key = clean(idempotencyKey, 200);
      if (!key) throw coded('IDEMPOTENCY_KEY_REQUIRED', 'idempotency key is required');
      const route = 'POST /api/video/projects/:projectId/workbench/replay-manifests/:manifestId/clone';
      return db.transaction(() => {
        const previous = db.prepare(`SELECT response FROM project_idempotency_keys
          WHERE owner_email = ? AND route = ? AND idempotency_key = ?`).get(owner, route, key);
        if (previous) {
          const replayed = parseJson(previous.response, null);
          if (!replayed?.project?.id) throw coded('REPLAY_MANIFEST_CLONE_INVALID', 'stored clone response is invalid');
          return { ...replayed, replayed: true };
        }

        const row = db.prepare(`SELECT * FROM video_replay_manifests
          WHERE id = ? AND owner_email = ? AND project_id = ?`).get(manifestId, owner, project.id);
        if (!row) throw coded('REPLAY_MANIFEST_NOT_FOUND', 'replay manifest not found');
        const manifest = assertReplayManifestIntegrity(row, project);
        const assets = Array.isArray(manifest.assets) ? manifest.assets : [];
        const shots = Array.isArray(manifest.shots) ? manifest.shots : [];
        const clips = Array.isArray(manifest.timelineClips) ? manifest.timelineClips : [];
        const createdAt = timestamp();
        const cloneTitle = clean(title, 200) || `${clean(project.title, 160) || '视频项目'} · 复用`;
        const clonedProject = projectStore.createProject({ ownerEmail: owner, kind: 'video', title: cloneTitle });
        const projectVersionId = randomUUID();
        const inputSnapshot = {
          replay: {
            sourceManifestId: row.id,
            sourceProjectId: project.id,
            manifestHash: row.manifest_hash,
          },
        };
        const planSnapshot = {
          skill: manifest.skill,
          ...(manifest.skillRun ? { skillRun: manifest.skillRun } : {}),
          ...(manifest.memory ? { memory: manifest.memory } : {}),
          modelCatalogSnapshot: manifest.modelCatalogSnapshot || {},
          rightsConfirmations: manifest.rightsConfirmations || [],
          clone: { mode: 'draft', providerSubmission: false, billingMutation: false },
        };
        db.prepare(`INSERT INTO project_versions
          (id, project_id, parent_version_id, reason, sequence, input_snapshot, plan_snapshot, canvas_snapshot_id, created_at)
          VALUES (?, ?, NULL, 'manual_save', 1, ?, ?, NULL, ?)`).run(
          projectVersionId, clonedProject.id, JSON.stringify(inputSnapshot), JSON.stringify(planSnapshot), createdAt,
        );
        db.prepare(`UPDATE projects SET head_version_id = ?, updated_at = ? WHERE id = ?`)
          .run(projectVersionId, createdAt, clonedProject.id);

        const assetIds = new Map();
        const versionIds = new Map();
        const clonedAssetRows = [];
        for (const sourceAsset of assets) {
          const sourceAssetId = clean(sourceAsset?.id, 200);
          if (!sourceAssetId || assetIds.has(sourceAssetId)) throw coded('REPLAY_MANIFEST_CLONE_INVALID', 'duplicate manifest asset');
          const assetId = randomUUID();
          assetIds.set(sourceAssetId, assetId);
          db.prepare(`INSERT INTO video_workbench_assets
            (id, owner_email, project_id, kind, name, status, approved_version_id, revision, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, NULL, 1, ?, ?)`).run(
            assetId, owner, clonedProject.id, clean(sourceAsset.kind, 80), clean(sourceAsset.name, 160),
            clean(sourceAsset.status, 40) || 'draft', createdAt, createdAt,
          );
          clonedAssetRows.push({ sourceAsset, sourceAssetId, assetId });
          const versions = Array.isArray(sourceAsset.versions) ? sourceAsset.versions : [];
          if (!versions.length) throw coded('REPLAY_MANIFEST_CLONE_INVALID', 'manifest asset has no versions');
          for (const sourceVersion of versions) {
            const sourceVersionId = clean(sourceVersion?.id, 200);
            if (!sourceVersionId || versionIds.has(sourceVersionId)) throw coded('REPLAY_MANIFEST_CLONE_INVALID', 'duplicate manifest asset version');
            const versionId = randomUUID();
            versionIds.set(sourceVersionId, versionId);
            db.prepare(`INSERT INTO video_workbench_asset_versions
              (id, asset_id, owner_email, project_id, sequence, source_project_asset_id,
               stable_url, content_hash, mime_type, metadata_json, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
              versionId, assetId, owner, clonedProject.id,
              Number.isSafeInteger(sourceVersion.sequence) ? sourceVersion.sequence : versions.indexOf(sourceVersion) + 1,
              clean(sourceVersion.sourceProjectAssetId, 256) || null,
              clean(sourceVersion.stableUrl, 2000), clean(sourceVersion.contentHash, 256),
              clean(sourceVersion.mimeType, 160), JSON.stringify(sourceVersion.metadata || {}), createdAt,
            );
          }
        }
        for (const { sourceAsset, sourceAssetId, assetId } of clonedAssetRows) {
          const approvedSourceId = clean(sourceAsset.approvedVersionId, 200);
          const approvedVersionId = approvedSourceId ? versionIds.get(approvedSourceId) : null;
          if (approvedSourceId && !approvedVersionId) throw coded('REPLAY_MANIFEST_CLONE_INVALID', 'approved asset version is missing');
          db.prepare(`UPDATE video_workbench_assets SET approved_version_id = ?, status = ?, revision = ? WHERE id = ?`)
            .run(approvedVersionId, approvedVersionId ? 'approved' : (clean(sourceAsset.status, 40) || 'draft'),
              Number.isSafeInteger(sourceAsset.revision) ? sourceAsset.revision : 1, assetId);
          if (!assetIds.has(sourceAssetId)) throw coded('REPLAY_MANIFEST_CLONE_INVALID', 'asset mapping is missing');
        }

        for (const memory of (Array.isArray(manifest.memory) ? manifest.memory : [])) {
          const refs = (Array.isArray(memory.assetRefs) ? memory.assetRefs : []).map(ref => {
            const assetId = assetIds.get(clean(ref?.assetId, 200));
            const assetVersionId = versionIds.get(clean(ref?.assetVersionId, 200));
            if (!assetId || !assetVersionId) throw coded('REPLAY_MANIFEST_CLONE_INVALID', 'memory asset reference is missing');
            return { assetId, assetVersionId };
          });
          db.prepare(`INSERT INTO video_project_memory_facts
            (id, owner_email, project_id, fact_key, value_json, source, asset_refs_json,
             status, revision, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)`).run(
            randomUUID(), owner, clonedProject.id, clean(memory.key, 128), JSON.stringify(memory.value ?? null),
            clean(memory.source, 40) || 'user', JSON.stringify(refs),
            Number.isSafeInteger(memory.revision) && memory.revision > 0 ? memory.revision : 1,
            createdAt, createdAt,
          );
        }

        const shotIds = new Map();
        const candidateIds = new Map();
        for (const sourceShot of shots) {
          const sourceShotId = clean(sourceShot?.id, 200);
          if (!sourceShotId || shotIds.has(sourceShotId)) throw coded('REPLAY_MANIFEST_CLONE_INVALID', 'duplicate manifest shot');
          const shotId = randomUUID();
          shotIds.set(sourceShotId, shotId);
          db.prepare(`INSERT INTO video_storyboard_shots
            (id, owner_email, project_id, position, purpose, duration_ms, camera_language, prompt,
             status, selected_candidate_id, revision, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?)`).run(
            shotId, owner, clonedProject.id,
            Number.isSafeInteger(sourceShot.position) ? sourceShot.position : shots.indexOf(sourceShot),
            clean(sourceShot.purpose, 500), sourceShot.durationMs,
            clean(sourceShot.cameraLanguage, 2000), clean(sourceShot.prompt, 8000),
            clean(sourceShot.status, 40) || 'draft', Number.isSafeInteger(sourceShot.revision) ? sourceShot.revision : 1,
            createdAt, createdAt,
          );
          const bindings = Array.isArray(sourceShot.bindings) ? sourceShot.bindings : [];
          for (const binding of bindings) {
            const assetId = assetIds.get(clean(binding?.assetId, 200));
            const assetVersionId = versionIds.get(clean(binding?.assetVersionId, 200));
            if (!assetId || !assetVersionId) throw coded('REPLAY_MANIFEST_CLONE_INVALID', 'shot binding target is missing');
            db.prepare(`INSERT INTO video_shot_asset_bindings
              (shot_id, asset_id, asset_version_id, owner_email, project_id, role, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
              shotId, assetId, assetVersionId, owner, clonedProject.id, clean(binding.role, 80), createdAt,
            );
          }
          const candidates = Array.isArray(sourceShot.candidates) ? sourceShot.candidates : [];
          for (const sourceCandidate of candidates) {
            const sourceCandidateId = clean(sourceCandidate?.id, 200);
            if (!sourceCandidateId || candidateIds.has(sourceCandidateId)) throw coded('REPLAY_MANIFEST_CLONE_INVALID', 'duplicate manifest candidate');
            const candidateId = randomUUID();
            candidateIds.set(sourceCandidateId, candidateId);
            db.prepare(`INSERT INTO video_shot_candidates
              (id, owner_email, project_id, shot_id, generation_job_id, output_asset_id,
               stable_url, content_hash, mime_type, status, created_at)
              VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?)`).run(
              candidateId, owner, clonedProject.id, shotId, clean(sourceCandidate.outputAssetId, 256),
              clean(sourceCandidate.stableUrl, 2000), clean(sourceCandidate.contentHash, 256),
              clean(sourceCandidate.mimeType, 160), clean(sourceCandidate.status, 40) || 'available', createdAt,
            );
          }
          const selectedSourceId = clean(sourceShot.selectedCandidateId, 200);
          if (selectedSourceId) {
            const selectedId = candidateIds.get(selectedSourceId);
            if (!selectedId) throw coded('REPLAY_MANIFEST_CLONE_INVALID', 'selected candidate is missing');
            db.prepare(`UPDATE video_storyboard_shots SET selected_candidate_id = ? WHERE id = ?`).run(selectedId, shotId);
          }
        }
        for (const clip of clips) {
          const shotId = shotIds.get(clean(clip?.shotId, 200));
          const candidateId = candidateIds.get(clean(clip?.candidateId, 200));
          if (!shotId || !candidateId) throw coded('REPLAY_MANIFEST_CLONE_INVALID', 'timeline clip target is missing');
          db.prepare(`INSERT INTO video_timeline_clips
            (id, owner_email, project_id, shot_id, candidate_id, position, trim_start_ms, trim_end_ms,
             muted, status, revision, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
            randomUUID(), owner, clonedProject.id, shotId, candidateId,
            Number.isSafeInteger(clip.position) ? clip.position : clips.indexOf(clip),
            Number.isSafeInteger(clip.trimStartMs) ? clip.trimStartMs : 0,
            Number.isSafeInteger(clip.trimEndMs) ? clip.trimEndMs : 0,
            clip.muted ? 1 : 0, clean(clip.status, 40) || 'active',
            Number.isSafeInteger(clip.revision) ? clip.revision : 1, createdAt, createdAt,
          );
        }
        const result = {
          project: projectStore.getProject({ ownerEmail: owner, projectId: clonedProject.id }),
          sourceManifestId: row.id,
          sourceManifestHash: row.manifest_hash,
        };
        db.prepare(`INSERT INTO project_idempotency_keys
          (owner_email, route, idempotency_key, response, created_at) VALUES (?, ?, ?, ?, ?)`)
          .run(owner, route, key, JSON.stringify(result), createdAt);
        return { ...result, replayed: false };
      })();
    },

    previewSkillRun({ ownerEmail, projectId, idempotencyKey, spec }) {
      const { owner, project } = requireProject(ownerEmail, projectId);
      const key = clean(idempotencyKey, 200);
      if (!key) throw coded('IDEMPOTENCY_KEY_REQUIRED', 'idempotency key is required');
      const plan = normalizeSkillRunSpec(spec);
      const route = 'POST /api/video/projects/:projectId/workbench/skill-runs/preview';
      return db.transaction(() => {
        const previous = db.prepare(`SELECT response FROM project_idempotency_keys
          WHERE owner_email = ? AND route = ? AND idempotency_key = ?`).get(owner, route, key);
        if (previous) {
          const replayed = parseJson(previous.response, null);
          if (!replayed?.id) throw coded('SKILL_RUN_IDEMPOTENCY_INVALID', 'stored skill run response is invalid');
          return { ...replayed, replayed: true };
        }
        const createdAt = timestamp();
        const runId = randomUUID();
        db.prepare(`INSERT INTO video_skill_runs
          (id, owner_email, project_id, skill_id, skill_version, status, input_json, plan_json,
           revision, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, 'preview', ?, ?, 1, ?, ?)`).run(
          runId, owner, project.id, plan.skillId, plan.skillVersion,
          JSON.stringify(plan.input), JSON.stringify(plan), createdAt, createdAt,
        );
        db.prepare(`INSERT INTO video_skill_run_events
          (id, run_id, owner_email, project_id, sequence, type, payload_json, actor_email, created_at)
          VALUES (?, ?, ?, ?, 1, 'skill-run.preview', ?, ?, ?)`).run(
          randomUUID(), runId, owner, project.id,
          JSON.stringify({ skillId: plan.skillId, skillVersion: plan.skillVersion,
            stepCount: plan.steps.length, checkpointCount: plan.checkpoints.length }), owner, createdAt,
        );
        const result = requireSkillRun(owner, project.id, runId).run;
        db.prepare(`INSERT INTO project_idempotency_keys
          (owner_email, route, idempotency_key, response, created_at) VALUES (?, ?, ?, ?, ?)`)
          .run(owner, route, key, JSON.stringify(result), createdAt);
        return { ...result, replayed: false };
      })();
    },

    getSkillRun({ ownerEmail, projectId, runId }) {
      const { owner, project } = requireProject(ownerEmail, projectId);
      return requireSkillRun(owner, project.id, runId).run;
    },

    confirmSkillCheckpoint({ ownerEmail, projectId, runId, checkpointId, expectedRevision }) {
      const { owner, project } = requireProject(ownerEmail, projectId);
      const normalizedCheckpointId = clean(checkpointId, 128);
      if (!normalizedCheckpointId) throw coded('INVALID_SKILL_RUN', 'checkpoint id is required');
      if (!Number.isSafeInteger(Number(expectedRevision))) throw coded('VERSION_CONFLICT', 'skill run revision is required');
      return db.transaction(() => {
        const current = requireSkillRun(owner, project.id, runId);
        if (current.row.revision !== Number(expectedRevision)) {
          throw coded('VERSION_CONFLICT', 'skill run revision conflict', current.run);
        }
        const checkpoints = Array.isArray(current.run.plan?.checkpoints) ? current.run.plan.checkpoints : [];
        if (!checkpoints.some(checkpoint => checkpoint.id === normalizedCheckpointId)) {
          throw coded('INVALID_SKILL_RUN', 'checkpoint is not declared by the skill');
        }
        if (current.row.status !== 'preview') {
          throw coded('INVALID_SKILL_RUN', 'skill run is not awaiting confirmation');
        }
        const changedAt = timestamp();
        const nextRevision = current.row.revision + 1;
        db.prepare(`UPDATE video_skill_runs SET status = 'confirmed', revision = ?, updated_at = ? WHERE id = ?`)
          .run(nextRevision, changedAt, runId);
        db.prepare(`INSERT INTO video_skill_run_events
          (id, run_id, owner_email, project_id, sequence, type, payload_json, actor_email, created_at)
          VALUES (?, ?, ?, ?, ?, 'checkpoint.confirmed', ?, ?, ?)`).run(
          randomUUID(), runId, owner, project.id, nextRevision,
          JSON.stringify({ checkpointId: normalizedCheckpointId, revision: nextRevision }), owner, changedAt,
        );
        return requireSkillRun(owner, project.id, runId).run;
      })();
    },

    completeSkillRunStep({ ownerEmail, projectId, runId, stepId, expectedRevision }) {
      const { owner, project } = requireProject(ownerEmail, projectId);
      const normalizedStepId = clean(stepId, 128);
      if (!normalizedStepId) throw coded('INVALID_SKILL_RUN', 'step id is required');
      if (!Number.isSafeInteger(Number(expectedRevision))) throw coded('VERSION_CONFLICT', 'skill run revision is required');
      return db.transaction(() => {
        const current = requireSkillRun(owner, project.id, runId);
        if (current.row.revision !== Number(expectedRevision)) {
          throw coded('VERSION_CONFLICT', 'skill run revision conflict', current.run);
        }
        const steps = Array.isArray(current.run.plan?.steps) ? current.run.plan.steps : [];
        const step = steps.find(candidate => candidate.id === normalizedStepId);
        if (!step) throw coded('INVALID_SKILL_RUN', 'step is not declared by the skill');
        if (current.run.executionPlan.completedStepIds.includes(normalizedStepId)) {
          throw coded('INVALID_SKILL_RUN', 'skill step is already complete');
        }
        if (step.requires.some(dependency => !current.run.executionPlan.completedStepIds.includes(dependency))) {
          throw coded('INVALID_SKILL_RUN', 'skill step dependencies are incomplete');
        }
        const changedAt = timestamp();
        const nextRevision = current.row.revision + 1;
        const nextStatus = current.run.executionPlan.completedStepIds.length + 1 === steps.length
          ? 'complete' : 'running';
        db.prepare(`UPDATE video_skill_runs SET status = ?, revision = ?, updated_at = ? WHERE id = ?`)
          .run(nextStatus, nextRevision, changedAt, runId);
        db.prepare(`INSERT INTO video_skill_run_events
          (id, run_id, owner_email, project_id, sequence, type, payload_json, actor_email, created_at)
          VALUES (?, ?, ?, ?, ?, 'step.completed', ?, ?, ?)`).run(
          randomUUID(), runId, owner, project.id, nextRevision,
          JSON.stringify({ stepId: normalizedStepId, revision: nextRevision }), owner, changedAt,
        );
        return requireSkillRun(owner, project.id, runId).run;
      })();
    },

    listWorkbench({ ownerEmail, projectId }) {
      const { owner, project } = requireProject(ownerEmail, projectId);
      const assets = db.prepare(`SELECT * FROM video_workbench_assets
        WHERE owner_email = ? AND project_id = ? ORDER BY created_at, id`).all(owner, project.id).map(assetFromRow);
      const versions = db.prepare(`SELECT * FROM video_workbench_asset_versions
        WHERE owner_email = ? AND project_id = ? ORDER BY asset_id, sequence`).all(owner, project.id).map(versionFromRow);
      const bindings = db.prepare(`SELECT * FROM video_shot_asset_bindings
        WHERE owner_email = ? AND project_id = ? ORDER BY created_at, asset_id`).all(owner, project.id).map(bindingFromRow);
      const candidates = db.prepare(`SELECT * FROM video_shot_candidates
        WHERE owner_email = ? AND project_id = ? ORDER BY created_at, id`).all(owner, project.id).map(candidateFromRow);
      const shots = db.prepare(`SELECT * FROM video_storyboard_shots
        WHERE owner_email = ? AND project_id = ? ORDER BY position, created_at`).all(owner, project.id).map(row => ({
        ...shotFromRow(row),
        bindings: bindings.filter(item => item.shotId === row.id),
        candidates: candidates.filter(item => item.shotId === row.id),
      }));
      const timelineClips = db.prepare(`SELECT * FROM video_timeline_clips
        WHERE owner_email = ? AND project_id = ? ORDER BY position, created_at`).all(owner, project.id).map(clipFromRow);
      return {
        project,
        assets: assets.map(asset => ({ ...asset, versions: versions.filter(version => version.assetId === asset.id) })),
        shots,
        timelineClips,
        memory: api.listProjectMemory({ ownerEmail: owner, projectId: project.id }),
      };
    },

    recordOperation({ ownerEmail, projectId, action, outcome, latencyMs = 0, errorCode = '' }) {
      const { owner, project } = requireProject(ownerEmail, projectId);
      const normalizedAction = clean(action, 120);
      const normalizedOutcome = clean(outcome, 20);
      if (!normalizedAction || !['success', 'failure'].includes(normalizedOutcome)) {
        throw coded('INVALID_OPERATION', 'operation fields are invalid');
      }
      const latency = Number.isFinite(Number(latencyMs))
        ? Math.max(0, Math.min(86_400_000, Math.round(Number(latencyMs))))
        : 0;
      db.prepare(`INSERT INTO video_workbench_operations
        (id, owner_email, project_id, action, outcome, latency_ms, error_code, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
        randomUUID(), owner, project.id, normalizedAction, normalizedOutcome, latency,
        clean(errorCode, 120), timestamp(),
      );
      return { recorded: true };
    },

    operationalMetrics() {
      const cutoff = operationCutoff();
      const operationRows = db.prepare(`SELECT action, outcome, latency_ms
        FROM video_workbench_operations WHERE created_at >= ?
        ORDER BY latency_ms ASC`).all(cutoff);
      const total = operationRows.length;
      const failed = operationRows.filter(row => row.outcome === 'failure').length;
      const latencies = operationRows.map(row => Number(row.latency_ms) || 0);
      const p95Index = total ? Math.min(total - 1, Math.ceil(total * 0.95) - 1) : -1;
      const byAction = new Map();
      for (const row of operationRows) {
        const current = byAction.get(row.action) || { action: row.action, total: 0, failed: 0 };
        current.total += 1;
        if (row.outcome === 'failure') current.failed += 1;
        byAction.set(row.action, current);
      }
      const funnel = {
        projectsStarted: db.prepare('SELECT COUNT(DISTINCT project_id) AS count FROM video_workbench_assets').get().count,
        approvedAssetProjects: db.prepare(`SELECT COUNT(DISTINCT project_id) AS count
          FROM video_workbench_assets WHERE approved_version_id IS NOT NULL`).get().count,
        storyboardReadyProjects: db.prepare(`SELECT COUNT(DISTINCT s.project_id) AS count
          FROM video_storyboard_shots s
          JOIN video_shot_asset_bindings b ON b.shot_id = s.id
          JOIN video_workbench_assets a ON a.id = b.asset_id AND a.approved_version_id = b.asset_version_id
          WHERE s.status <> 'stale'`).get().count,
        candidateReadyProjects: db.prepare(`SELECT COUNT(DISTINCT project_id) AS count
          FROM video_shot_candidates WHERE status IN ('available', 'selected')`).get().count,
        timelineReadyProjects: db.prepare(`SELECT COUNT(DISTINCT project_id) AS count
          FROM video_timeline_clips WHERE status = 'active'`).get().count,
      };
      const health = {
        staleShots: db.prepare("SELECT COUNT(*) AS count FROM video_storyboard_shots WHERE status = 'stale'").get().count,
        staleClips: db.prepare("SELECT COUNT(*) AS count FROM video_timeline_clips WHERE status = 'stale'").get().count,
      };
      return {
        generatedAt: timestamp(),
        funnel,
        health,
        operations24h: {
          total,
          succeeded: total - failed,
          failed,
          successRate: total ? Number(((total - failed) / total).toFixed(4)) : null,
          p95LatencyMs: p95Index >= 0 ? latencies[p95Index] : null,
          byAction: [...byAction.values()].sort((left, right) => right.total - left.total),
        },
        gate: {
          minimumProjects: 10,
          minimumStoryboardReadyProjects: 10,
          ready: funnel.projectsStarted >= 10
            && funnel.storyboardReadyProjects >= 10
            && health.staleShots === 0
            && health.staleClips === 0,
        },
      };
    },
  };

  return api;
}
