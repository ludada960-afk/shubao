// test/canvas-generation-orphan-sweep-1004.test.mjs
// 门禁：启动时清算上一次进程遗留的画布生成行（2026-10-04）
// ─────────────────────────────────────────────────────────────────────────────
// 起因（生产实证，不是推演）：
//   `canvas_generation_jobs` 里留着一行
//     created_at=2026-10-03T13:23:18  status=queued  provider_job_id=''
//   那是用户 240485042@qq.com 报的「image2.5 生成不出来」。
//   2026-10-03 给 `recordError` 加的「上游没受理 ⇒ 落终态」修复**只能挡住此后新建的活**；
//   已经卡住的那一行没有任何代码会去碰，前端照样把它当"仍在生成"轮询满 15 分钟。
//   ⇒ 一次部署不该修不好一条用户亲眼看着卡住的记录。
//
// 这条门禁钉三件事：
//   ① 判据是**租约**（持有者还在不在），不是"多久没动" —— 后者会误杀跑得慢的活图；
//   ② 只碰**非终态**行，completed / failed 一个字都不动；
//   ③ 落 `failed` 而不是留在 queued：只有终态才让 status 接口立刻回错误，前端才不空转。
// ─────────────────────────────────────────────────────────────────────────────
import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';

import { createCanvasGenerationStore } from '../server/canvasGenerationStore.mjs';
import { readFileSync } from 'node:fs';

const INDEX = readFileSync(new URL('../server/index.mjs', import.meta.url), 'utf8');
const STORE = readFileSync(new URL('../server/canvasGenerationStore.mjs', import.meta.url), 'utf8');

function harness({ clockStart = Date.parse('2026-10-03T13:23:18Z') } = {}) {
  const db = new Database(':memory:');
  let clock = clockStart;
  const store = createCanvasGenerationStore(db, {
    now: () => clock,
    randomUUID: () => 'lease-token',
  });
  const seed = (requestId, { status, providerJobId = '', leaseExpiresAt = null, ageMs = 0 }) => {
    const created = new Date(clockStart - ageMs).toISOString();
    db.prepare(`
      INSERT INTO canvas_generation_jobs
        (request_id, owner_email, request_fingerprint, request_snapshot, status,
         provider_job_id, output_url, stable_url, error_json, lease_token, lease_expires_at,
         created_at, updated_at)
      VALUES (?, 'owner@example.com', 'fp', '{}', ?, ?, '', '', 'null', NULL, ?, ?, ?)
    `).run(requestId, status, providerJobId, leaseExpiresAt, created, created);
  };
  const advance = ms => { clock += ms; };
  return { db, store, seed, advance };
}

test('① 租约已死的非终态行，落终态 failed（前端才会停止空转）', () => {
  const { store, seed } = harness();
  seed('orphan-no-upstream', { status: 'queued', providerJobId: '' });
  seed('orphan-with-upstream', { status: 'submitted', providerJobId: 'image2:primary:img_x' });

  const settled = store.sweepOrphaned();
  assert.equal(settled.length, 2, '两条都该被清算');
  assert.deepEqual(settled.map(item => item.requestId).sort(),
    ['orphan-no-upstream', 'orphan-with-upstream']);

  const noUpstream = store.get('orphan-no-upstream');
  assert.equal(noUpstream.status, 'failed', '卡在 queued 的那一条必须变终态');
  assert.equal(noUpstream.error.code, 'CANVAS_GENERATION_ABANDONED');
  /* ⚠️ 文案必须让用户知道"再点一次"是一次**新请求**，
     而不是在暗示"等一会儿它自己会好" —— 那是这次事故里最伤用户的一句提示。 */
  assert.match(noUpstream.error.message, /重新生成/);
  assert.equal(noUpstream.error.retryable, true);

  /* 有 provider_job_id 的那一类文案要不一样：上游受理过，只是本进程没收回尾 */
  const withUpstream = store.get('orphan-with-upstream');
  assert.equal(withUpstream.status, 'failed');
  assert.equal(withUpstream.error.code, 'CANVAS_GENERATION_INTERRUPTED');
  assert.match(withUpstream.error.message, /中断/);
});

test('② 终态行一个都不许动（清算不是"把所有没出图的都判死"）', () => {
  const { store, seed } = harness();
  seed('done', { status: 'completed', providerJobId: 'img_ok', outputUrl: 'https://x/a.png', stableUrl: 'https://x/s.png' });
  seed('failed-long-ago', { status: 'failed', errorNull: true });
  const settled = store.sweepOrphaned();
  assert.deepEqual(settled, [], 'completed / failed 一条都不该出现在清算结果里');
  assert.equal(store.get('done').status, 'completed');
});

test('③ 租约还活着 ⇒ 不动（清算是启动瞬间的事，此刻还没有 worker 拿到租约）', () => {
  const { store, seed, advance } = harness();
  /* 租约 30 秒；刚签发 ⇒ 还剩 29 秒 */
  seed('fresh-lease', { status: 'processing', leaseExpiresAt: new Date(Date.parse('2026-10-03T13:23:48Z')).toISOString() });
  assert.deepEqual(store.sweepOrphaned(), [], '租约没过期就不该被判死');
  /* 过了租约才清算 —— 这就是"持有者还在不在"这条判据 */
  advance(31_000);
  const settled = store.sweepOrphaned();
  assert.equal(settled.length, 1);
  assert.equal(store.get('fresh-lease').status, 'failed');
});

test('④ 判据不许退化成"多久没动"（那会误杀跑得慢的活图）', () => {
  const { store, seed } = harness();
  /* updated_at 是 6 小时前，但租约还在（另一个进程/实例正持有它） */
  seed('slow-but-alive', {
    status: 'processing',
    providerJobId: 'img_slow',
    leaseExpiresAt: new Date(Date.parse('2026-10-03T13:23:48Z')).toISOString(),
    ageMs: 6 * 60 * 60 * 1000,
  });
  assert.deepEqual(store.sweepOrphaned(), [],
    '一条 6 小时没更新但租约有效的行**不能**被判死 —— 那是正在跑的活图');
  assert.equal(store.get('slow-but-alive').status, 'processing');
});

test('⑤ 启动序列里必须真的调它（定义了不调 = 死代码）', () => {
  /* 这条最容易"写完就忘"：函数存在、门禁全绿，但没人调 ⇒ 生产照旧卡住。 */
  assert.match(STORE, /sweepOrphaned\(\)/);
  assert.match(INDEX, /canvasGenerationStore\.sweepOrphaned\(\)/,
    '启动时必须真的清算一次');
  /* 清算失败不许拦住启动（fail open）—— 它是清理动作，不是启动前置条件。
     ⚠️ 切片要从 `try` 之前起（`sweepOrphaned()` 出现在 try 的**里面**），
     从调用点起切会把 `try {` 切掉，这条断言就成了永远失败的那种。 */
  const block = INDEX.slice(INDEX.indexOf('清算上一次进程遗留的画布生成行'));
  assert.match(block.slice(0, 1200), /try\s*{/);
  assert.match(block.slice(0, 1200), /console\.error/,
    '清算失败必须留痕 —— 静默吞掉会让"又有一条卡住"变成查不出来的事');
});