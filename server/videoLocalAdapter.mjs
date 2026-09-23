/* ═══ 本地视频适配器（localEngine 产品专用）══════════════════════════════════════════════════════
   用户口径：「难道你没有什么比如 github 上的一些开源项目可以实现吗，**为什么一切都要追究模型呢**，
   你确定这是最佳的路径吗」+「全部做完」

   定位：这是**派发层** —— 与 server/videoProviders.mjs 里那个上游适配器**同形**（同样的方法名与返回形状），
   所以作业流水线不需要为"本地"写第二套分支；差别只在实现：
     · 上游：POST /videos → 轮询 → 下载 content（异步、要花钱）
     · 本地：buildLocalRenderManifest() → renderVideo()（同步、零上游成本）
   接口（与上游适配器逐条对齐）：
     { enabled, routeId, productId, protocol, model, submit(), get(), download() }
   ⚠️ 本地渲染是**同步**的：submit 返回时片子已经落在磁盘上（progress = 100）。
      所以 get() 直接回终态；任务的"等待/重试"由流水线那一层的既有机制处理，本地不做假轮询。
   ⚠️ 只认**声明了 localEngine 的产品**：拿别的产品进来直接拒绝（防止有人把上游档位接到本地链路上，
      那会让"按上游成本定的价"配上"零成本实现"，账就乱了）。 */
import { createReadStream } from 'node:fs';
import { basename } from 'node:path';

import { buildLocalRenderManifest } from './localVideoPlan.mjs';
import { renderVideo } from './videoExportRender.mjs';

export function createLocalVideoAdapter({ product, render = renderVideo, now = () => Date.now() } = {}) {
  if (!product || typeof product !== 'object') throw new TypeError('product is required');
  if (product.localEngine !== true) {
    throw Object.assign(new Error('本地适配器只能服务 localEngine 产品'), { code: 'LOCAL_ADAPTER_PRODUCT_MISMATCH' });
  }

  /* 本地任务表：同步渲染完成后，把成片路径按 taskId 记下来，供 get/download 用。
     不落库、不跨进程 —— 本地渲染的产物本来就已经写进 server/video-assets/output，
     流水线那一层会把它当普通成片资产接管（落库/历史/重试都在那边）。 */
  const tasks = new Map();

  return {
    enabled: true,
    routeId: product.routeId,
    productId: product.id,
    protocol: 'local',
    model: product.id,
    /* 与上游适配器同签名：submit(payload, idempotencyKey) */
    async submit(payload = {}) {
      const manifest = buildLocalRenderManifest({
        sourceUrl: payload.sourceUrl || payload.videoUrl || payload.image_url || '',
        resolution: payload.resolution || payload.outputResolution || '',
        fps: payload.fps || null,
        regions: payload.regions || payload.replace || [],
        duration: payload.duration || payload.seconds || 0,
        label: payload.label || product.label || '',
      });
      const result = await render(manifest);
      if (!result?.path) {
        const error = Object.assign(new Error(result?.error || '本地渲染失败'), { code: 'LOCAL_RENDER_FAILED' });
        throw error;
      }
      const id = `local-${now()}-${tasks.size + 1}`;
      tasks.set(id, { id, path: result.path, manifest, duration: Number(result.duration) || manifest.duration || 0 });
      return { id, progress: 100 };
    },
    async get(taskId) {
      const task = tasks.get(String(taskId || ''));
      if (!task) {
        return { id: String(taskId || ''), status: 'failed', progress: 0, downloadUrl: null, reason: '本地任务不存在（进程内任务表没有它）' };
      }
      return { id: task.id, status: 'completed', progress: 100, downloadUrl: task.path, duration: task.duration };
    },
    /* 与上游 download 同形：返回一个可读流 */
    async download(taskId) {
      const task = tasks.get(String(taskId || ''));
      if (!task) throw Object.assign(new Error('本地任务不存在'), { code: 'LOCAL_TASK_MISSING' });
      return createReadStream(task.path);
    },
    /* 给流水线/诊断用：本地任务的可读描述（不暴露内部路径给前端） */
    describe(taskId) {
      const task = tasks.get(String(taskId || ''));
      return task ? { id: task.id, file: basename(task.path), duration: task.duration } : null;
    },
  };
}
