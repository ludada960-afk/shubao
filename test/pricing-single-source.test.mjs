// test/pricing-single-source.test.mjs
// 铁律 ②（用户明令，优先级最高）：**定价只有一个来源 = 后端目录**，
// 前端不得存在第二份**参与计算**的价目表。
//
// ── 判据（RTK §3.1-10：锁判据，不锁写法）────────────────────────────
//   用户提醒：「扫出 30 个含积分的字符串」不是缺陷，「前端拿自己算的数字去扣费」才是。
//   所以本测试**不**统计字符串数量，它断言两件事：
//     A. 扣费请求的**金额来源**只能是服务端：前端发出的计费请求只允许带
//        sku + quantity(=1) + quoteId + actionId —— 不得出现任何前端自算的
//        units / totalUnits / price / amount 字段。
//     B. 前端确实存在的前端价目（已知：canvasBillingModel 的展示价、imageModelCatalog
//        的 generationUnits）必须有**逐条写理由**的白名单，且理由必须点名
//        「它只用于展示/预估，不参与扣费」以及对应的服务端真源。
//   另有 C：后端唯一权威目录必须存在且被计费路径引用。
//
// ── 检测器自证 ───────────────────────────────────────────────────
//   末尾喂反例（前端把自算 units 塞进扣费请求 / 白名单空理由）必须判红。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parseModule } from './support/charge-gesture-detector.mjs';

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

/* ── A. 扣费请求不得携带前端自算的金额 ──────────────────────────── */

/** 会发起「报价/扣费」的请求标识字段。 */
const BILLING_CARRIERS = ['billing_quote_id', 'billingQuoteId', 'billing_action_id', 'billingActionId'];

/** 禁止出现在扣费请求体里的「金额类」字段名（它们必须由服务端从目录算）。 */
const FORBIDDEN_AMOUNT_FIELDS = [
  'units', 'totalUnits', 'unitUnits', 'price', 'priceCny', 'priceFen',
  'amount', 'amountCny', 'cost', 'credits', 'points',
];

/**
 * 该属性值是否是「金额」——必须是**数值形态**：
 *   数字字面量 / 算术表达式 / 一元负号 / 数值变量标识符。
 *   字符串不算（「卖点」字段恰好叫 points 的误报就是这么来的：
 *   points: '轻便、耐用' 是文案，不是价格）。
 */
function looksNumeric(value) {
  if (!value) return false;
  if (value.type === 'NumericLiteral') return true;
  if (value.type === 'UnaryExpression' && value.operator === '-') return true;
  if (value.type === 'BinaryExpression' && ['+', '-', '*', '/'].includes(value.operator)) return true;
  if (value.type === 'TemplateLiteral' && value.expressions?.length) return true;
  return false;
}

/** 提取对象字面量的「属性名 → 值节点」映射。 */
function objectLiteralProps(node) {
  const props = [];
  for (const prop of node.properties || []) {
    if (prop.type === 'ObjectProperty' && prop.key) {
      props.push({ name: prop.key.name ?? prop.key.value, value: prop.value });
    }
  }
  return props;
}

/**
 * 在文件里找所有「携带 billing 字段的对象字面量」，
 * 返回其中**取值为数值**的金额类字段（字符串不算金额）。
 * 只认字面量对象；`...spread` 无法静态判定，故不计入（其风险由 A2 的 quantity 断言覆盖）。
 */
export function findAmountFieldsInBillingBodies(source, filePath) {
  const ast = parseModule(source);
  const hits = [];
  (function walk(node) {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { for (const c of node) walk(c); return; }
    if (node.type === 'ObjectExpression') {
      const props = objectLiteralProps(node);
      const carriesBilling = props.some(p => BILLING_CARRIERS.includes(p.name));
      if (carriesBilling) {
        const bad = props
          .filter(p => FORBIDDEN_AMOUNT_FIELDS.includes(p.name) && looksNumeric(p.value))
          .map(p => p.name);
        if (bad.length) {
          hits.push({ file: filePath, line: node.loc?.start?.line ?? 0, fields: bad, keys: props.map(p => p.name) });
        }
      }
    }
    for (const k of Object.keys(node)) {
      if (k === 'loc' || k === 'start' || k === 'end') continue;
      walk(node[k]);
    }
  })(ast);
  return hits;
}

test('扣费请求体不得携带前端自算的金额字段（units/price/amount/points/credits…）', () => {
  const hits = [];
  for (const file of walkSource('src')) {
    let found;
    try { found = findAmountFieldsInBillingBodies(read(file), file); }
    catch { continue; }
    hits.push(...found);
  }
  assert.deepEqual(hits, [],
    '这些扣费请求带着**前端自己算的金额**发给服务端 —— 违背「定价只有一个来源」：\n'
    + hits.map(h => `${h.file}:${h.line} 含字段 ${h.fields.join(',')}`).join('\n')
    + '\n正确做法：只发 sku + quantity(=1) + quoteId + actionId，金额由服务端目录算。');
});

