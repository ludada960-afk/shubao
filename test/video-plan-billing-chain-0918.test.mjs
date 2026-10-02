// test/video-plan-billing-chain-0918.test.mjs
// 2026-09-18 总统筹拍板：视频方案是收了钱的，收了钱就必须真的影响产出。
//
// 改动前的事实（实测，无打桩）：
//   · 前端把 videoPlan 存在 composer 上、用 planReviewed 拦生成，
//     但 createVideoJob 请求体里**根本没有 videoPlan**；
//   · 服务端 /api/video/jobs 把 req.body 直接交给 createJob，**没有任何方案校验**；
//   · 实测构造「无方案」请求 → **202 建单成功**（46,000 单位被 hold），闸门可绕过。
//   → 用户花 1 积分买方案、必须先确认才能生成，但方案对成片零影响 = 半成品。
//
// 本测试把四条钉成契约，防回退。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  VIDEO_PROMPT_LAYER,
  compileVideoRequest,
  compileVideoPlanStructure,
  hasUsableVideoPlan,
  hashVideoPlan,
  assertVideoPlanConfirmed,
} from '../server/videoPlanCompiler.mjs';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const videoGeneration = read('server/videoGeneration.mjs');
const serverIndex = read('server/index.mjs');
const canvas = read('src/pages/EcCanvas/index.jsx');

/* ═══ 2026-09-25 批 AM：**切片判据换成"整个函数体"**（不是放宽，是去掉一个魔数）═══════════════
   本文件原来用「createJob 起点的前 9000 字符」当窗口。那个窗口限制的其实不是
   "闸门在不在建单之前"，而是"注释能写多长"：本批给 createJob 加了本地方案那条分支
   （含必要的说明），INSERT 挪到了 10010 —— 闸门与 INSERT 的相对顺序一个字没变，
   红的却是注释字数。改成按函数体切：**要证明的事完全一样**，而且不再因为多写几句注释误报。 */
/* 返回 createJob 函数体的**结束下标**（数字）：整个函数体就是它的判据窗口，
   不设魔数长度（详见上面那段说明：窗口限制的是注释字数，不是闸门的相对位置）。 */
function functionEnd(source, startIndex) {
  const rest = source.slice(startIndex);
  const end = rest.indexOf('\n  }\n');
  return end > 0 ? startIndex + end : startIndex + 12000;
}

const PLAN = {
  summary: '夏日清爽',
  creativeStrategy: '快节奏',
  beats: [
    { time: '0-2s', label: '开场', detail: '产品特写' },
    { time: '2-5s', label: '使用', detail: '手部动作' },
    { time: '5-8s', label: '收尾', detail: 'Logo' },
  ],
  risks: ['不要出现竞品logo'],
  optimizedPrompt: '一个玻璃杯在阳光下旋转',
  assets: [{ retain: ['杯身纹理清晰'] }],
};

/* ── ① 方案必须真的进生成（服务端权威编译） ─────────────────────── */

test('方案被编译进 prompt，且排在用户文案**之前**（产出结构层高于内容文案层）', () => {
  const out = compileVideoRequest({ prompt: '一只猫在草地上跑', negativePrompt: '', plan: PLAN });
  assert.equal(out.planUsed, true, '有可用方案时必须标记 planUsed');
  assert.ok(out.prompt.includes('分镜节奏'), 'prompt 必须带方案的分镜节奏');
  assert.ok(out.prompt.includes('0-2s 开场'), 'prompt 必须带具体分镜');
  assert.ok(out.prompt.includes('必须保留'), 'prompt 必须带方案要求的保留项');
  /* 顺序：方案块必须出现在用户文案之前 */
  assert.ok(out.prompt.indexOf('分镜节奏') < out.prompt.indexOf('一只猫在草地上跑'),
    '方案结构必须排在用户文案之前（模型读到的第一条就是付费方案）');
});

