const NOT_FOUND_CODES = new Set([
  'PROJECT_NOT_FOUND',
  'WORKBENCH_ASSET_NOT_FOUND',
  'ASSET_VERSION_NOT_FOUND',
  'SHOT_NOT_FOUND',
  'CANDIDATE_NOT_FOUND',
  'VIDEO_JOB_NOT_FOUND',
  'VIDEO_ASSET_NOT_FOUND',
  'SKILL_RUN_NOT_FOUND',
  'REPLAY_MANIFEST_NOT_FOUND',
  'MEMORY_FACT_NOT_FOUND',
  'MEMORY_ASSET_NOT_FOUND',
]);

function ownerFor(req, authenticateOwner) {
  const result = authenticateOwner(req);
  const ownerEmail = typeof result === 'string' ? result : result?.email;
  if (!ownerEmail) throw Object.assign(new Error('missing session owner'), { code: 'AUTH_SESSION_INVALID' });
  return ownerEmail;
}

function routeError(error, res) {
  const code = error?.code || 'VIDEO_WORKBENCH_REQUEST_FAILED';
  if (code === 'VIDEO_WORKBENCH_UNAVAILABLE') {
    return res.status(404).json({ code: 'PROJECT_NOT_FOUND', error: '未找到该视频项目或内容' });
  }
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
  if (code === 'VIDEO_ASSET_NOT_READY') {
    return res.status(409).json({ code, error: '素材尚未完成持久化校验，请稍后重试' });
  }
  if (code === 'MEMORY_ASSET_VERSION_NOT_APPROVED') {
    return res.status(409).json({ code, error: '项目记忆只能引用已确认的素材版本' });
  }
  if (code === 'MEMORY_INVALID') {
    return res.status(400).json({ code, error: '项目记忆内容无效' });
  }
  return res.status(400).json({ code, error: '请求参数无效' });
}

function handle(res, action, {
  status = 200, key, store = null, operationRequest = null, operationName = '',
} = {}) {
  const startedAt = performance.now();
  const observe = (outcome, error = null) => {
    if (!store || !operationRequest || typeof store.recordOperation !== 'function' || !operationName) return;
    try {
      store.recordOperation({
        ...operationRequest,
        action: operationName,
        outcome,
        latencyMs: performance.now() - startedAt,
        errorCode: error?.code || '',
      });
    } catch {
      // Observability must never alter a workbench response.
    }
  };
  try {
    const value = action();
    observe('success');
    const responseStatus = typeof status === 'function' ? status(value) : status;
    return res.status(responseStatus).json(key ? { [key]: value } : value);
  } catch (error) {
    observe('failure', error);
    return routeError(error, res);
  }
}

function projectPlayableMedia(workbench, ownerEmail, req, playbackUrlForAsset) {
  const playback = assetId => playbackUrlForAsset({ assetId, ownerEmail, req });
  return {
    ...workbench,
    assets: workbench.assets.map(asset => ({
      ...asset,
      versions: asset.versions.map(version => ({
        ...version,
        playbackUrl: version.sourceProjectAssetId ? playback(version.sourceProjectAssetId) : '',
      })),
    })),
    shots: workbench.shots.map(shot => ({
      ...shot,
      candidates: shot.candidates.map(candidate => ({
        ...candidate,
        playbackUrl: playback(candidate.outputAssetId),
      })),
    })),
  };
}

