import crypto from 'node:crypto';

export const REPLAY_MANIFEST_SCHEMA_VERSION = 1;

function invalid(message) {
  return Object.assign(new Error(message), { code: 'REPLAY_MANIFEST_INVALID' });
}

function text(value, field, max = 500) {
  const normalized = String(value ?? '').trim();
  if (!normalized || normalized.length > max) throw invalid(`${field} is required`);
  return normalized;
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((result, key) => {
    result[key] = stable(value[key]);
    return result;
  }, {});
}

function safeValue(value, depth = 0) {
  if (depth > 6) throw invalid('manifest metadata is too deeply nested');
  if (value == null || typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.slice(0, 10_000);
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (Array.isArray(value)) {
    if (value.length > 200) throw invalid('manifest metadata array is too large');
    return value.map(item => safeValue(item, depth + 1));
  }
  if (typeof value !== 'object') return null;
  const entries = Object.entries(value);
  if (entries.length > 200) throw invalid('manifest metadata object is too large');
  return entries.reduce((result, [key, item]) => {
    result[String(key).slice(0, 200)] = safeValue(item, depth + 1);
    return result;
  }, {});
}

function skillRunSnapshot(run, skillId, skillVersion) {
  if (run == null) return null;
  if (!run || typeof run !== 'object' || Array.isArray(run)) throw invalid('skillRun is invalid');
  if (String(run.skillId || '') !== String(skillId) || Number(run.skillVersion) !== Number(skillVersion)) {
    throw invalid('skillRun does not match the manifest skill');
  }
  const plan = run.plan;
  if (!plan || typeof plan !== 'object' || Array.isArray(plan)) throw invalid('skillRun plan is invalid');
  const execution = run.executionPlan && typeof run.executionPlan === 'object' && !Array.isArray(run.executionPlan)
    ? run.executionPlan : {};
  const snapshot = {
    skillId: String(skillId),
    skillVersion,
    input: safeValue(run.input || {}),
    plan: {
      steps: safeValue(Array.isArray(plan.steps) ? plan.steps : []),
      checkpoints: safeValue(Array.isArray(plan.checkpoints) ? plan.checkpoints : []),
      modelPolicy: safeValue(plan.modelPolicy || {}),
      outputContract: safeValue(plan.outputContract || {}),
    },
    execution: {
      completedStepIds: safeValue(Array.isArray(execution.completedStepIds) ? execution.completedStepIds : []),
      status: String(execution.status || 'ready'),
    },
  };
  if (Buffer.byteLength(JSON.stringify(snapshot), 'utf8') > 32_000) throw invalid('skillRun snapshot is too large');
  return stable(snapshot);
}

export function canonicalReplayManifest(value) {
  return JSON.stringify(stable(value));
}

function version(version) {
  return {
    id: text(version.id, 'asset version id', 200),
    sequence: Number.isSafeInteger(version.sequence) ? version.sequence : 0,
    sourceProjectAssetId: String(version.sourceProjectAssetId || ''),
    stableUrl: text(version.stableUrl, 'asset version stableUrl', 2000),
    contentHash: text(version.contentHash, 'asset version contentHash', 200),
    mimeType: text(version.mimeType, 'asset version mimeType', 120),
    metadata: stable(safeValue(version.metadata || {})),
  };
}

function binding(value) {
  return {
    assetId: text(value.assetId, 'binding assetId', 200),
    assetVersionId: text(value.assetVersionId, 'binding assetVersionId', 200),
    role: text(value.role, 'binding role', 80),
  };
}

function candidate(value) {
  return {
    id: text(value.id, 'candidate id', 200),
    generationJobId: value.generationJobId || null,
    outputAssetId: text(value.outputAssetId, 'candidate outputAssetId', 200),
    stableUrl: text(value.stableUrl, 'candidate stableUrl', 2000),
    contentHash: text(value.contentHash, 'candidate contentHash', 200),
    mimeType: text(value.mimeType, 'candidate mimeType', 120),
    status: String(value.status || 'available'),
  };
}

function asset(asset, rights) {
  const id = text(asset.id, 'asset id', 200);
  if (!rights.has(id)) throw invalid(`rights confirmation missing for asset ${id}`);
  const versions = Array.isArray(asset.versions) ? asset.versions.map(version) : [];
  if (!versions.length) throw invalid(`asset ${id} has no versions`);
  if (asset.approvedVersionId && !versions.some(item => item.id === asset.approvedVersionId)) {
    throw invalid(`asset ${id} approved version is missing`);
  }
  return {
    id,
    kind: text(asset.kind, 'asset kind', 80),
    name: text(asset.name, 'asset name', 200),
    status: String(asset.status || 'draft'),
    approvedVersionId: asset.approvedVersionId || null,
    versions,
  };
}

function shot(shotValue) {
  const id = text(shotValue.id, 'shot id', 200);
  if (!Number.isSafeInteger(shotValue.durationMs) || shotValue.durationMs <= 0) {
    throw invalid(`shot ${id} duration is invalid`);
  }
  return {
    id,
    position: Number.isSafeInteger(shotValue.position) ? shotValue.position : 0,
    purpose: text(shotValue.purpose, 'shot purpose', 1000),
    durationMs: shotValue.durationMs,
    cameraLanguage: String(shotValue.cameraLanguage || ''),
    prompt: String(shotValue.prompt || ''),
    status: String(shotValue.status || 'draft'),
    selectedCandidateId: shotValue.selectedCandidateId || null,
    bindings: (Array.isArray(shotValue.bindings) ? shotValue.bindings : []).map(binding),
    candidates: (Array.isArray(shotValue.candidates) ? shotValue.candidates : []).map(candidate),
  };
}

function clip(clipValue) {
  return {
    id: text(clipValue.id, 'timeline clip id', 200),
    shotId: text(clipValue.shotId, 'timeline clip shotId', 200),
    candidateId: text(clipValue.candidateId, 'timeline clip candidateId', 200),
    position: Number.isSafeInteger(clipValue.position) ? clipValue.position : 0,
    trimStartMs: Number.isSafeInteger(clipValue.trimStartMs) ? clipValue.trimStartMs : 0,
    trimEndMs: Number.isSafeInteger(clipValue.trimEndMs) ? clipValue.trimEndMs : 0,
    muted: Boolean(clipValue.muted),
    status: String(clipValue.status || 'active'),
  };
}

export function buildReplayManifest({
  workbench,
  skillId,
  skillVersion,
  skillRun = null,
  modelCatalogSnapshot = {},
  rightsConfirmations = [],
} = {}) {
  if (!workbench?.project?.id || workbench.project.kind !== 'video') throw invalid('video project is required');
  if (!Number.isSafeInteger(skillVersion) || skillVersion < 1) throw invalid('skillVersion is invalid');
  const rights = new Map();
  for (const item of (Array.isArray(rightsConfirmations) ? rightsConfirmations : [])) {
    const assetId = typeof item === 'string' ? item : item?.assetId;
    if (!assetId) continue;
    const confirmation = typeof item === 'string' ? 'owned_or_licensed' : (item.confirmation || 'owned_or_licensed');
    const confirmedAt = typeof item === 'object' && item.confirmedAt ? String(item.confirmedAt) : null;
    rights.set(String(assetId), { assetId: String(assetId), confirmation: String(confirmation), confirmedAt });
  }
  if (!Array.isArray(workbench.assets) || !Array.isArray(workbench.shots)
    || !Array.isArray(workbench.timelineClips)) throw invalid('workbench graph is incomplete');
  const manifest = {
    schemaVersion: REPLAY_MANIFEST_SCHEMA_VERSION,
    project: { id: text(workbench.project.id, 'project id', 200), kind: 'video' },
    skill: { id: text(skillId, 'skillId', 200), version: skillVersion },
    ...(skillRun == null ? {} : { skillRun: skillRunSnapshot(skillRun, skillId, skillVersion) }),
    modelCatalogSnapshot: stable(safeValue(modelCatalogSnapshot || {})),
    rightsConfirmations: [...rights.values()].sort((left, right) => left.assetId.localeCompare(right.assetId)),
    assets: workbench.assets.map(item => asset(item, new Set(rights.keys()))),
    shots: workbench.shots.map(shot),
    timelineClips: workbench.timelineClips.map(clip),
  };
  const canonical = canonicalReplayManifest(manifest);
  return Object.freeze({
    ...manifest,
    manifestHash: crypto.createHash('sha256').update(canonical).digest('hex'),
  });
}
