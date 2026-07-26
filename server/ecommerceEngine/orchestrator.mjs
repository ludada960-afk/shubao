import { createHash, randomUUID } from 'node:crypto';

import { sanitizeSnapshot } from './jobStore.mjs';

const PARENT_FINAL_STATES = new Set(['completed', 'needs_review', 'failed', 'cancelled']);
const ASSET_FINAL_STATES = new Set(['completed', 'needs_review', 'failed', 'cancelled']);
const SAFE_ID_RE = /^[a-z0-9][a-z0-9_.:-]{0,127}$/i;

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function own(record, key) {
  return isRecord(record) && Object.hasOwn(record, key) ? record[key] : undefined;
}

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function validateId(value, label) {
  const id = cleanString(value);
  if (!SAFE_ID_RE.test(id)) throw new TypeError(`${label} is invalid`);
  return id;
}

function httpError(message, status, code = '') {
  const error = new Error(message);
  error.status = status;
  if (code) error.code = code;
  return error;
}

function requireFunction(value, label) {
  if (typeof value !== 'function') throw new TypeError(`${label} must be a function`);
  return value;
}

function stableAssetId(url) {
  const match = /^\/api\/generated-assets\/([a-f0-9]{64}\.(?:jpg|png|webp))$/i.exec(cleanString(url));
  if (!match) throw new Error('stable generated asset URL is invalid');
  return match[1];
}

function idempotencyKey(jobId, assetId, attempt) {
  const digest = createHash('sha256')
    .update(`${jobId}\u0000${assetId}\u0000${attempt}`)
    .digest('hex');
  return `ecommerce:${digest}`;
}

function errorMessage(error) {
  return error instanceof Error && error.message ? error.message : 'unknown ecommerce orchestration error';
}

function resultImages(assets) {
  return Object.fromEntries(assets
    .filter(asset => asset.state === 'completed' && asset.stableUrl)
    .map(asset => [asset.assetId, asset.stableUrl]));
}

function assetSource(value) {
  if (typeof value === 'string') return cleanString(value);
  return cleanString(
    own(value, 'url')
    ?? own(value, 'sourceUrl')
    ?? own(value, 'source_url'),
  );
}

function normalizeAssetGroup(values, prefix) {
  const source = Array.isArray(values) ? values : [];
  return source.flatMap((value, index) => {
    const url = assetSource(value);
    if (!url) return [];
    const candidateId = cleanString(
      own(value, 'assetId')
      ?? own(value, 'asset_id')
      ?? own(value, 'id'),
    );
    const assetId = SAFE_ID_RE.test(candidateId) ? candidateId : `${prefix}-${index + 1}`;
    return [{ assetId, url }];
  });
}

function assetsFromPayload(payload) {
  const explicit = isRecord(own(payload, 'assets')) ? own(payload, 'assets') : {};
  const product = normalizeAssetGroup(
    own(explicit, 'product') ?? own(explicit, 'products') ?? own(payload, 'real_shots'),
    'product',
  );
  const reference = normalizeAssetGroup(
    own(explicit, 'reference') ?? own(explicit, 'references') ?? own(payload, 'reference_images'),
    'reference',
  );
  const proof = normalizeAssetGroup(
    own(explicit, 'proof') ?? own(explicit, 'proofs') ?? own(payload, 'uploaded_proofs'),
    'proof',
  );
  const protection = normalizeAssetGroup(own(explicit, 'protection'), 'protection');
  return { product, reference, proof, protection };
}

function summarizeAssets(assets) {
  const summary = {
    total: assets.length,
    completed: 0,
    needsReview: 0,
    failed: 0,
    active: 0,
  };
  for (const asset of assets) {
    if (asset.state === 'completed') summary.completed += 1;
    else if (asset.state === 'needs_review') summary.needsReview += 1;
    else if (asset.state === 'failed' || asset.state === 'cancelled') summary.failed += 1;
    else summary.active += 1;
  }
  return summary;
}

function directionFromPayload(payload) {
  const direction = own(payload, 'direction');
  if (isRecord(direction)) return direction;
  return {
    id: 'smart',
    title: '智能电商方案',
    brief: cleanString(own(payload, 'selling_points')),
  };
}

function campaignOverrides(payload, direction, assets) {
  return {
    editableBrief: own(direction, 'editableBrief')
      ?? own(direction, 'execution_guide')
      ?? own(direction, 'description')
      ?? own(direction, 'brief')
      ?? '',
    customColors: Array.isArray(own(payload, 'custom_colors')) ? own(payload, 'custom_colors') : [],
    referenceAssetIds: Array.isArray(own(payload, 'reference_asset_ids'))
      ? own(payload, 'reference_asset_ids')
      : assets.reference.map(asset => asset.assetId),
  };
}

