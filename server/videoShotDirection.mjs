const SHOT_SCALES = new Set(['wide', 'full', 'medium', 'close', 'macro']);
const CAMERA_ANGLES = new Set(['eye_level', 'high_angle', 'low_angle', 'overhead', 'dutch', 'over_shoulder']);
const CAMERA_MOVES = new Set(['static', 'pan', 'tilt', 'dolly_in', 'dolly_out', 'tracking', 'orbit', 'fpv', 'dolly_zoom']);
const LIGHTING = new Set(['soft_key', 'hard_key', 'rim', 'volumetric', 'noir', 'golden_hour', 'blue_hour', 'rembrandt', 'high_key', 'low_key']);
const AXIS = new Set(['neutral', 'screen_left_to_right', 'screen_right_to_left']);
const GAZE = new Set(['neutral', 'screen_left', 'screen_right', 'toward_camera', 'away']);
const SCREEN_DIRECTIONS = new Set(['stationary', 'left_to_right', 'right_to_left']);
const TRANSITIONS = new Set(['cut', 'match_cut', 'dissolve', 'whip_pan', 'continuous']);

function clean(value, max = 240) {
  return String(value ?? '').trim().slice(0, max);
}

function object(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function enumValue(value, allowed, fallback) {
  const normalized = clean(value, 40).toLowerCase();
  return allowed.has(normalized) ? normalized : fallback;
}

/**
 * Keep director controls structured while retaining the legacy free-form camera field.
 * Invalid model output falls back to deterministic neutral values instead of inventing facts.
 */
export function normalizeShotDirection(value = {}, legacyCamera = '') {
  const source = object(value);
  const continuity = object(source.continuity);
  return {
    shotScale: enumValue(source.shotScale, SHOT_SCALES, 'medium'),
    cameraAngle: enumValue(source.cameraAngle, CAMERA_ANGLES, 'eye_level'),
    cameraMove: enumValue(source.cameraMove, CAMERA_MOVES, 'static'),
    lighting: enumValue(source.lighting, LIGHTING, 'soft_key'),
    primaryAction: clean(source.primaryAction, 240),
    cameraLanguage: clean(source.cameraLanguage || legacyCamera, 160),
    continuity: {
      axis: enumValue(continuity.axis, AXIS, 'neutral'),
      gaze: enumValue(continuity.gaze, GAZE, 'neutral'),
      screenDirection: enumValue(continuity.screenDirection, SCREEN_DIRECTIONS, 'stationary'),
      transition: enumValue(continuity.transition, TRANSITIONS, 'cut'),
    },
    negativePrompt: clean(source.negativePrompt, 400),
  };
}

function continuityIssue(code, detail, shotIds) {
  return {
    code,
    detail: clean(detail, 320),
    shotIds: shotIds.filter(Boolean),
  };
}

/**
 * Review adjacent shots before generation without turning creative choices into
 * hard blockers. The director can deliberately cross the axis, but the plan
 * must make that choice visible so the creator can confirm it first.
 */
export function reviewShotContinuity(shots = []) {
  const ordered = (Array.isArray(shots) ? shots : [])
    .map((shot, index) => ({ shot, index }))
    .sort((left, right) => {
      const leftPosition = Number.isFinite(Number(left.shot?.position))
        ? Number(left.shot.position)
        : left.index;
      const rightPosition = Number.isFinite(Number(right.shot?.position))
        ? Number(right.shot.position)
        : right.index;
      return leftPosition - rightPosition || left.index - right.index;
    })
    .map(({ shot }) => shot);

  const issues = [];
  ordered.forEach(shot => {
    const id = clean(shot?.id, 200);
    const direction = object(shot?.direction);
    if (!clean(direction.primaryAction, 240)) {
      issues.push(continuityIssue(
        'SHOT_PRIMARY_ACTION_MISSING',
        `镜头 ${id || '未命名'} 未明确一个主体动作，请在生成前补充。`,
        [id],
      ));
    }
  });

  for (let index = 1; index < ordered.length; index += 1) {
    const previous = ordered[index - 1];
    const current = ordered[index];
    const previousContinuity = object(object(previous?.direction).continuity);
    const currentContinuity = object(object(current?.direction).continuity);
    const previousId = clean(previous?.id, 200);
    const currentId = clean(current?.id, 200);
    if (
      previousContinuity.axis !== 'neutral'
      && currentContinuity.axis !== 'neutral'
      && previousContinuity.axis !== currentContinuity.axis
    ) {
      issues.push(continuityIssue(
        'AXIS_REVERSAL_REVIEW',
        `镜头 ${previousId || '未命名'} → ${currentId || '未命名'} 的轴线方向发生反转，请确认是否有明确的空间重建。`,
        [previousId, currentId],
      ));
    }
    if (
      previousContinuity.screenDirection !== 'stationary'
      && currentContinuity.screenDirection !== 'stationary'
      && previousContinuity.screenDirection !== currentContinuity.screenDirection
    ) {
      issues.push(continuityIssue(
        'SCREEN_DIRECTION_REVERSAL_REVIEW',
        `镜头 ${previousId || '未命名'} → ${currentId || '未命名'} 的屏幕运动方向发生反转，请确认剪辑节奏和转场意图。`,
        [previousId, currentId],
      ));
    }
  }

  return {
    status: issues.length ? 'review' : 'clear',
    issues,
  };
}

export const VIDEO_SHOT_DIRECTION_OPTIONS = Object.freeze({
  shotScale: [...SHOT_SCALES],
  cameraAngle: [...CAMERA_ANGLES],
  cameraMove: [...CAMERA_MOVES],
  lighting: [...LIGHTING],
  axis: [...AXIS],
  gaze: [...GAZE],
  screenDirection: [...SCREEN_DIRECTIONS],
  transition: [...TRANSITIONS],
});
