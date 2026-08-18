import assert from 'node:assert/strict';
import test from 'node:test';

import { buildVideoRendererRequest } from '../server/videoRendererAdapter.mjs';
import { createVideoRendererOutboxEvent } from '../server/videoRendererOutbox.mjs';
import { reconcileVideoRendererAttempt } from '../server/videoRendererReconciliation.mjs';
import { claimVideoExportJob, createVideoExportJob } from '../server/videoExportJob.mjs';
import { videoExportManifestHash } from '../server/videoExportManifest.mjs';

const manifestPayload = {
  schemaVersion: 1,
  kind: 'video-export-manifest',
  options: { format: 'mp4', resolution: '720p', fps: 30, includeAudio: false },
  timeline: { durationMs: 4000, clips: [{ id: 'clip-1', durationMs: 4000 }] },
  audio: { includeAudio: false, tracks: [] },
  delivery: { status: 'manifest_ready', renderer: 'external-worker', providerSubmission: false, billingMutation: false },
};
const manifest = { ...manifestPayload, manifestHash: videoExportManifestHash(manifestPayload) };

function setup() {
  const job = claimVideoExportJob(createVideoExportJob({
    id: 'export-job-1', ownerEmail: 'owner@example.com', projectId: 'project-1', manifestId: 'manifest-1',
    manifest, createdAt: '2026-08-18T08:00:00.000Z',
  }), {
    workerId: 'worker-a', leaseToken: 'lease-a', leaseMs: 30_000,
    now: '2026-08-18T08:01:00.000Z',
  });
  const request = buildVideoRendererRequest({ job, manifest, now: job.updatedAt });
  const event = createVideoRendererOutboxEvent({
    id: 'export-job-1:attempt:1', request, createdAt: job.updatedAt,
  });
  return { job, request, event };
}

function response(request, externalJobId, status, extra = {}) {
  return { externalJobId, status, requestId: request.requestId, requestHash: request.requestHash, ...extra };
}

test('submits, polls, and ignores duplicate terminal callbacks without billing side effects', async () => {
  const { request, event } = setup();
  let submitCalls = 0;
  let pollCalls = 0;
  const adapter = {
    submit: async current => { submitCalls += 1; return response(current, 'remote-1', 'queued'); },
    poll: async current => { pollCalls += 1; return response(current, 'remote-1', 'completed'); },
  };
  const first = await reconcileVideoRendererAttempt({
    event, request, adapter, workerId: 'worker-a', leaseToken: 'lease-a',
    now: '2026-08-18T08:01:00.000Z', pollAt: ['2026-08-18T08:01:02.000Z'],
  });
  assert.equal(first.event.state, 'completed');
  assert.equal(first.event.providerSubmission, false);
  assert.equal(first.event.billingMutation, false);
  assert.equal(submitCalls, 1);
  assert.equal(pollCalls, 1);
  assert.deepEqual(first.trace.map(item => item.step), ['claim', 'submit', 'poll', 'complete']);

  const duplicate = await reconcileVideoRendererAttempt({
    event: first.event, request, adapter, workerId: 'worker-a', leaseToken: 'lease-a',
    now: '2026-08-18T08:01:03.000Z', pollAt: ['2026-08-18T08:01:04.000Z'],
  });
  assert.equal(duplicate.event.eventHash, first.event.eventHash);
  assert.deepEqual(duplicate.trace.map(item => item.step), ['noop-terminal']);
  assert.equal(submitCalls, 1);
  assert.equal(pollCalls, 1);
});

test('retries a lost submit result with the same request idempotency key', async () => {
  const { request, event } = setup();
  let submitCalls = 0;
  const adapter = {
    submit: async current => {
      submitCalls += 1;
      if (submitCalls === 1) throw Object.assign(new Error('network reset'), { code: 'NETWORK_RESET' });
      return response(current, 'remote-2', 'completed');
    },
  };
  const first = await reconcileVideoRendererAttempt({
    event, request, adapter, workerId: 'worker-a', leaseToken: 'lease-a',
    now: '2026-08-18T08:01:00.000Z', retryAt: '2026-08-18T08:02:00.000Z',
  });
  assert.equal(first.event.state, 'failed');
  assert.equal(first.event.lastErrorCode, 'RENDERER_SUBMIT_UNKNOWN');
  assert.equal(first.event.nextAttemptAt, '2026-08-18T08:02:00.000Z');
  const second = await reconcileVideoRendererAttempt({
    event: first.event, request, adapter, workerId: 'worker-a', leaseToken: 'lease-b',
    now: '2026-08-18T08:02:01.000Z',
  });
  assert.equal(second.event.state, 'completed');
  assert.equal(second.event.payload.requestId, request.requestId);
  assert.equal(submitCalls, 2);
});

test('turns a poll that passes the deadline into a retryable timeout', async () => {
  const { request, event } = setup();
  const adapter = {
    submit: async current => response(current, 'remote-3', 'running'),
    poll: async current => response(current, 'remote-3', 'running'),
  };
  const result = await reconcileVideoRendererAttempt({
    event, request, adapter, workerId: 'worker-a', leaseToken: 'lease-a',
    now: '2026-08-18T08:01:00.000Z', deadlineAt: '2026-08-18T08:01:05.000Z',
    pollAt: ['2026-08-18T08:01:06.000Z'], retryAt: '2026-08-18T08:02:00.000Z',
  });
  assert.equal(result.event.state, 'failed');
  assert.equal(result.event.lastErrorCode, 'RENDER_TIMEOUT');
  assert.deepEqual(result.trace.map(item => item.step), ['claim', 'submit', 'timeout']);
});

test('rejects a callback for a different request before mutating the event', async () => {
  const { request, event } = setup();
  const adapter = {
    submit: async current => response(current, 'remote-4', 'queued'),
    poll: async current => response({ ...current, requestId: 'other:attempt:1' }, 'remote-4', 'completed'),
  };
  await assert.rejects(
    reconcileVideoRendererAttempt({
      event, request, adapter, workerId: 'worker-a', leaseToken: 'lease-a',
      now: '2026-08-18T08:01:00.000Z', pollAt: ['2026-08-18T08:01:02.000Z'],
    }),
    error => error.code === 'RENDER_RECONCILIATION_INVALID',
  );
});

test('rejects a mismatched submit callback before converting it into a retry', async () => {
  const { request, event } = setup();
  const adapter = {
    submit: async current => response({ ...current, requestHash: 'forged-request-hash' }, 'remote-5', 'queued'),
  };
  await assert.rejects(
    reconcileVideoRendererAttempt({
      event, request, adapter, workerId: 'worker-a', leaseToken: 'lease-a',
      now: '2026-08-18T08:01:00.000Z',
    }),
    error => error.code === 'RENDER_RECONCILIATION_INVALID',
  );
  assert.equal(event.state, 'pending');
  assert.equal(event.attempts, 0);
});
