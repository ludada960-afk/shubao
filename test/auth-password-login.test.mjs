import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import Database from 'better-sqlite3';
import express from 'express';

import { ensureAccessSchema, bootstrapDefaultAccountAccess, requireAccountAccess } from '../server/accessControl.mjs';
import {
  ensureAuthSchema,
  migrateAccountAccessToAuthUsers,
} from '../server/auth/authSchema.mjs';
import { createAuthService } from '../server/auth/authService.mjs';
import {
  hashPassword,
  verifyPassword,
  assertPasswordPolicy,
} from '../server/auth/passwordCrypto.mjs';
import { mountAuthRoutes } from '../server/authRoutes.mjs';

const SECRET = 'p1-auth-foundation-secret-p1-auth-foundation-secret-32+';

async function createHarness(t, { mails = [], overrides = {} } = {}) {
  const db = new Database(':memory:');
  ensureAccessSchema(db);
  bootstrapDefaultAccountAccess(db);
  ensureAuthSchema(db);
  const bridge = migrateAccountAccessToAuthUsers(db);
  let clock = Date.parse('2026-08-25T00:00:00.000Z');
  const authService = createAuthService({ db, secret: SECRET, now: () => clock, ...overrides });
  const app = express();
  app.use(express.json());
  mountAuthRoutes(app, {
    authService,
    requireAccess: email => requireAccountAccess(db, email),
    mailer: {
      canSend: () => true,
      sendVerificationCodeMail: async input => { mails.push(input); },
      sendPasswordResetMail: async input => { mails.push(input); },
    },
  });
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => {
    await new Promise(resolve => server.close(resolve));
    db.close();
  });
  return { db, authService, baseUrl, bridge, advance: ms => { clock += ms; }, clock: () => clock };
}

async function postJson(baseUrl, path, body) {
  const res = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}

test('scrypt password hashing round-trips and rejects wrong passwords', async () => {
  const stored = await hashPassword('Sup3r-Secret!');
  assert.match(stored, /^scrypt\$16384\$8\$1\$/);
  assert.notEqual(stored, await hashPassword('Sup3r-Secret!'), 'salt must be random');
  assert.equal(await verifyPassword('Sup3r-Secret!', stored), true);
  assert.equal(await verifyPassword('wrong-password', stored), false);
  assert.equal(await verifyPassword('Sup3r-Secret!', 'garbage'), false);
});

test('password policy enforces 8-128 chars', () => {
  assert.throws(() => assertPasswordPolicy('short'), error => error.code === 'AUTH_PASSWORD_INVALID');
  assert.equal(assertPasswordPolicy('long-enough-password'), 'long-enough-password');
});

test('email + password login issues a verifiable v2 session', async t => {
  const mails = [];
  const harness = await createHarness(t, { mails });
  const { authService, db, baseUrl } = harness;
  // 验证码注册并首设密码（复用 auth_credentials 表）
  await postJson(baseUrl, '/api/auth/send-code', { email: '867550189@qq.com', purpose: 'register' });
  const wrongCode = mails[mails.length - 1].code === '000000' ? '000001' : '000000';
  const registerAttempt = await postJson(baseUrl, '/api/auth/register', {
    email: '867550189@qq.com', code: wrongCode, password: 'passw0rd-strong',
  });
  assert.equal(registerAttempt.status, 400);

  await postJson(baseUrl, '/api/auth/send-code', { email: '867550189@qq.com', purpose: 'register' });
  const registered = await postJson(baseUrl, '/api/auth/register', {
    email: '867550189@qq.com', code: mails[mails.length - 1].code, password: 'passw0rd-strong', nickname: '薯包主人',
  });
  assert.equal(registered.status, 200);
  assert.equal(registered.body.ok, true);
  assert.equal(registered.body.email, '867550189@qq.com');

  const user = authService.getUserByEmail('867550189@qq.com');
  assert.ok(user);
  assert.equal(user.nickname, '薯包主人');
  assert.equal(db.prepare('SELECT role FROM auth_users WHERE id = ?').get(user.id).role, 'owner', 'owner 角色桥接保留管理员标记');
  assert.equal(authService.hasCredential(user.id), true);

  const login = await postJson(baseUrl, '/api/auth/login', { email: '867550189@qq.com', password: 'passw0rd-strong' });
  assert.equal(login.status, 200);
  assert.equal(login.body.email, '867550189@qq.com');
  const verified = authService.verifyAccessToken(login.body.token);
  assert.equal(verified.email, '867550189@qq.com');

  const badLogin = await postJson(baseUrl, '/api/auth/login', { email: '867550189@qq.com', password: 'totally-wrong' });
  assert.equal(badLogin.status, 401);
  assert.equal(badLogin.body.code, 'AUTH_CREDENTIALS_INVALID');
  const unknownLogin = await postJson(baseUrl, '/api/auth/login', { email: 'stranger@example.com', password: 'whatever-pass' });
  assert.equal(unknownLogin.status, 403, '未授权邮箱先被账号门禁拦截');
  // 授权邮箱但无密码凭据：与错误密码返回完全一致（防枚举）
  const noCredential = await postJson(baseUrl, '/api/auth/login', { email: '240485042@qq.com', password: 'whatever-pass' });
  assert.equal(noCredential.status, 401);
  assert.equal(noCredential.body.code, 'AUTH_CREDENTIALS_INVALID');
});

test('registering twice requires a fresh code and reports an existing password', async t => {
  const mails = [];
  const harness = await createHarness(t, { mails });
  const { baseUrl, advance } = harness;
  await postJson(baseUrl, '/api/auth/send-code', { email: '240485042@qq.com', purpose: 'register' });
  const firstCode = mails[mails.length - 1].code;
  const first = await postJson(baseUrl, '/api/auth/register', {
    email: '240485042@qq.com', code: firstCode, password: 'another-pass-1',
  });
  assert.equal(first.status, 200);

  // 已消费验证码不能重放
  const replayedCode = await postJson(baseUrl, '/api/auth/register', {
    email: '240485042@qq.com', code: firstCode, password: 'another-pass-2',
  });
  assert.equal(replayedCode.status, 400);

  // 越过重发窗口取新码 → 触发“已设密码，请直接登录”
  advance(61 * 1000);
  await postJson(baseUrl, '/api/auth/send-code', { email: '240485042@qq.com', purpose: 'register' });
  const second = await postJson(baseUrl, '/api/auth/register', {
    email: '240485042@qq.com', code: mails[mails.length - 1].code, password: 'another-pass-2',
  });
  assert.equal(second.status, 409);
  assert.equal(second.body.code, 'AUTH_PASSWORD_EXISTS');
});