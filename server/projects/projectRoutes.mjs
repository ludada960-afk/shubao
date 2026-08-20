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
  if (code === 'VIDEO_ASSET_NOT_FOUND') {
    return res.status(404).json({ code, error: '素材不存在或不属于当前账号' });
  }
  if (code === 'VIDEO_ASSET_NOT_READY') {
    return res.status(409).json({ code, error: '素材尚未完成持久化校验，请稍后重试' });
  }
  if (code === 'VIDEO_ASSET_METADATA_INVALID') {
    return res.status(400).json({ code, error: '素材元数据无效' });
  }
  if (code === 'IMAGE_ASSET_NOT_FOUND') {
    return res.status(404).json({ code, error: '图片素材不存在或不属于当前账号' });
  }
  if (code === 'IMAGE_ASSET_NOT_READY') {
    return res.status(409).json({ code, error: '图片素材尚未完成持久化校验，请稍后重试' });
  }
  if (code === 'IMAGE_ASSET_METADATA_INVALID') {
    return res.status(400).json({ code, error: '素材元数据无效' });
  }
  if (code === 'PROJECT_MEDIA_IMPORT_UNAVAILABLE') {
    return res.status(503).json({ code, error: '当前暂不支持把该媒体加入项目，请稍后重试' });
  }
  if (code === 'GENERATED_ASSET_NOT_FOUND') {
    return res.status(404).json({ code, error: '生成图片不存在或不是应用内稳定资产' });
  }
  if (code === 'GENERATED_ASSET_NOT_READY') {
    return res.status(409).json({ code, error: '生成图片尚未完成归档校验，请稍后重试' });
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
  if (code === 'IDEMPOTENCY_CONFLICT') {
    return res.status(409).json({ code, error: '请求标识已用于其他项目，请重新操作' });
  }
  return res.status(400).json({ code, error: '请求参数无效' });
}

function ownerFor(req, authenticateOwner) {
  const result = authenticateOwner(req);
  return typeof result === 'string' ? result : result?.email;
}

function withPlaybackUrl(asset, { ownerEmail, req, resolveAssetPlaybackUrl } = {}) {
  if (!asset || typeof resolveAssetPlaybackUrl !== 'function') return asset;
  try {
    const playbackUrl = resolveAssetPlaybackUrl({ asset, ownerEmail, req });
    return typeof playbackUrl === 'string' && playbackUrl.trim()
      ? { ...asset, playbackUrl: playbackUrl.trim() }
      : asset;
  } catch {
    return asset;
  }
}

