import crypto from 'node:crypto';

const PROJECT_KINDS = new Set(['ecommerce', 'xiaohongshu', 'plog']);
const VERSION_REASONS = new Set(['generation', 'manual_save', 'canvas_save', 'accepted_result', 'migration']);
const CHECKPOINT_REASONS = new Set(['payment_required', 'generation_interrupted', 'session_interrupted']);
const DAY_MS = 24 * 60 * 60 * 1000;

function normalizeOwner(value) {
  return String(value || '').trim().toLowerCase();
}
function parse(value, fallback) {
  try { return value ? JSON.parse(value) : fallback; } catch { return fallback; }
}

function codedError(code, message) {
  return Object.assign(new Error(message), { code });
}

function projectFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    ownerEmail: row.owner_email,
    kind: row.kind,
    title: row.title,
    status: row.status,
    headVersionId: row.head_version_id,
    acceptedVersionId: row.accepted_version_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
    deletedAt: row.deleted_at,
  };
}

function versionFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id,
    parentVersionId: row.parent_version_id,
    reason: row.reason,
    sequence: row.sequence,
    inputSnapshot: parse(row.input_snapshot, {}),
    planSnapshot: parse(row.plan_snapshot, {}),
    canvasSnapshotId: row.canvas_snapshot_id,
    createdAt: row.created_at,
  };
}

function checkpointFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    ownerEmail: row.owner_email,
    projectId: row.project_id,
    versionId: row.version_id,
    generationRunId: row.generation_run_id,
    reason: row.reason,
    status: row.status,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  };
}

function canvasFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    ownerEmail: row.owner_email,
    projectId: row.project_id,
    baseVersionId: row.base_version_id,
    status: row.status,
    revision: row.revision,
    snapshot: parse(row.snapshot, {}),
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function runFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id,
    sourceVersionId: row.source_version_id,
    resultVersionId: row.result_version_id,
    ownerEmail: row.owner_email,
    kind: row.kind,
    status: row.status,
    quoteId: row.quote_id,
    holdId: row.hold_id,
    progress: parse(row.progress, {}),
    errorCode: row.error_code,
    createdAt: row.created_at,
    completedAt: row.completed_at,
  };
}

