import crypto from 'node:crypto';

import { buildModelRoute, normalizeImageModel, resolveGenerationSize } from './ecommerceEngine/modelCatalog.mjs';
import { ecommerceFeatureForItem } from './ecommerceEngine/ecommerceBilling.mjs';
import {
  buildCanvasGenerationPrompt,
  normalizeCreationIntent,
  normalizeVisualSkillId,
} from './visualCreationSkills.mjs';

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function imageExtension(contentType) {
  if (contentType === 'image/jpeg') return 'jpg';
  if (contentType === 'image/webp') return 'webp';
  return 'png';
}

function invalidRequest(message) {
  return Object.assign(new Error(message), {
    status: 400,
    code: 'CANVAS_REQUEST_INVALID',
    retryable: false,
  });
}

function clampUnit(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(1, Math.max(0, parsed)) : fallback;
}

function normalizeSelection(selection) {
  if (!selection || typeof selection !== 'object') return { mode: 'whole' };
  const mode = selection.mode === 'subject' ? 'subject' : selection.mode === 'rectangle' ? 'rectangle' : 'whole';
  if (mode !== 'rectangle') return { mode };
  const rect = selection.rect || {};
  const x = clampUnit(rect.x);
  const y = clampUnit(rect.y);
  return {
    mode,
    rect: {
      x,
      y,
      w: Math.min(1 - x, Math.max(0, Number.isFinite(Number(rect.w)) ? Number(rect.w) : 0)),
      h: Math.min(1 - y, Math.max(0, Number.isFinite(Number(rect.h)) ? Number(rect.h) : 0)),
    },
  };
}

function selectionInstruction(selection) {
  if (selection.mode === 'subject') return '仅修改被识别的商品主体区域，背景、版式和其他内容保持不变。';
  if (selection.mode !== 'rectangle') return '';
  const { x, y, w, h } = selection.rect;
  return `仅修改归一化区域 x=${x.toFixed(3)}, y=${y.toFixed(3)}, w=${w.toFixed(3)}, h=${h.toFixed(3)}，区域外内容保持不变。`;
}

function normalizeReferenceMetadata(value, visualInputs) {
  if (!Array.isArray(value)) return [];
  const allowedUrls = new Set(visualInputs);
  return value.slice(0, 9).map((item, index) => {
    if (!item || typeof item !== 'object') return null;
    const url = cleanString(item.url);
    if (!url || !allowedUrls.has(url)) return null;
    const displayName = cleanString(item.displayName || item.name || item.label).replace(/^@/, '') || `图片${index + 1}`;
    return {
      sourceNodeId: cleanString(item.sourceNodeId),
      assetId: cleanString(item.assetId),
      url,
      displayName,
      mention: cleanString(item.mention || item.label) || `@${displayName}`,
      role: item.role === 'product' ? 'product' : 'reference',
      order: Number.isFinite(Number(item.order)) ? Number(item.order) : index,
    };
  }).filter(Boolean);
}

/* 9-12 用户批注: **上游 / 供应商属于内部信息，任何情况下都不得出现在用户可见文案里**。
   用户只看到产品级提示；技术细节（上游任务号、上游原文）只留在服务端日志与 provider_job_id 列，供我们自己排查。 */
const USER_FACING_GENERATION_MESSAGES = Object.freeze({
  CANVAS_GENERATION_FAILED: '生成失败，请重试',
  PROVIDER_NETWORK_ERROR: '生成服务暂时繁忙，请稍后重试',
  PROVIDER_POLL_TIMEOUT: '生成超时，请重试',
  PROVIDER_JOB_ID_MISSING: '生成服务暂时繁忙，请稍后重试',
  CONTENT_BLOCKED: '内容未通过安全审核，请调整说明后重试',
  INSUFFICIENT_POINTS: '积分不足，请先充值',
});
const TRANSIENT_ERROR_PATTERN = /upstream_5xx|\b5\d{2}\b|timeout|timed out|deadline|network|socket hang up|ECONNRESET|ETIMEDOUT/i;

function userFacingGenerationMessage(error) {
  const code = cleanString(error?.code);
  if (USER_FACING_GENERATION_MESSAGES[code]) return USER_FACING_GENERATION_MESSAGES[code];
  if (TRANSIENT_ERROR_PATTERN.test(String(error?.message || ''))) return '生成服务暂时繁忙，请稍后重试';
  return '生成失败，请重试';
}

