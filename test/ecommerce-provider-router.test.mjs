import test from 'node:test';
import assert from 'node:assert/strict';

import { createProviderRouter } from '../server/ecommerceEngine/providerRouter.mjs';

function adapter({ submit, poll }) {
  return {
    submitEdit: submit,
    poll: poll || (async jobId => ({ jobId, status: 'completed', outputUrl: `https://cdn.test/${jobId}.png` })),
    pollUntilReady: async jobId => (poll || (async id => ({ jobId: id, status: 'completed' })))(jobId),
  };
}

test('uses overflow only when primary fails before acknowledgement with a network error', async () => {
  const calls = [];
  const router = createProviderRouter({
    primary: adapter({ submit: async () => { calls.push('primary'); throw Object.assign(new Error('connect failed'), { code: 'PROVIDER_NETWORK_ERROR', retryable: true }); } }),
    overflow: adapter({ submit: async () => { calls.push('overflow'); return { jobId: 'job-2', status: 'queued' }; } }),
  });

  assert.deepEqual(await router.submitEdit({}), { jobId: 'overflow:job-2', status: 'queued' });
  assert.deepEqual(calls, ['primary', 'overflow']);
});

test('supports a primary-only provider when no protocol-compatible overflow exists', async () => {
  const calls = [];
  const router = createProviderRouter({
    primary: adapter({
      submit: async () => {
        calls.push('primary');
        return { jobId: 'job-primary', status: 'queued' };
      },
      poll: async id => ({ jobId: id, status: 'completed' }),
    }),
  });

  assert.deepEqual(await router.submitEdit({}), { jobId: 'primary:job-primary', status: 'queued' });
  assert.deepEqual(await router.poll('primary:job-primary'), {
    jobId: 'primary:job-primary',
    status: 'completed',
  });
  assert.deepEqual(calls, ['primary']);
});

test('does not evade provider rate limits or accepted jobs through overflow', async () => {
  let overflowCalls = 0;
  for (const error of [
    Object.assign(new Error('slow down'), { status: 429, code: 'PROVIDER_ERROR', retryable: true }),
    Object.assign(new Error('accepted timeout'), { status: 504, code: 'PROVIDER_ERROR', retryable: true, jobId: 'accepted-1' }),
  ]) {
    const router = createProviderRouter({
      primary: adapter({ submit: async () => { throw error; } }),
      overflow: adapter({ submit: async () => { overflowCalls += 1; return { jobId: 'wrong', status: 'queued' }; } }),
    });
    await assert.rejects(() => router.submitEdit({}), candidate => candidate === error);
  }
  assert.equal(overflowCalls, 0);
});

test('keeps durable provider affinity in the routed job id for polling', async () => {
  const calls = [];
  const router = createProviderRouter({
    primary: adapter({ submit: async () => ({ jobId: 'unused' }), poll: async id => { calls.push(`primary:${id}`); return { jobId: id, status: 'running' }; } }),
    overflow: adapter({ submit: async () => ({ jobId: 'unused' }), poll: async id => { calls.push(`overflow:${id}`); return { jobId: id, status: 'completed' }; } }),
  });

  assert.deepEqual(await router.poll('overflow:job-7'), { jobId: 'overflow:job-7', status: 'completed' });
  assert.deepEqual(calls, ['overflow:job-7']);
});

test('polls unprefixed historical jobs through the legacy provider when configured', async () => {
  const calls = [];
  const router = createProviderRouter({
    primary: adapter({ submit: async () => ({ jobId: 'new-job' }), poll: async id => { calls.push(`primary:${id}`); return { jobId: id, status: 'running' }; } }),
    overflow: adapter({ submit: async () => ({ jobId: 'overflow-job' }) }),
    legacy: adapter({ submit: async () => ({ jobId: 'legacy-submit-unused' }), poll: async id => { calls.push(`legacy:${id}`); return { jobId: id, status: 'completed' }; } }),
  });

  assert.deepEqual(await router.poll('historical-job-9'), { jobId: 'historical-job-9', status: 'completed' });
  assert.deepEqual(calls, ['legacy:historical-job-9']);
});
