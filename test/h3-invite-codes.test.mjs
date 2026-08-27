// test/h3-invite-codes.test.mjs
// 2026-08-26 周一切片 · §6 #7 H3 灰度邀请制
// -----------------------------------------------------------------------------
// 验证：sqlite 表幂等创建、batch 生成（默认 50 个，0/0 过期/用尽安全）；
// validateH3InviteCode 状态机；consumeH3InviteCode 单调递增 + 拒绝重放；
// grayPhaseMessage 中文文案；admin 路由挂载。
// -----------------------------------------------------------------------------
import test from 'node:test';
import assert from 'node:assert/strict';

import Database from 'better-sqlite3';
import {
  H3_INVITE,
  batchCreateH3InviteCodes,
  consumeH3InviteCode,
  ensureH3InviteSchema,
  exportH3InviteCodesCsv,
  generateH3InviteCode,
  getH3InviteCode,
  grayPhaseMessage,
  listH3InviteCodes,
  validateH3InviteCode,
} from '../server/billing/h3InviteCodes.mjs';

test('ensureH3InviteSchema creates the table idempotently and exposes expected columns', () => {
  const db = new Database(':memory:');
  ensureH3InviteSchema(db);
  ensureH3InviteSchema(db); // 二次调用应不抛
  const cols = db.prepare("PRAGMA table_info('h3_2k_invite_codes')").all().map(c => c.name);
  for (const expected of ['code', 'cohort', 'max_uses', 'used_count', 'owner_email',
    'note', 'status', 'created_at', 'expires_at', 'consumed_at']) {
    assert.ok(cols.includes(expected), `column ${expected} present`);
  }
  db.close();
});

test('generateH3InviteCode returns 8-char unambiguous code (no 0/O/1/I/L)', () => {
  const code = generateH3InviteCode();
  assert.equal(code.length, 8);
  assert.match(code, /^[A-HJ-KM-NP-Z2-9]+$/);
});

test('batchCreateH3InviteCodes defaults to 50 codes with 7-day expiry', () => {
  const db = new Database(':memory:');
  ensureH3InviteSchema(db);
  const before = Date.now();
  const result = batchCreateH3InviteCodes(db, { actorEmail: 'admin@x' });
  assert.equal(result.count, H3_INVITE.defaultBatchSize);
  assert.equal(result.codes.length, H3_INVITE.defaultBatchSize);
  const stored = listH3InviteCodes(db, { limit: 100, offset: 0 });
  assert.equal(stored.length, H3_INVITE.defaultBatchSize);
  for (const row of stored) {
    assert.equal(row.max_uses, 1);
    assert.equal(row.used_count, 0);
    assert.equal(row.status, 'active');
    const expiresAtMs = Date.parse(String(row.expires_at).replace(' ', 'T') + 'Z');
    assert.ok(expiresAtMs > before + 6 * 24 * 60 * 60 * 1000, 'expires_at ~7 days out');
  }
  db.close();
});

test('batchCreateH3InviteCodes rejects out-of-range count or maxUses', () => {
  const db = new Database(':memory:');
  ensureH3InviteSchema(db);
  assert.throws(() => batchCreateH3InviteCodes(db, { count: 0 }), /count must/);
  assert.throws(() => batchCreateH3InviteCodes(db, { count: 1000 }), /count must/);
  assert.throws(() => batchCreateH3InviteCodes(db, { maxUses: 0 }), /maxUses must/);
  assert.throws(() => batchCreateH3InviteCodes(db, { maxUses: 99999 }), /maxUses must/);
  db.close();
});

test('validateH3InviteCode returns status ok / missing / invalid as expected', () => {
  const db = new Database(':memory:');
  ensureH3InviteSchema(db);
  const created = batchCreateH3InviteCodes(db, { count: 1 });
  const code = created.codes[0].code;
  const ok = validateH3InviteCode(db, code);
  assert.equal(ok.status, 'ok');
  const missing = validateH3InviteCode(db, 'ZZZZZZZ');
  assert.equal(missing.status, 'missing');
  const invalid = validateH3InviteCode(db, 'has space!');
  assert.equal(invalid.status, 'invalid');
  db.close();
});

