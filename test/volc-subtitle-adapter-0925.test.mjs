import assert from 'node:assert/strict';
import test from 'node:test';

import { createVolcSubtitleAdapter, volcSubtitleReadiness } from '../server/volcSubtitleErase.mjs';

/* ═══ 2026-09-25 批 AP：火山字幕擦除适配器（用户拍板「直接接火山API」）════════════════════════════
   这批只做**适配器 + 契约门禁**，不做流水线接线 —— 原因写在适配器文件头：
   本机没有 API Key，未实测的上游路径不许接进作业流水线（会变成"文档里有、点了报错"那一类事故），
   所以产品仍是 public:false、页面上的「自动标记」仍是**不可选 + 写明原因**。
   本门禁守的是"契约忠实"：端点、鉴权头、参数名、状态映射、上传方式 —— 每一条都对着官方文档核对过。

   判据：
     ① 端点与鉴权：标准版/精细化版各自的路径 + `Authorization: Bearer <key>`（不是 AK/SK 签名）；
     ② submit 的参数名：`video_url` / `mode` / `model_version` / `client_token`（照文档，不猜）；
     ③ 缺 Key 时**不假装能用**：submit 抛带 code 的错误，readiness 说人话；
     ④ 状态映射：running/completed/failed → processing/completed/failed，成片地址与时长取出来；
     ⑤ 本地上传走「纯二进制 PUT」（文档原文严禁 multipart）+ 返回 `mediakit://{file_id}`；
     ⑥ 上游拒绝时把原话带回来（带 providerDetail），并按 429/5xx 判可重试。 */

const KEY = 'test-mediakit-key';
const BASE = 'https://mediakit.example.test/api/v1';

function fakeFetch(handler) {
  const calls = [];
  const impl = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    return handler(String(url), options);
  };
  impl.calls = calls;
  return impl;
}

const jsonResponse = (payload, status = 200) => new Response(JSON.stringify(payload), { status, headers: { 'content-type': 'application/json' } });

test('① 端点与鉴权：标准版与精细化版各自的路径，Authorization 用 Bearer API Key', async () => {
  const seen = [];
  const fetchImpl = fakeFetch(async (url, options) => {
    seen.push({ url, auth: options.headers?.Authorization, body: options.body ? JSON.parse(options.body) : null });
    return jsonResponse({ success: true, task_id: 'task-1' });
  });
  const standard = createVolcSubtitleAdapter({ apiKey: KEY, baseUrl: BASE, fetchImpl });
  await standard.submit({ videoUrl: 'https://example.com/a.mp4' }, 'idem-1');
  assert.equal(seen[0].url, `${BASE}/tools/erase-video-subtitle`, '标准版路径照文档');
  assert.equal(seen[0].auth, `Bearer ${KEY}`, '鉴权是 Bearer API Key（不是 AK/SK 签名）');

  const refined = createVolcSubtitleAdapter({ apiKey: KEY, baseUrl: BASE, fetchImpl, refined: true });
  await refined.submit({ videoUrl: 'https://example.com/a.mp4' });
  assert.equal(seen[1].url, `${BASE}/tools/erase-video-subtitle-pro`, '精细化版路径照文档');
  assert.equal(refined.model, 'erase-video-subtitle-pro');
});

test('② submit 的参数名逐条照文档（video_url / mode / model_version / client_token）', async () => {
  let body = null;
  const fetchImpl = fakeFetch(async (_url, options) => {
    body = JSON.parse(options.body);
    return jsonResponse({ success: true, task_id: 'task-2' });
  });
  const adapter = createVolcSubtitleAdapter({ apiKey: KEY, baseUrl: BASE, fetchImpl });
  const task = await adapter.submit({ videoUrl: 'https://example.com/in.mp4' }, 'idem-abc');
  assert.equal(task.id, 'task-2');
  assert.equal(body.video_url, 'https://example.com/in.mp4');
  assert.equal(body.mode, 'Subtitle', '默认 Subtitle = 自动检测字幕（另一档 Text 会连人名地名一起擦，我们不默认用）');
  assert.equal(body.model_version, 'v5');
  assert.equal(body.client_token, 'idem-abc', '幂等键走客户端令牌（≤64 ASCII，我们截断过）');
  assert.equal(body.erase_ratio_location, undefined, '自动标记这一档**不许**带手框（与自动检测互斥）');
});

test('③ 缺 Key 时不假装能用：submit 抛带 code 的错误，readiness 给出人话原因', async () => {
  const adapter = createVolcSubtitleAdapter({ apiKey: '', baseUrl: BASE, fetchImpl: fakeFetch(async () => jsonResponse({})) });
  assert.equal(adapter.enabled, false, '没配 Key 就是没启用');
  await assert.rejects(() => adapter.submit({ videoUrl: 'https://example.com/a.mp4' }), error => {
    assert.equal(error.code, 'VOLC_SUBTITLE_NOT_CONFIGURED');
    return true;
  });
  const readiness = volcSubtitleReadiness('');
  assert.equal(readiness.configured, false);
  assert.match(readiness.reason, /API Key/, '原因要写清缺什么、去哪儿拿');
  assert.match(volcSubtitleReadiness('k').reason, /^$/, '配好了就没有原因可写');
});

