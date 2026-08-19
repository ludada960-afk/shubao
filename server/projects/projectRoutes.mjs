function routeError(error, res) {
  const code = error?.code || 'PROJECT_REQUEST_FAILED';
  if (code.startsWith('AUTH_SESSION_')) {
    return res.status(code === 'AUTH_SESSION_UNAUTHORIZED' ? 403 : 401).json({
      code,
      error: code === 'AUTH_SESSION_UNAUTHORIZED' ? '当前账号没有访问权限' : '登录已失效，请重新登录',
    });
  }
  if (code === 'PROJECT_NOT_FOUND' || code === 'VERSION_NOT_FOUND' || code === 'DOCUMENT_NOT_FOUND') {
    return res.status(404).json({ code: 'PROJECT_NOT_FOUND', error: '未找到该项目' });
  }
  if (code === 'PROJECT_ASSET_NOT_FOUND') {
    return res.status(404).json({ code, error: '未找到该项目素材' });
  }
  if (code === 'VERSION_CONFLICT') {
    return res.status(409).json({ code, error: '内容已在其他位置更新，请刷新后重试' });
  }
  if (code === 'GENERATION_RUN_TERMINAL_CONFLICT') {
    return res.status(409).json({ code, error: '该生成任务已结束，不能改写之前的结果' });
  }
  if (code === 'IDEMPOTENCY_KEY_REQUIRED') {
    return res.status(400).json({ code, error: '请求标识缺失，请重试' });
  }
  return res.status(400).json({ code, error: '请求参数无效' });
}

function ownerFor(req, authenticateOwner) {
  const result = authenticateOwner(req);
  return typeof result === 'string' ? result : result?.email;
}

export function createSessionHandler({ authenticateOwner }) {
  return (req, res) => {
    try {
      const ownerEmail = ownerFor(req, authenticateOwner);
      if (!ownerEmail) throw Object.assign(new Error('missing session owner'), { code: 'AUTH_SESSION_INVALID' });
      return res.json({ ok: true, email: ownerEmail });
    } catch (error) {
      return routeError(error, res);
    }
  };
}

