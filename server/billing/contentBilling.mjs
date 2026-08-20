import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { resolveContentBillingConfig } from './contentBillingConfig.mjs';

const CONTENT_CURRENCY = 'content_sets';
const FAILURE_REASON = 'generation_failed';
const MAX_GENERATION_ID_LENGTH = 128;
const SAFE_GENERATION_ID_RE = /^[a-z0-9][a-z0-9_-]*$/i;
const STABLE_ASSET_URL_RE = /^\/api\/generated-assets\/[a-f0-9]{64}\.(?:jpg|png|webp)$/;
const DEFAULT_LEASE_MS = 30 * 60 * 1000;
const DEFAULT_SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const JOB_TABLE = 'content_generation_jobs';

function codedError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function finiteNow(now) {
  const value = now();
  const timestamp = value instanceof Date ? value.getTime() : value;
  if (!Number.isFinite(timestamp)) throw new TypeError('now must return a finite timestamp');
  return timestamp;
}

function normalizeOwnerEmail(value) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw codedError('CONTENT_OWNER_INVALID', 'Content generation owner is required');
  }
  return value.trim().toLowerCase();
}

function normalizeMode(value) {
  const mode = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!['xhs', 'plog'].includes(mode)) {
    throw codedError('CONTENT_MODE_INVALID', "Content generation mode must be 'xhs' or 'plog'");
  }
  return mode;
}

function normalizeGenerationId(value, { allowGenerated = false } = {}) {
  if (value === undefined && allowGenerated) return randomUUID();
  const generationId = typeof value === 'string' ? value.trim() : '';
  if (!generationId
    || generationId.length > MAX_GENERATION_ID_LENGTH
    || !SAFE_GENERATION_ID_RE.test(generationId)) {
    throw codedError(
      'CONTENT_GENERATION_ID_INVALID',
      'generationId must use 1-128 safe letters, numbers, underscores, or hyphens',
    );
  }
  return generationId;
}

function workIdFor(generationId) {
  return `content-${generationId}`;
}

export function createSessionTokenService({
  secret,
  now = Date.now,
  ttlMs = DEFAULT_SESSION_TTL_MS,
} = {}) {
  const secretBuffer = Buffer.isBuffer(secret) ? Buffer.from(secret) : Buffer.from(String(secret || ''));
  if (secretBuffer.length < 32) throw new TypeError('session secret must be at least 32 bytes');
  if (typeof now !== 'function') throw new TypeError('now must be a function');
  if (!Number.isSafeInteger(ttlMs) || ttlMs <= 0) {
    throw new TypeError('ttlMs must be a positive safe integer');
  }

  function signature(payloadPart) {
    return createHmac('sha256', secretBuffer).update(payloadPart).digest();
  }

  function issue(ownerEmail) {
    const email = normalizeOwnerEmail(ownerEmail);
    const issuedAtMs = finiteNow(now);
    const iat = Math.floor(issuedAtMs / 1000);
    const exp = Math.floor((issuedAtMs + ttlMs) / 1000);
    const payloadPart = Buffer.from(JSON.stringify({ email, iat, exp })).toString('base64url');
    const token = `${payloadPart}.${signature(payloadPart).toString('base64url')}`;
    return { email, token, expiresAt: new Date(exp * 1000).toISOString() };
  }

  function verify(token) {
    const parts = typeof token === 'string' ? token.split('.') : [];
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      throw codedError('AUTH_SESSION_INVALID', 'Session token is invalid');
    }
    let providedSignature;
    let payload;
    try {
      providedSignature = Buffer.from(parts[1], 'base64url');
      payload = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
    } catch {
      throw codedError('AUTH_SESSION_INVALID', 'Session token is invalid');
    }
    const expectedSignature = signature(parts[0]);
    if (providedSignature.length !== expectedSignature.length
      || !timingSafeEqual(providedSignature, expectedSignature)) {
      throw codedError('AUTH_SESSION_INVALID', 'Session token signature is invalid');
    }
    const email = normalizeOwnerEmail(payload?.email);
    if (!Number.isSafeInteger(payload?.iat)
      || !Number.isSafeInteger(payload?.exp)
      || payload.exp <= payload.iat) {
      throw codedError('AUTH_SESSION_INVALID', 'Session token payload is invalid');
    }
    const nowSeconds = Math.floor(finiteNow(now) / 1000);
    if (payload.iat > nowSeconds + 60) {
      throw codedError('AUTH_SESSION_INVALID', 'Session token issue time is invalid');
    }
    if (payload.exp <= nowSeconds) {
      throw codedError('AUTH_SESSION_EXPIRED', 'Session token has expired');
    }
    return {
      email,
      iat: payload.iat,
      exp: payload.exp,
      expiresAt: new Date(payload.exp * 1000).toISOString(),
    };
  }

  return { issue, verify };
}

