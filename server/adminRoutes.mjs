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

export function createAdminRouteHandlers({ operations, authenticateOwner, authorizeAdmin, authorizeAccount } = {}) {
  if (!operations || typeof operations.summary !== 'function') throw new TypeError('admin operations are required');
  if (typeof authenticateOwner !== 'function') throw new TypeError('authenticateOwner is required');
  if (typeof authorizeAdmin !== 'function') throw new TypeError('authorizeAdmin is required');
  // 续命 P2: 用户列表/成本核算 admin role 也能访问, 这里用 requireAccountAccess 而非 requireAdminAccess (owner-only)
  const authorizeAccess = typeof authorizeAccount === 'function' ? authorizeAccount : authorizeAdmin;

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
    // 续命 P2: 允许 admin + owner 角色访问 (P2 用户列表给 admin dashboard 用, owner 仍可查看).
    // 用 authorizeAccess (默认回退 authorizeAdmin) 拿完整 access, 再单独看 role.
    requireAdminRole(req, res, next) {
      try {
        const actorEmail = authenticateOwner(req);
        const access = authorizeAccess(actorEmail);
        if (!access?.ok) throw Object.assign(new Error(access?.error || 'auth failed'), {
          code: access?.code || 'AUTH_SESSION_UNAUTHORIZED', status: access?.status || 403,
        });
        const role = access.account?.role;
        if (role !== 'admin' && role !== 'owner') {
          throw Object.assign(new Error('admin role required'), {
            code: 'ACCOUNT_ADMIN_FORBIDDEN', status: 403,
          });
        }
        req.adminActorEmail = access.email;
        req.adminActorRole = role;
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
    // P2 账号体系：客服备注（专用接口只动 notes）+ 设备列表/吊销路由。
    notes: wrap((req, res) => res.json({ account: operations.updateAccountNotes(req.adminActorEmail, req.params.email, req.body) })),
    sessions: wrap((req, res) => res.json(operations.listAccountSessions(req.params.email))),
    revokeSession: wrap((req, res) => res.json(operations.revokeAccountSession(req.adminActorEmail, req.params.email, req.params.sessionId))),
    revokeAllSessions: wrap((req, res) => res.json(operations.revokeAllAccountSessions(req.adminActorEmail, req.params.email, req.body || {}))),
    audit: wrap((req, res) => res.json(operations.listAudit(req.query))),
    videoOperations: wrap((req, res) => res.json(operations.videoOperationsMetrics())),
    reconcileVideos: wrap(async (req, res) => res.json({
      result: await operations.runVideoReconciliation(req.adminActorEmail, req.body),
    })),
    operateVideoJob: wrap(async (req, res) => res.json({
      result: await operations.operateVideoJob(req.adminActorEmail, req.params.id, req.body),
    })),
    // 2026-08-26 §6 #7 H3 灰度邀请：admin 端列表 / 批量生成 / CSV 导出。
    listH3Invites: wrap((req, res) => res.json(operations.listH3Invites(req.query))),
    createH3Invites: wrap(async (req, res) => res.status(201).json({
      result: await operations.createH3Invites(req.adminActorEmail, req.body),
    })),
    // 续命 P2 用户列表 (admin dashboard 用, admin+owner 都能访问)
    listUsers: wrap((req, res) => res.json(operations.listUsers(req.query))),
    userCostReport: wrap((req, res) => res.json(operations.getUserCostReport({ ...req.query, email: req.params.email }))),
    // 4c183cd4 续命 P2 成本核算精确化：全站毛利 + 异常用量预警
    costSummary: wrap((req, res) => res.json(operations.costSummary({ ...req.query }))),
    exportH3Invites: wrap((req, res) => {
      const csv = operations.exportH3InvitesCsv();
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="h3-invite-codes.csv"');
      return res.send(csv);
    }),
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
  // P2 账号体系：客服备注 + 设备列表/吊销。
  app.put('/api/admin/accounts/:email/notes', handlers.requireAdmin, handlers.notes);
  app.get('/api/admin/accounts/:email/sessions', handlers.requireAdmin, handlers.sessions);
  app.delete('/api/admin/accounts/:email/sessions/:sessionId', handlers.requireAdmin, handlers.revokeSession);
  app.post('/api/admin/accounts/:email/sessions-revoke-all', handlers.requireAdmin, handlers.revokeAllSessions);
  app.get('/api/admin/audit', handlers.requireAdmin, handlers.audit);
  app.get('/api/admin/video-operations', handlers.requireAdmin, handlers.videoOperations);
  app.post('/api/admin/video-operations/reconcile', handlers.requireAdmin, handlers.reconcileVideos);
  app.post('/api/admin/video-jobs/:id/actions', handlers.requireAdmin, handlers.operateVideoJob);
  // 2026-08-26 §6 #7 H3 灰度邀请：列表 / 批量生成 / CSV 导出。
  app.get('/api/admin/h3-invites', handlers.requireAdmin, handlers.listH3Invites);
  // 续命 P2 用户列表: admin dashboard 用, admin+owner 都能访问
  app.get('/api/admin/users', handlers.requireAdminRole, handlers.listUsers);
  app.get('/api/admin/users/:email/cost-report', handlers.requireAdminRole, handlers.userCostReport);
  // 4c183cd4 续命 P2 成本核算精确化：全站毛利 + 异常用量预警
  app.get('/api/admin/cost-summary', handlers.requireAdminRole, handlers.costSummary);
  app.post('/api/admin/h3-invites', handlers.requireAdmin, handlers.createH3Invites);
  app.get('/api/admin/h3-invites.csv', handlers.requireAdmin, handlers.exportH3Invites);
  return handlers;
}
