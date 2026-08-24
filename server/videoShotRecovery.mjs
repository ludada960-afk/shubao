import crypto from 'node:crypto';

const MAX_REASON_LENGTH = 500;
const RECOVERY_MODES = new Set([
  'replace_candidate',
  'rebuild_shot',
  'reshoot_shot',
  'reshoot_range',
  'extend_shot',
  'track_replace',
]);

function clean(value, max = MAX_REASON_LENGTH) {
  return String(value ?? '').trim().slice(0, max);
}

function stableValue(value) {
  if (Array.isArray(value)) return `[${value.map(stableValue).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableValue(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function hashPlan(payload) {
  return crypto.createHash('sha256').update(stableValue(payload)).digest('hex');
}

function sortedShots(workbench) {
  return (Array.isArray(workbench?.shots) ? workbench.shots : [])
    .filter(Boolean)
    .slice()
    .sort((left, right) => (Number(left.position) - Number(right.position)) || String(left.id).localeCompare(String(right.id)));
}

function assertShot(shotId, shots) {
  const normalized = clean(shotId, 200);
  const shot = shots.find(candidate => candidate.id === normalized);
  if (!shot) throw Object.assign(new Error('shot not found'), { code: 'SHOT_NOT_FOUND' });
  return shot;
}

function boundedInteger(value, { min, max, fallback = null } = {}) {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw Object.assign(new Error('shot recovery value is out of bounds'), { code: 'SHOT_RECOVERY_INVALID' });
  }
  return parsed;
}

function normalizeRegion(region) {
  if (!region || typeof region !== 'object') {
    throw Object.assign(new Error('tracked replacement region is required'), { code: 'SHOT_RECOVERY_INVALID' });
  }
  const values = ['x', 'y', 'width', 'height'].map(key => Number(region[key]));
  if (values.some(value => !Number.isFinite(value))) {
    throw Object.assign(new Error('tracked replacement region is invalid'), { code: 'SHOT_RECOVERY_INVALID' });
  }
  const [x, y, width, height] = values;
  if (x < 0 || y < 0 || width <= 0 || height <= 0 || x + width > 1 || y + height > 1) {
    throw Object.assign(new Error('tracked replacement region is outside the frame'), { code: 'SHOT_RECOVERY_INVALID' });
  }
  return { x, y, width, height };
}

function buildEditIntent(shot, mode, { extensionMs, region, rangeStartMs, rangeEndMs } = {}) {
  const sourceDurationMs = Number.isInteger(shot.durationMs) && shot.durationMs > 0 ? shot.durationMs : null;
  if (mode === 'reshoot_shot') {
    return {
      operation: 'reshoot', strategy: 'preserve_bindings', sourceDurationMs,
      extensionMs: 0, targetDurationMs: sourceDurationMs, region: null,
    };
  }
  if (mode === 'reshoot_range') {
    if (sourceDurationMs === null) {
      throw Object.assign(new Error('shot duration is required for a range reshoot'), { code: 'SHOT_RECOVERY_INVALID' });
    }
    if (!Number.isSafeInteger(rangeStartMs) || !Number.isSafeInteger(rangeEndMs)
      || rangeStartMs < 0 || rangeStartMs >= sourceDurationMs
      || rangeEndMs <= rangeStartMs || rangeEndMs > sourceDurationMs
      || rangeEndMs - rangeStartMs < 500) {
      throw Object.assign(new Error('reshoot range is invalid'), { code: 'SHOT_RECOVERY_INVALID' });
    }
    return {
      operation: 'reshoot', strategy: 'preserve_untouched_ranges', sourceDurationMs,
      extensionMs: 0, targetDurationMs: sourceDurationMs, region: null,
      range: { startMs: rangeStartMs, endMs: rangeEndMs },
      fallbackToWholeShot: rangeStartMs === 0 && rangeEndMs === sourceDurationMs,
    };
  }
  if (mode === 'extend_shot') {
    if (sourceDurationMs === null) {
      throw Object.assign(new Error('shot duration is required for extension'), { code: 'SHOT_RECOVERY_INVALID' });
    }
    const normalizedExtensionMs = boundedInteger(extensionMs, { min: 500, max: 30_000 });
    if (sourceDurationMs + normalizedExtensionMs > 120_000) {
      throw Object.assign(new Error('extended shot exceeds the maximum duration'), { code: 'SHOT_RECOVERY_INVALID' });
    }
    return {
      operation: 'extend', strategy: 'append_tail', sourceDurationMs,
      extensionMs: normalizedExtensionMs, targetDurationMs: sourceDurationMs + normalizedExtensionMs, region: null,
    };
  }
  if (mode === 'track_replace') {
    return {
      operation: 'track_replace', strategy: 'tracked_object_replace', sourceDurationMs,
      extensionMs: 0, targetDurationMs: sourceDurationMs, region: normalizeRegion(region),
    };
  }
  return {
    operation: 'replace_candidate', strategy: 'preserve_timeline', sourceDurationMs,
    extensionMs: 0, targetDurationMs: sourceDurationMs, region: null,
  };
}

export function buildShotRecoveryPlan(workbench, {
  shotId,
  reason = '',
  mode = 'replace_candidate',
  extensionMs,
  region,
  rangeStartMs,
  rangeEndMs,
} = {}) {
  const shots = sortedShots(workbench);
  const shot = assertShot(shotId, shots);
  const normalizedMode = RECOVERY_MODES.has(mode) ? mode : '';
  if (!normalizedMode) throw Object.assign(new Error('unsupported shot recovery mode'), { code: 'SHOT_RECOVERY_INVALID' });

  const timelineClips = Array.isArray(workbench?.timelineClips) ? workbench.timelineClips : [];
  const affectedClips = timelineClips
    .filter(clip => clip?.shotId === shot.id)
    .sort((left, right) => (Number(left.position) - Number(right.position)) || String(left.id).localeCompare(String(right.id)));
  const preservedShots = shots.filter(candidate => candidate.id !== shot.id).map(candidate => candidate.id);
  const preservedCandidates = shots
    .filter(candidate => candidate.id !== shot.id && candidate.selectedCandidateId)
    .map(candidate => candidate.selectedCandidateId);
  const preservedTimelineClips = timelineClips
    .filter(clip => clip?.shotId !== shot.id && clip?.status === 'active')
    .sort((left, right) => (Number(left.position) - Number(right.position)) || String(left.id).localeCompare(String(right.id)))
    .map(clip => clip.id);
  const edit = buildEditIntent(shot, normalizedMode, { extensionMs, region, rangeStartMs, rangeEndMs });

  const payload = {
    schemaVersion: 1,
    status: 'planned',
    mode: normalizedMode,
    shot: {
      id: shot.id,
      position: Number.isSafeInteger(shot.position) ? shot.position : null,
      selectedCandidateId: shot.selectedCandidateId || null,
      revision: Number.isSafeInteger(shot.revision) ? shot.revision : null,
    },
    replace: {
      shotId: shot.id,
      candidateId: shot.selectedCandidateId || null,
      timelineClipIds: affectedClips.map(clip => clip.id),
    },
    edit,
    preserve: {
      shotIds: preservedShots,
      candidateIds: preservedCandidates,
      timelineClipIds: preservedTimelineClips,
    },
    reason: clean(reason),
    providerSubmission: false,
    billingMutation: false,
  };
  return { ...payload, planHash: hashPlan(payload) };
}

export function assertShotRecoveryPlanIntegrity(plan) {
  if (!plan || plan.schemaVersion !== 1 || plan.status !== 'planned') {
    throw Object.assign(new Error('shot recovery plan is invalid'), { code: 'SHOT_RECOVERY_INVALID' });
  }
  const { planHash, id, ownerEmail, projectId, shotId, revision, createdAt, updatedAt, ...payload } = plan;
  if (!/^[a-f0-9]{64}$/i.test(String(planHash || '')) || hashPlan(payload) !== String(planHash).toLowerCase()) {
    throw Object.assign(new Error('shot recovery plan hash mismatch'), { code: 'SHOT_RECOVERY_INVALID' });
  }
  if (plan.providerSubmission !== false || plan.billingMutation !== false) {
    throw Object.assign(new Error('shot recovery plan cannot submit or bill'), { code: 'SHOT_RECOVERY_INVALID' });
  }
  return plan;
}

function recoveryError(code, message) {
  return Object.assign(new Error(message), { code });
}

/**
 * Re-check a persisted recovery intent against the current planning graph.
 * This is deliberately a pure, provider-neutral operation: it never submits,
 * bills, or mutates project assets. A future renderer may consume its hash.
 */
export function compileShotRecoveryExecution(plan, workbench) {
  assertShotRecoveryPlanIntegrity(plan);
  const shot = (Array.isArray(workbench?.shots) ? workbench.shots : [])
    .find(candidate => candidate?.id === plan.shot.id);
  if (!shot || shot.revision !== plan.shot.revision
    || (shot.selectedCandidateId || null) !== (plan.shot.selectedCandidateId || null)) {
    throw recoveryError('SHOT_RECOVERY_STALE', '镜头修订或选定候选已变化，请重新建立恢复计划');
  }

  const candidates = Array.isArray(shot.candidates) ? shot.candidates : [];
  const candidateId = plan.replace?.candidateId || null;
  const sourceCandidate = candidateId ? candidates.find(candidate => candidate?.id === candidateId) : null;
  if (candidateId && (!sourceCandidate || sourceCandidate.projectAssetRefStatus !== 'verified'
    || !sourceCandidate.projectAssetRef?.projectAssetId)) {
    throw recoveryError('PROJECT_ASSET_REF_INVALID', '镜头候选缺少已核验的项目素材引用');
  }

  const timeline = Array.isArray(workbench?.timelineClips) ? workbench.timelineClips : [];
  const clipIds = Array.isArray(plan.replace?.timelineClipIds) ? plan.replace.timelineClipIds : [];
  const sourceTimelineClips = clipIds.map(id => timeline.find(clip => clip?.id === id));
  if (sourceTimelineClips.some(clip => !clip || clip.shotId !== shot.id
    || (candidateId && clip.candidateId !== candidateId) || clip.status !== 'active')) {
    throw recoveryError('SHOT_RECOVERY_STALE', '时间线片段已变化，请重新建立恢复计划');
  }

  const payload = {
    schemaVersion: 1,
    planId: plan.id || null,
    planHash: plan.planHash,
    shot: {
      id: shot.id,
      position: shot.position ?? null,
      revision: shot.revision,
      selectedCandidateId: shot.selectedCandidateId || null,
    },
    sourceCandidate: sourceCandidate ? {
      id: sourceCandidate.id,
      contentHash: sourceCandidate.contentHash,
      mimeType: sourceCandidate.mimeType,
      stableUrl: sourceCandidate.stableUrl,
      projectAssetRef: sourceCandidate.projectAssetRef,
    } : null,
    sourceTimelineClips: sourceTimelineClips.map(clip => ({
      id: clip.id,
      shotId: clip.shotId,
      candidateId: clip.candidateId,
      position: clip.position,
      trimStartMs: clip.trimStartMs,
      trimEndMs: clip.trimEndMs,
      muted: Boolean(clip.muted),
      revision: clip.revision,
      status: clip.status,
    })),
    edit: plan.edit,
    preserve: plan.preserve,
    providerSubmission: false,
    billingMutation: false,
  };
  return { ...payload, executionHash: hashPlan(payload) };
}

function canonicalTargetRef(value, { allowSourceDefaults = false } = {}) {
  if (!value || typeof value !== 'object') return null;
  const projectAssetId = clean(value.projectAssetId, 256);
  const stableUrl = clean(value.stableUrl, 2000);
  const contentHash = clean(value.contentHash, 256);
  const expectedContentHash = clean(value.expectedContentHash, 256)
    || (allowSourceDefaults ? contentHash : '');
  const role = clean(value.role, 64)
    || (allowSourceDefaults ? 'generated-video' : '');
  if (!projectAssetId || !stableUrl || !contentHash || !expectedContentHash || !role
    || expectedContentHash !== contentHash) return null;
  return {
    projectId: clean(value.projectId, 256) || null,
    projectAssetId,
    assetId: clean(value.assetId, 256) || null,
    stableUrl,
    contentHash,
    expectedContentHash,
    mimeType: clean(value.mimeType, 128) || null,
    role,
  };
}

function assertShotRecoveryApplicationIntegrity(application) {
  if (!application || application.schemaVersion !== 1 || application.status !== 'draft'
    || application.providerSubmission !== false || application.billingMutation !== false) {
    throw recoveryError('SHOT_RECOVERY_INVALID', 'shot recovery application is invalid');
  }
  const { applicationHash, ...payload } = application;
  if (!/^[a-f0-9]{64}$/i.test(String(applicationHash || ''))
    || hashPlan(payload) !== String(applicationHash).toLowerCase()) {
    throw recoveryError('SHOT_RECOVERY_INVALID', '镜头应用草稿完整性校验失败');
  }
  return application;
}

export function buildShotRecoveryApplication(execution, {
  targetCandidateId,
  targetProjectAssetRef = null,
} = {}) {
  if (!execution || execution.schemaVersion !== 1
    || execution.providerSubmission !== false || execution.billingMutation !== false) {
    throw recoveryError('SHOT_RECOVERY_INVALID', 'shot recovery execution is invalid');
  }
  const sourceClips = Array.isArray(execution.sourceTimelineClips) ? execution.sourceTimelineClips : [];
  if (sourceClips.some(clip => !clip || clip.status !== 'active'
    || !clip.id || !clip.candidateId || !Number.isSafeInteger(clip.revision))) {
    throw recoveryError('SHOT_RECOVERY_STALE', '时间线片段已变化，请重新建立恢复计划');
  }
  const { executionHash, ...executionPayload } = execution;
  if (executionHash !== undefined
    && (!/^[a-f0-9]{64}$/i.test(String(executionHash))
      || hashPlan(executionPayload) !== String(executionHash).toLowerCase())) {
    throw recoveryError('SHOT_RECOVERY_INVALID', '镜头执行草稿完整性校验失败');
  }

  const sourceRef = canonicalTargetRef(execution.sourceCandidate?.projectAssetRef, { allowSourceDefaults: true });
  if (!sourceRef) throw recoveryError('PROJECT_ASSET_REF_INVALID', '候选缺少完整的已核验项目素材引用');
  const requestedCandidateId = targetCandidateId === undefined
    ? execution.sourceCandidate?.id
    : clean(targetCandidateId, 256);
  const targetRef = targetProjectAssetRef === null
    ? null
    : canonicalTargetRef(targetProjectAssetRef);
  if (!requestedCandidateId || (targetProjectAssetRef !== null && !targetRef)) {
    throw recoveryError('PROJECT_ASSET_REF_INVALID', '目标候选缺少完整的已核验项目素材引用');
  }

  const edit = execution.edit && typeof execution.edit === 'object' ? execution.edit : {};
  const timelineActions = sourceClips.map(clip => {
    if (edit.operation === 'extend') {
      return {
        type: 'extend_tail', clipId: clip.id, expectedRevision: clip.revision,
        expectedCandidateId: clip.candidateId, extensionMs: edit.extensionMs,
        targetDurationMs: edit.targetDurationMs,
      };
    }
    if (edit.operation === 'track_replace') {
      return {
        type: 'track_replace', clipId: clip.id, expectedRevision: clip.revision,
        expectedCandidateId: clip.candidateId, region: edit.region || null,
      };
    }
    return {
      type: edit.operation === 'reshoot' ? 'reshoot_shot' : 'replace_candidate',
      clipId: clip.id, expectedRevision: clip.revision,
      expectedCandidateId: clip.candidateId,
    };
  });
  const payload = {
    schemaVersion: 1,
    status: 'draft',
    planId: execution.planId || null,
    planHash: execution.planHash,
    candidateAction: {
      type: 'create_candidate',
      sourceCandidateId: execution.sourceCandidate?.id || null,
      expectedCandidateId: requestedCandidateId,
      canonicalAssetRequired: true,
      targetProjectAssetRef: targetRef,
      recoveryOperation: edit.operation || 'replace_candidate',
    },
    executionHash,
    shot: execution.shot,
    timelineActions,
    preserve: execution.preserve,
    providerSubmission: false,
    billingMutation: false,
  };
  return { ...payload, applicationHash: hashPlan(payload) };
}

/**
 * Validate a provider delivery against an execution draft without persisting
 * anything. A trusted worker can turn this receipt into register/select/clip
 * mutations only after it has created the canonical project asset.
 */
export function buildShotRecoveryDeliveryReceipt(application, delivery, {
  ownerEmail = '', projectId = '',
} = {}) {
  assertShotRecoveryApplicationIntegrity(application);
  if (!delivery || delivery.status !== 'completed') {
    throw recoveryError('SHOT_RECOVERY_DELIVERY_INVALID', '镜头供应商结果尚未完成');
  }
  const normalizedProjectId = clean(projectId, 256);
  const deliveryProjectId = clean(delivery.projectId, 256);
  if (normalizedProjectId && deliveryProjectId && normalizedProjectId !== deliveryProjectId) {
    throw recoveryError('PROJECT_ASSET_REF_INVALID', '镜头结果不属于当前项目');
  }
  // Older trusted delivery producers omitted fields that the server can
  // derive without weakening the asset identity check: the expected hash is
  // the delivered content hash, and recovery outputs are generated videos.
  const targetRef = canonicalTargetRef(delivery.projectAssetRef, { allowSourceDefaults: true });
  if (!targetRef || !String(targetRef.mimeType || '').startsWith('video/')) {
    throw recoveryError('PROJECT_ASSET_REF_INVALID', '镜头结果缺少已核验的视频项目素材引用');
  }
  if (targetRef.projectId && normalizedProjectId && targetRef.projectId !== normalizedProjectId) {
    throw recoveryError('PROJECT_ASSET_REF_INVALID', '镜头结果项目范围不匹配');
  }
  const deliveryHash = clean(delivery.contentHash, 256);
  const deliveryUrl = clean(delivery.stableUrl, 2000);
  if ((deliveryHash && deliveryHash !== targetRef.contentHash)
    || (deliveryUrl && deliveryUrl !== targetRef.stableUrl)) {
    throw recoveryError('PROJECT_ASSET_REF_INVALID', '镜头结果内容哈希或地址与项目素材不一致');
  }
  const expectedRef = application.candidateAction?.targetProjectAssetRef;
  if (expectedRef && expectedRef.projectAssetId !== targetRef.projectAssetId) {
    throw recoveryError('PROJECT_ASSET_REF_INVALID', '镜头结果未匹配应用草稿指定的项目素材');
  }
  const payload = {
    schemaVersion: 1,
    status: 'ready',
    planId: application.planId || null,
    planHash: application.planHash || null,
    applicationHash: application.applicationHash,
    candidate: {
      candidateId: clean(delivery.candidateId, 256) || null,
      expectedCandidateId: application.candidateAction?.expectedCandidateId || null,
      outputAssetId: clean(delivery.outputAssetId || targetRef.assetId, 256) || null,
      stableUrl: targetRef.stableUrl,
      contentHash: targetRef.contentHash,
      mimeType: targetRef.mimeType,
      projectAssetRef: targetRef,
    },
    shot: application.shot,
    timelineActions: application.timelineActions,
    preserve: application.preserve,
    provider: {
      provider: clean(delivery.provider, 80) || null,
      model: clean(delivery.model, 160) || null,
      requestId: clean(delivery.requestId, 256) || null,
    },
    providerSubmission: false,
    billingMutation: false,
  };
  return { ...payload, receiptHash: hashPlan(payload) };
}

/**
 * Verify a ready delivery receipt before handing it to a persistence
 * transaction. The receipt is intentionally self-contained so a worker can
 * be retried without trusting mutable client state.
 */
export function assertShotRecoveryDeliveryReceiptIntegrity(receipt) {
  if (!receipt || receipt.schemaVersion !== 1 || receipt.status !== 'ready'
    || receipt.providerSubmission !== false || receipt.billingMutation !== false
    || !receipt.candidate || !receipt.shot || !Array.isArray(receipt.timelineActions)) {
    throw recoveryError('SHOT_RECOVERY_DELIVERY_INVALID', '镜头交付回执无效');
  }
  const { receiptHash, ...payload } = receipt;
  if (!/^[a-f0-9]{64}$/i.test(String(receiptHash || ''))
    || hashPlan(payload) !== String(receiptHash).toLowerCase()) {
    throw recoveryError('SHOT_RECOVERY_DELIVERY_INVALID', '镜头交付回执完整性校验失败');
  }
  const candidate = receipt.candidate;
  const ref = canonicalTargetRef(candidate.projectAssetRef);
  if (!ref || !String(ref.mimeType || '').startsWith('video/')) {
    throw recoveryError('PROJECT_ASSET_REF_INVALID', '镜头交付回执缺少已核验的视频项目素材引用');
  }
  if (candidate.stableUrl !== ref.stableUrl || candidate.contentHash !== ref.contentHash
    || candidate.mimeType !== ref.mimeType) {
    throw recoveryError('PROJECT_ASSET_REF_INVALID', '镜头交付回执与项目素材引用不一致');
  }
  if (!clean(receipt.shot.id, 256) || !Number.isSafeInteger(receipt.shot.revision)) {
    throw recoveryError('SHOT_RECOVERY_DELIVERY_INVALID', '镜头交付回执缺少修订保护');
  }
  for (const action of receipt.timelineActions) {
    if (!action || !clean(action.clipId, 256) || !clean(action.expectedCandidateId, 256)
      || !Number.isSafeInteger(action.expectedRevision)) {
      throw recoveryError('SHOT_RECOVERY_DELIVERY_INVALID', '镜头交付回执缺少时间线修订保护');
    }
  }
  return receipt;
}

/**
 * Compile a verified delivery into a deterministic, provider-neutral commit
 * draft. A later owner-scoped transaction may consume this draft to register
 * a canonical candidate, select it, and apply guarded timeline operations.
 */
export function compileShotRecoveryCommit(receipt, { projectId = '' } = {}) {
  assertShotRecoveryDeliveryReceiptIntegrity(receipt);
  const normalizedProjectId = clean(projectId, 256);
  const ref = receipt.candidate.projectAssetRef;
  if (normalizedProjectId && ref.projectId && ref.projectId !== normalizedProjectId) {
    throw recoveryError('PROJECT_ASSET_REF_INVALID', '镜头提交草稿项目范围不匹配');
  }
  const candidate = {
    shotId: receipt.shot.id,
    expectedShotRevision: receipt.shot.revision,
    expectedSelectedCandidateId: receipt.shot.selectedCandidateId || null,
    requestedCandidateId: clean(receipt.candidate.candidateId, 256) || null,
    expectedCandidateId: clean(receipt.candidate.expectedCandidateId, 256) || null,
    outputAssetId: clean(receipt.candidate.outputAssetId, 256) || null,
    stableUrl: receipt.candidate.stableUrl,
    contentHash: receipt.candidate.contentHash,
    mimeType: receipt.candidate.mimeType,
    projectAssetRef: ref,
    provenance: receipt.provider,
  };
  if (!candidate.expectedCandidateId) {
    throw recoveryError('SHOT_RECOVERY_DELIVERY_INVALID', '镜头提交草稿缺少候选幂等键');
  }
  const timelineActions = receipt.timelineActions.map(action => ({
    ...action,
    shotId: receipt.shot.id,
    targetCandidateId: candidate.requestedCandidateId || candidate.expectedCandidateId,
  }));
  const payload = {
    schemaVersion: 1,
    status: 'ready',
    planId: receipt.planId || null,
    planHash: receipt.planHash || null,
    receiptHash: receipt.receiptHash,
    projectId: normalizedProjectId || ref.projectId || null,
    candidate,
    timelineActions,
    preserve: receipt.preserve,
    provider: receipt.provider,
    providerSubmission: false,
    billingMutation: false,
  };
  return { ...payload, commitHash: hashPlan(payload) };
}

function assertShotRecoveryCommitIntegrity(commit) {
  if (!commit || commit.schemaVersion !== 1 || commit.status !== 'ready'
    || commit.providerSubmission !== false || commit.billingMutation !== false
    || !commit.candidate || !Array.isArray(commit.timelineActions)) {
    throw recoveryError('SHOT_RECOVERY_DELIVERY_INVALID', '镜头提交草稿无效');
  }
  const { commitHash, ...payload } = commit;
  if (!/^[a-f0-9]{64}$/i.test(String(commitHash || ''))
    || hashPlan(payload) !== String(commitHash).toLowerCase()) {
    throw recoveryError('SHOT_RECOVERY_DELIVERY_INVALID', '镜头提交草稿完整性校验失败');
  }
  const candidate = commit.candidate;
  const ref = canonicalTargetRef(candidate.projectAssetRef);
  if (!ref || !String(ref.mimeType || '').startsWith('video/')) {
    throw recoveryError('PROJECT_ASSET_REF_INVALID', '镜头提交草稿缺少已核验的视频项目素材引用');
  }
  if (commit.projectId && ref.projectId && commit.projectId !== ref.projectId) {
    throw recoveryError('PROJECT_ASSET_REF_INVALID', '镜头提交草稿项目范围不匹配');
  }
  if (!clean(candidate.shotId, 256) || !clean(candidate.expectedCandidateId, 256)
    || !clean(candidate.requestedCandidateId, 256)
    || !Number.isSafeInteger(candidate.expectedShotRevision)) {
    throw recoveryError('SHOT_RECOVERY_DELIVERY_INVALID', '镜头提交草稿缺少候选或镜头修订保护');
  }
  const clipIds = new Set();
  for (const action of commit.timelineActions) {
    if (!action || !clean(action.clipId, 256) || clipIds.has(action.clipId)
      || !clean(action.expectedCandidateId, 256)
      || !Number.isSafeInteger(action.expectedRevision)
      || action.targetCandidateId !== candidate.requestedCandidateId) {
      throw recoveryError('SHOT_RECOVERY_DELIVERY_INVALID', '镜头提交草稿缺少时间线修订保护');
    }
    clipIds.add(action.clipId);
  }
  return commit;
}

/**
 * Revalidate a commit draft against the current in-memory workbench snapshot.
 * This is the final provider-neutral guard before a future persistence
 * transaction. It deliberately does not resolve or mutate canonical assets;
 * the store-level preflight performs that owner/lifecycle check separately.
 */
export function compileShotRecoveryCommitPreflight(commit, workbench, { projectId = '' } = {}) {
  assertShotRecoveryCommitIntegrity(commit);
  const normalizedProjectId = clean(projectId, 256);
  if (normalizedProjectId && commit.projectId && normalizedProjectId !== commit.projectId) {
    throw recoveryError('PROJECT_ASSET_REF_INVALID', '镜头提交草稿项目范围不匹配');
  }
  const shot = (Array.isArray(workbench?.shots) ? workbench.shots : [])
    .find(candidate => candidate?.id === commit.candidate.shotId);
  if (!shot || shot.revision !== commit.candidate.expectedShotRevision
    || (shot.selectedCandidateId || null) !== (commit.candidate.expectedSelectedCandidateId || null)) {
    throw recoveryError('SHOT_RECOVERY_STALE', '镜头修订或选定候选已变化，请重新建立恢复计划');
  }
  const sourceCandidate = (Array.isArray(shot.candidates) ? shot.candidates : [])
    .find(candidate => candidate?.id === commit.candidate.expectedCandidateId);
  if (!sourceCandidate || sourceCandidate.projectAssetRefStatus !== 'verified'
    || !sourceCandidate.projectAssetRef?.projectAssetId) {
    throw recoveryError('PROJECT_ASSET_REF_INVALID', '镜头源候选缺少已核验的项目素材引用');
  }
  const timeline = Array.isArray(workbench?.timelineClips) ? workbench.timelineClips : [];
  const timelineActions = commit.timelineActions.map(action => {
    const clip = timeline.find(candidate => candidate?.id === action.clipId);
    if (!clip || clip.shotId !== shot.id || clip.status !== 'active'
      || clip.revision !== action.expectedRevision
      || clip.candidateId !== action.expectedCandidateId) {
      throw recoveryError('SHOT_RECOVERY_STALE', '时间线片段已变化，请重新建立恢复计划');
    }
    return { ...action };
  });
  const payload = {
    schemaVersion: 1,
    status: 'ready',
    projectId: normalizedProjectId || commit.projectId || null,
    planId: commit.planId || null,
    commitHash: commit.commitHash,
    shot: {
      id: shot.id,
      revision: shot.revision,
      selectedCandidateId: shot.selectedCandidateId || null,
    },
    candidate: {
      expectedCandidateId: commit.candidate.expectedCandidateId,
      requestedCandidateId: commit.candidate.requestedCandidateId,
      projectAssetRef: commit.candidate.projectAssetRef,
    },
    timelineActions,
    providerSubmission: false,
    billingMutation: false,
  };
  return { ...payload, preflightHash: hashPlan(payload) };
}

export const videoShotRecoveryLimits = Object.freeze({
  maxReasonLength: MAX_REASON_LENGTH,
  modes: [...RECOVERY_MODES],
});