export function authenticateContentRequest(req = {}, { sessionTokens, authorizeEmail } = {}) {
  if (!sessionTokens || typeof sessionTokens.verify !== 'function') {
    throw new TypeError('sessionTokens.verify is required');
  }
  const headers = req.headers || {};
  const authorization = headers.authorization ?? headers.Authorization;
  const bearer = typeof authorization === 'string'
    ? /^Bearer\s+(.+)$/i.exec(authorization.trim())?.[1]
    : null;
  const token = bearer || headers['x-shubao-session'] || headers['X-Shubao-Session'];
  if (typeof token !== 'string' || token.trim() === '') {
    throw codedError('AUTH_SESSION_REQUIRED', 'A signed session token is required');
  }
  const session = sessionTokens.verify(token.trim());
  if (typeof authorizeEmail !== 'function') return session.email;
  const access = authorizeEmail(session.email);
  if (!access?.ok) {
    const error = codedError('AUTH_SESSION_UNAUTHORIZED', access?.error || 'Session owner is not authorized');
    error.status = access?.status || 403;
    throw error;
  }
  return normalizeOwnerEmail(access.email);
}

export function contentBillingHttpError(error) {
  const code = error?.code || 'CONTENT_GENERATION_FAILED';
  if (code === 'BILLING_INSUFFICIENT_CREDITS') {
    return {
      status: 402,
      body: {
        error: '创作套数不足，请购买套餐后继续',
        code,
        required: error.required ?? 1,
        available: error.available ?? 0,
        resumeable: true,
      },
    };
  }
  if (code.startsWith('AUTH_SESSION_')) {
    return {
      status: code === 'AUTH_SESSION_UNAUTHORIZED' ? (error.status || 403) : 401,
      body: { error: '登录状态无效或已过期，请重新登录', code, resumeable: false },
    };
  }
  if ([
    'CONTENT_INPUT_INVALID',
    'CONTENT_OWNER_INVALID',
    'CONTENT_GENERATION_ID_INVALID',
    'CONTENT_MODE_INVALID',
  ].includes(code)) {
    return {
      status: 400,
      body: { error: '生成任务参数无效，请刷新后重试', code, resumeable: false },
    };
  }
  if ([
    'CONTENT_GENERATION_IDEMPOTENCY_CONFLICT',
    'CONTENT_GENERATION_CONFLICT',
    'CONTENT_GENERATION_OWNER_MISMATCH',
    'CONTENT_GENERATION_NOT_FOUND',
    'CONTENT_GENERATION_LEASE_REQUIRED',
    'CONTENT_GENERATION_LEASE_LOST',
    'CONTENT_GENERATION_LEASE_EXPIRED',
    'CONTENT_GENERATION_TERMINAL',
  ].includes(code)) {
    return {
      status: 409,
      body: { error: '该生成任务状态已变化，请刷新后重试', code, resumeable: false },
    };
  }
  return {
    status: 500,
    body: { error: '暂时无法完成生成，请稍后重试', code, resumeable: false },
  };
}

function decodeBase64Image(value, maxBytes) {
  const encoded = typeof value === 'string' ? value.replace(/\s+/g, '') : '';
  if (!encoded || encoded.length % 4 === 1 || !/^[A-Za-z0-9+/_-]+={0,2}$/.test(encoded)) {
    throw codedError('GENERATED_ASSET_INVALID', 'Generated image base64 is invalid');
  }
  const buffer = Buffer.from(encoded, 'base64');
  if (!buffer.length) throw codedError('GENERATED_ASSET_INVALID', 'Generated image is empty');
  if (buffer.length > maxBytes) {
    throw codedError('GENERATED_ASSET_TOO_LARGE', 'Generated image is too large');
  }
  return buffer;
}

function imageContentType(buffer) {
  if (buffer.length >= 8
    && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return 'image/png';
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }
  if (buffer.length >= 12
    && buffer.subarray(0, 4).toString('ascii') === 'RIFF'
    && buffer.subarray(8, 12).toString('ascii') === 'WEBP') {
    return 'image/webp';
  }
  throw codedError('GENERATED_ASSET_INVALID', 'Generated image type is not supported');
}

export function createGeneratedAssetPersister({
  generatedAssetStore,
  maxBytes = 15 * 1024 * 1024,
} = {}) {
  if (!generatedAssetStore
    || typeof generatedAssetStore.persist !== 'function'
    || typeof generatedAssetStore.persistBuffer !== 'function') {
    throw new TypeError('generatedAssetStore persist and persistBuffer are required');
  }
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) {
    throw new TypeError('maxBytes must be a positive safe integer');
  }

  return async function persistGeneratedAsset({ source, sourceUrl, generationId = '', label = '' } = {}) {
    const input = source ?? sourceUrl;
    if (typeof input === 'string' && /^https?:\/\//i.test(input)) {
      const asset = await generatedAssetStore.persist({ sourceUrl: input, taskId: generationId, label });
      return asset.url;
    }

    let encoded = input;
    let claimedContentType = null;
    if (input && typeof input === 'object') {
      encoded = input.b64_json ?? input.data?.[0]?.b64_json;
    }
    if (typeof encoded === 'string' && encoded.startsWith('data:')) {
      const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/_=\s-]+)$/i.exec(encoded);
      if (!match) throw codedError('GENERATED_ASSET_INVALID', 'Generated image data URL is invalid');
      claimedContentType = match[1].toLowerCase();
      encoded = match[2];
    }
    const buffer = decodeBase64Image(encoded, maxBytes);
    const contentType = imageContentType(buffer);
    if (claimedContentType && claimedContentType !== contentType) {
      throw codedError('GENERATED_ASSET_INVALID', 'Generated image data URL type does not match its bytes');
    }
    const asset = await generatedAssetStore.persistBuffer({
      buffer,
      contentType,
      taskId: generationId,
      label,
    });
    return asset.url;
  };
}

