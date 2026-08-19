import crypto from 'node:crypto';

const MAX_REASON_LENGTH = 500;
const RECOVERY_MODES = new Set(['replace_candidate', 'rebuild_shot']);

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

export function buildShotRecoveryPlan(workbench, {
  shotId,
  reason = '',
  mode = 'replace_candidate',
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
  const { planHash, ...payload } = plan;
  if (!/^[a-f0-9]{64}$/i.test(String(planHash || '')) || hashPlan(payload) !== String(planHash).toLowerCase()) {
    throw Object.assign(new Error('shot recovery plan hash mismatch'), { code: 'SHOT_RECOVERY_INVALID' });
  }
  if (plan.providerSubmission !== false || plan.billingMutation !== false) {
    throw Object.assign(new Error('shot recovery plan cannot submit or bill'), { code: 'SHOT_RECOVERY_INVALID' });
  }
  return plan;
}

export const videoShotRecoveryLimits = Object.freeze({
  maxReasonLength: MAX_REASON_LENGTH,
  modes: [...RECOVERY_MODES],
});
