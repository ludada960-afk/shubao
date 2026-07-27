export const ECOMMERCE_TASK_REFERENCE_VERSION = 1;
export const ECOMMERCE_TASK_REFERENCE_TTL_MS = 24 * 60 * 60 * 1000;
export const ECOMMERCE_DRAFT_REFERENCE_VERSION = 1;
export const ECOMMERCE_DRAFT_REFERENCE_TTL_MS = 24 * 60 * 60 * 1000;
export const ECOMMERCE_DIRECTION_REFRESH_ACTION_VERSION = 1;
export const ECOMMERCE_DIRECTION_REFRESH_ACTION_TTL_MS = 24 * 60 * 60 * 1000;
export const ECOMMERCE_DRAFT_SURFACES = Object.freeze({
  HOME_WIZARD: 'home-wizard',
  EC_STUDIO: 'ec-studio',
  EC_AUTO: 'ec-auto',
  EC_LEGACY: 'ec-legacy',
  XHS_ECOMMERCE: 'xhs-ecommerce',
});

const USER_STATES = {
  queued: '等待生成',
  draft: '等待生成',
  submitted: '正在生成',
  polling: '正在生成',
  downloading: '正在生成',
  quality_check: '质量检查',
  repairing: '正在修复',
  completed: '已完成',
  needs_review: '需要确认',
  failed: '失败',
  cancelled: '失败',
};

const PENDING_STATE_TOKENS = new Set([
  'active',
  'waiting',
  'pending',
  'processing',
  'running',
  'generating',
  'queued',
  'draft',
  'submitted',
  'polling',
  'downloading',
]);

const FINAL_ERROR_STATE_TOKENS = new Set([
  'failed',
  'cancelled',
  'error',
  'rejected',
  'final',
  'completed',
  'complete',
  'finished',
  'done',
  'success',
]);

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizedOwner(ownerEmail) {
  return cleanText(ownerEmail).toLowerCase();
}

function normalizedSurface(surface) {
  return cleanText(surface).toLowerCase();
}

let generationEpochSequence = 0;

export function createEcommerceGenerationToken({ ownerEmail, draftId } = {}) {
  const owner = normalizedOwner(ownerEmail);
  const draft = cleanText(draftId);
  if (!owner || !draft) return null;
  generationEpochSequence += 1;
  return Object.freeze({
    epoch: generationEpochSequence,
    ownerEmail: owner,
    draftId: draft,
  });
}

export function isEcommerceGenerationTokenCurrent(token, {
  currentToken,
  ownerEmail,
  draftId,
} = {}) {
  const owner = normalizedOwner(ownerEmail);
  const draft = cleanText(draftId);
  return Boolean(
    token
    && currentToken === token
    && token.epoch
    && token.ownerEmail === owner
    && token.draftId === draft,
  );
}

export function createEcommerceGenerationPreconditionError() {
  const error = new Error('请先登录并创建商品草稿后再生成');
  error.code = 'ECOMMERCE_GENERATION_CONTEXT_REQUIRED';
  error.resumeable = false;
  return error;
}

export function invalidateEcommerceGenerationRequest({ tokenRef, abortRef } = {}) {
  const controller = abortRef?.current;
  tokenRef && (tokenRef.current = null);
  if (typeof controller?.abort === 'function') controller.abort();
  if (abortRef) abortRef.current = null;
  return Boolean(controller);
}

function generationContext({ ownerEmail, draftId } = {}) {
  return {
    ownerEmail: normalizedOwner(ownerEmail),
    draftId: cleanText(draftId),
  };
}

function sameGenerationContext(left, right) {
  return left.ownerEmail === right.ownerEmail && left.draftId === right.draftId;
}

function defaultGenerationAbortController() {
  return typeof AbortController === 'function' ? new AbortController() : null;
}

export function createEcommerceGenerationLifecycleController({
  ownerEmail,
  draftId,
  tokenRef = { current: null },
  abortRef = { current: null },
  createAbortController = defaultGenerationAbortController,
} = {}) {
  let context = generationContext({ ownerEmail, draftId });
  const invalidate = () => invalidateEcommerceGenerationRequest({ tokenRef, abortRef });
  const syncContext = (nextContext = {}) => {
    const next = generationContext(nextContext);
    if (!sameGenerationContext(context, next)) {
      invalidate();
      context = next;
    }
    return { ...context };
  };

  return {
    syncContext,
    begin({ onPreconditionError } = {}) {
      invalidate();
      const token = createEcommerceGenerationToken(context);
      if (!token) {
        const error = createEcommerceGenerationPreconditionError();
        onPreconditionError?.(error);
        return null;
      }
      const controller = createAbortController?.() || null;
      tokenRef.current = token;
      abortRef.current = controller;
      return { token, controller, signal: controller?.signal };
    },
    isCurrent(token) {
      return isEcommerceGenerationTokenCurrent(token, {
        currentToken: tokenRef.current,
        ownerEmail: context.ownerEmail,
        draftId: context.draftId,
      });
    },
    release(token) {
      if (!this.isCurrent(token)) return false;
      tokenRef.current = null;
      abortRef.current = null;
      return true;
    },
    invalidate,
    rotate(nextContext = {}) {
      invalidate();
      context = generationContext(nextContext);
      return { ...context };
    },
    unmount: invalidate,
  };
}

