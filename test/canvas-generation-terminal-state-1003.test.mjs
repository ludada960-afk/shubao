// test/canvas-generation-terminal-state-1003.test.mjs
// 门禁：**一次失败的生成尝试必须落终态**，否则前端会把轮询跑满、界面永远"生成中"。
//
// 现场（用户 240485042@qq.com，2026-10-03 13:23，canvas_generation_jobs 实录）：
//   request_id        canvas_d8479ae5…
//   status            **queued**          ← 卡在这里
//   provider_job_id   ""                  ← 上游压根没受理
//   error_json        {"code":"PROVIDER_ERROR","status":503,"retryable":true,
//                      "detail":"No available channel for model image2-5-sunburst"}
// 同一用户同一天 image2 连着 completed 6 条（14:02 / 14:07 / 14:11 / 14:15 …），
// 只有 2.5 卡住 —— 与用户反馈「image2 能生成，2.5 生成不了」完全一致。
//
// 机制：`inspect()` 只在 `status==='failed'` 时返回终态；`queued` 会一直返回 202 processing，
// 客户端 `pollCanvasGenerationResult` 最多轮询 180 次（≈15 分钟）⇒ 用户看到「一直生成中」。
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STORE = fs.readFileSync(path.join(ROOT, 'server/canvasGenerationStore.mjs'), 'utf8');
const SERVICE = fs.readFileSync(path.join(ROOT, 'server/canvasGenerationService.mjs'), 'utf8');
const API = fs.readFileSync(path.join(ROOT, 'src/services/api.js'), 'utf8');

const stripComments = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

test('① 「可重试」不等于「这个任务会自己变好」', () => {
  /* ⚠️ 先剥注释 —— 说明里把旧代码原样引用了一遍，不剥的话这条断言会被自己的注释炸掉。 */
  const fn = stripComments(STORE).slice(stripComments(STORE).indexOf('recordError('));
  const body = fn.slice(0, fn.indexOf('return get(requestId)'));

  /* 判据必须是「上游有没有受理」，而不是 retryable */
  assert.match(body, /acceptedByProvider\s*=\s*Boolean\(current\.providerJobId\)/,
    '必须先看有没有拿到上游任务号');
  assert.match(body, /const status = \(!acceptedByProvider \|\| !retryable\) \? 'failed' : current\.status/,
    '没有 provider_job_id ⇒ 一律落终态 failed');
  assert.doesNotMatch(body, /const status = retryable \? current\.status : 'failed'/,
    '旧写法把「这次尝试可重试」当成「任务会自己变好」，于是永远停在 queued');
});

test('② 没拿到上游任务号时，不允许留在非终态', () => {
  /* 客户端只认终态：status 为 failed 时抛错，否则继续轮询 */
  assert.match(SERVICE, /if \(job\.status === 'failed'\) \{[\s\S]{0,200}status: 'failed'/,
    'inspect 必须把 failed 作为终态返回');
  assert.match(API, /if \(response\.ok && data\.status === 'failed'\) \{/,
    '客户端看到 failed 必须立刻停止轮询并报错');
  /* 轮询上限：即使走到头也不能是"永远生成中"，而要有明确文案 */
  assert.match(API, /maxAttempts = 180/);
  assert.match(API, /图片仍在生成，请稍后继续查看/,
    '兜底文案必须说明这是超时，而不是让用户干等');
});

test('③ 已受理但上游报错的，仍可保持非终态等恢复（别把这条判死）', () => {
  const clean = stripComments(STORE);
  const fn = clean.slice(clean.indexOf('recordError('));
  const body = fn.slice(0, fn.indexOf('return get(requestId)'));
  /* 有 provider_job_id 且 retryable 时保留原状态 —— 上游可能只是暂时 5xx，
     任务号还在，值得继续等。两条路径都要在。 */
  assert.match(body, /: current\.status;/,
    '已受理 + 可重试时保留原状态继续等');
});

test('④ 失败路径必须把错误写进 error_json（前端要拿得到原因）', () => {
  const fn = STORE.slice(STORE.indexOf('recordError('));
  const body = fn.slice(0, fn.indexOf('return get(requestId)'));
  assert.match(body, /SET status = \?, error_json = \?, lease_token = NULL/,
    '终态与原因必须一起落库');
  assert.match(body, /JSON\.stringify\(error\)/);
});
