import assert from 'node:assert/strict';
import test from 'node:test';

import {
  consumeRecoveryCheckpoint,
  dismissRecoveryCheckpoint,
  listRecoveryCheckpoints,
} from '../src/services/projects.js';
import { onSessionInvalid } from '../src/services/auth.js';

function installSession(token = 'signed-project-session') {
  const values = new Map([['sb-auth', JSON.stringify({ token })]]);
  globalThis.localStorage = {
    getItem: key => values.get(key) || null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key),
  };
  return values;
}

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

test('lists recovery checkpoints with the signed session and returns an array', async t => {
  installSession();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options = {}) => {
    assert.equal(url, '/api/recovery-checkpoints');
    assert.equal(options.method, undefined);
    assert.equal(options.headers.Authorization, 'Bearer signed-project-session');
    return jsonResponse({ checkpoints: [{ id: 'checkpoint-1', reason: 'generation_interrupted' }] });
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  const checkpoints = await listRecoveryCheckpoints();

  assert.deepEqual(checkpoints, [{ id: 'checkpoint-1', reason: 'generation_interrupted' }]);
});

test('consumes and dismisses URL-encoded recovery checkpoints', async t => {
  installSession();
  const requests = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options = {}) => {
    requests.push({ url, options });
    return jsonResponse({ checkpoint: { id: 'checkpoint / 1', status: options.method === 'POST' ? 'consumed' : '' } });
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  const consumed = await consumeRecoveryCheckpoint('checkpoint / 1');
  const dismissed = await dismissRecoveryCheckpoint('checkpoint / 1');

  assert.equal(consumed.status, 'consumed');
  assert.equal(dismissed.status, 'consumed');
  assert.deepEqual(requests.map(({ url, options }) => ({
    url,
    method: options.method,
    authorization: options.headers.Authorization,
  })), [
    {
      url: '/api/recovery-checkpoints/checkpoint%20%2F%201/consume',
      method: 'POST',
      authorization: 'Bearer signed-project-session',
    },
    {
      url: '/api/recovery-checkpoints/checkpoint%20%2F%201/dismiss',
      method: 'POST',
      authorization: 'Bearer signed-project-session',
    },
  ]);
});

test('rejects empty or invalid checkpoint IDs before sending a request', async t => {
  installSession();
  const originalFetch = globalThis.fetch;
  let called = false;
  globalThis.fetch = async () => {
    called = true;
    return jsonResponse({});
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  await assert.rejects(consumeRecoveryCheckpoint('  '), /请选择有效的未完成任务/);
  await assert.rejects(dismissRecoveryCheckpoint('\u0000checkpoint'), /请选择有效的未完成任务/);

  assert.equal(called, false);
});

test('a recovery client 401 uses the shared session invalidation path', async t => {
  const storage = installSession('expired-project-session');
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => jsonResponse({ code: 'SESSION_INVALID', error: '登录已失效，请重新登录' }, 401);
  const unsubscribe = onSessionInvalid(() => { invalidations += 1; });
  let invalidations = 0;
  t.after(() => {
    unsubscribe();
    globalThis.fetch = originalFetch;
  });

  await assert.rejects(listRecoveryCheckpoints(), error => {
    assert.equal(error.status, 401);
    assert.equal(error.code, 'SESSION_INVALID');
    return true;
  });

  assert.equal(storage.get('sb-auth'), undefined);
  assert.equal(invalidations, 1);
});