export function startEcommerceGenerationLifecycle({ lifecycle, quoteReady = true, onError } = {}) {
  const generation = lifecycle?.begin({ onPreconditionError: onError });
  if (!generation) return null;
  if (quoteReady) return generation;
  lifecycle.release(generation.token);
  const error = new Error('报价尚未准备完成，请稍后重试');
  error.code = 'ECOMMERCE_GENERATION_QUOTE_REQUIRED';
  onError?.(error);
  return null;
}

export function resolveEcommerceSupplementUpload({
  product,
  reference,
  generationToken,
  isGenerationCurrent,
} = {}) {
  if (generationToken && typeof isGenerationCurrent === 'function' && !isGenerationCurrent(generationToken)) {
    return null;
  }
  return {
    product: Array.isArray(product) ? product : [],
    reference: Array.isArray(reference) ? reference : [],
  };
}

function storageFor(storage) {
  return storage || globalThis.localStorage;
}

function stateTokens(state) {
  return cleanText(state).toLowerCase().split(/[_-]+/).filter(Boolean);
}

function isPendingState(state) {
  return stateTokens(state).some(token => PENDING_STATE_TOKENS.has(token));
}

function isErrorState(state) {
  if (isPendingState(state)) return false;
  return stateTokens(state).some(token => FINAL_ERROR_STATE_TOKENS.has(token));
}

export function normalizeEcommerceAsset(asset = {}) {
  const state = cleanText(asset.status || asset.state).toLowerCase() || 'queued';
  const error = cleanText(asset.error || asset.message);
  const userState = USER_STATES[state] || (error || isErrorState(state) ? '失败' : '正在生成');
  const plan = asset.plan && typeof asset.plan === 'object' ? asset.plan : {};

  return {
    id: cleanText(asset.id || asset.assetId || asset.key),
    role: cleanText(plan.role || plan.purpose || asset.role || asset.purpose || asset.type),
    label: cleanText(plan.label || plan.title || asset.label || asset.title || plan.role || plan.purpose || asset.role || asset.purpose || asset.type),
    state,
    userState,
    stableUrl: cleanText(asset.stableUrl || asset.stable_url),
    error,
  };
}

export function normalizeEcommerceAssets(assets) {
  return (Array.isArray(assets) ? assets : []).map(normalizeEcommerceAsset);
}

export function taskKey({ ownerEmail, draftId } = {}) {
  const owner = normalizedOwner(ownerEmail);
  const draft = cleanText(draftId);
  if (!owner || !draft) return '';
  return `sb-ecommerce-task:v${ECOMMERCE_TASK_REFERENCE_VERSION}:${encodeURIComponent(owner)}:${encodeURIComponent(draft)}`;
}

export function saveEcommerceTaskReference({ ownerEmail, draftId, taskId, createdAt = Date.now(), storage } = {}) {
  const owner = normalizedOwner(ownerEmail);
  const draft = cleanText(draftId);
  const task = cleanText(taskId);
  const key = taskKey({ ownerEmail: owner, draftId: draft });
  if (!key || !task || !Number.isFinite(createdAt)) return false;
  try {
    storageFor(storage)?.setItem(key, JSON.stringify({
      version: ECOMMERCE_TASK_REFERENCE_VERSION,
      ownerEmail: owner,
      draftId: draft,
      taskId: task,
      createdAt,
    }));
    return true;
  } catch {
    return false;
  }
}

export function loadEcommerceTaskReference({ ownerEmail, draftId, now = Date.now(), storage } = {}) {
  const owner = normalizedOwner(ownerEmail);
  const draft = cleanText(draftId);
  const key = taskKey({ ownerEmail: owner, draftId: draft });
  if (!key || !Number.isFinite(now)) return null;
  try {
    const stored = storageFor(storage)?.getItem(key);
    const record = stored ? JSON.parse(stored) : null;
    const valid = record
      && record.version === ECOMMERCE_TASK_REFERENCE_VERSION
      && record.ownerEmail === owner
      && record.draftId === draft
      && cleanText(record.taskId)
      && Number.isFinite(record.createdAt)
      && record.createdAt <= now
      && now - record.createdAt <= ECOMMERCE_TASK_REFERENCE_TTL_MS;
    if (!valid) {
      if (stored) storageFor(storage)?.removeItem(key);
      return null;
    }
    return { taskId: record.taskId, createdAt: record.createdAt };
  } catch {
    return null;
  }
}

