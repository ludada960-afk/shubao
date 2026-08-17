import { buildSkillRunSpecFromTemplate } from './videoSkillTemplates.mjs';
import { buildVideoWorkbenchPlan, videoWorkbenchPlanFingerprint } from './videoWorkbenchPlan.mjs';
import { buildVideoWorkbenchGenerationDraft } from './videoWorkbenchGenerationDraft.mjs';

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
  'EXPORT_MANIFEST_NOT_FOUND',
  'MEMORY_FACT_NOT_FOUND',
  'MEMORY_ASSET_NOT_FOUND',
  'AUDIO_TRACK_NOT_FOUND',
  'TIMELINE_CLIP_NOT_FOUND',
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
  if (code === 'VIDEO_PLAN_HASH_INVALID' || code === 'VIDEO_PLAN_NOT_READY') {
    return res.status(409).json({ code, error: error.message || '生成计划已变化，请重新检查计划' });
  }
  if (code === 'VIDEO_PLAN_APPROVAL_REQUIRED') {
    return res.status(409).json({ code, error: error.message || '请先确认当前生成计划' });
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
  if (code === 'AUDIO_ASSET_NOT_APPROVED') {
    return res.status(409).json({ code, error: '音轨只能使用已确认的语音或配乐素材版本' });
  }
  if (code === 'INVALID_AUDIO_TRACK') {
    return res.status(400).json({ code, error: '音轨参数无效，请检查时长、节拍和字幕' });
  }
  if (code === 'INVALID_TIMELINE_CLIP') {
    return res.status(400).json({ code, error: '时间线片段参数无效，请检查位置和剪辑范围' });
  }
  if (code === 'INVALID_VIDEO_EXPORT') {
    return res.status(400).json({ code, error: error.message || '视频导出清单参数无效，请检查时间线和音轨' });
  }
  if (code === 'EXPORT_MANIFEST_INTEGRITY_INVALID') {
    return res.status(500).json({ code, error: '导出清单校验失败，请重新生成清单' });
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

  app.get('/api/video/projects/:projectId/workbench/plan', (req, res) => dispatch(
    req, res, 'workbench.plan.read', request => ({
      ...(() => {
        const plan = buildVideoWorkbenchPlan(store.listWorkbench(request), {
        productId: req.query?.productId,
        mode: req.query?.mode,
        resolution: req.query?.resolution,
        generateAudio: req.query?.generateAudio !== 'false',
        });
        plan.planHash = videoWorkbenchPlanFingerprint(plan);
        const approval = typeof store.getGenerationPlanApproval === 'function'
          ? store.getGenerationPlanApproval(request)
          : null;
        return {
          plan,
          approval: approval && approval.planHash === videoWorkbenchPlanFingerprint(plan) ? approval : null,
        };
      })(),
    }),
  ));

  app.post('/api/video/projects/:projectId/workbench/plan/approve', (req, res) => dispatch(
    req, res, 'workbench.plan.approve', request => {
      const plan = buildVideoWorkbenchPlan(store.listWorkbench(request), {
        productId: req.body?.productId,
        mode: req.body?.mode,
        resolution: req.body?.resolution,
        generateAudio: req.body?.generateAudio !== false,
      });
      const planHash = videoWorkbenchPlanFingerprint(plan);
      if (String(req.body?.planHash || '').trim() !== planHash) {
        throw Object.assign(new Error('生成计划已变化，请重新检查计划'), { code: 'VIDEO_PLAN_HASH_INVALID' });
      }
      return store.approveGenerationPlan({ ...request, plan, planHash });
    }, { status: 201, key: 'approval' },
  ));

  app.post('/api/video/projects/:projectId/workbench/generation-draft', (req, res) => dispatch(
    req, res, 'workbench.generation-draft', request => {
      const options = {
        productId: req.body?.productId,
        mode: req.body?.mode,
        resolution: req.body?.resolution,
        generateAudio: req.body?.generateAudio !== false,
      };
      const workbench = store.listWorkbench(request);
      const plan = buildVideoWorkbenchPlan(workbench, options);
      const planHash = videoWorkbenchPlanFingerprint(plan);
      const approval = typeof store.getGenerationPlanApproval === 'function'
        ? store.getGenerationPlanApproval(request)
        : null;
      const draft = buildVideoWorkbenchGenerationDraft(workbench, { ...plan, planHash }, {
        planHash: req.body?.planHash,
        approvalHash: approval?.planHash,
      });
      const persisted = typeof store.saveGenerationDraft === 'function'
        ? store.saveGenerationDraft({ ...request, draft })
        : draft;
      return { draft: persisted };
    }, { status: 201 }),
  );

  app.get('/api/video/projects/:projectId/workbench/generation-draft', (req, res) => dispatch(
    req, res, 'workbench.generation-draft.read', request => ({
      draft: typeof store.getGenerationDraft === 'function'
        ? store.getGenerationDraft({ ...request, planHash: req.query?.planHash })
        : null,
    }),
  ));

  app.get('/api/video/projects/:projectId/workbench/memory', (req, res) => dispatch(
    req, res, 'memory.read', request => ({ memory: store.listProjectMemory(request) }),
  ));

  app.get('/api/video/projects/:projectId/workbench/skill-templates', (req, res) => dispatch(
    req, res, 'skill-template.read', request => ({ templates: store.listSkillTemplates(request) }),
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
      direction: req.body?.direction,
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

  app.patch('/api/video/projects/:projectId/workbench/timeline/clips/:clipId', (req, res) => dispatch(req, res, 'timeline.clip.update', request => (
    store.updateTimelineClip({
      ...request,
      clipId: req.params.clipId,
      expectedRevision: req.body?.expectedRevision,
      patch: req.body?.patch,
    })
  ), { key: 'clip' }));

  app.post('/api/video/projects/:projectId/workbench/audio-tracks', (req, res) => dispatch(req, res, 'audio-track.create', request => (
    store.createAudioTrack({
      ...request,
      kind: req.body?.kind,
      assetId: req.body?.assetId,
      assetVersionId: req.body?.assetVersionId,
      startMs: req.body?.startMs,
      durationMs: req.body?.durationMs,
      volume: req.body?.volume,
      muted: req.body?.muted,
      language: req.body?.language,
      voiceAnchor: req.body?.voiceAnchor,
      beatMarkers: req.body?.beatMarkers,
      subtitleCues: req.body?.subtitleCues,
    })
  ), { status: 201, key: 'track' }));

  app.patch('/api/video/projects/:projectId/workbench/audio-tracks/:trackId', (req, res) => dispatch(req, res, 'audio-track.update', request => (
    store.updateAudioTrack({
      ...request,
      trackId: req.params.trackId,
      expectedRevision: req.body?.expectedRevision,
      patch: req.body?.patch,
    })
  ), { key: 'track' }));

  app.post('/api/video/projects/:projectId/workbench/export-manifests', (req, res) => dispatch(
    req, res, 'export-manifest.create', request => store.createExportManifest({
      ...request,
      options: req.body?.options || {},
    }), { status: value => (value?.replayed ? 200 : 201), key: 'manifest' },
  ));

  app.get('/api/video/projects/:projectId/workbench/export-manifests', (req, res) => dispatch(
    req, res, 'export-manifest.list', request => store.listExportManifests({
      ...request,
      limit: req.query?.limit,
    }), { key: 'manifests' },
  ));

  app.get('/api/video/projects/:projectId/workbench/export-manifests/:manifestId', (req, res) => dispatch(
    req, res, 'export-manifest.read', request => store.getExportManifest({
      ...request,
      manifestId: req.params.manifestId,
    }), { key: 'manifest' },
  ));

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

  app.get('/api/video/projects/:projectId/workbench/replay-manifests', (req, res) => dispatch(
    req, res, 'replay-manifest.list', request => store.listReplayManifests({
      ...request,
      limit: req.query?.limit,
    }), { key: 'manifests' },
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
      spec: req.body?.templateId
        ? buildSkillRunSpecFromTemplate(req.body.templateId, { input: req.body?.input })
        : req.body?.spec,
    }), { status: value => (value?.replayed ? 200 : 201), key: 'run' },
  ));

  app.get('/api/video/projects/:projectId/workbench/skill-runs/:runId', (req, res) => dispatch(
    req, res, 'skill-run.read', request => store.getSkillRun({
      ...request,
      runId: req.params.runId,
    }), { key: 'run' },
  ));

  app.post('/api/video/projects/:projectId/workbench/skill-runs/:runId/execution-preview', (req, res) => dispatch(
    req, res, 'skill-run.execution-preview', request => store.previewSkillRunExecution({
      ...request,
      runId: req.params.runId,
      stepCosts: req.body?.stepCosts,
    }), { key: 'executionPreview' },
  ));

  app.post('/api/video/projects/:projectId/workbench/skill-runs/:runId/checkpoints/:checkpointId/confirm', (req, res) => dispatch(
    req, res, 'skill-run.checkpoint.confirm', request => store.confirmSkillCheckpoint({
      ...request,
      runId: req.params.runId,
      checkpointId: req.params.checkpointId,
      expectedRevision: req.body?.expectedRevision,
    }), { key: 'run' },
  ));

  app.post('/api/video/projects/:projectId/workbench/skill-runs/:runId/guards/:guardId/confirm', (req, res) => dispatch(
    req, res, 'skill-run.guard.confirm', request => store.confirmSkillRunGuard({
      ...request,
      runId: req.params.runId,
      guardId: req.params.guardId,
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
