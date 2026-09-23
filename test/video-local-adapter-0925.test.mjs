import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { createLocalVideoAdapter } from '../server/videoLocalAdapter.mjs';

/* ═══ 2026-09-25 批 AL：本地视频适配器（派发层）══════════════════════════════════════════════════
   用户口径：「全部做完」「难道你没有什么比如 github 上的一些开源项目可以实现吗，为什么一切都要追究模型呢」。
   判据：① 与上游适配器**同形**（submit/get/download 三个方法都在，返回形状对得上），
        ② 只服务 localEngine 产品（拿别的产品进来必须拒绝），
        ③ 同步渲染：submit 返回时就看得到终态，不做假轮询，
        ④ 失败要抛**带 code** 的错误（流水线按 code 决定重试与否）。 */
const product = { id: 'video_upscale_local', label: '视频高清', routeId: 'local-ffmpeg', localEngine: true };

/* 注入假渲染器：不真跑 ffmpeg，但**检查它收到了什么清单** —— 这才是这一层要守的东西 */
const fakeRender = manifest => ({ path: '/tmp/fake-out.mp4', duration: manifest.duration || 5, error: null, manifest });

test('① 与上游适配器同形：三个方法都在，submit 返回 {id, progress}', async () => {
  const adapter = createLocalVideoAdapter({ product, render: fakeRender });
  assert.equal(adapter.enabled, true);
  assert.equal(adapter.routeId, 'local-ffmpeg');
  assert.equal(adapter.productId, 'video_upscale_local');
  assert.equal(adapter.protocol, 'local');
  for (const method of ['submit', 'get', 'download', 'describe']) assert.equal(typeof adapter[method], 'function', method + ' 缺失');
  const task = await adapter.submit({ sourceUrl: 'a.mp4', resolution: '1080p' });
  assert.equal(typeof task.id, 'string');
  assert.equal(task.progress, 100, '本地渲染是同步的：返回即完成');
});

test('② 用户输入被翻译成正确的清单（分辨率 / 区域 / 时长），而不是原样透传', async () => {
  const seen = [];
  const adapter = createLocalVideoAdapter({ product, render: manifest => { seen.push(manifest); return { path: '/tmp/x.mp4', duration: 12 }; } });
  await adapter.submit({ videoUrl: 'src.mp4', outputResolution: '2k', fps: 60, regions: [{ x: 10, y: 20, w: 300, h: 40 }], seconds: 12 });
  assert.equal(seen.length, 1);
  assert.deepEqual(seen[0].timeline.clips, [{ url: 'src.mp4' }], '两个字段名（sourceUrl/videoUrl）都要能取到源');
  assert.deepEqual(seen[0].output, { resolution: '1440p', fps: 60 });
  assert.deepEqual(seen[0].replace, [{ type: 'delogo', x: 10, y: 20, w: 300, h: 40 }]);
  assert.equal(seen[0].duration, 12);
});

test('③ 只服务 localEngine 产品；渲染失败抛带 code 的错误', async () => {
  assert.throws(() => createLocalVideoAdapter({ product: { id: 'seedance_standard', routeId: 'seedance-2.0' } }),
    /只能服务 localEngine 产品/);
  const failing = createLocalVideoAdapter({ product, render: () => ({ path: null, error: 'ffmpeg exit 1' }) });
  await assert.rejects(() => failing.submit({ sourceUrl: 'a.mp4', resolution: '720p' }), error => {
    assert.equal(error.code, 'LOCAL_RENDER_FAILED');
    return true;
  });
});

test('④ 任务可查、可下载；未知任务给失败态而不是抛错（流水线要能读到原因）', async () => {
  /* ⚠️ 下载要**真的打开文件**，所以这里写一个真临时文件 ——
     用不存在的路径会在测试结束后异步抛 ENOENT（"generated asynchronous activity after the test ended"，
     本仓第一次就踩到了）。判据不变：download 返回可读流。 */
  const realPath = join(tmpdir(), `shubao-local-adapter-${Date.now()}.mp4`);
  writeFileSync(realPath, 'fake-bytes', 'utf8');
  const adapter = createLocalVideoAdapter({ product, render: () => ({ path: realPath, duration: 7 }) });
  const task = await adapter.submit({ sourceUrl: 'a.mp4', resolution: '720p' });
  const status = await adapter.get(task.id);
  assert.equal(status.status, 'completed');
  assert.equal(status.progress, 100);
  assert.equal(status.downloadUrl, realPath, '本地成片的地址就是磁盘路径');
  const stream = await adapter.download(task.id);
  assert.equal(typeof stream?.pipe, 'function', 'download 返回可读流');
  stream.destroy();
  const missing = await adapter.get('nope');
  assert.equal(missing.status, 'failed');
  assert.match(missing.reason, /不存在/);
  assert.equal(adapter.describe('nope'), null);
  assert.match(adapter.describe(task.id).file, /\.mp4$/, '诊断信息只给文件名，不给内部路径');
  assert.equal(adapter.describe(task.id).file.includes('/'), false);
});
