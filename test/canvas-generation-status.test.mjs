import assert from 'node:assert/strict';
import test from 'node:test';

import { toGenerationStatus } from '../src/pages/EcCanvas/generationStatusModel.js';

test('quality review is transparent and retryable without pretending an asset completed', () => {
  const status = toGenerationStatus({ status: 'needs_review' });
  assert.equal(status.action, 'retry');
  assert.match(status.detail, /未扣除/);
});

test('provider credential details never reach the user-facing status', () => {
  const status = toGenerationStatus({ status: 'failed', error: 'Vision API error 401: Authentication Fails, api key invalid' });
  assert.doesNotMatch(status.detail, /api|key|authentication|401/i);
  assert.equal(status.retryable, true);
});
