import assert from 'node:assert/strict';
import test from 'node:test';

import { createVideoWorkbenchRollout } from '../server/videoWorkbenchRollout.mjs';

test('video workbench rollout is closed when the global flag is off', () => {
  const rollout = createVideoWorkbenchRollout({
    enabled: false,
    authorizeOwner: () => ({ ok: true, email: 'owner@example.com' }),
  });
  assert.equal(rollout.isEligible('owner@example.com'), false);
  assert.equal(rollout.status().enabled, false);
});

test('video workbench rollout admits only an active owner cohort', () => {
  const rollout = createVideoWorkbenchRollout({
    enabled: true,
    authorizeOwner: email => email === 'owner@example.com'
      ? { ok: true, email }
      : { ok: false, code: 'ACCOUNT_ADMIN_FORBIDDEN' },
  });
  assert.equal(rollout.isEligible('owner@example.com'), true);
  assert.equal(rollout.isEligible('tester@example.com'), false);
  assert.deepEqual(rollout.status(), { enabled: true, cohort: 'owner' });
});

test('capability discovery is false for anonymous or ineligible requests', () => {
  const rollout = createVideoWorkbenchRollout({
    enabled: true,
    authorizeOwner: email => email === 'owner@example.com'
      ? { ok: true, email }
      : { ok: false },
  });
  assert.equal(rollout.enabledForRequest({}, () => { throw new Error('anonymous'); }), false);
  assert.equal(rollout.enabledForRequest({}, () => 'tester@example.com'), false);
  assert.equal(rollout.enabledForRequest({}, () => 'owner@example.com'), true);
});

test('ineligible route access throws a generic unavailable code', () => {
  const rollout = createVideoWorkbenchRollout({
    enabled: true,
    authorizeOwner: () => ({ ok: false }),
  });
  assert.throws(() => rollout.requireEligible('tester@example.com'), error => {
    assert.equal(error.code, 'VIDEO_WORKBENCH_UNAVAILABLE');
    return true;
  });
});
