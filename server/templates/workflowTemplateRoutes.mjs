// server/templates/workflowTemplateRoutes.mjs
// P2 业务资产层 — 工作流模板 API（mirror server/extensions/canvasFeedback.mjs + P1 graphRunRoutes 的 mount 模式）。
//
// 路由（鉴权 = 注入的 authorize(req) -> email，同步或 Promise 均可；401 同 P1 口径）：
//   GET  /api/workflow-templates?public=&category=&mine=   列表（匿名只见公开；mine 需登录且只能查自己；
//                                                          登录 + public=0 才放开全量）
//   GET  /api/workflow-templates/:slug                      取单个（私有模板非 owner -> 404，不泄露存在性）
//   POST /api/workflow-templates/:slug/instantiate          登录 -> incrementUsage（真数口径）->
//                                                          返回可直接喂 createCanvasSnapshot 的图 snapshot
//   POST /api/workflow-templates/:slug/like                 登录 -> toggleLike（INSERT OR IGNORE 幂等）
//   POST /api/workflow-templates                             登录 -> 用户自建（is_public=0, is_built_in=0, author_email=email）
//
// 不变式 ① 不确认不扣费：模板本身 0 收费；instantiate 只 +usage_count（真数，非占位），
// 实际扣费发生在 P1 /api/canvas/graph/run 的节点动作层（catalog 报价）。
// 不变式 ③ 单一价格真源：pricing_json 仅展示预估（estimatedUnits/note），本模块绝不参与结算。
//
// Source-hygiene safe：graph_json / pricing_json 在 store 读路径一律防御性 JSON.parse（try/catch -> 缺省回落），
// legacy / 损坏数据不会让任何读接口崩溃。
//
// ════════════════════════════════════════════════════════════════════════════════
// WIRE-IN: server/index.mjs —— 精确挂载行（本里程碑不改 index.mjs，集成时照抄）：
//
//   // --- import（与 P1 graph-run 导入同区，~line 95）---
//   import { createWorkflowTemplateStore } from './templates/workflowTemplateStore.mjs';
//   import { BUILTIN_WORKFLOW_TEMPLATES } from './templates/builtinTemplates.mjs';
//   import { mountWorkflowTemplateRoutes } from './templates/workflowTemplateRoutes.mjs';
//
//   // --- 实例 + 启动播种（与 canvasGraphRunStore 实例同区，~line 4341）---
//   const workflowTemplateStore = createWorkflowTemplateStore(db);
//   workflowTemplateStore.seedBuiltIn(BUILTIN_WORKFLOW_TEMPLATES); // 幂等：已播 slug 跳过、永不覆盖既有 graph/pricing
//
//   // --- 路由挂载（与 mountCanvasGraphRunRoutes 同区，~line 4372）---
//   mountWorkflowTemplateRoutes(app, {
//     store: workflowTemplateStore,
//     authorize: req => authenticateContentRequest(req, {
//       sessionTokens: contentSessionTokens,
//       authorizeEmail: authorizeAccountEmail,
//     }),
//   });
// ════════════════════════════════════════════════════════════════════════════════

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeEmail(value) {
  return cleanString(value).toLowerCase();
}

function codedError(message, code, status) {
  return Object.assign(new Error(message), { code, status });
}

function clone(value, fallback) {
  try { return JSON.parse(JSON.stringify(value)); } catch { return fallback; }
}

