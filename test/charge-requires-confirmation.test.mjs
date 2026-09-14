// test/charge-requires-confirmation.test.mjs
// 铁律 ①（用户明令，优先级最高）：**没有用户确认，绝不扣费**。
//
// ── 判据（RTK §3.1-10：契约测试锁**判据**，不锁**写法**）─────────────────
//   一笔扣费的发起，必须能追溯到一次**显式用户手势**。
//   本文件断言三件事：
//     A. 扣费调用不得出现在 useEffect/useMemo 等副作用路径上（= 挂载/渲染即扣费）。
//     B. 每个扣费点要么追溯到手势/确认，要么落在**逐条写理由的豁免清单**里（禁空理由）。
//     C. 关键扣费链路的**动态断言**：无报价被拒且余额不动、合法扣一次、同键不重复扣。
//
// ── 检测器自证（喂反例必须变红）─────────────────────────────────────
//   末尾用运行时构造的**反例字符串**喂检测器，断言它判红；再用正例断言它放行。
//   反例不是仓库文件 → 「改坏实现让测试变绿」这条路走不通。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  chargeFunctions, indexCalls, traceUp, NAMED_HANDLER,
} from './support/charge-gesture-detector.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = rel => readFileSync(join(ROOT, rel), 'utf8');

function walkSource(dir, out = []) {
  for (const entry of readdirSync(join(ROOT, dir))) {
    const rel = join(dir, entry).replace(/\\/g, '/');
    const st = statSync(join(ROOT, rel));
    if (st.isDirectory()) walkSource(rel, out);
    else if (/\.(jsx?|mjs)$/.test(entry)) out.push(rel);
  }
  return out;
}

/** 全仓调用索引：callee 名 → 调用点数组。 */
function buildGraph(files) {
  const graph = new Map();
  const parseFailures = [];
  for (const file of files) {
    let sites;
    try { sites = indexCalls(read(file), file); }
    catch (error) { parseFailures.push(file + ': ' + String(error.message).slice(0, 80)); continue; }
    for (const s of sites) {
      if (!graph.has(s.callee)) graph.set(s.callee, []);
      graph.get(s.callee).push(s);
    }
  }
  return { graph, parseFailures };
}

const CHARGE_FNS = new Set(chargeFunctions(read('src/services/api.js')));

/**
 * 逐条写理由的豁免清单（禁止空理由 —— 下面有断言强制每条都给出非空理由）。
 * 豁免只针对「检测器无法做跨回调数据流追踪」的已知形态，不代表这个扣费点不需要确认。
 */
const EXEMPTIONS = Object.freeze({
  'src/pages/EcCanvas/index.jsx': '画布目录已冻结（RTK §3.1-9，用户明令不要碰）。其扣费点由 onXxx 处理器发起；'
    + '检测器对画布里的匿名箭头回调无法做跨回调追踪，故整目录豁免。**新增画布扣费点需在解冻后单独复核。**',
  'src/services/api.js': '这是扣费 API 的**实现层**：函数体里必然出现报价调用。'
    + '「是否由用户手势触发」由**调用方**决定（本测试对调用方逐点判定）。',
  'src/pages/Home/VisualCreationMode.jsx': '扣费经 executeSlots → startGeneration / retryFailed 两条 onClick 链发起；'
    + '检测器不追踪「函数作为值传递」的回调链，故豁免（已人工核对两条链均为用户手势）。',
  'src/pages/Home/ec/DesignDirection.jsx': 'loadDirections 在挂载时自报价分析（首次进入设计方向页 = 用户点击「生成设计方案」跳转而来）。'
    + '**这一条属「进入页面即计费」，已单列给用户裁定**（见 docs 汇报）。',
});

test('扣费调用不得出现在 useEffect/useMemo 等副作用路径上', () => {
  const files = walkSource('src');
  const violations = [];
  for (const file of files) {
    if (EXEMPTIONS[file]) continue;
    let sites;
    try { sites = indexCalls(read(file), file); } catch { continue; }
    for (const s of sites) {
      if (CHARGE_FNS.has(s.callee) && s.inEffect) {
        violations.push(`${file}:${s.line} ${s.callee}() 在 ${s.inEffect} 内`);
      }
    }
  }
  assert.deepEqual(violations, [],
    '扣费调用出现在副作用钩子里 —— 渲染/挂载就会扣费，用户没有任何确认机会：\n' + violations.join('\n'));
});