test('④ 状态映射与结果字段：running→processing、completed→成片地址、failed→带原因', async () => {
  const payloads = {
    '/api/v1/tasks/t-running': { success: true, status: 'running' },
    '/api/v1/tasks/t-done': { success: true, status: 'completed', video_url: 'https://cdn.example.com/out.mp4', duration: 12 },
    '/api/v1/tasks/t-fail': { success: true, status: 'failed', message: '上游拒绝：视频不可读' },
  };
  const adapter = createVolcSubtitleAdapter({
    apiKey: KEY, baseUrl: BASE,
    fetchImpl: fakeFetch(async url => jsonResponse(payloads[new URL(url).pathname] || {})),
  });
  const running = await adapter.get('t-running');
  assert.equal(running.status, 'processing');
  const done = await adapter.get('t-done');
  assert.equal(done.status, 'completed');
  assert.equal(done.downloadUrl, 'https://cdn.example.com/out.mp4');
  assert.equal(done.duration, 12);
  assert.equal(done.progress, 100);
  const failed = await adapter.get('t-fail');
  assert.equal(failed.status, 'failed');
  assert.match(failed.error, /不可读/, '失败原因要带回来（诊断要用）');
});

test('⑤ 本地上传：先取上传票据，再用**纯二进制 PUT**（文档原文严禁 multipart），最后用 mediakit:// 提交', async () => {
  const calls = [];
  const fetchImpl = fakeFetch(async (url, options) => {
    calls.push({ url, method: options.method, contentType: options.headers?.['Content-Type'], hasStream: Boolean(options.body?.pipe) });
    if (url.endsWith('/tools-sync/request-media-upload-url')) {
      return jsonResponse({ success: true, upload_url: 'https://tos.example.com/put?sig=1', file_id: 'file-9' });
    }
    if (url.startsWith('https://tos.example.com/put')) return new Response('', { status: 200 });
    return jsonResponse({ success: true, task_id: 'task-9' });
  });
  const adapter = createVolcSubtitleAdapter({ apiKey: KEY, baseUrl: BASE, fetchImpl });
  const uploaded = await adapter.uploadLocalFile({ filePath: 'package.json', fileName: 'clip.mp4' });
  assert.equal(uploaded.videoUrl, 'mediakit://file-9', '提交任务时用 mediakit:// 协议');
  assert.equal(calls[1].method, 'PUT');
  assert.equal(calls[1].contentType, 'application/octet-stream', '纯二进制流（严禁 multipart/form-data）');
  assert.equal(calls[1].hasStream, true, 'body 是文件流');
  /* 拿到 mediakit:// 之后能直接 submit */
  const task = await adapter.submit({ videoUrl: uploaded.videoUrl });
  assert.equal(task.id, 'task-9');
});

test('⑥ 上游拒绝时带原话 + 可重试判定（429/5xx 才算暂时性）', async () => {
  const rejectOnce = status => createVolcSubtitleAdapter({
    apiKey: KEY, baseUrl: BASE,
    fetchImpl: fakeFetch(async () => jsonResponse({ success: false, error: 'video_url 不可访问' }, status)),
  });
  await assert.rejects(() => rejectOnce(400).submit({ videoUrl: 'https://example.com/a.mp4' }), error => {
    assert.equal(error.code, 'VOLC_SUBTITLE_REJECTED');
    assert.match(String(error.providerDetail), /不可访问/, '上游原话要带回来');
    assert.equal(error.retryable, false, '4xx 不是暂时性失败');
    return true;
  });
  await assert.rejects(() => rejectOnce(503).submit({ videoUrl: 'https://example.com/a.mp4' }), error => {
    assert.equal(error.retryable, true, '5xx 可以重试');
    return true;
  });
  /* 没给视频地址时是我们自己的输入错了（不是上游） */
  const adapter = createVolcSubtitleAdapter({ apiKey: KEY, baseUrl: BASE, fetchImpl: fakeFetch(async () => jsonResponse({})) });
  await assert.rejects(() => adapter.submit({}), error => error.code === 'VOLC_SUBTITLE_INPUT_REQUIRED');
  /* 成片地址缺失时也要有明确 code（而不是拿 undefined 去下载） */
  const noOutput = createVolcSubtitleAdapter({ apiKey: KEY, baseUrl: BASE, fetchImpl: fakeFetch(async () => jsonResponse({ success: true, status: 'completed' })) });
  await assert.rejects(() => noOutput.download('t', {}), error => error.code === 'VOLC_SUBTITLE_OUTPUT_MISSING');
});
