import assert from 'node:assert/strict';
import test from 'node:test';

import { toGenerationStatus } from '../src/pages/EcCanvas/generationStatusModel.js';

test('an older review state offers completion without exposing internal quality language', () => {
  const status = toGenerationStatus({ status: 'needs_review' });
  assert.equal(status.action, 'retry');
  assert.match(status.detail, /已.*保留|补全/);
  assert.doesNotMatch(`${status.title}${status.detail}`, /质量|修订|检查/);
});

test('provider credential details never reach the user-facing status', () => {
  const status = toGenerationStatus({ status: 'failed', error: 'Vision API error 401: Authentication Fails, api key invalid' });
  assert.doesNotMatch(status.detail, /api|key|authentication|401/i);
  assert.equal(status.retryable, true);
});
