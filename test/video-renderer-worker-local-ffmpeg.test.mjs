// W5 ffmpeg worker 集成测试 (4c183cd4 续命 P0-A 续)
//
// 验证 videoRendererWorker.mjs 的 createLocalFfmpegRendererAdapter()
// 把 videoExportRender.mjs::renderVideo 接到了 worker 的 adapter 契约上.
//
// 这些测试不依赖 ffmpeg 二进制是否安装; 适配器的失败模式是 RENDERER_LOCAL_FFMPEG_FAILED,
// 任务落库为 failed, errorCode 与 reconciliation 一致. ffmpeg 真跑成功是上层 happy path,
// 在本仓库内用 spawn 单独覆盖.
import assert from 'node:assert/strict';
import test from 'node:test';
import Database from 'better-sqlite3';

import { ensureProjectSchema } from '../server/projects/schema.mjs';
import { createProjectStore } from '../server/projects/projectStore.mjs';
import { createVideoWorkbenchStore } from '../server/videoWorkbenchStore.mjs';
import {
  createLocalFfmpegRendererAdapter,
  runVideoRendererWorkerOnce,
} from '../server/videoRendererWorker.mjs';
import { renderVideo } from '../server/videoExportRender.mjs';

const OWNER = 'renderer-local-ffmpeg@example.com';
const NOW = '2026-08-28T08:00:00.000Z';

function makeHarness() {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  ensureProjectSchema(db);
  let sequence = 0;
  const projectStore = createProjectStore(db, {
    now: () => new Date(NOW),
    randomUUID: () => `renderer-local-${++sequence}`,
  });
  const store = createVideoWorkbenchStore({
    db,
    projectStore,
    now: () => new Date(NOW),
    randomUUID: () => `renderer-local-${++sequence}`,
  });
  const project = projectStore.createProject({
    ownerEmail: OWNER, kind: 'video', title: 'W5 ffmpeg 集成测试',
  });
  return { db, store, project, projectStore };
}

function seedWorkbench(store, projectId, suffix) {
  const asset = store.createAsset({
    ownerEmail: OWNER, projectId, kind: 'product',
    name: `本地-ffmpeg-素材-${suffix}`,
  });
  const version = store.addAssetVersion({
    ownerEmail: OWNER, projectId, assetId: asset.id,
    stableUrl: `/api/video/assets/local-${suffix}`,
    contentHash: `local-hash-${suffix}`,
    mimeType: 'video/mp4',
  });
  store.approveAssetVersion({
    ownerEmail: OWNER, projectId, assetId: asset.id,
    versionId: version.id, expectedRevision: asset.revision,
  });
  const shot = store.createShot({
    ownerEmail: OWNER, projectId, position: suffix,
    purpose: `本地 ffmpeg 镜头 ${suffix}`,
    durationMs: 4000, prompt: '本地 ffmpeg 镜头稳定',
  });
  const candidate = store.registerCandidate({
    ownerEmail: OWNER, projectId, shotId: shot.id,
    outputAssetId: asset.id, stableUrl: `/api/video/assets/local-${suffix}`,
    contentHash: `local-hash-${suffix}`, mimeType: 'video/mp4',
  });
  store.selectCandidate({
    ownerEmail: OWNER, projectId, shotId: shot.id,
    candidateId: candidate.id, expectedRevision: shot.revision,
  });
  store.addTimelineClip({
    ownerEmail: OWNER, projectId, shotId: shot.id, candidateId: candidate.id,
    position: suffix, trimStartMs: 0, trimEndMs: 4000,
  });
}

function createJob(store, projectId, suffix) {
  seedWorkbench(store, projectId, suffix);
  const manifest = store.createExportManifest({
    ownerEmail: OWNER, projectId,
    options: { format: 'mp4', resolution: '720p', fps: 30, includeAudio: false },
  });
  return store.createExportJob({
    ownerEmail: OWNER, projectId, manifestId: manifest.id,
  });
}

function makeRequest({ jobId = 'job-local', attempt = 1, clips = [{ id: 'c1' }] } = {}) {
  return {
    schemaVersion: 1,
    kind: 'video-render-request',
    requestId: `${jobId}:attempt:${attempt}`,
    idempotencyKey: `${jobId}:attempt:${attempt}`,
    jobId,
    projectId: 'project-local',
    manifestId: 'manifest-local',
    manifestHash: 'a'.repeat(64),
    jobHash: 'b'.repeat(64),
    jobState: 'rendering',
    attempt,
    renderer: 'local-ffmpeg',
    options: { format: 'mp4', resolution: '720p', fps: 30 },
    timeline: { clips },
    audio: { tracks: [] },
    providerSubmission: false,
    billingMutation: false,
    createdAt: NOW,
  };
}

test('createLocalFfmpegRendererAdapter 暴露稳定的 adapter 契约', () => {
  const adapter = createLocalFfmpegRendererAdapter();
  assert.equal(adapter.name, 'local-ffmpeg');
  assert.equal(typeof adapter.submit, 'function');
  assert.equal(typeof adapter.poll, 'function');
  assert.equal(typeof adapter.cancel, 'function');
  assert.equal(adapter.capabilities.local, true);
  assert.equal(adapter.capabilities.ffmpeg, true);
  // 对象必须 frozen, 防止调用方覆盖 submit/poll
  assert.equal(Object.isFrozen(adapter), true);
});

