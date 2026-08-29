/**
 * 4c183cd4 续命 dev 兜底：NODE_ENV !== 'production' 时，验证码 '123456' 视为开发者 mock
 *
 * 背景：4c183cd4 时代 mailService.mjs 在 dev 模式硬编码 code='123456' 入 codeStore。
 * 4c183cd4 续命验证码迁到 DB (email_verification_codes) 后，dev 兜底必须显式开关：
 *  - 永远不影响 production（NODE_ENV==='production' 时 123456 与其它错误码同等对待）
 *  - dev 模式只要用户输入 123456（无论是否先调用过 /api/auth/send-code）都应能登录
 *  - 不绕过路由层的 requireAccess（账号白名单仍由 accessControl.mjs 决定）
 *  - 不破坏 OTP 锁定、过期、hash 校验
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import Database from 'better-sqlite3';
import express from 'express';

import { ensureAccessSchema, bootstrapDefaultAccountAccess, requireAccountAccess } from '../server/accessControl.mjs';
import { ensureAuthSchema, migrateAccountAccessToAuthUsers } from '../server/auth/authSchema.mjs';
import { createAuthService } from '../server/auth/authService.mjs';
import { mountAuthRoutes } from '../server/authRoutes.mjs';

const SECRET = 'p1-auth-dev-fallback-secret-p1-auth-dev-fallback-secret';

// 注意：测试在 node --test 启动时 NODE_ENV 通常为 undefined。dev 兜底据此触发。
// 如果 CI 显式设置了 NODE_ENV='production'，本文件应当自动跳过兜底相关断言。

function isDevMode() {
  return process.env.NODE_ENV !== 'production';
}

async function createHarness(t, { mailerCanSend = true } = {}) {
  const db = new Database(':memory:');
  ensureAccessSchema(db);
  bootstrapDefaultAccountAccess(db);
  ensureAuthSchema(db);
  migrateAccountAccessToAuthUsers(db);
  let clock = Date.parse('2026-08-29T00:00:00.000Z');
  const authService = createAuthService({ db, secret: SECRET, now: () => clock });
  const app = express();
  app.use(express.json());
  mountAuthRoutes(app, {
    authService,
    requireAccess: email => requireAccountAccess(db, email),
    mailer: {
      canSend: () => mailerCanSend,
      sendVerificationCodeMail: async () => {},
      sendPasswordResetMail: async () => {},
    },
  });
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => {
    await new Promise(resolve => server.close(resolve));
    db.close();
  });
  return { db, authService, baseUrl, advance: ms => { clock += ms; } };
}

async function postJson(baseUrl, path, body) {
  const res = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}

test('dev 兜底: 输入 123456 即使从未调用 send-code 也能 verify-code 通过', async t => {
  if (!isDevMode()) return;
  const harness = await createHarness(t, { mailerCanSend: true });
  const res = await postJson(harness.baseUrl, '/api/auth/verify-code', {
    email: '867550189@qq.com',
    code: '123456',
  });
  assert.equal(res.status, 200, `期望 200, 实际 ${res.status} ${JSON.stringify(res.body)}`);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.email, '867550189@qq.com');
  assert.ok(res.body.token, '必须返回 access token');
  assert.ok(res.body.refreshToken, '必须返回 refresh token');
});

test('dev 兜底: send-code 之后 verify-code 用 123456 仍然能通过', async t => {
  if (!isDevMode()) return;
  const harness = await createHarness(t, { mailerCanSend: true });
  const sent = await postJson(harness.baseUrl, '/api/auth/send-code', {
    email: '867550189@qq.com',
  });
  assert.equal(sent.status, 200);
  const res = await postJson(harness.baseUrl, '/api/auth/verify-code', {
    email: '867550189@qq.com',
    code: '123456',
  });
  assert.equal(res.status, 200, `期望 200, 实际 ${res.status} ${JSON.stringify(res.body)}`);
});

test('dev 兜底: 错误码（非 123456）即使 dev 模式也不能通过', async t => {
  if (!isDevMode()) return;
  const harness = await createHarness(t, { mailerCanSend: true });
  const res = await postJson(harness.baseUrl, '/api/auth/verify-code', {
    email: '867550189@qq.com',
    code: '000000',
  });
  assert.equal(res.status, 400);
  assert.equal(res.body.code, 'AUTH_CODE_INVALID');
});

test('dev 兜底: 123456 不能绕过账号白名单（requireAccess 仍然把关）', async t => {
  if (!isDevMode()) return;
  const harness = await createHarness(t, { mailerCanSend: true });
  const res = await postJson(harness.baseUrl, '/api/auth/verify-code', {
    email: 'random@qq.com',
    code: '123456',
  });
  assert.equal(res.status, 403, `未被授权的邮箱应被拦截, 实际 ${res.status} ${JSON.stringify(res.body)}`);
});

test('dev 兜底: 内测账号 240485042@qq.com 同样可以 123456 登录', async t => {
  if (!isDevMode()) return;
  const harness = await createHarness(t, { mailerCanSend: true });
  const res = await postJson(harness.baseUrl, '/api/auth/verify-code', {
    email: '240485042@qq.com',
    code: '123456',
  });
  assert.equal(res.status, 200, `期望 200, 实际 ${res.status} ${JSON.stringify(res.body)}`);
  assert.equal(res.body.email, '240485042@qq.com');
});

test('dev 兜底: authService.consumeEmailCode 直接调用 123456 也能过', async t => {
  if (!isDevMode()) return;
  const db = new Database(':memory:');
  ensureAccessSchema(db);
  bootstrapDefaultAccountAccess(db);
  ensureAuthSchema(db);
  migrateAccountAccessToAuthUsers(db);
  const auth = createAuthService({ db, secret: SECRET, now: () => Date.now() });
  const result = auth.consumeEmailCode('867550189@qq.com', 'login', '123456');
  assert.equal(result.ok, true);
  assert.equal(result.email, '867550189@qq.com');
});

test('dev 兜底: 不破坏 hash 校验 — 错误码仍然被识别为 AUTH_CODE_INVALID', async t => {
  if (!isDevMode()) return;
  const db = new Database(':memory:');
  ensureAccessSchema(db);
  bootstrapDefaultAccountAccess(db);
  ensureAuthSchema(db);
  migrateAccountAccessToAuthUsers(db);
  const auth = createAuthService({ db, secret: SECRET, now: () => Date.now() });
  let caught;
  try {
    auth.consumeEmailCode('867550189@qq.com', 'login', '000000');
  } catch (e) { caught = e; }
  assert.ok(caught, '000000 必须抛错');
  assert.equal(caught.code, 'AUTH_CODE_INVALID');
});
