// test/auth-network-blip-1004.test.mjs
// 「明明登录过，一访问却弹登录框」—— 2026-10-04
//
// 用户原话（逐字）：
//   「我经常一访问就弹出登录，但是其实之前已经登录了，要关掉登录弹窗或者刷新一下才能看到登录了」
//
// 根因不是一个，是三个叠在一起：
//   ① getSession() 把「续期没成功」等同于「掉登录」。而 refreshSession() 自己明确
//      写着「网络抖动不清理凭据」—— 两处自相矛盾。access token 只有 30 分钟 TTL，
//      用户离开半小时以上回来就必然走这条路，此时 refresh 抖一下就被踢下线。
//   ② verifyAndAdoptSession 的**重试**分支漏了 5xx 豁免：refresh 已成功、token 已换新，
//      只要重试那次 /api/session 抖一下（502），一个完全有效的会话就被清掉。
//   ③ 会话恢复成功后**从不关弹窗**：所有恢复通道只 dispatch SET_LOGGED，
//      于是 logged===true 与 showLogin===true 长期共存 —— 这正是"要关掉弹窗才看得见"。
//
// ⚠️ 这三条都是"服务端打了个嗝 ≠ 用户掉线"这一条原则的漏网分支。
//   2026-10-01 已经给**第一次**响应打过一次豁免，那次只修了 ①②的一半。
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

import { stripComments } from '../scripts/lib/token-scope.mjs';

function installStorage(entries) {
  const values = new Map(Object.entries(entries).map(([k, v]) => [k, JSON.stringify(v)]));
  globalThis.localStorage = {
    getItem: key => values.get(key) || null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key),
  };
  return values;
}

const EXPIRED_ACCESS = '2000-01-01T00:00:00.000Z';
const LIVE_REFRESH = { refreshToken: 'refresh-abc' };

/* ─────────── ① 续期因网络失败 ⇒ 不清凭据、不当掉线 ─────────── */

test('① 续期请求抛异常（断网/超时）时，不得清掉会话', async t => {
  const storage = installStorage({
    'sb-auth': { token: 'old', email: 'owner@example.com', expiresAt: EXPIRED_ACCESS },
    'sb-auth-refresh': LIVE_REFRESH,
  });
  const originalFetch = globalThis.fetch;
  // 续期直接抛 —— 这就是 refreshSession 里 catch 住的「网络抖动」
  globalThis.fetch = async () => { throw new TypeError('Failed to fetch'); };
  t.after(() => { globalThis.fetch = originalFetch; });

  const auth = await import(`../src/services/auth.js?netfail=${Date.now()}`);
  const session = await auth.getSession();

  assert.equal(session, null, '这一次确实没验成，但不能因此判定掉线');
  assert.notEqual(storage.get('sb-auth'), undefined, '网络故障**不许**清 sb-auth');
  assert.ok(storage.get('sb-auth-refresh'), 'refresh 凭据必须留着，等下一轮再试');
});

test('② 续期被服务端明确拒收（400/401/403）时，确实该清 —— 那是真掉线', async t => {
  const storage = installStorage({
    'sb-auth': { token: 'old', email: 'owner@example.com', expiresAt: EXPIRED_ACCESS },
    'sb-auth-refresh': LIVE_REFRESH,
  });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ code: 'AUTH_SESSION_EXPIRED' }), {
    status: 401, headers: { 'content-type': 'application/json' },
  });
  t.after(() => { globalThis.fetch = originalFetch; });

  const auth = await import(`../src/services/auth.js?rejected=${Date.now()}`);
  const session = await auth.getSession();

  assert.equal(session, null);
  assert.equal(storage.get('sb-auth'), undefined, '服务端拒收 = 真掉线，必须清');
});

/* ─────────── ② 重试分支的 5xx 豁免 ─────────── */

