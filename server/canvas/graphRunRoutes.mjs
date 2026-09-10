// server/canvas/graphRunRoutes.mjs
// P1 后端宿主 — 画布整链运行 API（镜像 server/extensions/canvasFeedback.mjs 的 mount 模式）。
//
// 路由（鉴权 = 注入的 authorize(req) -> email；401 同 canvasFeedback 口径）：
//   POST /api/canvas/graph/run            启动整链运行（billing-aware，层序执行）
//   GET  /api/canvas/graph/runs/:id       查 run 状态 + 各步骤结果（owner 校验）
//   POST /api/canvas/graph/runs/:id/cancel 取消（worker 活跃时步间生效；无主时直接落 cancelled）
//
// kind 守卫：只接受 P0 GRAPH_RUN_KINDS 白名单（image-composer/smart-remix/suite-composer/
// remove-bg/extend/inpaint/translate/upscale/layer-workbench + P3 接线的 splice）；
// text/video/audio/video-composer/tts/lip-sync 等未支持 kind（无现成产物可作 source）
// -> 400 'kind not supported yet'（服务层是最终权威，路由层提前拦；P3 音视频真生成 = P3.1 门控）。
//
// ════════════════════════════════════════════════════════════════════════════════
// WIRE-IN: server/index.mjs —— P0/P0.5 部署通过后的精确挂载行（本里程碑不改动 index.mjs）：
//
//   // --- import（放在 canvasGenerationStore import 附近，~line 94）---
//   import { createCanvasGraphRunStore } from './canvas/graphRunSchema.mjs';
//   import { createCanvasGraphRunService } from './canvas/graphRunService.mjs';
//   import { createCanvasGraphRunExecutor } from './canvas/graphRunExecutor.mjs';
//   import { mountCanvasGraphRunRoutes } from './canvas/graphRunRoutes.mjs';
//
//   // --- 实例（放在 canvasGenerationStore 附近，~line 430）---
//   const canvasGraphRunStore = createCanvasGraphRunStore(db);
//   const canvasBilledActions = createCanvasBilledActionStore(db); // 提为命名实例，one-shot 与 graph-run 共用
//   const canvasGraphRunService = createCanvasGraphRunService({
//     store: canvasGraphRunStore,
//     billActions: canvasBilledActions,
//     executeNode: createCanvasGraphRunExecutor({
//       // 免费白底旗舰链：商品图 source -> remove-bg -> upscale（本地零成本）
//       removeBackground: async ({ imageUrl }) => {
//         const { buffer } = await imageInputReader.read(imageUrl);
//         const outBuf = await removeLightBackground(buffer); // index.mjs ~line 4323 既有本地函数
//         const asset = await generatedAssetStore.persistBuffer({
//           buffer: outBuf, contentType: 'image/png',
//           taskId: `canvas_graph_remove_bg_${Date.now()}`, label: 'canvas_graph_remove_bg',
//         });
//         return { ok: true, outputUrl: asset.url }; // 免费本地路径：不回报 units（0 结算）
//       },
//       upscale: async ({ imageUrl }) => {
//         const { buffer } = await imageInputReader.read(imageUrl);
//         const outBuf = await sharp(buffer).resize(2048, 2048, { fit: 'inside', withoutEnlargement: false }).png().toBuffer();
//         const asset = await generatedAssetStore.persistBuffer({
//           buffer: outBuf, contentType: 'image/png',
//           taskId: `canvas_graph_upscale_${Date.now()}`, label: 'canvas_graph_upscale',
//         });
//         return { ok: true, outputUrl: asset.url };
//       },
//       // P3 splice（图片竖排详情长图, 本地 sharp 免费 0 扣费）: 生产执行器已接线 readImage
//       // (imageInputReader.read) + persistSpliceOutput (generatedAssetStore.persistBuffer),
//       // index.mjs canvasGraphRunExecutor 实例; 视频拼接固定返回 P3.1 ffmpeg 门控错误。
//       // 生成类 kind（image-composer/smart-remix/suite-composer）与 extend/inpaint/translate/layer-workbench：
//       // P1.1 接 canvasGenerationService / 本地 ffmpeg 与计费目录报价（quoteFeature 取 units）；
//       // 未接线前编排器对它们返回 { ok:false, error:'executor not wired for kind X' }（零成本）。
//     }),
//   });
//
//   // --- 路由挂载（放在 mountCanvasFeedbackRoutes 附近，~line 828）---
//   mountCanvasGraphRunRoutes(app, {
//     service: canvasGraphRunService,
//     authorize: req => authenticateContentRequest(req, {
//       sessionTokens: contentSessionTokens,
//       authorizeEmail: authorizeAccountEmail,
//     }),
//   });
//
//   // 启动恢复（可选，P1.1）：进程重启后 resume 无主 run：
//   //   canvasGraphRunStore.recoverInterrupted().forEach(run =>
//   //     canvasGraphRunService.resumeRun(run.runId).catch(err => console.warn('[graph-run] recovery failed:', err?.message)));
// ════════════════════════════════════════════════════════════════════════════════

