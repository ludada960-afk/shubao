/**
 * P2 前端会话集成测试：refresh 轮换 / 换发响应头捕获 / logout /
 * 静默刷新 tick / OAuth 引导落地 / getSession 401→refresh→重试
 */
import test from 'node:test';
import assert from 'node:assert/strict';

// 相对当前时钟取基准（CI 时钟不可假设），只依赖偏移量。
const NOW = Date.now();
const ACCESS_TTL_MS = 30 * 60 * 1000;

function iso(ms) { return new Date(ms).toISOString(); }

// v2 access token 形状：base64url(payload).sig（auth.js 会解 exp）
function makeAccessToken({ email = '867550189@qq.com', expOffsetMs = ACCESS_TTL_MS, at = NOW } = {}) {
  const payload = Buffer.from(JSON.stringify({
    v: 2, sub: 1, email,
    exp: Math.floor((at + expOffsetMs) / 1000),
  })).toString('base64url');
  return `${payload}.c2ln`;
}

function installStorage(seed = {}) {
  const values = new Map(Object.entries(seed));
  globalThis.localStorage = {
    getItem: key => (values.has(key) ? values.get(key) : null),
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key),
  };
  return values;
}

function seedSession(storage, { token = 'stale-access.sig', expiresAt = iso(NOW + ACCESS_TTL_MS), refresh = null } = {}) {
  storage.set('sb-auth', JSON.stringify({ token, expiresAt, email: '867550189@qq.com', nickname: '' }));
  if (refresh) {
    storage.set('sb-auth-refresh', JSON.stringify({ refreshToken: refresh, refreshExpiresAt: iso(NOW + 7 * 86400000), email: '867550189@qq.com' }));
  }
}

async function importAuth(tag) {
  return import(`../src/services/auth.js?p2fe=${tag}`);
}

test('verifyOTP persists both access and refresh credentials', async t => {
  const storage = installStorage();
  const originalFetch = globalThis.fetch;
  const at = Date.now();
  globalThis.fetch = async () => new Response(JSON.stringify({
    ok: true, id: 1, email: '867550189@qq.com', token: makeAccessToken({ at }), expiresAt: iso(at + ACCESS_TTL_MS),
    refreshToken: 'refresh-gen-1', refreshExpiresAt: iso(at + 7 * 86400000),
  }), { status: 200, headers: { 'content-type': 'application/json' } });
  t.after(() => { globalThis.fetch = originalFetch; });

  const auth = await importAuth(`a${Date.now()}`);
  await auth.verifyOTP('867550189@qq.com', '123456');

  assert.ok(JSON.parse(storage.get('sb-auth')).token);
  const refresh = JSON.parse(storage.get('sb-auth-refresh'));
  assert.equal(refresh.refreshToken, 'refresh-gen-1');
});

