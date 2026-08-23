import crypto from 'node:crypto';
import { buildReplayManifest, canonicalReplayManifest } from './videoReplayManifest.mjs';
import { assertVideoExportManifestIntegrity, buildVideoExportManifest } from './videoExportManifest.mjs';
import { buildVideoRendererRequest } from './videoRendererAdapter.mjs';
import {
  cancelVideoRendererOutboxEvent,
  claimVideoRendererOutboxEvent,
  completeVideoRendererOutboxEvent,
  createVideoRendererOutboxEvent,
  failVideoRendererOutboxEvent,
  recoverExpiredVideoRendererOutboxEvent,
  renewVideoRendererOutboxLease,
  assertVideoRendererOutboxIntegrity,
} from './videoRendererOutbox.mjs';
import {
  assertVideoExportJobCurrent,
  assertVideoExportJobIntegrity,
  claimVideoExportJob,
  createVideoExportJob,
  recoverExpiredVideoExportJob,
  renewVideoExportJobLease,
  transitionVideoExportJob,
} from './videoExportJob.mjs';
import { normalizeProjectMemoryFact, normalizeProjectMemoryList } from './videoProjectMemory.mjs';
import {
  buildSkillRunExecutionPlan,
  buildSkillRunExecutionPreview,
  normalizeSkillRunSpec,
} from './videoSkillRun.mjs';
import { listVideoSkillTemplates } from './videoSkillTemplates.mjs';
import { buildVideoWorkbenchPlan, videoWorkbenchPlanFingerprint } from './videoWorkbenchPlan.mjs';
import { assertVideoRendererPreflightIntegrity } from './videoRendererPreflight.mjs';
import { normalizeShotDirection } from './videoShotDirection.mjs';
import { normalizeVideoProvenance, verifiedVideoProvenance } from './videoProvenance.mjs';
import {
  assertShotRecoveryPlanIntegrity,
  buildShotRecoveryApplication,
  buildShotRecoveryPlan,
  compileShotRecoveryExecution,
  buildShotRecoveryDeliveryReceipt,
  compileShotRecoveryCommit,
  compileShotRecoveryCommitPreflight,
} from './videoShotRecovery.mjs';
import { assertCanonicalProjectAssetRef } from './projects/projectAssetContract.mjs';

const ASSET_KINDS = new Set(['product', 'person', 'wardrobe', 'scene', 'prop', 'style', 'voice', 'music']);
const BINDING_ROLES = new Set([
  'subject', 'product', 'wardrobe', 'scene', 'prop', 'style', 'voice', 'music',
  'first_frame', 'last_frame', 'motion_reference',
]);
const SHOT_PATCH_FIELDS = new Set(['position', 'purpose', 'durationMs', 'cameraLanguage', 'prompt', 'direction', 'firstFrameRef', 'lastFrameRef', 'modelIntent']);
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

function normalizeAudioSubtitleCues(cues, durationMs, errorCode = 'INVALID_AUDIO_TRACK') {
  if (!Array.isArray(cues) || cues.length > 200) {
    throw coded(errorCode, 'audio subtitle cues are invalid');
  }
  let previousEnd = -1;
  return cues.map((cue) => {
    const startMs = cue?.startMs;
    const endMs = cue?.endMs;
    const text = clean(cue?.text, 240);
    if (!cue || !Number.isSafeInteger(startMs) || !Number.isSafeInteger(endMs)
      || startMs < 0 || endMs <= startMs || endMs > durationMs || startMs < previousEnd || !text) {
      throw coded(errorCode, 'audio subtitle cues are invalid');
    }
    previousEnd = endMs;
    return { startMs, endMs, text };
  });
}

function projectAssetIdFromRef(value) {
  if (value && typeof value === 'object') return clean(value.projectAssetId || value.id, 256);
  return clean(value, 256);
}

