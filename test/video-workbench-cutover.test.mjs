import assert from 'node:assert/strict';
import test from 'node:test';

import { readVideoPlatformFlags, VIDEO_PLATFORM_FLAG_NAMES } from '../server/config.mjs';

test('P1 video workbench is explicitly default-off', () => {
  const flags = readVideoPlatformFlags({});
  assert.equal(flags.VIDEO_PLATFORM_P1_WORKBENCH, false);
  assert.ok(VIDEO_PLATFORM_FLAG_NAMES.includes('VIDEO_PLATFORM_P1_WORKBENCH'));
});

test('P1 video workbench accepts explicit boolean values only', () => {
  assert.equal(readVideoPlatformFlags({ VIDEO_PLATFORM_P1_WORKBENCH: 'true' }).VIDEO_PLATFORM_P1_WORKBENCH, true);
  assert.equal(readVideoPlatformFlags({ VIDEO_PLATFORM_P1_WORKBENCH: 'off' }).VIDEO_PLATFORM_P1_WORKBENCH, false);
  assert.throws(() => readVideoPlatformFlags({ VIDEO_PLATFORM_P1_WORKBENCH: 'sometimes' }), /VIDEO_PLATFORM_P1_WORKBENCH/);
});
