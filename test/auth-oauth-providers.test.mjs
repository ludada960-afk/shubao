/**
 * P2 Provider 抽象层与注册表门控单测
 *
 * - 未配置凭据的 GitHub 不出现在 /api/auth/providers（按钮隐藏）
 * - env 凭据齐备后暴露；provider_configs.enabled=0 可强制下线
 * - wechat_open / wecom 占位适配器：provider_configs 表 enabled=1 且带齐
 *   clientId/clientSecret 才暴露；authorizeUrl/handleCallback 有守卫
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';

import { ensureAccessSchema } from '../server/accessControl.mjs';
import { ensureAuthSchema, migrateAccountAccessToAuthUsers } from '../server/auth/authSchema.mjs';
import { createProviderRegistry } from '../server/auth/providerRegistry.mjs';
import { createGithubProvider } from '../server/auth/providers/githubProvider.mjs';
import { createWechatOpenProvider, createWecomProvider } from '../server/auth/providers/placeholderProviders.mjs';
import { OAuth2Provider } from '../server/auth/providers/oauth2Provider.mjs';

function makeDb() {
  const db = new Database(':memory:');
  ensureAccessSchema(db);
  ensureAuthSchema(db);
  migrateAccountAccessToAuthUsers(db);
  return db;
}

test('unconfigured providers stay hidden from the public list', () => {
  const db = makeDb();
  const registry = createProviderRegistry({ db, env: {} });
  assert.deepEqual(registry.listAvailable(), [], '无凭据时必须一个都不返回');
});

test('github stays dormant until env credentials exist', () => {
  const db = makeDb();
  const registry = createProviderRegistry({
    db,
    env: { GITHUB_OAUTH_CLIENT_ID: '', GITHUB_OAUTH_CLIENT_SECRET: '' },
  });
  assert.equal(registry.get('github')?.id, 'github', 'provider 已注册');
  assert.equal(registry.getAvailable('github'), null, '但未配置即不可用');
});

test('github with credentials is exposed and produces a compliant authorize url', () => {
  const db = makeDb();
  const github = createGithubProvider({ clientId: 'cid-1', clientSecret: 'sec-1' });
  const registry = createProviderRegistry({ db, providers: [github], env: {} });

  const listed = registry.listAvailable();
  assert.deepEqual(listed.map(item => item.id), ['github']);
  assert.equal(listed[0].mode, 'oauth2');
  assert.equal(listed[0].label, 'GitHub');
  assert.equal(listed[0].authorizePath, '/api/auth/oauth/github/authorize');

  const url = new URL(github.authorizeUrl('state-abc', {
    redirectUri: 'https://app.example.com/api/auth/oauth/github/callback',
  }));
  assert.equal(url.origin + url.pathname, 'https://github.com/login/oauth/authorize');
  assert.equal(url.searchParams.get('client_id'), 'cid-1');
  assert.equal(url.searchParams.get('state'), 'state-abc');
  assert.equal(url.searchParams.get('response_type'), 'code');
  assert.ok(String(url.searchParams.get('scope')).includes('user:email'));
  assert.equal(url.searchParams.get('redirect_uri'), 'https://app.example.com/api/auth/oauth/github/callback');

  // provider_configs.enabled=0 强制下线（即使凭据齐备）
  db.prepare("INSERT INTO provider_configs (provider, enabled) VALUES ('github', 0)").run();
  assert.deepEqual(registry.listAvailable(), []);
  assert.equal(registry.getAvailable('github'), null);
});

test('placeholder wechat adapters expose only through provider_configs enabled rows', async () => {
  const db = makeDb();
  const wechat = createWechatOpenProvider();
  const wecom = createWecomProvider();
  const registry = createProviderRegistry({ db, providers: [wechat, wecom], env: {} });
  assert.deepEqual(registry.listAvailable(), [], '当前无凭据 = 隐藏');

  db.prepare(
    "INSERT INTO provider_configs (provider, enabled, config_json) VALUES ('wechat_open', 1, '{\"clientId\":\"wx-app\",\"clientSecret\":\"wx-secret\"}')",
  ).run();
  const listed = registry.listAvailable();
  assert.deepEqual(listed.map(item => item.id), ['wechat_open']);
  assert.equal(listed[0].mode, 'config-gated');

  const url = new URL(wechat.authorizeUrl('st-1', { redirectUri: 'https://a.b/cb' }));
  assert.equal(url.searchParams.get('appid'), 'wx-app');
  assert.equal(url.searchParams.get('state'), 'st-1');
  await assert.rejects(
    () => wechat.handleCallback({ code: 'x' }, {}),
    error => error.code === 'AUTH_PROVIDER_NOT_IMPLEMENTED',
    '占位适配器的回调必须显式拒绝',
  );

  // enabled 但缺凭据仍隐藏
  db.prepare("INSERT INTO provider_configs (provider, enabled, config_json) VALUES ('wecom', 1, '{}')").run();
  assert.equal(registry.getAvailable('wecom'), null);
});

test('oauth2 base class guards unavailable providers and normalizes profiles via subclass', async () => {
  const bare = new OAuth2Provider({
    id: 'bare',
    authorizeEndpoint: 'https://up.example/authorize',
    tokenEndpoint: 'https://up.example/token',
  });
  assert.equal(bare.available(), false);
  assert.throws(() => bare.authorizeUrl('s'), error => error.code === 'AUTH_PROVIDER_UNAVAILABLE');

  const calls = [];
  const provider = new OAuth2Provider({
    id: 'generic',
    clientId: 'c',
    clientSecret: 's',
    scope: 'openid',
    authorizeEndpoint: 'https://up.example/authorize',
    tokenEndpoint: 'https://up.example/token',
    fetchImpl: async (url, options) => {
      calls.push({ url: String(url), method: options?.method, body: String(options?.body || '') });
      const payload = String(url).endsWith('/me')
        ? { sub: 'u-42', email: 'u@example.com', name: 'U User' }
        : { access_token: 'tok-1' };
      return new Response(JSON.stringify(payload), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    },
  });
  provider.profileEndpoint = 'https://up.example/me';
  provider.normalizeProfile = raw => ({
    provider: 'generic',
    providerAccountId: String(raw.sub),
    email: raw.email,
    nickname: raw.name,
    avatarUrl: '',
    raw,
  });
  const profile = await provider.handleCallback({ code: 'the-code' }, {});
  assert.equal(profile.providerAccountId, 'u-42');
  assert.equal(calls.length, 2, 'token 兑换 + profile 拉取各一次');
  assert.equal(calls[0].method, 'POST');
  assert.ok(calls[0].body.includes('code=the-code'));
  assert.ok(calls[0].body.includes('grant_type=authorization_code'));
});