import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildExportWebhookPayload,
  normalizeWebhookUrl,
} from '../server/videoExportWebhooks.mjs';

const OWNER = 'owner@example.com';

test('webhook urls must be public https and bounded', () => {
  assert.equal(normalizeWebhookUrl('https://ops.example.com/hooks/video').ok, true);
  for (const bad of [
    'http://ops.example.com/hooks',
    'https://127.0.0.1/hooks',
    'https://localhost/hooks',
    'https://10.0.0.3/hooks',
    'https://192.168.1.7/hooks',
    'ftp://ops.example.com',
    'not-a-url',
    '',
    null,
  ]) {
    const result = normalizeWebhookUrl(bad);
    assert.equal(result.ok, false, `must reject ${bad}`);
    assert.equal(result.url, null);
  }
});

test('export webhook payload is deterministic and provider-neutral', () => {
  const payload = buildExportWebhookPayload({
    id: 'job-1', projectId: 'p1', state: 'completed', manifestHash: 'abc123',
    outputAssetId: 'asset-9', completedAt: '2026-08-23T08:00:00Z',
  });
  assert.deepEqual(payload, {
    type: 'video.export.completed',
    jobId: 'job-1', projectId: 'p1', state: 'completed',
    manifestHash: 'abc123', outputAssetId: 'asset-9',
    completedAt: '2026-08-23T08:00:00Z',
  });
  assert.deepEqual(buildExportWebhookPayload(null), null);
});