import crypto from 'node:crypto';
import { stampVideoFile, contentIdFor } from './aigcStamp.mjs';
import fs from 'node:fs';
import { copyFile, link, rename, stat, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { FEATURE_SKUS, quoteFeature, billableQuantity, billableProviderCost } from './billing/catalog.mjs';
import {
  DEFAULT_VIDEO_PRODUCT_ID,
  VIDEO_CATALOG_VERSION,
  VIDEO_PRODUCTS,
  getVideoProduct,
  isLocalEngineProduct,
  isStillMotionProduct,
  localVideoProducts,
  validateVideoProductInput,
  videoFeatureSku as catalogVideoFeatureSku,
} from './videoCatalog.mjs';
/* 「做成动图」：静图 → 上游最短档（5 秒）→ **本地裁到 2~3 秒**（见 server/stillMotion.mjs 文件头，
   成本口径与用户口径都在那里）。裁切在交付那一步做（persistDeliveredOutput）。 */
import { LIVE_PHOTO_CLIP_SECONDS, LIVE_PHOTO_PROMPT, livePhotoTrimWindow, trimClipToSeconds } from './stillMotion.mjs';
import { createLocalVideoAdapter, ffmpegAvailable, probeDurationSeconds } from './videoLocalAdapter.mjs';
import { validateLocalPlanInput } from './localVideoPlan.mjs';
import { createVolcSubtitleAdapter, volcSubtitleReadiness } from './volcSubtitleErase.mjs';
import { createVolcLipSyncAdapter, volcLipSyncReadiness } from './volcLipSync.mjs';
/* 内容安全闸门（提示词侧，纯本地零成本）—— 见 server/contentScreen.mjs 的文件头 */
import { screenPromptText } from './contentScreen.mjs';
/* 上游内容策略拒绝的翻译层（批 BA，doc 75 §三.2）—— 判据与保守边界写在那个文件的头部 */
import { CONTENT_REJECTION_MESSAGE, classifyContentRejection, isContentRejectionError } from './contentRejection.mjs';
import {
  buildProviderPayload,
  createVideoProviderRegistry,
  isVideoProviderFailure,
} from './videoProviders.mjs';
import { createOwnerFairVideoQueue } from './videoQueue.mjs';
import { createVideoAttemptStore } from './videoAttemptStore.mjs';
import { createVideoOutbox } from './videoOutbox.mjs';
/* 2026-09-18 总统筹拍板：视频方案是收了钱的，必须真的影响产出。
   本模块把结构化方案编译进 prompt/negativePrompt（服务端权威，客户端绕不过）。 */
import { assertVideoPlanConfirmed, compileVideoRequest, hashVideoPlan } from './videoPlanCompiler.mjs';
/* 批 CY-㊴ 之十四（2026-10-01）：上传体积上限与格式白名单的**唯一真相**。
   原来本文件自己写了一份（视频 50MB），tus 那份却是 300MB —— 于是文件整个传完
   才在最后一步被拒。详见 server/mediaUploadLimits.mjs 的文件头。 */
import {
  MEDIA_UPLOAD_CONTENT_TYPES,
  MEDIA_UPLOAD_LIMITS,
  formatMediaSize,
  isSupportedMediaContentType,
} from './mediaUploadLimits.mjs';

const FINAL_STATUSES = new Set(['completed', 'failed', 'needs_review', 'reconciling']);
const ACTIVE_STATUSES = new Set(['queued', 'submitting', 'processing']);
const RATIOS = new Set(['21:9', '16:9', '4:3', '1:1', '3:4', '9:16']);
/* 批 CY-㊴ 之十四（2026-10-01）：原来这里是**另一份**上限（视频 50MB），
   而 videoUploadService 的 tus 前两道关读的是 300MB ⇒ 整个文件传完，
   最后一块 PATCH 触发 onUploadFinish → 走下面的 importUploadedAsset → 撞上 50MB → 413。
   用户看到的"等了非常久才失败"就是它。现在与 tus 那份共用同一个上限与同一句提示。 */
const INPUT_LIMITS = MEDIA_UPLOAD_LIMITS;
const KIND_LABEL = Object.freeze({ image: '图片', video: '视频', audio: '音频' });
const OUTPUT_LIMIT = 100 * 1024 * 1024;
const CIRCUIT_MIN_SAMPLES = 5;
const CIRCUIT_WINDOW = 20;
const CIRCUIT_COOLDOWN_MS = 15 * 60 * 1000;
const SUBMISSION_REVIEW_TTL_MS = 30 * 60 * 1000;
const CONTENT_TYPES = MEDIA_UPLOAD_CONTENT_TYPES;
const contentTypeAllowed = (kind, type) => isSupportedMediaContentType(kind, type);

/** 413 的统一口径：多大、上限多少、怎么办（批 CY-㊴ 之十四） */
function mediaTooLarge(kind, bytes) {
  const label = KIND_LABEL[kind] || '素材';
  return `${label}有 ${formatMediaSize(bytes)}，超过单文件上限 ${formatMediaSize(INPUT_LIMITS[kind])}。`
    + '请压缩后再传，或换一个更小的文件。';
}

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

/* 本地渲染的产物固定是 mp4（renderVideo 里 `-c:v libx264` + .mp4 落盘），
   这里按扩展名反推 content-type，走与上游成片**同一条**落库校验（见 persistLocalOutput）。 */
function contentTypeForFile(filePath) {
  const name = String(filePath || '').toLowerCase();
  if (name.endsWith('.webm')) return 'video/webm';
  if (name.endsWith('.mov')) return 'video/quicktime';
  return 'video/mp4';
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
        throw httpError(response.status >= 500 ? 502 : 400, 'VIDEO_PROVIDER_REJECTED', '视频任务提交失败，请重试', {
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
  /* 9-12 视频备用供应商（同模型换网关）：默认空 = 不启用备用，行为与之前完全一致 */
  backupBaseUrl = '',
  backupApiKey = '',
  backupMinimaxBaseUrl = '',
  backupMinimaxApiKey = '',
  backupModels = null,
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
  /* 火山 MediaKit 凭据与"测试用 fetch 注入"（默认都从环境/全局取） */
  volcApiKey = process.env.VOLC_MEDIAKIT_API_KEY || '',
  volcFetchImpl = null,
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
    /* 方案留痕列（2026-09-18）：记录本单用的是哪份拍摄方案，便于出问题回查。
       内部字段，绝不出现在任何用户可见文案里；空串 = 本列上线前的历史单。 */
    ['plan_hash', "TEXT NOT NULL DEFAULT ''"],
    /* 本地方案的规格（2026-09-25 批 AM）：JSON `{ fps, regions }` —— 本地渲染清单里
       除了"分辨率/时长"（已有列）之外的两样东西。单独开一列而不是塞进 refs_json：
       refs_json 是"参考素材"的语义，混进规格会让素材查询与诊断都变味。 */
    ['local_specs', "TEXT NOT NULL DEFAULT ''"],
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
    /* 9-12 备用供应商（同模型换网关）：未配置则为 null，行为与之前完全一致 */
    backup: backupBaseUrl
      ? {
        baseUrl: backupBaseUrl,
        minimaxBaseUrl: backupMinimaxBaseUrl || backupBaseUrl,
        credentials: { seedance: backupApiKey || '', minimax: backupMinimaxApiKey || '' },
        /* 备用网关的模型 id 映射（实测 65535 的视频模型清单）；未列出的档位不挂备用 */
        models: backupModels || {},
      }
      : null,
  });
  const selectJob = db.prepare('SELECT * FROM video_jobs WHERE id = ?');
  /* ═══ 本地方案的适配器（2026-09-25 批 AM）══════════════════════════════════════════════════
     与上游适配器**同形**（submit / get / download / describe），只是实现换成本机 ffmpeg：
       · 上游：POST /videos → 轮询 → 下载 content（异步、按条/按秒花钱）
       · 本地：buildLocalRenderManifest → renderVideo（**同步**、零上游成本）
     ⚠️ 为什么按产品各建一个：适配器的 routeId/productId 要跟着产品走（诊断与钩子都读它），
        而且本地任务表是进程内的 —— 共用一份会让两个产品的 taskId 撞在一起。
     ⚠️ 本地**不做假轮询**：submit 返回时片子已经落盘，get 直接回终态（见 processJob 的分支）。 */
  const localAdapters = new Map();
  function localProviderFor(product) {
    if (!localAdapters.has(product.id)) localAdapters.set(product.id, createLocalVideoAdapter({ product }));
    return localAdapters.get(product.id);
  }
  /* ═══ 火山 AI MediaKit 适配器（2026-09-26 批 AR，自动标记那一档）══════════════════════════════
     与上游视频适配器同形（submit / get / download），但走的是 MediaKit 那套契约
     （Bearer API Key、POST /tools/erase-video-subtitle、GET /tasks/{id}）。
     ⚠️ `volcFetchImpl` 只为**测试与诊断**注入（默认 fetch）：有了它，整条链路能在不花钱、
        不联网的情况下跑端到端（假 MediaKit 回任务号、回成片地址），这正是"账户未充值也要验证"的办法。 */
  const volcAdapter = createVolcSubtitleAdapter({
    apiKey: clean(volcApiKey, 500),
    fetchImpl: volcFetchImpl || fetch,
  });
  /* ═══ 火山 AI MediaKit：**口型对齐**（2026-09-26 批 AU，数字人那一档）══════════════════════════
     同一把 Key、同一套上传骨架（volcMediaKitClient），只是提交到 `/tools/lip-sync`。
     用户对数字人的要求是照知渔的形态（docs/design/72）：真人视频 + 驱动音频 → 口播成片。
     ⚠️ 这一档的路由台账是 unverified（一次真调用都没跑过）⇒ 产品与 SKU 都是 public:false，
        派发点仍然接好（契约忠实 + 失败可诊断），等真机跑通再翻 —— 与 1080P 的 Seedance 同一套做法。 */
  const lipSyncAdapter = createVolcLipSyncAdapter({
    apiKey: clean(volcApiKey, 500),
    fetchImpl: volcFetchImpl || fetch,
  });
  function volcProviderFor() {
    return {
      ...volcAdapter,
      routeId: 'volc-media-kit-subtitle',
      productId: 'desubtitle_volc',
    };
  }
  function lipSyncProviderFor() {
    return {
      ...lipSyncAdapter,
      routeId: 'volc-media-kit-lipsync',
      productId: 'lipsync_volc',
    };
  }
  const VOLC_ROUTE = 'volc-media-kit-subtitle';
  /* 口型对齐那条的路由名（批 AU）：派发与健康度都要按**产品**分流，不能只看"credential 是不是 volc" */
  const VOLC_LIPSYNC_ROUTE = 'volc-media-kit-lipsync';
  /* 本机渲染组件的可用性（ffmpeg 在不在）。进程起来之后异步探一次，缓存起来给 circuitHealth /
     capabilities 这两处**同步**读；真正的权威判定在 createJob 里 await 一次（见 assertLocalEngineReady）——
     探针是"启动时的乐观默认 + 建单时的实测"，两道合起来才不会出现"页面亮着、点了 503"。 */
  let localEngineReady = true;
  void ffmpegAvailable()
    .then(result => { localEngineReady = result.ok === true; })
    .catch(() => { localEngineReady = false; });

  async function assertLocalEngineReady() {
    const result = await ffmpegAvailable();
    localEngineReady = result.ok === true;
    if (!localEngineReady) {
      throw httpError(503, 'VIDEO_LOCAL_ENGINE_UNAVAILABLE', '本机渲染组件未就绪，该功能暂时不可用', { retryable: true });
    }
  }
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
    /* ═══ 本地方案的健康度 = "这台机器上有没有 ffmpeg"（2026-09-25 批 AM）══════════════════
       不能沿用上游那条判据（registry.get(product.id)?.enabled）—— 本地产品**故意**不在上游
       registry 里（videoProviders 跳过 localEngine），照旧判会得到 credential_missing ⇒
       建单被 admitProduct 拦成 503「该视频产品暂时不可用」，本地链路永远进不去。
       本地也不该走"熔断"：它没有上游渠道可抖，只有"装了/没装"这一个事实。 */
    if (isLocalEngineProduct(product)) {
      return { status: localEngineReady ? 'ready' : 'unavailable', reason: localEngineReady ? '' : 'local_engine_missing' };
    }
    /* ═══ 火山字幕擦除（2026-09-26 批 AR）：健康度 = **凭据在不在** ══════════════════════════════
       它同样不在上游"生成"registry 里（MediaKit 不是视频生成模型），照旧判会得到 credential_missing
       ⇒ 建单被 admitProduct 拦成 503「该视频产品暂时不可用」，永远进不去。
       它也不该走熔断：真正决定"能不能跑"的是**账户余额**（运维事实），代码这边只有"有没有 Key"。 */
    if (product.videoProcess === true && product.credential === 'volc') {
      /* 批 AU：这族现在有**两条**（字幕擦除 / 口型对齐），Key 是同一把 ⇒ 判据相同；
         但 reason 要能分清是哪条路（诊断时"哪把钥匙缺了"必须一眼看出）。 */
      const ready = product.routeId === VOLC_LIPSYNC_ROUTE ? lipSyncAdapter.enabled : volcAdapter.enabled;
      const missing = product.routeId === VOLC_LIPSYNC_ROUTE ? 'volc_lipsync_key_missing' : 'volc_key_missing';
      return { status: ready ? 'ready' : 'unavailable', reason: ready ? '' : missing };
    }
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
    if (!contentTypeAllowed(kind, normalizedType)) throw httpError(415, 'VIDEO_ASSET_TYPE_INVALID', '素材文件格式不支持');
    if (!Buffer.isBuffer(buffer) || !buffer.length || buffer.length > INPUT_LIMITS[kind]) {
      throw httpError(413, 'VIDEO_ASSET_SIZE_INVALID', mediaTooLarge(kind, buffer?.length));
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
    if (!contentTypeAllowed(kind, normalizedType)) throw httpError(415, 'VIDEO_ASSET_TYPE_INVALID', '素材文件格式不支持');
    const normalizedOwner = clean(ownerEmail, 320).toLowerCase();
    if (!normalizedOwner) throw httpError(401, 'VIDEO_ASSET_OWNER_REQUIRED', '登录已失效，请重新登录');
    const size = Number(bytes);
    const sourceInfo = await stat(sourcePath);
    if (!Number.isSafeInteger(size) || size <= 0 || size > INPUT_LIMITS[kind] || sourceInfo.size !== size) {
      throw httpError(413, 'VIDEO_ASSET_SIZE_INVALID', mediaTooLarge(kind, size));
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

  /* ═══ 处理已有视频的产品（本机 or 上游，2026-09-26 批 AR）═════════════════════════════════════
     两类产品共用同一份**输入契约**（一条源视频 + 时长），区别只在"谁执行"：
       · localEngine: true      → 本机 ffmpeg（videoLocalAdapter）
       · videoProcess: true     → 上游（目前只有火山 MediaKit 的自动字幕擦除）
     派发点按**产品声明**分流 —— 与 AM 批同一套纪律：链路只在产品目录里定义一次。 */
  function isProcessProduct(product) {
    return product?.localEngine === true || product?.videoProcess === true;
  }
  function processProviderFor(product) {
    if (product.localEngine === true) return localProviderFor(product);
    /* ═══ 火山这一族按**路由**分流（2026-09-26 批 AU）══════════════════════════════════════════
       批 AR 时只有一个火山产品，判据写成"credential === 'volc'"就够了；批 AU 加了口型对齐，
       两条路都是 credential 'volc' 但提交到不同端点 —— 只看 credential 会把数字人的任务
       提到字幕擦除的接口上去（出了账也算不明白）。所以改成按 **routeId** 判。 */
    if (product.videoProcess === true && product.credential === 'volc') {
      if (product.routeId === VOLC_LIPSYNC_ROUTE) return lipSyncProviderFor();
      return volcProviderFor();
    }
    throw httpError(503, 'VIDEO_PROCESS_ENGINE_UNKNOWN', '这类产品的执行引擎未登记，暂不可用');
  }

  /* 火山那条的派发报文：站内片子是**带签名的内网地址**，火山拉不到 ⇒ 先上传换 `mediakit://{file_id}`
     （官方那条"本地上传"路：取上传票据 → 纯二进制 PUT → 提交时用 mediakit:// 协议）。
     ⚠️ 上传发生在**建单之后、提交之前**（和本机渲染一样，失败会走既有的失败退费），
        不会因为上传失败而多收钱。 */
  async function volcProviderPayload(job) {
    const filePath = await sourceFilePathFor(parseJson(job.refs_json, {}));
    if (!filePath) throw httpError(400, 'VIDEO_REFERENCE_NOT_FOUND', '源视频不存在或不属于当前账号');
    const provider = volcProviderFor();
    if (!provider.enabled) {
      throw httpError(503, 'VOLC_SUBTITLE_NOT_CONFIGURED', volcSubtitleReadiness('').reason, { retryable: true });
    }
    const uploaded = await provider.uploadLocalFile({ filePath, fileName: `${job.id}.mp4` });
    return {
      videoUrl: uploaded.videoUrl,
      mode: 'Subtitle',        /* 自动检测字幕（官方另一档 Text 会连人名地名一起擦，我们不用） */
      modelVersion: 'v5',
    };
  }

  /* ═══ 口型对齐那条的派发报文（2026-09-26 批 AU）══════════════════════════════════════════════
     与字幕擦除同一套思路（站内文件 → 上传换 mediakit:// → 提交），差别是**要传两个文件**：
     人物视频 + 驱动音频。音频也走同一个票据协议（MediaKit 的上传接口不分媒体类型）。
     ⚠️ 上传发生在建单之后、提交之前 —— 上传失败走既有的失败退费，不会因为上传失败多收钱。 */
  async function volcLipSyncPayload(job) {
    const refs = parseJson(job.refs_json, {});
    const videoPath = await sourceFilePathFor(refs);
    if (!videoPath) throw httpError(400, 'VIDEO_REFERENCE_NOT_FOUND', '人物视频不存在或不属于当前账号');
    const audioPath = await audioFilePathFor(refs);
    if (!audioPath) throw httpError(400, 'VIDEO_AUDIO_REFERENCE_NOT_FOUND', '驱动音频不存在或不属于当前账号');
    const provider = lipSyncProviderFor();
    if (!provider.enabled) {
      throw httpError(503, 'VOLC_LIPSYNC_NOT_CONFIGURED', volcLipSyncReadiness('').reason, { retryable: true });
    }
    const video = await provider.uploadLocalFile({ filePath: videoPath, fileName: `${job.id}-person.mp4` });
    const audio = await provider.uploadLocalFile({ filePath: audioPath, fileName: `${job.id}-voice.mp3` });
    return { videoUrl: video.mediaUrl, audioUrl: audio.mediaUrl };
  }

  async function processPayloadFor(product, job) {
    if (product.localEngine === true) return localProviderPayload(job);
    if (product.routeId === VOLC_LIPSYNC_ROUTE) return volcLipSyncPayload(job);
    return volcProviderPayload(job);
  }

  function providerForJob(job) {
    const product = getVideoProduct(job.product_id);
    /* ═══ 派发点（2026-09-25 批 AM；2026-09-26 批 AR 加了"处理已有视频"这一类）═══════════════════
       判据是**产品声明**，不是路由名：
         · localEngine: true  → 本机 ffmpeg 适配器（零上游成本）
         · videoProcess: true → 上游"处理已有视频"的适配器（目前火山 MediaKit 字幕擦除）
         · 其余               → 上游**生成**注册表（videoProviders）
       这样"哪条链路"只有一处能定义（产品目录），不会出现"目录说是本地的、跑的是上游"那种
       账对不上的情况（成本口径按产品声明记）。 */
    if (isProcessProduct(product)) return processProviderFor(product);
    const provider = registry.get(job.product_id);
    /* ⚠️ 火山那条不走 registry（它不是"生成"视频的模型），但它的 routeId 也要与 job 对得上 ——
       下面这句在 processProviderFor 里等价地保证了（适配器自带 routeId）。 */
    if (!provider?.enabled || provider.routeId !== job.provider_route) {
      throw httpError(503, 'VIDEO_PROVIDER_NOT_CONFIGURED', '视频服务正在配置中', { retryable: true });
    }
    return provider;
  }

  /* 本地方案的**源文件路径**（建单前的时长核对用；与 localProviderPayload 同一套白名单规则：
     basename 收口，不许拼出目录穿越）。找不到文件返回 null —— 那种情况会在建单后的派发阶段
     以 VIDEO_REFERENCE_NOT_FOUND 失败并退费，不在这里拦住（这里的职责只是"量时长"）。 */
  async function sourceFilePathFor(references) {
    const sourceId = clean((Array.isArray(references?.videos) ? references.videos[0] : '') || '', 140);
    if (!sourceId) return null;
    const row = db.prepare('SELECT file_name FROM video_assets WHERE id = ?').get(sourceId);
    if (!row) return null;
    return resolve(inputRoot, basename(row.file_name || sourceId));
  }
  async function probeSourceSeconds(references) {
    const filePath = await sourceFilePathFor(references);
    if (!filePath) return null;
    return probeDurationSeconds(filePath).catch(() => null);
  }

  /* ═══ 驱动音频的**源文件路径**（2026-09-26 批 AU，数字人那一档）═══════════════════════════════
     与 sourceFilePathFor 同形、同一套白名单规则（basename 收口，不许拼出目录穿越），
     只是取 refs.audios[0] 而不是 refs.videos[0]。
     为什么数字人的时长要按**音频**核对：口型对齐的产出长度由音频决定（人物视频多长不重要），
     而计费是按秒 —— 拿视频时长当账本会两种方向都错（视频短了少收、长了多收）。 */
  async function audioFilePathFor(references) {
    const audioId = clean((Array.isArray(references?.audios) ? references.audios[0] : '') || '', 140);
    if (!audioId) return null;
    const row = db.prepare('SELECT file_name FROM video_assets WHERE id = ?').get(audioId);
    if (!row) return null;
    return resolve(inputRoot, basename(row.file_name || audioId));
  }
  async function probeAudioSeconds(references) {
    const filePath = await audioFilePathFor(references);
    if (!filePath) return null;
    return probeDurationSeconds(filePath).catch(() => null);
  }

  async function persistOutput(job, response) {
    const contentType = clean(response.headers.get('content-type'), 100).split(';')[0] || 'video/mp4';
    if (!contentType.startsWith('video/')) throw httpError(502, 'VIDEO_OUTPUT_TYPE_INVALID', '生成结果无效，请重试');
    const declaredBytes = Number(response.headers.get('content-length') || 0);
    if (declaredBytes > OUTPUT_LIMIT) throw httpError(502, 'VIDEO_OUTPUT_SIZE_INVALID', '视频文件过大，无法交付');
    if (!response.body) throw httpError(502, 'VIDEO_OUTPUT_BODY_MISSING', '没有收到视频文件，请重试');
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
        if (bytes > OUTPUT_LIMIT) return callback(httpError(502, 'VIDEO_OUTPUT_SIZE_INVALID', '视频文件过大，无法交付'));
        hash.update(buffer);
        return callback(null, buffer);
      },
    });
    try {
      await pipeline(Readable.fromWeb(response.body), meter, fs.createWriteStream(tempPath, { flags: 'wx' }));
      if (!bytes || (declaredBytes > 0 && declaredBytes !== bytes)) {
        throw httpError(502, 'VIDEO_OUTPUT_TRUNCATED', '视频文件不完整，请重试');
      }
      let sha256 = hash.digest('hex');
      const expectedSha256 = clean(response.headers.get('x-content-sha256'), 100).toLowerCase();
      if (expectedSha256 && expectedSha256 !== sha256) {
        throw httpError(502, 'VIDEO_OUTPUT_CHECKSUM_INVALID', '视频文件校验失败，请重试');
      }
      /* ═══ AIGC 隐式标识（视频）════════════════════════════════════════════════
         ⚠️ 位置铁律：必须在上面**校验完上游 x-content-sha256 之后**才做。
            ffmpeg -c copy 的 remux 会改字节；提前做，上游完整性校验就形同虚设。
         stamp 之后 sha256 / bytes 按**落盘文件重算** ——
         `hash` 这条 Transform 流在 digest 之后已消费完，不能接着用；
         而库里若记的是改之前的值，取证时对不上实际文件。
         失败不阻断出片：ffmpeg 不可用或超时 → 返回 false，原文件不动。 */
      try {
        const stamped = await stampVideoFile(tempPath, {
          contentId: contentIdFor(job.id || id, contentType + ':' + id),
        });
        if (stamped) {
          const finalBuffer = fs.readFileSync(tempPath);
          sha256 = crypto.createHash('sha256').update(finalBuffer).digest('hex');
          bytes = finalBuffer.length;
        }
      } catch (error) {
        console.warn('[aigcStamp] 视频标识写入失败，交付原文件:', error?.message);
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

  /* ═══ 本地方案的派发报文（2026-09-25 批 AM）════════════════════════════════════════════════
     上游的报文由 videoProviders.buildProviderPayload 生成（模型/提示词/比例/参考素材）；
     本地方案吃的是**完全不同的东西**：一条源视频 + 规格/区域。所以这里单独构造，交给
     videoLocalAdapter.submit → buildLocalRenderManifest → renderVideo。
     ⚠️ 源视频为什么给**绝对路径**而不是签名 URL：ffmpeg 不走我们的鉴权，签名 URL 它拉不到；
        而站内素材（上传/资产库）本来就落在 inputRoot 里，直接读文件既快又不会因为
        公网域名/证书/带宽出问题。路径由 `basename()` 收口，不许拼出目录穿越。
     ⚠️ 找不到源文件就**抛错**（failing 在建单之后、渲染之前），让任务落 failed 并退费 ——
        比拿一个不存在的路径去 spawn 更早、更清楚地报出问题。 */
  function localProviderPayload(job) {
    const product = getVideoProduct(job.product_id);
    const refs = parseJson(job.refs_json, {});
    const sourceId = clean((Array.isArray(refs.videos) ? refs.videos[0] : '') || '', 140);
    const row = sourceId
      ? db.prepare('SELECT * FROM video_assets WHERE id = ? AND owner_email = ?').get(sourceId, job.owner_email)
      : null;
    if (!row) throw httpError(400, 'VIDEO_REFERENCE_NOT_FOUND', '源视频不存在或不属于当前账号');
    const specs = parseJson(job.local_specs, {});
    const filePath = resolve(inputRoot, basename(row.file_name || row.id));
    return {
      sourceUrl: filePath,
      resolution: job.resolution || '',
      fps: specs.fps ?? null,
      regions: Array.isArray(specs.regions) ? specs.regions : [],
      duration: Number(job.duration) || 0,
      label: product.label,
    };
  }

  /* 本地成片的落库：与上游成片**同一条**通道（persistOutput 的校验/哈希/两行入库），
     只是数据来源从 HTTP 响应换成磁盘文件 —— 包成 Response 再喂给 persistOutput，
     这样"内容类型/体积/截断/校验和"四道校验一处都不少，将来改也只改一处。 */
  async function persistLocalOutput(job, filePath) {
    const sourcePath = resolve(String(filePath || ''));
    let info;
    try {
      info = await stat(sourcePath);
    } catch {
      throw httpError(502, 'VIDEO_OUTPUT_MISSING', '本地渲染没有产出文件，请重试');
    }
    if (!info.isFile() || info.size <= 0) throw httpError(502, 'VIDEO_OUTPUT_MISSING', '本地渲染没有产出文件，请重试');
    const contentType = contentTypeForFile(sourcePath);
    const response = new Response(Readable.toWeb(fs.createReadStream(sourcePath)), {
      headers: { 'content-type': contentType, 'content-length': String(info.size) },
    });
    try {
      return await persistOutput(job, response);
    } finally {
      /* 渲染中间产物用完即删：它的唯一归宿就是 outputRoot 里那条正式资产，
         留着只会让磁盘里堆满 render-*.mp4（本地渲染每次都要落一个）。 */
      await fs.promises.rm(sourcePath, { force: true }).catch(() => {});
    }
  }

  /* ═══ 交付前的最后一道加工：**「做成动图」在本地裁到 2~3 秒**（2026-09-27 批 DC-4）════════════
     上游按**最短档 5 秒**给的片子（成本 ¥0.91 就买这 5 秒），用户要的是"实况那种一小段"
     ⇒ 交付件不是上游原片，而是本地 ffmpeg 裁出来的 2~3 秒短片（本机活，不额外花钱）。
     ⚠️ 位置很关键：放在 `persistOutput` **之前**，也就是"没裁出来就还没交付、还没结算" ——
        裁切失败会走 processJob 的失败分支 → 任务落 failed → 既有链路 releaseItem（退钱）。
        绝不允许出现"扣了钱但拿不到动图"（铁律①的变体）。
     ⚠️ 上游原片也是**先落临时文件**：它只用来裁，不进 video_assets（用户拿到的是 2~3 秒那条）。 */
  async function persistStillMotionOutput(job, response) {
    const contentType = clean(response.headers.get('content-type'), 100).split(';')[0] || 'video/mp4';
    if (!contentType.startsWith('video/')) throw httpError(502, 'VIDEO_OUTPUT_TYPE_INVALID', '生成结果无效，请重试');
    if (!response.body) throw httpError(502, 'VIDEO_OUTPUT_BODY_MISSING', '没有收到视频文件，请重试');
    const rawPath = resolve(outputRoot, `.${job.id}.${crypto.randomUUID()}.raw.mp4`);
    const clipPath = resolve(outputRoot, `.${job.id}.${crypto.randomUUID()}.clip.mp4`);
    try {
      /* 边下边数体积（与 persistOutput 同一个上限），避免把一段超预期的片子先落满磁盘 */
      const meter = new Transform({
        transform(chunk, _encoding, callback) {
          const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
          this.size = (this.size || 0) + buffer.length;
          if (this.size > OUTPUT_LIMIT) return callback(httpError(502, 'VIDEO_OUTPUT_SIZE_INVALID', '视频文件过大，无法交付'));
          return callback(null, buffer);
        },
      });
      await pipeline(Readable.fromWeb(response.body), meter, fs.createWriteStream(rawPath, { flags: 'wx' }));
      const sourceSeconds = await probeDurationSeconds(rawPath).catch(() => 0);
      const window = livePhotoTrimWindow({ sourceSeconds, targetSeconds: LIVE_PHOTO_CLIP_SECONDS });
      await trimClipToSeconds({ inputPath: rawPath, outPath: clipPath, seconds: window.seconds });
      /* 裁完走**既有**的本地成片落库那条路（内容类型/体积/哈希/两行入库一处不少），
         它顺手把裁切产物删掉；这里只负责再删掉上游原片。 */
      return await persistLocalOutput(job, clipPath);
    } finally {
      await fs.promises.rm(rawPath, { force: true }).catch(() => undefined);
    }
  }

  /* 交付件的分流点：普通视频任务原样落库；「做成动图」先裁再落库。
     判据取自**产品声明**（isStillMotionProduct），不认提示词也不认路由名 —— 与派发点同一条纪律。 */
  async function persistDeliveredOutput(job, response) {
    if (!isStillMotionProduct(getVideoProduct(job.product_id))) return persistOutput(job, response);
    return persistStillMotionOutput(job, response);
  }

  function verifiedDeliveryForJob(job) {    const delivery = db.prepare("SELECT * FROM video_deliveries WHERE job_id = ? AND verification_state = 'verified'").get(job.id);
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
          feature: 'video_generation',
          provider: job.provider_route.startsWith('minimax') ? 'Poke' : 'IP233',
          model: job.provider_route,
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
    /* ═══ 2026-09-24 批 BA：内容拒绝要说清"下一步做什么"（doc 75 §三.2）═══════════════════════════
       原来这里一律写「本次没有交付成片，冻结积分已退回」—— 对**内容拒绝**这一种，用户读完
       不知道自己该改什么，于是原样再点一次（白烧一次调用）。⇒ 换成能照着做的那句话；
       退费这件事一个字没变（下面那条 releaseItem 原样调用，该退多少还是多少）。 */
    const failedText = isContentRejectionError(error)
      ? '素材或提示词未通过内容审核，请更换后重试（冻结积分已退回）'
      : '本次没有交付成片，冻结积分已退回';
    try {
      walletService.releaseItem(job.hold_id, 'video', {
        reason: `video_failed:${clean(error?.code || error?.message, 100) || 'unknown'}`,
        idempotencyKey: `video-release:${job.id}`,
        metadata: { taskId: job.id, productId: job.product_id, providerRoute: job.provider_route },
      });
      return updateJob(job.id, {
        status: 'failed',
        error: failedText,
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
      error: clean(message, 500) || '任务状态待自动核对，核对期间不会重复提交或结算积分',
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
        const jobProduct = getVideoProduct(job.product_id);
        /* 处理已有视频的产品（本机 lc / 上游火山）：报文不是"生成"那套（没有提示词/比例），
           而是"源视频 + 规格/区域"（本机）或"上传后的 mediakit:// + 自动检测"（火山）。 */
        const providerPayload = isProcessProduct(jobProduct)
          ? await processPayloadFor(jobProduct, job)
          : buildProviderPayload({ product: jobProduct, job }).body;
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
        /* ═══ 本地渲染：submit 返回时片子已经落盘，这里**不做轮询**（2026-09-25 批 AM）═══════
           上游那条路要 get() 轮询 1440 次等出片；本地是同步的（videoLocalAdapter.submit 内部就是
           renderVideo），所以只取一次终态、落库、走**既有的** complete()（计费结算、作品落库、
           项目投影都在里面）。⚠️ 不写"假轮询"（sleep 几次再问）—— 那只会让用户多等几秒，
           还会让失败分类变成"超时"而不是"渲染失败"。
           ⚠️ 2026-09-26 批 AR：判据从 localEngine 改成"处理已有视频且是**本机**执行" ——
              火山那条同样是 process 产品，但它**是异步上游**，要走下面的正常轮询（不能同步取终态）。 */
        if (jobProduct.localEngine === true) {
          const localResult = await provider.get(job.provider_task_id);
          if (clean(localResult?.status, 40).toLowerCase() !== 'completed' || !localResult?.downloadUrl) {
            throw httpError(502, 'VIDEO_LOCAL_RENDER_FAILED', clean(localResult?.reason, 200) || '本地渲染失败，请重试');
          }
          const output = await persistLocalOutput(job, localResult.downloadUrl);
          if (job.current_attempt_id) attemptStore.markDelivered(job.current_attempt_id);
          await complete(job, output);
          return;
        }
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
          const output = await persistDeliveredOutput(job, await provider.download(job.provider_task_id, result));
          if (job.current_attempt_id) attemptStore.markDelivered(job.current_attempt_id);
          await complete(job, output);
          return;
        }
        if (['failed', 'cancelled', 'canceled', 'error'].includes(status)) {
          /* ═══ 2026-09-24 批 BA：上游因**内容政策**把这一单判失败时，两条都不做 ═════════════════
             ① 不切备用网关 —— 备用网关执行的是**同一套内容政策**，同一份内容必被再拒一次；
             ② 不报"我们的故障" —— 交给下面那条统一的用户文案（"更换素材或提示词"）。
             用户原话：「有这种内容肯定是要**直接拒**的」（doc 75 §三.2 就是这一条）。 */
          const rejection = classifyContentRejection({ status: 0, detail: clean(result?.error, 500) });
          if (rejection.rejected) {
            if (job.current_attempt_id) {
              attemptStore.markFailed(job.current_attempt_id, {
                code: 'VIDEO_CONTENT_REJECTED',
                message: clean(result?.error, 300),
              });
            }
            throw Object.assign(new Error(CONTENT_REJECTION_MESSAGE), {
              status: 400,
              code: 'VIDEO_CONTENT_REJECTED',
              retryable: false,
              contentRejected: true,
              providerDetail: clean(result?.error, 300),
            });
          }
          /* 9-12 用户要求：视频同样要有备用供应商 —— routeId 就是模型名，所以「换供应商」= 换网关，模型不变。
             只切一次：provider_source 一旦记为 backup 就不再切，避免无限轮换；技术细节只进日志。 */
          const alternate = job.provider_source === 'backup' ? null : registry.alternate(job.product_id);
          if (alternate) {
            try {
              console.warn('[video-generation] provider failover', JSON.stringify({
                route: job.provider_route,
                detail: clean(result?.error, 200),
              }));
              /* 后台可查：把主通道这次失败如实记进尝试历史（失败原因我们自己看得到，用户侧不暴露） */
              if (job.current_attempt_id) {
                attemptStore.markFailed(job.current_attempt_id, {
                  code: 'VIDEO_PROVIDER_FAILED',
                  message: clean(result?.error, 300),
                });
              }
              const nextAttempt = attemptStore.begin({
                jobId: job.id,
                submissionKey: `${job.id}:backup:${nowMs()}`,
                payload: providerPayload,
                provider: alternate.protocol || job.provider_route,
                model: alternate.model || job.provider_route,
                capability: {
                  productId: job.product_id,
                  mode: job.mode,
                  duration: job.duration,
                  resolution: job.resolution,
                  aspectRatio: job.aspect_ratio,
                },
              });
              const resubmitted = await alternate.submit(providerPayload, nextAttempt.submission_key);
              attemptStore.markAccepted(nextAttempt.id, resubmitted.id);
              provider = alternate;
              job = updateJob(id, {
                status: 'processing',
                provider_task_id: clean(resubmitted.id, 200),
                provider_source: 'backup',
                current_attempt_id: nextAttempt.id,
                progress: 0,
                error: '',
              });
              continue;
            } catch (failoverError) {
              console.warn('[video-generation] provider failover failed', JSON.stringify({
                detail: clean(failoverError?.message, 200),
              }));
            }
          }
          throw httpError(502, 'VIDEO_PROVIDER_FAILED', '视频生成失败，请重试');
        }
        await new Promise(resolveDelay => setTimeout(resolveDelay, interval));
      }
      if (closed) return;
      throw httpError(504, 'VIDEO_PROVIDER_TIMEOUT', '视频任务仍未完成', { retryable: true });
    } catch (error) {
      job = selectJob.get(id) || job;
      if (error?.retryable && job.provider_task_id) {
        updateJob(id, { status: 'processing', error: '网络波动，正在自动继续确认' });
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
    /* ═══ 本地方案 vs 上游：从这里开始分成**两条输入契约**（2026-09-25 批 AM）══════════════════
       上游：提示词 + 比例 + 时长白名单 + 参考素材 + **方案闸门**（收了方案的钱，方案必须影响产出）；
       本地：一条源视频 + 规格（分辨率/帧率）或区域（框选字幕），**没有提示词、没有比例**。
       ⇒ 本地方案不套用上游那几道（提示词必填 / 比例必填 / 方案闸门 / validateVideoProductInput），
         因为它们要求的东西用户在一张只有"上传视频 + 分辨率"的页面上根本给不出来；
         反过来，本地会跑 validateLocalPlanInput（时长必须是真值、分辨率必须在白名单里、
         去字幕必须有区域）—— 校验一点没少，只是换成了这类方案真正需要的字段。
       ⚠️ 2026-09-26 批 AR：这批的 `processProduct` 把上面那段从"本地"推广成**"处理已有视频"**——
          本机执行（localEngine）与上游执行（videoProcess，目前只有火山自动字幕擦除）**共用同一份
          输入契约**，所以校验、方案闸门豁免、比例豁免都按同一个标记走；执行在哪由派发点决定。 */
    const processProduct = isProcessProduct(product);
    if (product.localEngine === true) {
      await assertLocalEngineReady();
    } else if (isStillMotionProduct(product)) {
      /* ═══ 「做成动图」的**建单前预检**（2026-09-27 批 DC-4）══════════════════════════════════
         这一档的成本在上游（¥0.91/条），但**交付前的裁切靠本机 ffmpeg** —— 换句话说：
         这台机器没有 ffmpeg 时，用户会被扣一次上游的钱、却拿不到 2~3 秒的动图。
         ⇒ 与"本地方案"同一条纪律（videoCatalog 的 local-ffmpeg 台账那段）：**缺了就 503、
            不建单、不冻结积分**。预检放建单前是有意的 —— 放在交付时才拦就变成"先扣再退"，
            用户会看到余额抖动（铁律①的变体，见 test/charge-requires-confirmation 末段）。 */
      await assertLocalEngineReady();
    } else if (product.videoProcess === true && product.credential === 'volc') {
      /* 上游处理（火山）：凭据缺失就 503，**不建单不冻结积分** —— 与 ffmpeg 预检同一条纪律。
         批 AU 起这里有两条路（字幕擦除 / 口型对齐），分开报原因：用户要知道缺的是哪一把钥匙。 */
      const ready = product.routeId === VOLC_LIPSYNC_ROUTE ? lipSyncAdapter.enabled : volcAdapter.enabled;
      if (!ready) {
        const code = product.routeId === VOLC_LIPSYNC_ROUTE ? 'VOLC_LIPSYNC_NOT_CONFIGURED' : 'VOLC_SUBTITLE_NOT_CONFIGURED';
        const reason = product.routeId === VOLC_LIPSYNC_ROUTE ? volcLipSyncReadiness('').reason : volcSubtitleReadiness('').reason;
        throw httpError(503, code, reason, { retryable: true });
      }
    } else if (!registry.get(product.id)?.enabled) {
      throw httpError(503, 'VIDEO_PROVIDER_NOT_CONFIGURED', '视频服务正在配置中');
    }
    const localPlan = processProduct ? (() => {
      try {
        return validateLocalPlanInput({ product, input });
      } catch (error) {
        throw httpError(400, error?.code || 'VIDEO_LOCAL_PLAN_INVALID', error.message);
      }
    })() : null;
    /* ═══ 方案闸门 + 编译（服务端权威 · 2026-09-18 总统筹拍板）═══════════════════
       改动前实测：构造一个「无方案」请求 → **202 建单成功**（46,000 单位被 hold）。
       前端只用 planReviewed 拦，构造请求就能绕过 —— 收钱不出活，且方案对成片零影响。
       现在两道都放在服务端：
         ① 闸门：没有可用方案 / 未确认 → 400（用户可读文案），**不出片、不扣费**；
         ② 编译：方案结构（分镜/节奏/必须保留）进 prompt 最前，风险约束进 negativePrompt。
       三层权威排序沿用 canvasPromptAuthority 的 PROMPT_LAYER（不新造一套）：
         硬约束(1) > 方案结构(2) > 用户内容文案(3)。
       ⚠️ 只对**上游生成**生效：本地方案的"方案"就是那份渲染清单（分辨率/帧率/区域），
          它已经由 validateLocalPlanInput 校验过，且不产生模型侧的口味问题 ——
          要一个"拍摄方案预览"再来处理一条已有视频，既不合逻辑也会凭空多收一次分析费。 */
    /* ═══ 2026-09-27 批 DC-4：「做成动图」与"处理已有视频"同一档待遇（跳过闸门与编译）══════════
       闸门存在的理由是**"方案是收了钱的、收了钱就必须影响产出"**（本文件上方 2026-09-18 那段）。
       而这一档**不收方案费**（它只有一条 video_live_photo_short = 上游 5 秒那条通道的钱，
       方案分析那 1 积分与它无关），用户给的输入也只有**一张成品图** —— 他手上不存在一份可确认的
       拍摄方案。⇒ 与 localEngine / videoProcess 那几条同一条纪律：**跳过闸门，但下面每一道校验
       （时长白名单 / 清晰度 / 参考素材 / 内容闸门 / 报价 hold）一个都不少**。
       ⚠️ 这一段刻意写在 IIFE **之前**：IIFE 里那两行 `const prompt = compiled.prompt;` 必须字面
          留在 createJob 内（test/video-plan-billing-chain-0918 守着"落库的 prompt 是编译结果"）。 */
    const stillMotion = isStillMotionProduct(product);
    let compiled = { planHash: '' };
    let prompt = '';
    let negativePrompt = '';
    if (stillMotion) {
      /* 提示词是我们自己的固定一句（在 stillMotion.mjs 里，理由也写在那里）——
         这一档没有"用户文案/方案"可编译，所以 plan_hash 保持空串（不冒充编译结果）。 */
      prompt = LIVE_PHOTO_PROMPT;
    }
    if (!processProduct && !stillMotion) {
      /* 上游那条路：闸门 + 编译**都在这里**（服务端权威，客户端绕不过）。
         用 IIFE 的意义只有一个：`const prompt = compiled.prompt` 这两行必须**字面留在
         createJob 内** —— test/video-plan-billing-chain-0918 与 plan-affects-output-audit-0918
         两条门禁守的就是"落库的 prompt 是编译结果"这件事，不该因为我加了本地分支而改判据。 */
      const upstream = (() => {
        assertVideoPlanConfirmed({
          plan: input?.videoPlan,
          planConfirmed: input?.planConfirmed === true,
        });
        const compiled = compileVideoRequest({
          prompt: input?.prompt,
          negativePrompt: input?.negativePrompt,
          plan: input?.videoPlan,
        });
        const prompt = compiled.prompt;
        const negativePrompt = compiled.negativePrompt;
        return { compiled, prompt, negativePrompt };
      })();
      compiled = upstream.compiled;
      prompt = upstream.prompt;
      negativePrompt = upstream.negativePrompt;
    }
    const duration = processProduct ? localPlan.duration : Number(input?.duration);
    const resolution = processProduct ? localPlan.resolution : clean(input?.resolution, 20).toLowerCase();
    /* 本地方案**不改比例**（原样交付，不裁不补）⇒ 记空串，不冒充一个它没用过的比例 */
    const aspectRatio = processProduct ? '' : clean(input?.aspectRatio, 20);
    const mode = processProduct
      ? (product.videoProcess === true ? 'process' : 'local')
      : (['script', 'frame', 'reference', 'remake'].includes(input?.mode) ? input.mode : 'script');
    /* ⚠️ 批 AU：把"这一单要不要驱动音频"一起落库 —— 数字人是按**音频秒数**计费的，
       事后对账（"这 6 秒是怎么来的"）只能靠这行；缺了它就只能翻上游账单倒推。
       ⚠️ 这里直接读产品声明，**不能**用下面那个 requiresAudio 常量：那行在本函数里声明的更晚，
          const 有暂时性死区（本仓 test/no-tdz-before-init 是硬门禁，2026-09-16 白屏事故同一类）。 */
    const localSpecs = processProduct
      ? { fps: localPlan.fps, regions: localPlan.regions, ...(product.localSpec?.audio === true ? { audio: true } : {}) }
      : null;
    const seed = Number.isSafeInteger(Number(input?.seed)) ? Number(input.seed) : 0;
    if (!processProduct && !prompt) throw httpError(400, 'VIDEO_PROMPT_REQUIRED', '请输入视频内容');
    /* ═══ 内容安全闸门 · 提示词侧（2026-09-24 批 AX）═════════════════════════════════════════════
       用户原话：「用户上传的素材和提示词都应该**先过一遍没问题再传输生成**，其实也是
       防止我们被中转站给 ban 掉」+「为什么还要重新花钱呢…没有低成本的过滤方案吗」+
       「有这种内容肯定是要**直接拒**的」。
       ⇒ 这一道**纯本地、零成本**（不调模型、毫秒级），命中即拒：
          **不建单、不冻结积分、一个字节都不发给上游**。
       ⚠️ 位置：放在**编译之后**（查的是真正要下发的那段文本，不是用户原始输入）——
          方案段与硬约束段也一起过一遍，否则有人可以把违规内容塞进"必须保留"那段绕过去。
       ⚠️ 覆盖边界：这一道只管**文本**；图片素材的分级是第二阶段（见 docs/design/75），
          这里不假装覆盖了它。 */
    if (!processProduct) {
      const screen = screenPromptText(`${prompt}\n${negativePrompt}`);
      if (!screen.ok) {
        throw httpError(400, 'VIDEO_PROMPT_BLOCKED', `${screen.reason}。请修改后重试（本次未扣费）。`);
      }
    }
    if (!processProduct) {
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
    }
    const references = normalizeReferences(ownerEmail, input?.references, publicBaseUrl);
    if (processProduct && references.videos.length !== 1) {
      throw httpError(400, 'VIDEO_LOCAL_SOURCE_REQUIRED', '请先上传要处理的视频（一次一条）');
    }
    /* 「做成动图」吃的是**恰好一张静图**（那就是被做成动图的那张成品图）：
       0 张无事可做、多张会变成"图生视频的参考图"（模型会自由编，裁出来的 2.5 秒就不是用户那张图了）。
       ⚠️ 同样放在建单前：缺输入是用户现在就能补齐的事，不该等扣完钱才发现。 */
    if (stillMotion && references.images.length !== 1) {
      throw httpError(400, 'VIDEO_STILL_SOURCE_REQUIRED', '请先选一张成品图，再把这张图做成动图');
    }
    /* ═══ 有的方案**还要一样输入**：驱动音频（2026-09-26 批 AU，数字人口型对齐）══════════════════
       `localSpec.audio: true` 的产品（目前只有 lipsync_volc）必须恰好一个音频 ——
       产出长度由音频决定、没有音频这条链路无事可做。
       ⚠️ 为什么放在**建单前**：建单后才发现缺音频，任务会落 failed 并退费（用户白等一轮）。
          缺什么输入是"用户现在就能补齐"的事，就该在扣费之前说清楚。 */
    const requiresAudio = processProduct && product.localSpec?.audio === true;
    if (requiresAudio && references.audios.length !== 1) {
      throw httpError(400, 'VIDEO_AUDIO_REFERENCE_REQUIRED', '请上传一段驱动配音（一次一段）');
    }
    /* ═══ 本地方案的时长必须与源文件相符（2026-09-25 批 AM）══════════════════════════════════════
       去字幕**按秒计费**，而秒数是客户端报上来的（浏览器读元数据）—— 不核对的话，
       报 1 秒、实际 60 秒就是少收 59 秒的钱（0.04 积分/秒 → 少收 2.36 积分）。
       所以建单前用 ffprobe 量一次**真实时长**：明显短报（>2 秒）直接拒，不建单、不收费。
       ⚠️ 量不出来（ffprobe 不可用/容器异常）不拦：宁可放行也不误伤正常用户 ——
          上面那道 ffmpegAvailable 预检已经保证"本机能渲染"，这里只是多一道防少报的闸。 */
    if (processProduct) {
      /* 有驱动音频的方案（数字人）按**音频**量时长：产出长度由音频决定，视频时长与账无关 */
      const probed = requiresAudio ? await probeAudioSeconds(references) : await probeSourceSeconds(references);
      if (probed && localPlan.duration < probed - 2) {
        throw httpError(400, 'VIDEO_LOCAL_DURATION_MISMATCH',
          `${requiresAudio ? '配音时长' : '视频时长'}与申报不符（申报 ${localPlan.duration} 秒，实际约 ${Math.round(probed)} 秒），请重新选择文件`);
      }
    }
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
    /* ═══ 计费数量（2026-09-25 批 AM）══════════════════════════════════════════════════════════
       原来恒为 `quoteFeature(sku, 1)`（按条）。去字幕是**按秒**计价（用户批准的 0.04 积分/秒），
       所以数量改由 catalog 的 billableQuantity 统一裁定：perSecond 的 SKU 取秒数，其余恒为 1。
       ⚠️ 前端的报价令牌必须用同一个数量（它从 /api/video/capabilities 的 billingQuantity 读规则），
          否则 quoteService.verify 逐字段比对会 409；这条一致性由 test/video-local-dispatch-0925 守。 */
    const quantity = billableQuantity({ sku, seconds: duration });
    const expectedQuote = quoteFeature(sku, quantity);
    /* ⚠️ 这一单的**真实上游成本**（批 AR）：按秒的 SKU 的 providerCostCny 记的是"每秒成本"
       （与 units 一样按秒归一，否则启动期的单位毛利门禁会误判），所以入账要乘上份数。
       按条档 quantity=1 ⇒ 与从前逐值相同（既有档位一个字节没变）。
       ⚠️ 2026-10-04：**必须把 duration 一起传进去**。平价档（火山自动去字幕 ≤60 秒）
          的 quantity 是 1，只按 quantity 记会把 60 秒那条单记成 ¥0.0067 而不是 ¥0.40 ——
          账面凭空多出 98% 的利润。成本按**真实秒数**记，售价按平价，两者本就是两个数。 */
    const jobProviderCostCny = billableProviderCost({ sku, quantity, seconds: duration });
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
          /* ⚠️ 冻结的是 **totalUnits**（= units × 数量），不是单价 —— walletService.createHold
             把 items[].units 直接求和当成冻结额。按条的 SKU 两者相等（数量 1，以前看不出差别），
             但按秒的 SKU 若写成 units 就只冻 0.04 积分（12 秒的片子少冻 440 units）。
             这条由 test/video-local-dispatch-0925 的第⑤条钉住（480 = 40 × 12）。 */
          items: [{ key: 'video', sku, units: expectedQuote.totalUnits }],
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
        product_id, provider_route, catalog_version, provider_cost_cny, failure_class, quote_id, plan_hash,
        local_specs
      ) VALUES (?, ?, ?, 'queued', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
        id, ownerEmail, requestKey, mode, sku, prompt, negativePrompt, duration, aspectRatio,
        resolution, input?.generateAudio === false ? 0 : 1, seed, JSON.stringify(references), hold.id,
        product.id, product.routeId, VIDEO_CATALOG_VERSION, jobProviderCostCny, '', verified.quoteId,
        compiled.planHash || '',
        localSpecs ? JSON.stringify(localSpecs) : '',
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
    if (!taskId) throw httpError(400, 'VIDEO_PROVIDER_TASK_REQUIRED', '缺少任务编号');
    if (job.current_attempt_id) attemptStore.attachProviderTask(job.current_attempt_id, taskId);
    const resolved = updateJob(job.id, {
      status: 'processing',
      provider_task_id: taskId,
      error: '已确认任务，正在继续获取生成结果',
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
      updateJob(job.id, { status: 'processing', failure_class: '', error: '正在重新核对结果' });
      enqueue(job.id);
    } else if (job.status === 'queued') {
      enqueue(job.id);
    } else {
      markSubmissionUnknown(job, '尚未取得任务编号，已延长人工核对期；不会自动重复提交');
    }
    return serializeOwnedJob(selectJob.get(job.id));
  }

  function confirmNotSubmitted(jobId, input = {}) {
    const job = selectJob.get(clean(jobId, 140));
    if (!job || job.status !== 'needs_review' || !['submission_unknown', 'manual_quarantine'].includes(job.failure_class)) {
      throw httpError(409, 'VIDEO_OPERATION_STATE_INVALID', '只有待核对且尚无任务编号的任务可以确认未受理');
    }
    if (job.provider_task_id) throw httpError(409, 'VIDEO_PROVIDER_TASK_EXISTS', '任务已有任务编号，不能标记为未受理');
    if (job.current_attempt_id) attemptStore.markNotSubmitted(job.current_attempt_id, input.reason);
    return serializeOwnedJob(updateJob(job.id, {
      status: 'needs_review',
      failure_class: 'confirmed_not_submitted',
      error: '已确认未受理，可安全重新提交',
      review_deadline_ms: 0,
    }));
  }

  function retryConfirmedNotSubmitted(jobId) {
    const job = selectJob.get(clean(jobId, 140));
    if (!job || job.status !== 'needs_review' || job.failure_class !== 'confirmed_not_submitted'
      || job.provider_task_id || job.billing_state !== 'held') {
      throw httpError(409, 'VIDEO_OPERATION_STATE_INVALID', '任务尚未确认“未受理”，不能安全重试');
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
      throw httpError(409, 'VIDEO_OPERATION_STATE_INVALID', '该任务已受理或已经结束，不能隔离');
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
        markSubmissionUnknown(selectJob.get(row.id), '服务重启前的任务状态待核对，核对期间不会重复提交或结算积分');
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
          /* 本地方案的"配置好了没"= 本机有没有 ffmpeg（它没有上游 adaptor 可问） */
          configured: isLocalEngineProduct(product) ? localEngineReady : adapter?.enabled === true,
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
      /* ═══ 自动标记那一档的可售状态（2026-09-26 批 AR）═════════════════════════════════════════
         「视频字幕去除」页上的「自动标记」选项**只有在** ①产品已公开（跑过一次真片子、台账转 callable）
         且 ②凭据已配 时才可点。两个条件缺一，前端就保持"不可选 + 写明原因"（现在的默认状态）。
         这份状态是**只读**的：前端只拿它决定要不要放开那个选项，价格仍走 /api/billing/quote。 */
      const subtitleAutoProduct = getVideoProduct('desubtitle_volc');
      const subtitleAutoReady = subtitleAutoProduct.public === true && volcAdapter.enabled === true;
      /* 报价从这里给（与 localProducts 同一形状）：页面上那一档的价格**来自目录**，不在页面里写死 */
      const autoSkuShort = videoFeatureSku({ productId: subtitleAutoProduct.id, duration: subtitleAutoProduct.durations.min });
      const autoSkuLong = videoFeatureSku({ productId: subtitleAutoProduct.id, duration: Math.max(subtitleAutoProduct.durations.min, Math.min(9, subtitleAutoProduct.durations.max)) });
      const autoQuantityOf = sku => (FEATURE_SKUS[sku]?.perSecond === true ? 'seconds' : 'clip');
      /* ⚠️ 2026-10-04：与 localVideoProducts 同一件事 —— 平价档（自动去字幕）的封顶
         必须从目录发下去，页面才敢显示那个"固定的费用"。这里不发，页面就只能写死 60。 */
      const autoFlatOf = sku => ({
        flatUnits: Number.isSafeInteger(FEATURE_SKUS[sku]?.flatUnits) ? FEATURE_SKUS[sku].flatUnits : null,
        flatMaxSeconds: Number.isFinite(FEATURE_SKUS[sku]?.flatMaxSeconds) ? FEATURE_SKUS[sku].flatMaxSeconds : null,
      });
      const autoQuoteOf = sku => ({
        sku,
        units: quoteFeature(sku, 1).units,
        points: Math.ceil(quoteFeature(sku, 1).units / 1000),
        ...autoFlatOf(sku),
      });
      const subtitleAuto = {
        productId: subtitleAutoProduct.id,
        available: subtitleAutoReady,
        mode: 'auto',
        billingQuantity: autoQuantityOf(autoSkuShort),
        /* ═══ 2026-09-26 批 AZ：**页面要用的那几样一并给出去**（与 localProducts 同一形状）════════
           原先页面自己写死了一份 `{ resolution:false, fps:false, regions:false, auto:true }` 的
           镜像 —— 那就是"产品目录之外还有第二份真相"：目录一改（例如这一档以后要框选区域），
           页面不会跟着改，而且没人会发现。现在从**产品声明**派生，页面只读不算。 */
        localSpec: { ...subtitleAutoProduct.localSpec },
        modes: [...subtitleAutoProduct.modes],
        durations: { ...subtitleAutoProduct.durations },
        label: subtitleAutoProduct.label,
        quotes: {
          short: autoQuoteOf(autoSkuShort),
          long: autoQuoteOf(autoSkuLong),
        },
        flatMaxSeconds: autoFlatOf(autoSkuShort).flatMaxSeconds,
        reason: subtitleAutoReady
          ? ''
          : (!volcAdapter.enabled
            ? volcSubtitleReadiness('').reason
            : '自动标记尚未完成首次实测（等火山账户充值到位、跑通一次真片子后开放）'),
      };
      /* ═══ 数字人（口型对齐）那一档的可售状态（2026-09-26 批 AU；批 AZ 接线完成）══════════════════
         与 subtitleAuto 同一形状（只读）：前端只拿它决定"这一页能不能点"，
         价格仍走目录里的 SKU。批 AU 时这里**必然不可用**（台账 unverified + 价没签字）；
         批 AX 把"实测"与"定价"两道门清了，批 AZ 把最后一道（创作台接线）也接完 ——
         所以现在两个条件（产品公开 + 凭据齐）一满足就是可售，reason 只剩如实的原因。
         ⚠️ 页面要用的字段（露哪几格 / 建单模式 / 时长上限）也从**产品声明**派生 ——
            页面不写死 `audio: true` 这类判据，否则目录一改两边就漂移（见 subtitleAuto 那段）。 */
      const lipSyncProduct = getVideoProduct('lipsync_volc');
      const lipSyncSkuShort = videoFeatureSku({ productId: lipSyncProduct.id, duration: lipSyncProduct.durations.min });
      const lipSyncSkuLong = videoFeatureSku({ productId: lipSyncProduct.id, duration: Math.max(lipSyncProduct.durations.min, Math.min(9, lipSyncProduct.durations.max)) });
      const lipSyncQuote = sku => ({ sku, units: quoteFeature(sku, 1).units, points: Math.ceil(quoteFeature(sku, 1).units / 1000) });
      const digitalHuman = {
        productId: lipSyncProduct.id,
        label: lipSyncProduct.label,
        available: lipSyncProduct.public === true && lipSyncAdapter.enabled === true,
        requiresAudio: true,
        billingQuantity: FEATURE_SKUS[lipSyncSkuShort]?.perSecond === true ? 'seconds' : 'clip',
        localSpec: { ...lipSyncProduct.localSpec },
        modes: [...lipSyncProduct.modes],
        durations: { ...lipSyncProduct.durations },
        quotes: { short: lipSyncQuote(lipSyncSkuShort), long: lipSyncQuote(lipSyncSkuLong) },
        reason: lipSyncProduct.public === true && lipSyncAdapter.enabled === true
          ? ''
          : (!lipSyncAdapter.enabled
            ? volcLipSyncReadiness('').reason
            /* ═══ 2026-09-26 批 AZ：这道门的措辞**第三次**跟着事实改 ═══════════════════════════
               ① 批 AU 写的是"尚未完成首次实测与定价确认"；② 批 AX 两条都清了，改成"创作台还在接线"；
               ③ 本批把接线做完（音频槽位探针 + 按音频秒报价 + 生成闸门按 available 放开），
                  "接线"这个理由**不存在了** —— 只剩下"产品被下架"这一种如实的原因。
               判据的本意一个字没变：**不许写安慰话，要写清是哪一道没过**。 */
            : '数字人暂时停售（产品未公开），已上传的素材不会计费'),
      };
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
        /* ═══ 本地方案（2026-09-25 批 AM）：与"模型"分开放的只读清单 ═══════════════════════════
           两条 skill 子页面（视频高清 / 视频字幕去除）按这份清单选产品、算价、决定露哪几格。
           **不进 products**：它们不是模型 —— 混进模型下拉，用户会在"视频创作"里选到一条
           不吃提示词的档位（点了必失败，见 videoCatalog 的说明）。
           `localEngineReady` 是本机能不能渲染的**实测**结果（ffmpeg 在不在）：前端据此
           把"点了必失败"变成"如实说明 + 不可点"。 */
        localProducts: localVideoProducts({ includeHidden: allowHiddenProducts }),
        localEngineReady,
        /* 自动标记那一档能不能点（只读；产品公开 + 凭据齐 才算就绪，见上面那段注释） */
        subtitleAuto,
        /* 数字人（口型对齐）能不能点（只读；同样是"产品公开 + 凭据齐"，另加"价已签字"这个前提） */
        digitalHuman,
        unavailableProducts: registry.unavailableProducts(),
        /* ⚠️ 2026-09-19 批 H-7：**只读**的"未上架模型"清单，给界面一句实话用。
           用户原话：「我们之前明明做了特别多的模型啊。起码有差不多 10 个模型吧，为什么现在都不见了呢？」
           —— 目录里确实有 10 个，但只有 2 个 public:true，界面上一个字都没说。
           这份清单**不参与**产品选择 / 路由 / 计费：没有 quotes、没有 resolutions、没有 modes，
           前端拿到它只能渲染成一行说明（见 VideoStudio 的模型下拉底部）。 */
        unavailableProducts: registry.unavailableProducts(),
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

export async function readRequestBuffer(req, maxBytes, kind = 'video') {
  const declared = Number(req.headers['content-length'] || 0);
  if (declared > maxBytes) throw httpError(413, 'VIDEO_ASSET_SIZE_INVALID', mediaTooLarge(kind, declared));
  const chunks = [];
  let bytes = 0;
  for await (const chunk of req) {
    bytes += chunk.length;
    if (bytes > maxBytes) throw httpError(413, 'VIDEO_ASSET_SIZE_INVALID', mediaTooLarge(kind, bytes));
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