export function clearEcommerceTaskReference({ ownerEmail, draftId, taskId, storage } = {}) {
  const owner = normalizedOwner(ownerEmail);
  const draft = cleanText(draftId);
  const key = taskKey({ ownerEmail: owner, draftId: draft });
  const expectedTaskId = cleanText(taskId);
  if (!key || !expectedTaskId) return false;
  try {
    const record = JSON.parse(storageFor(storage)?.getItem(key) || 'null');
    if (
      record?.version !== ECOMMERCE_TASK_REFERENCE_VERSION
      || record?.ownerEmail !== owner
      || record?.draftId !== draft
      || record?.taskId !== expectedTaskId
    ) return false;
    storageFor(storage)?.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

export function directionRefreshActionKey({ ownerEmail, draftId } = {}) {
  const owner = normalizedOwner(ownerEmail);
  const draft = cleanText(draftId);
  if (!owner || !draft) return '';
  return `sb-ecommerce-direction-refresh:v${ECOMMERCE_DIRECTION_REFRESH_ACTION_VERSION}:${encodeURIComponent(owner)}:${encodeURIComponent(draft)}`;
}

export function saveEcommerceDirectionRefreshAction({
  ownerEmail,
  draftId,
  actionId,
  createdAt = Date.now(),
  storage,
} = {}) {
  const owner = normalizedOwner(ownerEmail);
  const draft = cleanText(draftId);
  const action = cleanText(actionId);
  const key = directionRefreshActionKey({ ownerEmail: owner, draftId: draft });
  if (!key || !action || !Number.isFinite(createdAt)) return false;
  try {
    storageFor(storage)?.setItem(key, JSON.stringify({
      version: ECOMMERCE_DIRECTION_REFRESH_ACTION_VERSION,
      ownerEmail: owner,
      draftId: draft,
      actionId: action,
      createdAt,
    }));
    return true;
  } catch {
    return false;
  }
}

export function loadEcommerceDirectionRefreshAction({ ownerEmail, draftId, now = Date.now(), storage } = {}) {
  const owner = normalizedOwner(ownerEmail);
  const draft = cleanText(draftId);
  const key = directionRefreshActionKey({ ownerEmail: owner, draftId: draft });
  if (!key || !Number.isFinite(now)) return null;
  try {
    const stored = storageFor(storage)?.getItem(key);
    const record = stored ? JSON.parse(stored) : null;
    const valid = record
      && record.version === ECOMMERCE_DIRECTION_REFRESH_ACTION_VERSION
      && record.ownerEmail === owner
      && record.draftId === draft
      && cleanText(record.actionId)
      && Number.isFinite(record.createdAt)
      && record.createdAt <= now
      && now - record.createdAt <= ECOMMERCE_DIRECTION_REFRESH_ACTION_TTL_MS;
    if (!valid) {
      if (stored) storageFor(storage)?.removeItem(key);
      return null;
    }
    return { actionId: record.actionId, createdAt: record.createdAt };
  } catch {
    return null;
  }
}

export function clearEcommerceDirectionRefreshAction({ ownerEmail, draftId, actionId, storage } = {}) {
  const owner = normalizedOwner(ownerEmail);
  const draft = cleanText(draftId);
  const action = cleanText(actionId);
  const key = directionRefreshActionKey({ ownerEmail: owner, draftId: draft });
  if (!key || !action) return false;
  try {
    const record = JSON.parse(storageFor(storage)?.getItem(key) || 'null');
    if (
      record?.version !== ECOMMERCE_DIRECTION_REFRESH_ACTION_VERSION
      || record?.ownerEmail !== owner
      || record?.draftId !== draft
      || record?.actionId !== action
    ) return false;
    storageFor(storage)?.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

export function ecommerceDraftKey({ ownerEmail, surface } = {}) {
  const owner = normalizedOwner(ownerEmail);
  const activeSurface = normalizedSurface(surface);
  if (!owner || !activeSurface) return '';
  return `sb-ecommerce-draft:v${ECOMMERCE_DRAFT_REFERENCE_VERSION}:${encodeURIComponent(owner)}:${encodeURIComponent(activeSurface)}`;
}

export function saveEcommerceDraftReference({
  ownerEmail,
  surface,
  draftId,
  createdAt = Date.now(),
  storage,
} = {}) {
  const owner = normalizedOwner(ownerEmail);
  const activeSurface = normalizedSurface(surface);
  const draft = cleanText(draftId);
  const key = ecommerceDraftKey({ ownerEmail: owner, surface: activeSurface });
  if (!key || !draft || !Number.isFinite(createdAt)) return false;
  try {
    storageFor(storage)?.setItem(key, JSON.stringify({
      version: ECOMMERCE_DRAFT_REFERENCE_VERSION,
      ownerEmail: owner,
      surface: activeSurface,
      draftId: draft,
      createdAt,
    }));
    return true;
  } catch {
    return false;
  }
}

export function loadEcommerceDraftReference({
  ownerEmail,
  surface,
  now = Date.now(),
  storage,
} = {}) {
  const owner = normalizedOwner(ownerEmail);
  const activeSurface = normalizedSurface(surface);
  const key = ecommerceDraftKey({ ownerEmail: owner, surface: activeSurface });
  if (!key || !Number.isFinite(now)) return null;
  try {
    const stored = storageFor(storage)?.getItem(key);
    const record = stored ? JSON.parse(stored) : null;
    const valid = record
      && record.version === ECOMMERCE_DRAFT_REFERENCE_VERSION
      && record.ownerEmail === owner
      && record.surface === activeSurface
      && cleanText(record.draftId)
      && Number.isFinite(record.createdAt)
      && record.createdAt <= now
      && now - record.createdAt <= ECOMMERCE_DRAFT_REFERENCE_TTL_MS;
    if (!valid) {
      if (stored) storageFor(storage)?.removeItem(key);
      return null;
    }
    return { draftId: record.draftId, createdAt: record.createdAt };
  } catch {
    return null;
  }
}

function defaultDraftId() {
  const randomUuid = globalThis.crypto?.randomUUID;
  if (typeof randomUuid === 'function') return `ec-draft-${randomUuid.call(globalThis.crypto)}`;
  return `ec-draft-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function loadOrCreateEcommerceDraft({
  ownerEmail,
  surface,
  now = Date.now(),
  storage,
  createDraftId = defaultDraftId,
} = {}) {
  const existing = loadEcommerceDraftReference({ ownerEmail, surface, now, storage });
  if (existing) return existing;
  const owner = normalizedOwner(ownerEmail);
  const activeSurface = normalizedSurface(surface);
  const draftId = cleanText(typeof createDraftId === 'function' ? createDraftId() : '');
  if (!owner || !activeSurface || !draftId) return null;
  if (!saveEcommerceDraftReference({
    ownerEmail: owner,
    surface: activeSurface,
    draftId,
    createdAt: now,
    storage,
  })) return null;
  return { draftId, createdAt: now };
}

export function rotateEcommerceDraft({
  ownerEmail,
  surface,
  currentDraftId,
  now = Date.now(),
  storage,
  createDraftId = defaultDraftId,
} = {}) {
  const current = cleanText(currentDraftId);
  const active = loadEcommerceDraftReference({ ownerEmail, surface, now, storage });
  if (!current || !active || active.draftId !== current) return null;

  const nextDraftId = cleanText(typeof createDraftId === 'function' ? createDraftId() : '');
  if (!nextDraftId || nextDraftId === current) return null;
  if (!saveEcommerceDraftReference({
    ownerEmail,
    surface,
    draftId: nextDraftId,
    createdAt: now,
    storage,
  })) return null;

  const previousTask = loadEcommerceTaskReference({
    ownerEmail,
    draftId: current,
    now,
    storage,
  });
  if (previousTask) {
    clearEcommerceTaskReference({
      ownerEmail,
      draftId: current,
      taskId: previousTask.taskId,
      storage,
    });
  }
  return { draftId: nextDraftId, createdAt: now };
}

export function mergeEcommerceInProgressPreview(previousPreview, image = {}) {
  const id = cleanText(image.id || image.assetId || image.key);
  const url = cleanText(image.stableUrl || image.url);
  if (!id || !url) return previousPreview && typeof previousPreview === 'object' ? previousPreview : {};
  return {
    ...(previousPreview && typeof previousPreview === 'object' ? previousPreview : {}),
    [id]: {
      id,
      url,
      stableUrl: url,
      role: cleanText(image.role),
      label: cleanText(image.label),
      state: cleanText(image.state),
    },
  };
}

export function acceptEcommerceFinalResult(result) {
  const status = cleanText(result?.status).toLowerCase();
  if (status !== 'completed' && status !== 'needs_review') return null;
  const images = Object.fromEntries(
    Object.entries(result?.images && typeof result.images === 'object' ? result.images : {})
      .map(([id, url]) => [cleanText(id), cleanText(url)])
      .filter(([id, url]) => id && url),
  );
  if (Object.keys(images).length === 0) return null;
  return { ...result, status, images };
}
