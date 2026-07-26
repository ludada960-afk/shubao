import test from 'node:test';
import assert from 'node:assert/strict';

import { createProviderAdapter } from '../server/ecommerceEngine/providerAdapter.mjs';

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() { return body; },
    async text() { return JSON.stringify(body); },
  };
}

function editRequest() {
  return {
    prompt: '{"role":"main","objective":"sell the real product"}',
    modelRoute: { model: 'gpt-image-2', size: '2048x2048', async: true, mode: 'edit' },
    inputAssets: [
      { buffer: Buffer.from('first-image'), contentType: 'image/png', fileName: 'product.png' },
      { buffer: Buffer.from('second-image'), contentType: 'image/jpeg', fileName: 'reference.jpg' },
    ],
  };
}

test('submits indexed multipart edits with async mode and bearer auth only', async () => {
  let captured;
  const adapter = createProviderAdapter({
    baseUrl: 'https://images.example.test/',
    bearerToken: 'bearer-secret',
    fetchImpl: async (url, init) => {
      captured = { url, init };
      return jsonResponse(202, { id: 'provider-job-1', status: 'queued' });
    },
  });

  const submitted = await adapter.submitEdit(editRequest());

  assert.equal(submitted.jobId, 'provider-job-1');
  assert.equal(submitted.status, 'queued');
  assert.equal(captured.url, 'https://images.example.test/v1/images/edits');
  assert.equal(captured.init.method, 'POST');
  assert.equal(captured.init.headers.Authorization, 'Bearer bearer-secret');
  assert.equal(captured.init.headers['X-Async-Mode'], 'true');
  assert.equal(Object.hasOwn(captured.init.headers, 'x-api-key'), false);
  assert.equal(Object.keys(captured.init.headers).some(key => key.toLowerCase() === 'content-type'), false);
  assert.equal(captured.init.body instanceof FormData, true);
  assert.equal(captured.init.body.get('model'), 'gpt-image-2');
  assert.equal(captured.init.body.get('size'), '2048x2048');
  assert.equal(captured.init.body.get('prompt'), editRequest().prompt);
  assert.equal(captured.init.body.getAll('image[0]').length, 1);
  assert.equal(captured.init.body.getAll('image[1]').length, 1);
  assert.equal(captured.init.body.getAll('image[2]').length, 0);
});

test('supports x-api-key auth without also sending bearer auth', async () => {
  let headers;
  const adapter = createProviderAdapter({
    baseUrl: 'https://images.example.test',
    apiKey: 'header-secret',
    authStrategy: 'x-api-key',
    fetchImpl: async (_url, init) => {
      headers = init.headers;
      return jsonResponse(202, { job_id: 'provider-job-2', status: 'pending' });
    },
  });

  const submitted = await adapter.submitEdit(editRequest());

  assert.equal(submitted.jobId, 'provider-job-2');
  assert.equal(headers['x-api-key'], 'header-secret');
  assert.equal(Object.hasOwn(headers, 'Authorization'), false);
});

test('rejects ambiguous auth and more than ten image inputs before fetch', () => {
  assert.throws(() => createProviderAdapter({
    baseUrl: 'https://images.example.test',
    bearerToken: 'one',
    apiKey: 'two',
    authStrategy: 'bearer',
  }), /exactly one|auth/i);

  const adapter = createProviderAdapter({
    baseUrl: 'https://images.example.test',
    bearerToken: 'one',
    fetchImpl: async () => { throw new Error('fetch must not run'); },
  });
  const request = editRequest();
  request.inputAssets = Array.from({ length: 11 }, (_, index) => ({
    buffer: Buffer.from(`image-${index}`),
    contentType: 'image/png',
    fileName: `${index}.png`,
  }));
  assert.rejects(adapter.submitEdit(request), /10 images/i);
});

test('normalizes queued running completed and failed polling results', async () => {
  const responses = [
    { task_id: 'job-3', status: 'pending' },
    { task_id: 'job-3', status: 'processing' },
    { task_id: 'job-3', status: 'succeeded', data: [{ url: 'https://cdn.example.test/result.png' }] },
    { task_id: 'job-3', status: 'error', error: { message: 'moderated' } },
  ];
  const adapter = createProviderAdapter({
    baseUrl: 'https://images.example.test',
    bearerToken: 'one',
    fetchImpl: async () => jsonResponse(200, responses.shift()),
  });

  assert.equal((await adapter.poll('job-3')).status, 'queued');
  assert.equal((await adapter.poll('job-3')).status, 'running');
  assert.deepEqual(await adapter.poll('job-3'), {
    jobId: 'job-3',
    status: 'completed',
    outputUrl: 'https://cdn.example.test/result.png',
    error: '',
  });
  assert.deepEqual(await adapter.poll('job-3'), {
    jobId: 'job-3',
    status: 'failed',
    outputUrl: '',
    error: 'moderated',
  });
});

test('treats a 504 response carrying a provider job id as recoverable', async () => {
  const adapter = createProviderAdapter({
    baseUrl: 'https://images.example.test',
    bearerToken: 'one',
    maxSubmitAttempts: 1,
    fetchImpl: async () => jsonResponse(504, { id: 'provider-job-timeout', status: 'processing' }),
  });

  assert.deepEqual(await adapter.submitEdit(editRequest()), {
    jobId: 'provider-job-timeout',
    status: 'running',
    recoverable: true,
  });
});

test('pollUntilReady stops at completion and never resubmits the edit', async () => {
  let submitCalls = 0;
  let pollCalls = 0;
  const adapter = createProviderAdapter({
    baseUrl: 'https://images.example.test',
    bearerToken: 'one',
    pollIntervalMs: 0,
    sleep: async () => {},
    fetchImpl: async (url) => {
      if (url.endsWith('/v1/images/edits')) {
        submitCalls += 1;
        return jsonResponse(202, { id: 'provider-job-4', status: 'queued' });
      }
      pollCalls += 1;
      return pollCalls === 1
        ? jsonResponse(200, { id: 'provider-job-4', status: 'running' })
        : jsonResponse(200, { id: 'provider-job-4', status: 'completed', output_url: 'https://cdn.example.test/final.webp' });
    },
  });

  const submitted = await adapter.submitEdit(editRequest());
  const completed = await adapter.pollUntilReady(submitted.jobId, { maxPolls: 3 });

  assert.equal(submitCalls, 1);
  assert.equal(pollCalls, 2);
  assert.equal(completed.outputUrl, 'https://cdn.example.test/final.webp');
});
