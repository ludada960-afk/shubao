import test from 'node:test';
import assert from 'node:assert/strict';

import { probeGateways, validateProbeSecrets } from '../scripts/probe-production-gateways.mjs';

const SECRETS = Object.freeze({
  imageApiKey: 'sk-image-test-key-that-is-long-enough',
  visionApiKey: 'vision-test-key-that-is-long-enough',
});

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() { return body; },
  };
}

test('gateway probe validates models, real image input, native task output, and returns no credentials', async () => {
  const fetchCalls = [];
  let submittedRequest;
  let visionRequest;
  const result = await probeGateways({
    ...SECRETS,
    fetchImpl: async (url, init = {}) => {
      fetchCalls.push({ url, init });
      if (url === 'https://task-api-1-cn.65535.space/v1/models') {
        return jsonResponse(200, { data: [{ id: 'gpt-image-2' }] });
      }
      if (url === 'https://puppyrouter.com/v1/models') {
        return jsonResponse(200, { data: [{ id: 'gpt-5.6-luna' }] });
      }
      if (url === 'https://cdn.example.test/probe.png') {
        return {
          ok: true,
          status: 200,
          headers: { get: name => String(name).toLowerCase() === 'content-length' ? '1024' : null },
          async arrayBuffer() { return Uint8Array.from([1, 2, 3, 4]).buffer; },
        };
      }
      throw new Error(`unexpected fetch ${url}`);
    },
    createProbeImageImpl: async () => Buffer.from('probe-image'),
    inspectImageImpl: async () => ({ format: 'png', width: 1024, height: 1024 }),
    adapterFactory: config => {
      assert.equal(config.protocol, 'native-tasks');
      assert.equal(config.baseUrl, 'https://task-api-1-cn.65535.space');
      assert.equal(config.bearerToken, SECRETS.imageApiKey);
      return {
        async submitEdit(request) {
          submittedRequest = request;
          return { jobId: 'native-probe-task', status: 'queued' };
        },
        async pollUntilReady(jobId) {
          assert.equal(jobId, 'native-probe-task');
          return {
            jobId,
            status: 'completed',
            outputUrl: 'https://cdn.example.test/probe.png',
            error: '',
          };
        },
      };
    },
    vlmFactory: config => {
      assert.equal(config.apiKey, SECRETS.visionApiKey);
      assert.equal(config.model, 'gpt-5.6-luna');
      return {
        async analyzeJson(request) {
          visionRequest = request;
          return { probe: 'ok', visibleColor: 'red' };
        },
      };
    },
    idempotencyKey: 'gateway-probe-test',
  });

  assert.equal(submittedRequest.modelRoute.model, 'gpt-image-2');
  assert.equal(submittedRequest.modelRoute.size, '1024x1024');
  assert.equal(submittedRequest.inputAssets.length, 1);
  assert.match(visionRequest.images[0], /^data:image\/png;base64,/);
  assert.deepEqual(result, {
    image: { model: 'gpt-image-2', status: 'completed', format: 'png', width: 1024, height: 1024, bytes: 4 },
    vision: { model: 'gpt-5.6-luna', status: 'completed' },
  });
  assert.equal(JSON.stringify(result).includes(SECRETS.imageApiKey), false);
  assert.equal(JSON.stringify(result).includes(SECRETS.visionApiKey), false);
  assert.equal(fetchCalls.length, 3);
});

test('gateway probe rejects missing, short, or line-breaking credentials before network access', () => {
  assert.throws(() => validateProbeSecrets({ ...SECRETS, imageApiKey: '' }), /image gateway credential/i);
  assert.throws(() => validateProbeSecrets({ ...SECRETS, visionApiKey: 'short' }), /vision gateway credential/i);
  assert.throws(
    () => validateProbeSecrets({ ...SECRETS, imageApiKey: `${SECRETS.imageApiKey}\nINJECTED=yes` }),
    /image gateway credential/i,
  );
});

test('gateway probe masks provider response details at each external stage', async () => {
  await assert.rejects(
    probeGateways({
      ...SECRETS,
      fetchImpl: async () => jsonResponse(401, { error: `do not echo ${SECRETS.imageApiKey}` }),
      createProbeImageImpl: async () => Buffer.from('probe-image'),
      inspectImageImpl: async () => ({ format: 'png', width: 1024, height: 1024 }),
    }),
    error => error.message === 'image model discovery failed'
      && !error.message.includes(SECRETS.imageApiKey)
      && !error.message.includes(SECRETS.visionApiKey),
  );
});
