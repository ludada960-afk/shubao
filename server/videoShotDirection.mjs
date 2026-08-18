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