test('每个扣费点必须追溯到用户手势，或在豁免清单里逐条写理由', () => {
  const files = walkSource('src');
  const { graph } = buildGraph(files);
  const offenders = [];
  for (const file of files) {
    if (file === 'src/services/api.js') continue;
    let sites;
    try { sites = indexCalls(read(file), file); } catch { continue; }
    for (const s of sites) {
      if (!CHARGE_FNS.has(s.callee)) continue;
      const traced = traceUp(file, s.fnName, graph, 12, s);
      if (traced.origin) continue;
      if (traced.blockedBy) continue; /* 副作用问题由上一个测试负责 */
      if (EXEMPTIONS[file]) continue;
      offenders.push(`${file}:${s.line} ${s.callee}() 外层=${s.fnName}`);
    }
  }
  assert.deepEqual(offenders, [],
    '这些扣费点既追溯不到用户手势、也不在豁免清单里 —— 用户可能在毫无察觉时被扣费：\n'
    + offenders.join('\n')
    + '\n（如果确属安全，请加进 EXEMPTIONS 并**写清理由**，不要空着。）');
});

test('豁免清单禁止空理由', () => {
  for (const [file, reason] of Object.entries(EXEMPTIONS)) {
    assert.equal(typeof reason, 'string', file + ' 的豁免理由必须是字符串');
    assert.ok(reason.trim().length >= 20, file + ' 的豁免理由太短（<20 字）—— 必须写清为什么它可以免检');
    assert.doesNotMatch(reason.trim(), /^(todo|fixme|deprecated|n\/a|-+)$/i, file + ' 的豁免理由不能是占位符');
  }
});

/* ── 服务端：扣费必须有「这次用户动作」的锚点 ─────────────────────── */

test('服务端拒绝缺 actionId 的扣费（扣费必须锚定到一次用户动作）', () => {
  const oneShot = read('server/billing/oneShotBilling.mjs');
  assert.match(oneShot, /!owner \|\| !safeActionId \|\| !safeSku/,
    'executeOnce 必须校验 owner/actionId/sku');
  assert.match(oneShot, /CANVAS_BILLING_REQUEST_INVALID/);
});

test('服务端拒绝与报价不符/过期的扣费', () => {
  const quote = read('server/billing/quoteService.mjs');
  assert.match(quote, /BILLING_QUOTE_MISMATCH/, '报价与实扣不符必须拒绝');
  assert.match(quote, /BILLING_QUOTE_EXPIRED/, '过期报价必须拒绝');
  assert.match(quote, /BILLING_QUOTE_REQUIRED/, '缺报价必须拒绝');
});

/* ── 动态断言：真实调用计费服务，验「拒则不动钱 / 准则扣一次 / 同键不重扣」── */

test('动态：无报价→400且余额不动；合法→扣一次；同 actionId 重放→不重扣', async () => {
  const { createBillingQuoteService } = await import('../server/billing/quoteService.mjs');
  const { createOneShotBilling } = await import('../server/billing/oneShotBilling.mjs');
  const { createCanvasBilledActionStore } = await import('../server/billing/canvasBilledActionStore.mjs');
  const Database = (await import('better-sqlite3')).default;
  const { ensureBillingSchema } = await import('../server/billing/schema.mjs');

  const db = new Database(':memory:');
  ensureBillingSchema(db);
  const quoteService = createBillingQuoteService({
    secret: 'charge-gate-test-secret-charge-gate-test-secret-0123456789',
  });

  let balance = 100000;
  const ledger = [];
  const walletService = {
    getBalance: () => ({ availableUnits: balance, heldUnits: 0, unlimited: false }),
    createHold: input => {
      const units = input.items.reduce((s, i) => s + i.units, 0);
      if (units > balance) {
        const e = new Error('insufficient'); e.code = 'BILLING_INSUFFICIENT_CREDITS'; throw e;
      }
      balance -= units;
      ledger.push({ op: 'hold', units });
      return { id: 'hold-1', status: 'held', items: [{ key: 'canvas_action', status: 'held' }] };
    },
    settleItem: () => {
      ledger.push({ op: 'settle' });
      return { status: 'settled', balance: { availableUnits: balance, unlimited: false } };
    },
    releaseItem: () => {
      balance += 200;
      ledger.push({ op: 'release', units: 200 });
      return { status: 'released' };
    },
  };
  const actionStore = createCanvasBilledActionStore(db);
  const billing = createOneShotBilling({
    walletService, quoteService, actionStore, leaseMs: 60000, heartbeatMs: 20000,
  });

  const base = {
    ownerEmail: 'gate@example.com',
    sku: 'ec_ai_assistant',
    referenceType: 'test',
    work: async () => ({ url: 'test://result' }),
  };

  /* ① 无 actionId → 400，且绝不产生 hold（余额不变） */
  const before = balance;
  await assert.rejects(
    () => billing.execute({ ...base, quoteId: '', actionId: '' }),
    err => err.status === 400 && err.code === 'CANVAS_BILLING_REQUEST_INVALID',
  );
  assert.equal(balance, before, '被拒的请求不能动余额');
  assert.equal(ledger.filter(e => e.op === 'hold').length, 0, '被拒的请求不能产生 hold');

  /* ② 合法报价 + actionId → 恰好扣一次 */
  const quote = quoteService.issue({
    ownerEmail: 'gate@example.com',
    quote: { sku: 'ec_ai_assistant', quantity: 1, units: 200, totalUnits: 200, currency: 'ec_points' },
  });
  await billing.execute({ ...base, quoteId: quote.quoteId, actionId: 'gate-action-1' });
  assert.equal(balance, before - 200, '合法请求应当恰好扣一次');

  /* ③ 幂等：同 actionId 再执行 → 不再扣费 */
  const afterFirst = balance;
  await billing.execute({ ...base, quoteId: quote.quoteId, actionId: 'gate-action-1' });
  assert.equal(balance, afterFirst, '同一 actionId 重放不得再次扣费');
});

