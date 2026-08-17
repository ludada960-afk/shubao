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
    schemaVersion: 1,
    projectId: clean(workbench?.project?.id, 200),
    planHash: fingerprint,
    providerSubmission: false,
    billingMutation: false,
    requiresMainGeneration: true,
    product: plan.product,
    options: plan.options,
    totalDurationMs: plan.totalDurationMs,
    quote: plan.quote,
    shots: draftShots,
  };
}
