import crypto from 'node:crypto';

const ASSET_KINDS = new Set(['product', 'person', 'wardrobe', 'scene', 'prop', 'style', 'voice', 'music']);
const BINDING_ROLES = new Set([
  'subject', 'product', 'wardrobe', 'scene', 'prop', 'style', 'voice', 'music',
  'first_frame', 'last_frame', 'motion_reference',
]);
const SHOT_PATCH_FIELDS = new Set(['position', 'purpose', 'durationMs', 'cameraLanguage', 'prompt']);

function coded(code, message = code, current = null) {
  return Object.assign(new Error(message), { code, current });
}

function normalizeOwner(value) {
  return String(value || '').trim().toLowerCase();
}

function clean(value, max = 1000) {
  return String(value ?? '').trim().slice(0, max);
}

function parseJson(value, fallback) {
  try { return value ? JSON.parse(value) : fallback; } catch { return fallback; }
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
        WHERE id = ? AND owner_email = ?`).get(jobId, owner) : null;
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
      };
    },
  };

  return api;
}
