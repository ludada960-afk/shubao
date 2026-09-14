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
  chargeFunctions, indexCalls, traceUp, NAMED_HANDLER, parseModule, buildParents,
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

/* ── 裁定③：为**无效请求**扣费 = 铁律①的变体（用户没拿到东西却付了钱）── */

test('无效输入必须在**建 hold 之前**被拒 —— 不得先扣一笔再退（用户可见余额抖动）', () => {
  const index = read('server/index.mjs');
  const at = index.indexOf("app.post('/api/video/plans'");
  assert.ok(at > 0, '必须能找到 /api/video/plans');
  const seg = index.slice(at, at + 2200);
  /* 判据：空/全空白 prompt 提前 400，且这个 400 出现在任何计费调用之前。 */
  assert.match(seg, /if \(!String\(req\.body\?\.prompt \|\| ''\)\.trim\(\)\)/,
    '空/全空白 prompt 必须被拒');
  assert.match(seg, /VIDEO_PROMPT_REQUIRED/, '必须复用既有的 VIDEO_PROMPT_REQUIRED 口径');
  const rejectAt = seg.search(/VIDEO_PROMPT_REQUIRED/);
  const chargeAt = seg.search(/canvasOneShotBilling\.execute\(/);
  assert.ok(chargeAt > 0, '该路由确实会扣费（否则本断言无意义）');
  assert.ok(rejectAt < chargeAt,
    '空 prompt 的拒绝必须发生在扣费调用**之前** —— 否则就是「先扣再退」，用户会看到余额抖动');
});

test('视频任务与视频方案对 prompt 的口径必须一致（防止只修一处）', () => {
  const index = read('server/index.mjs');
  const generation = read('server/videoGeneration.mjs');
  assert.match(generation, /VIDEO_PROMPT_REQUIRED/, '/api/video/jobs 侧的既有校验');
  const at = index.indexOf("app.post('/api/video/plans'");
  assert.match(index.slice(at, at + 2200), /VIDEO_PROMPT_REQUIRED/,
    '/api/video/plans 侧必须同口径 —— 同一个「视频内容」概念不能两套判定');
});

/* ── 裁定①：挂载不得自动扣费（刷新/后退/深链都会重新挂载）───────────── */

test('设计方向页挂载时不得发起计费分析（刷新 3 次只扣一次）', () => {
  const dd = read('src/pages/Home/ec/DesignDirection.jsx');
  /* 判据（AST，不靠正则猜边界）：挂载级 useEffect 的函数体里，
     不得出现任何**计费发起**调用（quoteBillingAction / 计费型的 loadDirections）。
     允许「读取上次未消费凭证」(loadEcommerceDirectionRefreshAction) —— 那是本地读，不发请求。 */
  const ast = parseModule(dd);
  const parents = buildParents(ast);
  const mountEffects = [];
  for (const node of ast.program.body) {
    /* 组件是 function 声明；遍历其体内所有 CallExpression，找 useEffect(fn, []) */
  }
  (function walk(node) {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { for (const c of node) walk(c); return; }
    if (node.type === 'CallExpression'
      && node.callee?.type === 'Identifier'
      && ['useEffect', 'useLayoutEffect'].includes(node.callee.name)) {
      const deps = node.arguments?.[1];
      const isMount = deps?.type === 'ArrayExpression' && deps.elements.length === 0;
      if (isMount) mountEffects.push(node.arguments?.[0]);
    }
    for (const k of Object.keys(node)) {
      if (k === 'loc' || k === 'start' || k === 'end') continue;
      walk(node[k]);
    }
  })(ast);

  assert.ok(mountEffects.length > 0, '必须能找到挂载级 effect（否则本断言没有作用对象）');
  const offenders = [];
  for (const fn of mountEffects) {
    if (!fn) continue;
    (function walk(node) {
      if (!node || typeof node !== 'object') return;
      if (Array.isArray(node)) { for (const c of node) walk(c); return; }
      if (node.type === 'CallExpression' && node.callee?.type === 'Identifier') {
        if (['quoteBillingAction', 'loadDirections'].includes(node.callee.name)) {
          offenders.push(node.callee.name + ' (line ' + (node.loc?.start?.line ?? '?') + ')');
        }
      }
      for (const k of Object.keys(node)) {
        if (k === 'loc' || k === 'start' || k === 'end') continue;
        walk(node[k]);
      }
    })(fn);
  }
  assert.deepEqual(offenders, [],
    '挂载级 effect 里出现了计费发起调用 —— 刷新/后退/深链进入都会重新挂载 → 每次都再扣一次：\n'
    + offenders.join('\n'));

  /* 必须存在一个显式的用户触发入口，并挂在按钮上 */
  assert.match(dd, /const handleStartAnalysis = useCallback\(/, '必须有显式的「开始分析」用户手势入口');
  assert.match(dd, /onClick=\{handleStartAnalysis\}/, '该入口必须挂在按钮 onClick 上');
});

test('设计方向的 actionId 必须是稳定键（同草稿刷新命中同一条记录 → replay）', () => {
  const dd = read('src/pages/Home/ec/DesignDirection.jsx');
  assert.match(dd, /stableCanvasActionId\(\[/, '分析必须用稳定键，否则刷新会生成新 UUID → 再扣一次');
  const start = dd.indexOf('stableCanvasActionId([');
  const seg = dd.slice(start, start + 400);
  assert.match(seg, /'ec-direction-analysis'/, '稳定键必须含动作标识');
  assert.match(seg, /ownerEmail/, '必须含 owner');
  assert.match(seg, /draftId/, '必须含 draft —— 「同一草稿」是幂等的作用域');
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