test('③ 续期成功但重试那次 /api/session 返回 502 ⇒ 不清会话', async t => {
  const storage = installStorage({
    'sb-auth': { token: 'old-token', email: 'owner@example.com', expiresAt: '2099-01-01T00:00:00.000Z' },
    'sb-auth-refresh': LIVE_REFRESH,
  });
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async (url, options) => {
    calls += 1;
    // 第一次 /api/session → 401（触发续期）
    if (String(url).includes('/api/session')) {
      if (calls <= 2) return new Response('{}', { status: 401, headers: { 'content-type': 'application/json' } });
      // 续期成功后的重试 → 502（服务端故障，不是掉线）
      return new Response('{}', { status: 502, headers: { 'content-type': 'application/json' } });
    }
    // /api/auth/refresh → 200，拿到新 token
    return new Response(JSON.stringify({ ok: true, token: 'fresh-token', refreshToken: 'r2', expiresAt: '2099-01-01T00:00:00.000Z' }), {
      status: 200, headers: { 'content-type': 'application/json' },
    });
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  const auth = await import(`../src/services/auth.js?retry502=${Date.now()}`);
  await auth.getSession();

  assert.notEqual(storage.get('sb-auth'), undefined,
    'refresh 已成功、token 已换新，只因重试抖了一下就把有效会话清掉 —— 2026-10-04 修');
});

/* ─────────── ③ 恢复成功后必须关掉登录弹窗 ─────────── */

test('④ SET_LOGGED(true) 必须同时把 showLogin 置 false', () => {
  /* 已登录与"弹着登录框"在语义上不该同时成立。这条放在 reducer 里兜住，
     因为恢复通道有三条（挂载期 getSession / onSessionRestored / 401 后静默续期），
     各写一遍漏一条就复现。 */
  const source = readFileSync(new URL('../src/store/AppContext.jsx', import.meta.url), 'utf8');
  assert.match(
    source,
    /action\.logged \? \{ showLogin: false \} : \{\}/,
    'SET_LOGGED(true) 没有强制关闭登录弹窗 —— 会话恢复了但框还盖在上面',
  );
});

test('⑤ 软登出（401）不得被这次改动误伤', () => {
  /* ⚠️ 剥掉注释再断言：下面那段说明注释里就写着 showLogin（解释为什么不碰它），
     而那些注释恰恰是最该保留的证据。不剥就等于逼着下一个人删注释。 */
  const source = stripComments(readFileSync(new URL('../src/store/AppContext.jsx', import.meta.url), 'utf8'));
  /* softSignOut 分支在 SET_LOGGED 之前就 return 了，它保留页面上下文、
     不关弹窗（用户就是被引导去登录的）。别把两条语义合并。 */
  assert.match(source, /const softSignOut = action\.logged === false && action\.softSignOut === true;/);
  const softBranch = source.slice(source.indexOf('const softSignOut'), source.indexOf('action.logged ? { showLogin: false }'));
  assert.doesNotMatch(softBranch, /showLogin/, '软登出分支不该碰 showLogin');
});

test('⑥ 修的是"服务端故障 ≠ 掉线"，不是把真实 401 也放过', () => {
  const source = stripComments(readFileSync(new URL('../src/services/auth.js', import.meta.url), 'utf8'));
  /* 兜底判据：refresh 凭据还在 = 网络问题；被服务端收走 = 真掉线。 */
  assert.match(source, /if \(!getStoredRefresh\(\)\?\.refreshToken\) clearSession\(\);/,
    '续期失败后必须区分"网络问题"与"服务端拒收"');
  /* 重试分支仍然只把 401 当失效。 */
  assert.match(source, /if \(retry\.status !== 401\) return null;/,
    '重试的非 401（5xx/网络）必须提前返回，不得走到 clearSession');
  assert.match(source, /if \(\[400, 401, 403\]\.includes\(status\)\)/,
    'refresh 的 400/401/403 仍然要清凭据并广播下线');
});