test('refreshSession rotates tokens and a replayed refresh wipes everything', async t => {
  const storage = installStorage();
  seedSession(storage, { refresh: 'refresh-gen-1' });
  const originalFetch = globalThis.fetch;
  const calls = [];
  let mode = 'rotate';
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), body: options ? String(options.body) : '' });
    if (mode === 'rotate') {
      return new Response(JSON.stringify({
        ok: true, email: '867550189@qq.com', token: 'access-2.sig',
        expiresAt: iso(Date.now() + ACCESS_TTL_MS), refreshToken: 'refresh-gen-2',
        refreshExpiresAt: iso(Date.now() + 7 * 86400000),
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    return new Response(JSON.stringify({ ok: false, code: 'AUTH_SESSION_REPLAY', error: '检测到令牌重用' }), {
      status: 401, headers: { 'content-type': 'application/json' },
    });
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  const auth = await importAuth(`b${Date.now()}`);

  const first = await auth.refreshSession();
  assert.equal(first, true);
  assert.equal(calls[0].body.includes('refresh-gen-1'), true);
  assert.equal(JSON.parse(storage.get('sb-auth')).token, 'access-2.sig');
  assert.equal(JSON.parse(storage.get('sb-auth-refresh')).refreshToken, 'refresh-gen-2');

  // 重放旧代 → family 吊销，本地凭据全部清除并广播下线
  let invalidated = 0;
  auth.onSessionInvalid(() => { invalidated += 1; });
  storage.set('sb-auth-refresh', JSON.stringify({ refreshToken: 'refresh-gen-old', refreshExpiresAt: '' }));
  mode = 'replay';
  const second = await auth.refreshSession();
  assert.equal(second, false);
  assert.equal(invalidated, 1);
  assert.equal(storage.get('sb-auth'), undefined);
  assert.equal(storage.get('sb-auth-refresh'), undefined);
});

test('x-shubao renewal headers are captured into local storage by handleSessionResponse', async t => {
  installStorage();
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  const auth = await importAuth(`c${Date.now()}`);

  const response = new Response('{}', {
    status: 200,
    headers: {
      'content-type': 'application/json',
      'x-shubao-access-token': makeAccessToken(),
      'x-shubao-refresh-token': 'renewed-refresh',
      'x-shubao-session-renewed': '1',
    },
  });
  auth.handleSessionResponse(response);

  const stored = JSON.parse(globalThis.localStorage.getItem('sb-auth'));
  assert.equal(stored.token.startsWith('ey'), stored.token.startsWith('e'), 'token 已入库');
  assert.equal(JSON.parse(globalThis.localStorage.getItem('sb-auth-refresh')).refreshToken, 'renewed-refresh');
});

test('logout revokes server side and always clears local credentials', async t => {
  const storage = installStorage();
  seedSession(storage, { refresh: 'refresh-to-kill' });
  const originalFetch = globalThis.fetch;
  const bodies = [];
  globalThis.fetch = async (url, options) => {
    bodies.push(options ? String(options.body) : '');
    return new Response(JSON.stringify({ ok: true, revoked: 1 }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  const auth = await importAuth(`d${Date.now()}`);
  await auth.logout();

  assert.equal(bodies[0].includes('refresh-to-kill'), true);
  assert.equal(storage.get('sb-auth'), undefined);
  assert.equal(storage.get('sb-auth-refresh'), undefined);
});

test('auto refresh tick only fires near expiry and stays quiet otherwise', async t => {
  const storage = installStorage();
  const originalFetch = globalThis.fetch;
  let fetchCount = 0;
  globalThis.fetch = async () => {
    fetchCount += 1;
    return new Response(JSON.stringify({
      ok: true, email: '867550189@qq.com', token: 'access-new.sig',
      expiresAt: iso(Date.now() + ACCESS_TTL_MS), refreshToken: 'refresh-new',
      refreshExpiresAt: iso(Date.now() + 7 * 86400000),
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  const auth = await importAuth(`e${Date.now()}`);

  // 远未过期 → 不发请求
  seedSession(storage, {
    token: makeAccessToken({ expOffsetMs: 25 * 60 * 1000 }),
    expiresAt: iso(Date.now() + 25 * 60 * 1000),
    refresh: 'refresh-current',
  });
  assert.equal(await auth.runSessionAutoRefreshTick(), false);
  assert.equal(fetchCount, 0);

  // 临期 5 分钟内 → 触发轮换
  seedSession(storage, {
    token: makeAccessToken({ expOffsetMs: 4 * 60 * 1000 }),
    expiresAt: iso(Date.now() + 4 * 60 * 1000),
    refresh: 'refresh-current',
  });
  assert.equal(await auth.runSessionAutoRefreshTick(), true);
  assert.equal(fetchCount, 1);
  assert.equal(JSON.parse(storage.get('sb-auth')).token, 'access-new.sig');
});

test('adoptOauthBootstrap claims the oauth callback payload exactly once', async t => {
  const storage = installStorage({
    'sb-oauth-payload': JSON.stringify({
      ok: true, provider: 'github', isNewIdentity: true,
      token: makeAccessToken(), expiresAt: iso(NOW + ACCESS_TTL_MS),
      refreshToken: 'oauth-refresh', refreshExpiresAt: iso(NOW + 7 * 86400000),
      email: '867550189@qq.com', nickname: 'Octo Cat',
    }),
  });
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  const auth = await importAuth(`f${Date.now()}`);

  const session = auth.adoptOauthBootstrap();
  assert.equal(session.email, '867550189@qq.com');
  assert.equal(session.token.includes('.'), true);
  assert.equal(JSON.parse(storage.get('sb-auth-refresh')).refreshToken, 'oauth-refresh');
  assert.equal(storage.get('sb-oauth-payload'), undefined, 'payload 必须一次性领取即删');
  assert.equal(auth.adoptOauthBootstrap(), null);
});

test('getSession recovers from an expired access token via silent refresh then retry', async t => {
  const storage = installStorage();
  seedSession(storage, { token: makeAccessToken({ expOffsetMs: -1000 }), refresh: 'refresh-live' });
  const originalFetch = globalThis.fetch;
  const hits = [];
  globalThis.fetch = async (url, options) => {
    hits.push(String(url));
    if (String(url).endsWith('/api/session')) {
      const authHeader = options?.headers?.Authorization || '';
      if (authHeader.includes('fresh-access')) {
        return new Response(JSON.stringify({ ok: true, email: '867550189@qq.com' }), {
          status: 200, headers: { 'content-type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ ok: false, code: 'AUTH_SESSION_EXPIRED' }), {
        status: 401, headers: { 'content-type': 'application/json' },
      });
    }
    if (String(url).endsWith('/api/auth/refresh')) {
      return new Response(JSON.stringify({
        ok: true, email: '867550189@qq.com', token: 'fresh-access.sig',
        expiresAt: iso(Date.now() + ACCESS_TTL_MS), refreshToken: 'refresh-next',
        refreshExpiresAt: iso(Date.now() + 7 * 86400000),
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    return new Response('{}', { status: 404 });
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  const auth = await importAuth(`g${Date.now()}`);
  const session = await auth.getSession();

  assert.equal(session.email, '867550189@qq.com', '401 后经 refresh 续期重试成功');
  assert.equal(hits.filter(u => u.endsWith('/api/auth/refresh')).length, 1);
  assert.equal(JSON.parse(storage.get('sb-auth')).token, 'fresh-access.sig');
  assert.equal(JSON.parse(storage.get('sb-auth-refresh')).refreshToken, 'refresh-next');
});