export function mountVideoWorkbenchRoutes(app, {
  enabled = false,
  store,
  authenticateOwner,
  authorizeCohort,
  playbackUrlForAsset,
} = {}) {
  if (!enabled) return false;
  if (!store || typeof store.listWorkbench !== 'function') throw new TypeError('video workbench store is required');
  if (typeof authenticateOwner !== 'function') throw new TypeError('authenticateOwner is required');
  if (typeof authorizeCohort?.requireEligible !== 'function') throw new TypeError('authorizeCohort is required');
  if (typeof playbackUrlForAsset !== 'function') throw new TypeError('playbackUrlForAsset is required');
  if (!app || typeof app.get !== 'function' || typeof app.post !== 'function' || typeof app.patch !== 'function'
    || typeof app.put !== 'function' || typeof app.delete !== 'function') {
    throw new TypeError('app must provide get, post and patch');
  }

  const input = req => {
    const ownerEmail = ownerFor(req, authenticateOwner);
    authorizeCohort.requireEligible(ownerEmail);
    return { ownerEmail, projectId: req.params.projectId };
  };
  const dispatch = (req, res, operationName, action, options = {}) => {
    let request;
    try {
      request = input(req);
    } catch (error) {
      return routeError(error, res);
    }
    return handle(res, () => action(request), {
      ...options,
      store,
      operationRequest: request,
      operationName,
    });
  };

  app.get('/api/video/projects/:projectId/workbench', (req, res) => dispatch(req, res, 'workbench.read', request => (
    projectPlayableMedia(store.listWorkbench(request), request.ownerEmail, req, playbackUrlForAsset)
  )));

  app.get('/api/video/projects/:projectId/workbench/memory', (req, res) => dispatch(
    req, res, 'memory.read', request => ({ memory: store.listProjectMemory(request) }),
  ));

  app.put('/api/video/projects/:projectId/workbench/memory/:factKey', (req, res) => dispatch(
    req, res, 'memory.upsert', request => store.setProjectMemoryFact({
      ...request,
      key: req.params.factKey,
      value: req.body?.value,
      source: req.body?.source,
      assetRefs: req.body?.assetRefs,
      expectedRevision: req.body?.expectedRevision,
    }), { status: value => (value?.revision === 1 ? 201 : 200), key: 'fact' },
  ));

  app.delete('/api/video/projects/:projectId/workbench/memory/:factKey', (req, res) => dispatch(
    req, res, 'memory.delete', request => store.removeProjectMemoryFact({
      ...request,
      key: req.params.factKey,
      expectedRevision: req.body?.expectedRevision,
    }), { key: 'fact' },
  ));

  app.post('/api/video/projects/:projectId/workbench/assets', (req, res) => dispatch(req, res, 'asset.create', request => (
    store.createAsset({ ...request, kind: req.body?.kind, name: req.body?.name })
  ), { status: 201, key: 'asset' }));

  app.post('/api/video/projects/:projectId/workbench/assets/:assetId/versions', (req, res) => dispatch(req, res, 'asset.version.create', request => (
    store.addAssetVersionFromVideoAsset({
      ...request,
      assetId: req.params.assetId,
      videoAssetId: req.body?.videoAssetId,
      metadata: req.body?.metadata,
    })
  ), { status: 201, key: 'version' }));

  app.post('/api/video/projects/:projectId/workbench/assets/:assetId/approve', (req, res) => dispatch(req, res, 'asset.approve', request => (
    store.approveAssetVersion({
      ...request,
      assetId: req.params.assetId,
      versionId: req.body?.versionId,
      expectedRevision: req.body?.expectedRevision,
    })
  ), { key: 'asset' }));

  app.post('/api/video/projects/:projectId/workbench/shots', (req, res) => dispatch(req, res, 'shot.create', request => (
    store.createShot({
      ...request,
      position: req.body?.position,
      purpose: req.body?.purpose,
      durationMs: req.body?.durationMs,
      cameraLanguage: req.body?.cameraLanguage,
      prompt: req.body?.prompt,
    })
  ), { status: 201, key: 'shot' }));

  app.patch('/api/video/projects/:projectId/workbench/shots/:shotId', (req, res) => dispatch(req, res, 'shot.update', request => (
    store.updateShot({
      ...request,
      shotId: req.params.shotId,
      expectedRevision: req.body?.expectedRevision,
      patch: req.body?.patch,
    })
  ), { key: 'shot' }));

  app.post('/api/video/projects/:projectId/workbench/shots/:shotId/bindings', (req, res) => dispatch(req, res, 'shot.bind', request => (
    store.bindShotAssetVersion({
      ...request,
      shotId: req.params.shotId,
      assetId: req.body?.assetId,
      assetVersionId: req.body?.assetVersionId,
      role: req.body?.role,
    })
  ), { status: 201, key: 'binding' }));

  app.post('/api/video/projects/:projectId/workbench/shots/:shotId/candidates', (req, res) => dispatch(req, res, 'candidate.create', request => (
    store.registerCandidateFromJob({
      ...request,
      shotId: req.params.shotId,
      generationJobId: req.body?.generationJobId,
    })
  ), { status: 201, key: 'candidate' }));

  app.post('/api/video/projects/:projectId/workbench/shots/:shotId/select', (req, res) => dispatch(req, res, 'candidate.select', request => (
    store.selectCandidate({
      ...request,
      shotId: req.params.shotId,
      candidateId: req.body?.candidateId,
      expectedRevision: req.body?.expectedRevision,
    })
  )));

  app.post('/api/video/projects/:projectId/workbench/timeline/clips', (req, res) => dispatch(req, res, 'timeline.clip.create', request => (
    store.addTimelineClip({
      ...request,
      shotId: req.body?.shotId,
      candidateId: req.body?.candidateId,
      position: req.body?.position,
      trimStartMs: req.body?.trimStartMs,
      trimEndMs: req.body?.trimEndMs,
      muted: req.body?.muted,
    })
  ), { status: 201, key: 'clip' }));

  app.post('/api/video/projects/:projectId/workbench/replay-manifests', (req, res) => dispatch(
    req, res, 'replay-manifest.create', request => store.createReplayManifest({
      ...request,
      skillId: req.body?.skillId,
      skillVersion: req.body?.skillVersion,
      skillRunId: req.body?.skillRunId,
      modelCatalogSnapshot: req.body?.modelCatalogSnapshot,
      rightsConfirmations: req.body?.rightsConfirmations,
    }), { status: 201, key: 'manifest' },
  ));

  app.get('/api/video/projects/:projectId/workbench/replay-manifests/:manifestId', (req, res) => dispatch(
    req, res, 'replay-manifest.read', request => store.getReplayManifest({
      ...request,
      manifestId: req.params.manifestId,
    }), { key: 'manifest' },
  ));

  app.post('/api/video/projects/:projectId/workbench/replay-manifests/:manifestId/clone', (req, res) => dispatch(
    req, res, 'replay-manifest.clone', request => {
      const idempotencyKey = req.headers?.['idempotency-key'] || req.headers?.['Idempotency-Key'];
      const cloned = store.cloneReplayManifest({
        ...request,
        manifestId: req.params.manifestId,
        idempotencyKey,
        title: req.body?.title,
      });
      return {
        ...cloned,
        workbench: projectPlayableMedia(
          store.listWorkbench({ ownerEmail: request.ownerEmail, projectId: cloned.project.id }),
          request.ownerEmail,
          req,
          playbackUrlForAsset,
        ),
      };
    }, { status: value => (value?.replayed ? 200 : 201) },
  ));

  app.post('/api/video/projects/:projectId/workbench/skill-runs/preview', (req, res) => dispatch(
    req, res, 'skill-run.preview', request => store.previewSkillRun({
      ...request,
      idempotencyKey: req.headers?.['idempotency-key'] || req.headers?.['Idempotency-Key'],
      spec: req.body?.spec,
    }), { status: value => (value?.replayed ? 200 : 201), key: 'run' },
  ));

  app.get('/api/video/projects/:projectId/workbench/skill-runs/:runId', (req, res) => dispatch(
    req, res, 'skill-run.read', request => store.getSkillRun({
      ...request,
      runId: req.params.runId,
    }), { key: 'run' },
  ));

  app.post('/api/video/projects/:projectId/workbench/skill-runs/:runId/checkpoints/:checkpointId/confirm', (req, res) => dispatch(
    req, res, 'skill-run.checkpoint.confirm', request => store.confirmSkillCheckpoint({
      ...request,
      runId: req.params.runId,
      checkpointId: req.params.checkpointId,
      expectedRevision: req.body?.expectedRevision,
    }), { key: 'run' },
  ));

  app.post('/api/video/projects/:projectId/workbench/skill-runs/:runId/steps/:stepId/complete', (req, res) => dispatch(
    req, res, 'skill-run.step.complete', request => store.completeSkillRunStep({
      ...request,
      runId: req.params.runId,
      stepId: req.params.stepId,
      expectedRevision: req.body?.expectedRevision,
    }), { key: 'run' },
  ));

  return true;
}
