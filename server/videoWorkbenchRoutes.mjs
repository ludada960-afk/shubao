const NOT_FOUND_CODES = new Set([
  'PROJECT_NOT_FOUND',
  'WORKBENCH_ASSET_NOT_FOUND',
  'ASSET_VERSION_NOT_FOUND',
  'SHOT_NOT_FOUND',
  'CANDIDATE_NOT_FOUND',
  'VIDEO_JOB_NOT_FOUND',
]);

function ownerFor(req, authenticateOwner) {
  const result = authenticateOwner(req);
  const ownerEmail = typeof result === 'string' ? result : result?.email;
  if (!ownerEmail) throw Object.assign(new Error('missing session owner'), { code: 'AUTH_SESSION_INVALID' });
  return ownerEmail;
}

function routeError(error, res) {
  const code = error?.code || 'VIDEO_WORKBENCH_REQUEST_FAILED';
  if (code.startsWith('AUTH_SESSION_')) {
    return res.status(code === 'AUTH_SESSION_UNAUTHORIZED' ? 403 : 401).json({
      code,
      error: code === 'AUTH_SESSION_UNAUTHORIZED' ? '当前账号没有访问权限' : '登录已失效，请重新登录',
    });
  }
  if (NOT_FOUND_CODES.has(code)) {
    return res.status(404).json({ code: 'PROJECT_NOT_FOUND', error: '未找到该视频项目或内容' });
  }
  if (code === 'VERSION_CONFLICT') {
    return res.status(409).json({ code, error: '内容已在其他位置更新，请刷新后重试' });
  }
  if (code === 'VIDEO_JOB_NOT_READY') {
    return res.status(409).json({ code, error: '视频仍在生成或交付结果尚未校验完成' });
  }
  return res.status(400).json({ code, error: '请求参数无效' });
}

function handle(res, action, { status = 200, key } = {}) {
  try {
    const value = action();
    return res.status(status).json(key ? { [key]: value } : value);
  } catch (error) {
    return routeError(error, res);
  }
}

export function mountVideoWorkbenchRoutes(app, { enabled = false, store, authenticateOwner } = {}) {
  if (!enabled) return false;
  if (!store || typeof store.listWorkbench !== 'function') throw new TypeError('video workbench store is required');
  if (typeof authenticateOwner !== 'function') throw new TypeError('authenticateOwner is required');
  if (!app || typeof app.get !== 'function' || typeof app.post !== 'function' || typeof app.patch !== 'function') {
    throw new TypeError('app must provide get, post and patch');
  }

  const input = req => ({ ownerEmail: ownerFor(req, authenticateOwner), projectId: req.params.projectId });

  app.get('/api/video/projects/:projectId/workbench', (req, res) => handle(res,
    () => store.listWorkbench(input(req))));

  app.post('/api/video/projects/:projectId/workbench/assets', (req, res) => handle(res,
    () => store.createAsset({ ...input(req), kind: req.body?.kind, name: req.body?.name }),
    { status: 201, key: 'asset' }));

  app.post('/api/video/projects/:projectId/workbench/assets/:assetId/versions', (req, res) => handle(res,
    () => store.addAssetVersion({
      ...input(req),
      assetId: req.params.assetId,
      sourceProjectAssetId: req.body?.sourceProjectAssetId,
      stableUrl: req.body?.stableUrl,
      contentHash: req.body?.contentHash,
      mimeType: req.body?.mimeType,
      metadata: req.body?.metadata,
    }),
    { status: 201, key: 'version' }));

  app.post('/api/video/projects/:projectId/workbench/assets/:assetId/approve', (req, res) => handle(res,
    () => store.approveAssetVersion({
      ...input(req),
      assetId: req.params.assetId,
      versionId: req.body?.versionId,
      expectedRevision: req.body?.expectedRevision,
    }),
    { key: 'asset' }));

  app.post('/api/video/projects/:projectId/workbench/shots', (req, res) => handle(res,
    () => store.createShot({
      ...input(req),
      position: req.body?.position,
      purpose: req.body?.purpose,
      durationMs: req.body?.durationMs,
      cameraLanguage: req.body?.cameraLanguage,
      prompt: req.body?.prompt,
    }),
    { status: 201, key: 'shot' }));

  app.patch('/api/video/projects/:projectId/workbench/shots/:shotId', (req, res) => handle(res,
    () => store.updateShot({
      ...input(req),
      shotId: req.params.shotId,
      expectedRevision: req.body?.expectedRevision,
      patch: req.body?.patch,
    }),
    { key: 'shot' }));

  app.post('/api/video/projects/:projectId/workbench/shots/:shotId/bindings', (req, res) => handle(res,
    () => store.bindShotAssetVersion({
      ...input(req),
      shotId: req.params.shotId,
      assetId: req.body?.assetId,
      assetVersionId: req.body?.assetVersionId,
      role: req.body?.role,
    }),
    { status: 201, key: 'binding' }));

  app.post('/api/video/projects/:projectId/workbench/shots/:shotId/candidates', (req, res) => handle(res,
    () => store.registerCandidateFromJob({
      ...input(req),
      shotId: req.params.shotId,
      generationJobId: req.body?.generationJobId,
    }),
    { status: 201, key: 'candidate' }));

  app.post('/api/video/projects/:projectId/workbench/shots/:shotId/select', (req, res) => handle(res,
    () => store.selectCandidate({
      ...input(req),
      shotId: req.params.shotId,
      candidateId: req.body?.candidateId,
      expectedRevision: req.body?.expectedRevision,
    })));

  app.post('/api/video/projects/:projectId/workbench/timeline/clips', (req, res) => handle(res,
    () => store.addTimelineClip({
      ...input(req),
      shotId: req.body?.shotId,
      candidateId: req.body?.candidateId,
      position: req.body?.position,
      trimStartMs: req.body?.trimStartMs,
      trimEndMs: req.body?.trimEndMs,
      muted: req.body?.muted,
    }),
    { status: 201, key: 'clip' }));

  return true;
}
