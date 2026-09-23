// test/plan-affects-output-audit-0918.test.mjs
// 2026-09-18 总统筹不变式：**凡是收了方案钱的流程，方案必须真的影响产出**。
//
// 本测试把三条流程的「方案是否进请求」钉成契约 —— 不是看代码猜，而是断言
// 「编译产物确实被送进生成请求」这一事实，任何一条断了就红。
//
// 审计结论（改动前 → 改动后）：
//   ① 视频生成   ：断 → **已接上**（本 commit）
//   ② 电商套图   ：本来就是通的（suitePlan 编译进 sceneStyle）—— 补测试固化
//   ③ 万物上身   ：不做方案（直接进画布 → 设计方向节点），无「方案费」→ 不适用
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

/* ═══ 2026-09-25 批 AM：**切片判据换成"整个函数体"**（不是放宽，是去掉一个魔数）═══════════════════
   原来用「createJob 起点的前 9000 字符」当窗口。那个窗口限制的其实不是"闸门在不在建单之前"，
   而是"注释能写多长"：本批给 createJob 加了本地方案那条分支（含必要的说明），INSERT 挪到了
   10010 —— 闸门与 INSERT 的相对顺序一个字没变，红的却是注释字数。改成按函数体切：
   **要证明的事完全一样**，而且不再因为后来人多写几句注释就误报。 */
/* 返回 createJob 函数体的**结束下标**（数字）：整个函数体就是它的判据窗口，
   不设魔数长度（详见上面那段说明：窗口限制的是注释字数，不是闸门的相对位置）。 */
function functionEnd(source, startIndex) {
  const rest = source.slice(startIndex);
  const end = rest.indexOf('\n  }\n');
  return end > 0 ? startIndex + end : startIndex + 12000;
}
const canvas = read('src/pages/EcCanvas/index.jsx');

/* ── ① 视频生成：方案必须进请求 ─────────────────────────────────── */

test('视频：请求体带结构化方案 + 确认标记', () => {
  const start = canvas.indexOf('await createVideoJob({');
  const seg = canvas.slice(start, start + 2600);
  assert.match(seg, /videoPlan: composer\.videoPlan/, 'videoPlan 必须进请求体');
  assert.match(seg, /planConfirmed: composer\.planReviewed === true/, 'planConfirmed 必须进请求体');
});

test('视频：服务端把方案编译进 prompt（不是客户端自己拼）', () => {
  const gen = read('server/videoGeneration.mjs');
  const start = gen.indexOf('async function createJob(');
  const seg = gen.slice(start, functionEnd(gen, start));
  assert.match(seg, /compileVideoRequest\(/, '服务端必须编译方案');
  assert.match(seg, /const prompt = compiled\.prompt;/, '落库 prompt = 编译结果');
});

/* ── ② 电商套图：方案必须进 sceneStyle ─────────────────────────── */

test('套图：suitePlan 的结构字段全部编译进生成请求的 sceneStyle', () => {
  const start = canvas.indexOf('await generateEcommerceSuite({');
  assert.ok(start > 0, '必须能找到套图生成调用');
  const seg = canvas.slice(start, start + 3000);
  /* 方案里决定「怎么出图」的结构字段，必须逐条进请求 */
  for (const field of ['brief', 'visualDirection', 'productStrategy', 'audience', 'composition', 'copyRules', 'qualityRisks']) {
    assert.ok(seg.includes('suitePlan.' + field), `方案字段 ${field} 必须进生成请求`);
  }
  assert.match(seg, /sceneStyle: \[/, '必须有 sceneStyle（承载方案结构）');
});

test('套图：三层权威编译结果（supplement）也必须进请求', () => {
  const start = canvas.indexOf('await generateEcommerceSuite({');
  const seg = canvas.slice(start, start + 3000);
  assert.match(seg, /authority\.supplement\.text/, '第 3 层补充信息必须进请求');
});

test('套图：生成前先算一次权威（越权/冲突显式告知，不静默改用户意图）', () => {
  const start = canvas.indexOf('const authority = resolvePromptAuthority({');
  assert.ok(start > 0, '生成前必须调用 resolvePromptAuthority');
  const seg = canvas.slice(start, start + 900);
  assert.match(seg, /plan: composer\.suitePlan/, '必须把方案传进权威计算');
  assert.match(canvas.slice(start, start + 1400), /authority\.notices\.forEach/, 'notices 必须展示给用户');
});

/* ── ③ 万物上身：不做方案 → 明确记录「不适用」，防止有人误加 ────── */

test('万物上身：不产生方案费（走画布设计方向节点），本不变式不适用', () => {
  const ecMode = read('src/pages/Home/EcMode.jsx');
  assert.match(ecMode, /anything_tryon/, '必须仍有万物上身入口');
  /* 它发射到画布时带的是 abilityRecipe，不是「已付费方案」 */
  assert.match(ecMode, /abilityRecipe:/, '发射参数带 abilityRecipe');
  /* 画布侧 try-on 不消耗方案费 SKU */
  assert.doesNotMatch(canvas, /ec_direction_analysis[\s\S]{0,200}anything_tryon/, 'try-on 不应被算作方案费流程');
});

/* ── 不变式本身：有方案费的流程必须能在服务端被拒 ──────────────── */

test('不变式：视频链有服务端闸门（无方案/未确认 → 400，不建单不扣费）', () => {
  const gen = read('server/videoGeneration.mjs');
  assert.match(gen, /assertVideoPlanConfirmed\(/, '必须有服务端闸门');
  const start = gen.indexOf('async function createJob(');
  const seg = gen.slice(start, functionEnd(gen, start));
  assert.ok(seg.indexOf('assertVideoPlanConfirmed(') < seg.indexOf('INSERT INTO video_jobs'),
    '闸门必须在建单之前（拒绝时零副作用）');
});

test('不变式：方案留痕（plan_hash）落库且不对外暴露', () => {
  const gen = read('server/videoGeneration.mjs');
  assert.match(gen, /\['plan_hash',/, 'plan_hash 必须有迁移');
  assert.match(gen, /quote_id, plan_hash/, 'INSERT 必须写 plan_hash');
  const ser = gen.indexOf('function serializeOwnedJob');
  assert.doesNotMatch(gen.slice(ser, ser + 2500), /plan_hash|planHash/, '不得对外序列化');
});
