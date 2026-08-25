export const VIDEO_PLATFORM_FLAG_NAMES = Object.freeze([
  'VIDEO_PLATFORM_OWNER_READS',
  'VIDEO_PLATFORM_ATTEMPTS',
  'VIDEO_PLATFORM_OUTBOX',
  'VIDEO_PLATFORM_PROJECT_BRIDGE',
  'VIDEO_PLATFORM_TUS_UPLOAD',
  'VIDEO_PLATFORM_READ_NEW_STATE',
  'VIDEO_PLATFORM_P1_WORKBENCH',
  'VIDEO_PLATFORM_P1_PLANNING',
]);

const DEFAULT_FLAG_VALUES = Object.freeze({
  VIDEO_PLATFORM_P1_WORKBENCH: false,
  // Planning is provider-neutral: it persists projects, assets, shots and
  // replayable plans, but it never submits a renderer job or mutates billing.
  VIDEO_PLATFORM_P1_PLANNING: true,
  // Director workbench UI (R1): three-pane workspace shell over the existing
  // planning-mode workbench APIs. Off by default until it passes full QA.
  VIDEO_PLATFORM_DIRECTOR_UI: false,
});

const TRUE_VALUES = new Set(['1', 'true', 'on', 'yes', 'enabled']);
const FALSE_VALUES = new Set(['0', 'false', 'off', 'no', 'disabled']);

function readBooleanFlag(name, value) {
  if (value === undefined || value === null || String(value).trim() === '') return true;
  const normalized = String(value).trim().toLowerCase();
  if (TRUE_VALUES.has(normalized)) return true;
  if (FALSE_VALUES.has(normalized)) return false;
  throw new Error(`${name} must be an explicit boolean feature flag`);
}

export function readVideoPlatformFlags(env = process.env) {
  return Object.fromEntries(VIDEO_PLATFORM_FLAG_NAMES.map(name => [
    name,
    env[name] === undefined || env[name] === null || String(env[name]).trim() === ''
      ? (DEFAULT_FLAG_VALUES[name] ?? true)
      : readBooleanFlag(name, env[name]),
  ]));
}