function serializedError(error) {
  const transient = TRANSIENT_ERROR_PATTERN.test(String(error?.message || ''));
  if (String(error?.message || '').trim()) {
    /* 技术细节只进日志，不进用户响应 */
    console.warn('[canvas-generation] provider failure', JSON.stringify({
      code: cleanString(error?.code) || 'CANVAS_GENERATION_FAILED',
      providerJobId: cleanString(error?.jobId),
      detail: String(error?.message || '').slice(0, 400),
    }));
  }
  return {
    message: userFacingGenerationMessage(error),
    status: Number.isInteger(error?.status) ? error.status : 0,
    code: cleanString(error?.code) || 'CANVAS_GENERATION_FAILED',
    retryable: error?.retryable === true || transient,
    retryAfter: Number.isFinite(error?.retryAfter) ? error.retryAfter : null,
    /* 不再外泄 jobId：上游任务号只作内部排查（provider_job_id 列 + 日志） */
  };
}

function storedError(job) {
  const snapshot = job?.error || {};
  return Object.assign(new Error(snapshot.message || 'Canvas generation failed'), {
    status: snapshot.status || 0,
    code: snapshot.code || 'CANVAS_GENERATION_FAILED',
    retryable: snapshot.retryable === true,
    retryAfter: snapshot.retryAfter ?? null,
    jobId: snapshot.jobId || job?.providerJobId || '',
    taskId: job?.requestId,
  });
}

function normalizeRequest(ownerEmailInput, body = {}) {
  const ownerEmail = cleanString(ownerEmailInput).toLowerCase();
  const selection = normalizeSelection(body?.selection);
  const prompt = [cleanString(body?.prompt), selectionInstruction(selection)].filter(Boolean).join('\n');
  const primaryImage = cleanString(body?.image_url);
  const requestKey = cleanString(body?.request_key).slice(0, 160);
  const creationIntent = normalizeCreationIntent(body?.creation_intent ?? body?.creationIntent);
  const skillId = creationIntent === 'visual'
    ? normalizeVisualSkillId(body?.skill_id ?? body?.skillId)
    : 'free';
  if (!ownerEmail) throw invalidRequest('Canvas generation owner is required');
  if (!prompt) throw invalidRequest('缺少生成说明');
  const visualInputs = [
    ...(primaryImage ? [primaryImage] : []),
    ...(Array.isArray(body?.reference_images) ? body.reference_images : []),
  ].map(cleanString).filter(Boolean).slice(0, 9);
  const referenceMetadata = normalizeReferenceMetadata(body?.reference_metadata, visualInputs);
  const imageModel = normalizeImageModel(body?.image_model ?? body?.imageModel);
  const selectedSize = resolveGenerationSize({ imageModel, resolution: body?.resolution || '2K', ratio: body?.ratio });
  const canonical = JSON.stringify({
    ownerEmail,
    prompt,
    requestKey,
    visualInputs,
    referenceMetadata,
    selection,
    creationIntent,
    skillId,
    imageModel,
    resolution: selectedSize.resolution,
    ratio: selectedSize.ratio,
    size: selectedSize.size,
  });
  const fingerprint = crypto.createHash('sha256').update(canonical).digest('hex');
  return {
    ownerEmail,
    prompt,
    requestKey,
    visualInputs,
    referenceMetadata,
    selection,
    creationIntent,
    skillId,
    imageModel,
    selectedSize,
    requestFingerprint: fingerprint,
    requestId: `canvas_${fingerprint}`,
    idempotencyKey: `canvas-${fingerprint}`,
  };
}