function terminalParentState(assets) {
  if (assets.some(asset => !ASSET_FINAL_STATES.has(asset.state))) return null;
  if (assets.length > 0 && assets.every(asset => asset.state === 'completed')) return 'completed';
  if (assets.some(asset => asset.state === 'completed' || asset.state === 'needs_review')) return 'needs_review';
  return 'failed';
}

function normalizedProviderResult(result, providerJobId) {
  if (!isRecord(result)) throw new Error('provider poll returned an invalid result');
  const status = cleanString(own(result, 'status')).toLowerCase();
  if (status === 'failed') {
    throw Object.assign(new Error(cleanString(own(result, 'error')) || 'provider generation failed'), {
      code: 'PROVIDER_GENERATION_FAILED',
      retryable: false,
    });
  }
  const outputUrl = cleanString(own(result, 'outputUrl'));
  if (status !== 'completed' || !outputUrl) {
    throw Object.assign(new Error('provider job did not complete with an output URL'), {
      code: 'PROVIDER_OUTPUT_MISSING',
      retryable: true,
      jobId: providerJobId,
    });
  }
  return { outputUrl };
}

function validateAssetPlan(assetPlan) {
  if (!Array.isArray(assetPlan) || assetPlan.length === 0) {
    throw new Error('asset plan is empty');
  }
  const ids = new Set();
  for (const item of assetPlan) {
    const id = validateId(own(item, 'id'), 'asset plan item id');
    if (ids.has(id)) throw new Error(`duplicate asset plan item id: ${id}`);
    ids.add(id);
  }
  return assetPlan;
}

function orchestrationSnapshotFromProgress(progress) {
  const snapshot = own(progress, 'orchestrationSnapshot');
  if (!isRecord(snapshot)
    || !isRecord(own(snapshot, 'productTruth'))
    || !isRecord(own(snapshot, 'campaignBible'))
    || !Array.isArray(own(snapshot, 'assetPlan'))
    || !isRecord(own(snapshot, 'deterministicInputs'))) {
    return null;
  }
  validateAssetPlan(snapshot.assetPlan);
  return snapshot;
}

