import { videoWorkbenchPlanFingerprint } from './videoWorkbenchPlan.mjs';
import { normalizeShotDirection } from './videoShotDirection.mjs';

function clean(value, max = 400) {
  return String(value ?? '').trim().slice(0, max);
}

function coded(code, message) {
  return Object.assign(new Error(message), { code });
}

function approvedAssetMap(workbench) {
  return new Map((Array.isArray(workbench?.assets) ? workbench.assets : []).map(asset => [asset.id, asset]));
}

function continuityReviewSnapshot(review) {
  const source = review && typeof review === 'object' && !Array.isArray(review) ? review : {};
  const status = ['clear', 'review'].includes(source.status) ? source.status : 'unknown';
  const issues = Array.isArray(source.issues) ? source.issues.slice(0, 16).map(issue => ({
    code: clean(issue?.code, 120),
    detail: clean(issue?.detail, 500),
    shotIds: Array.isArray(issue?.shotIds)
      ? issue.shotIds.map(shotId => clean(shotId, 200)).filter(Boolean).slice(0, 8)
      : [],
  })).filter(issue => issue.code && issue.detail) : [];
  return { schemaVersion: 1, status, issues };
}

function preflightSnapshot(preflight) {
  const source = preflight && typeof preflight === 'object' && !Array.isArray(preflight) ? preflight : {};
  const requirements = source.requirements && typeof source.requirements === 'object' && !Array.isArray(source.requirements)
    ? source.requirements
    : {};
  const normalizeMessages = value => Array.isArray(value)
    ? value.slice(0, 16).map(item => ({
      code: clean(item?.code, 120),
      detail: clean(item?.detail, 500),
    })).filter(item => item.code && item.detail)
    : [];
  const rawBudgetCapPoints = requirements.budgetCapPoints;
  const numericBudgetCapPoints = ['number', 'string'].includes(typeof rawBudgetCapPoints)
    && String(rawBudgetCapPoints).trim() !== ''
    ? Number(rawBudgetCapPoints)
    : NaN;
  const budgetCapPoints = Number.isSafeInteger(numericBudgetCapPoints) && numericBudgetCapPoints >= 0
    ? numericBudgetCapPoints
    : null;
  const hash = clean(source.preflightHash, 128).toLowerCase();
  return {
    schemaVersion: Number.isSafeInteger(Number(source.schemaVersion)) ? Number(source.schemaVersion) : 1,
    status: ['ready', 'blocked'].includes(source.status) ? source.status : 'missing',
    preflightHash: /^[a-f0-9]{64}$/.test(hash) ? hash : '',
    requirements: {
      enforce: requirements.enforce === true,
      budgetCapPoints,
    },
    blockers: normalizeMessages(source.blockers),
    warnings: normalizeMessages(source.warnings),
  };
}

export function buildVideoWorkbenchGenerationDraft(workbench = {}, plan = {}, { planHash, approvalHash } = {}) {
  if (!plan || plan.status !== 'ready') throw coded('VIDEO_PLAN_NOT_READY', '只有可生成的计划才能编译生成草稿');
  const fingerprint = videoWorkbenchPlanFingerprint(plan);
  const requestedHash = clean(planHash, 128).toLowerCase();
  const approvedHash = clean(approvalHash, 128).toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(requestedHash) || requestedHash !== fingerprint
    || approvedHash !== fingerprint) {
    throw coded('VIDEO_PLAN_APPROVAL_REQUIRED', '请先确认当前生成计划');
  }

  const assets = approvedAssetMap(workbench);
  const shots = new Map((Array.isArray(workbench.shots) ? workbench.shots : []).map(shot => [shot.id, shot]));
  const draftShots = (Array.isArray(plan.shots) ? plan.shots : []).map(planShot => {
    const shot = shots.get(planShot.id);
    if (!shot) throw coded('SHOT_NOT_FOUND', '生成草稿引用的分镜不存在');
    const references = (Array.isArray(shot.bindings) ? shot.bindings : []).map(binding => {
      const asset = assets.get(binding.assetId);
      const version = asset?.versions?.find(item => item.id === binding.assetVersionId);
      if (!asset || asset.status !== 'approved' || asset.approvedVersionId !== binding.assetVersionId || !version) {
        throw coded('ASSET_NOT_APPROVED', '生成草稿引用的素材版本不是当前已确认版本');
      }
      return {
        assetId: asset.id,
        assetVersionId: version.id,
        role: clean(binding.role, 80),
        kind: clean(asset.kind, 80),
        name: clean(asset.name, 160),
        sourceProjectAssetId: clean(version.sourceProjectAssetId, 256),
      };
    });
    return {
      shotId: planShot.id,
      position: planShot.position,
      purpose: planShot.purpose,
      durationMs: planShot.durationMs,
      cameraLanguage: planShot.cameraLanguage || normalizeShotDirection(planShot.direction, shot.cameraLanguage).cameraLanguage,
      prompt: planShot.prompt,
      direction: normalizeShotDirection(planShot.direction, shot.cameraLanguage),
      references,
    };
  });

  return {
    schemaVersion: 2,
    projectId: clean(workbench?.project?.id, 200),
    planHash: fingerprint,
    providerSubmission: false,
    billingMutation: false,
    requiresMainGeneration: true,
    continuityReview: continuityReviewSnapshot(plan.continuityReview),
    preflight: preflightSnapshot(plan.preflight),
    product: plan.product,
    options: plan.options,
    totalDurationMs: plan.totalDurationMs,
    quote: plan.quote,
    shots: draftShots,
  };
}