export function createSseTransport(res) {
  if (!res || typeof res.setHeader !== 'function' || typeof res.write !== 'function') {
    throw new TypeError('an SSE response is required');
  }
  let transportClosed = false;
  const closeTransport = () => { transportClosed = true; };
  if (typeof res.on === 'function') {
    res.on('close', closeTransport);
    res.on('error', closeTransport);
  }
  return {
    get closed() { return transportClosed; },
    open() {
      if (transportClosed) return false;
      try {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders?.();
        return true;
      } catch {
        transportClosed = true;
        return false;
      }
    },
    send(type, data = {}) {
      if (transportClosed) return false;
      try {
        const writable = res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`);
        if (writable === false) transportClosed = true;
        return writable !== false;
      } catch {
        transportClosed = true;
        return false;
      }
    },
    heartbeat() {
      if (transportClosed) return false;
      try {
        res.write(': keep-alive\n\n');
        return true;
      } catch {
        transportClosed = true;
        return false;
      }
    },
    end() {
      if (transportClosed) return false;
      try {
        res.end?.();
        return true;
      } catch {
        transportClosed = true;
        return false;
      }
    },
  };
}

function sendJson(res, status, body) {
  if (!res.headersSent) res.status(status).json(body);
  return { action: 'http', httpStatus: status, body };
}

function completedEvent(result, replay) {
  return {
    ...(result.delivery || {}),
    generationId: result.generationId,
    workId: result.workId,
    billing: result.billing,
    replay,
  };
}

export function createBilledSseRunner({
  beginContentGeneration,
  renewContentGenerationLease = beginContentGeneration?.renewLease,
  completeContentGeneration,
  failContentGeneration,
  onStart = null,
  prepareDelivery = null,
  onComplete = null,
  onFailure = null,
  onRecovery = null,
  onReleaseError = error => console.error('[content-billing] release failed:', error.message),
  now = Date.now,
  heartbeatMs = null,
  setIntervalFn = setInterval,
  clearIntervalFn = clearInterval,
} = {}) {
  if (typeof beginContentGeneration !== 'function'
    || typeof renewContentGenerationLease !== 'function'
    || typeof completeContentGeneration !== 'function'
    || typeof failContentGeneration !== 'function') {
    throw new TypeError('content billing lifecycle methods are required');
  }
  if (typeof now !== 'function') throw new TypeError('now must be a function');
  if (heartbeatMs !== null && (!Number.isSafeInteger(heartbeatMs) || heartbeatMs <= 0)) {
    throw new TypeError('heartbeatMs must be a positive safe integer');
  }
  if (typeof setIntervalFn !== 'function' || typeof clearIntervalFn !== 'function') {
    throw new TypeError('heartbeat interval functions are required');
  }

  function startLeaseHeartbeat({ ownerEmail, begun }) {
    const leaseRemainingMs = Date.parse(begun.leaseExpiresAt || '') - finiteNow(now);
    const intervalMs = heartbeatMs ?? Math.max(
      1,
      Math.floor(
        Number.isFinite(leaseRemainingMs) && leaseRemainingMs > 0
          ? leaseRemainingMs / 3
          : DEFAULT_LEASE_MS / 3,
      ),
    );
    let stopped = false;
    let renewalError = null;
    let pendingRenewal = null;

    const renew = () => {
      if (stopped || renewalError || pendingRenewal) return pendingRenewal;
      pendingRenewal = Promise.resolve()
        .then(() => renewContentGenerationLease({
          ownerEmail,
          generationId: begun.generationId,
          leaseToken: begun.leaseToken,
        }))
        .catch(error => {
          renewalError = error;
        })
        .finally(() => {
          pendingRenewal = null;
        });
      return pendingRenewal;
    };

    const timer = setIntervalFn(renew, intervalMs);
    timer?.unref?.();
    return {
      stop() {
        if (stopped) return;
        stopped = true;
        clearIntervalFn(timer);
      },
      async settle() {
        while (pendingRenewal) await pendingRenewal;
      },
      assertOwned() {
        if (renewalError) throw renewalError;
      },
    };
  }

  return async function runBilledSse({
    res,
    ownerEmail,
    generationId,
    mode,
    generate,
  } = {}) {
    if (typeof generate !== 'function') throw new TypeError('generate callback is required');
    let begun;
    try {
      begun = await beginContentGeneration({ ownerEmail, generationId, mode });
    } catch (error) {
      const mapped = contentBillingHttpError(error);
      return sendJson(res, mapped.status, mapped.body);
    }

    if (begun.action === 'in_progress') {
      return sendJson(res, 202, {
        error: '该生成任务仍在处理中，请稍后重试',
        code: 'CONTENT_GENERATION_IN_PROGRESS',
        resumeable: true,
        generationId: begun.generationId,
        workId: begun.workId,
        billing: begun.billing,
        replay: false,
      });
    }
    if (begun.action === 'terminal') {
      if (typeof onRecovery === 'function') {
        try {
          await onRecovery({ ownerEmail, begun });
        } catch (recoveryError) {
          onReleaseError(recoveryError, begun.error);
        }
      }
      return sendJson(res, 409, {
        error: begun.error?.message || '该生成任务已失败，请使用新的 generationId 重试',
        code: begun.error?.code || 'CONTENT_GENERATION_TERMINAL',
        resumeable: false,
        generationId: begun.generationId,
        workId: begun.workId,
        billing: begun.billing,
        replay: true,
      });
    }

    const transport = createSseTransport(res);
    transport.open();
    if (begun.action === 'replay') {
      if (typeof onRecovery === 'function') {
        try {
          await onRecovery({ ownerEmail, begun });
        } catch (recoveryError) {
          onReleaseError(recoveryError, null);
        }
      }
      transport.send('complete', completedEvent(begun, true));
      transport.end();
      return begun;
    }

    let lifecycleHandled = false;
    let lifecycleContext = null;
    let heartbeat = null;
    let transportHeartbeat = null;
    try {
      heartbeat = startLeaseHeartbeat({ ownerEmail, begun });
      transportHeartbeat = setIntervalFn(
        () => transport.heartbeat(),
        Math.min(heartbeatMs ?? 15_000, 15_000),
      );
      transportHeartbeat?.unref?.();
      let delivery;
      try {
        if (typeof onStart === 'function') {
          lifecycleContext = await onStart({ ownerEmail, begun });
        }
        delivery = await generate({
          send: (type, data) => transport.send(type, data),
          generationId: begun.generationId,
          workId: begun.workId,
          leaseToken: begun.leaseToken,
          billing: begun.billing,
          project: lifecycleContext,
        });
        if (typeof prepareDelivery === 'function') {
          const prepared = await prepareDelivery({ ownerEmail, begun, delivery, context: lifecycleContext });
          if (prepared && typeof prepared === 'object' && !Array.isArray(prepared)
            && Object.hasOwn(prepared, 'delivery')) {
            delivery = prepared.delivery;
            lifecycleContext = prepared.context || lifecycleContext;
          } else {
            delivery = prepared;
          }
        }
      } finally {
        heartbeat.stop();
        await heartbeat.settle();
      }
      heartbeat.assertOwned();
      const completed = await completeContentGeneration({
        ownerEmail,
        generationId: begun.generationId,
        leaseToken: begun.leaseToken,
        result: delivery,
      });
      lifecycleHandled = true;
      if (completed.jobStatus === 'failed') {
        if (typeof onFailure === 'function') {
          try {
            await onFailure({ ownerEmail, begun, completed, context: lifecycleContext });
          } catch (lifecycleError) {
            onReleaseError(lifecycleError, completed.error);
          }
        }
        transport.send('error', {
          error: describeContentGenerationFailure(completed.error, completed.billing),
          code: completed.error?.code || 'CONTENT_DELIVERY_EMPTY',
          generationId: completed.generationId,
          workId: completed.workId,
          billing: completed.billing,
        });
      } else {
        if (typeof onComplete === 'function') {
          try {
            await onComplete({ ownerEmail, begun, completed, delivery, context: lifecycleContext });
          } catch (lifecycleError) {
            onReleaseError(lifecycleError, null);
          }
        }
        transport.send('complete', completedEvent(completed, completed.action === 'replay'));
      }
      return completed;
    } catch (error) {
      let failed = null;
      try {
        failed = await failContentGeneration({
          ownerEmail,
          generationId: begun.generationId,
          leaseToken: begun.leaseToken,
          error,
        });
        lifecycleHandled = true;
      } catch (releaseError) {
        onReleaseError(releaseError, error);
      }
      if (typeof onFailure === 'function') {
        try {
          await onFailure({ ownerEmail, begun, error, context: lifecycleContext });
        } catch (lifecycleError) {
          onReleaseError(lifecycleError, error);
        }
      }
      transport.send('error', {
        error: describeContentGenerationFailure(error, failed?.billing),
        code: error?.code || 'CONTENT_GENERATION_FAILED',
        generationId: begun.generationId,
        workId: begun.workId,
        ...(failed?.billing ? { billing: failed.billing } : {}),
      });
      return failed || {
        action: 'error',
        jobStatus: 'processing',
        generationId: begun.generationId,
        workId: begun.workId,
        billing: begun.billing,
        error: serializedError(error),
      };
    } finally {
      heartbeat?.stop();
      if (transportHeartbeat) clearIntervalFn(transportHeartbeat);
      if (!lifecycleHandled) {
        try {
          await failContentGeneration({
            ownerEmail,
            generationId: begun.generationId,
            leaseToken: begun.leaseToken,
            error: codedError('CONTENT_GENERATION_ABORTED', 'Generation ended before a terminal state'),
          });
        } catch (releaseError) {
          onReleaseError(releaseError);
        }
      }
      transport.end();
    }
  };
}

export function createPreviewSseRunner({
  previewContentGeneration,
  heartbeatMs = 15_000,
  setIntervalFn = setInterval,
  clearIntervalFn = clearInterval,
} = {}) {
  if (typeof previewContentGeneration !== 'function') {
    throw new TypeError('previewContentGeneration is required');
  }
  if (!Number.isSafeInteger(heartbeatMs) || heartbeatMs <= 0) {
    throw new TypeError('preview heartbeatMs must be a positive safe integer');
  }
  return async function runPreviewSse({ res, generationId, mode, generateCover } = {}) {
    if (typeof generateCover !== 'function') throw new TypeError('generateCover callback is required');
    let preview;
    try {
      preview = previewContentGeneration({ generationId, mode });
    } catch (error) {
      const mapped = contentBillingHttpError(error);
      return sendJson(res, mapped.status, mapped.body);
    }
    const transport = createSseTransport(res);
    transport.open();
    const heartbeat = setIntervalFn(() => transport.heartbeat(), heartbeatMs);
    heartbeat?.unref?.();
    try {
      const generated = await generateCover({
        generationId: preview.generationId,
        workId: preview.workId,
        send: (type, data) => transport.send(type, data),
      });
      const delivery = jsonClone(generated?.delivery || {});
      delete delivery.pages;
      delete delivery.image_prompts;
      delete delivery.cover_prompt;
      delivery.cover_url = STABLE_ASSET_URL_RE.test(generated?.url || '') ? generated.url : '';
      delivery.image_urls = [];
      delivery.image_count = 0;
      if (delivery.cover_url) {
        transport.send('image', {
          id: 'cover',
          url: delivery.cover_url,
          generationId: preview.generationId,
          workId: preview.workId,
        });
      }
      const result = {
        ...preview,
        delivery,
      };
      transport.send('complete', completedEvent(result, false));
      return result;
    } catch (error) {
      transport.send('error', {
        error: '预览生成失败，请稍后重试',
        code: error?.code || 'CONTENT_PREVIEW_FAILED',
        generationId: preview.generationId,
        workId: preview.workId,
        billing: preview.billing,
      });
      return {
        ...preview,
        action: 'error',
        error: serializedError(error, 'CONTENT_PREVIEW_FAILED'),
      };
    } finally {
      clearIntervalFn(heartbeat);
      transport.end();
    }
  };
}

function hasCopy(result) {
  if (!result || typeof result !== 'object' || Array.isArray(result)) return false;
  for (const key of ['title', 'caption', 'body_text']) {
    if (typeof result[key] === 'string' && result[key].trim() !== '') return true;
  }
  return Array.isArray(result.copyLines)
    && result.copyLines.some(line => typeof line === 'string' && line.trim() !== '');
}

function stableAssetCount(result) {
  if (!result || typeof result !== 'object' || Array.isArray(result)) return 0;
  const urls = [];
  if (typeof result.cover_url === 'string') urls.push(result.cover_url);
  if (Array.isArray(result.image_urls)) urls.push(...result.image_urls);
  return new Set(urls.filter(url => STABLE_ASSET_URL_RE.test(url))).size;
}

function jsonClone(value, code = 'CONTENT_DELIVERY_INVALID') {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    throw codedError(code, 'Content generation payload must be JSON serializable');
  }
}

function storedJson(value, code) {
  try {
    return JSON.parse(value);
  } catch {
    throw codedError(code, 'Stored content generation state is invalid');
  }
}

function stableDelivery(result) {
  const normalized = result && typeof result === 'object' && !Array.isArray(result)
    ? jsonClone(result)
    : {};
  const cover = typeof normalized.cover_url === 'string'
    && STABLE_ASSET_URL_RE.test(normalized.cover_url)
    ? normalized.cover_url
    : '';
  const seen = new Set(cover ? [cover] : []);
  const images = [];
  for (const url of Array.isArray(normalized.image_urls) ? normalized.image_urls : []) {
    if (typeof url !== 'string' || !STABLE_ASSET_URL_RE.test(url) || seen.has(url)) continue;
    seen.add(url);
    images.push(url);
  }
  normalized.cover_url = cover;
  normalized.image_urls = images;
  normalized.image_count = images.length;
  return normalized;
}

function serializedError(error, fallbackCode = 'CONTENT_GENERATION_FAILED') {
  return {
    code: typeof error?.code === 'string' && error.code ? error.code : fallbackCode,
    message: error?.message || '生成失败，请稍后重试',
  };
}

export function ensureContentGenerationJobSchema(db) {
  if (!db || typeof db.exec !== 'function') throw new TypeError('db is required');
  db.exec(`
    CREATE TABLE IF NOT EXISTS ${JOB_TABLE} (
      generation_id TEXT PRIMARY KEY,
      owner_email TEXT NOT NULL,
      mode TEXT NOT NULL,
      work_id TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL CHECK (status IN ('processing', 'completed', 'needs_review', 'failed')),
      lease_token TEXT,
      lease_expires_at TEXT,
      delivery_json TEXT NOT NULL DEFAULT 'null',
      billing_json TEXT NOT NULL DEFAULT 'null',
      error_json TEXT NOT NULL DEFAULT 'null',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_content_generation_jobs_owner
      ON ${JOB_TABLE}(owner_email, updated_at DESC);
  `);
}

export function describeContentGenerationFailure(error, billing = null) {
  const released = billing?.status === 'released';
  const billingMessage = released
    ? '创作额度已退回'
    : '创作额度释放状态待确认，请稍后查看余额';
  if (error?.code === 'CONTENT_DELIVERY_EMPTY') {
    return `未生成可交付内容，${billingMessage}`;
  }
  if (/Image API|图片|生成/i.test(error?.message || '')) {
    return `图片生成暂时失败，${billingMessage}`;
  }
  return error?.message || '生成失败，请稍后重试';
}

function billingSnapshot({
  status,
  generationId,
  workId,
  holdId = null,
  entitlement = null,
  balance,
  currency = CONTENT_CURRENCY,
  billedUnits = 1,
}) {
  const unlimited = balance?.unlimited === true;
  return {
    currency,
    status,
    settledUnits: status === 'settled' ? billedUnits : 0,
    balance: balance === null || unlimited ? null : (balance?.availableUnits ?? 0),
    heldUnits: balance?.heldUnits ?? 0,
    unlimited,
    generationId,
    holdId,
    workId,
    entitlement: entitlement ?? null,
  };
}

export function createContentBilling({
  db,
  contentEntitlements,
  walletService,
  now = Date.now,
  leaseMs = DEFAULT_LEASE_MS,
  ...billingOptions
} = {}) {
  if (!db || typeof db.prepare !== 'function' || typeof db.transaction !== 'function') {
    throw new TypeError('db must be a better-sqlite3 database');
  }
  if (!contentEntitlements
    || typeof contentEntitlements.holdSet !== 'function'
    || typeof contentEntitlements.completeSet !== 'function'
    || typeof contentEntitlements.failSet !== 'function') {
    throw new TypeError('contentEntitlements holdSet, completeSet, and failSet are required');
  }
  if (!walletService || typeof walletService.getBalance !== 'function') {
    throw new TypeError('walletService.getBalance is required');
  }
  if (typeof now !== 'function') throw new TypeError('now must be a function');
  if (!Number.isSafeInteger(leaseMs) || leaseMs <= 0) {
    throw new TypeError('leaseMs must be a positive safe integer');
  }

  const billingConfig = resolveContentBillingConfig(billingOptions);

  function makeBillingSnapshot(input) {
    return billingSnapshot({
      ...input,
      currency: billingConfig.currency,
      billedUnits: billingConfig.itemUnits,
    });
  }

  ensureContentGenerationJobSchema(db);

  const statements = {
    selectJob: db.prepare(`SELECT * FROM ${JOB_TABLE} WHERE generation_id = ?`),
    insertJob: db.prepare(`
      INSERT INTO ${JOB_TABLE} (
        generation_id, owner_email, mode, work_id, status,
        lease_token, lease_expires_at, delivery_json, billing_json,
        error_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, 'processing', ?, ?, 'null', ?, 'null', ?, ?)
    `),
    reclaimJob: db.prepare(`
      UPDATE ${JOB_TABLE}
      SET lease_token = ?, lease_expires_at = ?, updated_at = ?
      WHERE generation_id = ? AND status = 'processing'
        AND lease_token = ? AND lease_expires_at = ?
    `),
    renewJob: db.prepare(`
      UPDATE ${JOB_TABLE}
      SET lease_expires_at = ?, updated_at = ?
      WHERE owner_email = ? AND generation_id = ?
        AND status = 'processing' AND lease_token = ?
    `),
    finishJob: db.prepare(`
      UPDATE ${JOB_TABLE}
      SET status = ?, lease_token = NULL, lease_expires_at = NULL,
        delivery_json = ?, billing_json = ?, error_json = ?, updated_at = ?
      WHERE generation_id = ? AND status = 'processing' AND lease_token = ?
    `),
  };

  function currentTimeMs() {
    const value = now();
    const timestamp = value instanceof Date ? value.getTime() : value;
    if (!Number.isFinite(timestamp)) throw new TypeError('now must return a finite timestamp');
    return timestamp;
  }

  function currentTimeIso() {
    return new Date(currentTimeMs()).toISOString();
  }

  function currentBalance(ownerEmail) {
    return walletService.getBalance(ownerEmail, billingConfig.currency);
  }

  function mutationBalance(ownerEmail, ...candidates) {
    return candidates.find(candidate => (
      candidate
      && typeof candidate === 'object'
      && typeof candidate.unlimited === 'boolean'
    )) ?? currentBalance(ownerEmail);
  }

  function validateJobOwner(row, ownerEmail, { mode } = {}) {
    if (!row) throw codedError('CONTENT_GENERATION_NOT_FOUND', 'Content generation was not found');
    if (row.owner_email !== ownerEmail) {
      throw codedError('CONTENT_GENERATION_OWNER_MISMATCH', 'Content generation belongs to another owner');
    }
    if (mode !== undefined && row.mode !== mode) {
      throw codedError('CONTENT_GENERATION_CONFLICT', 'Content generation mode conflicts with the existing job');
    }
  }

  function jobEnvelope({
    row,
    billing,
    action,
    delivery = null,
    error = null,
    leaseToken = null,
    leaseExpiresAt = null,
    reclaimed = false,
  }) {
    return {
      ...(billing || {}),
      action,
      replay: action === 'replay' || action === 'terminal',
      jobStatus: row.status,
      generationId: row.generation_id,
      workId: row.work_id,
      mode: row.mode,
      leaseToken,
      leaseExpiresAt,
      reclaimed,
      delivery,
      billing,
      error,
    };
  }

  function storedJobEnvelope(row, action) {
    return jobEnvelope({
      row,
      action,
      billing: storedJson(row.billing_json, 'CONTENT_GENERATION_BILLING_INVALID'),
      delivery: storedJson(row.delivery_json, 'CONTENT_GENERATION_DELIVERY_INVALID'),
      error: storedJson(row.error_json, 'CONTENT_GENERATION_ERROR_INVALID'),
      leaseExpiresAt: row.lease_expires_at,
    });
  }

  function validateLease(row, leaseToken) {
    if (typeof leaseToken !== 'string' || leaseToken.trim() === '') {
      throw codedError('CONTENT_GENERATION_LEASE_REQUIRED', 'Content generation lease token is required');
    }
    if (row.status !== 'processing') return;
    if (row.lease_token !== leaseToken) {
      throw codedError('CONTENT_GENERATION_LEASE_LOST', 'Content generation lease is no longer owned by this worker');
    }
    if (!row.lease_expires_at || Date.parse(row.lease_expires_at) <= currentTimeMs()) {
      throw codedError('CONTENT_GENERATION_LEASE_EXPIRED', 'Content generation lease has expired');
    }
  }

  const beginTx = db.transaction(input => {
    const existing = statements.selectJob.get(input.generationId);
    if (existing) {
      validateJobOwner(existing, input.ownerEmail, { mode: input.mode });
      if (existing.status === 'completed' || existing.status === 'needs_review') {
        return storedJobEnvelope(existing, 'replay');
      }
      if (existing.status === 'failed') return storedJobEnvelope(existing, 'terminal');

      const expiryMs = Date.parse(existing.lease_expires_at || '');
      if (Number.isFinite(expiryMs) && expiryMs > currentTimeMs()) {
        const pending = storedJobEnvelope(existing, 'in_progress');
        pending.leaseToken = null;
        return pending;
      }

      const leaseToken = randomUUID();
      const leaseExpiresAt = new Date(currentTimeMs() + leaseMs).toISOString();
      const updatedAt = currentTimeIso();
      const updated = statements.reclaimJob.run(
        leaseToken,
        leaseExpiresAt,
        updatedAt,
        input.generationId,
        existing.lease_token,
        existing.lease_expires_at,
      );
      if (updated.changes !== 1) {
        throw codedError('CONTENT_GENERATION_IDEMPOTENCY_CONFLICT', 'Content generation lease changed concurrently');
      }
      return jobEnvelope({
        row: { ...existing, lease_token: leaseToken, lease_expires_at: leaseExpiresAt },
        billing: storedJson(existing.billing_json, 'CONTENT_GENERATION_BILLING_INVALID'),
        action: 'start',
        leaseToken,
        leaseExpiresAt,
        reclaimed: true,
      });
    }

    const hold = contentEntitlements.holdSet({
      ownerEmail: input.ownerEmail,
      generationId: input.generationId,
      workId: input.workId,
      mode: input.mode,
    });
    const billing = makeBillingSnapshot({
      status: 'held',
      generationId: input.generationId,
      workId: input.workId,
      holdId: hold.id,
      balance: mutationBalance(input.ownerEmail, hold.balance),
    });
    const leaseToken = randomUUID();
    const nowIso = currentTimeIso();
    const leaseExpiresAt = new Date(currentTimeMs() + leaseMs).toISOString();
    statements.insertJob.run(
      input.generationId,
      input.ownerEmail,
      input.mode,
      input.workId,
      leaseToken,
      leaseExpiresAt,
      JSON.stringify(billing),
      nowIso,
      nowIso,
    );
    return jobEnvelope({
      row: {
        generation_id: input.generationId,
        owner_email: input.ownerEmail,
        mode: input.mode,
        work_id: input.workId,
        status: 'processing',
      },
      billing,
      action: 'start',
      leaseToken,
      leaseExpiresAt,
    });
  });

  function beginContentGeneration(input = {}) {
    const ownerEmail = normalizeOwnerEmail(input.ownerEmail);
    const generationId = normalizeGenerationId(input.generationId, { allowGenerated: true });
    const workId = workIdFor(generationId);
    const mode = normalizeMode(input.mode);
    try {
      return beginTx.immediate({ ownerEmail, generationId, workId, mode });
    } catch (error) {
      if (error?.code === 'BILLING_INSUFFICIENT_CREDITS') {
        const balance = currentBalance(ownerEmail);
        error.currency = billingConfig.currency;
        error.required = billingConfig.itemUnits;
        error.available = balance.unlimited ? null : balance.availableUnits;
        error.resumeable = true;
      }
      throw error;
    }
  }

  function renewContentGenerationLease(input = {}) {
    const ownerEmail = normalizeOwnerEmail(input.ownerEmail);
    const generationId = normalizeGenerationId(input.generationId);
    const leaseToken = typeof input.leaseToken === 'string' ? input.leaseToken.trim() : '';
    if (!leaseToken) {
      throw codedError('CONTENT_GENERATION_LEASE_REQUIRED', 'Content generation lease token is required');
    }
    const renewedAtMs = currentTimeMs();
    const updatedAt = new Date(renewedAtMs).toISOString();
    const leaseExpiresAt = new Date(renewedAtMs + leaseMs).toISOString();
    const renewed = statements.renewJob.run(
      leaseExpiresAt,
      updatedAt,
      ownerEmail,
      generationId,
      leaseToken,
    );
    if (renewed.changes !== 1) {
      throw codedError('CONTENT_GENERATION_LEASE_LOST', 'Content generation lease is no longer owned by this worker');
    }
    return {
      generationId,
      leaseToken,
      leaseExpiresAt,
    };
  }

  const failTx = db.transaction(input => {
    const row = statements.selectJob.get(input.generationId);
    validateJobOwner(row, input.ownerEmail);
    if (row.status === 'completed' || row.status === 'needs_review') {
      return storedJobEnvelope(row, 'replay');
    }
    if (row.status === 'failed') return storedJobEnvelope(row, 'terminal');
    validateLease(row, input.leaseToken);

    const failed = contentEntitlements.failSet({
      ownerEmail: input.ownerEmail,
      generationId: input.generationId,
      workId: row.work_id,
      reason: FAILURE_REASON,
    });
    const billing = makeBillingSnapshot({
      status: failed.status,
      generationId: input.generationId,
      workId: row.work_id,
      holdId: failed.holdId,
      balance: mutationBalance(input.ownerEmail, failed.release?.balance, failed.balance),
    });
    const error = serializedError(input.error);
    const updated = statements.finishJob.run(
      'failed',
      JSON.stringify(input.delivery ?? null),
      JSON.stringify(billing),
      JSON.stringify(error),
      currentTimeIso(),
      input.generationId,
      input.leaseToken,
    );
    if (updated.changes !== 1) {
      throw codedError('CONTENT_GENERATION_LEASE_LOST', 'Content generation lease changed during failure');
    }
    return jobEnvelope({
      row: { ...row, status: 'failed' },
      billing,
      delivery: input.delivery ?? null,
      error,
      action: 'failed',
    });
  });

  function failContentGeneration(input = {}) {
    return failTx.immediate({
      ownerEmail: normalizeOwnerEmail(input.ownerEmail),
      generationId: normalizeGenerationId(input.generationId),
      leaseToken: input.leaseToken,
      delivery: input.delivery === undefined ? null : stableDelivery(input.delivery),
      error: input.error,
    });
  }

  const completeTx = db.transaction(input => {
    const row = statements.selectJob.get(input.generationId);
    validateJobOwner(row, input.ownerEmail);
    if (row.status === 'completed' || row.status === 'needs_review') {
      return storedJobEnvelope(row, 'replay');
    }
    if (row.status === 'failed') return storedJobEnvelope(row, 'terminal');
    validateLease(row, input.leaseToken);

    const result = stableDelivery(input.result);
    if (!hasCopy(result) || stableAssetCount(result) === 0) {
      const failed = contentEntitlements.failSet({
        ownerEmail: input.ownerEmail,
        generationId: input.generationId,
        workId: row.work_id,
        reason: FAILURE_REASON,
      });
      const billing = makeBillingSnapshot({
        status: failed.status,
        generationId: input.generationId,
        workId: row.work_id,
        holdId: failed.holdId,
        balance: mutationBalance(input.ownerEmail, failed.release?.balance, failed.balance),
      });
      const error = serializedError(
        codedError('CONTENT_DELIVERY_EMPTY', '未生成可交付内容'),
        'CONTENT_DELIVERY_EMPTY',
      );
      const updated = statements.finishJob.run(
        'failed',
        JSON.stringify(result),
        JSON.stringify(billing),
        JSON.stringify(error),
        currentTimeIso(),
        input.generationId,
        input.leaseToken,
      );
      if (updated.changes !== 1) {
        throw codedError('CONTENT_GENERATION_LEASE_LOST', 'Content generation lease changed during release');
      }
      return jobEnvelope({
        row: { ...row, status: 'failed' },
        billing,
        delivery: result,
        error,
        action: 'failed',
      });
    }

    const completed = contentEntitlements.completeSet({
      ownerEmail: input.ownerEmail,
      generationId: input.generationId,
      workId: row.work_id,
      result,
    });
    const billing = makeBillingSnapshot({
      status: completed.status,
      generationId: input.generationId,
      workId: row.work_id,
      holdId: completed.holdId,
      entitlement: completed.entitlement,
      balance: mutationBalance(
        input.ownerEmail,
        completed.settlement?.balance,
        completed.balance,
      ),
    });
    const jobStatus = completed.status === 'settled' ? 'completed' : 'needs_review';
    const updated = statements.finishJob.run(
      jobStatus,
      JSON.stringify(result),
      JSON.stringify(billing),
      'null',
      currentTimeIso(),
      input.generationId,
      input.leaseToken,
    );
    if (updated.changes !== 1) {
      throw codedError('CONTENT_GENERATION_LEASE_LOST', 'Content generation lease changed during completion');
    }
    return jobEnvelope({
      row: { ...row, status: jobStatus },
      billing,
      delivery: result,
      action: 'complete',
    });
  });

  function completeContentGeneration(input = {}) {
    return completeTx.immediate({
      ownerEmail: normalizeOwnerEmail(input.ownerEmail),
      generationId: normalizeGenerationId(input.generationId),
      leaseToken: input.leaseToken,
      result: input.result,
    });
  }

  function previewContentGeneration(input = {}) {
    const generationId = normalizeGenerationId(input.generationId, { allowGenerated: true });
    normalizeMode(input.mode);
    const workId = workIdFor(generationId);
    const billing = makeBillingSnapshot({
      status: 'preview',
      generationId,
      workId,
      balance: null,
    });
    return {
      ...billing,
      action: 'preview',
      replay: false,
      jobStatus: 'preview',
      billing,
    };
  }

  beginContentGeneration.renewLease = renewContentGenerationLease;
  return {
    beginContentGeneration,
    renewContentGenerationLease,
    completeContentGeneration,
    failContentGeneration,
    previewContentGeneration,
  };
}