test('无可用方案时透传（拒绝由闸门负责，编译不擅自拦截）', () => {
  const out = compileVideoRequest({ prompt: '一只猫', negativePrompt: '', plan: null });
  assert.equal(out.planUsed, false);
  assert.equal(out.prompt, '一只猫');
  assert.equal(out.negativePrompt, '');
});

test('三层权威排序沿用既有 PROMPT_LAYER（硬约束 1 > 方案结构 2 > 内容文案 3）', () => {
  assert.deepEqual(VIDEO_PROMPT_LAYER, { HARD_CONSTRAINT: 1, OUTPUT_STRUCTURE: 2, CONTENT_INTENT: 3 });
  const out = compileVideoRequest({ prompt: '一只猫', negativePrompt: '低质量', plan: PLAN });
  assert.equal(out.layers[VIDEO_PROMPT_LAYER.HARD_CONSTRAINT], '低质量');
  assert.ok(out.layers[VIDEO_PROMPT_LAYER.OUTPUT_STRUCTURE].includes('分镜节奏'));
  assert.equal(out.layers[VIDEO_PROMPT_LAYER.CONTENT_INTENT], '一只猫');
});

test('方案风险进 negativePrompt，且硬约束（用户负向词）排在风险**之前**', () => {
  const out = compileVideoRequest({ prompt: 'x', negativePrompt: '低质量', plan: PLAN });
  assert.ok(out.negativePrompt.includes('不要出现竞品logo'), '方案风险必须进负向提示');
  assert.ok(out.negativePrompt.indexOf('低质量') < out.negativePrompt.indexOf('不要出现竞品logo'),
    '硬约束（用户负向词）必须比方案风险更靠前（更权威）');
});

test('hasUsableVideoPlan：必须有 beats(≥3) 或 optimizedPrompt 才算有方案', () => {
  assert.equal(hasUsableVideoPlan(null), false);
  assert.equal(hasUsableVideoPlan({}), false);
  assert.equal(hasUsableVideoPlan({ beats: [] }), false);
  assert.equal(hasUsableVideoPlan(PLAN), true);
  assert.equal(hasUsableVideoPlan({ optimizedPrompt: '可执行提示词' }), true);
});

/* ── ② 服务端闸门：未确认方案不得出片 ───────────────────────────── */

test('assertVideoPlanConfirmed：无方案 / 未确认 / 非 true 都拒绝', () => {
  assert.throws(() => assertVideoPlanConfirmed({ plan: null, planConfirmed: true }),
    (e) => e.code === 'VIDEO_PLAN_REQUIRED' && e.status === 400, '无方案必须拒绝');
  assert.throws(() => assertVideoPlanConfirmed({ plan: PLAN, planConfirmed: false }),
    (e) => e.code === 'VIDEO_PLAN_NOT_CONFIRMED' && e.status === 400, '未确认必须拒绝');
  assert.throws(() => assertVideoPlanConfirmed({ plan: PLAN, planConfirmed: 'yes' }),
    (e) => e.code === 'VIDEO_PLAN_NOT_CONFIRMED', '非布尔 true 一律拒绝（不做真值转换）');
  assert.doesNotThrow(() => assertVideoPlanConfirmed({ plan: PLAN, planConfirmed: true }));
});