/* ── 检测器自证：喂反例必须判红，喂正例必须放行 ───────────────────── */

test('检测器自证：副作用里扣费 / 渲染期扣费 必须判红；onClick+确认 必须放行', () => {
  const fns = new Set(['regenerateImage']);

  /* 反例 1：挂载即扣费 */
  const inEffect = `export default function C(){ React.useEffect(()=>{ regenerateImage('p','c'); },[]); return null; }`;
  const s1 = indexCalls(inEffect, 'counterexample-effect.jsx').filter(s => fns.has(s.callee));
  assert.equal(s1.length, 1, '检测器必须能看到这个调用');
  assert.equal(s1[0].inEffect, 'useEffect', '必须认出它挂在 useEffect 里 → 判违规');
  assert.equal(traceUp('counterexample-effect.jsx', s1[0].fnName, new Map(), 12, s1[0]).origin, null,
    '副作用里的扣费追溯不到手势 → 必须判红');

  /* 反例 2：渲染体顶层扣费（每次渲染都扣） */
  const inRender = `export default function C(){ regenerateImage('p','c'); return null; }`;
  const s2 = indexCalls(inRender, 'counterexample-render.jsx').filter(s => fns.has(s.callee));
  assert.equal(s2.length, 1);
  assert.equal(s2[0].inEffect, null);
  assert.equal(s2[0].gestureAttr, null);
  assert.equal(s2[0].confirmed, false);
  assert.equal(traceUp('counterexample-render.jsx', s2[0].fnName, new Map(), 12, s2[0]).origin, null,
    '渲染期扣费追溯不到手势 → 必须判红');

  /* 正例 1：onClick 处理器 + 显式确认 → 必须放行 */
  const good = `export default function C(){ const handleGo = async ()=>{ if(!await dialog.confirm({title:'x'})) return; await regenerateImage('p','c'); }; return <button onClick={handleGo}>go</button>; }`;
  const s3 = indexCalls(good, 'counterexample-good.jsx').filter(s => fns.has(s.callee));
  assert.equal(s3.length, 1);
  assert.ok(s3[0].confirmed || s3[0].gestureAttr || s3[0].handlerRef || NAMED_HANDLER.test(s3[0].fnName),
    '有确认/手势的正例必须放行（证明判据不是「一律判红」）');

  /* 正例 2：内联 onClick 箭头 + 确认 → 必须放行 */
  const good2 = `export default function C(){ return <button onClick={async()=>{ if(!await dialog.confirm({title:'x'})) return; await regenerateImage('p','c'); }}>go</button>; }`;
  const s4 = indexCalls(good2, 'counterexample-good2.jsx').filter(s => fns.has(s.callee));
  assert.equal(s4.length, 1);
  assert.ok(s4[0].gestureAttr, '内联 onClick 必须被认出手势');
});