export function mountWorkflowTemplateRoutes(app, { store, authorize } = {}) {
  if (!app) throw new Error('app required');
  if (!store || typeof store.list !== 'function' || typeof store.get !== 'function'
    || typeof store.create !== 'function' || typeof store.incrementUsage !== 'function'
    || typeof store.toggleLike !== 'function') {
    throw new Error('workflow template store is required');
  }
  if (typeof authorize !== 'function') throw new Error('authorize is required');

  /* 鉴权包装（同 P1 graphRunRoutes）：authorize(req) 可同步可异步；AUTH_* 错误 -> 匿名而非 500。 */
  async function resolveEmail(req) {
    try {
      return normalizeEmail(await authorize(req));
    } catch (error) {
      if (error && (error.code === 'AUTH_SESSION_REQUIRED' || error.code === 'AUTH_INVALID' || error.status === 401)) return '';
      throw error;
    }
  }

  const requireAuth = (handler) => async (req, res) => {
    let email;
    try {
      email = await resolveEmail(req);
    } catch (error) {
      return res.status(500).json({ code: 'WORKFLOW_TEMPLATE_AUTH_ERROR', error: error?.message || String(error) });
    }
    if (!email) return res.status(401).json({ code: 'WORKFLOW_TEMPLATE_UNAUTHORIZED', error: '未登录' });
    return handler(req, res, email);
  };

  const optionalAuth = (handler) => async (req, res) => {
    let email = '';
    try {
      email = await resolveEmail(req);
    } catch (error) {
      return res.status(500).json({ code: 'WORKFLOW_TEMPLATE_AUTH_ERROR', error: error?.message || String(error) });
    }
    return handler(req, res, email);
  };

  const sendError = (res, error) => {
    const status = Number(error?.status) || 500;
    const body = {
      code: error?.code || 'WORKFLOW_TEMPLATE_FAILED',
      error: error?.message || String(error),
    };
    return res.status(status).json(body);
  };

  /* 私有模板对匿名/他人不可见（404 而非 403，避免泄露存在性）。 */
  function visibleTemplate(slug, email) {
    const template = store.get(slug);
    if (!template) return { error: codedError('workflow template not found', 'WORKFLOW_TEMPLATE_NOT_FOUND', 404) };
    if (!template.isPublic && template.authorEmail !== email) {
      return { error: codedError('workflow template not found', 'WORKFLOW_TEMPLATE_NOT_FOUND', 404) };
    }
    return { template };
  }

  /* 列表：匿名只看公开（public=0 也按公开处理，防越权拉私有）；登录 + public=0 才全量；
     mine 需登录且只能指向自己（他人 mine -> 403）。 */
  app.get('/api/workflow-templates', optionalAuth(async (req, res, email) => {
    const query = req.query || {};
    const mine = normalizeEmail(query.mine);
    const category = cleanString(query.category);
    try {
      if (mine) {
        if (!email) return res.status(401).json({ code: 'WORKFLOW_TEMPLATE_UNAUTHORIZED', error: '未登录' });
        if (mine !== email) return res.status(403).json({ code: 'WORKFLOW_TEMPLATE_FORBIDDEN', error: '不能查看他人模板' });
        return res.json({ ok: true, templates: store.list({ ownerEmail: email, public: false, category }) });
      }
      /* 匿名强制公开口径（public=0 也不能拉私有）；仅“登录 + public=0”才放开全量。 */
      const publicFlag = email ? String(query.public) !== '0' : true;
      const templates = store.list({ public: publicFlag, category });
      return res.json({ ok: true, templates });
    } catch (error) {
      return sendError(res, error);
    }
  }));

  app.get('/api/workflow-templates/:slug', optionalAuth(async (req, res, email) => {
    const slug = cleanString(req.params?.slug);
    try {
      const { template, error } = visibleTemplate(slug, email);
      if (error) return res.status(error.status).json({ code: error.code, error: error.message });
      return res.json({ ok: true, template });
    } catch (err) {
      return sendError(res, err);
    }
  }));

  /* 实例化：登录 -> usage+1（真数）-> 返回可直接喂 createCanvasSnapshot 的 snapshot
     （前端“一键铺开”：只高亮 [槽] 节点，用户拖入商品图后走 P1 /api/canvas/graph/run）。 */
  app.post('/api/workflow-templates/:slug/instantiate', requireAuth(async (req, res, email) => {
    const slug = cleanString(req.params?.slug);
    try {
      const { template, error } = visibleTemplate(slug, email);
      if (error) return res.status(error.status).json({ code: error.code, error: error.message });
      const { usageCount } = store.incrementUsage(template.templateId);
      const graph = template.graph || { nodes: [], connections: [] };
      return res.json({
        ok: true,
        templateId: template.templateId,
        slug: template.slug,
        name: template.name,
        category: template.category,
        description: template.description,
        /* 展示预估（不变式③：不是结算依据，结算走 P1 执行器 catalog 报价）。 */
        pricing: template.pricing,
        estimatedUnits: Number(template.pricing?.estimatedUnits) || 0,
        requiresAudioVideo: template.requiresAudioVideo,
        runnableThisPhase: template.runnableThisPhase === true,
        gateNote: template.gateNote || '',
        usageCount,
        snapshot: {
          nodes: clone(graph.nodes, []),
          connections: clone(graph.connections, []),
          viewport: { x: 80, y: 40, scale: 1 },
        },
      });
    } catch (err) {
      return sendError(res, err);
    }
  }));

  /* 点赞幂等（双击不重复计数）：liked = 操作后的持有状态。 */
  app.post('/api/workflow-templates/:slug/like', requireAuth(async (req, res, email) => {
    const slug = cleanString(req.params?.slug);
    try {
      const { template, error } = visibleTemplate(slug, email);
      if (error) return res.status(error.status).json({ code: error.code, error: error.message });
      const { liked, likeCount } = store.toggleLike(template.templateId, email);
      return res.json({ ok: true, liked, likeCount });
    } catch (err) {
      return sendError(res, err);
    }
  }));

  /* 用户自建：is_public=0 / is_built_in=0 / author_email=登录邮箱（slug 被他人占用 -> 409）。 */
  app.post('/api/workflow-templates', requireAuth(async (req, res, email) => {
    const body = req.body || {};
    try {
      if (!cleanString(body.name) || !cleanString(body.category)) {
        throw codedError('template name and category are required', 'WORKFLOW_TEMPLATE_INVALID_INPUT', 400);
      }
      const template = store.create({
        slug: body.slug,
        name: body.name,
        category: body.category,
        description: body.description,
        graph: body.graph,
        pricing: body.pricing,
        authorEmail: email,
        isPublic: false,
        isBuiltIn: false,
      });
      return res.status(201).json({ ok: true, template });
    } catch (err) {
      return sendError(res, err);
    }
  }));
}
