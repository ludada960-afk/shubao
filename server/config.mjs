export const VIDEO_PLATFORM_FLAG_NAMES = Object.freeze([
  'VIDEO_PLATFORM_OWNER_READS',
  'VIDEO_PLATFORM_ATTEMPTS',
  'VIDEO_PLATFORM_OUTBOX',
  'VIDEO_PLATFORM_PROJECT_BRIDGE',
  'VIDEO_PLATFORM_TUS_UPLOAD',
  'VIDEO_PLATFORM_READ_NEW_STATE',
]);

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
  return Object.fromEntries(VIDEO_PLATFORM_FLAG_NAMES.map(name => [name, readBooleanFlag(name, env[name])]));
}
