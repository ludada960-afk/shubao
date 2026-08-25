/**
 * P2 GitHub OAuth 回调 E2E（mock 上游）+ state 防 CSRF + 身份归并
 *
 * 真实 GitHub OAuth 无法本地验证：用注入 fetchImpl 的 mock 上游完整走通
 * authorize(302/state) → callback(换 token/profile) → auth_identities 落库 → 会话签发。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import Database from 'better-sqlite3';
import express from 'express';

import { ensureAccessSchema, bootstrapDefaultAccountAccess, requireAccountAccess } from '../server/accessControl.mjs';
import { ensureAuthSchema, migrateAccountAccessToAuthUsers } from '../server/auth/authSchema.mjs';
import { createAuthService } from '../server/auth/authService.mjs';
import { createOAuthStore } from '../server/auth/oauthStore.mjs';
import { mountAuthRoutes } from '../server/authRoutes.mjs';
import { createProviderRegistry } from '../server/auth/providerRegistry.mjs';
import { createGithubProvider } from '../server/auth/providers/githubProvider.mjs';

const SECRET = 'p2-oauth-e2e-secret-p2-oauth-e2e-secret-32+';

let mockUpstreamState;
function resetMockUpstream() {
  mockUpstreamState = {
    profile: { id: 9001, login: 'octocat', name: 'Octo Cat', email: null, avatar_url: 'https://avatars/u.png' },
    emails: [{ email: '867550189@qq.com', primary: true, verified: true }],
    failToken: false,
  };
}
resetMockUpstream();

async function startMockUpstream() {
  const server = http.createServer((req, res) => {
    const sendJson = (status, payload) => {
      res.writeHead(status, { 'content-type': 'application/json' });
      res.end(JSON.stringify(payload));
    };
    if (req.url.startsWith('/login/oauth/access_token')) {
      if (mockUpstreamState.failToken) return sendJson(500, { error: 'bad_verification_code' });
      return sendJson(200, { access_token: 'gho_mock_token', scope: 'read:user' });
    }
    if (req.url.startsWith('/api/user')) {
      if (req.url.includes('/emails')) return sendJson(200, mockUpstreamState.emails);
      return sendJson(200, mockUpstreamState.profile);
    }
    res.writeHead(404);
    res.end();
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  return {
    origin,
    close: () => new Promise(resolve => server.close(resolve)),
    rewrite: (url, options) => fetch(String(url)
      .replace('https://github.com', origin)
      .replace('https://api.github.com', `${origin}/api`), options),
  };
}

async function createHarness(t) {
  const db = new Database(':memory:');
  ensureAccessSchema(db);
  bootstrapDefaultAccountAccess(db);
  ensureAuthSchema(db);
  migrateAccountAccessToAuthUsers(db);
  const authService = createAuthService({ db, secret: SECRET });
  const oauthStore = createOAuthStore(db, {
    ensureUserByEmail: (email, options) => authService.ensureUserByEmail(email, options),
  });
  const upstream = await startMockUpstream();
  const github = createGithubProvider({
    clientId: 'mock-client-id',
    clientSecret: 'mock-client-secret',
    fetchImpl: upstream.rewrite,
  });
  const registry = createProviderRegistry({ db, providers: [github], env: {} });
  const app = express();
  app.use(express.json());
  mountAuthRoutes(app, {
    authService,
    requireAccess: email => requireAccountAccess(db, email),
    providers: registry,
    oauthStore,
  });
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => {
    await new Promise(resolve => server.close(resolve));
    await upstream.close();
    db.close();
  });
  return { db, authService, oauthStore, baseUrl };
}

async function getRedirect(baseUrl, path) {
  const res = await fetch(`${baseUrl}${path}`, { redirect: 'manual' });
  return { status: res.status, location: res.headers.get('location') || '' };
}

async function getJson(baseUrl, path) {
  const res = await fetch(`${baseUrl}${path}`);
  return {
    status: res.status,
    body: await res.json().catch(() => null),
    contentType: res.headers.get('content-type') || '',
  };
}

async function issueAuthorize(baseUrl) {
  const { status, location } = await getRedirect(baseUrl, '/api/auth/oauth/github/authorize');
  assert.equal(status, 302);
  const url = new URL(location);
  assert.equal(url.origin + url.pathname, 'https://github.com/login/oauth/authorize');
  assert.equal(url.searchParams.get('client_id'), 'mock-client-id');
  return { location, state: url.searchParams.get('state') };
}

test('providers endpoint exposes configured github and nothing else', async t => {
  resetMockUpstream();
  const h = await createHarness(t);
  const { body } = await getJson(h.baseUrl, '/api/auth/providers');
  assert.equal(body.ok, true);
  assert.deepEqual(body.providers.map(p => p.id), ['github']);
  assert.equal(body.providers[0].mode, 'oauth2');
});

test('unknown or unconfigured provider authorizations 404', async t => {
  resetMockUpstream();
  const h = await createHarness(t);
  const res = await getJson(h.baseUrl, '/api/auth/oauth/wechat_open/authorize');
  assert.equal(res.status, 404);
  assert.equal(res.body.code, 'AUTH_PROVIDER_UNAVAILABLE');
  const ghost = await getJson(h.baseUrl, '/api/auth/oauth/twitter/authorize');
  assert.equal(ghost.status, 404);
});

test('full github oauth e2e: state CSRF gate then session issuance', async t => {
  resetMockUpstream();
  const h = await createHarness(t);
  const { state } = await issueAuthorize(h.baseUrl);

  // 被篡改的 state → 拒绝（CSRF）
  const bad = await getJson(h.baseUrl, '/api/auth/oauth/github/callback?response=json&code=c1&state=tampered');
  assert.equal(bad.status, 403);
  assert.equal(bad.body.code, 'AUTH_OAUTH_STATE_INVALID');

  // 正确 state → 换 profile、auth_identities 落库、签发可吊销会话
  const done = await getJson(h.baseUrl, `/api/auth/oauth/github/callback?response=json&code=good-code&state=${encodeURIComponent(state)}`);
  assert.equal(done.status, 200);
  assert.equal(done.body.ok, true);
  assert.equal(done.body.isNewIdentity, true);
  assert.equal(done.body.provider, 'github');
  const verified = h.authService.verifyAccessToken(done.body.token);
  assert.equal(verified.email, '867550189@qq.com');

  const identity = h.db.prepare('SELECT * FROM auth_identities WHERE provider = ?').get('github');
  assert.equal(identity.provider_account_id, '9001');
  assert.equal(identity.email, '867550189@qq.com');
  assert.equal(identity.user_id, verified.userId);

  // 同一 state 重放 → 单次消费后拒绝
  const replay = await getJson(h.baseUrl, `/api/auth/oauth/github/callback?response=json&code=good-code&state=${encodeURIComponent(state)}`);
  assert.equal(replay.status, 403);
  assert.equal(replay.body.code, 'AUTH_OAUTH_STATE_INVALID');
});

test('repeat logins reuse the same identity row instead of duplicating it', async t => {
  resetMockUpstream();
  const h = await createHarness(t);
  const first = await issueAuthorize(h.baseUrl);
  const a = await getJson(h.baseUrl, `/api/auth/oauth/github/callback?response=json&code=c&state=${encodeURIComponent(first.state)}`);
  const second = await issueAuthorize(h.baseUrl);
  const b = await getJson(h.baseUrl, `/api/auth/oauth/github/callback?response=json&code=c&state=${encodeURIComponent(second.state)}`);
  assert.equal(a.body.ok && b.body.ok, true);
  assert.equal(b.body.isNewIdentity, false);
  const rows = h.db.prepare('SELECT * FROM auth_identities WHERE provider = ?').all('github');
  assert.equal(rows.length, 1);
  assert.ok(rows[0].last_login_at, '重复登录必须刷新 last_login_at');
});

test('callback defaults to same-origin html bootstrap page carrying the session', async t => {
  resetMockUpstream();
  const h = await createHarness(t);
  const { state } = await issueAuthorize(h.baseUrl);
  const res = await fetch(`${h.baseUrl}/api/auth/oauth/github/callback?code=c&state=${encodeURIComponent(state)}`);
  assert.match(res.headers.get('content-type') || '', /text\/html/);
  const html = await res.text();
  assert.ok(html.includes('sb-oauth-payload'), '引导页必须写入约定的 localStorage key');
  assert.ok(html.includes('location.replace'), '引导页必须跳回应用');
});

test('oauth identities merge by unionid across provider accounts (unionid 归并预留)', async t => {
  resetMockUpstream();
  const h = await createHarness(t);
  const first = h.oauthStore.upsertIdentity({
    provider: 'github', providerAccountId: '9001', unionid: 'union-U', email: '867550189@qq.com', emailVerified: true,
  });
  const second = h.oauthStore.upsertIdentity({
    provider: 'wechat_open', providerAccountId: 'wx-9', unionid: 'union-U', email: '', emailVerified: false,
  });
  assert.equal(second.user.id, first.user.id, '同 unionid 必须落到同一用户');

  // 已验证邮箱命中既有账号 → 归并到该用户
  const third = h.oauthStore.upsertIdentity({
    provider: 'wecom', providerAccountId: 'ww-1', unionid: '', email: '240485042@qq.com', emailVerified: true,
  });
  assert.equal(third.user.email, '240485042@qq.com');

  // 未验证邮箱不得归并既有账号（防劫持）→ 生成隔离占位用户
  const fourth = h.oauthStore.upsertIdentity({
    provider: 'github', providerAccountId: '7777', unionid: '', email: '240485042@qq.com', emailVerified: false,
  });
  assert.notEqual(fourth.user.id, third.user.id);
  assert.match(fourth.user.email, /@github\.oauth\.local$/);
});

test('oauth login respects the account access gate (stranger denied)', async t => {
  resetMockUpstream();
  mockUpstreamState.emails = [{ email: 'stranger@example.com', primary: true, verified: true }];
  const h = await createHarness(t);
  const { state } = await issueAuthorize(h.baseUrl);
  const res = await getJson(h.baseUrl, `/api/auth/oauth/github/callback?response=json&code=c&state=${encodeURIComponent(state)}`);
  assert.equal(res.status, 403);
  assert.equal(res.body.code, 'ACCOUNT_NOT_ALLOWED');
});

test('upstream token failure surfaces a coded 502', async t => {
  resetMockUpstream();
  mockUpstreamState.failToken = true;
  const h = await createHarness(t);
  const { state } = await issueAuthorize(h.baseUrl);
  const res = await getJson(h.baseUrl, `/api/auth/oauth/github/callback?response=json&code=c&state=${encodeURIComponent(state)}`);
  assert.equal(res.status, 502);
  assert.equal(res.body.code, 'AUTH_OAUTH_UPSTREAM_FAILED');
});