export function createEcommerceOrchestrator(deps = {}) {
  const jobs = own(deps, 'jobs');
  if (!jobs || typeof jobs.create !== 'function' || typeof jobs.get !== 'function'
    || typeof jobs.transition !== 'function' || typeof jobs.checkpoint !== 'function'
    || typeof jobs.claim !== 'function' || typeof jobs.renewLease !== 'function'
    || typeof jobs.releaseLease !== 'function' || !jobs.assets) {
    throw new TypeError('durable generation jobs with an asset store are required');
  }
  const store = jobs.assets;
  const analyzeProductTruth = requireFunction(own(deps, 'analyzeProductTruth'), 'analyzeProductTruth');
  const compileCampaignBible = requireFunction(own(deps, 'compileCampaignBible'), 'compileCampaignBible');
  const buildAssetPlan = requireFunction(own(deps, 'buildAssetPlan'), 'buildAssetPlan');
  const compileAssetRequest = requireFunction(own(deps, 'compileAssetRequest'), 'compileAssetRequest');
  const providerAdapter = own(deps, 'providerAdapter');
  if (!providerAdapter || typeof providerAdapter.submitEdit !== 'function'
    || typeof providerAdapter.pollUntilReady !== 'function') {
    throw new TypeError('providerAdapter submitEdit and pollUntilReady are required');
  }
  const generatedAssetStore = own(deps, 'generatedAssetStore');
  if (!generatedAssetStore || typeof generatedAssetStore.persist !== 'function'
    || typeof generatedAssetStore.read !== 'function') {
    throw new TypeError('generatedAssetStore persist and read are required');
  }
  const evaluateAsset = requireFunction(own(deps, 'evaluateAsset'), 'evaluateAsset');
  const planRepair = requireFunction(own(deps, 'planRepair'), 'planRepair');
  const canRetry = requireFunction(own(deps, 'canRetry'), 'canRetry');
  const billing = own(deps, 'billing');
  if (!billing || typeof billing.hold !== 'function'
    || typeof billing.settle !== 'function'
    || typeof billing.release !== 'function'
    || typeof billing.releaseRemainder !== 'function') {
    throw new TypeError('billing hold, settle, release, and releaseRemainder are required');
  }
  const prepareProviderRequest = typeof own(deps, 'prepareProviderRequest') === 'function'
    ? own(deps, 'prepareProviderRequest')
    : async request => request;
  const compileRepairRequest = typeof own(deps, 'compileRepairRequest') === 'function'
    ? own(deps, 'compileRepairRequest')
    : ({ request, repairAction, attempt }) => ({
      ...request,
      prompt: `${request.prompt}\n\nTARGETED SYSTEM REPAIR ${attempt}: ${repairAction.type}; issues: ${(repairAction.focusIssueCodes || []).join(', ')}`,
    });
  const repairAsset = typeof own(deps, 'repairAsset') === 'function' ? own(deps, 'repairAsset') : null;
  const qualityAdapters = isRecord(own(deps, 'qualityAdapters')) ? own(deps, 'qualityAdapters') : {};
  const assetLeaseMs = Number.isSafeInteger(own(deps, 'assetLeaseMs')) && own(deps, 'assetLeaseMs') > 0
    ? own(deps, 'assetLeaseMs')
    : 30_000;
  const leaseHeartbeatMs = Number.isSafeInteger(own(deps, 'leaseHeartbeatMs'))
    && own(deps, 'leaseHeartbeatMs') > 0
    && own(deps, 'leaseHeartbeatMs') < assetLeaseMs
    ? own(deps, 'leaseHeartbeatMs')
    : Math.max(10, Math.floor(assetLeaseMs / 3));
  const parentLeaseMs = Number.isSafeInteger(own(deps, 'parentLeaseMs')) && own(deps, 'parentLeaseMs') > 0
    ? own(deps, 'parentLeaseMs')
    : 30_000;
  const parentLeaseHeartbeatMs = Number.isSafeInteger(own(deps, 'parentLeaseHeartbeatMs'))
    && own(deps, 'parentLeaseHeartbeatMs') > 0
    && own(deps, 'parentLeaseHeartbeatMs') < parentLeaseMs
    ? own(deps, 'parentLeaseHeartbeatMs')
    : Math.max(10, Math.floor(parentLeaseMs / 3));

  function getJob(idInput, { ownerEmail } = {}) {
    const id = validateId(idInput, 'job id');
    const job = jobs.get(id);
    if (!job) throw httpError('任务不存在', 404, 'ECOMMERCE_JOB_NOT_FOUND');
    const normalizedOwner = cleanString(ownerEmail).toLowerCase();
    if (normalizedOwner && job.ownerEmail.toLowerCase() !== normalizedOwner) {
      throw httpError('无权查看该任务', 403, 'ECOMMERCE_JOB_FORBIDDEN');
    }
    const assets = store.listAssets(id);
    return {
      ...job,
      assets,
      progress: {
        ...job.progress,
        ...summarizeAssets(assets),
      },
    };
  }

  function createJob(input = {}) {
    const ownerEmail = cleanString(own(input, 'ownerEmail')).toLowerCase();
    if (!ownerEmail || !ownerEmail.includes('@')) throw httpError('登录信息无效', 401, 'AUTH_REQUIRED');
    const rawPayload = own(input, 'payload');
    const payload = sanitizeSnapshot(rawPayload);
    if (!cleanString(own(payload, 'product_name'))) {
      throw httpError('缺少商品名称', 400, 'PRODUCT_NAME_REQUIRED');
    }
    const requestedId = cleanString(own(input, 'id'));
    const id = requestedId ? validateId(requestedId, 'job id') : `ec_${randomUUID()}`;
    const job = jobs.create({ id, ownerEmail, payload });
    return getJob(job.id, { ownerEmail });
  }

  async function persistProviderOutput(job, item, outputUrl) {
    if (typeof generatedAssetStore.persistAndRead === 'function') {
      return generatedAssetStore.persistAndRead({
        sourceUrl: outputUrl,
        taskId: job.id,
        label: item.id,
      });
    }
    const asset = await generatedAssetStore.persist({
      sourceUrl: outputUrl,
      taskId: job.id,
      label: item.id,
    });
    const stored = await generatedAssetStore.read(asset.id);
    if (!stored) throw new Error('stable generated asset could not be read');
    return { asset, ...stored };
  }

  async function stableBytes(stableUrl) {
    const stored = await generatedAssetStore.read(stableAssetId(stableUrl));
    if (!stored) throw new Error('stable generated asset could not be read');
    return stored;
  }

  async function settleItem({ holdId, job, item, stableAsset, quality }) {
    return billing.settle({ holdId, job, item, stableAsset, quality });
  }

  async function releaseItem({ holdId, job, item, reason, quality = null }) {
    return billing.release({ holdId, job, item, reason, quality });
  }

  async function releaseHoldRemainder({ holdId, job, reason }) {
    return billing.releaseRemainder({ holdId, job, reason });
  }

  async function runAsset({ job, item, productTruth, campaignBible, holdId }) {
    store.createAsset({
      jobId: job.id,
      assetId: item.id,
      requestSnapshot: { assetPlanItem: item },
    });
    let current = store.getAsset(job.id, item.id);
    if (ASSET_FINAL_STATES.has(current.state)) return current;
    const claimed = store.claimAsset(job.id, item.id, { leaseMs: assetLeaseMs });
    if (!claimed) return store.getAsset(job.id, item.id);
    current = claimed;
    let leaseToken = claimed.leaseToken;
    let leaseHeartbeatError = null;
    const heartbeat = setInterval(() => {
      if (ASSET_FINAL_STATES.has(current.state)) return;
      try {
        store.renewLease(job.id, item.id, leaseToken, { leaseMs: assetLeaseMs });
      } catch (error) {
        leaseHeartbeatError = error instanceof Error ? error : new Error('asset lease heartbeat failed');
        clearInterval(heartbeat);
      }
    }, leaseHeartbeatMs);
    heartbeat.unref?.();
    let compiledRequest = null;
    let stable = null;

    const requestForItem = async () => {
      if (!compiledRequest) {
        compiledRequest = compileAssetRequest({
          assetPlanItem: item,
          productTruth,
          campaignBible,
          assets: own(job.payload, 'assets') ?? {},
        });
      }
      return compiledRequest;
    };

    try {
      while (!ASSET_FINAL_STATES.has(current.state)) {
        if (leaseHeartbeatError) throw leaseHeartbeatError;
        if (current.state === 'queued') {
          const request = await requestForItem();
          const providerRequest = await prepareProviderRequest({
            ...request,
            idempotencyKey: idempotencyKey(job.id, item.id, 0),
          }, { job, item, attempt: 0 });
          const submitted = await providerAdapter.submitEdit(providerRequest);
          current = store.markSubmitted(job.id, item.id, {
            providerJobId: submitted.jobId,
            requestSnapshot: {
              assetPlanItem: item,
              request: {
                prompt: request.prompt,
                modelRoute: request.modelRoute,
                inputAssets: request.inputAssets,
              },
            },
            leaseToken,
          });
          continue;
        }

        if (current.state === 'submitted') {
          current = store.transitionAsset(job.id, item.id, 'polling', { leaseToken });
          continue;
        }

        if (current.state === 'polling') {
          const provider = normalizedProviderResult(
            await providerAdapter.pollUntilReady(current.providerJobId),
            current.providerJobId,
          );
          current = store.transitionAsset(job.id, item.id, 'downloading', {
            outputUrl: provider.outputUrl,
            leaseToken,
          });
          continue;
        }

        if (current.state === 'downloading') {
          stable = await persistProviderOutput(job, item, current.outputUrl);
          current = store.transitionAsset(job.id, item.id, 'quality_check', {
            stableUrl: stable.asset.url,
            leaseToken,
          });
          continue;
        }

        if (current.state === 'quality_check') {
          if (!stable || stable.asset.url !== current.stableUrl) {
            const stored = await stableBytes(current.stableUrl);
            stable = {
              asset: {
                id: stableAssetId(current.stableUrl),
                url: current.stableUrl,
                contentType: stored.contentType,
              },
              ...stored,
            };
          }
          const quality = await evaluateAsset({
            buffer: stable.buffer,
            expectedFormat: stable.contentType?.split('/')[1],
            generationSize: item.generationSize,
            role: item.role,
            productTruth,
            assetPlanItem: item,
            stableUrl: current.stableUrl,
          }, qualityAdapters);
          if (quality.passed) {
            current = store.transitionAsset(job.id, item.id, 'settling', {
              requestSnapshot: {
                ...current.requestSnapshot,
                quality,
                settlement: {
                  stableAsset: stable.asset,
                },
              },
              leaseToken,
            });
            continue;
          }
          const repairAction = planRepair(quality);
          if (!canRetry(current.attemptCount)) {
            const reason = `quality_review:${(repairAction.focusIssueCodes || []).join(',') || repairAction.type}`;
            current = store.transitionAsset(job.id, item.id, 'releasing', {
              requestSnapshot: {
                ...current.requestSnapshot,
                quality,
                repairAction,
                release: {
                  targetState: 'needs_review',
                  reason,
                  error: `quality gate failed: ${repairAction.type}`,
                },
              },
              error: `quality gate failed: ${repairAction.type}`,
              leaseToken,
            });
            continue;
          }
          current = store.transitionAsset(job.id, item.id, 'repairing', {
            requestSnapshot: {
              ...current.requestSnapshot,
              quality,
              repairAction,
            },
            error: `quality repair required: ${repairAction.type}`,
            leaseToken,
          });
          continue;
        }

        if (current.state === 'releasing') {
          const release = own(current.requestSnapshot, 'release');
          const targetState = cleanString(own(release, 'targetState'));
          if (!['failed', 'needs_review', 'cancelled'].includes(targetState)) {
            throw new Error('release target state is invalid');
          }
          const reason = cleanString(own(release, 'reason')) || `asset_release:${targetState}`;
          const quality = own(current.requestSnapshot, 'quality') ?? null;
          try {
            await releaseItem({ holdId, job, item, reason, quality });
            current = store.transitionAsset(job.id, item.id, targetState, {
              error: cleanString(own(release, 'error')) || current.error,
              leaseToken,
            });
          } catch (error) {
            if (error && typeof error === 'object') error.retryable = true;
            throw error;
          }
          continue;
        }

        if (current.state === 'settling') {
          const quality = own(current.requestSnapshot, 'quality') ?? {};
          const storedAsset = own(own(current.requestSnapshot, 'settlement'), 'stableAsset');
          const stableAsset = isRecord(storedAsset)
            ? storedAsset
            : {
              id: stableAssetId(current.stableUrl),
              url: current.stableUrl,
              contentType: (await stableBytes(current.stableUrl)).contentType,
            };
          try {
            await settleItem({ holdId, job, item, stableAsset, quality });
            current = store.transitionAsset(job.id, item.id, 'completed', { leaseToken });
          } catch (error) {
            if (error && typeof error === 'object') error.retryable = true;
            throw error;
          }
          continue;
        }

        if (current.state === 'repairing') {
          const repairAction = own(current.requestSnapshot, 'repairAction') ?? { type: 'manual_review' };
          const nextAttempt = current.attemptCount + 1;
          if (repairAsset && repairAction.type === 'sharp_repair') {
            const source = await stableBytes(current.stableUrl);
            const repaired = await repairAsset({
              buffer: source.buffer,
              contentType: source.contentType,
              action: repairAction,
              item,
              job,
              attempt: nextAttempt,
            });
            if (!Buffer.isBuffer(repaired?.buffer) || !cleanString(repaired?.contentType)) {
              throw new Error('deterministic repair returned invalid image bytes');
            }
            const asset = await generatedAssetStore.persistBuffer({
              buffer: repaired.buffer,
              contentType: repaired.contentType,
              taskId: job.id,
              label: item.id,
            });
            stable = { asset, buffer: repaired.buffer, contentType: repaired.contentType };
            current = store.transitionAsset(job.id, item.id, 'quality_check', {
              stableUrl: asset.url,
              attemptCount: nextAttempt,
              leaseToken,
            });
            continue;
          }
          const request = await requestForItem();
          const repairRequest = compileRepairRequest({
            request,
            repairAction,
            attempt: nextAttempt,
            item,
            job,
            productTruth,
            campaignBible,
          });
          const providerRequest = await prepareProviderRequest({
            ...repairRequest,
            idempotencyKey: idempotencyKey(job.id, item.id, nextAttempt),
          }, { job, item, attempt: nextAttempt, repairAction });
          const submitted = await providerAdapter.submitEdit(providerRequest);
          stable = null;
          current = store.markSubmitted(job.id, item.id, {
            providerJobId: submitted.jobId,
            requestSnapshot: {
              ...current.requestSnapshot,
              request: {
                prompt: repairRequest.prompt,
                modelRoute: repairRequest.modelRoute,
                inputAssets: repairRequest.inputAssets,
              },
              repairAction,
            },
            leaseToken,
          });
          continue;
        }

        throw new Error(`unsupported asset state: ${current.state}`);
      }
      return current;
    } catch (error) {
      current = store.getAsset(job.id, item.id);
      if (error?.retryable === true) {
        try { store.releaseLease(job.id, item.id, leaseToken); } catch {}
        throw error;
      }
      if (current?.state === 'settling') {
        if (error && typeof error === 'object') error.retryable = true;
        try { store.releaseLease(job.id, item.id, leaseToken); } catch {}
        throw error;
      }
      if (current && !ASSET_FINAL_STATES.has(current.state)) {
        if (current.state !== 'releasing') {
          current = store.transitionAsset(job.id, item.id, 'releasing', {
            requestSnapshot: {
              ...current.requestSnapshot,
              release: {
                targetState: 'failed',
                reason: `generation_failed:${errorMessage(error)}`,
                error: errorMessage(error),
              },
            },
            error: errorMessage(error),
            leaseToken,
          });
        }
        const release = own(current.requestSnapshot, 'release');
        try {
          await releaseItem({
            holdId,
            job,
            item,
            reason: cleanString(own(release, 'reason')) || `generation_failed:${errorMessage(error)}`,
          });
          current = store.transitionAsset(job.id, item.id, 'failed', {
            error: cleanString(own(release, 'error')) || errorMessage(error),
            leaseToken,
          });
        } catch (releaseError) {
          if (releaseError && typeof releaseError === 'object') releaseError.retryable = true;
          try { store.releaseLease(job.id, item.id, leaseToken); } catch {}
          throw releaseError;
        }
      }
      return current ?? store.getAsset(job.id, item.id);
    } finally {
      clearInterval(heartbeat);
    }
  }

  async function runJob(idInput, { leaseToken: suppliedLeaseToken = '' } = {}) {
    const id = validateId(idInput, 'job id');
    let job = jobs.get(id);
    if (!job) throw httpError('任务不存在', 404, 'ECOMMERCE_JOB_NOT_FOUND');
    if (PARENT_FINAL_STATES.has(job.status)) return getJob(id, { ownerEmail: job.ownerEmail });
    let parentLeaseToken = cleanString(suppliedLeaseToken);
    if (parentLeaseToken) {
      if (job.leaseToken !== parentLeaseToken) {
        throw Object.assign(new Error('parent lease is no longer owned by this worker'), {
          code: 'PARENT_LEASE_LOST',
          retryable: true,
        });
      }
    } else {
      const claimed = jobs.claim(id, { leaseMs: parentLeaseMs });
      if (!claimed) return getJob(id, { ownerEmail: job.ownerEmail });
      job = claimed;
      parentLeaseToken = claimed.leaseToken;
    }

    let parentHeartbeatError = null;
    const parentHeartbeat = setInterval(() => {
      try {
        jobs.renewLease(id, parentLeaseToken, { leaseMs: parentLeaseMs });
      } catch (error) {
        parentHeartbeatError = error instanceof Error ? error : new Error('parent lease heartbeat failed');
        clearInterval(parentHeartbeat);
      }
    }, parentLeaseHeartbeatMs);
    parentHeartbeat.unref?.();
    let parentFinalized = false;
    let setupHoldId = '';
    let setupAssetPlan = [];
    let processingStarted = false;

    try {
      let snapshot = orchestrationSnapshotFromProgress(job.progress);
      if (!snapshot) {
        const inputAssets = assetsFromPayload(job.payload);
        const payload = { ...job.payload, assets: inputAssets };
        const productTruth = await analyzeProductTruth(payload);
        const direction = directionFromPayload(payload);
        const campaignBible = compileCampaignBible(direction, campaignOverrides(payload, direction, inputAssets));
        const assetPlan = validateAssetPlan(buildAssetPlan({
          productTruth,
          campaignBible,
          platform: own(payload, 'platform') || '淘宝',
          sizing: own(payload, 'sizing') || {},
          skus: own(payload, 'skus') || [],
          uploadedProofs: inputAssets.proof,
        }));
        snapshot = sanitizeSnapshot({
          productTruth,
          campaignBible,
          assetPlan,
          deterministicInputs: {
            assets: inputAssets,
            platform: own(payload, 'platform') || '淘宝',
            sizing: own(payload, 'sizing') || {},
            skus: own(payload, 'skus') || [],
          },
        });
        validateAssetPlan(snapshot.assetPlan);
        job = jobs.checkpoint(id, {
          progress: {
            ...job.progress,
            orchestrationSnapshot: snapshot,
          },
          leaseToken: parentLeaseToken,
        });
      }

      const productTruth = snapshot.productTruth;
      const campaignBible = snapshot.campaignBible;
      const assetPlan = validateAssetPlan(snapshot.assetPlan);
      setupAssetPlan = assetPlan;
      const deterministicInputs = snapshot.deterministicInputs;
      const payload = {
        ...job.payload,
        assets: deterministicInputs.assets,
      };
      let holdId = cleanString(own(snapshot, 'holdId')) || cleanString(own(job.progress, 'holdId'));
      if (!holdId) {
        const hold = await billing.hold({ job, assetPlan, productTruth, campaignBible });
        holdId = validateId(own(hold, 'id'), 'billing hold id');
        snapshot = sanitizeSnapshot({ ...snapshot, holdId });
        job = jobs.checkpoint(id, {
          progress: {
            ...job.progress,
            orchestrationSnapshot: snapshot,
            holdId,
          },
          leaseToken: parentLeaseToken,
        });
      } else {
        holdId = validateId(holdId, 'billing hold id');
        if (cleanString(own(snapshot, 'holdId')) !== holdId) {
          snapshot = sanitizeSnapshot({ ...snapshot, holdId });
          job = jobs.checkpoint(id, {
            progress: {
              ...job.progress,
              orchestrationSnapshot: snapshot,
              holdId,
            },
            leaseToken: parentLeaseToken,
          });
        }
      }
      setupHoldId = holdId;

      const pendingSetupRelease = own(job.progress, 'setupRelease');
      if (isRecord(pendingSetupRelease)) {
        const reason = cleanString(own(pendingSetupRelease, 'reason')) || 'parent_setup_failed';
        try {
          await releaseHoldRemainder({ holdId, job, reason });
        } catch (releaseError) {
          if (releaseError && typeof releaseError === 'object') releaseError.retryable = true;
          throw releaseError;
        }
        throw Object.assign(
          new Error(cleanString(own(pendingSetupRelease, 'error')) || 'parent setup failed'),
          { setupReleaseCompleted: true },
        );
      }

      for (const item of assetPlan) {
        store.createAsset({
          jobId: id,
          assetId: item.id,
          requestSnapshot: { assetPlanItem: item },
        });
      }
      job = jobs.get(id);
      if (job.status === 'analyzing') {
        job = jobs.transition(id, 'generating', {
          progress: { ...job.progress, holdId, current: 0, total: assetPlan.length },
          leaseToken: parentLeaseToken,
        });
      }
      processingStarted = true;

      for (const item of assetPlan) {
        if (parentHeartbeatError) throw parentHeartbeatError;
        const persistedAsset = store.getAsset(id, item.id);
        const persistedItem = own(persistedAsset?.requestSnapshot, 'assetPlanItem');
        await runAsset({
          job: { ...job, payload },
          item: isRecord(persistedItem) ? persistedItem : item,
          productTruth,
          campaignBible,
          holdId,
        });
      }

      const assets = store.listAssets(id);
      const status = terminalParentState(assets);
      const output = {
        product_name: own(job.payload, 'product_name'),
        category: own(job.payload, 'category') || '',
        platform: own(job.payload, 'platform') || '淘宝',
        images: resultImages(assets),
        errors: assets
          .filter(asset => asset.state === 'failed' || asset.state === 'needs_review')
          .map(asset => ({ style: asset.assetId, error: asset.error, state: asset.state })),
      };
      const summary = summarizeAssets(assets);
      job = jobs.get(id);
      if (status && !PARENT_FINAL_STATES.has(job.status)) {
        jobs.transition(id, status, {
          output,
          error: status === 'failed' ? '未生成可交付图片' : '',
          progress: { ...job.progress, holdId, current: summary.completed, total: summary.total, ...summary },
          leaseToken: parentLeaseToken,
        });
        parentFinalized = true;
      }
      return getJob(id, { ownerEmail: job.ownerEmail });
    } catch (error) {
      if (error?.retryable === true) throw error;
      job = jobs.get(id);
      if (!job) throw error;
      if (!processingStarted
        && setupHoldId
        && setupAssetPlan.length > 0
        && error?.setupReleaseCompleted !== true
        && error?.code !== 'PARENT_LEASE_LOST') {
        const reason = `parent_setup_failed:${errorMessage(error)}`;
        job = jobs.checkpoint(id, {
          progress: {
            ...job.progress,
            setupRelease: {
              reason,
              error: errorMessage(error),
            },
          },
          leaseToken: parentLeaseToken,
        });
        try {
          await releaseHoldRemainder({
            holdId: setupHoldId,
            job,
            reason,
          });
        } catch (releaseError) {
          if (releaseError && typeof releaseError === 'object') releaseError.retryable = true;
          throw releaseError;
        }
      }
      if (!PARENT_FINAL_STATES.has(job.status)) {
        const assets = store.listAssets(id);
        const detail = { error: errorMessage(error) };
        if (cleanString(error?.code)) detail.code = cleanString(error.code);
        if (error?.resumeable === true) detail.resumeable = true;
        if (Number.isSafeInteger(error?.required) && error.required >= 0) detail.required = error.required;
        if (Number.isSafeInteger(error?.available) && error.available >= 0) detail.available = error.available;
        const summary = summarizeAssets(assets);
        jobs.transition(id, 'failed', {
          output: {
            product_name: own(job.payload, 'product_name'),
            category: own(job.payload, 'category') || '',
            platform: own(job.payload, 'platform') || '淘宝',
            images: resultImages(assets),
            errors: [detail],
          },
          error: detail.error,
          progress: { ...job.progress, current: summary.completed, total: summary.total, ...summary },
          leaseToken: parentLeaseToken,
        });
        parentFinalized = true;
      }
      return getJob(id, { ownerEmail: job.ownerEmail });
    } finally {
      clearInterval(parentHeartbeat);
      if (!parentFinalized) {
        try { jobs.releaseLease(id, parentLeaseToken); } catch {}
      }
    }
  }

  async function resumeJobs() {
    const claims = [];
    const claimedIds = new Set();
    for (const id of new Set(store.recoverInterrupted().map(asset => asset.jobId))) {
      const claimed = jobs.claim(id, { leaseMs: parentLeaseMs });
      if (claimed) {
        claims.push(claimed);
        claimedIds.add(claimed.id);
      }
    }
    if (typeof jobs.claimNext === 'function') {
      for (let count = 0; count < 1_000; count += 1) {
        const claimed = jobs.claimNext({ leaseMs: parentLeaseMs });
        if (!claimed) break;
        if (!claimedIds.has(claimed.id)) {
          claims.push(claimed);
          claimedIds.add(claimed.id);
        }
      }
    }
    return Promise.allSettled(claims.map(claimed => runJob(claimed.id, {
      leaseToken: claimed.leaseToken,
    })));
  }

  return {
    createJob,
    getJob,
    resumeJobs,
    runJob,
  };
}