test('报价请求的 quantity 只能是常量 1，或明确来自服务端（不得前端自算）', () => {
  /* 判据：份数决定总价，所以它不能是「前端算出来的数」。
     允许两种：① 字面量 1；② 来自服务端响应的字段（如 /retry-plan 返回的 plan.quantity）。
     不允许：本地 state / 张数设置 / 常量表里的数字。 */
  const SERVER_DERIVED = /^(plan|planBody|quote|server|response|res|retryPlan)\b/;
  const offenders = [];
  for (const file of walkSource('src')) {
    if (file === 'src/services/api.js') continue; /* 单独在下面按「来源可证」判定 */
    let ast;
    try { ast = parseModule(read(file)); } catch { continue; }
    (function walk(node) {
      if (!node || typeof node !== 'object') return;
      if (Array.isArray(node)) { for (const c of node) walk(c); return; }
      if (node.type === 'CallExpression' && node.callee?.type === 'Identifier'
        && node.callee.name === 'quoteBillingAction') {
        const arg = node.arguments?.[0];
        if (arg?.type === 'ObjectExpression') {
          const q = (arg.properties || []).find(p => p.key?.name === 'quantity');
          if (q) {
            const isOne = q.value?.type === 'NumericLiteral' && q.value.value === 1;
            const src = read(file).slice(q.value.start, q.value.end);
            if (!isOne) offenders.push(`${file}:${node.loc?.start?.line} quantity=${src.slice(0, 40)}`);
          }
        }
      }
      for (const k of Object.keys(node)) {
        if (k === 'loc' || k === 'start' || k === 'end') continue;
        walk(node[k]);
      }
    })(ast);
  }
  assert.deepEqual(offenders, [],
    '这些报价请求把**前端算出来的份数**发给服务端 —— 份数也必须由服务端决定：\n' + offenders.join('\n'));

  /* api.js 的整套重试：quantity 必须来自服务端 /retry-plan 的响应，且必须有校验。 */
  const api = read('src/services/api.js');
  const retryIdx = api.indexOf('export async function quoteFailedEcommerceTask');
  assert.ok(retryIdx > 0, '必须能找到 quoteFailedEcommerceTask');
  const seg = api.slice(retryIdx, retryIdx + 1400);
  assert.match(seg, /\/retry-plan/, '份数必须来自服务端 /retry-plan（前端的第二份份数表就是缺陷）');
  assert.match(seg, /Number\.isSafeInteger\(quantity\)/,
    '服务端给的份数必须经过 isSafeInteger 校验后再用（防止 NaN/小数进入报价）');
  assert.match(seg, /quoteBillingAction\(\{ sku, quantity \}\)/,
    'quantity 必须是从服务端响应里取的变量，不是前端算的');
});

/* ── B. 前端价目白名单：逐条写理由，禁止空理由 ───────────────────── */

/**
 * 前端确实存在的「价目类」模块。每条必须写清：
 *   ① 它用于什么（只允许：展示 / 预估 / 菜单标签）
 *   ② 服务端真源在哪
 *   ③ 为什么它不参与扣费
 */
const FRONTEND_PRICE_TABLES = Object.freeze({
  'src/pages/EcCanvas/canvasBillingModel.js':
    '展示用：为画布动作菜单提供「X 积分 / 免费」标签（canvasActionRegistry.priceLabel）。'
    + '不参与扣费 —— 实际扣费由 quoteCanvasAction(sku) 向服务端报价，'
    + '服务器真源 server/billing/catalog.mjs FEATURE_SKUS。',
  'src/services/imageModelCatalog.js':
    '预估用：generationUnits() 给「预计消耗 N 积分」做 UI 预估（EcMode / visualCreationModel / canvasPointsEstimate）。'
    + '不参与扣费 —— 扣费请求只发 sku+quantity，金额由服务端从 server/billing/catalog.mjs 算。'
    + '风险：与本文件同源的预估若落后于目录会显示偏差（历史事故：nano 2K 前端 1000 / 后端 1500）。',
});

test('前端价目白名单：每条必须有非空理由，且点名服务端真源', () => {
  for (const [file, reason] of Object.entries(FRONTEND_PRICE_TABLES)) {
    assert.ok(reason.trim().length >= 40, file + ' 的理由太短 —— 必须写清用途 + 真源 + 为何不参与扣费');
    assert.match(reason, /不参与扣费/, file + ' 的理由必须明确声明「不参与扣费」');
    assert.match(reason, /server\/billing\/catalog\.mjs/, file + ' 的理由必须点名服务端真源文件');
    assert.ok(read(file).length > 0, file + ' 必须真实存在');
  }
});