export function createCanvasGenerationService({
  store,
  imageInputReader,
  providerAdapter,
  imageGenerationPool,
  generatedAssetStore,
  model,
  now = Date.now,
  leaseHeartbeatMs = null,
  setIntervalFn = setInterval,
  clearIntervalFn = clearInterval,
} = {}) {
  if (!store
    || typeof store.get !== 'function'
    || typeof store.getOrCreate !== 'function'
    || typeof store.claim !== 'function'
    || typeof store.renewLease !== 'function') {
    throw new TypeError('Canvas generation store is required');
  }
  if (!imageInputReader || typeof imageInputReader.read !== 'function') {
    throw new TypeError('imageInputReader.read is required');
  }
  if (!providerAdapter
    || typeof providerAdapter.submitEdit !== 'function'
    || typeof providerAdapter.pollUntilReady !== 'function') {
    throw new TypeError('providerAdapter submitEdit and pollUntilReady are required');
  }
  if (!imageGenerationPool || typeof imageGenerationPool.run !== 'function') {
    throw new TypeError('imageGenerationPool.run is required');
  }
  if (!generatedAssetStore || typeof generatedAssetStore.persist !== 'function') {
    throw new TypeError('generatedAssetStore.persist is required');
  }
  const providerModel = cleanString(model);
  if (!providerModel) throw new TypeError('Canvas provider model is required');
  if (typeof now !== 'function') throw new TypeError('now must be a function');
  if (leaseHeartbeatMs !== null
    && (!Number.isSafeInteger(leaseHeartbeatMs) || leaseHeartbeatMs <= 0)) {
    throw new TypeError('leaseHeartbeatMs must be a positive safe integer');
  }
  if (typeof setIntervalFn !== 'function' || typeof clearIntervalFn !== 'function') {
    throw new TypeError('lease heartbeat interval functions are required');
  }

  function currentTimeMs() {
    const value = now();
    const timestamp = value instanceof Date ? value.getTime() : value;
    if (!Number.isFinite(timestamp)) throw new TypeError('now must return a finite timestamp');
    return timestamp;
  }

  function inProgressError(requestId) {
    return Object.assign(new Error('Canvas generation is already in progress'), {
      status: 503,
      code: 'CANVAS_REQUEST_IN_PROGRESS',
      retryable: true,
      taskId: requestId,
    });
  }

  function startLeaseHeartbeat(job) {
    const leaseRemainingMs = Date.parse(job.leaseExpiresAt || '') - currentTimeMs();
    const intervalMs = leaseHeartbeatMs ?? Math.max(
      1,
      Math.floor(
        Number.isFinite(leaseRemainingMs) && leaseRemainingMs > 0
          ? leaseRemainingMs / 3
          : 10_000,
      ),
    );
    let stopped = false;
    let renewalError = null;
    let timer = null;
    const renew = () => {
      if (stopped || renewalError) return;
      try {
        store.renewLease(job.requestId, { leaseToken: job.leaseToken });
      } catch (error) {
        renewalError = error instanceof Error
          ? error
          : new Error('Canvas generation lease heartbeat failed');
        clearIntervalFn(timer);
      }
    };
    timer = setIntervalFn(renew, intervalMs);
    timer?.unref?.();
    return {
      stop() {
        if (stopped) return;
        stopped = true;
        clearIntervalFn(timer);
      },
      assertOwned() {
        if (renewalError) throw renewalError;
      },
    };
  }

  function reopenPersistenceFailure(job) {
    if (job?.status !== 'failed' || !job.outputUrl || job.stableUrl) return job;
    if (typeof store.reopenForPersistence !== 'function') return job;
    return store.reopenForPersistence(job.requestId) || job;
  }

  async function regenerate({ ownerEmail, body } = {}) {
    const request = normalizeRequest(ownerEmail, body);
    let job = store.getOrCreate({
      requestId: request.requestId,
      ownerEmail: request.ownerEmail,
      requestFingerprint: request.requestFingerprint,
        requestSnapshot: {
          prompt: request.prompt,
          requestKey: request.requestKey,
          inputCount: request.visualInputs.length,
          selection: request.selection,
          creationIntent: request.creationIntent,
          skillId: request.skillId,
        ratio: request.selectedSize.ratio,
        size: request.selectedSize.size,
        imageModel: request.imageModel,
      },
    });
    job = reopenPersistenceFailure(job);
    if (job.status === 'completed' && job.stableUrl) {
      return {
        taskId: job.requestId,
        url: job.stableUrl,
        replay: true,
        ratio: request.selectedSize.ratio,
        resolution: request.selectedSize.resolution,
      };
    }
    if (job.status === 'failed') throw storedError(job);
    let ownedLeaseToken = '';

    try {
      return await imageGenerationPool.run(async () => {
        job = store.get(job.requestId);
        job = reopenPersistenceFailure(job);
        if (job?.status === 'completed' && job.stableUrl) {
          return {
            taskId: job.requestId,
            url: job.stableUrl,
            replay: true,
            ratio: request.selectedSize.ratio,
            resolution: request.selectedSize.resolution,
          };
        }
        if (job?.status === 'failed') throw storedError(job);
        const claimed = store.claim(request.requestId);
        if (!claimed) {
          job = store.get(request.requestId);
          job = reopenPersistenceFailure(job);
          if (job?.status === 'completed' && job.stableUrl) {
            return {
              taskId: job.requestId,
              url: job.stableUrl,
              replay: true,
              ratio: request.selectedSize.ratio,
              resolution: request.selectedSize.resolution,
            };
          }
          if (job?.status === 'failed') throw storedError(job);
          throw inProgressError(request.requestId);
        }
        job = claimed;
        ownedLeaseToken = claimed.leaseToken;
        const heartbeat = startLeaseHeartbeat(claimed);
        try {
          if (!job.providerJobId) {
            const resolvedInputs = [];
            for (const input of request.visualInputs) {
              try {
                resolvedInputs.push(await imageInputReader.read(input));
              } catch (error) {
                if (input === request.visualInputs[0]) throw error;
              }
            }
            if (request.visualInputs.length && resolvedInputs.length === 0) throw invalidRequest('读取原图失败');
            const referenceNote = resolvedInputs.length > 1
              ? request.creationIntent === 'visual'
                ? `Image 0 is the primary subject or composition reference. Images 1 through ${resolvedInputs.length - 1} are indexed visual references; borrow only compatible identity, composition, palette, texture, or style cues.`
                : ` Image 0 is the authoritative product view. Images 1 through ${resolvedInputs.length - 1} are indexed visual references; borrow only compatible composition or style cues from them without changing the product identity.`
              : '';
            const mentionNote = request.referenceMetadata.length
              ? ` User references map as follows: ${request.referenceMetadata.map(item => `${item.mention}=${item.displayName} (${item.role})`).join('; ')}. Resolve every @ mention against this mapping.`
              : '';
            heartbeat.assertOwned();
            const selectedRoute = buildModelRoute({
              imageModel: request.imageModel,
              resolution: request.selectedSize.resolution,
              ratio: request.selectedSize.ratio,
              assetCount: 1,
              batchEligible: false,
            });
            const hasImageInputs = resolvedInputs.length > 0;
            const providerRequest = {
              idempotencyKey: request.idempotencyKey,
              prompt: buildCanvasGenerationPrompt({
                creationIntent: request.creationIntent,
                skillId: request.skillId,
                userPrompt: request.prompt,
                hasImageInputs,
                referenceNote,
                mentionNote,
              }),
              modelRoute: selectedRoute.provider === 'image2'
                ? { ...selectedRoute, model: providerModel, mode: hasImageInputs ? 'edit' : 'generate' }
                : { ...selectedRoute, mode: hasImageInputs ? 'edit' : 'generate' },
              inputAssets: resolvedInputs.map((image, index) => ({
                ...image,
                fileName: `canvas-reference-${index + 1}.${imageExtension(image.contentType)}`,
              })),
            };
            const submitted = await providerAdapter.submitEdit(providerRequest);
            heartbeat.assertOwned();
            job = store.markSubmitted(job.requestId, {
              providerJobId: submitted.jobId,
              leaseToken: job.leaseToken,
            });
          }
          if (!job.outputUrl) {
            heartbeat.assertOwned();
            let completed = await providerAdapter.pollUntilReady(job.providerJobId);
            /* 9-12 同模型换供应商（用户无感）：主通道「任务跑失败」时用同一请求改提交到备用供应商。
               只切一次 —— 备用 jobId 自带 overflow: 前缀，已是备用就不再切，避免无限轮换。
               用户侧文案不变（仍走 serializedError 的产品级文案），技术细节只进日志。 */
            const failedTerminally = completed.status !== 'completed' || !completed.outputUrl;
            const alreadyOnOverflow = String(job.providerJobId || '').startsWith('overflow:');
            if (failedTerminally && alreadyOnOverflow === false
              && providerAdapter.hasOverflow === true && typeof providerAdapter.failover === 'function') {
              try {
                console.warn('[canvas-generation] provider failover', JSON.stringify({
                  from: cleanString(job.providerJobId),
                  detail: String(completed.error || '').slice(0, 200),
                }));
                const alternative = await providerAdapter.failover(providerRequest);
                if (alternative && alternative.jobId) {
                  job = store.markSubmitted(job.requestId, {
                    providerJobId: alternative.jobId,
                    leaseToken: job.leaseToken,
                  });
                  completed = await providerAdapter.pollUntilReady(job.providerJobId);
                }
              } catch (failoverError) {
                console.warn('[canvas-generation] provider failover failed', JSON.stringify({
                  detail: String(failoverError?.message || '').slice(0, 200),
                }));
              }
            }
            heartbeat.assertOwned();
            if (cleanString(completed?.jobId) !== job.providerJobId) {
              throw Object.assign(new Error('Provider poll result job id does not match the submitted job'), {
                status: 502,
                code: 'PROVIDER_JOB_ID_MISMATCH',
                retryable: false,
                jobId: cleanString(completed?.jobId),
                expectedJobId: job.providerJobId,
              });
            }
            if (completed.status !== 'completed' || !completed.outputUrl) {
              throw new Error(completed.error || '图片生成未完成');
            }
            job = store.markOutput(job.requestId, {
              outputUrl: completed.outputUrl,
              leaseToken: job.leaseToken,
            });
          }
          heartbeat.assertOwned();
          let asset;
          try {
            asset = await generatedAssetStore.persist({
              sourceUrl: job.outputUrl,
              taskId: job.requestId,
              label: 'canvas_regenerated',
            });
          } catch (cause) {
            throw Object.assign(cause instanceof Error ? cause : new Error('Generated asset persistence failed'), {
              status: 503,
              code: 'CANVAS_ASSET_PERSIST_FAILED',
              retryable: true,
              resumeable: true,
            });
          }
          heartbeat.assertOwned();
          job = store.complete(job.requestId, {
            stableUrl: asset.url,
            leaseToken: job.leaseToken,
          });
          return {
            taskId: job.requestId,
            url: job.stableUrl,
            replay: false,
            ratio: request.selectedSize.ratio,
            resolution: request.selectedSize.resolution,
          };
        } finally {
          heartbeat.stop();
        }
      });
    } catch (error) {
      const enriched = error instanceof Error ? error : new Error('Canvas generation failed');
      if (!Number.isInteger(enriched.status)
        && /image generation service is busy|queue.*busy/i.test(enriched.message || '')) {
        enriched.status = 503;
        enriched.code = 'CANVAS_GENERATION_BUSY';
        enriched.retryable = true;
        enriched.retryAfter = 1;
      }
      enriched.taskId = job.requestId;
      if (!enriched.jobId && job.providerJobId) enriched.jobId = job.providerJobId;
      if (ownedLeaseToken) {
        try {
          store.recordError(job.requestId, {
            error: serializedError(enriched),
            retryable: enriched.retryable === true,
            leaseToken: ownedLeaseToken,
          });
        } catch (storeError) {
          if (storeError?.code === 'CANVAS_LEASE_LOST') throw storeError;
        }
      }
      throw enriched;
    }
  }

  async function inspect({ ownerEmail, body } = {}) {
    const request = normalizeRequest(ownerEmail, body);
    const job = store.get(request.requestId);
    if (!job) {
      return { status: 'missing', taskId: request.requestId };
    }
    if (job.status === 'completed' && job.stableUrl) {
      return {
        status: 'completed',
        taskId: job.requestId,
        url: job.stableUrl,
        ratio: request.selectedSize.ratio,
        resolution: request.selectedSize.resolution,
      };
    }
    if (job.status === 'failed') {
      const error = storedError(job);
      return {
        status: 'failed',
        taskId: job.requestId,
        error: error.message,
        code: error.code,
        retryable: error.retryable === true,
      };
    }
    return {
      status: job.status || 'queued',
      taskId: job.requestId,
    };
  }

  return { regenerate, inspect };
}