function responseError(res, error) {
  const status = Number.isInteger(error?.status) && error.status >= 400 && error.status <= 599
    ? error.status
    : 500;
  const body = { error: status === 500 ? '服务器内部错误，请稍后重试' : errorMessage(error) };
  if (cleanString(error?.code)) body.code = cleanString(error.code);
  if (error?.resumeable === true) body.resumeable = true;
  if (Number.isSafeInteger(error?.required) && error.required >= 0) body.required = error.required;
  if (Number.isSafeInteger(error?.available) && error.available >= 0) body.available = error.available;
  return res.status(status).json(body);
}

export function createEcommerceRouteHandlers({
  orchestrator,
  onBackgroundError = error => console.error('[ecommerce] background job failed:', errorMessage(error)),
} = {}) {
  if (!orchestrator || typeof orchestrator.createJob !== 'function'
    || typeof orchestrator.getJob !== 'function') {
    throw new TypeError('orchestrator createJob and getJob are required');
  }
  return {
    async generate(req, res) {
      try {
        const job = orchestrator.createJob({
          ownerEmail: req?._userEmail,
          payload: req?.body ?? {},
        });
        Promise.resolve()
          .then(() => orchestrator.runJob(job.id))
          .catch(onBackgroundError);
        return res.status(202).json({ taskId: job.id, status: 'queued' });
      } catch (error) {
        return responseError(res, error);
      }
    },
    getJob(req, res) {
      try {
        return res.json({
          ok: true,
          task: orchestrator.getJob(req?.params?.id, { ownerEmail: req?._userEmail }),
        });
      } catch (error) {
        return responseError(res, error);
      }
    },
  };
}