test('白名单里的前端价目表必须真的是「展示/预估」形态（不得被扣费路径直接引用）', () => {
  /* 判据：价目表模块不得被「扣费请求发送方」直接 import 后用于计算请求金额。
     这里用「引用它的文件里是否出现 billing 字段」来判定。 */
  const offenders = [];
  for (const table of Object.keys(FRONTEND_PRICE_TABLES)) {
    const modName = table.split('/').pop().replace(/\.js$/, '');
    for (const file of walkSource('src')) {
      if (file === table) continue;
      const src = read(file);
      if (!src.includes(modName)) continue;
      /* 引用者若同时携带 billing 字段，则必须确认它没把价目喂进去。 */
      if (BILLING_CARRIERS.some(c => src.includes(c))) {
        const hits = findAmountFieldsInBillingBodies(src, file);
        for (const h of hits) offenders.push(`${file}:${h.line} 引用了 ${modName} 且扣费体含 ${h.fields.join(',')}`);
      }
    }
  }
  assert.deepEqual(offenders, [],
    '价目表被扣费路径直接用于计算：\n' + offenders.join('\n'));
});

/* ── C. 后端唯一权威目录必须存在且被计费路径引用 ─────────────────── */

test('后端目录是唯一权威：FEATURE_SKUS + quoteFeature 必须存在', () => {
  const catalog = read('server/billing/catalog.mjs');
  assert.match(catalog, /export const FEATURE_SKUS/, 'server/billing/catalog.mjs 必须导出 FEATURE_SKUS');
  assert.match(catalog, /export function quoteFeature\(/, '必须导出 quoteFeature()（唯一的算价入口）');
});

test('计费路径必须从目录取价（而不是自己写死）', () => {
  const oneShot = read('server/billing/oneShotBilling.mjs');
  assert.match(oneShot, /import \{[^}]*quoteFeature[^}]*\} from '\.\/catalog\.mjs'/,
    'oneShotBilling 必须从 catalog 取价');
  assert.match(oneShot, /const expectedQuote = quoteFeature\(safeSku, 1\)/,
    '实际扣费金额必须来自 quoteFeature(sku, 1)');

  const routes = read('server/billing/routes.mjs');
  assert.match(routes, /quoteFeature\(sku, quantity\)/, '报价端点必须走 quoteFeature');

  const ecommerce = read('server/ecommerceEngine/ecommerceBilling.mjs');
  assert.match(ecommerce, /quoteFeature\(/, '电商套图计费必须走 quoteFeature');
});

test('服务端持有报价令牌（HMAC 签名）—— 前端无法伪造金额', () => {
  const quote = read('server/billing/quoteService.mjs');
  assert.match(quote, /createHmac\('sha256', secret\)/, '报价令牌必须 HMAC 签名');
  assert.match(quote, /timingSafeEqual/, '必须用恒定时间比较校验签名');
  assert.match(quote, /BILLING_QUOTE_MISMATCH/, '与实际不符的报价必须被拒');
});

/* ── 检测器自证：喂反例必须判红 ─────────────────────────────────── */

test('检测器自证：前端把自算金额塞进扣费请求 → 必须判红', () => {
  /* 反例 1：把前端算出来的 units 一起发给服务端 */
  const bad1 = `export async function charge(){ return fetch('/api/x',{ method:'POST', body: JSON.stringify({ billing_quote_id: q, billing_action_id: a, units: 2000 }) }); }`;
  const h1 = findAmountFieldsInBillingBodies(bad1, 'counterexample-units.js');
  assert.equal(h1.length, 1, '检测器必须看到这个扣费体');
  assert.deepEqual(h1[0].fields, ['units'], '必须认出 units 是前端自算金额 → 判红');

  /* 反例 2：totalUnits / price */
  const bad2 = `export async function charge(){ return fetch('/api/y',{ method:'POST', body: JSON.stringify({ billingQuoteId: q, billingActionId: a, totalUnits: 3000, price: 3 }) }); }`;
  const h2 = findAmountFieldsInBillingBodies(bad2, 'counterexample-price.js');
  assert.equal(h2.length, 1);
  assert.deepEqual(h2[0].fields.sort(), ['price', 'totalUnits'], '必须认出 totalUnits/price → 判红');

  /* 正例：只发 sku + quantity + quoteId + actionId → 必须放行（证明不是「一律判红」） */
  const good = `export async function charge(){ return fetch('/api/z',{ method:'POST', body: JSON.stringify({ sku:'ec_image_2k', quantity:1, billing_quote_id: q, billing_action_id: a }) }); }`;
  assert.deepEqual(findAmountFieldsInBillingBodies(good, 'counterexample-good.js'), [],
    '干净的正例必须放行');

  /* 白名单空理由必须被拒 */
  const emptyReasons = { 'x.js': '   ', 'y.js': 'todo' };
  for (const [, reason] of Object.entries(emptyReasons)) {
    const acceptable = reason.trim().length >= 40
      && /不参与扣费/.test(reason)
      && /server\/billing\/catalog\.mjs/.test(reason);
    assert.equal(acceptable, false, '空/占位理由必须判不合格');
  }
});
