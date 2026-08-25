import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import Database from 'better-sqlite3';
import express from 'express';

import { ensureAccessSchema, bootstrapDefaultAccountAccess, requireAccountAccess } from '../server/accessControl.mjs';
import { ensureAuthSchema, migrateAccountAccessToAuthUsers } from '../server/auth/authSchema.mjs';
import { createAuthService } from '../server/auth/authService.mjs';
import { mountAuthRoutes } from '../server/authRoutes.mjs';

const SECRET = 'p1-auth-foundation-secret-p1-auth-foundation-secret-32+';

async function createHarness(t, { mails = [] } = {}) {
  const db = new Database(':memory:');
  ensureAccessSchema(db);
  bootstrapDefaultAccountAccess(db);
  ensureAuthSchema(db);
  migrateAccountAccessToAuthUsers(db);
  let clock = Date.parse('2026-08-25T00:00:00.000Z');
  const authService = createAuthService({ db, secret: SECRET, now: () => clock });
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
  return { db, authService, baseUrl, mails, advance: ms => { clock += ms; } };
}

async function postJson(baseUrl, path, body) {
  const res = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}

test('OTP codes live in SQLite (memory Map removed) with hashed values', async t => {
  const mails = [];
  const harness = await createHarness(t, { mails });
  await postJson(harness.baseUrl, '/api/auth/send-code', { email: '867550189@qq.com' });
  const row = harness.db.prepare("SELECT * FROM email_verification_codes WHERE email = ? AND purpose = 'login'")
    .get('867550189@qq.com');
  assert.ok(row, '验证码必须入库');
  assert.match(row.code_hash, /^[0-9a-f]{64}$/, '验证码必须以哈希存储');
  assert.notEqual(row.code_hash, '123456');
  assert.equal(mails[0].code.length, 6, '真实通道下发随机 6 位码');
});

test('brute force lockout: 5 wrong attempts kill the code even for the right answer', async t => {
  const mails = [];
  const harness = await createHarness(t, { mails });
  const { authService, baseUrl, db } = harness;
  const sent = await postJson(baseUrl, '/api/auth/send-code', { email: '867550189@qq.com' });
  assert.equal(sent.status, 200);
  const realCode = mails[mails.length - 1].code;

  let lastError;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      authService.consumeEmailCode('867550189@qq.com', 'login', `wrong${attempt}`);
      assert.fail(`attempt ${attempt} should fail`);
    } catch (error) {
      lastError = error;
    }
    if (attempt < 5) assert.equal(errorCode(lastError), 'AUTH_CODE_INVALID');
  }
  // 第 5 次失败即锁定
  assert.equal(errorCode(lastError), 'AUTH_CODE_LOCKED');
  assert.equal(db.prepare("SELECT COUNT(*) AS c FROM email_verification_codes WHERE email = ? AND purpose = 'login'")
    .get('867550189@qq.com').c, 0, '锁定后记录删除');
  // 正确答案也不再可用
  assert.throws(
    () => authService.consumeEmailCode('867550189@qq.com', 'login', realCode),
    error => error.code === 'AUTH_CODE_INVALID',
  );
});

test('resend window is enforced and a fresh code resets the attempt counter', async t => {
  const mails = [];
  const harness = await createHarness(t, { mails });
  const { authService, baseUrl, advance } = harness;
  const first = await postJson(baseUrl, '/api/auth/send-code', { email: '240485042@qq.com' });
  assert.equal(first.body.reused, false);
  const immediateResend = await postJson(baseUrl, '/api/auth/send-code', { email: '240485042@qq.com' });
  assert.equal(immediateResend.body.reused, true);
  assert.equal(immediateResend.body.retryAfterSeconds > 0, true);

  try {
    authService.consumeEmailCode('240485042@qq.com', 'login', '000000');
  } catch (error) {
    assert.equal(error.code, 'AUTH_CODE_INVALID');
  }

  advance(61 * 1000); // 越过重发窗口
  const second = await postJson(baseUrl, '/api/auth/send-code', { email: '240485042@qq.com' });
  assert.equal(second.body.reused, false);
  const realCode = mails[mails.length - 1].code;
  const ok = authService.consumeEmailCode('240485042@qq.com', 'login', realCode);
  assert.equal(ok.ok, true, '新验证码不受旧失败次数影响');
  // 消费即失效
  assert.throws(
    () => authService.consumeEmailCode('240485042@qq.com', 'login', realCode),
    error => error.code === 'AUTH_CODE_INVALID',
  );
});

test('expired codes are rejected and cleaned up', async t => {
  const mails = [];
  const harness = await createHarness(t, { mails });
  const { authService, baseUrl, advance } = harness;
  await postJson(baseUrl, '/api/auth/send-code', { email: '867550189@qq.com' });
  const code = mails[mails.length - 1].code;
  advance(5 * 60 * 1000 + 1000);
  assert.throws(
    () => authService.consumeEmailCode('867550189@qq.com', 'login', code),
    error => error.code === 'AUTH_CODE_EXPIRED',
  );
});

function errorCode(error) {
  return error?.code || '';
}
