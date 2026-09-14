// test/canvas-401-keeps-canvas-0918.test.mjs
// 2026-09-18 P0 复验发现的次生**产品风险**（非测试环境问题）：
//
//   点「新建画布」→ 画布库挂载 → GET /api/canvas-library 返回 401
//   （无头 QA 通道没有真实会话，401 本身是正确行为）
//   → 但接下来**整个画布被卸载**（实测 nodes 6 → 0、顶栏消失、画布页消失）。
//
// 用户视角风险：「我的画布没了 / 工作丢了」——会话过期或误触就会触发。
//
// ── 根因（逐层查到） ──────────────────────────────────────────────────────
//   src/services/auth.js:135       401 → clearSession()
//     → onSessionInvalid 回调
//   src/store/AppContext.jsx:365   dispatch({ type:'SET_LOGGED', logged:false })
//   src/store/AppContext.jsx:184   旧 reducer：任何 SET_LOGGED:false 都**顺带重置页面上下文**
//                                  （page→'home'、result→null、genState→'idle' …）
//   → page 变 'home' + result 被清空 → 画布卸载、节点归零。
//
// ── 修法 ──────────────────────────────────────────────────────────────────
//   区分语义：401/会话失效 = **引导重新登录**（softSignOut），页面与数据保留；
//             主动「退出登录」= 硬登出，行为不变（仍清空）。
//
// 本测试把这条钉成契约。**不断言 UI 细节，只断言不变量与语义边界。**
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const appContext = read('src/store/AppContext.jsx');

/* ── 不变量①：401 不得清空页面上下文（画布不得卸载） ─────────────── */

test('401 会话失效走 softSignOut —— 不得重置 page / result / genState', () => {
  /* 401 那条 dispatch 必须带 softSignOut */
  const invalid = appContext.indexOf('onSessionInvalid(() => {');
  assert.ok(invalid > 0, '必须能找到 onSessionInvalid 订阅');
  const seg = appContext.slice(invalid, invalid + 600);
  assert.match(seg, /softSignOut:\s*true/, '401 分派必须带 softSignOut:true（否则会整段重置页面）');

  /* softSignOut 分支必须**不**包含 page / result 的重置 */
  const reducer = appContext.indexOf("case 'SET_LOGGED':");
  assert.ok(reducer > 0, '必须能找到 SET_LOGGED reducer');
  const body = appContext.slice(reducer, reducer + 2600);
  const soft = body.indexOf('if (softSignOut) {');
  assert.ok(soft > 0, 'reducer 必须有 softSignOut 分支');
  const softBlock = body.slice(soft, body.indexOf('return {', soft));
  assert.doesNotMatch(softBlock, /page:\s*'home'/, 'softSignOut 不得把 page 重置为 home（那会卸载画布）');
  assert.doesNotMatch(softBlock, /result:\s*null/, 'softSignOut 不得清空 result（那会丢掉画布节点）');
  assert.doesNotMatch(softBlock, /genState:\s*'idle'/, 'softSignOut 不得重置 genState');
});

test('401 后必须给出登录引导（不能静默什么都不做）', () => {
  const invalid = appContext.indexOf('onSessionInvalid(() => {');
  const seg = appContext.slice(invalid, invalid + 600);
  assert.match(seg, /SHOW_LOGIN[\s\S]{0,80}show:\s*true/, '必须弹出登录引导');
});

/* ── 不变量②：硬登出语义不变（不得把退出登录也改成保留） ─────────── */

test('主动「退出登录」仍是硬登出：仍重置 page / result', () => {
  const reducer = appContext.indexOf("case 'SET_LOGGED':");
  const body = appContext.slice(reducer, reducer + 2600);
  /* 硬登出分支（softSignOut 之后的 return）必须仍含页面重置 */
  const hardStart = body.indexOf("...(action.logged ? {} : {");
  assert.ok(hardStart > 0, '必须保留硬登出分支');
  const hardBlock = body.slice(hardStart, hardStart + 400);
  assert.match(hardBlock, /page:\s*'home'/, '硬登出必须仍回到首页');
  assert.match(hardBlock, /result:\s*null/, '硬登出必须仍清空 result');
});

test('softSignOut 只由 401 触发，不被其它调用点误用', () => {
  /* 只数 **dispatch 调用里的真实参数**（`softSignOut: true` 出现在 SET_LOGGED 的 payload 中），
     注释里提到该词不算。 */
  const uses = (appContext.match(/type:\s*'SET_LOGGED'[^)]*softSignOut:\s*true/g) || []).length;
  assert.equal(uses, 1, 'softSignOut 只允许在 401 分派处出现一次，实际 ' + uses + ' 处');
});

/* ── 不变量③：账户态在 401 后仍应归零（金额/额度已失效） ─────────── */

test('softSignOut 仍归零账户相关态（额度在会话过期后无意义）', () => {
  const reducer = appContext.indexOf("case 'SET_LOGGED':");
  const body = appContext.slice(reducer, reducer + 2600);
  const soft = body.indexOf('if (softSignOut) {');
  /* 该块以 `}` 收尾（块内 return 的对象字面量含有 `};`）——
  const soft = body.indexOf('if (softSignOut) {');
  /* 用**花括号配对**取出整个 if 块 —— 块内 return 的对象字面量里也有 { 和 }，
     简单 indexOf('return {') 会截在块内部（实测只截出 27 个字符）。 */
  let depth = 0, end = -1;
  for (let i2 = body.indexOf('{', soft); i2 < body.length; i2 += 1) {
    if (body[i2] === '{') depth += 1;
    else if (body[i2] === '}') { depth -= 1; if (depth === 0) { end = i2; break; } }
  }
  assert.ok(end > soft, '必须能配对出 softSignOut 块');
  const softBlock = body.slice(soft, end + 1);
  assert.match(softBlock, /ecPoints:\s*0/, '401 后积分应归零');
  assert.match(softBlock, /unlimited:\s*false/, '401 后不限量标记应清掉');
  assert.match(softBlock, /accountAccess:\s*null/, '401 后账户访问态应清掉');
});

/* ── 链路完整性 ───────────────────────────────────────────────────── */

test('401 → clearSession → onSessionInvalid 链路未被改动', () => {
  const auth = read('src/services/auth.js');
  assert.match(auth, /if \(response\?\.status === 401\) clearSession\(\)/, '401 仍必须清理会话（鉴权语义不变）');
  assert.match(auth, /export function onSessionInvalid\(/, '订阅入口仍必须存在');
});
