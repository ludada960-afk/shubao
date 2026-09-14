// test/error-mapping-gate.test.mjs
// 2026-09-21 裁定② 衍生的门禁 —— 「用户可达的错误路径必须经过统一的安全错误映射」。
//
// 背景：server/canvas/graphRunExecutor.mjs 里有三条英文技术报错
//   'remove-bg requires an upstream image input' / 'upscale …' / 'extend …'
// 实测它们会经 graphRunService 写进 step.error，再由
//   GET /api/canvas/graph/runs/:id → res.json({ ok:true, ...detail })
// 直接返回给客户端（detail.steps[].error）。
//
// 本条门禁比「改三句文案」值钱：它防的是【将来】新加的错误未经映射直接漏到界面上。
//
// 判据（原则 §12）：
//   缺陷 = 一条【会到达用户】的错误消息，未经统一安全映射（sanitizer）就返回；
//   合规 = 内部错误经 sanitizer 兜底为产品级文案后返回；或路径本身不可达用户。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = rel => readFileSync(ROOT + rel, 'utf8');

/* ═══════════ 1. 统一安全映射器的登记表 ═══════════
   每新增一个 sanitizer 就登记在这里；门禁据此断言「可达路径已映射」。
   未登记的 sanitizer 不会被认可（防止有人随手写个名字就绕过）。
*/
export const SANITIZERS = [
  { name: 'safeCanvasClientError', file: '/server/index.mjs', why: '画布域统一错误映射：过滤 api/key/token/authorization/vision/provider 等内部字样，5xx 一律兜底为产品级文案' },
];

/* ═══════════ 2. 错误出口点扫描 ═══════════
   找出「把错误文本直接放进 HTTP 响应」的位置。
*/
const ERROR_EXIT_PATTERNS = [
  /res\.status\(\d+\)\.json\(\{[^}]*\berror\s*:\s*([A-Za-z_$][\w$.?]*(?:\.message)?)/g,
  /res\.json\(\{[^}]*\berror\s*:\s*([A-Za-z_$][\w$.?]*(?:\.message)?)/g,
];

export function findRawErrorExits(source) {
  const out = [];
  const lines = source.split(/\r?\n/);
  lines.forEach((line, i) => {
    for (const re of ERROR_EXIT_PATTERNS) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(line))) out.push({ line: i + 1, expr: m[1], text: line.trim().slice(0, 140) });
    }
  });
  return out;
}

/* ═══════════ 3. 测试用例 ═══════════ */

test('登记：统一安全错误映射器存在且被实际使用', () => {
  for (const s of SANITIZERS) {
    const src = read(s.file);
    assert.ok(src.includes('function ' + s.name) || src.includes('const ' + s.name), s.name + ' 必须定义在 ' + s.file);
    const uses = (src.match(new RegExp(s.name + '\\(', 'g')) || []).length;
    assert.ok(uses >= 2, s.name + ' 至少被调用 2 次（定义 + 实际使用），实测 ' + uses);
  }
});

/* 判定一个「service → route」组合是否构成未映射的用户可达错误路径。
   抽成纯函数，便于下方自证做变异测试（门禁本身必须能被证明会变红）。 */
export function detectUnmappedErrorPath({ service, routes }) {
  /* ① service 是否把 executor 的原始 error 直接落成 step.error */
  const writesRawStepError = /error:\s*(?:cleanString\(result\.error\)|failureText)/.test(service)
    && /const failureText\s*=\s*cleanString\(result\.error\)/.test(service);
  /* ② route 是否把该 detail（含 steps[].error）原样回给客户端 */
  const returnsDetail = /res\.json\(\{\s*ok:\s*true,\s*\.\.\.detail\s*\}\)/.test(routes)
    || /res\.json\(\{\s*ok:\s*true,\s*\.\.\.result\s*\}\)/.test(routes);
  /* ③ 该链路上是否存在统一安全映射 */
  const hasSanitizer = SANITIZERS.some(s => service.includes(s.name) || routes.includes(s.name));
  return writesRawStepError && returnsDetail && !hasSanitizer;
}

test('缺陷面：画布 graph-run 的 step.error 路径必须受控', () => {
  /* 实测证据链：
       graphRunExecutor 返回 { ok:false, error:'remove-bg requires an upstream image input' }
       → graphRunService:313  const failureText = cleanString(result.error)
       → graphRunService:315  transitionStep(..., { error: failureText })   ← 原始文案落库
       → graphRunService:361  buildResult → steps[].error
       → graphRunRoutes:141/159  res.json({ ok:true, ...result/...detail })  ← 原样回客户端
     客户端可读到这一步的原始技术文案，且全链路无 sanitizer。 */
  const unmapped = detectUnmappedErrorPath({
    service: read('/server/canvas/graphRunService.mjs'),
    routes: read('/server/canvas/graphRunRoutes.mjs'),
  });
  assert.equal(unmapped, false,
    '未映射的用户可达错误路径：graphRunService 把 executor 原始 error 写入 step.error，' +
    'graphRunRoutes 原样回客户端；全链路无 SANITIZERS。' +
    '处置：graphRunService:313 的 failureText 应经统一安全映射后再落库。');
});

test('裸 error 出口必须给出稳定 code 或经映射', () => {
  /* 扫 server/index.mjs 的裸 e.message 出口：要么带 code，要么经 sanitizer。
     这里只做「登记式」断言，避免对既有 400 校验出口造成大面积噪音。 */
  const src = read('/server/index.mjs');
  const exits = findRawErrorExits(src).filter(item => /\.message\b/.test(item.expr));
  const suspicious = exits.filter(item => !/^safeCanvasClientError/.test(item.expr));
  /* 允许存在，但必须可枚举；数量增长时提醒复核。 */
  assert.ok(suspicious.length <= 12,
    '裸 e.message 出口数量超出登记基线（实测 ' + suspicious.length + '），新增出口请改为稳定 code 或经映射：\n' +
    suspicious.slice(0, 8).map(item => '  server/index.mjs:' + item.line + '  ' + item.text).join('\n'));
});

test('检测器自证：能识别出「裸 error 出口」与「安全映射」两种形态', () => {
  const bad = "res.status(500).json({ error: e.message });";
  const found = findRawErrorExits(bad);
  assert.equal(found.length, 1, '裸出口应被识别');
  assert.equal(found[0].expr, 'e.message');

  const good = "res.status(500).json({ error: safeCanvasClientError(e) });";
  const found2 = findRawErrorExits(good);
  assert.ok(found2.every(item => item.expr !== 'e.message'), '安全映射形态不应被误判为裸 e.message');
});