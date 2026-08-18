function mappedError(error) {
  if (String(error?.code || '').startsWith('AUTH_SESSION_')) {
    const forbidden = error.code === 'AUTH_SESSION_UNAUTHORIZED';
    return {
      status: forbidden ? 403 : 401,
      body: { error: forbidden ? '当前账号没有管理权限' : '请先登录管理员账号', code: error.code },
    };
  }
  if (String(error?.code || '').startsWith('ACCOUNT_ADMIN_')) {
    return { status: 403, body: { error: error.message || '当前账号没有管理权限', code: error.code } };
  }
  if (error?.code === 'ACCOUNT_NOT_FOUND') {
    return { status: 404, body: { error: '账号不存在', code: error.code } };
  }
  if (error?.code === 'BILLING_INSUFFICIENT_CREDITS') {
    return {
      status: 409,
      body: {
        error: '可用积分不足，不能完成回收',
        code: error.code,
        required: error.required,
        available: error.available,
      },
    };
  }
  if (error?.code === 'SQLITE_BUSY' || error?.code === 'SQLITE_LOCKED') {
    return { status: 503, body: { error: '管理后台繁忙，请稍后重试', code: 'ADMIN_DATABASE_BUSY', retryable: true } };
  }
  return { status: error?.status || 400, body: { error: error?.message || '管理请求无效', code: error?.code || 'ADMIN_REQUEST_INVALID' } };
}

function sendError(res, error) {
  const mapped = mappedError(error);
  return res.status(mapped.status).json(mapped.body);
}

function wrap(fn) {
  return async (req, res) => {
    try {
      return await fn(req, res);
    } catch (error) {
      return sendError(res, error);
    }
  };
}

export function createAdminRouteHandlers({ operations, authenticateOwner, authorizeAdmin } = {}) {
  if (!operations || typeof operations.summary !== 'function') throw new TypeError('admin operations are required');
  if (typeof authenticateOwner !== 'function') throw new TypeError('authenticateOwner is required');
  if (typeof authorizeAdmin !== 'function') throw new TypeError('authorizeAdmin is required');

  return {
    requireAdmin(req, res, next) {
      try {
        const actorEmail = authenticateOwner(req);
        const access = authorizeAdmin(actorEmail);
        if (!access?.ok) {
          const error = Object.assign(new Error(access?.error || 'admin access denied'), {
            code: access?.code || 'ACCOUNT_ADMIN_FORBIDDEN',
            status: access?.status || 403,
          });
          throw error;
        }
        req.adminActorEmail = access.email;
        return next();
      } catch (error) {
        return sendError(res, error);
      }
    },
    summary: wrap((req, res) => res.json(operations.summary(req.query))),
    monitoring: wrap((req, res) => res.json(operations.monitoring(req.query))),
    accounts: wrap((req, res) => res.json(operations.listAccounts(req.query))),
    account: wrap((req, res) => res.json({ account: operations.getAccount(req.params.email) })),
    createAccount: wrap((req, res) => res.status(201).json({ account: operations.createAccount(req.adminActorEmail, req.body) })),
    updateAccount: wrap((req, res) => res.json({ account: operations.updateAccount(req.adminActorEmail, req.params.email, req.body) })),
    permissions: wrap((req, res) => res.json({ account: operations.setPermissions(req.adminActorEmail, req.params.email, req.body) })),
    credits: wrap((req, res) => res.json({ adjustment: operations.adjustCredits(req.adminActorEmail, req.params.email, req.body) })),
    audit: wrap((req, res) => res.json(operations.listAudit(req.query))),
    videoOperations: wrap((req, res) => res.json(operations.videoOperationsMetrics())),
    reconcileVideos: wrap(async (req, res) => res.json({
      result: await operations.runVideoReconciliation(req.adminActorEmail, req.body),
    })),
    operateVideoJob: wrap(async (req, res) => res.json({
      result: await operations.operateVideoJob(req.adminActorEmail, req.params.id, req.body),
    })),
  };
}

export function mountAdminRoutes(app, deps) {
  if (!app || typeof app.get !== 'function' || typeof app.post !== 'function' || typeof app.put !== 'function') {
    throw new TypeError('app with get, post, and put is required');
  }
  const handlers = createAdminRouteHandlers(deps);
  app.get('/api/admin/summary', handlers.requireAdmin, handlers.summary);
  app.get('/api/admin/monitoring', handlers.requireAdmin, handlers.monitoring);
  app.get('/api/admin/accounts', handlers.requireAdmin, handlers.accounts);
  app.post('/api/admin/accounts', handlers.requireAdmin, handlers.createAccount);
  app.get('/api/admin/accounts/:email', handlers.requireAdmin, handlers.account);
  app.put('/api/admin/accounts/:email', handlers.requireAdmin, handlers.updateAccount);
  app.put('/api/admin/accounts/:email/permissions', handlers.requireAdmin, handlers.permissions);
  app.post('/api/admin/accounts/:email/credits', handlers.requireAdmin, handlers.credits);
  app.get('/api/admin/audit', handlers.requireAdmin, handlers.audit);
  app.get('/api/admin/video-operations', handlers.requireAdmin, handlers.videoOperations);
  app.post('/api/admin/video-operations/reconcile', handlers.requireAdmin, handlers.reconcileVideos);
  app.post('/api/admin/video-jobs/:id/actions', handlers.requireAdmin, handlers.operateVideoJob);
  return handlers;
}