export function mapCanvasGenerationError(error) {
  const retryable = error?.retryable === true;
  const candidateStatus = Number(error?.status);
  const status = Number.isInteger(candidateStatus) && candidateStatus >= 400 && candidateStatus <= 599
    ? candidateStatus
    : retryable ? 503 : 500;
  const retryAfter = Number.isFinite(error?.retryAfter) && error.retryAfter >= 0
    ? Math.ceil(error.retryAfter)
    : null;
  return {
    status,
    retryAfter,
    body: {
      error: error?.message || '重新生成失败',
      code: cleanString(error?.code) || 'CANVAS_GENERATION_FAILED',
      retryable,
      resumeable: error?.resumeable === true || retryable,
      ...(Number.isFinite(error?.required) ? { required: error.required } : {}),
      ...(Number.isFinite(error?.available) ? { available: error.available } : {}),
      ...(error?.billing && typeof error.billing === 'object' ? { billing: error.billing } : {}),
      ...(error?.reQuoteRequired === true ? { reQuoteRequired: true } : {}),
      ...(cleanString(error?.taskId) ? { taskId: cleanString(error.taskId) } : {}),
      ...(cleanString(error?.jobId) ? { providerJobId: cleanString(error.jobId) } : {}),
      ...(retryAfter !== null ? { retryAfter } : {}),
    },
  };
}

