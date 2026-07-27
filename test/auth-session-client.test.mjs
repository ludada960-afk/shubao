import assert from 'node:assert/strict';
import test from 'node:test';

function installStorage(session) {
  const values = new Map(session ? [['sb-auth', JSON.stringify(session)]] : []);
  globalThis.localStorage = {
    getItem: key => values.get(key) || null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key),
  };
  return values;
}

test('getSession clears a locally stored token when the server rejects it', async t => {
  const storage = installStorage({ token: 'stale-token', email: 'owner@example.com', expiresAt: '2099-01-01T00:00:00.000Z' });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ code: 'AUTH_SESSION_EXPIRED' }), { status: 401, headers: { 'content-type': 'application/json' } });
  t.after(() => { globalThis.fetch = originalFetch; });

  const auth = await import(`../src/services/auth.js?invalid=${Date.now()}`);
  const session = await auth.getSession();

  assert.equal(session, null);
  assert.equal(storage.get('sb-auth'), undefined);
});

test('getSession accepts local identity only after server validation', async t => {
  const storage = installStorage({ token: 'valid-token', email: 'old@example.com', expiresAt: '2099-01-01T00:00:00.000Z' });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_url, options) => {
    assert.equal(options.headers.Authorization, 'Bearer valid-token');
    return new Response(JSON.stringify({ ok: true, email: 'owner@example.com' }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  const auth = await import(`../src/services/auth.js?valid=${Date.now()}`);
  const session = await auth.getSession();

  assert.equal(session.email, 'owner@example.com');
  assert.equal(JSON.parse(storage.get('sb-auth')).email, 'owner@example.com');
});

test('a protected API 401 clears the shared local session before it becomes an ApiError', async () => {
  const storage = installStorage({ token: 'expired-token', email: 'owner@example.com' });
  const { createApiError } = await import(`../src/services/apiError.js?unauthorized=${Date.now()}`);

  const error = await createApiError(new Response(JSON.stringify({ code: 'AUTH_SESSION_EXPIRED', error: '登录已失效，请重新登录' }), { status: 401 }));

  assert.equal(error.code, 'AUTH_SESSION_EXPIRED');
  assert.equal(storage.get('sb-auth'), undefined);
});