test('闸门与编译都在 createJob 内（服务端权威，客户端绕不过）', () => {
  const start = videoGeneration.indexOf('async function createJob(');
  assert.ok(start > 0, '必须能找到 createJob');
  const seg = videoGeneration.slice(start, functionEnd(videoGeneration, start));
  assert.match(seg, /assertVideoPlanConfirmed\(/, 'createJob 内必须有方案闸门');
  assert.match(seg, /compileVideoRequest\(/, 'createJob 内必须做方案编译');
  assert.match(seg, /const prompt = compiled\.prompt;/, '落库的 prompt 必须是编译结果');
  assert.match(seg, /const negativePrompt = compiled\.negativePrompt;/, '落库的 negativePrompt 必须是编译结果');
});

test('闸门文案必须原样到达用户（400 + 可读中文，不是 500 兜底）', () => {
  /* 裁定 #4（2026-09-18 总统筹）：本意就是验证「无方案时的错误行为」的用例，
     应当断言 **这个 400 与这句文案**，而不是断言创建成功。
     createJob 抛出的 Error 带 status/code；HTTP 层（server/index.mjs /api/video/jobs）
     对 <500 的错误**原样透出 error.message**，≥500 才换成兜底文案 —— 这条链路必须钉住，
     否则用户看到的就是「视频任务创建失败，请稍后重试」，根本不知道要先做方案。 */
  const cases = [
    { input: { videoPlan: null, planConfirmed: true }, code: 'VIDEO_PLAN_REQUIRED', message: '请先生成并确认拍摄方案后再生成视频' },
    { input: { videoPlan: PLAN, planConfirmed: false }, code: 'VIDEO_PLAN_NOT_CONFIRMED', message: '请先确认拍摄方案后再生成视频' },
  ];
  for (const { input, code, message } of cases) {
    let thrown = null;
    try { assertVideoPlanConfirmed({ plan: input.videoPlan, planConfirmed: input.planConfirmed }); }
    catch (error) { thrown = error; }
    assert.ok(thrown, code + '：必须抛出');
    assert.equal(thrown.status, 400, code + '：必须是 400（用户可纠正，不是 500）');
    assert.equal(thrown.code, code);
    assert.equal(thrown.message, message, code + '：文案必须逐字一致（前端直接展示）');
  }
  /* HTTP 层透传规则：<500 用 error.message，≥500 用兜底 —— 两分支都要在场 */
  const route = serverIndex.slice(serverIndex.indexOf("app.post('/api/video/jobs'"));
  const routeBody = route.slice(0, route.indexOf('app.get('));
  assert.match(routeBody, /error: error\?\.status && error\.status < 500 \? error\.message : /,
    '4xx 必须透传原始文案（否则用户看不到「先做方案」的引导）');
  assert.match(routeBody, /res\.status\(error\?\.status \|\| 500\)/, '状态码必须透传');
  /* 并且：闸门拒绝时**不得**建单 —— 不产生 job、不 hold 钱 */
  const createJobBody = videoGeneration.slice(videoGeneration.indexOf('async function createJob('));
  const iGate = createJobBody.indexOf('assertVideoPlanConfirmed(');
  const iInsert = createJobBody.indexOf('INSERT INTO video_jobs');
  assert.ok(iGate > 0 && iInsert > iGate, '闸门必须先于 INSERT（拒绝即不建单、不扣费）');
});

test('闸门在 prompt 校验之后、建单之前（拒绝时不产生 job、不扣费）', () => {
  const start = videoGeneration.indexOf('async function createJob(');
  const seg = videoGeneration.slice(start, functionEnd(videoGeneration, start));
  const iGate = seg.indexOf('assertVideoPlanConfirmed(');
  const iInsert = seg.indexOf('INSERT INTO video_jobs');
  assert.ok(iGate > 0 && iInsert > iGate, '闸门必须在 INSERT 之前');
});

/* ── ③ 留痕：plan_hash（内部字段，绝不外露） ─────────────────────── */

test('hashVideoPlan 稳定且区分不同方案', () => {
  const a = hashVideoPlan(PLAN);
  const b = hashVideoPlan({ ...PLAN });
  assert.equal(a, b, '同一方案必须得同一指纹');
  assert.match(a, /^vplan-[0-9a-f]{8}$/, '指纹格式');
  const c = hashVideoPlan({ ...PLAN, optimizedPrompt: '完全不同的提示词' });
  assert.notEqual(a, c, '改了方案内容必须换指纹');
});

test('plan_hash 落库：建表/迁移 + INSERT 都带上', () => {
  assert.match(videoGeneration, /\['plan_hash', "TEXT NOT NULL DEFAULT ''"\]/, 'plan_hash 必须在 migrations 里（兼容既有库）');
  assert.match(videoGeneration, /plan_hash TEXT NOT NULL DEFAULT ''|plan_hash', "TEXT NOT NULL DEFAULT ''"/, '列定义存在');
  assert.match(videoGeneration, /quote_id, plan_hash/, 'INSERT 必须写入 plan_hash');
  assert.match(videoGeneration, /compiled\.planHash \|\| ''/, '写入值必须是编译产出的指纹');
});

test('plan_hash 是内部字段：不得出现在用户可见文案里', () => {
  /* serializeOwnedJob 里不得把 plan_hash 暴露出去 */
  const start = videoGeneration.indexOf('function serializeOwnedJob');
  assert.ok(start > 0, '必须能找到 serializeOwnedJob');
  const seg = videoGeneration.slice(start, start + 2500);
  assert.doesNotMatch(seg, /planHash|plan_hash/, 'plan_hash 不得进入对外序列化（内部留痕字段）');
});

/* ── ④ 客户端负责传，不负责拼 ───────────────────────────────────── */

test('客户端把结构化方案 + 确认标记一起发上去', () => {
  /* ⚠️ 2026-10-02：画布上现在有**两个** createVideoJob 调用点 ——
     视频**生成器**（要带 videoPlan / planConfirmed）与画布「智能去字幕」
     （本机 ffmpeg delogo，走 localSpecs.regions，**不收费方案费**）。
     `indexOf` 取第一个会落到去字幕那条（它定义在 handleToolAction 旁边、排得更靠前），
     于是判据问错了对象。
     ⇒ 锚到「带 videoPlan 的那个建单调用」：取该字段**之前最近**的 createVideoJob。 */
  const planAt = canvas.indexOf('videoPlan: composer.videoPlan');
  assert.ok(planAt > 0, '必须能找到视频生成器带 videoPlan 的建单调用');
  const start = canvas.lastIndexOf('await createVideoJob({', planAt);
  assert.ok(start > 0, '必须能找到 createVideoJob 调用');
  const seg = canvas.slice(start, start + 2600);
  assert.match(seg, /videoPlan: composer\.videoPlan \|\| null/, '必须把 videoPlan 发上去');
  assert.match(seg, /planConfirmed: composer\.planReviewed === true/, '必须把确认标记发上去（严格布尔）');
  /* 客户端**不得**自己拼接方案 —— 拼接是服务端的活 */
  assert.doesNotMatch(seg, /compileVideoRequest|拍摄方案·必须遵循/, '客户端不得自行拼接方案（服务端权威）');
});

test('方案进幂等键：换方案 = 另一次生成', () => {
  const start = canvas.indexOf("'video-job',");
  assert.ok(start > 0, '必须能找到 video 幂等键');
  const seg = canvas.slice(start, start + 900);
  assert.match(seg, /composer\.videoPlan\?\.beats/, '幂等键必须纳入方案内容');
});

/* ── 路由透传 ───────────────────────────────────────────────────── */

test('/api/video/jobs 原样透传 body（方案字段不被路由吞掉）', () => {
  const start = serverIndex.indexOf("app.post('/api/video/jobs'");
  const seg = serverIndex.slice(start, start + 900);
  assert.match(seg, /input: req\.body/, '必须把整个 body 交给 createJob');
});

/* ── 边界：编译不炸 ─────────────────────────────────────────────── */

test('异常输入不炸（空方案 / 缺字段 / 超长）', () => {
  assert.doesNotThrow(() => compileVideoPlanStructure({}));
  assert.doesNotThrow(() => compileVideoRequest({}));
  assert.doesNotThrow(() => compileVideoRequest({ plan: { beats: [null, undefined, {}] } }));
  assert.doesNotThrow(() => compileVideoRequest({ plan: { risks: [null, 1, '有效风险'] } }));
  const long = compileVideoRequest({ prompt: 'x'.repeat(20000), negativePrompt: 'y'.repeat(5000), plan: PLAN });
  assert.ok(long.prompt.length <= 20000, 'prompt 必须有长度上界');
  assert.ok(long.negativePrompt.length <= 1200, 'negativePrompt 必须有长度上界');
});