export function createCanvasRegenerateHandler({ service, billing } = {}) {
  if (!service || typeof service.regenerate !== 'function') {
    throw new TypeError('Canvas generation service is required');
  }
  if (!billing || typeof billing.execute !== 'function') {
    throw new TypeError('Canvas billing execute is required');
  }
  return async function canvasRegenerateHandler(req, res) {
    try {
      const ownerEmail = cleanString(req?._userEmail).toLowerCase();
      if (!ownerEmail) {
        throw Object.assign(new Error('登录状态无效或已过期，请重新登录'), {
          status: 401,
          code: 'AUTH_SESSION_REQUIRED',
          retryable: false,
        });
      }
      const body = req?.body || {};
      const creationIntent = normalizeCreationIntent(body.creation_intent ?? body.creationIntent);
      const skillId = creationIntent === 'visual'
        ? normalizeVisualSkillId(body.skill_id ?? body.skillId)
        : 'free';
      const imageModel = normalizeImageModel(body.image_model ?? body.imageModel);
      const selectedSize = resolveGenerationSize({ ...body, imageModel });
      const feature = ecommerceFeatureForItem({ imageModel, generationSize: selectedSize.size });
      const billed = await billing.execute({
        ownerEmail,
        quoteId: body.billing_quote_id,
        actionId: body.billing_action_id,
        sku: feature.sku,
        referenceType: creationIntent === 'visual' ? 'visual_creation' : 'canvas_regenerate',
        providerCostCny: feature.providerCostCny,
        metadata: {
          action: creationIntent === 'visual' ? 'visual_create' : 'regenerate',
          resolution: selectedSize.resolution,
          imageModel,
          creationIntent,
          skillId,
        },
        resumableWork: true,
        work: () => service.regenerate({ ownerEmail, body }),
      });
      const result = billed.result;
      return res.json({
        url: result.url,
        ...(result.taskId ? { taskId: result.taskId } : {}),
        ...(billed.replay === true || typeof result.replay === 'boolean'
          ? { replay: billed.replay === true || result.replay === true }
          : {}),
        ...(cleanString(result.ratio) ? { ratio: cleanString(result.ratio) } : {}),
        ...(cleanString(result.resolution) ? { resolution: cleanString(result.resolution) } : {}),
        billing: billed.billing,
      });
    } catch (error) {
      const mapped = mapCanvasGenerationError(error);
      if (mapped.retryAfter !== null) {
        res.setHeader('Retry-After', mapped.retryAfter);
      }
      return res.status(mapped.status).json(mapped.body);
    }
  };
}

export function createCanvasGenerationStatusHandler({ service } = {}) {
  if (!service || typeof service.inspect !== 'function') {
    throw new TypeError('Canvas generation status service is required');
  }
  return async function canvasGenerationStatusHandler(req, res) {
    try {
      const ownerEmail = cleanString(req?._userEmail).toLowerCase();
      if (!ownerEmail) {
        return res.status(401).json({
          status: 'failed',
          code: 'AUTH_SESSION_REQUIRED',
          error: '登录状态无效或已过期，请重新登录',
        });
      }
      const result = await service.inspect({ ownerEmail, body: req?.body || {} });
      if (result.status === 'missing') return res.status(404).json(result);
      if (result.status === 'completed' || result.status === 'failed') return res.json(result);
      return res.status(202).json({ ...result, status: 'processing', retryAfter: 2 });
    } catch (error) {
      const mapped = mapCanvasGenerationError(error);
      return res.status(mapped.status).json(mapped.body);
    }
  };
}
