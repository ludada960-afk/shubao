import crypto from 'node:crypto';

import { resolveGenerationSize } from './ecommerceEngine/modelCatalog.mjs';

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

function serializedError(error) {
  return {
    message: error?.message || 'Canvas generation failed',
    status: Number.isInteger(error?.status) ? error.status : 0,
    code: cleanString(error?.code) || 'CANVAS_GENERATION_FAILED',
    retryable: error?.retryable === true,
    retryAfter: Number.isFinite(error?.retryAfter) ? error.retryAfter : null,
    jobId: cleanString(error?.jobId),
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
  const prompt = cleanString(body?.prompt);
  const primaryImage = cleanString(body?.image_url);
  if (!ownerEmail) throw invalidRequest('Canvas generation owner is required');
  if (!prompt || !primaryImage) throw invalidRequest('缺少图片或生成说明');
  const visualInputs = [
    primaryImage,
    ...(Array.isArray(body?.reference_images) ? body.reference_images : []),
  ].map(cleanString).filter(Boolean).slice(0, 9);
  const selectedSize = resolveGenerationSize({ resolution: '1K', ratio: body?.ratio });
  const canonical = JSON.stringify({
    ownerEmail,
    prompt,
    visualInputs,
    resolution: selectedSize.resolution,
    ratio: selectedSize.ratio,
    size: selectedSize.size,
  });
  const fingerprint = crypto.createHash('sha256').update(canonical).digest('hex');
  return {
    ownerEmail,
    prompt,
    visualInputs,
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
} = {}) {
  if (!store || typeof store.getOrCreate !== 'function' || typeof store.claim !== 'function') {
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

  async function regenerate({ ownerEmail, body } = {}) {
    const request = normalizeRequest(ownerEmail, body);
    let job = store.getOrCreate({
      requestId: request.requestId,
      ownerEmail: request.ownerEmail,
      requestFingerprint: request.requestFingerprint,
      requestSnapshot: {
        prompt: request.prompt,
        inputCount: request.visualInputs.length,
        ratio: request.selectedSize.ratio,
        size: request.selectedSize.size,
      },
    });
    if (job.status === 'completed' && job.stableUrl) {
      return { taskId: job.requestId, url: job.stableUrl, replay: true };
    }
    if (job.status === 'failed') throw storedError(job);
    const claimed = store.claim(job.requestId);
    if (!claimed) {
      throw Object.assign(new Error('Canvas generation is already in progress'), {
        status: 503,
        code: 'CANVAS_REQUEST_IN_PROGRESS',
        retryable: true,
        taskId: job.requestId,
      });
    }
    job = claimed;

    try {
      return await imageGenerationPool.run(async () => {
        if (!job.providerJobId) {
          const resolvedInputs = [];
          for (const input of request.visualInputs) {
            try {
              resolvedInputs.push(await imageInputReader.read(input));
            } catch (error) {
              if (input === request.visualInputs[0]) throw error;
            }
          }
          if (resolvedInputs.length === 0) throw invalidRequest('读取原图失败');
          const referenceNote = resolvedInputs.length > 1
            ? ` Image 0 is the authoritative product view. Images 1 through ${resolvedInputs.length - 1} are indexed visual references; borrow only compatible composition or style cues from them without changing the product identity.`
            : '';
          const submitted = await providerAdapter.submitEdit({
            idempotencyKey: request.idempotencyKey,
            prompt: `Create a polished ecommerce product visual. Preserve the supplied product identity and structure.${referenceNote} ${request.prompt}`,
            modelRoute: {
              model: providerModel,
              size: request.selectedSize.size,
              async: true,
              mode: 'edit',
            },
            inputAssets: resolvedInputs.map((image, index) => ({
              ...image,
              fileName: `canvas-reference-${index + 1}.${imageExtension(image.contentType)}`,
            })),
          });
          job = store.markSubmitted(job.requestId, {
            providerJobId: submitted.jobId,
            leaseToken: job.leaseToken,
          });
        }
        if (!job.outputUrl) {
          const completed = await providerAdapter.pollUntilReady(job.providerJobId);
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
        const asset = await generatedAssetStore.persist({
          sourceUrl: job.outputUrl,
          taskId: job.requestId,
          label: 'canvas_regenerated',
        });
        job = store.complete(job.requestId, {
          stableUrl: asset.url,
          leaseToken: job.leaseToken,
        });
        return { taskId: job.requestId, url: job.stableUrl, replay: false };
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
      try {
        store.recordError(job.requestId, {
          error: serializedError(enriched),
          retryable: enriched.retryable === true,
          leaseToken: job.leaseToken,
        });
      } catch (storeError) {
        if (storeError?.code === 'CANVAS_LEASE_LOST') throw storeError;
      }
      throw enriched;
    }
  }

  return { regenerate };
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
      resumeable: retryable,
      ...(cleanString(error?.taskId) ? { taskId: cleanString(error.taskId) } : {}),
      ...(cleanString(error?.jobId) ? { providerJobId: cleanString(error.jobId) } : {}),
      ...(retryAfter !== null ? { retryAfter } : {}),
    },
  };
}

export function createCanvasRegenerateHandler({ service } = {}) {
  if (!service || typeof service.regenerate !== 'function') {
    throw new TypeError('Canvas generation service is required');
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
      const result = await service.regenerate({
        ownerEmail,
        body: req?.body || {},
      });
      return res.json({
        url: result.url,
        ...(result.taskId ? { taskId: result.taskId } : {}),
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
