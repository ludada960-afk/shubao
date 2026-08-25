import assert from 'node:assert/strict';
import test from 'node:test';
import { readVideoPlatformFlags } from '../server/config.mjs';

test('VID-R1: director UI flag defaults to off and honors env override', () => {
  const defaults = readVideoPlatformFlags({});
  assert.equal(defaults.VIDEO_PLATFORM_DIRECTOR_UI, false);

  const enabled = readVideoPlatformFlags({ VIDEO_PLATFORM_DIRECTOR_UI: 'true' });
  assert.equal(enabled.VIDEO_PLATFORM_DIRECTOR_UI, true);

  const explicitOff = readVideoPlatformFlags({ VIDEO_PLATFORM_DIRECTOR_UI: '0' });
  assert.equal(explicitOff.VIDEO_PLATFORM_DIRECTOR_UI, false);

  assert.throws(
    () => readVideoPlatformFlags({ VIDEO_PLATFORM_DIRECTOR_UI: 'maybe' }),
    error => /explicit boolean feature flag/.test(error?.message),
  );
});