function publicProjectAssetRef(asset, { role = '', expectedContentHash = '' } = {}) {
  if (!asset) return null;
  const metadata = asset.metadata && typeof asset.metadata === 'object' && !Array.isArray(asset.metadata)
    ? asset.metadata : {};
  const normalizedRole = clean(role || asset.role || 'reference', 80);
  const normalizedHash = clean(expectedContentHash || asset.contentHash, 256);
  const ref = assertCanonicalProjectAssetRef({
    projectId: asset.projectId,
    projectAssetId: asset.projectAssetId,
    role: normalizedRole,
    expectedContentHash: normalizedHash,
  }, asset);
  return {
    ...ref,
    assetId: clean(asset.assetId, 256),
    contentHash: clean(asset.contentHash, 256),
    mimeType: clean(asset.mimeType, 160).toLowerCase(),
    width: Number.isSafeInteger(asset.width) ? asset.width : null,
    height: Number.isSafeInteger(asset.height) ? asset.height : null,
    durationMs: Number.isSafeInteger(asset.durationMs) ? asset.durationMs
      : Number.isSafeInteger(metadata.durationMs) ? metadata.durationMs : null,
    aspectRatio: clean(asset.aspectRatio || metadata.aspectRatio, 40) || null,
    thumbnailProjectAssetId: projectAssetIdFromRef(asset.thumbnailProjectAssetId || metadata.thumbnailProjectAssetId) || null,
    sourceProjectAssetIds: Array.isArray(asset.sourceProjectAssetIds || metadata.sourceProjectAssetIds)
      ? (asset.sourceProjectAssetIds || metadata.sourceProjectAssetIds).map(item => projectAssetIdFromRef(item)).filter(Boolean)
      : [],
    generationRunId: clean(asset.generationRunId || metadata.generationRunId, 256) || null,
    retentionState: clean(asset.retentionState, 40) || null,
  };
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

function normalizePreflight(value) {
  if (value?.preflight && typeof value.preflight === 'object') return value.preflight;
  return value;
}

function assertCurrentRendererPreflight({ api, ownerEmail, projectId, preflight }) {
  const normalized = normalizePreflight(preflight);
  assertVideoRendererPreflightIntegrity(normalized);
  const attestation = normalized.attestation;
  const requirements = attestation.requirements;
  const governance = attestation.governance || {};
  const currentPlan = buildVideoWorkbenchPlan(
    api.listWorkbench({ ownerEmail, projectId }),
    {
      ...(attestation.plan?.options || {}),
      capabilities: attestation.capabilitySnapshot,
      rightsConfirmations: governance.rights,
      moderation: governance.moderation,
      storage: governance.storage,
      enforcePreflight: true,
      budgetCapPoints: requirements.budgetCapPoints,
      requireRights: requirements.requireRights,
      requireModeration: requirements.requireModeration,
      requireStorage: requirements.requireStorage,
    },
  );
  if (currentPlan.preflight?.preflightHash !== normalized.preflightHash) {
    throw coded('RENDER_PREFLIGHT_STALE', '渲染预检证明与当前项目状态不一致，请重新预检');
  }
  return currentPlan;
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

function exportManifestFromRow(row) {
  if (!row) return null;
  const manifest = parseJson(row.manifest_json, null);
  try {
    assertVideoExportManifestIntegrity(manifest, row.manifest_hash);
  } catch (error) {
    throw coded('EXPORT_MANIFEST_INTEGRITY_INVALID', 'export manifest integrity check failed');
  }
  if (Number(manifest.schemaVersion) !== Number(row.schema_version)
    || manifest.kind !== 'video-export-manifest') {
    throw coded('EXPORT_MANIFEST_INTEGRITY_INVALID', 'export manifest schema mismatch');
  }
  return {
    id: row.id,
    projectId: row.project_id,
    manifestHash: row.manifest_hash,
    schemaVersion: row.schema_version,
    createdAt: row.created_at,
    manifest,
  };
}

function exportJobFromRow(row) {
  if (!row) return null;
  const job = {
    id: row.id,
    ownerEmail: row.owner_email,
    projectId: row.project_id,
    manifestId: row.manifest_id,
    manifestHash: row.manifest_hash,
    preflightHash: row.preflight_hash || '',
    preflightJson: row.preflight_json || '',
    state: row.state,
    attempt: Number(row.attempt),
    renderer: row.renderer,
    providerSubmission: Boolean(row.provider_submission),
    billingMutation: Boolean(row.billing_mutation),
    outputAssetId: row.output_asset_id || '',
    outputUrl: row.output_url || '',
    errorCode: row.error_code || '',
    errorMessage: row.error_message || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    startedAt: row.started_at || '',
    completedAt: row.completed_at || '',
    canceledAt: row.canceled_at || '',
    workerId: row.worker_id || '',
    leaseToken: row.lease_token || '',
    leaseExpiresAt: row.lease_expires_at || '',
    jobHash: row.job_hash,
  };
  try {
    assertVideoExportJobIntegrity(job);
  } catch {
    throw coded('EXPORT_JOB_INTEGRITY_INVALID', 'export job integrity check failed');
  }
  return job;
}

function rendererOutboxFromRow(row) {
  if (!row) return null;
  const event = {
    id: row.id,
    eventType: row.event_type,
    jobId: row.job_id,
    projectId: row.project_id,
    requestId: row.request_id,
    requestHash: row.request_hash,
    payload: parseJson(row.payload_json, null),
    state: row.state,
    attempts: Number(row.attempts),
    nextAttemptAt: row.next_attempt_at,
    workerId: row.worker_id || '',
    leaseToken: row.lease_token || '',
    leaseExpiresAt: row.lease_expires_at || '',
    lastErrorCode: row.last_error_code || '',
    lastError: row.last_error || '',
    providerSubmission: Boolean(row.provider_submission),
    billingMutation: Boolean(row.billing_mutation),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    eventHash: row.event_hash,
  };
  try {
    assertVideoRendererOutboxIntegrity(event);
  } catch {
    throw coded('RENDER_OUTBOX_INTEGRITY_INVALID', 'renderer outbox integrity check failed');
  }
  return event;
}

function persistExportJob(db, job, owner, projectId) {
  db.prepare(`UPDATE video_export_jobs SET state = ?, attempt = ?, renderer = ?,
    provider_submission = ?, billing_mutation = ?, output_asset_id = ?, output_url = ?,
    error_code = ?, error_message = ?, updated_at = ?, started_at = ?, completed_at = ?,
    canceled_at = ?, worker_id = ?, lease_token = ?, lease_expires_at = ?, job_hash = ?
    WHERE id = ? AND owner_email = ? AND project_id = ?`).run(
    job.state, job.attempt, job.renderer, Number(job.providerSubmission), Number(job.billingMutation),
    job.outputAssetId, job.outputUrl, job.errorCode, job.errorMessage, job.updatedAt,
    job.startedAt, job.completedAt, job.canceledAt, job.workerId, job.leaseToken,
    job.leaseExpiresAt, job.jobHash, job.id, owner, projectId,
  );
}

function persistRendererOutbox(db, event, owner, projectId) {
  db.prepare(`UPDATE video_renderer_outbox SET event_type = ?, job_id = ?, request_id = ?,
    request_hash = ?, payload_json = ?, state = ?, attempts = ?, next_attempt_at = ?,
    worker_id = ?, lease_token = ?, lease_expires_at = ?, last_error_code = ?, last_error = ?,
    provider_submission = ?, billing_mutation = ?, updated_at = ?, event_hash = ?
    WHERE id = ? AND owner_email = ? AND project_id = ?`).run(
    event.eventType, event.jobId, event.requestId, event.requestHash, JSON.stringify(event.payload),
    event.state, event.attempts, event.nextAttemptAt, event.workerId, event.leaseToken,
    event.leaseExpiresAt, event.lastErrorCode, event.lastError, Number(event.providerSubmission),
    Number(event.billingMutation), event.updatedAt, event.eventHash, event.id, owner, projectId,
  );
}

function rendererOutboxId(jobId, attempt) {
  return `${jobId}:attempt:${attempt}`;
}

function createRendererOutboxForJob(db, {
  owner, projectId, job, manifest, now,
}) {
  const request = buildVideoRendererRequest({ job, manifest, now: now || job.updatedAt });
  const event = createVideoRendererOutboxEvent({
    id: rendererOutboxId(job.id, job.attempt),
    request,
    createdAt: now || job.updatedAt,
  });
  db.prepare(`INSERT OR IGNORE INTO video_renderer_outbox
    (id, owner_email, project_id, job_id, event_type, request_id, request_hash, payload_json,
     state, attempts, next_attempt_at, worker_id, lease_token, lease_expires_at,
     last_error_code, last_error, provider_submission, billing_mutation, created_at, updated_at, event_hash)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    event.id, owner, projectId, event.jobId, event.eventType, event.requestId, event.requestHash,
    JSON.stringify(event.payload), event.state, event.attempts, event.nextAttemptAt, event.workerId,
    event.leaseToken, event.leaseExpiresAt, event.lastErrorCode, event.lastError,
    Number(event.providerSubmission), Number(event.billingMutation), event.createdAt,
    event.updatedAt, event.eventHash,
  );
  const persisted = rendererOutboxFromRow(db.prepare(`SELECT * FROM video_renderer_outbox
    WHERE id = ? AND owner_email = ? AND project_id = ?`).get(event.id, owner, projectId));
  if (!persisted || persisted.requestHash !== event.requestHash || persisted.eventHash !== event.eventHash) {
    throw coded('RENDER_OUTBOX_INTEGRITY_INVALID', 'renderer outbox event already exists with different payload');
  }
  return persisted;
}

function syncRendererOutboxForJob(db, {
  owner, projectId, job, nextState, errorCode, errorMessage, now, workerId, leaseToken,
}) {
  const row = db.prepare(`SELECT * FROM video_renderer_outbox
    WHERE owner_email = ? AND project_id = ? AND request_id = ?`)
    .get(owner, projectId, rendererOutboxId(job.id, job.attempt));
  if (!row) return null;
  const event = rendererOutboxFromRow(row);
  let next = event;
  if (nextState === 'failed') {
    next = event.state === 'processing' && workerId && leaseToken
      ? failVideoRendererOutboxEvent(event, {
        now, workerId, leaseToken, errorCode: errorCode || 'EXPORT_JOB_FAILED', errorMessage,
      })
      : event.state === 'processing'
        ? recoverExpiredVideoRendererOutboxEvent(event, { now })
        : failVideoRendererOutboxEvent(event, {
          now, errorCode: errorCode || 'EXPORT_JOB_FAILED', errorMessage,
        });
  } else if (nextState === 'completed') {
    next = completeVideoRendererOutboxEvent(event, { now, workerId, leaseToken });
  } else if (nextState === 'canceled') {
    next = cancelVideoRendererOutboxEvent(event, { now, workerId, leaseToken, errorCode, errorMessage });
  }
  if (next !== event) persistRendererOutbox(db, next, owner, projectId);
  return next;
}

function claimRendererOutboxForJob(db, {
  owner, projectId, job, workerId, leaseToken, leaseMs, now,
}) {
  const event = rendererOutboxFromRow(db.prepare(`SELECT * FROM video_renderer_outbox
    WHERE owner_email = ? AND project_id = ? AND request_id = ?`).get(
    owner, projectId, rendererOutboxId(job.id, job.attempt),
  ));
  if (!event) throw coded('RENDER_OUTBOX_NOT_FOUND', 'renderer outbox event not found');
  const claimed = claimVideoRendererOutboxEvent(event, {
    workerId, leaseToken, leaseMs, now,
  });
  persistRendererOutbox(db, claimed, owner, projectId);
  return claimed;
}

function renewRendererOutboxForJob(db, {
  owner, projectId, job, workerId, leaseToken, leaseMs, now,
}) {
  const event = rendererOutboxFromRow(db.prepare(`SELECT * FROM video_renderer_outbox
    WHERE owner_email = ? AND project_id = ? AND request_id = ?`).get(
    owner, projectId, rendererOutboxId(job.id, job.attempt),
  ));
  if (!event) throw coded('RENDER_OUTBOX_NOT_FOUND', 'renderer outbox event not found');
  const renewed = renewVideoRendererOutboxLease(event, {
    workerId, leaseToken, leaseMs, now,
  });
  persistRendererOutbox(db, renewed, owner, projectId);
  return renewed;
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
    projectAssetRef: null,
    projectAssetRefStatus: row.source_project_asset_id ? 'unverified-legacy' : 'missing',
    createdAt: row.created_at,
  };
}

function parseShotFrameRef(value) {
  if (!value) return null;
  const parsed = parseJson(value, null);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  const ref = {
    projectId: clean(parsed.projectId, 128),
    projectAssetId: clean(parsed.projectAssetId, 256),
    assetId: clean(parsed.assetId, 256),
    contentHash: clean(parsed.contentHash, 256),
    stableUrl: clean(parsed.stableUrl, 2000),
    mimeType: clean(parsed.mimeType, 160).toLowerCase(),
    width: Number.isSafeInteger(parsed.width) ? parsed.width : null,
    height: Number.isSafeInteger(parsed.height) ? parsed.height : null,
  };
  return ref.projectAssetId && ref.contentHash ? ref : null;
}

function serializeShotFrameRef(canonical, role) {
  const ref = canonical?.ref || null;
  if (!ref?.projectAssetId) throw coded('PROJECT_ASSET_REF_INVALID', `${role} frame reference is invalid`);
  return {
    projectId: clean(ref.projectId, 128),
    projectAssetId: clean(ref.projectAssetId, 256),
    assetId: clean(ref.assetId, 256),
    contentHash: clean(ref.contentHash, 256),
    stableUrl: clean(ref.stableUrl, 2000),
    mimeType: clean(ref.mimeType, 160).toLowerCase(),
    width: Number.isSafeInteger(ref.width) ? ref.width : null,
    height: Number.isSafeInteger(ref.height) ? ref.height : null,
  };
}

function shotFromRow(row) {
  if (!row) return null;
  const cameraLanguage = row.camera_language || '';
  return {
    id: row.id,
    ownerEmail: row.owner_email,
    projectId: row.project_id,
    position: row.position,
    purpose: row.purpose,
    durationMs: row.duration_ms,
    cameraLanguage,
    direction: normalizeShotDirection(parseJson(row.direction_json, {}), cameraLanguage),
    prompt: row.prompt,
    firstFrameRef: parseShotFrameRef(row.first_frame_ref),
    lastFrameRef: parseShotFrameRef(row.last_frame_ref),
    modelIntent: clean(row.model_intent, 2000),
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
  const fallbackStatus = row.generation_job_id ? 'unverified-legacy' : 'planned';
  const storedProvenance = parseJson(row.provenance_json, {});
  const storedStatus = clean(storedProvenance?.status, 40)
    || (row.provenance_status && row.provenance_status !== 'planned' ? clean(row.provenance_status, 40) : fallbackStatus);
  const provenance = normalizeVideoProvenance(storedProvenance, storedStatus);
  const projectAssetRef = storedProvenance?.projectAssetRef && typeof storedProvenance.projectAssetRef === 'object'
    ? storedProvenance.projectAssetRef : null;
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
    provenanceStatus: provenance.status,
    provenance,
    projectAssetRef,
    projectAssetRefStatus: projectAssetRef?.projectAssetId ? 'unverified-legacy' : 'missing',
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

function audioTrackFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    ownerEmail: row.owner_email,
    projectId: row.project_id,
    kind: row.kind,
    assetId: row.asset_id,
    assetVersionId: row.asset_version_id,
    startMs: row.start_ms,
    durationMs: row.duration_ms,
    volume: row.volume,
    muted: Boolean(row.muted),
    language: row.language,
    voiceAnchor: row.voice_anchor,
    beatMarkers: parseJson(row.beat_markers_json, []),
    subtitleCues: parseJson(row.subtitle_cues_json, []),
    revision: row.revision,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function generationPlanApprovalFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    ownerEmail: row.owner_email,
    projectId: row.project_id,
    planHash: row.plan_hash,
    plan: parseJson(row.plan_json, {}),
    approvedAt: row.approved_at,
  };
}

function generationDraftFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    ownerEmail: row.owner_email,
    projectId: row.project_id,
    planHash: row.plan_hash,
    createdAt: row.created_at,
    ...parseJson(row.draft_json, {}),
  };
}

function shotRecoveryPlanFromRow(row) {
  if (!row) return null;
  const payload = parseJson(row.plan_json, {});
  return {
    ...payload,
    id: row.id,
    ownerEmail: row.owner_email,
    projectId: row.project_id,
    shotId: row.shot_id,
    status: row.status,
    revision: row.revision,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    planHash: row.plan_hash,
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
  const confirmedGuardIds = [...new Set(events
    .filter(event => event.type === 'guard.confirmed')
    .map(event => parseJson(event.payload_json, {}).guardId)
    .filter(Boolean))];
  const confirmedCheckpointIds = [...new Set(events
    .filter(event => event.type === 'checkpoint.confirmed')
    .map(event => parseJson(event.payload_json, {}).checkpointId)
    .filter(Boolean))];
  return {
    id: row.id,
    ownerEmail: row.owner_email,
    projectId: row.project_id,
    skillId: row.skill_id,
    skillVersion: row.skill_version,
    ...(plan.templateId ? { templateId: plan.templateId } : {}),
    status: row.status,
    revision: row.revision,
    input: parseJson(row.input_json, {}),
    plan,
    confirmedGuardIds,
    confirmedCheckpointIds,
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
      camera_language TEXT NOT NULL DEFAULT '', prompt TEXT NOT NULL DEFAULT '', direction_json TEXT NOT NULL DEFAULT '{}',
      status TEXT NOT NULL DEFAULT 'draft', selected_candidate_id TEXT,
      first_frame_ref TEXT NOT NULL DEFAULT '', last_frame_ref TEXT NOT NULL DEFAULT '', model_intent TEXT NOT NULL DEFAULT '',
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
      provenance_status TEXT NOT NULL DEFAULT 'planned', provenance_json TEXT NOT NULL DEFAULT '{}',
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
    CREATE TABLE IF NOT EXISTS video_audio_tracks (
      id TEXT PRIMARY KEY, owner_email TEXT NOT NULL, project_id TEXT NOT NULL,
      kind TEXT NOT NULL, asset_id TEXT NOT NULL, asset_version_id TEXT NOT NULL,
      start_ms INTEGER NOT NULL DEFAULT 0, duration_ms INTEGER NOT NULL,
      volume REAL NOT NULL DEFAULT 1, muted INTEGER NOT NULL DEFAULT 0,
      language TEXT NOT NULL DEFAULT '', voice_anchor TEXT NOT NULL DEFAULT '',
      beat_markers_json TEXT NOT NULL DEFAULT '[]', subtitle_cues_json TEXT NOT NULL DEFAULT '[]',
      revision INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
      FOREIGN KEY(project_id) REFERENCES projects(id),
      FOREIGN KEY(asset_id) REFERENCES video_workbench_assets(id),
      FOREIGN KEY(asset_version_id) REFERENCES video_workbench_asset_versions(id)
    );
    CREATE INDEX IF NOT EXISTS idx_video_audio_tracks_project
      ON video_audio_tracks(owner_email, project_id, start_ms, created_at);
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
    CREATE TABLE IF NOT EXISTS video_export_manifests (
      id TEXT PRIMARY KEY, owner_email TEXT NOT NULL, project_id TEXT NOT NULL,
      manifest_hash TEXT NOT NULL, schema_version INTEGER NOT NULL,
      manifest_json TEXT NOT NULL, created_at TEXT NOT NULL,
      UNIQUE(owner_email, project_id, manifest_hash),
      FOREIGN KEY(project_id) REFERENCES projects(id)
    );
    CREATE INDEX IF NOT EXISTS idx_video_export_manifests_project
      ON video_export_manifests(owner_email, project_id, created_at DESC);
    CREATE TABLE IF NOT EXISTS video_export_jobs (
      id TEXT PRIMARY KEY, owner_email TEXT NOT NULL, project_id TEXT NOT NULL,
      manifest_id TEXT NOT NULL, manifest_hash TEXT NOT NULL,
      preflight_hash TEXT NOT NULL DEFAULT '', preflight_json TEXT NOT NULL DEFAULT '',
      state TEXT NOT NULL DEFAULT 'waiting_renderer', attempt INTEGER NOT NULL DEFAULT 0,
      renderer TEXT NOT NULL DEFAULT 'external-worker',
      provider_submission INTEGER NOT NULL DEFAULT 0, billing_mutation INTEGER NOT NULL DEFAULT 0,
      output_asset_id TEXT NOT NULL DEFAULT '', output_url TEXT NOT NULL DEFAULT '',
      error_code TEXT NOT NULL DEFAULT '', error_message TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
      started_at TEXT NOT NULL DEFAULT '', completed_at TEXT NOT NULL DEFAULT '',
      canceled_at TEXT NOT NULL DEFAULT '', worker_id TEXT NOT NULL DEFAULT '',
      lease_token TEXT NOT NULL DEFAULT '', lease_expires_at TEXT NOT NULL DEFAULT '',
      job_hash TEXT NOT NULL,
      UNIQUE(owner_email, project_id, manifest_id, manifest_hash),
      FOREIGN KEY(project_id) REFERENCES projects(id),
      FOREIGN KEY(manifest_id) REFERENCES video_export_manifests(id)
    );
    CREATE INDEX IF NOT EXISTS idx_video_export_jobs_project
      ON video_export_jobs(owner_email, project_id, created_at DESC);
    CREATE TABLE IF NOT EXISTS video_renderer_outbox (
      id TEXT PRIMARY KEY, owner_email TEXT NOT NULL, project_id TEXT NOT NULL,
      job_id TEXT NOT NULL, event_type TEXT NOT NULL, request_id TEXT NOT NULL,
      request_hash TEXT NOT NULL, payload_json TEXT NOT NULL,
      state TEXT NOT NULL DEFAULT 'pending', attempts INTEGER NOT NULL DEFAULT 0,
      next_attempt_at TEXT NOT NULL, worker_id TEXT NOT NULL DEFAULT '',
      lease_token TEXT NOT NULL DEFAULT '', lease_expires_at TEXT NOT NULL DEFAULT '',
      last_error_code TEXT NOT NULL DEFAULT '', last_error TEXT NOT NULL DEFAULT '',
      provider_submission INTEGER NOT NULL DEFAULT 0, billing_mutation INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL, event_hash TEXT NOT NULL,
      UNIQUE(owner_email, project_id, request_id),
      FOREIGN KEY(project_id) REFERENCES projects(id),
      FOREIGN KEY(job_id) REFERENCES video_export_jobs(id)
    );
    CREATE INDEX IF NOT EXISTS idx_video_renderer_outbox_pending
      ON video_renderer_outbox(owner_email, project_id, state, next_attempt_at, created_at);
    CREATE INDEX IF NOT EXISTS idx_video_renderer_outbox_job
      ON video_renderer_outbox(owner_email, project_id, job_id, created_at);
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
    CREATE TABLE IF NOT EXISTS video_generation_plan_approvals (
      id TEXT PRIMARY KEY, owner_email TEXT NOT NULL, project_id TEXT NOT NULL,
      plan_hash TEXT NOT NULL, plan_json TEXT NOT NULL, approved_at TEXT NOT NULL,
      UNIQUE(owner_email, project_id), FOREIGN KEY(project_id) REFERENCES projects(id)
    );
    CREATE INDEX IF NOT EXISTS idx_video_generation_plan_approvals_project
      ON video_generation_plan_approvals(owner_email, project_id, approved_at DESC);
    CREATE TABLE IF NOT EXISTS video_generation_drafts (
      id TEXT PRIMARY KEY, owner_email TEXT NOT NULL, project_id TEXT NOT NULL,
      plan_hash TEXT NOT NULL, draft_json TEXT NOT NULL, created_at TEXT NOT NULL,
      UNIQUE(owner_email, project_id, plan_hash), FOREIGN KEY(project_id) REFERENCES projects(id)
    );
    CREATE INDEX IF NOT EXISTS idx_video_generation_drafts_project
      ON video_generation_drafts(owner_email, project_id, created_at DESC);
    CREATE TABLE IF NOT EXISTS video_shot_recovery_plans (
      id TEXT PRIMARY KEY, owner_email TEXT NOT NULL, project_id TEXT NOT NULL, shot_id TEXT NOT NULL,
      plan_hash TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'planned', revision INTEGER NOT NULL DEFAULT 1,
      plan_json TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
      UNIQUE(owner_email, project_id, shot_id, plan_hash),
      FOREIGN KEY(project_id) REFERENCES projects(id), FOREIGN KEY(shot_id) REFERENCES video_storyboard_shots(id)
    );
    CREATE INDEX IF NOT EXISTS idx_video_shot_recovery_plans_project
      ON video_shot_recovery_plans(owner_email, project_id, created_at DESC);
  `);
  const shotColumns = db.prepare(`PRAGMA table_info(video_storyboard_shots)`).all();
  if (!shotColumns.some(column => column.name === 'direction_json')) {
    db.exec(`ALTER TABLE video_storyboard_shots ADD COLUMN direction_json TEXT NOT NULL DEFAULT '{}'`);
  }
  for (const [name, definition] of [
    ['first_frame_ref', "TEXT NOT NULL DEFAULT ''"],
    ['last_frame_ref', "TEXT NOT NULL DEFAULT ''"],
    ['model_intent', "TEXT NOT NULL DEFAULT ''"],
  ]) {
    if (!shotColumns.some(column => column.name === name)) db.exec(`ALTER TABLE video_storyboard_shots ADD COLUMN ${name} ${definition}`);
  }
  const exportJobColumns = db.prepare(`PRAGMA table_info(video_export_jobs)`).all();
  const exportJobColumnNames = new Set(exportJobColumns.map(column => column.name));
  for (const [name, definition] of [
    ['preflight_hash', "TEXT NOT NULL DEFAULT ''"],
    ['preflight_json', "TEXT NOT NULL DEFAULT ''"],
    ['worker_id', "TEXT NOT NULL DEFAULT ''"],
    ['lease_token', "TEXT NOT NULL DEFAULT ''"],
    ['lease_expires_at', "TEXT NOT NULL DEFAULT ''"],
  ]) {
    if (!exportJobColumnNames.has(name)) db.exec(`ALTER TABLE video_export_jobs ADD COLUMN ${name} ${definition}`);
  }
  const candidateColumns = new Set(db.prepare('PRAGMA table_info(video_shot_candidates)').all().map(column => column.name));
  for (const [name, definition] of [
    ['provenance_status', "TEXT NOT NULL DEFAULT 'planned'"],
    ['provenance_json', "TEXT NOT NULL DEFAULT '{}'"],
  ]) {
    if (!candidateColumns.has(name)) db.exec(`ALTER TABLE video_shot_candidates ADD COLUMN ${name} ${definition}`);
  }
}

function tableExists(db, tableName) {
  return Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(tableName));
}

function tableColumns(db, tableName) {
  return new Set(db.prepare(`PRAGMA table_info(${tableName})`).all().map(column => column.name));
}

export function createVideoWorkbenchStore({
  db,
  projectStore,
  projectAssetStore = null,
  projectAssetBridge = null,
  now = () => new Date(),
  randomUUID = crypto.randomUUID,
} = {}) {
  if (!db?.prepare || !projectStore?.getProject) throw new TypeError('video workbench requires db and projectStore');
  ensureSchema(db);
  const canonicalAssetStore = projectAssetBridge || projectAssetStore || projectStore;

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
  const requireCanonicalProjectAsset = ({ ownerEmail, projectId, projectAssetId, expectedContentHash,
    role = 'reference', purpose = 'read' }) => {
    if (typeof canonicalAssetStore?.getProjectAsset !== 'function') {
      throw coded('PROJECT_ASSET_BRIDGE_UNAVAILABLE', 'canonical project asset bridge is unavailable');
    }
    const canonicalId = projectAssetIdFromRef(projectAssetId);
    if (!canonicalId) throw coded('PROJECT_ASSET_REF_INVALID', 'projectAssetId is required');
    const asset = canonicalAssetStore.getProjectAsset({
      ownerEmail,
      projectId,
      projectAssetId: canonicalId,
      purpose,
    });
    if (!asset) throw coded('PROJECT_ASSET_NOT_FOUND', 'canonical project asset not found');
    try {
      return { asset, ref: publicProjectAssetRef(asset, { role, expectedContentHash }) };
    } catch (error) {
      throw coded('PROJECT_ASSET_REF_INVALID', error?.message || 'canonical project asset reference is invalid');
    }
  };
  const requireShotFrameRef = ({ owner, project, value, role }) => {
    if (value === undefined || value === null || value === '') return null;
    const input = typeof value === 'string'
      ? (() => { try { return JSON.parse(value); } catch { return {}; } })()
      : (value && typeof value === 'object' && !Array.isArray(value) ? value : {});
    const projectAssetId = projectAssetIdFromRef(input.projectAssetId || input.id);
    if (!projectAssetId) throw coded('PROJECT_ASSET_REF_INVALID', role + ' frame reference requires a projectAssetId');
    const canonical = requireCanonicalProjectAsset({
      ownerEmail: owner,
      projectId: project.id,
      projectAssetId,
      expectedContentHash: clean(input.contentHash, 256),
      role,
      purpose: 'reuse',
    });
    return serializeShotFrameRef(canonical, role);
  };
  const createCanonicalProjectAsset = ({ ownerEmail, projectId, assetId, role, stableUrl, contentHash, mimeType,
    width = null, height = null, durationMs = null, aspectRatio = null, thumbnailProjectAssetId = null,
    sourceProjectAssetIds = [], generationRunId = null, retentionClass = 'source', metadata = {} }) => {
    if (typeof canonicalAssetStore?.createProjectAsset !== 'function') {
      throw coded('PROJECT_ASSET_BRIDGE_UNAVAILABLE', 'canonical project asset bridge is unavailable');
    }
    const asset = canonicalAssetStore.createProjectAsset({
      ownerEmail,
      projectId,
      assetId,
      role,
      stableUrl,
      contentHash,
      mimeType,
      width,
      height,
      retentionClass,
      generationRunId,
      metadata: {
        ...(metadata && typeof metadata === 'object' && !Array.isArray(metadata) ? metadata : {}),
        ...(durationMs === null ? {} : { durationMs }),
        ...(aspectRatio ? { aspectRatio } : {}),
        ...(thumbnailProjectAssetId ? { thumbnailProjectAssetId } : {}),
        ...(Array.isArray(sourceProjectAssetIds) && sourceProjectAssetIds.length ? { sourceProjectAssetIds } : {}),
      },
    });
    return requireCanonicalProjectAsset({
      ownerEmail,
      projectId,
      projectAssetId: asset.projectAssetId,
      expectedContentHash: asset.contentHash,
      role,
    });
  };
  const lookupCanonicalProjectAsset = ({ ownerEmail, projectId, projectAssetId, expectedContentHash,
    role = 'reference', purpose = 'read' }) => {
    if (!projectAssetId) return null;
    try {
      return requireCanonicalProjectAsset({ ownerEmail, projectId, projectAssetId, expectedContentHash, role, purpose });
    } catch (error) {
      if (['PROJECT_ASSET_NOT_FOUND', 'PROJECT_ASSET_REF_INVALID'].includes(error?.code)) return null;
      throw error;
    }
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
  const requireReusableVersion = (owner, projectId, assetId, versionId, role) => {
    const version = requireVersion(owner, projectId, assetId, versionId);
    if (!version.sourceProjectAssetId) {
      throw coded('PROJECT_ASSET_REF_INVALID', 'asset version has no canonical project asset');
    }
    requireCanonicalProjectAsset({
      ownerEmail: owner,
      projectId,
      projectAssetId: version.sourceProjectAssetId,
      expectedContentHash: version.contentHash,
      role,
      purpose: 'reuse',
    });
    return version;
  };
  const hydrateVersion = version => {
    const canonical = lookupCanonicalProjectAsset({
      ownerEmail: version.ownerEmail,
      projectId: version.projectId,
      projectAssetId: version.sourceProjectAssetId,
      expectedContentHash: version.contentHash,
      role: 'reference',
    });
    return {
      ...version,
      projectAssetRef: canonical?.ref || null,
      projectAssetRefStatus: canonical?.ref ? 'verified' : (version.sourceProjectAssetId ? 'unverified-legacy' : 'missing'),
    };
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
  const requireReusableCandidate = (owner, projectId, shotId, candidateId) => {
    const candidate = requireCandidate(owner, projectId, shotId, candidateId);
    const ref = candidate.projectAssetRef;
    if (ref?.projectAssetId) {
      requireCanonicalProjectAsset({
        ownerEmail: owner,
        projectId,
        projectAssetId: ref.projectAssetId,
        expectedContentHash: ref.expectedContentHash || candidate.contentHash,
        role: ref.role || 'generated-video',
        purpose: 'reuse',
      });
    }
    return candidate;
  };
  const hydrateCandidate = candidate => {
    const canonical = candidate.projectAssetRef?.projectAssetId
      ? lookupCanonicalProjectAsset({
        ownerEmail: candidate.ownerEmail,
        projectId: candidate.projectId,
        projectAssetId: candidate.projectAssetRef.projectAssetId,
        expectedContentHash: candidate.projectAssetRef.expectedContentHash || candidate.contentHash,
        role: candidate.projectAssetRef.role || 'generated-video',
      })
      : null;
    return {
      ...candidate,
      projectAssetRef: canonical?.ref || null,
      projectAssetRefStatus: canonical?.ref ? 'verified' : (candidate.projectAssetRef?.projectAssetId ? 'unverified-legacy' : 'missing'),
    };
  };
  const requireClip = (owner, projectId, clipId) => {
    const clip = clipFromRow(db.prepare(`SELECT * FROM video_timeline_clips
      WHERE id = ? AND owner_email = ? AND project_id = ?`).get(clipId, owner, projectId));
    if (!clip) throw coded('TIMELINE_CLIP_NOT_FOUND', 'timeline clip not found');
    return clip;
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
  const validateAudioShape = ({ kind, asset, version, startMs, durationMs, volume,
    language, voiceAnchor, beatMarkers, subtitleCues }) => {
    if (!['voice', 'music'].includes(kind)) throw coded('INVALID_AUDIO_TRACK', 'audio track kind is invalid');
    if (!asset || asset.kind !== kind || asset.approvedVersionId !== version?.id) {
      throw coded('AUDIO_ASSET_NOT_APPROVED', 'audio track must use the approved matching asset version');
    }
    if (!String(version.mimeType || '').toLowerCase().startsWith('audio/')) {
      throw coded('INVALID_AUDIO_TRACK', 'audio track asset must be an audio file');
    }
    if (!Number.isSafeInteger(startMs) || startMs < 0 || startMs > 600_000) {
      throw coded('INVALID_AUDIO_TRACK', 'audio track start must be between 0 and 600000 milliseconds');
    }
    validateDuration(durationMs);
    if (!Number.isFinite(volume) || volume < 0 || volume > 2) {
      throw coded('INVALID_AUDIO_TRACK', 'audio track volume must be between 0 and 2');
    }
    if (!Array.isArray(beatMarkers) || beatMarkers.length > 128
      || beatMarkers.some((item, index) => !Number.isSafeInteger(item) || item < 0 || item > durationMs
        || (index > 0 && item <= beatMarkers[index - 1]))) {
      throw coded('INVALID_AUDIO_TRACK', 'audio beat markers must be sorted within the track');
    }
    normalizeAudioSubtitleCues(subtitleCues, durationMs);
    if (clean(language, 32).length > 32 || clean(voiceAnchor, 240).length > 240) {
      throw coded('INVALID_AUDIO_TRACK', 'audio continuity metadata is too long');
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

    addAssetVersion({ ownerEmail, projectId, assetId, sourceProjectAssetId = null, projectAssetRef = null,
      stableUrl, contentHash, mimeType, metadata = {} }) {
      const { owner, project } = requireProject(ownerEmail, projectId);
      requireAsset(owner, project.id, assetId);
      const suppliedMetadata = metadata && typeof metadata === 'object' && !Array.isArray(metadata) ? metadata : {};
      let canonical = projectAssetRef
        ? requireCanonicalProjectAsset({
          ownerEmail: owner,
          projectId: project.id,
          projectAssetId: projectAssetRef,
          expectedContentHash: contentHash,
          role: projectAssetRef?.role || 'reference',
          purpose: 'reuse',
        })
        : null;
      const requestedUrl = clean(stableUrl, 2000);
      const requestedHash = clean(contentHash, 256);
      const requestedType = clean(mimeType, 160).toLowerCase();
      if (!requestedUrl || !requestedHash || !requestedType) {
        throw coded('INVALID_BINDING', 'stableUrl, contentHash and mimeType are required');
      }
      if (!canonical && sourceProjectAssetId) {
        canonical = lookupCanonicalProjectAsset({
          ownerEmail: owner,
          projectId: project.id,
          projectAssetId: sourceProjectAssetId,
          expectedContentHash: requestedHash,
          role: suppliedMetadata.role || 'reference',
          purpose: 'reuse',
        });
        if (!canonical) {
          canonical = createCanonicalProjectAsset({
            ownerEmail: owner,
            projectId: project.id,
            assetId: projectAssetIdFromRef(sourceProjectAssetId),
            role: clean(suppliedMetadata.role, 80) || 'reference',
            stableUrl: requestedUrl,
            contentHash: requestedHash,
            mimeType: requestedType,
            metadata: suppliedMetadata,
            retentionClass: 'source',
          });
        }
      }
      if (!canonical) {
        const urlAssetId = requestedUrl.match(/\/([^/?#]+)(?:[?#].*)?$/)?.[1] || '';
        let fallbackAssetId = projectAssetIdFromRef(sourceProjectAssetId) || urlAssetId;
        try {
          fallbackAssetId = decodeURIComponent(fallbackAssetId);
        } catch {
          // Keep the URL token when it is not valid URI encoding.
        }
        canonical = createCanonicalProjectAsset({
          ownerEmail: owner,
          projectId: project.id,
          assetId: fallbackAssetId || `${assetId}-${requestedHash}`,
          role: clean(suppliedMetadata.role, 80) || 'reference',
          stableUrl: requestedUrl,
          contentHash: requestedHash,
          mimeType: requestedType,
          metadata: suppliedMetadata,
          retentionClass: 'source',
        });
      }
      const url = clean(canonical?.asset?.stableUrl || requestedUrl, 2000);
      const hash = clean(canonical?.asset?.contentHash || requestedHash, 256);
      const type = clean(canonical?.asset?.mimeType || requestedType, 160).toLowerCase();
      return db.transaction(() => {
        const existing = db.prepare(`SELECT * FROM video_workbench_asset_versions
          WHERE owner_email = ? AND project_id = ? AND asset_id = ?
            AND ((source_project_asset_id = ?) OR (source_project_asset_id IS NULL AND ? IS NULL))
            AND stable_url = ? AND content_hash = ? AND mime_type = ?
          ORDER BY sequence LIMIT 1`).get(
          owner, project.id, assetId, canonical?.ref?.projectAssetId || null,
          canonical?.ref?.projectAssetId || null, url, hash, type,
        );
        if (existing) return hydrateVersion(versionFromRow(existing));
        const sequence = db.prepare(`SELECT COALESCE(MAX(sequence), 0) + 1 AS value
          FROM video_workbench_asset_versions WHERE asset_id = ? AND owner_email = ? AND project_id = ?`)
          .get(assetId, owner, project.id).value;
        const id = randomUUID();
        db.prepare(`INSERT INTO video_workbench_asset_versions
          (id, asset_id, owner_email, project_id, sequence, source_project_asset_id,
           stable_url, content_hash, mime_type, metadata_json, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
          id, assetId, owner, project.id, sequence, canonical?.ref?.projectAssetId || null,
          url, hash, type, JSON.stringify(suppliedMetadata), timestamp(),
        );
        return hydrateVersion(versionFromRow(db.prepare('SELECT * FROM video_workbench_asset_versions WHERE id = ?').get(id)));
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
      const sourceMetadata = {
        ...(metadata && typeof metadata === 'object' && !Array.isArray(metadata) ? metadata : {}),
        sourceKind: source.kind,
        fileName: clean(source.file_name, 500),
        bytes: source.bytes,
      };
      const canonical = createCanonicalProjectAsset({
        ownerEmail: owner,
        projectId: project.id,
        assetId: source.id,
        role: clean(sourceMetadata.role, 80) || 'reference',
        stableUrl: `/api/video/assets/${encodeURIComponent(source.id)}`,
        contentHash,
        mimeType,
        metadata: sourceMetadata,
        retentionClass: 'source',
      });
      return api.addAssetVersion({
        ownerEmail: owner,
        projectId: project.id,
        assetId,
        projectAssetRef: canonical.ref,
        stableUrl: canonical.asset.stableUrl,
        contentHash,
        mimeType,
        metadata: sourceMetadata,
      });
    },

    addAssetVersionFromProjectAsset({ ownerEmail, projectId, assetId, sourceProjectId,
      sourceProjectAssetId, expectedContentHash, role = 'reference', metadata = {} }) {
      const { owner, project } = requireProject(ownerEmail, projectId);
      requireAsset(owner, project.id, assetId);
      const sourceProject = projectStore.getProject({ ownerEmail: owner, projectId: sourceProjectId });
      if (!sourceProject) throw coded('PROJECT_NOT_FOUND', 'source project not found');
      const sourceAsset = canonicalAssetStore?.getProjectAsset?.({
        ownerEmail: owner,
        projectId: sourceProject.id,
        projectAssetId: sourceProjectAssetId,
        purpose: 'reuse',
      });
      if (!sourceAsset) throw coded('PROJECT_ASSET_NOT_FOUND', 'source project asset not found');
      let sourceRef;
      try {
        sourceRef = publicProjectAssetRef(sourceAsset, {
          role: clean(role, 80) || 'reference',
          expectedContentHash,
        });
      } catch (error) {
        throw coded('PROJECT_ASSET_REF_INVALID', error?.message || 'source project asset reference is invalid');
      }
      const sourceMetadata = sourceAsset.metadata && typeof sourceAsset.metadata === 'object'
        ? sourceAsset.metadata : {};
      const imported = createCanonicalProjectAsset({
        ownerEmail: owner,
        projectId: project.id,
        assetId: sourceAsset.assetId || sourceAsset.projectAssetId,
        role: sourceRef.role,
        stableUrl: sourceAsset.stableUrl,
        contentHash: sourceAsset.contentHash,
        mimeType: sourceAsset.mimeType,
        width: sourceAsset.width,
        height: sourceAsset.height,
        retentionClass: sourceAsset.retentionClass || 'source',
        metadata: {
          ...sourceMetadata,
          ...(metadata && typeof metadata === 'object' && !Array.isArray(metadata) ? metadata : {}),
          importedFromProjectAsset: {
            projectId: sourceRef.projectId,
            projectAssetId: sourceRef.projectAssetId,
            expectedContentHash: sourceRef.expectedContentHash,
          },
        },
      });
      return api.addAssetVersion({
        ownerEmail: owner,
        projectId: project.id,
        assetId,
        projectAssetRef: imported.ref.projectAssetId,
        stableUrl: imported.asset.stableUrl,
        contentHash: imported.asset.contentHash,
        mimeType: imported.asset.mimeType,
        metadata: {
          ...sourceMetadata,
          ...(metadata && typeof metadata === 'object' && !Array.isArray(metadata) ? metadata : {}),
          sourceProjectAssetRef: sourceRef,
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

    createShot({ ownerEmail, projectId, position, purpose, durationMs, cameraLanguage = '', prompt = '', direction = {},
      firstFrameRef = null, lastFrameRef = null, modelIntent = '' }) {
      const { owner, project } = requireProject(ownerEmail, projectId);
      validatePosition(position);
      validateDuration(durationMs);
      const id = randomUUID();
      const createdAt = timestamp();
      const normalizedCameraLanguage = clean(cameraLanguage, 2000);
      const normalizedDirection = normalizeShotDirection(direction, normalizedCameraLanguage);
      const normalizedFirstFrameRef = requireShotFrameRef({ owner, project, value: firstFrameRef, role: 'first_frame' });
      const normalizedLastFrameRef = requireShotFrameRef({ owner, project, value: lastFrameRef, role: 'last_frame' });
      const normalizedModelIntent = clean(modelIntent, 2000);
      try {
        db.prepare(`INSERT INTO video_storyboard_shots
          (id, owner_email, project_id, position, purpose, duration_ms, camera_language, prompt, direction_json,
           first_frame_ref, last_frame_ref, model_intent, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
          id, owner, project.id, position, clean(purpose, 500), durationMs,
          normalizedCameraLanguage, clean(prompt, 8000), JSON.stringify(normalizedDirection),
          JSON.stringify(normalizedFirstFrameRef), JSON.stringify(normalizedLastFrameRef), normalizedModelIntent,
          createdAt, createdAt,
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
        next.direction = normalizeShotDirection(patch.direction ?? shot.direction, patch.cameraLanguage ?? shot.cameraLanguage);
        next.cameraLanguage = next.direction.cameraLanguage;
        const framePatch = (value, role) => (role in patch ? requireShotFrameRef({ owner, project, value, role }) : value);
        const nextFirstFrameRef = framePatch(next.firstFrameRef, 'first_frame');
        const nextLastFrameRef = framePatch(next.lastFrameRef, 'last_frame');
        const nextModelIntent = clean(next.modelIntent, 2000);
        validatePosition(next.position);
        validateDuration(next.durationMs);
        try {
          db.prepare(`UPDATE video_storyboard_shots SET position = ?, purpose = ?, duration_ms = ?,
            camera_language = ?, prompt = ?, direction_json = ?, first_frame_ref = ?, last_frame_ref = ?, model_intent = ?,
            revision = revision + 1, updated_at = ? WHERE id = ?`)
            .run(next.position, clean(next.purpose, 500), next.durationMs, clean(next.cameraLanguage, 2000),
              clean(next.prompt, 8000), JSON.stringify(next.direction),
              JSON.stringify(nextFirstFrameRef), JSON.stringify(nextLastFrameRef), nextModelIntent,
              timestamp(), shot.id);
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
      if (!BINDING_ROLES.has(role)) throw coded('INVALID_BINDING', 'unknown shot asset role');
      requireReusableVersion(owner, project.id, assetId, assetVersionId, role);
      const createdAt = timestamp();
      db.prepare(`INSERT INTO video_shot_asset_bindings
        (shot_id, asset_id, asset_version_id, owner_email, project_id, role, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(shot_id, role, asset_id) DO UPDATE SET asset_version_id = excluded.asset_version_id,
          created_at = excluded.created_at`).run(shotId, assetId, assetVersionId, owner, project.id, role, createdAt);
      return bindingFromRow(db.prepare(`SELECT * FROM video_shot_asset_bindings
        WHERE shot_id = ? AND role = ? AND asset_id = ?`).get(shotId, role, assetId));
    },

    registerCandidate({ ownerEmail, projectId, shotId, generationJobId = null, outputAssetId, stableUrl, contentHash, mimeType,
      provenance = null, projectAssetRef = null }) {
      const { owner, project } = requireProject(ownerEmail, projectId);
      requireShot(owner, project.id, shotId);
      const outputId = clean(outputAssetId, 256);
      const normalizedUrl = clean(stableUrl, 2000);
      const normalizedHash = clean(contentHash, 256);
      const normalizedMimeType = clean(mimeType, 160).toLowerCase();
      if (!outputId || !normalizedUrl || !normalizedHash || !normalizedMimeType.startsWith('video/')) {
        throw coded('INVALID_BINDING', 'candidate delivery fields are required');
      }
      const existing = candidateFromRow(db.prepare(`SELECT * FROM video_shot_candidates
        WHERE shot_id = ? AND output_asset_id = ?`).get(shotId, outputId));
      if (existing) return existing;
      const id = randomUUID();
      const provenanceStatus = generationJobId ? 'unverified-legacy' : 'planned';
      const normalizedProjectAssetRef = projectAssetRef && typeof projectAssetRef === 'object'
        ? {
          ...projectAssetRef,
          role: projectAssetRef.role || 'generated-video',
          expectedContentHash: projectAssetRef.expectedContentHash || normalizedHash,
        }
        : null;
      const normalizedProvenance = normalizeVideoProvenance({
        ...(provenance && typeof provenance === 'object' ? provenance : {}),
        ...(normalizedProjectAssetRef ? { projectAssetRef: normalizedProjectAssetRef } : {}),
      }, provenanceStatus);
      db.prepare(`INSERT INTO video_shot_candidates
        (id, owner_email, project_id, shot_id, generation_job_id, output_asset_id,
         stable_url, content_hash, mime_type, provenance_status, provenance_json, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
        id, owner, project.id, shotId, clean(generationJobId, 256) || null, outputId,
        normalizedUrl, normalizedHash, normalizedMimeType, normalizedProvenance.status,
        JSON.stringify(normalizedProvenance), timestamp(),
      );
      return requireCandidate(owner, project.id, shotId, id);
    },

    registerCandidateFromJob({ ownerEmail, projectId, shotId, generationJobId }) {
      const { owner, project } = requireProject(ownerEmail, projectId);
      requireShot(owner, project.id, shotId);
      const jobId = clean(generationJobId, 256);
      const jobColumns = tableExists(db, 'video_jobs') ? tableColumns(db, 'video_jobs') : new Set();
      const jobFields = ['id', 'status', 'result_asset_id', 'provider_route', 'catalog_version',
        'provider_cost_cny', 'current_attempt_id', 'updated_at'].filter(field => jobColumns.has(field));
      const job = jobId && jobFields.length >= 3 ? db.prepare(`SELECT ${jobFields.join(', ')} FROM video_jobs
        WHERE id = ? AND owner_email = ? AND project_id = ?`).get(jobId, owner, project.id) : null;
      if (!job) throw coded('VIDEO_JOB_NOT_FOUND', 'video generation job not found');
      if (job.status !== 'completed' || !clean(job.result_asset_id, 256)) {
        throw coded('VIDEO_JOB_NOT_READY', 'video generation job is not complete');
      }
      const output = db.prepare(`SELECT id, kind, content_type, bytes, sha256 FROM video_assets
        WHERE id = ? AND owner_email = ?`).get(job.result_asset_id, owner);
      const outputMimeType = clean(output?.content_type, 160).toLowerCase();
      if (!output || output.kind !== 'output' || !Number.isSafeInteger(output.bytes) || output.bytes <= 0
        || !clean(output.sha256, 256) || !outputMimeType.startsWith('video/')) {
        throw coded('VIDEO_JOB_NOT_READY', 'verified video delivery is missing');
      }
      const sourceProjectAssetIds = db.prepare(`SELECT DISTINCT v.source_project_asset_id, pa.content_hash
        FROM video_shot_asset_bindings b
        JOIN video_workbench_asset_versions v ON v.id = b.asset_version_id
        JOIN project_assets pa ON pa.id = v.source_project_asset_id
        WHERE b.owner_email = ? AND b.project_id = ? AND b.shot_id = ?
          AND v.source_project_asset_id IS NOT NULL`).all(owner, project.id, shotId)
        .map(row => lookupCanonicalProjectAsset({
          ownerEmail: owner,
          projectId: project.id,
          projectAssetId: row.source_project_asset_id,
          expectedContentHash: row.content_hash,
          role: 'reference',
        })?.ref?.projectAssetId)
        .filter(Boolean);
      const canonical = createCanonicalProjectAsset({
        ownerEmail: owner,
        projectId: project.id,
        assetId: output.id,
        role: 'generated-video',
        stableUrl: `/api/video/assets/${encodeURIComponent(output.id)}`,
        contentHash: output.sha256,
        mimeType: outputMimeType,
        generationRunId: job.id,
        metadata: {
          sourceKind: 'video-output',
          bytes: output.bytes,
          generationJobId: job.id,
          ...(sourceProjectAssetIds.length ? { sourceProjectAssetIds } : {}),
        },
        retentionClass: 'generated',
      });
      let provenance = normalizeVideoProvenance(null, 'unverified-legacy');
      if (job.current_attempt_id && tableExists(db, 'video_job_attempts')) {
        const attempt = db.prepare(`SELECT provider, model, request_hash, provider_task_id
          FROM video_job_attempts WHERE id = ? AND job_id = ?`).get(job.current_attempt_id, job.id);
        if (attempt) {
          provenance = verifiedVideoProvenance({
            provider: attempt.provider,
            model: attempt.model,
            requestId: attempt.provider_task_id,
            requestHash: attempt.request_hash,
            catalogVersion: job.catalog_version,
            costCny: job.provider_cost_cny,
            generatedAt: job.updated_at || timestamp(),
          });
        }
      }
      return api.registerCandidate({
        ownerEmail: owner,
        projectId: project.id,
        shotId,
        generationJobId: job.id,
        outputAssetId: output.id,
        stableUrl: `/api/video/assets/${encodeURIComponent(output.id)}`,
        contentHash: output.sha256,
        mimeType: outputMimeType,
        provenance,
        projectAssetRef: canonical.ref,
      });
    },

    selectCandidate({ ownerEmail, projectId, shotId, candidateId, expectedRevision }) {
      const { owner, project } = requireProject(ownerEmail, projectId);
      return db.transaction(() => {
        const shot = requireShot(owner, project.id, shotId);
        const candidate = requireReusableCandidate(owner, project.id, shot.id, candidateId);
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
      requireReusableCandidate(owner, project.id, shot.id, candidateId);
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

    applyCandidateToTimeline({ ownerEmail, projectId, shotId, candidateId,
      expectedShotRevision, expectedClipRevision, position, trimStartMs = 0, trimEndMs, muted = false }) {
      const { owner, project } = requireProject(ownerEmail, projectId);
      validatePosition(position);
      return db.transaction(() => {
        const shot = requireShot(owner, project.id, shotId);
        const candidate = requireReusableCandidate(owner, project.id, shot.id, candidateId);
        const positionClip = clipFromRow(db.prepare(`SELECT * FROM video_timeline_clips
          WHERE owner_email = ? AND project_id = ? AND position = ?`).get(owner, project.id, position));
        if (positionClip && positionClip.shotId !== shot.id) {
          throw coded('INVALID_POSITION', 'timeline position already belongs to another shot');
        }
        const currentClip = positionClip;
        if (!Number.isSafeInteger(trimStartMs) || trimStartMs < 0
          || !Number.isSafeInteger(trimEndMs) || trimEndMs <= trimStartMs
          || trimEndMs > shot.durationMs) {
          throw coded('INVALID_DURATION', 'timeline trim is outside shot duration');
        }
        const replayMatches = shot.revision === expectedShotRevision + 1
          && shot.selectedCandidateId === candidate.id
          && currentClip
          && currentClip.status === 'active'
          && currentClip.candidateId === candidate.id
          && currentClip.position === position
          && currentClip.trimStartMs === trimStartMs
          && currentClip.trimEndMs === trimEndMs
          && currentClip.muted === Boolean(muted)
          && (expectedClipRevision === undefined || currentClip.revision === expectedClipRevision + 1);
        if (replayMatches) {
          return {
            status: 'replayed',
            replayed: true,
            shot,
            candidate: hydrateCandidate(candidate),
            timelineClip: currentClip,
            providerSubmission: false,
            billingMutation: false,
          };
        }
        if (shot.revision !== expectedShotRevision) throw coded('VERSION_CONFLICT', 'shot revision conflict', shot);
        if (currentClip && expectedClipRevision === undefined) {
          throw coded('VERSION_CONFLICT', 'timeline clip revision is required when replacing an existing clip', currentClip);
        }
        if (currentClip && currentClip.revision !== expectedClipRevision) {
          throw coded('VERSION_CONFLICT', 'timeline clip revision conflict', currentClip);
        }
        if (currentClip && currentClip.status !== 'active') {
          throw coded('INVALID_TIMELINE_CLIP', 'timeline clip is not active');
        }
        const changedAt = timestamp();
        db.prepare(`UPDATE video_shot_candidates SET status = 'available'
          WHERE owner_email = ? AND project_id = ? AND shot_id = ? AND status = 'selected'`).run(
          owner, project.id, shot.id,
        );
        db.prepare(`UPDATE video_shot_candidates SET status = 'selected'
          WHERE id = ? AND owner_email = ? AND project_id = ? AND shot_id = ?`).run(
          candidate.id, owner, project.id, shot.id,
        );
        db.prepare(`UPDATE video_timeline_clips SET status = 'stale', revision = revision + 1, updated_at = ?
          WHERE owner_email = ? AND project_id = ? AND shot_id = ? AND status = 'active' AND candidate_id <> ?
            AND (id <> ? OR ? IS NULL)`)
          .run(changedAt, owner, project.id, shot.id, candidate.id, currentClip?.id ?? null, currentClip?.id ?? null);
        if (currentClip) {
          db.prepare(`UPDATE video_timeline_clips SET candidate_id = ?, position = ?, trim_start_ms = ?,
            trim_end_ms = ?, muted = ?, status = 'active', revision = revision + 1, updated_at = ?
            WHERE id = ? AND owner_email = ? AND project_id = ? AND revision = ? AND status = 'active'`).run(
            candidate.id, position, trimStartMs, trimEndMs, muted ? 1 : 0, changedAt,
            currentClip.id, owner, project.id, expectedClipRevision,
          );
          if (db.prepare('SELECT changes() AS count').get().count !== 1) {
            throw coded('VERSION_CONFLICT', 'timeline clip revision conflict', currentClip);
          }
        } else {
          const clipId = randomUUID();
          db.prepare(`INSERT INTO video_timeline_clips
            (id, owner_email, project_id, shot_id, candidate_id, position, trim_start_ms, trim_end_ms,
             muted, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
            clipId, owner, project.id, shot.id, candidate.id, position, trimStartMs, trimEndMs,
            muted ? 1 : 0, changedAt, changedAt,
          );
        }
        const hasOutdatedBinding = Boolean(db.prepare(`SELECT 1 FROM video_shot_asset_bindings b
          JOIN video_workbench_assets a ON a.id = b.asset_id
          WHERE b.owner_email = ? AND b.project_id = ? AND b.shot_id = ?
            AND (a.approved_version_id IS NULL OR a.approved_version_id <> b.asset_version_id) LIMIT 1`)
          .get(owner, project.id, shot.id));
        const nextStatus = shot.status === 'stale' || hasOutdatedBinding ? 'stale' : 'approved';
        db.prepare(`UPDATE video_storyboard_shots SET selected_candidate_id = ?, status = ?,
          revision = revision + 1, updated_at = ? WHERE id = ? AND owner_email = ? AND project_id = ? AND revision = ?`)
          .run(candidate.id, nextStatus, changedAt, shot.id, owner, project.id, expectedShotRevision);
        if (db.prepare('SELECT changes() AS count').get().count !== 1) {
          throw coded('VERSION_CONFLICT', 'shot revision conflict', shot);
        }
        return {
          status: 'applied',
          replayed: false,
          shot: requireShot(owner, project.id, shot.id),
          candidate: hydrateCandidate(requireCandidate(owner, project.id, shot.id, candidate.id)),
          timelineClip: clipFromRow(db.prepare(`SELECT * FROM video_timeline_clips
            WHERE owner_email = ? AND project_id = ? AND shot_id = ? AND position = ?`).get(
            owner, project.id, shot.id, position,
          )),
          providerSubmission: false,
          billingMutation: false,
        };
      })();
    },

    updateTimelineClip({ ownerEmail, projectId, clipId, expectedRevision, patch = {} }) {
      const { owner, project } = requireProject(ownerEmail, projectId);
      const allowed = new Set(['position', 'trimStartMs', 'trimEndMs', 'muted']);
      const keys = Object.keys(patch || {});
      if (!keys.length || keys.some(key => !allowed.has(key))) {
        throw coded('INVALID_TIMELINE_CLIP', 'timeline clip patch contains unsupported fields');
      }
      return db.transaction(() => {
        const current = requireClip(owner, project.id, clipId);
        if (current.revision !== expectedRevision) {
          throw coded('VERSION_CONFLICT', 'timeline clip revision conflict', current);
        }
        const shot = requireShot(owner, project.id, current.shotId);
        const next = {
          position: patch.position === undefined ? current.position : patch.position,
          trimStartMs: patch.trimStartMs === undefined ? current.trimStartMs : patch.trimStartMs,
          trimEndMs: patch.trimEndMs === undefined ? current.trimEndMs : patch.trimEndMs,
          muted: patch.muted === undefined ? current.muted : Boolean(patch.muted),
        };
        validatePosition(next.position);
        if (!Number.isSafeInteger(next.trimStartMs) || next.trimStartMs < 0
          || !Number.isSafeInteger(next.trimEndMs) || next.trimEndMs <= next.trimStartMs
          || next.trimEndMs > shot.durationMs) {
          throw coded('INVALID_DURATION', 'timeline trim is outside shot duration');
        }
        const changedAt = timestamp();
        const occupant = next.position === current.position ? null : clipFromRow(db.prepare(`SELECT *
          FROM video_timeline_clips WHERE owner_email = ? AND project_id = ? AND position = ?`).get(
          owner, project.id, next.position));
        if (occupant) {
          db.prepare(`UPDATE video_timeline_clips SET position = ?, revision = revision + 1, updated_at = ?
            WHERE id = ? AND owner_email = ? AND project_id = ?`).run(
            current.position, changedAt, occupant.id, owner, project.id,
          );
        }
        db.prepare(`UPDATE video_timeline_clips SET position = ?, trim_start_ms = ?, trim_end_ms = ?,
          muted = ?, revision = revision + 1, updated_at = ?
          WHERE id = ? AND owner_email = ? AND project_id = ?`).run(
          next.position, next.trimStartMs, next.trimEndMs, next.muted ? 1 : 0,
          changedAt, current.id, owner, project.id,
        );
        return requireClip(owner, project.id, current.id);
      })();
    },

    replaceTimelineClipCandidate({ ownerEmail, projectId, clipId, expectedRevision, candidateId }) {
      const { owner, project } = requireProject(ownerEmail, projectId);
      return db.transaction(() => {
        const current = requireClip(owner, project.id, clipId);
        if (current.revision !== expectedRevision) {
          throw coded('VERSION_CONFLICT', 'timeline clip revision conflict', current);
        }
        const shot = requireShot(owner, project.id, current.shotId);
        const candidate = requireReusableCandidate(owner, project.id, shot.id, candidateId);
        if (shot.status === 'stale' || shot.selectedCandidateId !== candidate.id) {
          throw coded('INVALID_TIMELINE_CANDIDATE', 'timeline clip replacement must use the current candidate of a non-stale shot');
        }
        if (current.status === 'active') {
          if (current.candidateId !== candidate.id) {
            throw coded('INVALID_TIMELINE_CANDIDATE', 'active timeline clip cannot be replaced implicitly');
          }
          return current;
        }
        if (current.status !== 'stale') {
          throw coded('INVALID_TIMELINE_CANDIDATE', 'only a stale timeline clip can be replaced');
        }
        const changedAt = timestamp();
        db.prepare(`UPDATE video_timeline_clips SET candidate_id = ?, status = 'active',
          revision = revision + 1, updated_at = ?
          WHERE id = ? AND owner_email = ? AND project_id = ?`).run(
          candidate.id, changedAt, current.id, owner, project.id,
        );
        return requireClip(owner, project.id, current.id);
      })();
    },

    createAudioTrack({ ownerEmail, projectId, kind, assetId, assetVersionId, startMs = 0,
      durationMs, volume = 1, muted = false, language = '', voiceAnchor = '',
      beatMarkers = [], subtitleCues = [] }) {
      const { owner, project } = requireProject(ownerEmail, projectId);
      const asset = requireAsset(owner, project.id, assetId);
      const normalizedKind = clean(kind, 20);
      const version = requireReusableVersion(owner, project.id, assetId, assetVersionId, normalizedKind);
      const normalizedLanguage = clean(language, 32);
      const normalizedAnchor = clean(voiceAnchor, 240);
      const normalizedBeats = Array.isArray(beatMarkers) ? beatMarkers.slice() : beatMarkers;
      const normalizedCues = normalizeAudioSubtitleCues(subtitleCues, durationMs);
      validateAudioShape({ kind: normalizedKind, asset, version, startMs, durationMs,
        volume: Number(volume), language: normalizedLanguage, voiceAnchor: normalizedAnchor,
        beatMarkers: normalizedBeats, subtitleCues: normalizedCues });
      const id = randomUUID();
      const createdAt = timestamp();
      db.prepare(`INSERT INTO video_audio_tracks
        (id, owner_email, project_id, kind, asset_id, asset_version_id, start_ms, duration_ms,
         volume, muted, language, voice_anchor, beat_markers_json, subtitle_cues_json,
         created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
        id, owner, project.id, normalizedKind, asset.id, version.id, startMs, durationMs,
        Number(volume), muted ? 1 : 0, normalizedLanguage, normalizedAnchor,
        JSON.stringify(normalizedBeats), JSON.stringify(normalizedCues), createdAt, createdAt,
      );
      return audioTrackFromRow(db.prepare('SELECT * FROM video_audio_tracks WHERE id = ?').get(id));
    },

    updateAudioTrack({ ownerEmail, projectId, trackId, expectedRevision, patch = {} }) {
      const { owner, project } = requireProject(ownerEmail, projectId);
      const allowed = new Set(['kind', 'assetId', 'assetVersionId', 'startMs', 'durationMs', 'volume',
        'muted', 'language', 'voiceAnchor', 'beatMarkers', 'subtitleCues']);
      const keys = Object.keys(patch || {});
      if (!keys.length || keys.some(key => !allowed.has(key))) throw coded('INVALID_AUDIO_TRACK', 'audio track patch contains unsupported fields');
      return db.transaction(() => {
        const row = db.prepare(`SELECT * FROM video_audio_tracks
          WHERE id = ? AND owner_email = ? AND project_id = ?`).get(trackId, owner, project.id);
        const current = audioTrackFromRow(row);
        if (!current) throw coded('AUDIO_TRACK_NOT_FOUND', 'audio track not found');
        if (current.revision !== expectedRevision) throw coded('VERSION_CONFLICT', 'audio track revision conflict', current);
        const next = { ...current, ...patch };
        const asset = requireAsset(owner, project.id, next.assetId);
        const versionChanged = current.assetId !== next.assetId || current.assetVersionId !== next.assetVersionId;
        const version = versionChanged
          ? requireReusableVersion(owner, project.id, next.assetId, next.assetVersionId, next.kind)
          : requireVersion(owner, project.id, next.assetId, next.assetVersionId);
        const normalizedLanguage = clean(next.language, 32);
        const normalizedAnchor = clean(next.voiceAnchor, 240);
        const normalizedBeats = Array.isArray(next.beatMarkers) ? next.beatMarkers.slice() : next.beatMarkers;
        const normalizedCues = normalizeAudioSubtitleCues(next.subtitleCues, next.durationMs);
        validateAudioShape({ kind: clean(next.kind, 20), asset, version, startMs: next.startMs,
          durationMs: next.durationMs, volume: Number(next.volume), language: normalizedLanguage,
          voiceAnchor: normalizedAnchor, beatMarkers: normalizedBeats, subtitleCues: normalizedCues });
        const changedAt = timestamp();
        db.prepare(`UPDATE video_audio_tracks SET kind = ?, asset_id = ?, asset_version_id = ?,
          start_ms = ?, duration_ms = ?, volume = ?, muted = ?, language = ?, voice_anchor = ?,
          beat_markers_json = ?, subtitle_cues_json = ?, revision = revision + 1, updated_at = ?
          WHERE id = ?`).run(
          clean(next.kind, 20), asset.id, version.id, next.startMs, next.durationMs, Number(next.volume),
          next.muted ? 1 : 0, normalizedLanguage, normalizedAnchor, JSON.stringify(normalizedBeats),
          JSON.stringify(normalizedCues), changedAt, current.id,
        );
        return audioTrackFromRow(db.prepare('SELECT * FROM video_audio_tracks WHERE id = ?').get(current.id));
      })();
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
          requireReusableVersion(owner, project.id, ref.assetId, ref.assetVersionId, ref.role || 'reference');
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

    createExportManifest({ ownerEmail, projectId, options = {} }) {
      const { owner, project } = requireProject(ownerEmail, projectId);
      const manifest = buildVideoExportManifest({
        workbench: api.listWorkbench({ ownerEmail: owner, projectId: project.id }),
        options,
      });
      const existing = db.prepare(`SELECT * FROM video_export_manifests
        WHERE owner_email = ? AND project_id = ? AND manifest_hash = ?`)
        .get(owner, project.id, manifest.manifestHash);
      if (existing) return { ...exportManifestFromRow(existing), replayed: true };
      const id = randomUUID();
      const createdAt = timestamp();
      try {
        db.prepare(`INSERT INTO video_export_manifests
          (id, owner_email, project_id, manifest_hash, schema_version, manifest_json, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)`)
          .run(id, owner, project.id, manifest.manifestHash, manifest.schemaVersion,
            JSON.stringify(manifest), createdAt);
      } catch (error) {
        if (/UNIQUE constraint failed/i.test(error.message)) {
          const raced = db.prepare(`SELECT * FROM video_export_manifests
            WHERE owner_email = ? AND project_id = ? AND manifest_hash = ?`)
            .get(owner, project.id, manifest.manifestHash);
          if (raced) return { ...exportManifestFromRow(raced), replayed: true };
        }
        throw error;
      }
      return { ...exportManifestFromRow(db.prepare('SELECT * FROM video_export_manifests WHERE id = ?').get(id)), replayed: false };
    },

    getExportManifest({ ownerEmail, projectId, manifestId }) {
      const { owner, project } = requireProject(ownerEmail, projectId);
      const row = db.prepare(`SELECT * FROM video_export_manifests
        WHERE id = ? AND owner_email = ? AND project_id = ?`).get(manifestId, owner, project.id);
      if (!row) throw coded('EXPORT_MANIFEST_NOT_FOUND', 'export manifest not found');
      return exportManifestFromRow(row);
    },

    listExportManifests({ ownerEmail, projectId, limit = 20 }) {
      const { owner, project } = requireProject(ownerEmail, projectId);
      const requestedLimit = Number(limit);
      const boundedLimit = Number.isFinite(requestedLimit)
        ? Math.max(1, Math.min(50, Math.floor(requestedLimit)))
        : 20;
      return db.prepare(`SELECT * FROM video_export_manifests
        WHERE owner_email = ? AND project_id = ?
        ORDER BY created_at DESC, id DESC LIMIT ?`).all(owner, project.id, boundedLimit)
        .map(exportManifestFromRow);
    },

    createExportJob({ ownerEmail, projectId, manifestId, preflight = null, requirePreflight = false }) {
      const { owner, project } = requireProject(ownerEmail, projectId);
      const normalizedPreflight = normalizePreflight(preflight);
      if (requirePreflight && !normalizedPreflight) {
        throw coded('RENDER_PREFLIGHT_REQUIRED', '创建渲染任务前必须完成严格预检');
      }
      const manifestRow = db.prepare(`SELECT * FROM video_export_manifests
        WHERE id = ? AND owner_email = ? AND project_id = ?`).get(manifestId, owner, project.id);
      if (!manifestRow) throw coded('EXPORT_MANIFEST_NOT_FOUND', 'export manifest not found');
      const manifestRecord = exportManifestFromRow(manifestRow);
      const currentManifest = buildVideoExportManifest({
        workbench: api.listWorkbench({ ownerEmail: owner, projectId: project.id }),
        options: manifestRecord.manifest.options,
      });
      if (currentManifest.manifestHash !== manifestRecord.manifestHash) {
        throw coded('EXPORT_JOB_STALE', 'export manifest changed after it was created');
      }
      if (normalizedPreflight) {
        assertCurrentRendererPreflight({
          api,
          ownerEmail: owner,
          projectId: project.id,
          preflight: normalizedPreflight,
        });
        const planResolution = String(normalizedPreflight.attestation.plan?.options?.resolution || '').toLowerCase();
        const manifestResolution = String(manifestRecord.manifest.options?.resolution || '').toLowerCase();
        if (planResolution && manifestResolution && planResolution !== manifestResolution) {
          throw coded('RENDER_PREFLIGHT_STALE', '预检清晰度与导出清单不一致，请重新预检');
        }
      }
      const existing = db.prepare(`SELECT * FROM video_export_jobs
        WHERE owner_email = ? AND project_id = ? AND manifest_id = ? AND manifest_hash = ?`)
        .get(owner, project.id, manifestRecord.id, manifestRecord.manifestHash);
      if (existing) {
        const existingJob = exportJobFromRow(existing);
        if (normalizedPreflight && existingJob.preflightHash !== normalizedPreflight.preflightHash) {
          throw coded('EXPORT_JOB_PREFLIGHT_MISMATCH', '已有渲染任务绑定了不同的预检证明');
        }
        if (requirePreflight && !existingJob.preflightHash) {
          throw coded('RENDER_PREFLIGHT_REQUIRED', '已有渲染任务缺少严格预检证明，请重新创建任务');
        }
        return { ...existingJob, replayed: true };
      }
      const createdAt = timestamp();
      const job = createVideoExportJob({
        id: randomUUID(),
        ownerEmail: owner,
        projectId: project.id,
        manifestId: manifestRecord.id,
        manifest: manifestRecord.manifest,
        createdAt,
        preflight: normalizedPreflight,
      });
      try {
        db.prepare(`INSERT INTO video_export_jobs
          (id, owner_email, project_id, manifest_id, manifest_hash, preflight_hash, preflight_json, state, attempt, renderer,
           provider_submission, billing_mutation, output_asset_id, output_url, error_code,
           error_message, created_at, updated_at, started_at, completed_at, canceled_at,
           worker_id, lease_token, lease_expires_at, job_hash)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
          job.id, job.ownerEmail, job.projectId, job.manifestId, job.manifestHash, job.preflightHash,
          job.preflightJson, job.state,
          job.attempt, job.renderer, Number(job.providerSubmission), Number(job.billingMutation),
          job.outputAssetId, job.outputUrl, job.errorCode, job.errorMessage, job.createdAt,
          job.updatedAt, job.startedAt, job.completedAt, job.canceledAt, job.workerId,
          job.leaseToken, job.leaseExpiresAt, job.jobHash,
        );
      } catch (error) {
        if (/UNIQUE constraint failed/i.test(error.message)) {
          const raced = db.prepare(`SELECT * FROM video_export_jobs
            WHERE owner_email = ? AND project_id = ? AND manifest_id = ? AND manifest_hash = ?`)
            .get(owner, project.id, manifestRecord.id, manifestRecord.manifestHash);
          if (raced) {
            const racedJob = exportJobFromRow(raced);
            if (normalizedPreflight && racedJob.preflightHash !== normalizedPreflight.preflightHash) {
              throw coded('EXPORT_JOB_PREFLIGHT_MISMATCH', '已有渲染任务绑定了不同的预检证明');
            }
            return { ...racedJob, replayed: true };
          }
        }
        throw error;
      }
      return { ...exportJobFromRow(db.prepare('SELECT * FROM video_export_jobs WHERE id = ?').get(job.id)), replayed: false };
    },

    getExportJob({ ownerEmail, projectId, jobId }) {
      const { owner, project } = requireProject(ownerEmail, projectId);
      const row = db.prepare(`SELECT * FROM video_export_jobs
        WHERE id = ? AND owner_email = ? AND project_id = ?`).get(jobId, owner, project.id);
      if (!row) throw coded('EXPORT_JOB_NOT_FOUND', 'export job not found');
      return exportJobFromRow(row);
    },

    getRendererAttempt({ ownerEmail, projectId, jobId }) {
      const { owner, project } = requireProject(ownerEmail, projectId);
      const row = db.prepare(`SELECT * FROM video_export_jobs
        WHERE id = ? AND owner_email = ? AND project_id = ?`).get(jobId, owner, project.id);
      if (!row) throw coded('EXPORT_JOB_NOT_FOUND', 'export job not found');
      const job = exportJobFromRow(row);
      if (job.state !== 'rendering' || job.attempt < 1) {
        throw coded('RENDER_OUTBOX_NOT_FOUND', 'rendering job has no active renderer attempt');
      }
      const manifestRow = db.prepare(`SELECT * FROM video_export_manifests
        WHERE id = ? AND owner_email = ? AND project_id = ?`).get(job.manifestId, owner, project.id);
      if (!manifestRow) throw coded('EXPORT_MANIFEST_NOT_FOUND', 'export manifest not found');
      const manifestRecord = exportManifestFromRow(manifestRow);
      const manifest = buildVideoExportManifest({
        workbench: api.listWorkbench({ ownerEmail: owner, projectId: project.id }),
        options: manifestRecord.manifest.options,
      });
      assertVideoExportJobCurrent(job, { manifestId: manifestRecord.id, manifest });
      let preflight = null;
      if (job.preflightHash) {
        preflight = parseJson(job.preflightJson, null);
        assertCurrentRendererPreflight({ api, ownerEmail: owner, projectId: project.id, preflight });
      }
      const eventRow = db.prepare(`SELECT * FROM video_renderer_outbox
        WHERE owner_email = ? AND project_id = ? AND request_id = ?`)
        .get(owner, project.id, rendererOutboxId(job.id, job.attempt));
      const event = rendererOutboxFromRow(eventRow);
      if (!event || event.jobId !== job.id || event.requestId !== `${job.id}:attempt:${job.attempt}`) {
        throw coded('RENDER_OUTBOX_NOT_FOUND', 'active renderer attempt is missing');
      }
      return { job, manifest, preflight, request: event.payload, event };
    },

    persistRendererReconciliation({
      ownerEmail, projectId, jobId, event, workerId, leaseToken,
      outputAssetId = '', outputUrl = '', errorCode = '', errorMessage = '',
    }) {
      const { owner, project } = requireProject(ownerEmail, projectId);
      const worker = clean(workerId, 200);
      const token = clean(leaseToken, 200);
      if (!worker || !token) throw coded('RENDER_RECONCILIATION_INVALID', 'renderer worker lease is required');
      if (!event || typeof event !== 'object') throw coded('RENDER_RECONCILIATION_INVALID', 'renderer event is required');
      assertVideoRendererOutboxIntegrity(event);
      if (!['processing', 'failed', 'completed', 'canceled'].includes(event.state)) {
        throw coded('RENDER_RECONCILIATION_INVALID', 'renderer event state is not persistable');
      }
      return db.transaction(() => {
        const jobRow = db.prepare(`SELECT * FROM video_export_jobs
          WHERE id = ? AND owner_email = ? AND project_id = ?`).get(jobId, owner, project.id);
        if (!jobRow) throw coded('EXPORT_JOB_NOT_FOUND', 'export job not found');
        const job = exportJobFromRow(jobRow);
        const manifestRow = db.prepare(`SELECT * FROM video_export_manifests
          WHERE id = ? AND owner_email = ? AND project_id = ?`).get(job.manifestId, owner, project.id);
        if (!manifestRow) throw coded('EXPORT_MANIFEST_NOT_FOUND', 'export manifest not found');
        const manifestRecord = exportManifestFromRow(manifestRow);
        const manifest = buildVideoExportManifest({
          workbench: api.listWorkbench({ ownerEmail: owner, projectId: project.id }),
          options: manifestRecord.manifest.options,
        });
        assertVideoExportJobCurrent(job, { manifestId: manifestRecord.id, manifest });
        if (job.preflightHash) {
          const preflight = parseJson(job.preflightJson, null);
          assertCurrentRendererPreflight({ api, ownerEmail: owner, projectId: project.id, preflight });
        }
        if (event.id !== rendererOutboxId(job.id, job.attempt)
          || event.jobId !== job.id || event.projectId !== project.id
          || event.requestId !== `${job.id}:attempt:${job.attempt}`) {
          throw coded('RENDER_RECONCILIATION_STALE', 'renderer event does not belong to the current attempt');
        }
        const persistedRow = db.prepare(`SELECT * FROM video_renderer_outbox
          WHERE id = ? AND owner_email = ? AND project_id = ?`).get(event.id, owner, project.id);
        const persisted = rendererOutboxFromRow(persistedRow);
        if (!persisted || persisted.requestHash !== event.requestHash
          || persisted.attempts !== event.attempts || persisted.jobId !== event.jobId
          || persisted.requestId !== event.requestId) {
          throw coded('RENDER_RECONCILIATION_STALE', 'renderer event is stale');
        }
        if (event.state === 'processing') {
          if (job.state !== 'rendering' || job.workerId !== worker || job.leaseToken !== token
            || event.workerId !== worker || event.leaseToken !== token) {
            throw coded('RENDER_OUTBOX_LEASE_LOST', 'renderer worker lease does not match the active job');
          }
          persistRendererOutbox(db, event, owner, project.id);
        } else if (['failed', 'completed', 'canceled'].includes(event.state)) {
          if (job.state === 'rendering') {
            if (job.workerId !== worker || job.leaseToken !== token) {
              throw coded('RENDER_OUTBOX_LEASE_LOST', 'renderer worker lease does not match the active job');
            }
            if (event.state === 'completed' && (!clean(outputAssetId, 200) || !clean(outputUrl, 2000))) {
              throw coded('EXPORT_JOB_OUTPUT_REQUIRED', 'completed renderer event must include output asset and url');
            }
            const next = transitionVideoExportJob(job, event.state, {
              now: event.updatedAt,
              errorCode: clean(errorCode, 160) || event.lastErrorCode || 'RENDERER_FAILED',
              errorMessage: clean(errorMessage, 2000) || event.lastError,
              outputAssetId: clean(outputAssetId, 200),
              outputUrl: clean(outputUrl, 2000),
              workerId: worker,
              leaseToken: token,
            });
            persistExportJob(db, next, owner, project.id);
          } else if (job.state !== event.state) {
            throw coded('RENDER_RECONCILIATION_STALE', 'job and renderer event terminal states differ');
          }
          persistRendererOutbox(db, event, owner, project.id);
        }
        return {
          job: exportJobFromRow(db.prepare('SELECT * FROM video_export_jobs WHERE id = ?').get(job.id)),
          event: rendererOutboxFromRow(db.prepare('SELECT * FROM video_renderer_outbox WHERE id = ?').get(event.id)),
        };
      })();
    },

    listExportJobs({ ownerEmail, projectId, limit = 20 }) {
      const { owner, project } = requireProject(ownerEmail, projectId);
      const requestedLimit = Number(limit);
      const boundedLimit = Number.isFinite(requestedLimit)
        ? Math.max(1, Math.min(50, Math.floor(requestedLimit)))
        : 20;
      return db.prepare(`SELECT * FROM video_export_jobs
        WHERE owner_email = ? AND project_id = ?
        ORDER BY created_at DESC, id DESC LIMIT ?`).all(owner, project.id, boundedLimit)
        .map(exportJobFromRow);
    },

    transitionExportJob({ ownerEmail, projectId, jobId, nextState, errorCode, errorMessage, outputAssetId, outputUrl,
      workerId, leaseToken }) {
      const { owner, project } = requireProject(ownerEmail, projectId);
      return db.transaction(() => {
        const row = db.prepare(`SELECT * FROM video_export_jobs
          WHERE id = ? AND owner_email = ? AND project_id = ?`).get(jobId, owner, project.id);
        if (!row) throw coded('EXPORT_JOB_NOT_FOUND', 'export job not found');
        const job = exportJobFromRow(row);
        const manifestRow = db.prepare(`SELECT * FROM video_export_manifests
          WHERE id = ? AND owner_email = ? AND project_id = ?`).get(job.manifestId, owner, project.id);
        if (!manifestRow) throw coded('EXPORT_MANIFEST_NOT_FOUND', 'export manifest not found');
        const manifestRecord = exportManifestFromRow(manifestRow);
        const currentManifest = buildVideoExportManifest({
          workbench: api.listWorkbench({ ownerEmail: owner, projectId: project.id }),
          options: manifestRecord.manifest.options,
        });
        assertVideoExportJobCurrent(job, {
          manifestId: manifestRecord.id,
          manifest: currentManifest,
        });
        const next = transitionVideoExportJob(job, nextState, {
          now: timestamp(), errorCode, errorMessage, outputAssetId, outputUrl, workerId, leaseToken,
        });
        db.prepare(`UPDATE video_export_jobs SET state = ?, attempt = ?, renderer = ?,
          provider_submission = ?, billing_mutation = ?, output_asset_id = ?, output_url = ?,
          error_code = ?, error_message = ?, updated_at = ?, started_at = ?, completed_at = ?,
          canceled_at = ?, worker_id = ?, lease_token = ?, lease_expires_at = ?, job_hash = ?
          WHERE id = ? AND owner_email = ? AND project_id = ?`).run(
          next.state, next.attempt, next.renderer, Number(next.providerSubmission), Number(next.billingMutation),
          next.outputAssetId, next.outputUrl, next.errorCode, next.errorMessage, next.updatedAt,
          next.startedAt, next.completedAt, next.canceledAt, next.workerId, next.leaseToken,
          next.leaseExpiresAt, next.jobHash, next.id, owner, project.id,
        );
        if (next.state === 'rendering') {
          createRendererOutboxForJob(db, {
            owner, projectId: project.id, job: next, manifest: currentManifest, now: next.updatedAt,
          });
        } else if (['failed', 'completed', 'canceled'].includes(next.state)) {
          syncRendererOutboxForJob(db, {
            owner, projectId: project.id, job: next, nextState: next.state,
            errorCode: next.errorCode, errorMessage: next.errorMessage, now: next.updatedAt,
            workerId, leaseToken,
          });
        }
        return exportJobFromRow(db.prepare('SELECT * FROM video_export_jobs WHERE id = ?').get(job.id));
      })();
    },

    claimExportJob({ ownerEmail, projectId, jobId, workerId, leaseToken, leaseMs = 30_000 }) {
      const { owner, project } = requireProject(ownerEmail, projectId);
      return db.transaction(() => {
        const row = db.prepare(`SELECT * FROM video_export_jobs
          WHERE id = ? AND owner_email = ? AND project_id = ?`).get(jobId, owner, project.id);
        if (!row) throw coded('EXPORT_JOB_NOT_FOUND', 'export job not found');
        const job = exportJobFromRow(row);
        const manifestRow = db.prepare(`SELECT * FROM video_export_manifests
          WHERE id = ? AND owner_email = ? AND project_id = ?`).get(job.manifestId, owner, project.id);
        if (!manifestRow) throw coded('EXPORT_MANIFEST_NOT_FOUND', 'export manifest not found');
        const manifestRecord = exportManifestFromRow(manifestRow);
        const currentManifest = buildVideoExportManifest({
          workbench: api.listWorkbench({ ownerEmail: owner, projectId: project.id }),
          options: manifestRecord.manifest.options,
        });
        assertVideoExportJobCurrent(job, { manifestId: manifestRecord.id, manifest: currentManifest });
        const claimed = claimVideoExportJob(job, {
          workerId, leaseToken, leaseMs, now: timestamp(),
        });
        persistExportJob(db, claimed, owner, project.id);
        createRendererOutboxForJob(db, {
          owner, projectId: project.id, job: claimed, manifest: currentManifest, now: claimed.updatedAt,
        });
        claimRendererOutboxForJob(db, {
          owner, projectId: project.id, job: claimed, workerId: claimed.workerId,
          leaseToken: claimed.leaseToken, leaseMs, now: claimed.updatedAt,
        });
        return exportJobFromRow(db.prepare('SELECT * FROM video_export_jobs WHERE id = ?').get(job.id));
      })();
    },

    renewExportJobLease({ ownerEmail, projectId, jobId, workerId, leaseToken, leaseMs = 30_000 }) {
      const { owner, project } = requireProject(ownerEmail, projectId);
      return db.transaction(() => {
        const row = db.prepare(`SELECT * FROM video_export_jobs
          WHERE id = ? AND owner_email = ? AND project_id = ?`).get(jobId, owner, project.id);
        if (!row) throw coded('EXPORT_JOB_NOT_FOUND', 'export job not found');
        const job = exportJobFromRow(row);
        const manifestRow = db.prepare(`SELECT * FROM video_export_manifests
          WHERE id = ? AND owner_email = ? AND project_id = ?`).get(job.manifestId, owner, project.id);
        if (!manifestRow) throw coded('EXPORT_MANIFEST_NOT_FOUND', 'export manifest not found');
        const manifestRecord = exportManifestFromRow(manifestRow);
        const currentManifest = buildVideoExportManifest({
          workbench: api.listWorkbench({ ownerEmail: owner, projectId: project.id }),
          options: manifestRecord.manifest.options,
        });
        assertVideoExportJobCurrent(job, { manifestId: manifestRecord.id, manifest: currentManifest });
        const renewed = renewVideoExportJobLease(job, {
          workerId, leaseToken, leaseMs, now: timestamp(),
        });
        persistExportJob(db, renewed, owner, project.id);
        renewRendererOutboxForJob(db, {
          owner, projectId: project.id, job: renewed, workerId, leaseToken, leaseMs, now: renewed.updatedAt,
        });
        return exportJobFromRow(db.prepare('SELECT * FROM video_export_jobs WHERE id = ?').get(job.id));
      })();
    },

    recoverExportJob({ ownerEmail, projectId, jobId, now: recoveryTime } = {}) {
      const { owner, project } = requireProject(ownerEmail, projectId);
      return db.transaction(() => {
        const row = db.prepare(`SELECT * FROM video_export_jobs
          WHERE id = ? AND owner_email = ? AND project_id = ?`).get(jobId, owner, project.id);
        if (!row) throw coded('EXPORT_JOB_NOT_FOUND', 'export job not found');
        const job = exportJobFromRow(row);
        const manifestRow = db.prepare(`SELECT * FROM video_export_manifests
          WHERE id = ? AND owner_email = ? AND project_id = ?`).get(job.manifestId, owner, project.id);
        if (!manifestRow) throw coded('EXPORT_MANIFEST_NOT_FOUND', 'export manifest not found');
        const manifestRecord = exportManifestFromRow(manifestRow);
        const currentManifest = buildVideoExportManifest({
          workbench: api.listWorkbench({ ownerEmail: owner, projectId: project.id }),
          options: manifestRecord.manifest.options,
        });
        assertVideoExportJobCurrent(job, { manifestId: manifestRecord.id, manifest: currentManifest });
        const recovered = recoverExpiredVideoExportJob(job, { now: recoveryTime || timestamp() });
        if (recovered === job) return job;
        persistExportJob(db, recovered, owner, project.id);
        syncRendererOutboxForJob(db, {
          owner, projectId: project.id, job: recovered, nextState: 'failed',
          errorCode: recovered.errorCode, errorMessage: recovered.errorMessage, now: recovered.updatedAt,
        });
        return exportJobFromRow(db.prepare('SELECT * FROM video_export_jobs WHERE id = ?').get(job.id));
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

    listReplayManifests({ ownerEmail, projectId, limit = 20 }) {
      const { owner, project } = requireProject(ownerEmail, projectId);
      const requestedLimit = Number(limit);
      const boundedLimit = Number.isFinite(requestedLimit)
        ? Math.max(1, Math.min(50, Math.floor(requestedLimit)))
        : 20;
      return db.prepare(`SELECT * FROM video_replay_manifests
        WHERE owner_email = ? AND project_id = ?
        ORDER BY created_at DESC, id DESC LIMIT ?`).all(owner, project.id, boundedLimit)
        .map(replayManifestFromRow);
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
        const audioTracks = Array.isArray(manifest.audioTracks) ? manifest.audioTracks : [];
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
            (id, owner_email, project_id, position, purpose, duration_ms, camera_language, prompt, direction_json,
             status, selected_candidate_id, revision, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?)`).run(
            shotId, owner, clonedProject.id,
            Number.isSafeInteger(sourceShot.position) ? sourceShot.position : shots.indexOf(sourceShot),
            clean(sourceShot.purpose, 500), sourceShot.durationMs,
            clean(sourceShot.cameraLanguage, 2000), clean(sourceShot.prompt, 8000),
            JSON.stringify(normalizeShotDirection(sourceShot.direction, sourceShot.cameraLanguage)),
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
        for (const track of audioTracks) {
          const assetId = assetIds.get(clean(track?.assetId, 200));
          const assetVersionId = versionIds.get(clean(track?.assetVersionId, 200));
          if (!assetId || !assetVersionId) throw coded('REPLAY_MANIFEST_CLONE_INVALID', 'audio track target is missing');
          const kind = clean(track.kind, 20);
          if (!['voice', 'music'].includes(kind)) throw coded('REPLAY_MANIFEST_CLONE_INVALID', 'audio track kind is invalid');
          const startMs = Number.isSafeInteger(track.startMs) ? track.startMs : 0;
          const durationMs = Number.isSafeInteger(track.durationMs) ? track.durationMs : 0;
          if (startMs < 0 || durationMs < 500) throw coded('REPLAY_MANIFEST_CLONE_INVALID', 'audio track timing is invalid');
          const beatMarkers = Array.isArray(track.beatMarkers) ? track.beatMarkers : [];
          const subtitleCues = normalizeAudioSubtitleCues(
            track.subtitleCues,
            durationMs,
            'REPLAY_MANIFEST_CLONE_INVALID',
          );
          db.prepare(`INSERT INTO video_audio_tracks
            (id, owner_email, project_id, kind, asset_id, asset_version_id, start_ms, duration_ms,
             volume, muted, language, voice_anchor, beat_markers_json, subtitle_cues_json,
             revision, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
            randomUUID(), owner, clonedProject.id, kind, assetId, assetVersionId, startMs, durationMs,
            Number.isFinite(track.volume) ? track.volume : 1, track.muted ? 1 : 0,
            clean(track.language, 32), clean(track.voiceAnchor, 240), JSON.stringify(beatMarkers),
            JSON.stringify(subtitleCues), Number.isSafeInteger(track.revision) && track.revision > 0 ? track.revision : 1,
            createdAt, createdAt,
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

    previewSkillRunExecution({ ownerEmail, projectId, runId, stepCosts = {} }) {
      const { owner, project } = requireProject(ownerEmail, projectId);
      const current = requireSkillRun(owner, project.id, runId);
      const preview = buildSkillRunExecutionPreview(current.run.plan, {
        completedStepIds: current.run.executionPlan.completedStepIds,
        satisfiedGuardIds: current.run.confirmedGuardIds,
        stepCosts,
      });
      return {
        ...preview,
        runId: current.run.id,
        revision: current.row.revision,
        runStatus: current.row.status,
      };
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
        if (!['preview', 'confirmed'].includes(current.row.status)) {
          throw coded('INVALID_SKILL_RUN', 'skill run is not awaiting confirmation');
        }
        if (current.run.confirmedCheckpointIds.includes(normalizedCheckpointId)) return current.run;
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

    confirmSkillRunGuard({ ownerEmail, projectId, runId, guardId, expectedRevision }) {
      const { owner, project } = requireProject(ownerEmail, projectId);
      const normalizedGuardId = clean(guardId, 128);
      if (!normalizedGuardId) throw coded('INVALID_SKILL_RUN', 'guard id is required');
      if (!Number.isSafeInteger(Number(expectedRevision))) throw coded('VERSION_CONFLICT', 'skill run revision is required');
      return db.transaction(() => {
        const current = requireSkillRun(owner, project.id, runId);
        if (current.row.revision !== Number(expectedRevision)) {
          throw coded('VERSION_CONFLICT', 'skill run revision conflict', current.run);
        }
        const guards = Array.isArray(current.run.plan?.guards) ? current.run.plan.guards : [];
        if (!guards.some(guard => guard.id === normalizedGuardId)) {
          throw coded('INVALID_SKILL_RUN', 'guard is not declared by the skill');
        }
        if (current.run.confirmedGuardIds.includes(normalizedGuardId)) return current.run;
        const changedAt = timestamp();
        const nextRevision = current.row.revision + 1;
        db.prepare(`UPDATE video_skill_runs SET revision = ?, updated_at = ? WHERE id = ?`)
          .run(nextRevision, changedAt, runId);
        db.prepare(`INSERT INTO video_skill_run_events
          (id, run_id, owner_email, project_id, sequence, type, payload_json, actor_email, created_at)
          VALUES (?, ?, ?, ?, ?, 'guard.confirmed', ?, ?, ?)`).run(
          randomUUID(), runId, owner, project.id, nextRevision,
          JSON.stringify({ guardId: normalizedGuardId, revision: nextRevision }), owner, changedAt,
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
        if ((step.guards || []).some(guardId => !current.run.confirmedGuardIds.includes(guardId))) {
          throw coded('SKILL_RUN_GUARD_REQUIRED', 'skill step guards are not confirmed');
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
        WHERE owner_email = ? AND project_id = ? ORDER BY asset_id, sequence`).all(owner, project.id)
        .map(versionFromRow).map(hydrateVersion);
      const bindings = db.prepare(`SELECT * FROM video_shot_asset_bindings
        WHERE owner_email = ? AND project_id = ? ORDER BY created_at, asset_id`).all(owner, project.id).map(bindingFromRow);
      const candidates = db.prepare(`SELECT * FROM video_shot_candidates
        WHERE owner_email = ? AND project_id = ? ORDER BY created_at, id`).all(owner, project.id)
        .map(candidateFromRow).map(hydrateCandidate);
      const shots = db.prepare(`SELECT * FROM video_storyboard_shots
        WHERE owner_email = ? AND project_id = ? ORDER BY position, created_at`).all(owner, project.id).map(row => ({
        ...shotFromRow(row),
        bindings: bindings.filter(item => item.shotId === row.id),
        candidates: candidates.filter(item => item.shotId === row.id),
      }));
      const timelineClips = db.prepare(`SELECT * FROM video_timeline_clips
        WHERE owner_email = ? AND project_id = ? ORDER BY position, created_at`).all(owner, project.id).map(clipFromRow);
      const audioTracks = db.prepare(`SELECT * FROM video_audio_tracks
        WHERE owner_email = ? AND project_id = ? ORDER BY start_ms, created_at, id`).all(owner, project.id).map(audioTrackFromRow);
      const recoveryPlans = db.prepare(`SELECT * FROM video_shot_recovery_plans
        WHERE owner_email = ? AND project_id = ? ORDER BY created_at DESC, id DESC LIMIT 50`)
        .all(owner, project.id).map(shotRecoveryPlanFromRow);
      const skillRuns = db.prepare(`SELECT * FROM video_skill_runs
        WHERE owner_email = ? AND project_id = ? ORDER BY updated_at DESC, created_at DESC, id DESC LIMIT 8`)
        .all(owner, project.id)
        .map(row => {
          const events = db.prepare(`SELECT * FROM video_skill_run_events
            WHERE run_id = ? AND owner_email = ? AND project_id = ? ORDER BY sequence`)
            .all(row.id, owner, project.id);
          return skillRunFromRow(row, events);
        });
      return {
        project,
        assets: assets.map(asset => ({ ...asset, versions: versions.filter(version => version.assetId === asset.id) })),
        shots,
        timelineClips,
        audioTracks,
        recoveryPlans,
        skillRuns,
        memory: api.listProjectMemory({ ownerEmail: owner, projectId: project.id }),
      };
    },

    createShotRecoveryPlan({ ownerEmail, projectId, shotId, reason = '', mode = 'replace_candidate', extensionMs, region }) {
      const { owner, project } = requireProject(ownerEmail, projectId);
      const plan = buildShotRecoveryPlan(api.listWorkbench({ ownerEmail: owner, projectId: project.id }), {
        shotId, reason, mode, extensionMs, region,
      });
      assertShotRecoveryPlanIntegrity(plan);
      const existing = db.prepare(`SELECT * FROM video_shot_recovery_plans
        WHERE owner_email = ? AND project_id = ? AND shot_id = ? AND plan_hash = ?`)
        .get(owner, project.id, plan.shot.id, plan.planHash);
      if (existing) return { ...shotRecoveryPlanFromRow(existing), replayed: true };
      const id = randomUUID();
      const createdAt = timestamp();
      db.prepare(`INSERT INTO video_shot_recovery_plans
        (id, owner_email, project_id, shot_id, plan_hash, status, revision, plan_json, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(id, owner, project.id, plan.shot.id, plan.planHash, plan.status, 1, JSON.stringify(plan), createdAt, createdAt);
      return { ...shotRecoveryPlanFromRow(db.prepare('SELECT * FROM video_shot_recovery_plans WHERE id = ?').get(id)), replayed: false };
    },

    prepareShotRecoveryExecution({ ownerEmail, projectId, planId }) {
      const { owner, project } = requireProject(ownerEmail, projectId);
      const row = db.prepare(`SELECT * FROM video_shot_recovery_plans
        WHERE id = ? AND owner_email = ? AND project_id = ?`).get(planId, owner, project.id);
      if (!row) throw coded('SHOT_RECOVERY_NOT_FOUND', 'shot recovery plan not found');
      const plan = shotRecoveryPlanFromRow(row);
      assertShotRecoveryPlanIntegrity(plan);
      const execution = compileShotRecoveryExecution(plan, api.listWorkbench({ ownerEmail: owner, projectId: project.id }));
      return {
        execution: {
          ...execution,
          application: buildShotRecoveryApplication(execution),
        },
        replayed: false,
      };
    },

    /**
     * Validate a trusted renderer delivery against the current recovery plan.
     * This is intentionally read-only: registering a candidate, selecting it,
     * and changing timeline clips remain separate owner-scoped transactions.
     */
    validateShotRecoveryDelivery({ ownerEmail, projectId, planId, delivery }) {
      const { owner, project } = requireProject(ownerEmail, projectId);
      const row = db.prepare(`SELECT * FROM video_shot_recovery_plans
        WHERE id = ? AND owner_email = ? AND project_id = ?`).get(planId, owner, project.id);
      if (!row) throw coded('SHOT_RECOVERY_NOT_FOUND', 'shot recovery plan not found');
      const plan = shotRecoveryPlanFromRow(row);
      assertShotRecoveryPlanIntegrity(plan);
      const execution = compileShotRecoveryExecution(plan, api.listWorkbench({
        ownerEmail: owner, projectId: project.id,
      }));
      const application = buildShotRecoveryApplication(execution);
      const receipt = buildShotRecoveryDeliveryReceipt(application, delivery, {
        ownerEmail: owner, projectId: project.id,
      });
      return { executionHash: execution.executionHash, application, receipt, replayed: false };
    },

    /**
     * Compile a validated renderer result into a guarded candidate/timeline
     * commit draft. This remains read-only; the eventual transaction must
     * re-check the canonical asset and revisions before writing anything.
     */
    prepareShotRecoveryCommit({ ownerEmail, projectId, planId, delivery }) {
      const validated = api.validateShotRecoveryDelivery({ ownerEmail, projectId, planId, delivery });
      const commit = compileShotRecoveryCommit(validated.receipt, { projectId });
      return { ...validated, commit };
    },

    /**
     * Revalidate a compiled recovery commit immediately before persistence.
     * This is deliberately read-only. The eventual candidate/timeline
     * transaction must consume this result and repeat the same guards while
     * holding its write boundary.
     */
    preflightShotRecoveryCommit({ ownerEmail, projectId, planId, commit }) {
      const { owner, project } = requireProject(ownerEmail, projectId);
      const row = db.prepare(`SELECT * FROM video_shot_recovery_plans
        WHERE id = ? AND owner_email = ? AND project_id = ?`).get(planId, owner, project.id);
      if (!row) throw coded('SHOT_RECOVERY_NOT_FOUND', 'shot recovery plan not found');
      const plan = shotRecoveryPlanFromRow(row);
      assertShotRecoveryPlanIntegrity(plan);
      if (!commit || commit.planId !== row.id
        || (commit.planHash && commit.planHash !== plan.planHash)) {
        throw coded('SHOT_RECOVERY_STALE', '镜头提交草稿与当前恢复计划不匹配，请重新建立提交草稿');
      }
      const workbench = api.listWorkbench({ ownerEmail: owner, projectId: project.id });
      const preflight = compileShotRecoveryCommitPreflight(commit, workbench, { projectId: project.id });
      const shot = workbench.shots.find(item => item?.id === commit.candidate.shotId);
      const sourceCandidate = shot?.candidates?.find(item => item?.id === commit.candidate.expectedCandidateId);
      if (!sourceCandidate?.projectAssetRef?.projectAssetId) {
        throw coded('PROJECT_ASSET_REF_INVALID', '镜头源候选缺少已核验的项目素材引用');
      }
      const source = requireCanonicalProjectAsset({
        ownerEmail: owner,
        projectId: project.id,
        projectAssetId: sourceCandidate.projectAssetRef.projectAssetId,
        expectedContentHash: sourceCandidate.contentHash || sourceCandidate.projectAssetRef.contentHash,
        role: sourceCandidate.projectAssetRef.role || 'reference',
        purpose: 'reuse',
      });
      const target = requireCanonicalProjectAsset({
        ownerEmail: owner,
        projectId: project.id,
        projectAssetId: commit.candidate.projectAssetRef.projectAssetId,
        expectedContentHash: commit.candidate.contentHash,
        role: commit.candidate.projectAssetRef.role || 'generated-video',
        purpose: 'reuse',
      });
      return {
        ...preflight,
        sourceProjectAssetRef: source.ref,
        targetProjectAssetRef: target.ref,
      };
    },

    /**
     * Apply a validated shot-recovery commit inside the video workbench's
     * own transaction boundary. This does not call a provider, create a
     * canonical asset, or mutate billing. A delivery is idempotent by the
     * output asset id plus commit hash; an already-applied commit is replayed
     * without inserting a second candidate or timeline clip.
     */
    applyShotRecoveryCommit({ ownerEmail, projectId, planId, commit }) {
      const { owner, project } = requireProject(ownerEmail, projectId);
      const planRow = db.prepare(`SELECT * FROM video_shot_recovery_plans
        WHERE id = ? AND owner_email = ? AND project_id = ?`).get(planId, owner, project.id);
      if (!planRow) throw coded('SHOT_RECOVERY_NOT_FOUND', 'shot recovery plan not found');
      const plan = shotRecoveryPlanFromRow(planRow);
      assertShotRecoveryPlanIntegrity(plan);
      if (!commit || commit.planId !== planRow.id
        || (commit.planHash && commit.planHash !== plan.planHash)) {
        throw coded('SHOT_RECOVERY_STALE', '镜头提交草稿与当前恢复计划不匹配，请重新建立提交草稿');
      }

      const candidateDraft = commit.candidate;
      const targetProjectAssetId = candidateDraft?.projectAssetRef?.projectAssetId;
      const targetAsset = requireCanonicalProjectAsset({
        ownerEmail: owner,
        projectId: project.id,
        projectAssetId: targetProjectAssetId,
        expectedContentHash: candidateDraft?.contentHash,
        role: candidateDraft?.projectAssetRef?.role || 'generated-video',
        purpose: 'reuse',
      });

      const snapshot = api.listWorkbench({ ownerEmail: owner, projectId: project.id });
      const snapshotShot = snapshot.shots.find(item => item?.id === candidateDraft?.shotId);
      const snapshotSourceCandidate = snapshotShot?.candidates?.find(
        item => item?.id === candidateDraft?.expectedCandidateId,
      );
      if (!snapshotSourceCandidate?.projectAssetRef?.projectAssetId) {
        throw coded('PROJECT_ASSET_REF_INVALID', '镜头源候选缺少已核验的项目素材引用');
      }
      const sourceAsset = requireCanonicalProjectAsset({
        ownerEmail: owner,
        projectId: project.id,
        projectAssetId: snapshotSourceCandidate.projectAssetRef.projectAssetId,
        expectedContentHash: snapshotSourceCandidate.contentHash
          || snapshotSourceCandidate.projectAssetRef.expectedContentHash,
        role: snapshotSourceCandidate.projectAssetRef.role || 'reference',
        purpose: 'reuse',
      });

      const targetOutputAssetId = clean(candidateDraft?.outputAssetId, 256);
      if (!targetOutputAssetId) throw coded('SHOT_RECOVERY_DELIVERY_INVALID', '镜头提交草稿缺少输出资产幂等键');

      const existingTarget = db.prepare(`SELECT * FROM video_shot_candidates
        WHERE owner_email = ? AND project_id = ? AND shot_id = ? AND output_asset_id = ?`)
        .get(owner, project.id, candidateDraft.shotId, targetOutputAssetId);
      if (existingTarget) {
        const existing = candidateFromRow(existingTarget);
        const existingRef = existing.projectAssetRef;
        const sameDelivery = existing.provenance?.recoveryCommitHash === String(commit.commitHash).toLowerCase()
          && existing.stableUrl === candidateDraft.stableUrl
          && existing.contentHash === candidateDraft.contentHash
          && existing.mimeType === candidateDraft.mimeType
          && existingRef?.projectAssetId === targetProjectAssetId;
        if (!sameDelivery) {
          throw coded('SHOT_RECOVERY_COMMIT_CONFLICT', '相同输出资产已绑定到另一份镜头提交');
        }
        const replayShot = requireShot(owner, project.id, candidateDraft.shotId);
        const replayedClips = commit.timelineActions.map(action => requireClip(owner, project.id, action.clipId));
        const fullyApplied = replayShot.selectedCandidateId === existing.id
          && replayShot.revision === candidateDraft.expectedShotRevision + 1
          && replayedClips.every((clip, index) => clip.status === 'active'
            && clip.candidateId === existing.id
            && clip.revision === commit.timelineActions[index].expectedRevision + 1);
        if (!fullyApplied) throw coded('SHOT_RECOVERY_STALE', '镜头提交草稿已部分变化，请重新建立提交草稿');
        return {
          status: 'replayed',
          replayed: true,
          commitHash: commit.commitHash,
          sourceProjectAssetRef: sourceAsset.ref,
          targetProjectAssetRef: targetAsset.ref,
          candidate: hydrateCandidate(existing),
          shot: replayShot,
          timelineClips: replayedClips,
          providerSubmission: false,
          billingMutation: false,
        };
      }

      const preflight = api.preflightShotRecoveryCommit({
        ownerEmail: owner, projectId: project.id, planId: planRow.id, commit,
      });
      return db.transaction(() => {
        const shot = requireShot(owner, project.id, candidateDraft.shotId);
        if (shot.revision !== candidateDraft.expectedShotRevision
          || (shot.selectedCandidateId || null) !== (candidateDraft.expectedSelectedCandidateId || null)) {
          throw coded('SHOT_RECOVERY_STALE', '镜头修订或选定候选已变化，请重新建立提交草稿');
        }
        const sourceCandidate = requireCandidate(owner, project.id, shot.id, candidateDraft.expectedCandidateId);
        if (sourceCandidate.projectAssetRef?.projectAssetId !== snapshotSourceCandidate.projectAssetRef.projectAssetId) {
          throw coded('SHOT_RECOVERY_STALE', '镜头源候选已变化，请重新建立提交草稿');
        }
        requireCanonicalProjectAsset({
          ownerEmail: owner,
          projectId: project.id,
          projectAssetId: sourceCandidate.projectAssetRef.projectAssetId,
          expectedContentHash: sourceCandidate.contentHash || sourceCandidate.projectAssetRef.expectedContentHash,
          role: sourceCandidate.projectAssetRef.role || 'reference',
          purpose: 'reuse',
        });
        requireCanonicalProjectAsset({
          ownerEmail: owner,
          projectId: project.id,
          projectAssetId: targetProjectAssetId,
          expectedContentHash: candidateDraft.contentHash,
          role: candidateDraft.projectAssetRef.role || 'generated-video',
          purpose: 'reuse',
        });

        const currentTarget = db.prepare(`SELECT * FROM video_shot_candidates
          WHERE owner_email = ? AND project_id = ? AND shot_id = ? AND output_asset_id = ?`)
          .get(owner, project.id, shot.id, targetOutputAssetId);
        if (currentTarget) throw coded('SHOT_RECOVERY_STALE', '镜头提交目标已被其他请求写入');
        const provenance = normalizeVideoProvenance({
          ...(commit.provider && typeof commit.provider === 'object' ? commit.provider : {}),
          source: 'recovery-commit',
          recoveryCommitHash: commit.commitHash,
          projectAssetRef: {
            ...candidateDraft.projectAssetRef,
            role: candidateDraft.projectAssetRef.role || 'generated-video',
            expectedContentHash: candidateDraft.contentHash,
          },
        }, 'planned');
        const targetCandidateId = randomUUID();
        db.prepare(`INSERT INTO video_shot_candidates
          (id, owner_email, project_id, shot_id, output_asset_id, stable_url, content_hash,
           mime_type, status, provenance_status, provenance_json, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'available', ?, ?, ?)`)
          .run(targetCandidateId, owner, project.id, shot.id, targetOutputAssetId,
            clean(candidateDraft.stableUrl, 2000), clean(candidateDraft.contentHash, 256),
            clean(candidateDraft.mimeType, 160).toLowerCase(), provenance.status,
            JSON.stringify(provenance), timestamp());
        const targetCandidate = requireCandidate(owner, project.id, shot.id, targetCandidateId);

        let targetDurationMs = shot.durationMs;
        for (const action of commit.timelineActions) {
          const clip = requireClip(owner, project.id, action.clipId);
          if (clip.shotId !== shot.id || clip.status !== 'active'
            || clip.revision !== action.expectedRevision
            || clip.candidateId !== action.expectedCandidateId) {
            throw coded('SHOT_RECOVERY_STALE', '时间线片段已变化，请重新建立提交草稿');
          }
          if (Number.isSafeInteger(action.targetDurationMs)) targetDurationMs = Math.max(targetDurationMs, action.targetDurationMs);
        }
        if (targetDurationMs !== shot.durationMs) validateDuration(targetDurationMs);
        const changedAt = timestamp();
        db.prepare(`UPDATE video_shot_candidates SET status = 'available'
          WHERE owner_email = ? AND project_id = ? AND shot_id = ? AND status = 'selected'`)
          .run(owner, project.id, shot.id);
        db.prepare(`UPDATE video_shot_candidates SET status = 'selected' WHERE id = ?`).run(targetCandidate.id);
        const timelineClips = [];
        for (const action of commit.timelineActions) {
          const nextEnd = Number.isSafeInteger(action.targetDurationMs)
            ? action.targetDurationMs : null;
          const clip = requireClip(owner, project.id, action.clipId);
          db.prepare(`UPDATE video_timeline_clips SET candidate_id = ?, status = 'active',
            trim_end_ms = CASE WHEN ? IS NULL THEN trim_end_ms ELSE ? END,
            revision = revision + 1, updated_at = ?
            WHERE id = ? AND owner_email = ? AND project_id = ? AND revision = ? AND status = 'active'`)
            .run(targetCandidate.id, nextEnd, nextEnd, changedAt, clip.id, owner, project.id, action.expectedRevision);
          if (db.prepare('SELECT changes() AS count').get().count !== 1) {
            throw coded('SHOT_RECOVERY_STALE', '时间线片段已变化，请重新建立提交草稿');
          }
          timelineClips.push(requireClip(owner, project.id, clip.id));
        }
        const hasOutdatedBinding = Boolean(db.prepare(`SELECT 1 FROM video_shot_asset_bindings b
          JOIN video_workbench_assets a ON a.id = b.asset_id
          WHERE b.owner_email = ? AND b.project_id = ? AND b.shot_id = ?
            AND (a.approved_version_id IS NULL OR a.approved_version_id <> b.asset_version_id) LIMIT 1`)
          .get(owner, project.id, shot.id));
        const nextStatus = shot.status === 'stale' || hasOutdatedBinding ? 'stale' : 'approved';
        db.prepare(`UPDATE video_storyboard_shots SET selected_candidate_id = ?, status = ?,
          duration_ms = ?, revision = revision + 1, updated_at = ? WHERE id = ? AND revision = ?`)
          .run(targetCandidate.id, nextStatus, targetDurationMs, changedAt, shot.id, candidateDraft.expectedShotRevision);
        if (db.prepare('SELECT changes() AS count').get().count !== 1) {
          throw coded('SHOT_RECOVERY_STALE', '镜头已变化，请重新建立提交草稿');
        }
        return {
          status: 'applied',
          replayed: false,
          commitHash: commit.commitHash,
          preflightHash: preflight.preflightHash,
          sourceProjectAssetRef: sourceAsset.ref,
          targetProjectAssetRef: targetAsset.ref,
          candidate: hydrateCandidate(requireCandidate(owner, project.id, shot.id, targetCandidate.id)),
          shot: requireShot(owner, project.id, shot.id),
          timelineClips,
          providerSubmission: false,
          billingMutation: false,
        };
      })();
    },

    getGenerationPlanApproval({ ownerEmail, projectId }) {
      const { owner, project } = requireProject(ownerEmail, projectId);
      return generationPlanApprovalFromRow(db.prepare(`SELECT * FROM video_generation_plan_approvals
        WHERE owner_email = ? AND project_id = ?`).get(owner, project.id));
    },

    approveGenerationPlan({ ownerEmail, projectId, plan, planHash }) {
      const { owner, project } = requireProject(ownerEmail, projectId);
      if (!plan || plan.status !== 'ready') throw coded('VIDEO_PLAN_NOT_READY', '只有可生成的计划才能确认');
      const normalizedHash = clean(planHash, 128);
      if (!/^[a-f0-9]{64}$/i.test(normalizedHash) || videoWorkbenchPlanFingerprint(plan) !== normalizedHash) {
        throw coded('VIDEO_PLAN_HASH_INVALID', '生成计划已变化，请重新检查计划');
      }
      const approvedAt = timestamp();
      const id = randomUUID();
      db.prepare(`INSERT INTO video_generation_plan_approvals
        (id, owner_email, project_id, plan_hash, plan_json, approved_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(owner_email, project_id) DO UPDATE SET
          id = excluded.id, plan_hash = excluded.plan_hash, plan_json = excluded.plan_json,
          approved_at = excluded.approved_at`).run(
        id, owner, project.id, normalizedHash, JSON.stringify(plan), approvedAt,
      );
      return generationPlanApprovalFromRow(db.prepare(`SELECT * FROM video_generation_plan_approvals
        WHERE owner_email = ? AND project_id = ?`).get(owner, project.id));
    },

    saveGenerationDraft({ ownerEmail, projectId, draft }) {
      const { owner, project } = requireProject(ownerEmail, projectId);
      const normalizedHash = clean(draft?.planHash, 128).toLowerCase();
      if (!draft || draft.projectId !== project.id || !/^[a-f0-9]{64}$/.test(normalizedHash)) {
        throw coded('VIDEO_PLAN_HASH_INVALID', '生成草稿与当前项目不匹配');
      }
      const existing = generationDraftFromRow(db.prepare(`SELECT * FROM video_generation_drafts
        WHERE owner_email = ? AND project_id = ? AND plan_hash = ?`).get(owner, project.id, normalizedHash));
      if (existing) return { ...existing, replayed: true };
      const id = randomUUID();
      const createdAt = timestamp();
      const persistedDraft = { ...draft, planHash: normalizedHash };
      db.prepare(`INSERT INTO video_generation_drafts
        (id, owner_email, project_id, plan_hash, draft_json, created_at)
        VALUES (?, ?, ?, ?, ?, ?)`).run(
        id, owner, project.id, normalizedHash, JSON.stringify(persistedDraft), createdAt,
      );
      return { ...generationDraftFromRow(db.prepare(`SELECT * FROM video_generation_drafts WHERE id = ?`).get(id)), replayed: false };
    },

    getGenerationDraft({ ownerEmail, projectId, planHash }) {
      const { owner, project } = requireProject(ownerEmail, projectId);
      const normalizedHash = clean(planHash, 128).toLowerCase();
      if (!/^[a-f0-9]{64}$/.test(normalizedHash)) return null;
      return generationDraftFromRow(db.prepare(`SELECT * FROM video_generation_drafts
        WHERE owner_email = ? AND project_id = ? AND plan_hash = ?`).get(owner, project.id, normalizedHash));
    },

    listSkillTemplates({ ownerEmail, projectId }) {
      requireProject(ownerEmail, projectId);
      return listVideoSkillTemplates();
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