export function createProjectStore(db, {
  randomUUID = crypto.randomUUID,
  now = () => new Date(),
  checkpointTtlMs = DAY_MS,
  canvasTtlMs = DAY_MS,
} = {}) {
  const timestamp = () => {
    const value = now();
    const date = value instanceof Date ? value : new Date(value);
    if (!Number.isFinite(date.getTime())) throw new TypeError('now must return a valid date');
    return date;
  };
  const requireProject = (ownerEmail, projectId) => {
    const project = projectFromRow(db.prepare('SELECT * FROM projects WHERE id = ? AND owner_email = ? AND deleted_at IS NULL').get(projectId, normalizeOwner(ownerEmail)));
    if (!project) throw codedError('PROJECT_NOT_FOUND', 'project not found');
    return project;
  };
  const requireVersion = (projectId, versionId) => {
    const version = versionFromRow(db.prepare('SELECT * FROM project_versions WHERE id = ? AND project_id = ?').get(versionId, projectId));
    if (!version) throw codedError('VERSION_NOT_FOUND', 'project version not found');
    return version;
  };
  const hydrateCheckpoint = row => {
    const checkpoint = checkpointFromRow(row);
    if (!checkpoint) return null;
    const project = requireProject(checkpoint.ownerEmail, checkpoint.projectId);
    const version = requireVersion(project.id, checkpoint.versionId);
    return { ...checkpoint, project, version };
  };
  const insertProject = ({ ownerEmail, kind, title = '' }) => {
    const owner = normalizeOwner(ownerEmail);
    if (!owner) throw new TypeError('ownerEmail is required');
    if (!PROJECT_KINDS.has(kind)) throw new TypeError('unknown project kind');
    const id = randomUUID();
    const createdAt = timestamp().toISOString();
    db.prepare(`INSERT INTO projects (id, owner_email, kind, title, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'editing', ?, ?)`).run(id, owner, kind, String(title || '').trim(), createdAt, createdAt);
    return projectFromRow(db.prepare('SELECT * FROM projects WHERE id = ?').get(id));
  };

  const api = {
    createProject({ ownerEmail, kind, title = '' }) {
      return insertProject({ ownerEmail, kind, title });
    },

    createProjectIdempotent({ ownerEmail, idempotencyKey, kind, title = '' }) {
      const owner = normalizeOwner(ownerEmail);
      const key = String(idempotencyKey || '').trim();
      if (!key) throw codedError('IDEMPOTENCY_KEY_REQUIRED', 'idempotency key is required');
      return db.transaction(() => {
        const previous = db.prepare(`SELECT response FROM project_idempotency_keys
          WHERE owner_email = ? AND route = 'POST /api/projects' AND idempotency_key = ?`).get(owner, key);
        if (previous) return { project: parse(previous.response, {}), replayed: true };
        const project = insertProject({ ownerEmail: owner, kind, title });
        db.prepare(`INSERT INTO project_idempotency_keys (owner_email, route, idempotency_key, response, created_at)
          VALUES (?, 'POST /api/projects', ?, ?, ?)`).run(owner, key, JSON.stringify(project), timestamp().toISOString());
        return { project, replayed: false };
      })();
    },

    getProject({ ownerEmail, projectId }) {
      return projectFromRow(db.prepare('SELECT * FROM projects WHERE id = ? AND owner_email = ? AND deleted_at IS NULL').get(projectId, normalizeOwner(ownerEmail)));
    },

    listProjects({ ownerEmail, includeCompleted = true } = {}) {
      const owner = normalizeOwner(ownerEmail);
      const rows = includeCompleted
        ? db.prepare('SELECT * FROM projects WHERE owner_email = ? AND deleted_at IS NULL ORDER BY updated_at DESC').all(owner)
        : db.prepare("SELECT * FROM projects WHERE owner_email = ? AND deleted_at IS NULL AND status <> 'completed' ORDER BY updated_at DESC").all(owner);
      return rows.map(projectFromRow);
    },

    createVersion({ ownerEmail, projectId, parentVersionId = null, reason, inputSnapshot = {}, planSnapshot = {}, canvasSnapshotId = null }) {
      if (!VERSION_REASONS.has(reason)) throw new TypeError('unknown version reason');
      return db.transaction(() => {
        const project = requireProject(ownerEmail, projectId);
        if (parentVersionId) requireVersion(project.id, parentVersionId);
        const sequence = db.prepare('SELECT COALESCE(MAX(sequence), 0) + 1 AS value FROM project_versions WHERE project_id = ?').get(project.id).value;
        const id = randomUUID();
        const createdAt = timestamp().toISOString();
        db.prepare(`INSERT INTO project_versions
          (id, project_id, parent_version_id, reason, sequence, input_snapshot, plan_snapshot, canvas_snapshot_id, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
          id, project.id, parentVersionId, reason, sequence,
          JSON.stringify(inputSnapshot || {}), JSON.stringify(planSnapshot || {}), canvasSnapshotId, createdAt,
        );
        db.prepare('UPDATE projects SET head_version_id = ?, updated_at = ? WHERE id = ?').run(id, createdAt, project.id);
        return versionFromRow(db.prepare('SELECT * FROM project_versions WHERE id = ?').get(id));
      })();
    },

    createCheckpoint({ ownerEmail, projectId, versionId, generationRunId = null, reason, expiresAt = null }) {
      if (!CHECKPOINT_REASONS.has(reason)) throw new TypeError('unknown checkpoint reason');
      const project = requireProject(ownerEmail, projectId);
      requireVersion(project.id, versionId);
      const created = timestamp();
      const id = randomUUID();
      const expiry = expiresAt ? new Date(expiresAt) : new Date(created.getTime() + checkpointTtlMs);
      if (!Number.isFinite(expiry.getTime())) throw new TypeError('expiresAt must be a valid date');
      db.prepare(`INSERT INTO recovery_checkpoints
        (id, owner_email, project_id, version_id, generation_run_id, reason, status, expires_at, created_at)
        VALUES (?, ?, ?, ?, ?, ?, 'available', ?, ?)`).run(
        id, project.ownerEmail, project.id, versionId, generationRunId, reason, expiry.toISOString(), created.toISOString(),
      );
      return hydrateCheckpoint(db.prepare('SELECT * FROM recovery_checkpoints WHERE id = ?').get(id));
    },

    listCheckpoints({ ownerEmail }) {
      const current = timestamp().toISOString();
      return db.prepare(`SELECT * FROM recovery_checkpoints
        WHERE owner_email = ? AND status = 'available' AND expires_at > ? ORDER BY created_at DESC`)
        .all(normalizeOwner(ownerEmail), current).map(hydrateCheckpoint);
    },

    consumeCheckpoint({ ownerEmail, checkpointId }) {
      const changed = db.prepare(`UPDATE recovery_checkpoints SET status = 'consumed'
        WHERE id = ? AND owner_email = ? AND status = 'available' AND expires_at > ?`)
        .run(checkpointId, normalizeOwner(ownerEmail), timestamp().toISOString()).changes;
      return changed === 1 ? hydrateCheckpoint(db.prepare('SELECT * FROM recovery_checkpoints WHERE id = ?').get(checkpointId)) : null;
    },

    dismissCheckpoint({ ownerEmail, checkpointId }) {
      const changed = db.prepare(`UPDATE recovery_checkpoints SET status = 'dismissed'
        WHERE id = ? AND owner_email = ? AND status = 'available'`).run(checkpointId, normalizeOwner(ownerEmail)).changes;
      return changed === 1 ? checkpointFromRow(db.prepare('SELECT * FROM recovery_checkpoints WHERE id = ?').get(checkpointId)) : null;
    },

    createCanvasSession({ ownerEmail, projectId, baseVersionId, snapshot = {}, expiresAt = null }) {
      const project = requireProject(ownerEmail, projectId);
      requireVersion(project.id, baseVersionId);
      const created = timestamp();
      const expiry = expiresAt ? new Date(expiresAt) : new Date(created.getTime() + canvasTtlMs);
      const id = randomUUID();
      db.prepare(`INSERT INTO canvas_sessions
        (id, owner_email, project_id, base_version_id, status, revision, snapshot, expires_at, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'active', 1, ?, ?, ?, ?)`).run(
        id, project.ownerEmail, project.id, baseVersionId, JSON.stringify(snapshot || {}), expiry.toISOString(), created.toISOString(), created.toISOString(),
      );
      return api.getCanvasSession({ ownerEmail: project.ownerEmail, sessionId: id });
    },

    getCanvasSession({ ownerEmail, sessionId }) {
      return canvasFromRow(db.prepare('SELECT * FROM canvas_sessions WHERE id = ? AND owner_email = ?').get(sessionId, normalizeOwner(ownerEmail)));
    },

    saveCanvasSession({ ownerEmail, sessionId, expectedRevision, snapshot }) {
      if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 1) throw new TypeError('expectedRevision must be a positive integer');
      const updatedAt = timestamp().toISOString();
      const changed = db.prepare(`UPDATE canvas_sessions
        SET snapshot = ?, revision = revision + 1, status = 'saved', updated_at = ?
        WHERE id = ? AND owner_email = ? AND revision = ? AND status IN ('active', 'saved')`)
        .run(JSON.stringify(snapshot || {}), updatedAt, sessionId, normalizeOwner(ownerEmail), expectedRevision).changes;
      if (changed !== 1) throw codedError('VERSION_CONFLICT', 'canvas session revision changed');
      return api.getCanvasSession({ ownerEmail, sessionId });
    },

    discardCanvasSession({ ownerEmail, sessionId }) {
      const changed = db.prepare(`UPDATE canvas_sessions SET status = 'discarded', updated_at = ?
        WHERE id = ? AND owner_email = ? AND status <> 'discarded'`)
        .run(timestamp().toISOString(), sessionId, normalizeOwner(ownerEmail)).changes;
      return changed === 1 ? api.getCanvasSession({ ownerEmail, sessionId }) : null;
    },

    ensureEcommerceGeneration({
      ownerEmail,
      generationRunId,
      title = '',
      inputSnapshot = {},
      planSnapshot = {},
      quoteId = null,
      holdId = null,
    }) {
      const owner = normalizeOwner(ownerEmail);
      const runId = String(generationRunId || '').trim();
      if (!owner) throw new TypeError('ownerEmail is required');
      if (!runId) throw new TypeError('generationRunId is required');
      return db.transaction(() => {
        const existingRun = db.prepare('SELECT * FROM project_generation_runs WHERE id = ? AND owner_email = ?').get(runId, owner);
        if (existingRun) {
          const run = runFromRow(existingRun);
          return {
            project: requireProject(owner, run.projectId),
            sourceVersion: requireVersion(run.projectId, run.sourceVersionId),
            run,
          };
        }
        const project = insertProject({ ownerEmail: owner, kind: 'ecommerce', title });
        const sourceVersionId = randomUUID();
        const createdAt = timestamp().toISOString();
        db.prepare(`INSERT INTO project_versions
          (id, project_id, parent_version_id, reason, sequence, input_snapshot, plan_snapshot, canvas_snapshot_id, created_at)
          VALUES (?, ?, NULL, 'generation', 1, ?, ?, NULL, ?)`).run(
          sourceVersionId,
          project.id,
          JSON.stringify(inputSnapshot || {}),
          JSON.stringify(planSnapshot || {}),
          createdAt,
        );
        db.prepare("UPDATE projects SET status = 'running', head_version_id = ?, updated_at = ? WHERE id = ?")
          .run(sourceVersionId, createdAt, project.id);
        db.prepare(`INSERT INTO project_generation_runs
          (id, project_id, source_version_id, owner_email, kind, status, quote_id, hold_id, progress, created_at)
          VALUES (?, ?, ?, ?, 'ecommerce', 'queued', ?, ?, '{}', ?)`).run(
          runId, project.id, sourceVersionId, owner, quoteId, holdId, createdAt,
        );
        return {
          project: requireProject(owner, project.id),
          sourceVersion: requireVersion(project.id, sourceVersionId),
          run: runFromRow(db.prepare('SELECT * FROM project_generation_runs WHERE id = ?').get(runId)),
        };
      }).immediate();
    },

    completeEcommerceGeneration({
      ownerEmail,
      generationRunId,
      terminalStatus = 'completed',
      resultInputSnapshot = {},
      resultPlanSnapshot = {},
    }) {
      const owner = normalizeOwner(ownerEmail);
      const runId = String(generationRunId || '').trim();
      const resultStatus = String(terminalStatus || '').trim().toLowerCase();
      if (!['completed', 'needs_review'].includes(resultStatus)) {
        throw new TypeError('terminalStatus must be completed or needs_review');
      }
      return db.transaction(() => {
        const runRow = db.prepare('SELECT * FROM project_generation_runs WHERE id = ? AND owner_email = ?').get(runId, owner);
        if (!runRow) throw codedError('GENERATION_RUN_NOT_FOUND', 'generation run not found');
        const run = runFromRow(runRow);
        const project = requireProject(owner, run.projectId);
        const sourceVersion = requireVersion(project.id, run.sourceVersionId);
        if (run.resultVersionId) {
          return {
            project,
            sourceVersion,
            resultVersion: requireVersion(project.id, run.resultVersionId),
            run,
          };
        }
        const resultVersionId = randomUUID();
        const completedAt = timestamp().toISOString();
        const versionReason = resultStatus === 'completed' ? 'accepted_result' : 'manual_save';
        const sequence = db.prepare('SELECT COALESCE(MAX(sequence), 0) + 1 AS value FROM project_versions WHERE project_id = ?').get(project.id).value;
        db.prepare(`INSERT INTO project_versions
          (id, project_id, parent_version_id, reason, sequence, input_snapshot, plan_snapshot, canvas_snapshot_id, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?)`).run(
          resultVersionId,
          project.id,
          sourceVersion.id,
          versionReason,
          sequence,
          JSON.stringify(resultInputSnapshot || {}),
          JSON.stringify(resultPlanSnapshot || {}),
          completedAt,
        );
        if (resultStatus === 'completed') {
          db.prepare(`UPDATE projects SET status = 'completed', accepted_version_id = ?, head_version_id = ?, completed_at = ?, updated_at = ?
            WHERE id = ? AND owner_email = ?`).run(
            resultVersionId, resultVersionId, completedAt, completedAt, project.id, owner,
          );
        } else {
          db.prepare(`UPDATE projects SET status = 'needs_review', accepted_version_id = NULL, head_version_id = ?, completed_at = NULL, updated_at = ?
            WHERE id = ? AND owner_email = ?`).run(
            resultVersionId, completedAt, project.id, owner,
          );
        }
        db.prepare(`UPDATE project_generation_runs SET status = ?, result_version_id = ?, completed_at = ?
          WHERE id = ? AND project_id = ? AND owner_email = ?`).run(
          resultStatus, resultVersionId, completedAt, runId, project.id, owner,
        );
        db.prepare("UPDATE recovery_checkpoints SET status = 'consumed' WHERE project_id = ? AND owner_email = ? AND status = 'available'")
          .run(project.id, owner);
        return {
          project: requireProject(owner, project.id),
          sourceVersion,
          resultVersion: requireVersion(project.id, resultVersionId),
          run: runFromRow(db.prepare('SELECT * FROM project_generation_runs WHERE id = ?').get(runId)),
        };
      }).immediate();
    },

    terminateEcommerceGeneration({ ownerEmail, generationRunId, terminalStatus }) {
      const owner = normalizeOwner(ownerEmail);
      const runId = String(generationRunId || '').trim();
      const runStatus = String(terminalStatus || '').trim().toLowerCase();
      if (!owner) throw new TypeError('ownerEmail is required');
      if (!runId) throw new TypeError('generationRunId is required');
      if (!['needs_review', 'failed', 'cancelled'].includes(runStatus)) {
        throw new TypeError('terminalStatus must be needs_review, failed, or cancelled');
      }
      return db.transaction(() => {
        const runRow = db.prepare('SELECT * FROM project_generation_runs WHERE id = ? AND owner_email = ?').get(runId, owner);
        if (!runRow) throw codedError('GENERATION_RUN_NOT_FOUND', 'generation run not found');
        const run = runFromRow(runRow);
        const project = requireProject(owner, run.projectId);
        const sourceVersion = requireVersion(project.id, run.sourceVersionId);
        if (run.resultVersionId) {
          return {
            project,
            sourceVersion,
            resultVersion: requireVersion(project.id, run.resultVersionId),
            run,
          };
        }
        const terminalAt = timestamp().toISOString();
        const projectStatus = runStatus === 'needs_review' ? 'needs_review' : 'abandoned';
        db.prepare(`UPDATE projects SET status = ?, accepted_version_id = NULL, completed_at = NULL, updated_at = ?
          WHERE id = ? AND owner_email = ?`).run(projectStatus, terminalAt, project.id, owner);
        db.prepare(`UPDATE project_generation_runs SET status = ?, result_version_id = NULL, completed_at = ?
          WHERE id = ? AND project_id = ? AND owner_email = ?`).run(
          runStatus, terminalAt, runId, project.id, owner,
        );
        db.prepare("UPDATE recovery_checkpoints SET status = 'consumed' WHERE project_id = ? AND owner_email = ? AND status = 'available'")
          .run(project.id, owner);
        return {
          project: requireProject(owner, project.id),
          sourceVersion,
          resultVersion: null,
          run: runFromRow(db.prepare('SELECT * FROM project_generation_runs WHERE id = ?').get(runId)),
        };
      }).immediate();
    },

    linkGenerationRun({ ownerEmail, projectId, sourceVersionId, generationRunId = randomUUID(), kind, quoteId = null, holdId = null, progress = {} }) {
      const project = requireProject(ownerEmail, projectId);
      requireVersion(project.id, sourceVersionId);
      if (!PROJECT_KINDS.has(kind)) throw new TypeError('unknown generation kind');
      const createdAt = timestamp().toISOString();
      db.transaction(() => {
        db.prepare(`INSERT INTO project_generation_runs
          (id, project_id, source_version_id, owner_email, kind, status, quote_id, hold_id, progress, created_at)
          VALUES (?, ?, ?, ?, ?, 'queued', ?, ?, ?, ?)`).run(
          generationRunId, project.id, sourceVersionId, project.ownerEmail, kind, quoteId, holdId, JSON.stringify(progress || {}), createdAt,
        );
        db.prepare("UPDATE projects SET status = 'running', updated_at = ? WHERE id = ?").run(createdAt, project.id);
      })();
      return runFromRow(db.prepare('SELECT * FROM project_generation_runs WHERE id = ?').get(generationRunId));
    },

    completeProject({ ownerEmail, projectId, acceptedVersionId, generationRunId = null }) {
      const project = requireProject(ownerEmail, projectId);
      requireVersion(project.id, acceptedVersionId);
      const completedAt = timestamp().toISOString();
      db.transaction(() => {
        db.prepare(`UPDATE projects SET status = 'completed', accepted_version_id = ?, head_version_id = ?, completed_at = ?, updated_at = ?
          WHERE id = ? AND owner_email = ?`).run(acceptedVersionId, acceptedVersionId, completedAt, completedAt, project.id, project.ownerEmail);
        if (generationRunId) {
          db.prepare(`UPDATE project_generation_runs SET status = 'completed', result_version_id = ?, completed_at = ?
            WHERE id = ? AND project_id = ? AND owner_email = ?`).run(acceptedVersionId, completedAt, generationRunId, project.id, project.ownerEmail);
        }
        db.prepare("UPDATE recovery_checkpoints SET status = 'consumed' WHERE project_id = ? AND owner_email = ? AND status = 'available'")
          .run(project.id, project.ownerEmail);
      })();
      return api.getProject({ ownerEmail: project.ownerEmail, projectId: project.id });
    },
  };

  return api;
}