function withCanvasSessionPlayback(session, { ownerEmail, req, resolveAssetPlaybackUrl } = {}) {
  if (!session?.snapshot || !Array.isArray(session.snapshot.nodes)
    || typeof resolveAssetPlaybackUrl !== 'function') return session;
  const nodes = session.snapshot.nodes.map(node => {
    const ref = node?.assetRef || node?.projectAssetRef;
    const stableUrl = typeof ref?.stableUrl === 'string' ? ref.stableUrl.trim() : '';
    if (!stableUrl) return node;
    const mediaMatch = /^\/api\/video\/(?:assets|media)\/([^/?#]+)$/i.exec(stableUrl);
    const asset = {
      ...ref,
      stableUrl,
      ...(ref?.assetId || !mediaMatch ? {} : { assetId: decodeURIComponent(mediaMatch[1]) }),
    };
    const decorated = withPlaybackUrl(asset, { ownerEmail, req, resolveAssetPlaybackUrl });
    const playbackUrl = typeof decorated?.playbackUrl === 'string' ? decorated.playbackUrl.trim() : '';
    return playbackUrl ? { ...node, url: playbackUrl, playbackUrl } : node;
  });
  return { ...session, snapshot: { ...session.snapshot, nodes } };
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

export function mountProjectRoutes(app, {
  projectStore,
  authenticateOwner,
  resolveAssetPlaybackUrl = null,
  importVideoAsset = null,
  importImageAsset = null,
  registerGeneratedAsset = null,
} = {}) {
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
  app.get('/api/project-assets', (req, res) => {
    try {
      const ownerEmail = ownerFor(req, authenticateOwner);
      return res.json({ assets: projectStore.listProjectAssetLibrary({
        ownerEmail,
        projectId: req.query?.projectId,
        projectKind: req.query?.projectKind,
        mediaKind: req.query?.mediaKind,
        limit: req.query?.limit,
      }).map(asset => withPlaybackUrl(asset, { ownerEmail, req, resolveAssetPlaybackUrl })) });
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
      const ownerEmail = ownerFor(req, authenticateOwner);
      return res.json({ assets: projectStore.listProjectAssets({
        ownerEmail, projectId: req.params.projectId, mediaKind: req.query?.mediaKind,
      }).map(asset => withPlaybackUrl(asset, { ownerEmail, req, resolveAssetPlaybackUrl })) });
    } catch (error) { return routeError(error, res); }
  });
  app.post('/api/projects/:projectId/assets/register-generated', async (req, res) => {
    try {
      if (typeof registerGeneratedAsset !== 'function') {
        throw Object.assign(new Error('generated asset registration is unavailable'), { code: 'PROJECT_MEDIA_IMPORT_UNAVAILABLE' });
      }
      const ownerEmail = ownerFor(req, authenticateOwner);
      const asset = await registerGeneratedAsset({
        ownerEmail,
        projectId: req.params.projectId,
        versionId: req.body?.versionId || null,
        assetId: req.body?.assetId,
        stableUrl: req.body?.stableUrl,
        role: req.body?.role,
        metadata: req.body?.metadata,
      });
      if (!asset?.projectAssetId) {
        throw Object.assign(new Error('registered project asset is invalid'), { code: 'GENERATED_ASSET_NOT_FOUND' });
      }
      return res.json({ asset: withPlaybackUrl(asset, { ownerEmail, req, resolveAssetPlaybackUrl }) });
    } catch (error) { return routeError(error, res); }
  });
  app.post('/api/projects/:projectId/assets/import-media', async (req, res) => {
    try {
      const sourceKind = String(req.body?.sourceKind || req.body?.mediaKind || '').trim().toLowerCase();
      const importer = sourceKind === 'image' ? importImageAsset : importVideoAsset;
      if (typeof importer !== 'function') {
        throw Object.assign(new Error('media import is unavailable'), { code: 'PROJECT_MEDIA_IMPORT_UNAVAILABLE' });
      }
      const ownerEmail = ownerFor(req, authenticateOwner);
      const asset = await importer({
        ownerEmail,
        projectId: req.params.projectId,
        ...(sourceKind === 'image'
          ? { imageAssetId: req.body?.imageAssetId || req.body?.assetId }
          : { videoAssetId: req.body?.videoAssetId }),
        role: req.body?.role,
        metadata: req.body?.metadata,
        req,
      });
      if (!asset?.projectAssetId) {
        throw Object.assign(new Error('imported project asset is invalid'), { code: 'PROJECT_ASSET_NOT_FOUND' });
      }
      return res.json({ asset: withPlaybackUrl(asset, { ownerEmail, req, resolveAssetPlaybackUrl }) });
    } catch (error) { return routeError(error, res); }
  });
  app.get('/api/projects/:projectId/assets/:assetId/lineage', (req, res) => {
    try {
      const lineage = projectStore.getProjectAssetLineage({
        ownerEmail: ownerFor(req, authenticateOwner), projectId: req.params.projectId, projectAssetId: req.params.assetId,
      });
      if (!lineage) return res.status(404).json({ code: 'PROJECT_ASSET_NOT_FOUND', error: '未找到该项目素材' });
      return res.json({ lineage });
    } catch (error) { return routeError(error, res); }
  });
  app.get('/api/projects/:projectId/assets/:assetId', (req, res) => {
    try {
      const ownerEmail = ownerFor(req, authenticateOwner);
      const asset = withPlaybackUrl(projectStore.getProjectAsset({
        ownerEmail, projectId: req.params.projectId, projectAssetId: req.params.assetId,
      }), { ownerEmail, req, resolveAssetPlaybackUrl });
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
        idempotencyKey: req.headers?.['idempotency-key'] || req.headers?.['Idempotency-Key'] || '',
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
      const ownerEmail = ownerFor(req, authenticateOwner);
      const session = projectStore.createCanvasSession({
        ownerEmail, projectId: req.body?.projectId,
        baseVersionId: req.body?.baseVersionId, snapshot: req.body?.snapshot || {},
      });
      return res.status(201).json({ session: withCanvasSessionPlayback(session, {
        ownerEmail, req, resolveAssetPlaybackUrl,
      }) });
    } catch (error) { return routeError(error, res); }
  });
  app.get('/api/canvas-sessions/:sessionId', (req, res) => {
    try {
      const ownerEmail = ownerFor(req, authenticateOwner);
      const session = projectStore.getCanvasSession({
        ownerEmail, sessionId: req.params.sessionId,
      });
      if (!session) return res.status(404).json({ code: 'PROJECT_NOT_FOUND', error: '未找到该画布会话' });
      return res.json({ session: withCanvasSessionPlayback(session, {
        ownerEmail, req, resolveAssetPlaybackUrl,
      }) });
    } catch (error) { return routeError(error, res); }
  });
  app.post('/api/canvas-sessions/:sessionId/save', (req, res) => {
    try {
      const ownerEmail = ownerFor(req, authenticateOwner);
      const session = projectStore.saveCanvasSession({
        ownerEmail, sessionId: req.params.sessionId,
        expectedRevision: req.body?.expectedRevision, snapshot: req.body?.snapshot || {},
      });
      return res.json({ session: withCanvasSessionPlayback(session, {
        ownerEmail, req, resolveAssetPlaybackUrl,
      }) });
    } catch (error) { return routeError(error, res); }
  });
  app.patch('/api/canvas-sessions/:sessionId', (req, res) => {
    try {
      const ownerEmail = ownerFor(req, authenticateOwner);
      const session = projectStore.saveCanvasSession({
        ownerEmail, sessionId: req.params.sessionId,
        expectedRevision: req.body?.expectedRevision, snapshot: req.body?.snapshot || {},
      });
      return res.json({ session: withCanvasSessionPlayback(session, {
        ownerEmail, req, resolveAssetPlaybackUrl,
      }) });
    } catch (error) { return routeError(error, res); }
  });
}