export function createEcommerceStartupRecovery({
  orchestrator,
  maxAttempts = 3,
  retryDelayMs = 250,
  onAttemptError = () => {},
} = {}) {
  if (!orchestrator || typeof orchestrator.resumeJobs !== 'function') {
    throw new TypeError('orchestrator resumeJobs is required');
  }
  if (!Number.isSafeInteger(maxAttempts) || maxAttempts <= 0) {
    throw new TypeError('maxAttempts must be a positive safe integer');
  }
  if (!Number.isSafeInteger(retryDelayMs) || retryDelayMs < 0) {
    throw new TypeError('retryDelayMs must be a non-negative safe integer');
  }
  if (typeof onAttemptError !== 'function') {
    throw new TypeError('onAttemptError must be a function');
  }
  let recoveryPromise = null;
  return function recoverEcommerceStartup() {
    if (recoveryPromise) return recoveryPromise;
    recoveryPromise = (async () => {
      let lastError;
      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        try {
          return await orchestrator.resumeJobs();
        } catch (error) {
          lastError = error;
          onAttemptError(error, attempt);
          if (attempt < maxAttempts && retryDelayMs > 0) {
            await new Promise(resolve => setTimeout(resolve, retryDelayMs));
          }
        }
      }
      throw lastError;
    })();
    return recoveryPromise;
  };
}
