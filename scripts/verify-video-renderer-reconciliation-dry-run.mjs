import assert from 'node:assert/strict';

import { buildVideoRendererRequest } from '../server/videoRendererAdapter.mjs';
import {
  assertVideoRendererOutboxIntegrity,
  createVideoRendererOutboxEvent,
} from '../server/videoRendererOutbox.mjs';
import { reconcileVideoRendererAttempt } from '../server/videoRendererReconciliation.mjs';
import { claimVideoExportJob, createVideoExportJob } from '../server/videoExportJob.mjs';
import { videoExportManifestHash } from '../server/videoExportManifest.mjs';

const BASE_TIME = '2026-08-18T08:01:00.000Z';
const manifestPayload = {
  schemaVersion: 1,
  kind: 'video-export-manifest',
  options: { format: 'mp4', resolution: '720p', fps: 30, includeAudio: false },
  timeline: { durationMs: 4000, clips: [{ id: 'clip-1', durationMs: 4000 }] },
  audio: { includeAudio: false, tracks: [] },
  delivery: {
    status: 'manifest_ready',
    renderer: 'external-worker',
    providerSubmission: false,
    billingMutation: false,
  },
};
const manifest = { ...manifestPayload, manifestHash: videoExportManifestHash(manifestPayload) };

function setup(id) {
  const job = claimVideoExportJob(createVideoExportJob({
    id,
    ownerEmail: 'owner@example.com',
    projectId: `${id}-project`,
    manifestId: `${id}-manifest`,
    manifest,
    createdAt: '2026-08-18T08:00:00.000Z',
  }), {
    workerId: `${id}-worker`,
    leaseToken: `${id}-lease`,
    leaseMs: 30_000,
    now: BASE_TIME,
  });
  const request = buildVideoRendererRequest({ job, manifest, now: BASE_TIME });
  const event = createVideoRendererOutboxEvent({
    id: `${id}:attempt:1`, request, createdAt: BASE_TIME,
  });
  return { job, request, event, workerId: `${id}-worker`, leaseToken: `${id}-lease` };
}

function response(request, externalJobId, status, extra = {}) {
  return {
    externalJobId,
    status,
    requestId: request.requestId,
    requestHash: request.requestHash,
    ...extra,
  };
}

function scenario(name, result, adapterCalls) {
  assert.equal(result.event.providerSubmission, false);
  assert.equal(result.event.billingMutation, false);
  assert.doesNotThrow(() => assertVideoRendererOutboxIntegrity(result.event));
  return {
    name,
    state: result.event.state,
    attempts: result.event.attempts,
    trace: result.trace.map(item => item.step),
    providerSubmission: result.event.providerSubmission,
    billingMutation: result.event.billingMutation,
    adapterCalls,
  };
}

export async function runVideoRendererReconciliationDryRun() {
  const scenarios = [];

  {
    const { request, event, workerId, leaseToken } = setup('dry-complete');
    let calls = 0;
    const adapter = {
      submit: async current => { calls += 1; return response(current, 'dry-remote-1', 'queued'); },
      poll: async current => { calls += 1; return response(current, 'dry-remote-1', 'completed'); },
    };
    const result = await reconcileVideoRendererAttempt({
      event, request, adapter, workerId, leaseToken, now: BASE_TIME,
      pollAt: ['2026-08-18T08:01:02.000Z'],
    });
    assert.equal(result.event.state, 'completed');
    scenarios.push(scenario('complete', result, calls));
  }

  {
    const { request, event, workerId, leaseToken } = setup('dry-retry');
    let calls = 0;
    const adapter = {
      submit: async current => {
        calls += 1;
        if (calls === 1) throw Object.assign(new Error('simulated connection reset'), { code: 'NETWORK_RESET' });
        return response(current, 'dry-remote-2', 'completed');
      },
    };
    const first = await reconcileVideoRendererAttempt({
      event, request, adapter, workerId, leaseToken, now: BASE_TIME,
      retryAt: '2026-08-18T08:02:00.000Z',
    });
    assert.equal(first.event.state, 'failed');
    const second = await reconcileVideoRendererAttempt({
      event: first.event, request, adapter, workerId, leaseToken: 'dry-retry-lease-2',
      now: '2026-08-18T08:02:01.000Z',
    });
    assert.equal(second.event.state, 'completed');
    scenarios.push(scenario('lost-submit-retry', second, calls));
  }

  {
    const { request, event, workerId, leaseToken } = setup('dry-timeout');
    let calls = 0;
    const adapter = {
      submit: async current => { calls += 1; return response(current, 'dry-remote-3', 'running'); },
      poll: async current => { calls += 1; return response(current, 'dry-remote-3', 'running'); },
    };
    const result = await reconcileVideoRendererAttempt({
      event, request, adapter, workerId, leaseToken, now: BASE_TIME,
      deadlineAt: '2026-08-18T08:01:05.000Z',
      pollAt: ['2026-08-18T08:01:06.000Z'],
      retryAt: '2026-08-18T08:02:00.000Z',
    });
    assert.equal(result.event.state, 'failed');
    assert.equal(result.event.lastErrorCode, 'RENDER_TIMEOUT');
    scenarios.push(scenario('timeout', result, calls));
  }

  {
    const { request, event, workerId, leaseToken } = setup('dry-invalid');
    let rejected = false;
    try {
      await reconcileVideoRendererAttempt({
        event,
        request,
        workerId,
        leaseToken,
        now: BASE_TIME,
        adapter: {
          submit: async current => response({ ...current, requestHash: 'forged-request-hash' }, 'dry-remote-4', 'queued'),
        },
      });
    } catch (error) {
      rejected = error?.code === 'RENDER_RECONCILIATION_INVALID';
    }
    assert.equal(rejected, true);
    assert.equal(event.state, 'pending');
    assert.equal(event.attempts, 0);
    assert.equal(event.providerSubmission, false);
    assert.equal(event.billingMutation, false);
    scenarios.push({
      name: 'invalid-submit-callback',
      state: event.state,
      attempts: event.attempts,
      trace: ['claim', 'submit-rejected'],
      providerSubmission: false,
      billingMutation: false,
      adapterCalls: 1,
    });
  }

  return {
    ok: true,
    mode: 'dry-run',
    scenarios,
    providerCalls: 0,
    billingMutated: false,
  };
}

if (process.argv[1]?.endsWith('verify-video-renderer-reconciliation-dry-run.mjs')) {
  const report = await runVideoRendererReconciliationDryRun();
  console.log(JSON.stringify(report, null, 2));
}
