import test from 'node:test';
import assert from 'node:assert/strict';

import { runAiVideoAcceptance } from '../scripts/verify-ai-video-acceptance.mjs';

test('default AI-video acceptance is provider-free and reports the important invariants', async () => {
  const report = await runAiVideoAcceptance({
    platform: async () => ({ ok: true, providerSubmissions: 0, billingMutated: false, paidGenerationRequested: false }),
    renderer: async () => ({ ok: true, providerCalls: 0, billingMutated: false }),
    workbench: async () => ({ ok: true, billingMutated: false }),
  });
  assert.equal(report.ok, true);
  assert.equal(report.profile, 'local-no-paid-generation');
  assert.equal(report.providerSubmissions, 0);
  assert.equal(report.billingMutated, false);
  assert.equal(report.paidGenerationRequested, false);
});

test('AI-video acceptance fails closed if a stage reports a provider submission', async () => {
  const report = await runAiVideoAcceptance({
    platform: async () => ({ ok: true, providerSubmissions: 1, billingMutated: false, paidGenerationRequested: false }),
    renderer: async () => ({ ok: true, providerCalls: 0, billingMutated: false }),
    workbench: async () => ({ ok: true, billingMutated: false }),
  });
  assert.equal(report.ok, false);
  assert.equal(report.providerSubmissions, 1);
});