import { SUPPORTED_GRAPH_RUN_KINDS, nodeHasProduct, readNodeId } from './graphRunPlan.mjs';

export function mountCanvasGraphRunRoutes(app, { service, authorize } = {}) {
  if (!app) throw new Error('app required');
  if (!service || typeof service.startRun !== 'function') throw new Error('graph run service is required');
  if (typeof authorize !== 'function') throw new Error('authorize is required');

  const supported = new Set(SUPPORTED_GRAPH_RUN_KINDS);
  const kindOf = node => node?.actionId || node?.kind || '';

  /* 路由层 kind 守卫（服务层 startRun 为最终权威，这里只是提前 400 省一次建 run）：
     白名单外且无现成产物的节点 -> 'kind not supported yet'。 */
  function unsupportedKindsIn(nodes) {
    if (!Array.isArray(nodes)) return [];
    const kinds = [];
    for (const node of nodes) {
      const kind = kindOf(node);
      if (!kind || supported.has(kind)) continue;
      if (nodeHasProduct(node)) continue; // 有产物 = 可作 source，P0 口径允许
      if (!kinds.includes(kind)) kinds.push(kind);
    }
    return kinds;
  }

  const auth = (handler) => async (req, res) => {
    try {
      const email = await authorize(req);
      if (!email) return res.status(401).json({ code: 'CANVAS_GRAPH_RUN_UNAUTHORIZED', error: '未登录' });
      return await handler(req, res, String(email).trim().toLowerCase());
    } catch (error) {
      const message = error?.message || String(error);
      if (error && (error.code === 'AUTH_SESSION_REQUIRED' || error.code === 'AUTH_INVALID' || error.status === 401)) {
        return res.status(401).json({ code: 'CANVAS_GRAPH_RUN_UNAUTHORIZED', error: message });
      }
      return res.status(500).json({ code: 'CANVAS_GRAPH_RUN_AUTH_ERROR', error: message });
    }
  };

  const sendError = (res, error) => {
    const status = Number(error?.status) || 500;
    const body = {
      code: error?.code || 'CANVAS_GRAPH_RUN_FAILED',
      error: error?.message || String(error),
    };
    for (const key of ['unsupportedKinds', 'unsupportedNodeIds', 'reason', 'cycleNodeIds', 'blockedNodeIds', 'note']) {
      if (error?.[key] !== undefined) body[key] = error[key];
    }
    return res.status(status).json(body);
  };

  app.post('/api/canvas/graph/run', auth(async (req, res, email) => {
    const body = req.body || {};
    const unsupported = unsupportedKindsIn(body.nodes);
    if (unsupported.length) {
      return res.status(400).json({
        code: 'CANVAS_GRAPH_RUN_KIND_UNSUPPORTED',
        error: 'kind not supported yet',
        unsupportedKinds: unsupported,
      });
    }
    try {
      const result = await service.startRun({
        ownerEmail: email,
        docId: body.docId,
        nodes: body.nodes,
        connections: body.connections,
        plan: body.plan,
        targetNodeIds: body.targetNodeIds,
      });
      return res.json({ ok: true, ...result });
    } catch (error) {
      return sendError(res, error);
    }
  }));

  app.get('/api/canvas/graph/runs/:id', auth(async (req, res, email) => {
    const runId = String(req.params?.id || '');
    let detail;
    try {
      detail = service.getRun(runId);
    } catch (error) {
      return sendError(res, error);
    }
    if (!detail) return res.status(404).json({ code: 'CANVAS_GRAPH_RUN_NOT_FOUND', error: 'run not found' });
    if (detail.ownerEmail !== email) {
      return res.status(404).json({ code: 'CANVAS_GRAPH_RUN_NOT_FOUND', error: 'run not found' });
    }
    return res.json({ ok: true, ...detail });
  }));

  app.post('/api/canvas/graph/runs/:id/cancel', auth(async (req, res, email) => {
    const runId = String(req.params?.id || '');
    let detail;
    try {
      detail = service.getRun(runId);
    } catch (error) {
      return sendError(res, error);
    }
    if (!detail) return res.status(404).json({ code: 'CANVAS_GRAPH_RUN_NOT_FOUND', error: 'run not found' });
    if (detail.ownerEmail !== email) {
      return res.status(404).json({ code: 'CANVAS_GRAPH_RUN_NOT_FOUND', error: 'run not found' });
    }
    try {
      const result = service.cancelRun(runId);
      return res.json({ ok: true, ...result });
    } catch (error) {
      return sendError(res, error);
    }
  }));
}