export function mountProjectRoutes(app, { projectStore, authenticateOwner }) {
  if (!app || typeof app.get !== 'function' || typeof app.post !== 'function' || typeof app.patch !== 'function') {
    throw new TypeError('app must provide get, post and patch');
  }
  if (!projectStore || typeof projectStore.createProjectIdempotent !== 'function') {
    throw new TypeError('projectStore is required');
  }
  if (typeof authenticateOwner !== 'function') throw new TypeError('authenticateOwner is required');

  app.get('/api/session', createSessionHandler({ authenticateOwner }));
  app.get('/api/projects', (req, res) => {
    try { return res.json({ projects: projectStore.listProjects({ ownerEmail: ownerFor(req, authenticateOwner) }) }); }
    catch (error) { return routeError(error, res); }
  });
  app.post('/api/projects', (req, res) => {
    try {
      const ownerEmail = ownerFor(req, authenticateOwner);
      const value = projectStore.createProjectIdempotent({
        ownerEmail,
        idempotencyKey: req.headers?.['idempotency-key'] || req.headers?.['Idempotency-Key'],
        kind: req.body?.kind,
        title: req.body?.title,
      });
      return res.status(201).json(value);
    } catch (error) { return routeError(error, res); }
  });
  app.get('/api/projects/:projectId', (req, res) => {
    try {
      const project = projectStore.getProject({ ownerEmail: ownerFor(req, authenticateOwner), projectId: req.params.projectId });
      if (!project) return res.status(404).json({ code: 'PROJECT_NOT_FOUND', error: '未找到该项目' });
      return res.json({ project });
    } catch (error) { return routeError(error, res); }
  });
  app.get('/api/projects/:projectId/assets', (req, res) => {
    try {
      return res.json({ assets: projectStore.listProjectAssets({
        ownerEmail: ownerFor(req, authenticateOwner), projectId: req.params.projectId, mediaKind: req.query?.mediaKind,
      }) });
    } catch (error) { return routeError(error, res); }
  });
  app.get('/api/projects/:projectId/assets/:assetId', (req, res) => {
    try {
      const asset = projectStore.getProjectAsset({
        ownerEmail: ownerFor(req, authenticateOwner), projectId: req.params.projectId, projectAssetId: req.params.assetId,
      });
      if (!asset) return res.status(404).json({ code: 'PROJECT_ASSET_NOT_FOUND', error: '未找到该项目素材' });
      return res.json({ asset });
    } catch (error) { return routeError(error, res); }
  });
  app.post('/api/projects/:projectId/versions', (req, res) => {
    try {
      const version = projectStore.createVersion({
        ownerEmail: ownerFor(req, authenticateOwner), projectId: req.params.projectId,
        parentVersionId: req.body?.parentVersionId || null, reason: req.body?.reason,
        inputSnapshot: req.body?.inputSnapshot || {}, planSnapshot: req.body?.planSnapshot || {},
        canvasSnapshotId: req.body?.canvasSnapshotId || null,
      });
      return res.status(201).json({ version });
    } catch (error) { return routeError(error, res); }
  });
  app.post('/api/projects/:projectId/checkpoints', (req, res) => {
    try {
      const checkpoint = projectStore.createCheckpoint({
        ownerEmail: ownerFor(req, authenticateOwner),
        projectId: req.params.projectId,
        versionId: req.body?.versionId,
        generationRunId: req.body?.generationRunId || null,
        reason: req.body?.reason,
      });
      return res.status(201).json({ checkpoint });
    } catch (error) { return routeError(error, res); }
  });
  app.post('/api/projects/:projectId/complete', (req, res) => {
    try {
      const project = projectStore.completeProject({
        ownerEmail: ownerFor(req, authenticateOwner),
        projectId: req.params.projectId,
        acceptedVersionId: req.body?.acceptedVersionId,
        generationRunId: req.body?.generationRunId || null,
      });
      return res.json({ project });
    } catch (error) { return routeError(error, res); }
  });
  app.get('/api/recovery-checkpoints', (req, res) => {
    try { return res.json({ checkpoints: projectStore.listCheckpoints({ ownerEmail: ownerFor(req, authenticateOwner) }) }); }
    catch (error) { return routeError(error, res); }
  });
  app.post('/api/recovery-checkpoints/:checkpointId/consume', (req, res) => {
    try {
      const checkpoint = projectStore.consumeCheckpoint({ ownerEmail: ownerFor(req, authenticateOwner), checkpointId: req.params.checkpointId });
      if (!checkpoint) return res.status(404).json({ code: 'PROJECT_NOT_FOUND', error: '未找到未完成任务' });
      return res.json({ checkpoint });
    } catch (error) { return routeError(error, res); }
  });
  app.post('/api/recovery-checkpoints/:checkpointId/dismiss', (req, res) => {
    try {
      const checkpoint = projectStore.dismissCheckpoint({ ownerEmail: ownerFor(req, authenticateOwner), checkpointId: req.params.checkpointId });
      if (!checkpoint) return res.status(404).json({ code: 'PROJECT_NOT_FOUND', error: '未找到未完成任务' });
      return res.json({ checkpoint });
    } catch (error) { return routeError(error, res); }
  });
  app.post('/api/canvas-sessions', (req, res) => {
    try {
      const session = projectStore.createCanvasSession({
        ownerEmail: ownerFor(req, authenticateOwner), projectId: req.body?.projectId,
        baseVersionId: req.body?.baseVersionId, snapshot: req.body?.snapshot || {},
      });
      return res.status(201).json({ session });
    } catch (error) { return routeError(error, res); }
  });
  app.get('/api/canvas-sessions/:sessionId', (req, res) => {
    try {
      const session = projectStore.getCanvasSession({
        ownerEmail: ownerFor(req, authenticateOwner), sessionId: req.params.sessionId,
      });
      if (!session) return res.status(404).json({ code: 'PROJECT_NOT_FOUND', error: '未找到该画布会话' });
      return res.json({ session });
    } catch (error) { return routeError(error, res); }
  });
  app.post('/api/canvas-sessions/:sessionId/save', (req, res) => {
    try {
      const session = projectStore.saveCanvasSession({
        ownerEmail: ownerFor(req, authenticateOwner), sessionId: req.params.sessionId,
        expectedRevision: req.body?.expectedRevision, snapshot: req.body?.snapshot || {},
      });
      return res.json({ session });
    } catch (error) { return routeError(error, res); }
  });
  app.patch('/api/canvas-sessions/:sessionId', (req, res) => {
    try {
      const session = projectStore.saveCanvasSession({
        ownerEmail: ownerFor(req, authenticateOwner), sessionId: req.params.sessionId,
        expectedRevision: req.body?.expectedRevision, snapshot: req.body?.snapshot || {},
      });
      return res.json({ session });
    } catch (error) { return routeError(error, res); }
  });
}
