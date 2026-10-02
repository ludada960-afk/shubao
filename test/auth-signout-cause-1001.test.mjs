// test/auth-signout-cause-1001.test.mjs
// 2026-10-01。用户报了两件事：
//   ①「有时候一段时间没来看网站，突然来访问一下，他会自己掉落登录呢，弹出登录窗，
//      然后过一会才显示已登录的状态呀」
//   ②「有时候过一会才来访问网站，网站会突然无法访问，要刷新两下才能访问」
//
// 根因是同一类错误：**把「这次没验成」当成了「你已经登出」**。
// ① access token 30 分钟就过期，refresh token 是独立的、clearSession 也不删它
//    —— 本来可以静默续期的正常情况，却广播成"会话失效"，AppContext 收到就弹登录窗。
//    「过一会又显示已登录」是因为 refresh 随后成功、notifyRestored 又把 UI 拉回来了。
//    「有时候」= 401 与 refresh 的竞速。
// ② verifyAndAdoptSession 里 `!response.ok` 一律 clearSession()，而 !ok 包含
//    502/500/超时。线上实测真有：GET /api/session → 502（真实 Chrome），
//    下一秒同一个人 POST /api/billing/quote → 401。服务器打个嗝就把人踢下线。
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const auth = readFileSync(new URL('../src/services/auth.js', import.meta.url), 'utf8');
const stripComments = t => t.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^[ \t]*\/\/.*$/gm, ' ');
const code = stripComments(auth);

test('1. handleSessionResponse：401 且有 refresh 凭证时，只能续期，不能下线', () => {
  const fn = code.slice(code.indexOf('export function handleSessionResponse'),
    code.indexOf('async function postJson'));
  assert.ok(fn.length > 0, '找不到 handleSessionResponse');

  assert.match(fn, /status\s*===\s*401[\s\S]*getStoredRefresh\(\)\?\.refreshToken/,
    '401 分支必须先看有没有 refresh 凭证');
  assert.match(fn, /refreshSession\(\)[\s\S]*return response/,
    '有 refresh 凭证时要触发续期并**原样返回 response**，不继续往下走到 clearSession');
  assert.match(fn, /clearSession\(\);/,
    '没有 refresh 凭证时仍然要 clearSession（真的登出了）');

  /* 关键：clearSession 必须在**续期那条路的 return 之后**，
     否则又是"先下线再说"。 */
  const refreshAt = fn.indexOf('refreshSession()');
  const clearAt = fn.lastIndexOf('clearSession()');
  assert.ok(refreshAt < clearAt,
    '续期那条路必须在 clearSession 之前 return —— 否则又变成"先弹登录窗"');
});

test('2. verifyAndAdoptSession：只有 401 才算会话失效，5xx 不算', () => {
  const fn = code.slice(code.indexOf('async function verifyAndAdoptSession'),
    code.indexOf('function finalizeVerifiedSession'));
  assert.ok(fn.length > 0, '找不到 verifyAndAdoptSession');

  assert.match(fn, /status\s*===\s*401[\s\S]*refreshSession\(\)/,
    '401 分支要保留"先静默续期再重试"的自愈');
  assert.match(fn, /if\s*\(!response\.ok\)\s*\{\s*return null;\s*\}/,
    '非 401 的 !ok（502/500/超时）只能 return null，**不得** clearSession');

  /* `!response.ok` 那一段里绝不能再出现 clearSession */
  const notOk = fn.slice(fn.indexOf('if (!response.ok)'));
  assert.doesNotMatch(notOk.slice(0, notOk.indexOf('}') + 1), /clearSession\(\)/,
    '服务端 5xx 绝不能被当成"已登出"');
});

test('3. 网络异常（catch）同样不得当成登出', () => {
  const fn = code.slice(code.indexOf('async function verifyAndAdoptSession'),
    code.indexOf('function finalizeVerifiedSession'));
  const catchBody = fn.slice(fn.lastIndexOf('catch'));
  assert.doesNotMatch(catchBody, /clearSession\(\)/,
    '请求抛异常（断网/被取消）不等于掉线，不许清凭证');
});

test('4. 真的登出时仍然要彻底清理（别把安全边界改松了）', () => {
  /* 上面的修复不能变成"永远不清 session" —— refresh 本身失效/重放时必须真清。 */
  const refreshFn = code.slice(code.indexOf('export function refreshSession'),
    code.indexOf('export function maybeRefreshSession'));
  assert.match(refreshFn, /\[400,\s*401,\s*403\][\s\S]*clearRefreshCredential\(\)[\s\S]*clearSession\(\)/,
    'refresh 失效/过期/重放时必须清 refresh 凭证 + 清 session + 广播下线');
  assert.match(code, /export async function logout[\s\S]*clearSession\(\)/,
    '用户主动登出必须照常清干净');
});

test('5. 登录/注册/refresh 自己不走 handleSessionResponse（否则会被自己的 401 误伤）', () => {
  /* handleSessionResponse 的 10 个调用点全在数据面；认证接口如果也走它，
     「密码输错 → 401」会立刻把刚存的 session 清掉。守住这条边界。 */
  const callSites = ['admin.js', 'apiError.js', 'conceptCopy.js', 'planPreview.js', 'video.js', 'videoUploadClient.js'];
  for (const f of callSites) {
    const s = readFileSync(new URL('../src/services/' + f, import.meta.url), 'utf8');
    assert.doesNotMatch(s, /\/api\/auth\/(login|register|verify-code|refresh)[\s\S]{0,200}handleSessionResponse/,
      f + ' 里不该在认证接口上调 handleSessionResponse');
  }
});