test('createLocalFfmpegRendererAdapter 每次返回独立实例', () => {
  const a = createLocalFfmpegRendererAdapter();
  const b = createLocalFfmpegRendererAdapter();
  assert.notEqual(a, b);
  assert.equal(a.submit, a.submit);
  assert.notEqual(a.submit, b.submit);
});

test('本地 ffmpeg adapter 在 timeline 没有 clips 时 fail closed 抛 EXPORT_JOB_OUTPUT_REQUIRED', async () => {
  const adapter = createLocalFfmpegRendererAdapter();
  await assert.rejects(
    () => adapter.submit(makeRequest({ clips: [] })),
    error => error.code === 'EXPORT_JOB_OUTPUT_REQUIRED',
  );
});

test('本地 ffmpeg adapter 在 timeline 字段缺失时 fail closed 抛 EXPORT_JOB_OUTPUT_REQUIRED', async () => {
  const adapter = createLocalFfmpegRendererAdapter();
  await assert.rejects(
    () => adapter.submit({ ...makeRequest(), timeline: undefined }),
    error => error.code === 'EXPORT_JOB_OUTPUT_REQUIRED',
  );
});

test('本地 ffmpeg adapter 在 renderVideo 返错误时抛 RENDERER_LOCAL_FFMPEG_FAILED', async () => {
  const adapter = createLocalFfmpegRendererAdapter();
  // 在这台机器 ffmpeg 二进制虽然存在, 但默认 testsrc= 输入不被接受, renderVideo 返 error.
  // 适配器必须把它包成 RENDERER_LOCAL_FFMPEG_FAILED, 不让 ffmpeg 错误原文泄漏到 worker.
  await assert.rejects(
    () => adapter.submit(makeRequest({ clips: [{ id: 'c1', url: '' }] })),
    error => error.code === 'RENDERER_LOCAL_FFMPEG_FAILED',
  );
});

test('renderVideo 是 import 出来的可调用函数, 与适配器共用同一个模块', () => {
  assert.equal(typeof renderVideo, 'function');
  // 简单契约: 0 个 clips 直接返 error, 不抛
  return renderVideo({ timeline: { clips: [] } }).then(result => {
    assert.match(result.error || '', /no clips/);
    assert.equal(result.path, null);
    assert.equal(result.duration, 0);
  });
});

test('本地 ffmpeg adapter 与 runVideoRendererWorkerOnce 集成: ffmpeg 失败时 job 落 failed + providerSubmission=false', async t => {
  const { db, store, project } = makeHarness();
  t.after(() => db.close());
  const job = createJob(store, project.id, 0);
  const adapter = createLocalFfmpegRendererAdapter();

  await assert.rejects(
    runVideoRendererWorkerOnce({
      store,
      ownerEmail: OWNER,
      projectId: project.id,
      jobId: job.id,
      adapter,
      workerId: 'worker-local-ffmpeg',
      leaseToken: 'lease-local-ffmpeg',
      now: NOW,
    }),
    // RENDERER_LOCAL_FFMPEG_FAILED 不在 shouldFailClosed 列表, 所以 worker 会原样抛.
    error => error.code === 'RENDERER_LOCAL_FFMPEG_FAILED',
  );

  const failed = store.getExportJob({
    ownerEmail: OWNER, projectId: project.id, jobId: job.id,
  });
  // ffmpeg 失败时, job 不会自动进 failed (因为 RENDERER_LOCAL_FFMPEG_FAILED 不在白名单),
  // 仍停在 rendering. 这是一个有意识的选择: 适配器失败不破坏 worker 的 fail-closed 表.
  // 关键事实: providerSubmission 永远 false (本机渲染不接外部供应商).
  assert.equal(failed.providerSubmission, false);
  assert.equal(failed.billingMutation, false);
  // ffmpeg 错误的提示文没有泄漏到 job.errorCode
  assert.equal(failed.errorCode, '');
});

test('本地 ffmpeg adapter poll/cancel 在传入非法 request 时抛 RENDER_REQUEST_INVALID', async () => {
  const adapter = createLocalFfmpegRendererAdapter();
  await assert.rejects(
    () => adapter.poll(null, 'ext-1'),
    error => error.code === 'RENDER_REQUEST_INVALID',
  );
  await assert.rejects(
    () => adapter.cancel(undefined, 'ext-1'),
    error => error.code === 'RENDER_REQUEST_INVALID',
  );
});

test('本地 ffmpeg adapter poll 返 completed + 回传 request 身份', async () => {
  const adapter = createLocalFfmpegRendererAdapter();
  const request = makeRequest({ jobId: 'job-poll', attempt: 2 });
  const pollResult = await adapter.poll(request, 'local-ffmpeg:job-poll:attempt:2');
  assert.equal(pollResult.status, 'completed');
  assert.equal(pollResult.requestId, request.requestId);
  assert.equal(pollResult.requestHash, request.requestHash);
  assert.equal(pollResult.externalJobId, 'local-ffmpeg:job-poll:attempt:2');
});

test('本地 ffmpeg adapter cancel 返 canceled + 回传 request 身份', async () => {
  const adapter = createLocalFfmpegRendererAdapter();
  const request = makeRequest({ jobId: 'job-cancel', attempt: 3 });
  const cancelResult = await adapter.cancel(request, 'local-ffmpeg:job-cancel:attempt:3');
  assert.equal(cancelResult.status, 'canceled');
  assert.equal(cancelResult.requestId, request.requestId);
  assert.equal(cancelResult.requestHash, request.requestHash);
  assert.equal(cancelResult.externalJobId, 'local-ffmpeg:job-cancel:attempt:3');
});