test('validateH3InviteCode rejects expired and exhausted and disabled codes', () => {
  const db = new Database(':memory:');
  ensureH3InviteSchema(db);
  const code = 'TESTCODE';
  db.prepare(`INSERT INTO h3_2k_invite_codes
    (id, code, cohort, max_uses, used_count, expires_at, status)
    VALUES ('invite-test-1', ?, 'gray', 1, 0, '2000-01-01 00:00:00', 'active')`).run(code);
  assert.equal(validateH3InviteCode(db, code).status, 'expired');
  db.prepare(`UPDATE h3_2k_invite_codes SET expires_at = '2099-01-01 00:00:00', used_count = 1 WHERE code = ?`).run(code);
  assert.equal(validateH3InviteCode(db, code).status, 'exhausted');
  db.prepare(`UPDATE h3_2k_invite_codes SET used_count = 0, status = 'disabled' WHERE code = ?`).run(code);
  assert.equal(validateH3InviteCode(db, code).status, 'disabled');
  db.close();
});

test('consumeH3InviteCode increments used_count and binds owner; cannot replay beyond max_uses', () => {
  const db = new Database(':memory:');
  ensureH3InviteSchema(db);
  const { code } = batchCreateH3InviteCodes(db, { count: 1, maxUses: 1 }).codes[0];
  const r1 = consumeH3InviteCode(db, { code, ownerEmail: 'first@x' });
  assert.equal(r1.ok, true);
  assert.equal(getH3InviteCode(db, code).owner_email, 'first@x');
  const r2 = consumeH3InviteCode(db, { code, ownerEmail: 'second@x' });
  assert.equal(r2.ok, false);
  assert.equal(r2.status, 'exhausted');
  const r3 = consumeH3InviteCode(db, { code: 'NEVERMADE', ownerEmail: 'x@x' });
  assert.equal(r3.status, 'missing');
  db.close();
});

test('grayPhaseMessage returns the standard gray-phase copy and null when ok', () => {
  assert.equal(grayPhaseMessage({ status: 'missing' }), '灰度中，请联系 wx 申请');
  assert.equal(grayPhaseMessage({ status: 'invalid' }), '灰度中，请联系 wx 申请');
  assert.equal(grayPhaseMessage({ status: 'expired' }), '邀请码已过期，请联系 wx 续期');
  assert.equal(grayPhaseMessage({ status: 'exhausted' }), '邀请码已被使用，请联系 wx 申请新码');
  assert.equal(grayPhaseMessage({ status: 'ok' }), null);
});

test('exportH3InviteCodesCsv emits a header and one row per code with safe escaping', () => {
  const db = new Database(':memory:');
  ensureH3InviteSchema(db);
  batchCreateH3InviteCodes(db, { count: 2, note: 'note,with,commas' });
  const rows = listH3InviteCodes(db, { limit: 10, offset: 0 });
  const csv = exportH3InviteCodesCsv(rows);
  const lines = csv.trim().split('\n');
  assert.equal(lines[0], 'id,code,cohort,max_uses,used_count,owner_email,note,status,created_at,expires_at,consumed_at');
  assert.equal(lines.length, 3);
  for (const line of lines.slice(1)) {
    // 包含逗号的 note 必须被双引号包裹
    assert.ok(line.includes('"note,with,commas"'), 'note with commas must be quoted');
  }
  db.close();
});

test('adminRoutes mounts the H3 invite endpoints', async () => {
  const fs = await import('node:fs/promises');
  const source = await fs.readFile(new URL('../server/adminRoutes.mjs', import.meta.url), 'utf8');
  assert.match(source, /app\.get\('\/api\/admin\/h3-invites'/, 'GET /api/admin/h3-invites mounted');
  assert.match(source, /app\.post\('\/api\/admin\/h3-invites'/, 'POST mounted');
  assert.match(source, /app\.get\('\/api\/admin\/h3-invites\.csv'/, 'CSV route mounted');
  assert.match(source, /text\/csv/, 'CSV content-type set');
});
