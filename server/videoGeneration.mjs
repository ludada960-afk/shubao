import crypto from 'node:crypto';
import fs from 'node:fs';
import { copyFile, link, rename, stat, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { quoteFeature } from './billing/catalog.mjs';
import {
  DEFAULT_VIDEO_PRODUCT_ID,
  VIDEO_CATALOG_VERSION,
  VIDEO_PRODUCTS,
  getVideoProduct,
  validateVideoProductInput,
  videoFeatureSku as catalogVideoFeatureSku,
} from './videoCatalog.mjs';
import {
  buildProviderPayload,
  createVideoProviderRegistry,
  isVideoProviderFailure,
} from './videoProviders.mjs';
import { createOwnerFairVideoQueue } from './videoQueue.mjs';
import { createVideoAttemptStore } from './videoAttemptStore.mjs';
import { createVideoOutbox } from './videoOutbox.mjs';

const FINAL_STATUSES = new Set(['completed', 'failed', 'needs_review', 'reconciling']);
const ACTIVE_STATUSES = new Set(['queued', 'submitting', 'processing']);
const RATIOS = new Set(['21:9', '16:9', '4:3', '1:1', '3:4', '9:16']);
const INPUT_LIMITS = Object.freeze({ image: 10 * 1024 * 1024, video: 50 * 1024 * 1024, audio: 15 * 1024 * 1024 });
const OUTPUT_LIMIT = 100 * 1024 * 1024;
const CIRCUIT_MIN_SAMPLES = 5;
const CIRCUIT_WINDOW = 20;
const CIRCUIT_COOLDOWN_MS = 15 * 60 * 1000;
const SUBMISSION_REVIEW_TTL_MS = 30 * 60 * 1000;
const CONTENT_TYPES = Object.freeze({
  image: new Set(['image/jpeg', 'image/png', 'image/webp']),
  video: new Set(['video/mp4', 'video/webm', 'video/quicktime']),
  audio: new Set(['audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/x-wav', 'audio/webm']),
});

function clean(value, max = 1200) {
  return String(value || '').trim().slice(0, max);
}

function httpError(status, code, message, details = {}) {
  return Object.assign(new Error(message), { status, code, ...details });
}

export function videoFeatureSku({ productId = DEFAULT_VIDEO_PRODUCT_ID, duration } = {}) {
  return catalogVideoFeatureSku({ productId, duration });
}

function parseJson(value, fallback) {
  try { return JSON.parse(value || ''); } catch { return fallback; }
}

function serializeJob(row, resultUrl = row?.result_url || '', projectAssetRef = null) {
  if (!row) return null;
  return {
    id: row.id,
    status: row.status,
    mode: row.mode,
    sku: row.sku,
    productId: row.product_id || DEFAULT_VIDEO_PRODUCT_ID,
    providerRoute: row.provider_route || 'sd5-seedance-2.0',
    catalogVersion: row.catalog_version || 'legacy-seedance-v1',
    providerCostCny: Number(row.provider_cost_cny ?? 3.64),
    failureClass: row.failure_class || '',
    billingState: row.status === 'completed' && (!row.billing_state || row.billing_state === 'held')
      ? 'settled'
      : row.billing_state || 'held',
    deliveryState: row.delivery_state || (row.status === 'completed' ? 'verified' : 'none'),
    projectProjectionState: row.project_projection_state || (row.status === 'completed' ? 'projected' : 'none'),
    projectionState: row.projection_state || (row.status === 'completed' ? 'projected' : 'none'),
    projectId: row.project_id || '',
    sourceVersionId: row.source_version_id || '',
    resultVersionId: row.result_version_id || '',
    reconciliationError: row.reconciliation_error || '',
    reviewDeadlineAt: Number(row.review_deadline_ms || 0),
    attemptId: row.current_attempt_id || '',
    prompt: row.prompt,
    duration: row.duration,
    aspectRatio: row.aspect_ratio,
    resolution: row.resolution,
    generateAudio: row.generate_audio === 1,
    seed: row.seed,
    references: parseJson(row.refs_json, {}),
    progress: row.progress,
    resultUrl,
    projectAssetRef,
    error: row.error || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function extensionFor(contentType) {
  const values = {
    'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp',
    'video/mp4': '.mp4', 'video/webm': '.webm', 'video/quicktime': '.mov',
    'audio/mpeg': '.mp3', 'audio/mp4': '.m4a', 'audio/wav': '.wav',
    'audio/x-wav': '.wav', 'audio/webm': '.webm',
  };
  return values[contentType] || '';
}

async function responseJson(response) {
  const text = await response.text();
  if (!text) return {};
  try { return JSON.parse(text); } catch { throw httpError(502, 'VIDEO_PROVIDER_INVALID_JSON', '视频服务返回了无法识别的数据'); }
}

export function createVideoProvider({
  apiKey,
  baseUrl = 'https://api-new.ip233.com/v1',
  model = 'sd5-seedance-2.0',
  fetchImpl = fetch,
} = {}) {
  const endpoint = clean(baseUrl, 500).replace(/\/+$/, '');
  const token = clean(apiKey, 500);

  async function request(path, options = {}, timeoutMs = 30_000) {
    if (!token) throw httpError(503, 'VIDEO_PROVIDER_NOT_CONFIGURED', '视频服务正在配置中');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    timer.unref?.();
    try {
      const response = await fetchImpl(`${endpoint}${path}`, {
        ...options,
        headers: {
          Authorization: `Bearer ${token}`,
          ...(options.body ? { 'Content-Type': 'application/json' } : {}),
          ...(options.headers || {}),
        },
        signal: controller.signal,
      });
      if (!response.ok) {
        const body = await response.text().catch(() => '');
        const retryable = response.status === 408 || response.status === 409 || response.status === 429 || response.status >= 500;
        throw httpError(response.status >= 500 ? 502 : 400, 'VIDEO_PROVIDER_REJECTED', '视频任务未被上游接受', {
          retryable,
          providerStatus: response.status,
          providerDetail: body.slice(0, 300),
        });
      }
      return response;
    } catch (error) {
      if (error?.code) throw error;
      throw httpError(502, 'VIDEO_PROVIDER_UNREACHABLE', '暂时无法连接视频服务', { retryable: true });
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    enabled: Boolean(token),
    model,
    async submit(payload, idempotencyKey) {
      const response = await request('/videos', {
        method: 'POST',
        headers: { 'Idempotency-Key': idempotencyKey },
        body: JSON.stringify({ model, ...payload }),
      });
      const data = await responseJson(response);
      if (!clean(data.id, 200)) throw httpError(502, 'VIDEO_PROVIDER_TASK_MISSING', '视频服务没有返回任务编号');
      return data;
    },
    async get(taskId) {
      return responseJson(await request(`/videos/${encodeURIComponent(taskId)}`, { method: 'GET' }));
    },
    async download(taskId) {
      return request(`/videos/${encodeURIComponent(taskId)}/content`, { method: 'GET' }, 180_000);
    },
  };
}

export function createVideoGeneration({
  db,
  walletService,
  quoteService,
  upsertWork,
  assetRoot,
  apiKey,
  minimaxApiKey,
  credentials,
  baseUrl,
  minimaxBaseUrl,
  model,
  fetchImpl,
  providerRegistry,
  projectBridge = null,
  allowHiddenProducts = false,
  assetSigningSecret = '',
  now = Date.now,
  pollIntervalMs = 5000,
  maxConcurrent = 2,
  reconciliationIntervalMs = 30_000,
  ownerReads = true,
  readNewState = true,
  validateWorkbenchPlanApproval = null,
} = {}) {
  if (!db || !walletService || !quoteService || typeof upsertWork !== 'function') {
    throw new TypeError('video generation dependencies are required');
  }
  const root = resolve(assetRoot);
  const inputRoot = resolve(root, 'input');
  const outputRoot = resolve(root, 'output');
  fs.mkdirSync(inputRoot, { recursive: true });
  fs.mkdirSync(outputRoot, { recursive: true });
  db.exec(`
    CREATE TABLE IF NOT EXISTS video_assets (
      id TEXT PRIMARY KEY,
      owner_email TEXT NOT NULL,
      kind TEXT NOT NULL,
      content_type TEXT NOT NULL,
      bytes INTEGER NOT NULL,
      sha256 TEXT NOT NULL DEFAULT '',
      file_name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );
    CREATE TABLE IF NOT EXISTS video_jobs (
      id TEXT PRIMARY KEY,
      owner_email TEXT NOT NULL,
      idempotency_key TEXT NOT NULL,
      status TEXT NOT NULL,
      mode TEXT NOT NULL,
      sku TEXT NOT NULL,
      prompt TEXT NOT NULL,
      negative_prompt TEXT NOT NULL DEFAULT '',
      duration INTEGER NOT NULL,
      aspect_ratio TEXT NOT NULL,
      resolution TEXT NOT NULL,
      generate_audio INTEGER NOT NULL DEFAULT 1,
      seed INTEGER NOT NULL DEFAULT 0,
      refs_json TEXT NOT NULL DEFAULT '{}',
      provider_task_id TEXT NOT NULL DEFAULT '',
      progress INTEGER NOT NULL DEFAULT 0,
      hold_id TEXT NOT NULL DEFAULT '',
      result_asset_id TEXT NOT NULL DEFAULT '',
      result_url TEXT NOT NULL DEFAULT '',
      error TEXT NOT NULL DEFAULT '',
      product_id TEXT NOT NULL DEFAULT 'seedance_standard',
      provider_route TEXT NOT NULL DEFAULT 'sd5-seedance-2.0',
      catalog_version TEXT NOT NULL DEFAULT 'legacy-seedance-v1',
      provider_cost_cny REAL NOT NULL DEFAULT 3.64,
      failure_class TEXT NOT NULL DEFAULT '',
      quote_id TEXT NOT NULL DEFAULT '',
      billing_state TEXT NOT NULL DEFAULT 'held',
      delivery_state TEXT NOT NULL DEFAULT 'none',
      project_projection_state TEXT NOT NULL DEFAULT 'none',
      projection_state TEXT NOT NULL DEFAULT 'none',
      project_id TEXT NOT NULL DEFAULT '',
      source_version_id TEXT NOT NULL DEFAULT '',
      result_version_id TEXT NOT NULL DEFAULT '',
      reconciliation_error TEXT NOT NULL DEFAULT '',
      release_attempts INTEGER NOT NULL DEFAULT 0,
      review_deadline_ms INTEGER NOT NULL DEFAULT 0,
      review_attempts INTEGER NOT NULL DEFAULT 0,
      current_attempt_id TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      UNIQUE(owner_email, idempotency_key)
    );
    CREATE INDEX IF NOT EXISTS idx_video_jobs_owner ON video_jobs(owner_email, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_video_jobs_status ON video_jobs(status, updated_at);
    CREATE TABLE IF NOT EXISTS video_deliveries (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL UNIQUE,
      attempt_id TEXT NOT NULL DEFAULT '',
      provider_source TEXT NOT NULL DEFAULT '',
      file_name TEXT NOT NULL,
      content_type TEXT NOT NULL,
      bytes INTEGER NOT NULL,
      sha256 TEXT NOT NULL,
      verification_state TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );
    CREATE INDEX IF NOT EXISTS idx_video_deliveries_attempt ON video_deliveries(attempt_id);
  `);
  const assetColumns = new Set(db.prepare('PRAGMA table_info(video_assets)').all().map(column => column.name));
  if (!assetColumns.has('sha256')) db.exec("ALTER TABLE video_assets ADD COLUMN sha256 TEXT NOT NULL DEFAULT ''");
  const columns = new Set(db.prepare('PRAGMA table_info(video_jobs)').all().map(column => column.name));
  const migrations = [
    ['product_id', "TEXT NOT NULL DEFAULT 'seedance_standard'"],
    ['provider_route', "TEXT NOT NULL DEFAULT 'sd5-seedance-2.0'"],
    ['catalog_version', "TEXT NOT NULL DEFAULT 'legacy-seedance-v1'"],
    // Existing rows predate the live price sync and retain their historical snapshot.
    ['provider_cost_cny', 'REAL NOT NULL DEFAULT 4.355'],
    ['failure_class', "TEXT NOT NULL DEFAULT ''"],
    ['quote_id', "TEXT NOT NULL DEFAULT ''"],
    ['billing_state', "TEXT NOT NULL DEFAULT 'held'"],
    ['delivery_state', "TEXT NOT NULL DEFAULT 'none'"],
    ['project_projection_state', "TEXT NOT NULL DEFAULT 'none'"],
    ['projection_state', "TEXT NOT NULL DEFAULT 'none'"],
    ['project_id', "TEXT NOT NULL DEFAULT ''"],
    ['source_version_id', "TEXT NOT NULL DEFAULT ''"],
    ['result_version_id', "TEXT NOT NULL DEFAULT ''"],
    ['reconciliation_error', "TEXT NOT NULL DEFAULT ''"],
    ['release_attempts', 'INTEGER NOT NULL DEFAULT 0'],
    ['review_deadline_ms', 'INTEGER NOT NULL DEFAULT 0'],
    ['review_attempts', 'INTEGER NOT NULL DEFAULT 0'],
    ['current_attempt_id', "TEXT NOT NULL DEFAULT ''"],
  ];
  for (const [column, definition] of migrations) {
    if (!columns.has(column)) db.exec(`ALTER TABLE video_jobs ADD COLUMN ${column} ${definition}`);
  }
  db.prepare("UPDATE video_jobs SET billing_state = 'settled' WHERE status = 'completed' AND billing_state = 'held'").run();
  db.prepare("UPDATE video_jobs SET delivery_state = 'verified', project_projection_state = 'projected', projection_state = 'projected' WHERE status = 'completed'").run();

  const registry = providerRegistry || createVideoProviderRegistry({
    baseUrl,
    minimaxBaseUrl,
    credentials: {
      seedance: credentials?.seedance || apiKey || '',
      minimax: credentials?.minimax || minimaxApiKey || '',
    },
    fetchImpl,
  });
  const selectJob = db.prepare('SELECT * FROM video_jobs WHERE id = ?');
  const routeCapacities = Object.fromEntries(Object.values(VIDEO_PRODUCTS).map(product => [
    product.routeId,
    maxConcurrent === 0 ? 0 : Math.min(product.concurrency, Math.max(1, Number(maxConcurrent) || product.concurrency)),
  ]));
  const queue = createOwnerFairVideoQueue({ capacities: routeCapacities });
  const attemptStore = createVideoAttemptStore({ db });
  const outbox = createVideoOutbox({ db, now });
  const retryTimers = new Set();
  const circuitStates = new Map();
  let closed = false;
  const signingSecret = clean(assetSigningSecret, 500) || crypto.randomBytes(32).toString('base64url');

  function jobForOwner(ownerEmail, id) {
    return db.prepare('SELECT * FROM video_jobs WHERE id = ? AND owner_email = ?').get(id, ownerEmail);
  }

  function updateJob(id, values) {
    const entries = Object.entries(values);
    if (!entries.length) return selectJob.get(id);
    db.prepare(`UPDATE video_jobs SET ${entries.map(([key]) => `${key} = ?`).join(', ')}, updated_at = datetime('now', 'localtime') WHERE id = ?`)
      .run(...entries.map(([, value]) => value), id);
    return selectJob.get(id);
  }

  function nowMs() {
    const value = Number(now());
    return Number.isFinite(value) ? Math.trunc(value) : Date.now();
  }

  function circuitHistory(routeId) {
    return db.prepare(`SELECT id, status, failure_class FROM video_jobs
      WHERE provider_route = ? AND provider_task_id <> '' AND status IN ('completed', 'failed')
      ORDER BY updated_at DESC, rowid DESC LIMIT ?`).all(routeId, CIRCUIT_WINDOW);
  }

  function historySignature(rows) {
    return rows.map(row => `${row.id}:${row.status}:${row.failure_class}`).join('|');
  }

  function shouldOpenCircuit(rows) {
    if (rows.length < CIRCUIT_MIN_SAMPLES) return false;
    const failures = rows.filter(row => row.status === 'failed' && row.failure_class === 'provider').length;
    const consecutiveFailures = rows.slice(0, 3).length === 3
      && rows.slice(0, 3).every(row => row.status === 'failed' && row.failure_class === 'provider');
    return consecutiveFailures || failures / rows.length >= 0.5;
  }

  function circuitHealth(productId) {
    const product = getVideoProduct(productId);
    const provider = registry.get(product.id);
    if (!provider?.enabled) return { status: 'unavailable', reason: 'credential_missing' };
    const rows = circuitHistory(product.routeId);
    const signature = historySignature(rows);
    let state = circuitStates.get(product.routeId);
    if (state?.suppressedSignature === signature && !state.openedAt) {
      return { status: 'ready', reason: '' };
    }
    if (!state) {
      state = { openedAt: 0, halfOpenInFlight: false, suppressedSignature: '' };
      circuitStates.set(product.routeId, state);
    }
    if (!state.openedAt && shouldOpenCircuit(rows)) state.openedAt = nowMs();
    if (!state.openedAt) return { status: 'ready', reason: '' };
    if (nowMs() - state.openedAt < CIRCUIT_COOLDOWN_MS) {
      return { status: 'open', reason: 'provider_unhealthy', retryAt: state.openedAt + CIRCUIT_COOLDOWN_MS };
    }
    return { status: 'half_open', reason: 'provider_probe_required', probeInFlight: state.halfOpenInFlight };
  }

  function admitProduct(productId) {
    const product = getVideoProduct(productId);
    const health = circuitHealth(product.id);
    if (health.status === 'ready') return health;
    if (health.status === 'half_open') {
      const state = circuitStates.get(product.routeId);
      if (!state.halfOpenInFlight) {
        state.halfOpenInFlight = true;
        return { status: 'probe', reason: '' };
      }
    }
    throw httpError(503, 'VIDEO_PRODUCT_UNAVAILABLE', '该视频产品暂时不可用，请稍后再试', { retryable: true });
  }

  function releaseProductProbe(productId) {
    const product = getVideoProduct(productId);
    const state = circuitStates.get(product.routeId);
    if (state?.halfOpenInFlight) state.halfOpenInFlight = false;
  }

  function recordCircuitOutcome(job, success) {
    if (!job?.provider_route || !job?.provider_task_id) return;
    const state = circuitStates.get(job.provider_route);
    if (state?.halfOpenInFlight) {
      state.halfOpenInFlight = false;
      if (success) {
        state.openedAt = 0;
        state.suppressedSignature = historySignature(circuitHistory(job.provider_route));
      } else {
        state.openedAt = nowMs();
        state.suppressedSignature = '';
      }
      return;
    }
    if (!success && shouldOpenCircuit(circuitHistory(job.provider_route))) {
      const next = state || { halfOpenInFlight: false, suppressedSignature: '' };
      next.openedAt = nowMs();
      circuitStates.set(job.provider_route, next);
    }
  }

  function signedAssetPayload({ id, ownerEmail, purpose, expires }) {
    return [basename(clean(id, 140)), clean(ownerEmail, 320).toLowerCase(), clean(purpose, 40), String(expires)].join('\n');
  }

  function signAsset(input) {
    return crypto.createHmac('sha256', signingSecret).update(signedAssetPayload(input)).digest('base64url');
  }

  function signedAssetUrl(publicBaseUrl, id, ownerEmail, purpose = 'playback', ttlMs = 60 * 60 * 1000) {
    const normalizedOwner = clean(ownerEmail, 320).toLowerCase();
    const expires = nowMs() + Math.max(60_000, Number(ttlMs) || 0);
    const signature = signAsset({ id, ownerEmail: normalizedOwner, purpose, expires });
    const query = new URLSearchParams({ purpose, expires: String(expires), signature });
    const base = clean(publicBaseUrl, 500).replace(/\/+$/, '');
    return `${base}/api/video/media/${encodeURIComponent(id)}?${query}`;
  }

  function serializeOwnedJob(row) {
    if (!row) return null;
    const resultUrl = row.result_asset_id
      ? (ownerReads
        ? signedAssetUrl('', row.result_asset_id, row.owner_email, 'playback', 24 * 60 * 60 * 1000)
        : `/api/video/assets/${encodeURIComponent(row.result_asset_id)}`)
      : row.result_url || '';
    const projectAssetRef = projectBridge?.deliveryProjectAssetRef?.(row) || null;
    if (readNewState) return serializeJob(row, resultUrl, projectAssetRef);
    return serializeJob({
      ...row,
      billing_state: row.status === 'completed' ? 'settled' : row.billing_state,
      delivery_state: row.status === 'completed' ? 'verified' : 'none',
      project_projection_state: row.status === 'completed' ? 'projected' : 'none',
      projection_state: row.status === 'completed' ? 'projected' : 'none',
    }, resultUrl, projectAssetRef);
  }

  async function uploadAsset({ ownerEmail, kind, contentType, buffer, publicBaseUrl }) {
    if (!Object.hasOwn(INPUT_LIMITS, kind)) throw httpError(400, 'VIDEO_ASSET_KIND_INVALID', '素材类型不支持');
    const normalizedType = clean(contentType, 100).toLowerCase().split(';')[0];
    if (!CONTENT_TYPES[kind].has(normalizedType)) throw httpError(415, 'VIDEO_ASSET_TYPE_INVALID', '素材文件格式不支持');
    if (!Buffer.isBuffer(buffer) || !buffer.length || buffer.length > INPUT_LIMITS[kind]) {
      throw httpError(413, 'VIDEO_ASSET_SIZE_INVALID', '素材文件大小不符合要求');
    }
    const normalizedOwner = clean(ownerEmail, 320).toLowerCase();
    if (!normalizedOwner) throw httpError(401, 'VIDEO_ASSET_OWNER_REQUIRED', '登录已失效，请重新登录');
    const id = `${crypto.randomUUID()}${extensionFor(normalizedType)}`;
    const fileName = resolve(inputRoot, id);
    await writeFile(fileName, buffer, { flag: 'wx' });
    const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
    db.prepare('INSERT INTO video_assets (id, owner_email, kind, content_type, bytes, sha256, file_name) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(id, normalizedOwner, kind, normalizedType, buffer.length, sha256, basename(fileName));
    return {
      id,
      kind,
      contentType: normalizedType,
      bytes: buffer.length,
      sha256,
      url: ownerReads
        ? signedAssetUrl(publicBaseUrl, id, normalizedOwner, 'playback', 24 * 60 * 60 * 1000)
        : `/api/video/assets/${encodeURIComponent(id)}`,
    };
  }

  async function importUploadedAsset({ ownerEmail, kind, contentType, sourcePath, bytes, sha256, publicBaseUrl }) {
    if (!Object.hasOwn(INPUT_LIMITS, kind)) throw httpError(400, 'VIDEO_ASSET_KIND_INVALID', '素材类型不支持');
    const normalizedType = clean(contentType, 100).toLowerCase().split(';')[0];
    if (!CONTENT_TYPES[kind].has(normalizedType)) throw httpError(415, 'VIDEO_ASSET_TYPE_INVALID', '素材文件格式不支持');
    const normalizedOwner = clean(ownerEmail, 320).toLowerCase();
    if (!normalizedOwner) throw httpError(401, 'VIDEO_ASSET_OWNER_REQUIRED', '登录已失效，请重新登录');
    const size = Number(bytes);
    const sourceInfo = await stat(sourcePath);
    if (!Number.isSafeInteger(size) || size <= 0 || size > INPUT_LIMITS[kind] || sourceInfo.size !== size) {
      throw httpError(413, 'VIDEO_ASSET_SIZE_INVALID', '素材文件大小不符合要求');
    }
    const normalizedSha256 = clean(sha256, 64).toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(normalizedSha256)) throw httpError(422, 'VIDEO_ASSET_CHECKSUM_INVALID', '素材文件校验失败');
    const id = `${crypto.randomUUID()}${extensionFor(normalizedType)}`;
    const destination = resolve(inputRoot, id);
    try {
      try {
        await link(sourcePath, destination);
      } catch (error) {
        if (!['EXDEV', 'EPERM', 'EACCES'].includes(error?.code)) throw error;
        await copyFile(sourcePath, destination, fs.constants.COPYFILE_EXCL);
      }
      const handle = await fs.promises.open(destination, 'r+');
      try { await handle.sync(); } finally { await handle.close(); }
      db.prepare('INSERT INTO video_assets (id, owner_email, kind, content_type, bytes, sha256, file_name) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(id, normalizedOwner, kind, normalizedType, size, normalizedSha256, basename(destination));
      return {
        id,
        kind,
        contentType: normalizedType,
        bytes: size,
        sha256: normalizedSha256,
        url: ownerReads
          ? signedAssetUrl(publicBaseUrl, id, normalizedOwner, 'playback', 24 * 60 * 60 * 1000)
          : `/api/video/assets/${encodeURIComponent(id)}`,
      };
    } catch (error) {
      await fs.promises.rm(destination, { force: true }).catch(() => {});
      throw error;
    }
  }

  function normalizeReferences(ownerEmail, input, publicBaseUrl) {
    const references = input && typeof input === 'object' ? input : {};
    const ids = [references.firstImage, references.lastImage, ...(references.images || []), ...(references.videos || []), ...(references.audios || [])]
      .filter(Boolean)
      .map(value => clean(value, 100));
    if (ids.length > 12) throw httpError(400, 'VIDEO_REFERENCES_LIMIT', '参考素材总数不能超过 12 个');
    const rows = ids.length
      ? db.prepare(`SELECT * FROM video_assets WHERE owner_email = ? AND id IN (${ids.map(() => '?').join(',')})`).all(ownerEmail, ...ids)
      : [];
    const byId = new Map(rows.map(row => [row.id, row]));
    if (ids.some(id => !byId.has(id))) throw httpError(400, 'VIDEO_REFERENCE_NOT_FOUND', '参考素材不存在或不属于当前账号');
    const ensureKind = (id, kind) => {
      if (!id) return '';
      if (byId.get(id)?.kind !== kind) throw httpError(400, 'VIDEO_REFERENCE_KIND_INVALID', '参考素材类型不正确');
      return id;
    };
    const images = (references.images || []).map(id => ensureKind(clean(id, 100), 'image')).slice(0, 9);
    const videos = (references.videos || []).map(id => ensureKind(clean(id, 100), 'video')).slice(0, 3);
    const audios = (references.audios || []).map(id => ensureKind(clean(id, 100), 'audio')).slice(0, 3);
    if (videos.length + audios.length > 3) throw httpError(400, 'VIDEO_MEDIA_LIMIT', '参考视频和音频合计不能超过 3 个');
    return {
      firstImage: ensureKind(clean(references.firstImage, 100), 'image'),
      lastImage: ensureKind(clean(references.lastImage, 100), 'image'),
      images,
      videos,
      audios,
      urls: Object.fromEntries(rows.map(row => [
        row.id,
        signedAssetUrl(publicBaseUrl, row.id, ownerEmail, 'provider', 60 * 60 * 1000),
      ])),
    };
  }

  function providerForJob(job) {
    const provider = registry.get(job.product_id);
    if (!provider?.enabled || provider.routeId !== job.provider_route) {
      throw httpError(503, 'VIDEO_PROVIDER_NOT_CONFIGURED', '视频服务正在配置中', { retryable: true });
    }
    return provider;
  }

  async function persistOutput(job, response) {
    const contentType = clean(response.headers.get('content-type'), 100).split(';')[0] || 'video/mp4';
    if (!contentType.startsWith('video/')) throw httpError(502, 'VIDEO_OUTPUT_TYPE_INVALID', '上游没有交付有效视频');
    const declaredBytes = Number(response.headers.get('content-length') || 0);
    if (declaredBytes > OUTPUT_LIMIT) throw httpError(502, 'VIDEO_OUTPUT_SIZE_INVALID', '上游视频文件过大');
    if (!response.body) throw httpError(502, 'VIDEO_OUTPUT_BODY_MISSING', '上游没有交付视频文件');
    const id = `${crypto.randomUUID()}${extensionFor(contentType) || '.mp4'}`;
    const tempPath = resolve(outputRoot, `.${id}.tmp`);
    const finalPath = resolve(outputRoot, id);
    const hash = crypto.createHash('sha256');
    let bytes = 0;
    let renamed = false;
    const meter = new Transform({
      transform(chunk, _encoding, callback) {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        bytes += buffer.length;
        if (bytes > OUTPUT_LIMIT) return callback(httpError(502, 'VIDEO_OUTPUT_SIZE_INVALID', '上游视频文件过大'));
        hash.update(buffer);
        return callback(null, buffer);
      },
    });
    try {
      await pipeline(Readable.fromWeb(response.body), meter, fs.createWriteStream(tempPath, { flags: 'wx' }));
      if (!bytes || (declaredBytes > 0 && declaredBytes !== bytes)) {
        throw httpError(502, 'VIDEO_OUTPUT_TRUNCATED', '上游视频文件不完整');
      }
      const sha256 = hash.digest('hex');
      const expectedSha256 = clean(response.headers.get('x-content-sha256'), 100).toLowerCase();
      if (expectedSha256 && expectedSha256 !== sha256) {
        throw httpError(502, 'VIDEO_OUTPUT_CHECKSUM_INVALID', '上游视频文件校验失败');
      }
      const handle = await fs.promises.open(tempPath, 'r+');
      try { await handle.sync(); } finally { await handle.close(); }
      await rename(tempPath, finalPath);
      renamed = true;
      db.transaction(() => {
        db.prepare('INSERT INTO video_assets (id, owner_email, kind, content_type, bytes, sha256, file_name) VALUES (?, ?, ?, ?, ?, ?, ?)')
          .run(id, job.owner_email, 'output', contentType, bytes, sha256, basename(finalPath));
        db.prepare(`INSERT INTO video_deliveries (
          id, job_id, attempt_id, provider_source, file_name, content_type, bytes, sha256, verification_state
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'verified')`).run(
          id,
          job.id,
          job.current_attempt_id || '',
          job.provider_task_id || '',
          basename(finalPath),
          contentType,
          bytes,
          sha256,
        );
      })();
      return { id, contentType, bytes, sha256, url: `/api/video/assets/${id}` };
    } catch (error) {
      await fs.promises.rm(renamed ? finalPath : tempPath, { force: true }).catch(() => {});
      throw error;
    }
  }

  function verifiedDeliveryForJob(job) {
    const delivery = db.prepare("SELECT * FROM video_deliveries WHERE job_id = ? AND verification_state = 'verified'").get(job.id);
    if (!delivery) return null;
    const asset = db.prepare('SELECT id FROM video_assets WHERE id = ? AND owner_email = ?').get(delivery.id, job.owner_email);
    if (!asset) return null;
    return {
      id: delivery.id,
      contentType: delivery.content_type,
      bytes: Number(delivery.bytes),
      sha256: delivery.sha256,
      url: `/api/video/assets/${delivery.id}`,
    };
  }

  async function complete(job, output) {
    const deliveredJob = db.transaction(() => {
      const updated = updateJob(job.id, {
        status: 'reconciling',
        progress: 99,
        result_asset_id: output.id,
        result_url: output.url,
        error: '成片已交付，正在确认积分结算',
        failure_class: '',
        billing_state: 'settlement_pending',
        delivery_state: 'verified',
        project_projection_state: projectBridge ? 'pending' : 'projected',
        projection_state: 'pending',
        reconciliation_error: '',
      });
      ensureVideoEvent(updated, 'video.billing.settle.requested', 'billing-settle');
      return updated;
    })();
    recordCircuitOutcome(deliveredJob, true);
    drainVideoOutbox();
  }

  function upsertCompletedVideoWork(job, settlement) {
    const projectAssetRef = projectBridge?.deliveryProjectAssetRef?.(job) || null;
    upsertWork({
      _saveKey: `video:${job.id}`,
      _phone: job.owner_email,
      title: clean(job.prompt, 42) || 'AI 视频作品',
      category: 'AI视频',
      cover_url: '',
      image_urls: [],
      image_count: 0,
      _videoResult: true,
      workType: 'video',
      generationType: 'video',
      video_url: job.result_url,
      video: {
        url: job.result_url,
        duration: job.duration,
        aspectRatio: job.aspect_ratio,
        resolution: job.resolution,
        generateAudio: job.generate_audio === 1,
        productId: job.product_id,
        ...(projectAssetRef ? { projectAssetRef } : {}),
      },
      projectId: job.project_id || projectAssetRef?.projectId || '',
      projectAssetRefs: projectAssetRef ? [projectAssetRef] : [],
      billing: { status: settlement.status, currency: 'ec_points' },
    }, { ownerEmail: job.owner_email });
  }

  function ensureVideoEvent(job, eventType, suffix) {
    return outbox.ensure({
      id: `video:${job.id}:${suffix}`,
      aggregateId: job.id,
      eventType,
      payload: { jobId: job.id },
    });
  }

  function processVideoEvent(event) {
    const job = selectJob.get(event.aggregate_id);
    if (!job) {
      outbox.complete(event.id);
      return;
    }
    if (event.event_type === 'video.billing.settle.requested') {
      walletService.settleItem(job.hold_id, 'video', {
        referenceType: 'video_generation',
        referenceId: job.result_asset_id,
        providerCostCny: Number(job.provider_cost_cny),
        idempotencyKey: `video-settle:${job.id}`,
        metadata: {
          taskId: job.id,
          productId: job.product_id,
          providerRoute: job.provider_route,
          catalogVersion: job.catalog_version,
          resolution: job.resolution,
          duration: job.duration,
        },
      });
      db.transaction(() => {
        const settledJob = updateJob(job.id, {
          status: 'reconciling',
          progress: 99,
          error: '成片已交付，正在同步作品库',
          billing_state: 'settled',
          reconciliation_error: '',
        });
        outbox.complete(event.id);
        ensureVideoEvent(
          settledJob,
          projectBridge ? 'video.project.project.requested' : 'video.works.project.requested',
          projectBridge ? 'project-project' : 'works-project',
        );
      })();
      return;
    }
    if (event.event_type === 'video.project.project.requested') {
      const projected = projectBridge.projectDelivery(job);
      db.transaction(() => {
        const projectedJob = updateJob(job.id, {
          status: 'reconciling',
          progress: 99,
          error: '成片已交付，正在同步作品库',
          project_projection_state: 'projected',
          project_id: projected.project.id,
          source_version_id: projected.sourceVersion.id,
          result_version_id: projected.resultVersion.id,
          reconciliation_error: '',
        });
        outbox.complete(event.id);
        ensureVideoEvent(projectedJob, 'video.works.project.requested', 'works-project');
      })();
      return;
    }
    if (event.event_type === 'video.works.project.requested') {
      upsertCompletedVideoWork(job, { status: 'settled' });
      db.transaction(() => {
        const projectedJob = updateJob(job.id, {
          status: 'reconciling',
          progress: 99,
          error: '成片已交付，正在完成任务记录',
          projection_state: 'projected',
          reconciliation_error: '',
        });
        outbox.complete(event.id);
        ensureVideoEvent(projectedJob, 'video.job.finalize.requested', 'finalize');
      })();
      return;
    }
    if (event.event_type === 'video.job.finalize.requested') {
      if (job.delivery_state !== 'verified' || job.billing_state !== 'settled'
        || job.project_projection_state !== 'projected' || job.projection_state !== 'projected') {
        throw new Error('video finalization prerequisites are incomplete');
      }
      db.transaction(() => {
        updateJob(job.id, {
          status: 'completed',
          progress: 100,
          error: '',
          reconciliation_error: '',
        });
        outbox.complete(event.id);
      })();
      return;
    }
    outbox.complete(event.id);
  }

  function drainVideoOutbox({ force = false, limit = 100 } = {}) {
    const processed = new Set();
    const boundedLimit = Math.max(1, Math.min(200, Number(limit) || 100));
    while (processed.size < boundedLimit) {
      const event = outbox.pending(boundedLimit, { force }).find(candidate => !processed.has(candidate.id));
      if (!event) break;
      processed.add(event.id);
      const claimed = outbox.processing(event.id, `video-${process.pid}`);
      if (claimed?.state !== 'processing') continue;
      try {
        processVideoEvent(claimed);
      } catch (error) {
        const job = selectJob.get(claimed.aggregate_id);
        if (job) {
          const settlementPending = claimed.event_type === 'video.billing.settle.requested';
          const projectPending = claimed.event_type === 'video.project.project.requested';
          updateJob(job.id, {
            status: 'reconciling',
            progress: 99,
            error: settlementPending
              ? '成片已交付，积分结算确认中'
              : projectPending ? '成片已交付，项目记录同步中' : '成片已交付，作品库同步中',
            billing_state: settlementPending ? 'settlement_pending' : job.billing_state,
            project_projection_state: projectPending ? 'pending' : job.project_projection_state,
            projection_state: settlementPending ? job.projection_state : 'pending',
            reconciliation_error: clean(error?.message, 500) || 'video outbox delivery failed',
          });
        }
        outbox.fail(claimed.id, error, 5_000);
      }
    }
  }

  function releaseHeldJob(job, error) {
    const failureClass = job.failure_class || (isVideoProviderFailure(error) ? 'provider' : 'delivery');
    try {
      walletService.releaseItem(job.hold_id, 'video', {
        reason: `video_failed:${clean(error?.code || error?.message, 100) || 'unknown'}`,
        idempotencyKey: `video-release:${job.id}`,
        metadata: { taskId: job.id, productId: job.product_id, providerRoute: job.provider_route },
      });
      return updateJob(job.id, {
        status: 'failed',
        error: '本次没有交付成片，冻结积分已退回',
        progress: 0,
        failure_class: failureClass,
        billing_state: 'released',
        reconciliation_error: '',
        release_attempts: Number(job.release_attempts || 0) + 1,
      });
    } catch (releaseError) {
      return updateJob(job.id, {
        status: 'reconciling',
        error: '本次没有交付成片，冻结积分退回处理中',
        progress: 0,
        failure_class: failureClass,
        billing_state: 'release_pending',
        reconciliation_error: clean(releaseError?.message, 500) || 'credit release failed',
        release_attempts: Number(job.release_attempts || 0) + 1,
      });
    }
  }

  async function fail(job, error) {
    const failedJob = releaseHeldJob(job, error);
    recordCircuitOutcome(failedJob, false);
  }

  function markSubmissionUnknown(job, message = '') {
    if (job.current_attempt_id && attemptStore.get(job.current_attempt_id)?.state === 'submitting') {
      attemptStore.markUncertain(job.current_attempt_id, { message: clean(message, 500) || 'submission result is unknown' });
    }
    return updateJob(job.id, {
      status: 'needs_review',
      error: clean(message, 500) || '上游受理结果待自动核对，核对期间不会重复提交或结算积分',
      failure_class: 'submission_unknown',
      billing_state: 'held',
      reconciliation_error: '',
      review_deadline_ms: nowMs() + SUBMISSION_REVIEW_TTL_MS,
      review_attempts: Number(job.review_attempts || 0) + 1,
    });
  }

  function reconcileBilling(input = {}) {
    const limit = Math.max(1, Math.min(200, Number(input?.limit) || 50));
    const rows = db.prepare("SELECT * FROM video_jobs WHERE billing_state IN ('release_pending','settlement_pending') ORDER BY updated_at, rowid LIMIT ?").all(limit);
    const summary = { checked: rows.length, released: 0, settled: 0, pending: 0, expiredReviews: 0 };
    for (const row of rows) {
      if (row.billing_state === 'settlement_pending') {
        ensureVideoEvent(row, 'video.billing.settle.requested', 'billing-settle');
      } else {
        const reconciled = releaseHeldJob(row, { code: row.failure_class || 'billing_reconciliation' });
        if (reconciled.billing_state === 'released') summary.released += 1;
        else summary.pending += 1;
      }
    }
    drainVideoOutbox({ force: input?.force !== false, limit });
    for (const row of rows.filter(candidate => candidate.billing_state === 'settlement_pending')) {
      const reconciled = selectJob.get(row.id);
      if (reconciled?.billing_state === 'settled') summary.settled += 1;
      else summary.pending += 1;
    }
    const expiredReviews = db.prepare(`SELECT * FROM video_jobs
      WHERE status = 'needs_review' AND failure_class = 'submission_unknown'
        AND review_deadline_ms > 0 AND review_deadline_ms <= ?
      ORDER BY review_deadline_ms, rowid LIMIT ?`).all(nowMs(), limit);
    summary.checked += expiredReviews.length;
    for (const row of expiredReviews) {
      if (row.current_attempt_id) attemptStore.markFailed(row.current_attempt_id, { code: 'VIDEO_SUBMISSION_REVIEW_EXPIRED' });
      const released = releaseHeldJob(row, { code: 'VIDEO_SUBMISSION_REVIEW_EXPIRED' });
      summary.expiredReviews += 1;
      if (released.billing_state === 'released') summary.released += 1;
      else summary.pending += 1;
    }
    return summary;
  }

  async function processJob(id) {
    let job = selectJob.get(id);
    if (!job || FINAL_STATUSES.has(job.status)) return;
    if (closed) return;
    let provider;
    try {
      provider = providerForJob(job);
      if (!job.provider_task_id) {
        if (job.status === 'submitting') {
          markSubmissionUnknown(job);
          return;
        }
        const providerPayload = buildProviderPayload({
          product: getVideoProduct(job.product_id),
          job,
        }).body;
        const attempt = attemptStore.begin({
          jobId: job.id,
          submissionKey: (() => {
            const next = Number(db.prepare('SELECT COALESCE(MAX(attempt_number), 0) + 1 AS value FROM video_job_attempts WHERE job_id = ?').get(job.id)?.value || 1);
            return next === 1 ? job.id : `${job.id}:retry:${next}`;
          })(),
          payload: providerPayload,
          provider: provider.protocol || job.provider_route,
          model: provider.model || job.provider_route,
          capability: {
            productId: job.product_id,
            mode: job.mode,
            duration: job.duration,
            resolution: job.resolution,
            aspectRatio: job.aspect_ratio,
          },
        });
        updateJob(id, { status: 'submitting', error: '', current_attempt_id: attempt.id });
        const submitted = await provider.submit(providerPayload, attempt.submission_key);
        attemptStore.markAccepted(attempt.id, submitted.id);
        job = updateJob(id, {
          status: 'processing',
          provider_task_id: clean(submitted.id, 200),
          progress: Math.max(0, Math.min(99, Number(submitted.progress) || 0)),
        });
      }
      let transientFailures = 0;
      const recoveredDelivery = verifiedDeliveryForJob(job);
      if (recoveredDelivery) {
        if (job.current_attempt_id) attemptStore.markDelivered(job.current_attempt_id);
        await complete(job, recoveredDelivery);
        return;
      }
      const product = getVideoProduct(job.product_id);
      const interval = Math.max(1, Number(pollIntervalMs || product.pollIntervalMs) || product.pollIntervalMs);
      for (let attempt = 0; attempt < 1440 && !closed; attempt += 1) {
        let result;
        try {
          result = await provider.get(job.provider_task_id);
          transientFailures = 0;
        } catch (error) {
          if (!error?.retryable || transientFailures >= 20) throw error;
          transientFailures += 1;
          await new Promise(resolveDelay => setTimeout(resolveDelay, interval));
          continue;
        }
        const status = clean(result.status, 40).toLowerCase();
        const progress = Math.max(job.progress || 0, Math.min(99, Number(result.progress) || 0));
        updateJob(id, { status: 'processing', progress });
        if (status === 'completed') {
          const output = await persistOutput(job, await provider.download(job.provider_task_id, result));
          if (job.current_attempt_id) attemptStore.markDelivered(job.current_attempt_id);
          await complete(job, output);
          return;
        }
        if (['failed', 'cancelled', 'canceled', 'error'].includes(status)) {
          throw httpError(502, 'VIDEO_PROVIDER_FAILED', '上游未能生成视频');
        }
        await new Promise(resolveDelay => setTimeout(resolveDelay, interval));
      }
      if (closed) return;
      throw httpError(504, 'VIDEO_PROVIDER_TIMEOUT', '视频任务仍未完成', { retryable: true });
    } catch (error) {
      job = selectJob.get(id) || job;
      if (error?.retryable && job.provider_task_id) {
        updateJob(id, { status: 'processing', error: '上游连接波动，正在自动继续确认' });
        const timer = setTimeout(() => {
          retryTimers.delete(timer);
          enqueue(id);
        }, 15_000);
        timer.unref?.();
        retryTimers.add(timer);
        return;
      }
      if (error?.code === 'VIDEO_PROVIDER_UNREACHABLE' && !job.provider_task_id) {
        if (job.current_attempt_id) attemptStore.markUncertain(job.current_attempt_id, error);
        markSubmissionUnknown(job);
        return;
      }
      if (job.current_attempt_id) attemptStore.markFailed(job.current_attempt_id, error);
      await fail(job, error);
    }
  }

  function enqueue(id) {
    const job = selectJob.get(id);
    if (!job || FINAL_STATUSES.has(job.status)) return false;
    return queue.enqueue({
      routeId: job.provider_route,
      ownerEmail: job.owner_email,
      jobId: id,
      task: () => processJob(id),
    });
  }

  async function createJob({ ownerEmail, idempotencyKey, billingQuoteId, publicBaseUrl, input }) {
    ownerEmail = clean(ownerEmail, 320).toLowerCase();
    if (!ownerEmail) throw httpError(401, 'VIDEO_OWNER_REQUIRED', '登录已失效，请重新登录');
    const requestKey = clean(idempotencyKey, 120);
    if (!requestKey) throw httpError(400, 'VIDEO_IDEMPOTENCY_REQUIRED', '缺少防重复提交标识');
    const replay = db.prepare('SELECT * FROM video_jobs WHERE owner_email = ? AND idempotency_key = ?').get(ownerEmail, requestKey);
    if (replay) return { job: serializeOwnedJob(replay), replay: true };
    const activeCount = db.prepare("SELECT COUNT(*) AS count FROM video_jobs WHERE owner_email = ? AND status IN ('queued','submitting','processing')").get(ownerEmail).count;
    if (activeCount >= 2) throw httpError(429, 'VIDEO_USER_CONCURRENCY_LIMIT', '同一账号最多同时处理 2 个视频任务');

    const productId = clean(input?.productId || DEFAULT_VIDEO_PRODUCT_ID, 80);
    let product;
    try { product = getVideoProduct(productId); } catch (error) {
      throw httpError(400, 'VIDEO_PRODUCT_INVALID', error.message);
    }
    if (!product.public && !allowHiddenProducts) {
      throw httpError(400, 'VIDEO_PRODUCT_UNAVAILABLE', '该视频产品暂未开放');
    }
    if (!registry.get(product.id)?.enabled) {
      throw httpError(503, 'VIDEO_PROVIDER_NOT_CONFIGURED', '视频服务正在配置中');
    }
    const prompt = clean(input?.prompt, 7000);
    const negativePrompt = clean(input?.negativePrompt, 1200);
    const duration = Number(input?.duration);
    const resolution = clean(input?.resolution, 20).toLowerCase();
    const aspectRatio = clean(input?.aspectRatio, 20);
    const mode = ['script', 'frame', 'reference', 'remake'].includes(input?.mode) ? input.mode : 'script';
    const seed = Number.isSafeInteger(Number(input?.seed)) ? Number(input.seed) : 0;
    if (!prompt) throw httpError(400, 'VIDEO_PROMPT_REQUIRED', '请输入视频内容');
    try {
      validateVideoProductInput({
        productId: product.id,
        duration,
        mode,
        resolution,
        generateAudio: input?.generateAudio !== false,
      });
    } catch (error) {
      throw httpError(400, 'VIDEO_PRODUCT_INPUT_INVALID', error.message);
    }
    if (!RATIOS.has(aspectRatio)) throw httpError(400, 'VIDEO_FORMAT_INVALID', '视频规格不支持');
    const references = normalizeReferences(ownerEmail, input?.references, publicBaseUrl);
    if (mode === 'frame' && (!references.firstImage || !references.lastImage)) throw httpError(400, 'VIDEO_FRAME_REQUIRED', '首尾帧模式需要两张图片');
    if (mode === 'reference' && !references.images.length && !references.videos.length) {
      throw httpError(400, 'VIDEO_VISUAL_REFERENCE_REQUIRED', references.audios.length
        ? '音频不能单独生成视频，请补充图片或视频素材'
        : '多模态参考至少需要一个图片或视频素材');
    }
    if (mode === 'remake' && !references.images.length) throw httpError(400, 'VIDEO_REFERENCE_IMAGE_REQUIRED', '爆款重构至少需要一张商品图片');
    if (mode === 'remake' && !references.videos.length) throw httpError(400, 'VIDEO_REMAKE_SOURCE_REQUIRED', '爆款重构需要一个参考视频');
    const targetProjectId = clean(input?.projectId, 140);
    if (targetProjectId) {
      if (!projectBridge?.validateTarget) throw httpError(409, 'VIDEO_PROJECT_TARGET_UNAVAILABLE', '视频项目工作台暂时不可用');
      try {
        projectBridge.validateTarget({ ownerEmail, projectId: targetProjectId });
      } catch (error) {
        if (error?.code === 'PROJECT_NOT_FOUND') throw httpError(404, error.code, '未找到该视频项目');
        if (error?.code === 'VIDEO_PROJECT_KIND_INVALID') throw httpError(400, error.code, '只能把视频任务加入视频项目');
        if (error?.code === 'VIDEO_PROJECT_COMPLETED') throw httpError(409, error.code, '已交付项目不能继续加入生成任务');
        throw error;
      }
    }

    const workbenchPlanHash = clean(input?.workbenchPlanHash, 128);
    if (workbenchPlanHash) {
      if (!targetProjectId || typeof validateWorkbenchPlanApproval !== 'function') {
        throw httpError(409, 'VIDEO_PLAN_APPROVAL_REQUIRED', '生成计划已变化，请重新检查并确认后再生成');
      }
      let approved = false;
      try {
        approved = await validateWorkbenchPlanApproval({
          ownerEmail,
          projectId: targetProjectId,
          planHash: workbenchPlanHash,
          input,
        });
      } catch {
        approved = false;
      }
      if (approved !== true && approved?.ok !== true) {
        throw httpError(409, 'VIDEO_PLAN_APPROVAL_REQUIRED', '生成计划已变化，请重新检查并确认后再生成');
      }
    }

    const sku = videoFeatureSku({ productId: product.id, duration });
    const expectedQuote = quoteFeature(sku, 1);
    const verified = quoteService.verify({ quoteId: clean(billingQuoteId, 5000), ownerEmail, expectedQuote });
    const id = crypto.randomUUID();
    const admission = admitProduct(product.id);
    let hold;
    let jobPersisted = false;
    try {
      try {
        hold = walletService.createHold({
          ownerEmail,
          currency: verified.currency,
          quoteId: verified.quoteId,
          idempotencyKey: `video-hold:${id}`,
          expiresAt: verified.expiresAt,
          items: [{ key: 'video', sku, units: expectedQuote.units }],
          metadata: {
            source: 'video_generation',
            taskId: id,
            projectId: targetProjectId || undefined,
            productId: product.id,
            providerRoute: product.routeId,
            catalogVersion: VIDEO_CATALOG_VERSION,
          },
        });
      } catch (error) {
        if (error?.code === 'BILLING_INSUFFICIENT_CREDITS') {
          const balance = walletService.getBalance(ownerEmail, expectedQuote.currency);
          throw httpError(402, error.code, 'AI 积分不足，请购买套餐后继续', {
            required: expectedQuote.totalUnits,
            available: balance.unlimited ? expectedQuote.totalUnits : balance.availableUnits,
          });
        }
        throw error;
      }
      db.prepare(`INSERT INTO video_jobs (
        id, owner_email, idempotency_key, status, mode, sku, prompt, negative_prompt,
        duration, aspect_ratio, resolution, generate_audio, seed, refs_json, hold_id,
        product_id, provider_route, catalog_version, provider_cost_cny, failure_class, quote_id
      ) VALUES (?, ?, ?, 'queued', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
        id, ownerEmail, requestKey, mode, sku, prompt, negativePrompt, duration, aspectRatio,
        resolution, input?.generateAudio === false ? 0 : 1, seed, JSON.stringify(references), hold.id,
        product.id, product.routeId, VIDEO_CATALOG_VERSION, expectedQuote.providerCostCny, '', verified.quoteId,
      );
      jobPersisted = true;
      if (projectBridge) {
        const draft = projectBridge.ensureDraft(selectJob.get(id), { projectId: targetProjectId });
        updateJob(id, {
          project_projection_state: 'pending',
          project_id: draft.project.id,
          source_version_id: draft.sourceVersion.id,
        });
      } else {
        updateJob(id, { project_projection_state: 'projected' });
      }
    } catch (error) {
      if (admission.status === 'probe') releaseProductProbe(product.id);
      if (hold) {
        try {
          walletService.releaseItem(hold.id, 'video', {
            reason: 'video_create_persist_failed',
            idempotencyKey: `video-release:${id}`,
            metadata: { taskId: id, productId: product.id, providerRoute: product.routeId },
          });
        } catch {}
      }
      if (jobPersisted) db.prepare('DELETE FROM video_jobs WHERE id = ? AND provider_task_id = ?').run(id, '');
      throw error;
    }
    if (!enqueue(id)) {
      if (admission.status === 'probe') releaseProductProbe(product.id);
      releaseHeldJob(selectJob.get(id), { code: 'VIDEO_QUEUE_UNAVAILABLE' });
      throw httpError(503, 'VIDEO_QUEUE_UNAVAILABLE', '视频队列暂时不可用，请稍后重试', { retryable: true });
    }
    return { job: serializeOwnedJob(selectJob.get(id)), replay: false };
  }

  async function readAsset(id, ownerEmail) {
    const safeId = basename(clean(id, 140));
    const normalizedOwner = clean(ownerEmail, 320).toLowerCase();
    if (!safeId || !normalizedOwner) return null;
    const row = db.prepare('SELECT * FROM video_assets WHERE id = ? AND owner_email = ?').get(safeId, normalizedOwner);
    if (!row) return null;
    const folder = row.kind === 'output' ? outputRoot : inputRoot;
    const filePath = resolve(folder, row.file_name);
    try {
      const info = await stat(filePath);
      return { row, filePath, size: info.size, mtimeMs: info.mtimeMs };
    } catch { return null; }
  }

  async function readSignedAsset({ id, purpose, expires, signature }) {
    const safeId = basename(clean(id, 140));
    const normalizedPurpose = clean(purpose, 40);
    const expiresAt = Number(expires);
    const provided = clean(signature, 200);
    if (!safeId || !['playback', 'provider'].includes(normalizedPurpose)) return null;
    if (!Number.isSafeInteger(expiresAt) || expiresAt <= nowMs() || !provided) return null;
    const row = db.prepare('SELECT owner_email FROM video_assets WHERE id = ?').get(safeId);
    if (!row) return null;
    const expected = signAsset({ id: safeId, ownerEmail: row.owner_email, purpose: normalizedPurpose, expires: expiresAt });
    const expectedBuffer = Buffer.from(expected);
    const providedBuffer = Buffer.from(provided);
    if (expectedBuffer.length !== providedBuffer.length || !crypto.timingSafeEqual(expectedBuffer, providedBuffer)) return null;
    return readAsset(safeId, row.owner_email);
  }

  function playbackUrlForAsset(id, ownerEmail, publicBaseUrl = '') {
    const safeId = basename(clean(id, 140));
    const normalizedOwner = clean(ownerEmail, 320).toLowerCase();
    if (!safeId || !normalizedOwner) return '';
    const owned = db.prepare('SELECT 1 FROM video_assets WHERE id = ? AND owner_email = ?').get(safeId, normalizedOwner);
    return owned ? signedAssetUrl(publicBaseUrl, safeId, normalizedOwner, 'playback', 24 * 60 * 60 * 1000) : '';
  }

  function listSubmissionReviews(limit = 50) {
    return db.prepare(`SELECT * FROM video_jobs
      WHERE status = 'needs_review' AND failure_class = 'submission_unknown'
      ORDER BY review_deadline_ms, created_at LIMIT ?`)
      .all(Math.max(1, Math.min(200, Number(limit) || 50)))
      .map(serializeOwnedJob);
  }

  function resolveSubmissionReview(jobId, providerTaskId) {
    const job = selectJob.get(clean(jobId, 140));
    const taskId = clean(providerTaskId, 200);
    if (!job || job.status !== 'needs_review' || job.failure_class !== 'submission_unknown') {
      throw httpError(409, 'VIDEO_REVIEW_NOT_PENDING', '该视频任务不在待核对状态');
    }
    if (!taskId) throw httpError(400, 'VIDEO_PROVIDER_TASK_REQUIRED', '缺少上游任务 ID');
    if (job.current_attempt_id) attemptStore.attachProviderTask(job.current_attempt_id, taskId);
    const resolved = updateJob(job.id, {
      status: 'processing',
      provider_task_id: taskId,
      error: '已确认上游任务，正在继续获取生成结果',
      failure_class: '',
      review_deadline_ms: 0,
    });
    enqueue(job.id);
    return serializeOwnedJob(resolved);
  }

  function rejectSubmissionReview(jobId) {
    const job = selectJob.get(clean(jobId, 140));
    if (!job || job.status !== 'needs_review' || job.failure_class !== 'submission_unknown') {
      throw httpError(409, 'VIDEO_REVIEW_NOT_PENDING', '该视频任务不在待核对状态');
    }
    if (job.current_attempt_id) attemptStore.markFailed(job.current_attempt_id, { code: 'VIDEO_SUBMISSION_REVIEW_REJECTED' });
    return serializeOwnedJob(releaseHeldJob(job, { code: 'VIDEO_SUBMISSION_REVIEW_REJECTED' }));
  }

  function recheckJob(jobId) {
    const job = selectJob.get(clean(jobId, 140));
    if (!job) throw httpError(404, 'VIDEO_JOB_NOT_FOUND', '视频任务不存在');
    if (FINAL_STATUSES.has(job.status)) throw httpError(409, 'VIDEO_OPERATION_STATE_INVALID', '已结束任务不需要重新核对');
    if (job.provider_task_id) {
      updateJob(job.id, { status: 'processing', failure_class: '', error: '正在重新核对上游结果' });
      enqueue(job.id);
    } else if (job.status === 'queued') {
      enqueue(job.id);
    } else {
      markSubmissionUnknown(job, '尚未取得上游任务 ID，已延长人工核对期；不会自动重复提交');
    }
    return serializeOwnedJob(selectJob.get(job.id));
  }

  function confirmNotSubmitted(jobId, input = {}) {
    const job = selectJob.get(clean(jobId, 140));
    if (!job || job.status !== 'needs_review' || !['submission_unknown', 'manual_quarantine'].includes(job.failure_class)) {
      throw httpError(409, 'VIDEO_OPERATION_STATE_INVALID', '只有待核对且尚无上游任务 ID 的任务可以确认未受理');
    }
    if (job.provider_task_id) throw httpError(409, 'VIDEO_PROVIDER_TASK_EXISTS', '任务已有上游任务 ID，不能标记为未受理');
    if (job.current_attempt_id) attemptStore.markNotSubmitted(job.current_attempt_id, input.reason);
    return serializeOwnedJob(updateJob(job.id, {
      status: 'needs_review',
      failure_class: 'confirmed_not_submitted',
      error: '已确认上游未受理，可安全重新提交',
      review_deadline_ms: 0,
    }));
  }

  function retryConfirmedNotSubmitted(jobId) {
    const job = selectJob.get(clean(jobId, 140));
    if (!job || job.status !== 'needs_review' || job.failure_class !== 'confirmed_not_submitted'
      || job.provider_task_id || job.billing_state !== 'held') {
      throw httpError(409, 'VIDEO_OPERATION_STATE_INVALID', '任务尚未确认“上游未受理”，不能安全重试');
    }
    const queued = updateJob(job.id, {
      status: 'queued',
      failure_class: '',
      error: '',
      current_attempt_id: '',
      review_deadline_ms: 0,
    });
    if (!enqueue(job.id)) throw httpError(503, 'VIDEO_QUEUE_UNAVAILABLE', '视频队列暂时不可用，请稍后再试');
    return serializeOwnedJob(queued);
  }

  function quarantineJob(jobId, input = {}) {
    const job = selectJob.get(clean(jobId, 140));
    if (!job) throw httpError(404, 'VIDEO_JOB_NOT_FOUND', '视频任务不存在');
    if (FINAL_STATUSES.has(job.status) || job.provider_task_id || job.billing_state !== 'held') {
      throw httpError(409, 'VIDEO_OPERATION_STATE_INVALID', '该任务已被上游受理或已经结束，不能隔离');
    }
    return serializeOwnedJob(updateJob(job.id, {
      status: 'needs_review',
      failure_class: 'manual_quarantine',
      error: clean(input.reason, 500) || '任务已被管理员隔离，等待人工核对',
      review_deadline_ms: 0,
    }));
  }

  function replayProjection(jobId) {
    const job = selectJob.get(clean(jobId, 140));
    if (!job) throw httpError(404, 'VIDEO_JOB_NOT_FOUND', '视频任务不存在');
    if (job.delivery_state !== 'verified' || job.billing_state !== 'settled') {
      throw httpError(409, 'VIDEO_OPERATION_STATE_INVALID', '只有已验证交付且已结算的任务可以重放作品投影');
    }
    let eventType = 'video.job.finalize.requested';
    let suffix = 'finalize';
    if (projectBridge && job.project_projection_state !== 'projected') {
      eventType = 'video.project.project.requested';
      suffix = 'project-project';
    } else if (job.projection_state !== 'projected') {
      eventType = 'video.works.project.requested';
      suffix = 'works-project';
    }
    const eventId = `video:${job.id}:${suffix}`;
    ensureVideoEvent(job, eventType, suffix);
    db.prepare(`UPDATE video_outbox SET state = 'pending', lock_owner = '', next_attempt_ms = 0,
      last_error = '', updated_at = datetime('now', 'localtime') WHERE id = ?`).run(eventId);
    updateJob(job.id, { status: 'reconciling', reconciliation_error: '', error: '正在重新同步作品记录' });
    drainVideoOutbox({ force: true, limit: 10 });
    return serializeOwnedJob(selectJob.get(job.id));
  }

  function reconcileOperations(input = {}) {
    const limit = Math.max(1, Math.min(200, Number(input.limit) || 50));
    const billing = reconcileBilling({ limit, force: input.force === true });
    const staleBefore = new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    }).format(new Date(nowMs() - 15 * 60_000));
    const stale = db.prepare(`SELECT * FROM video_jobs
      WHERE status IN ('queued','submitting','processing') AND datetime(updated_at) <= datetime(?)
      ORDER BY updated_at, rowid LIMIT ?`).all(staleBefore, limit);
    let resumed = 0;
    let reviewed = 0;
    for (const row of stale) {
      if (row.status === 'submitting' && !row.provider_task_id) {
        markSubmissionUnknown(row, '任务提交状态超过 15 分钟未确认，已转人工核对；不会重复提交');
        reviewed += 1;
      } else if (enqueue(row.id)) resumed += 1;
    }
    const incomplete = db.prepare(`SELECT * FROM video_jobs
      WHERE delivery_state = 'verified' AND billing_state = 'settled'
        AND (project_projection_state <> 'projected' OR projection_state <> 'projected' OR status = 'reconciling')
      ORDER BY updated_at, rowid LIMIT ?`).all(limit);
    let replayed = 0;
    for (const row of incomplete) {
      try { replayProjection(row.id); replayed += 1; } catch {}
    }
    return { billing, staleChecked: stale.length, resumed, reviewed, projectionChecked: incomplete.length, replayed };
  }

  function recover() {
    reconcileBilling();
    const rows = db.prepare("SELECT id, status, provider_task_id FROM video_jobs WHERE status IN ('queued','submitting','processing') ORDER BY created_at").all();
    for (const row of rows) {
      if (row.status === 'submitting' && !row.provider_task_id) {
        markSubmissionUnknown(selectJob.get(row.id), '服务重启前的上游受理结果待自动核对，核对期间不会重复提交或结算积分');
      } else {
        enqueue(row.id);
      }
    }
  }

  const reconciliationTimer = setInterval(() => {
    if (!closed) reconcileBilling();
  }, Math.max(5_000, Number(reconciliationIntervalMs) || 30_000));
  reconciliationTimer.unref?.();

  return {
    runtimeStats() {
      const routes = Object.values(VIDEO_PRODUCTS).map(product => {
        const adapter = registry.get(product.id);
        const health = circuitHealth(product.id);
        return {
          productId: product.id,
          label: product.label,
          routeId: product.routeId,
          configured: adapter?.enabled === true,
          public: product.public === true,
          availability: health.status,
          reason: health.reason || '',
          retryAt: health.retryAt || null,
          queue: queue.stats(product.routeId),
        };
      });
      return {
        running: routes.reduce((total, route) => total + route.queue.running, 0),
        queued: routes.reduce((total, route) => total + route.queue.queued, 0),
        routes,
      };
    },
    capabilities() {
      const products = registry.publicProducts({ includeHidden: allowHiddenProducts })
        .map(product => ({
          ...product,
          availability: circuitHealth(product.id).status,
        }))
        .filter(product => ['ready', 'probe'].includes(product.availability));
      const defaultProduct = products.find(product => product.default) || products[0] || null;
      const resolutions = [...new Set(products.flatMap(product => product.resolutions))];
      const durations = products.length
        ? {
          min: Math.min(...products.map(product => product.durations.min)),
          max: Math.max(...products.map(product => product.durations.max)),
        }
        : { min: 0, max: 0 };
      const qualities = products.flatMap(product => [
        { productId: product.id, sku: product.quotes.short.sku, duration: `${product.durations.min}-${Math.min(8, product.durations.max)}`, points: product.quotes.short.points },
        { productId: product.id, sku: product.quotes.long.sku, duration: '9-15', points: product.quotes.long.points },
      ]);
      return {
        generationEnabled: Boolean(products.length),
        model: defaultProduct?.id || '',
        defaultProductId: defaultProduct?.id || DEFAULT_VIDEO_PRODUCT_ID,
        products,
        billing: { currency: 'ec_points', unit: 'generation' },
        durations,
        resolutions,
        aspectRatios: [...RATIOS],
        qualities,
      };
    },
    uploadAsset,
    importUploadedAsset,
    createJob,
    getJob(ownerEmail, id) { return serializeOwnedJob(jobForOwner(ownerEmail, id)); },
    listJobs(ownerEmail, limit = 20) {
      return db.prepare('SELECT * FROM video_jobs WHERE owner_email = ? ORDER BY created_at DESC LIMIT ?')
        .all(ownerEmail, Math.max(1, Math.min(50, Number(limit) || 20))).map(serializeOwnedJob);
    },
    readAsset,
    readSignedAsset,
    playbackUrlForAsset,
    listSubmissionReviews,
    resolveSubmissionReview,
    rejectSubmissionReview,
    reconcileBilling,
    reconcileOperations,
    recheckJob,
    confirmNotSubmitted,
    retryConfirmedNotSubmitted,
    quarantineJob,
    replayProjection,
    recover,
    close() {
      closed = true;
      for (const timer of retryTimers) clearTimeout(timer);
      retryTimers.clear();
      clearInterval(reconciliationTimer);
      queue.close();
    },
  };
}

export async function readRequestBuffer(req, maxBytes) {
  const declared = Number(req.headers['content-length'] || 0);
  if (declared > maxBytes) throw httpError(413, 'VIDEO_ASSET_SIZE_INVALID', '素材文件过大');
  const chunks = [];
  let bytes = 0;
  for await (const chunk of req) {
    bytes += chunk.length;
    if (bytes > maxBytes) throw httpError(413, 'VIDEO_ASSET_SIZE_INVALID', '素材文件过大');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export function parseVideoRange(value, size) {
  if (!value) return null;
  if (!Number.isSafeInteger(size) || size <= 0) return false;
  const range = String(value).trim();
  const match = /^bytes=(\d*)-(\d*)$/.exec(range);
  if (!match || (!match[1] && !match[2])) return false;

  let start;
  let end;
  if (!match[1]) {
    const suffixLength = Number(match[2]);
    if (!Number.isSafeInteger(suffixLength) || suffixLength <= 0) return false;
    start = Math.max(size - suffixLength, 0);
    end = size - 1;
  } else {
    start = Number(match[1]);
    end = match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
  }

  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end < start || start >= size) {
    return false;
  }
  return { start, end };
}

function requestHeader(req, name) {
  const headers = req?.headers || {};
  return headers[name] || headers[name.toLowerCase()] || '';
}

function assetLastModified(asset) {
  const mtimeMs = Number(asset?.mtimeMs);
  if (Number.isFinite(mtimeMs) && mtimeMs > 0) return new Date(Math.floor(mtimeMs / 1000) * 1000);
  const createdAt = clean(asset?.row?.created_at, 80).replace(' ', 'T');
  const parsed = Date.parse(createdAt);
  return Number.isFinite(parsed) ? new Date(Math.floor(parsed / 1000) * 1000) : null;
}

function assetEtag(asset) {
  const checksum = clean(asset?.row?.sha256, 64).toLowerCase();
  if (/^[a-f0-9]{64}$/.test(checksum)) return `"${checksum}"`;
  const fallback = [clean(asset?.row?.id, 256), Number(asset?.size) || 0, Number(asset?.mtimeMs) || 0].join(':');
  return `"${crypto.createHash('sha256').update(fallback).digest('hex')}"`;
}

function matchesEntityTag(value, etag) {
  const normalized = clean(value, 1000);
  if (!normalized) return false;
  return normalized.split(',').some(candidate => {
    const token = candidate.trim();
    return token === '*' || token.replace(/^W\//i, '') === etag;
  });
}

function matchesIfRange(value, etag, lastModified) {
  const normalized = clean(value, 200);
  if (!normalized) return true;
  if (normalized.startsWith('"') || /^W\//i.test(normalized)) return normalized === etag;
  const parsed = Date.parse(normalized);
  return Number.isFinite(parsed) && lastModified && lastModified.getTime() <= parsed;
}

export function sendVideoAsset(req, res, asset) {
  const method = clean(req?.method, 16).toUpperCase() || 'GET';
  const etag = assetEtag(asset);
  const lastModified = assetLastModified(asset);
  const rangeHeader = clean(requestHeader(req, 'range'), 100);
  const range = rangeHeader && matchesIfRange(requestHeader(req, 'if-range'), etag, lastModified)
    ? rangeHeader
    : '';
  res.setHeader('Content-Type', asset.row.content_type);
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('ETag', etag);
  if (lastModified) res.setHeader('Last-Modified', lastModified.toUTCString());
  const fileName = basename(clean(asset.row.file_name, 500) || clean(asset.row.id, 256) || 'media');
  res.setHeader('Content-Disposition', `inline; filename="${fileName.replace(/["\r\n]/g, '_')}"`);
  res.setHeader('Cache-Control', asset.row.kind === 'output' ? 'private, max-age=86400' : 'private, max-age=3600');
  if (matchesEntityTag(requestHeader(req, 'if-none-match'), etag)) {
    res.status(304);
    return res.end();
  }
  if (!range) {
    res.setHeader('Content-Length', asset.size);
    if (method === 'HEAD') return res.end();
    fs.createReadStream(asset.filePath).pipe(res);
    return;
  }
  const parsed = parseVideoRange(range, asset.size);
  if (!parsed) {
    res.setHeader('Content-Range', `bytes */${asset.size}`);
    return res.status(416).end();
  }
  const { start, end } = parsed;
  res.status(206);
  res.setHeader('Content-Range', `bytes ${start}-${end}/${asset.size}`);
  res.setHeader('Content-Length', end - start + 1);
  if (method === 'HEAD') return res.end();
  fs.createReadStream(asset.filePath, { start, end }).pipe(res);
}
