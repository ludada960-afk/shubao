import crypto from 'node:crypto';
import fs from 'node:fs';
import { rename, stat, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { quoteFeature } from './billing/catalog.mjs';

const FINAL_STATUSES = new Set(['completed', 'failed', 'needs_review']);
const ACTIVE_STATUSES = new Set(['queued', 'submitting', 'processing']);
const RATIOS = new Set(['21:9', '16:9', '4:3', '1:1', '3:4', '9:16']);
const RESOLUTIONS = new Set(['480p', '720p']);
const INPUT_LIMITS = Object.freeze({ image: 10 * 1024 * 1024, video: 50 * 1024 * 1024, audio: 15 * 1024 * 1024 });
const OUTPUT_LIMIT = 100 * 1024 * 1024;
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

export function videoFeatureSku({ resolution, duration }) {
  const safeResolution = RESOLUTIONS.has(resolution) ? resolution : '480p';
  const suffix = Number(duration) <= 8 ? 'short' : 'long';
  return `video_seedance_${safeResolution}_${suffix}`;
}

function parseJson(value, fallback) {
  try { return JSON.parse(value || ''); } catch { return fallback; }
}

function serializeJob(row) {
  if (!row) return null;
  return {
    id: row.id,
    status: row.status,
    mode: row.mode,
    sku: row.sku,
    prompt: row.prompt,
    duration: row.duration,
    aspectRatio: row.aspect_ratio,
    resolution: row.resolution,
    generateAudio: row.generate_audio === 1,
    seed: row.seed,
    references: parseJson(row.refs_json, {}),
    progress: row.progress,
    resultUrl: row.result_url || '',
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
  baseUrl,
  model,
  fetchImpl,
  pollIntervalMs = 5000,
  maxConcurrent = 2,
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
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      UNIQUE(owner_email, idempotency_key)
    );
    CREATE INDEX IF NOT EXISTS idx_video_jobs_owner ON video_jobs(owner_email, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_video_jobs_status ON video_jobs(status, updated_at);
  `);

  const provider = createVideoProvider({ apiKey, baseUrl, model, fetchImpl });
  const selectJob = db.prepare('SELECT * FROM video_jobs WHERE id = ?');
  const active = new Set();
  const queued = [];
  let running = 0;

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

  function publicAssetUrl(publicBaseUrl, id) {
    return `${clean(publicBaseUrl, 500).replace(/\/+$/, '')}/api/video/assets/${encodeURIComponent(id)}`;
  }

  async function uploadAsset({ ownerEmail, kind, contentType, buffer, publicBaseUrl }) {
    if (!Object.hasOwn(INPUT_LIMITS, kind)) throw httpError(400, 'VIDEO_ASSET_KIND_INVALID', '素材类型不支持');
    const normalizedType = clean(contentType, 100).toLowerCase().split(';')[0];
    if (!CONTENT_TYPES[kind].has(normalizedType)) throw httpError(415, 'VIDEO_ASSET_TYPE_INVALID', '素材文件格式不支持');
    if (!Buffer.isBuffer(buffer) || !buffer.length || buffer.length > INPUT_LIMITS[kind]) {
      throw httpError(413, 'VIDEO_ASSET_SIZE_INVALID', '素材文件大小不符合要求');
    }
    const id = `${crypto.randomUUID()}${extensionFor(normalizedType)}`;
    const fileName = resolve(inputRoot, id);
    await writeFile(fileName, buffer, { flag: 'wx' });
    db.prepare('INSERT INTO video_assets (id, owner_email, kind, content_type, bytes, file_name) VALUES (?, ?, ?, ?, ?, ?)')
      .run(id, ownerEmail, kind, normalizedType, buffer.length, basename(fileName));
    return { id, kind, contentType: normalizedType, bytes: buffer.length, url: publicAssetUrl(publicBaseUrl, id) };
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
      urls: Object.fromEntries(rows.map(row => [row.id, publicAssetUrl(publicBaseUrl, row.id)])),
    };
  }

  function providerPayload(job) {
    const refs = parseJson(job.refs_json, {});
    const urls = refs.urls || {};
    const payload = {
      prompt: job.prompt,
      duration: job.duration,
      aspect_ratio: job.aspect_ratio,
      resolution: job.resolution,
      generate_audio: job.generate_audio === 1,
      seed: job.seed,
    };
    if (job.negative_prompt) payload.negative_prompt = job.negative_prompt;
    if (job.mode === 'frame') {
      payload.first_image_url = urls[refs.firstImage];
      payload.last_image_url = urls[refs.lastImage];
    } else if (job.mode !== 'script') {
      payload.reference_image_urls = refs.images.map(id => urls[id]);
      payload.reference_video_urls = refs.videos.map(id => urls[id]);
      payload.reference_audio_urls = refs.audios.map(id => urls[id]);
    }
    return payload;
  }

  async function persistOutput(job, response) {
    const contentType = clean(response.headers.get('content-type'), 100).split(';')[0] || 'video/mp4';
    if (!contentType.startsWith('video/')) throw httpError(502, 'VIDEO_OUTPUT_TYPE_INVALID', '上游没有交付有效视频');
    const declaredBytes = Number(response.headers.get('content-length') || 0);
    if (declaredBytes > OUTPUT_LIMIT) throw httpError(502, 'VIDEO_OUTPUT_SIZE_INVALID', '上游视频文件过大');
    const buffer = Buffer.from(await response.arrayBuffer());
    if (!buffer.length || buffer.length > OUTPUT_LIMIT) throw httpError(502, 'VIDEO_OUTPUT_SIZE_INVALID', '上游视频文件无效');
    const id = `${crypto.randomUUID()}${extensionFor(contentType) || '.mp4'}`;
    const tempPath = resolve(outputRoot, `.${id}.tmp`);
    const finalPath = resolve(outputRoot, id);
    await writeFile(tempPath, buffer, { flag: 'wx' });
    await rename(tempPath, finalPath);
    db.prepare('INSERT INTO video_assets (id, owner_email, kind, content_type, bytes, file_name) VALUES (?, ?, ?, ?, ?, ?)')
      .run(id, job.owner_email, 'output', contentType, buffer.length, basename(finalPath));
    return { id, contentType, bytes: buffer.length, url: `/api/video/assets/${id}` };
  }

  async function complete(job, output) {
    const quote = quoteFeature(job.sku, 1);
    const settlement = walletService.settleItem(job.hold_id, 'video', {
      referenceType: 'video_generation',
      referenceId: output.id,
      providerCostCny: quote.providerCostCny,
      idempotencyKey: `video-settle:${job.id}`,
      metadata: { taskId: job.id, model: provider.model, resolution: job.resolution, duration: job.duration },
    });
    updateJob(job.id, {
      status: 'completed',
      progress: 100,
      result_asset_id: output.id,
      result_url: output.url,
      error: '',
    });
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
      video_url: output.url,
      video: {
        url: output.url,
        duration: job.duration,
        aspectRatio: job.aspect_ratio,
        resolution: job.resolution,
        generateAudio: job.generate_audio === 1,
        model: provider.model,
      },
      billing: { status: settlement.status, currency: quote.currency },
    }, { ownerEmail: job.owner_email });
  }

  async function fail(job, error) {
    try {
      walletService.releaseItem(job.hold_id, 'video', {
        reason: `video_failed:${clean(error?.code || error?.message, 100) || 'unknown'}`,
        idempotencyKey: `video-release:${job.id}`,
        metadata: { taskId: job.id, model: provider.model },
      });
    } catch {}
    updateJob(job.id, { status: 'failed', error: '本次没有交付成片，冻结积分已退回', progress: 0 });
  }

  async function processJob(id) {
    let job = selectJob.get(id);
    if (!job || FINAL_STATUSES.has(job.status)) return;
    try {
      if (!job.provider_task_id) {
        if (job.status === 'submitting') {
          updateJob(id, { status: 'needs_review', error: '上游受理结果待确认，未重复提交也未结算积分' });
          return;
        }
        updateJob(id, { status: 'submitting', error: '' });
        const submitted = await provider.submit(providerPayload(job), job.id);
        job = updateJob(id, {
          status: 'processing',
          provider_task_id: clean(submitted.id, 200),
          progress: Math.max(0, Math.min(99, Number(submitted.progress) || 0)),
        });
      }
      let transientFailures = 0;
      for (let attempt = 0; attempt < 1440; attempt += 1) {
        let result;
        try {
          result = await provider.get(job.provider_task_id);
          transientFailures = 0;
        } catch (error) {
          if (!error?.retryable || transientFailures >= 20) throw error;
          transientFailures += 1;
          await new Promise(resolveDelay => setTimeout(resolveDelay, pollIntervalMs));
          continue;
        }
        const status = clean(result.status, 40).toLowerCase();
        const progress = Math.max(job.progress || 0, Math.min(99, Number(result.progress) || 0));
        updateJob(id, { status: 'processing', progress });
        if (status === 'completed') {
          const output = await persistOutput(job, await provider.download(job.provider_task_id));
          await complete(job, output);
          return;
        }
        if (['failed', 'cancelled', 'canceled', 'error'].includes(status)) {
          throw httpError(502, 'VIDEO_PROVIDER_FAILED', '上游未能生成视频');
        }
        await new Promise(resolveDelay => setTimeout(resolveDelay, pollIntervalMs));
      }
      throw httpError(504, 'VIDEO_PROVIDER_TIMEOUT', '视频任务仍未完成', { retryable: true });
    } catch (error) {
      job = selectJob.get(id) || job;
      if (error?.retryable && job.provider_task_id) {
        updateJob(id, { status: 'processing', error: '上游连接波动，正在自动继续确认' });
        const timer = setTimeout(() => enqueue(id), 15_000);
        timer.unref?.();
        return;
      }
      await fail(job, error);
    }
  }

  function drain() {
    while (running < maxConcurrent && queued.length) {
      const id = queued.shift();
      if (active.has(id)) continue;
      active.add(id);
      running += 1;
      void processJob(id).finally(() => {
        active.delete(id);
        running -= 1;
        drain();
      });
    }
  }

  function enqueue(id) {
    if (!active.has(id) && !queued.includes(id)) queued.push(id);
    drain();
  }

  async function createJob({ ownerEmail, idempotencyKey, billingQuoteId, publicBaseUrl, input }) {
    if (!provider.enabled) throw httpError(503, 'VIDEO_PROVIDER_NOT_CONFIGURED', '视频服务正在配置中');
    const requestKey = clean(idempotencyKey, 120);
    if (!requestKey) throw httpError(400, 'VIDEO_IDEMPOTENCY_REQUIRED', '缺少防重复提交标识');
    const replay = db.prepare('SELECT * FROM video_jobs WHERE owner_email = ? AND idempotency_key = ?').get(ownerEmail, requestKey);
    if (replay) return { job: serializeJob(replay), replay: true };
    const activeCount = db.prepare("SELECT COUNT(*) AS count FROM video_jobs WHERE owner_email = ? AND status IN ('queued','submitting','processing')").get(ownerEmail).count;
    if (activeCount >= 2) throw httpError(429, 'VIDEO_USER_CONCURRENCY_LIMIT', '同一账号最多同时处理 2 个视频任务');

    const prompt = clean(input?.prompt, 1200);
    const negativePrompt = clean(input?.negativePrompt, 1200);
    const duration = Number(input?.duration);
    const resolution = clean(input?.resolution, 20);
    const aspectRatio = clean(input?.aspectRatio, 20);
    const mode = ['script', 'frame', 'reference', 'remake'].includes(input?.mode) ? input.mode : 'script';
    const seed = Number.isSafeInteger(Number(input?.seed)) ? Number(input.seed) : 0;
    if (!prompt) throw httpError(400, 'VIDEO_PROMPT_REQUIRED', '请输入视频内容');
    if (!Number.isSafeInteger(duration) || duration < 4 || duration > 15) throw httpError(400, 'VIDEO_DURATION_INVALID', '视频时长必须为 4 到 15 秒');
    if (!RESOLUTIONS.has(resolution) || !RATIOS.has(aspectRatio)) throw httpError(400, 'VIDEO_FORMAT_INVALID', '视频规格不支持');
    const references = normalizeReferences(ownerEmail, input?.references, publicBaseUrl);
    if (mode === 'frame' && (!references.firstImage || !references.lastImage)) throw httpError(400, 'VIDEO_FRAME_REQUIRED', '首尾帧模式需要两张图片');
    if (mode === 'reference' && !references.images.length && !references.videos.length && !references.audios.length) {
      throw httpError(400, 'VIDEO_REFERENCE_REQUIRED', '多模态参考至少需要一个图片、视频或音频素材');
    }
    if (mode === 'remake' && !references.images.length) throw httpError(400, 'VIDEO_REFERENCE_IMAGE_REQUIRED', '爆款重构至少需要一张商品图片');
    if (mode === 'remake' && !references.videos.length) throw httpError(400, 'VIDEO_REMAKE_SOURCE_REQUIRED', '爆款重构需要一个参考视频');

    const sku = videoFeatureSku({ resolution, duration });
    const expectedQuote = quoteFeature(sku, 1);
    const verified = quoteService.verify({ quoteId: clean(billingQuoteId, 5000), ownerEmail, expectedQuote });
    const id = crypto.randomUUID();
    let hold;
    try {
      hold = walletService.createHold({
        ownerEmail,
        currency: verified.currency,
        quoteId: verified.quoteId,
        idempotencyKey: `video-hold:${id}`,
        expiresAt: verified.expiresAt,
        items: [{ key: 'video', sku, units: expectedQuote.units }],
        metadata: { source: 'video_generation', taskId: id, model: provider.model },
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
      duration, aspect_ratio, resolution, generate_audio, seed, refs_json, hold_id
    ) VALUES (?, ?, ?, 'queued', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      id, ownerEmail, requestKey, mode, sku, prompt, negativePrompt, duration, aspectRatio,
      resolution, input?.generateAudio === false ? 0 : 1, seed, JSON.stringify(references), hold.id,
    );
    enqueue(id);
    return { job: serializeJob(selectJob.get(id)), replay: false };
  }

  async function readAsset(id) {
    const safeId = basename(clean(id, 140));
    const row = db.prepare('SELECT * FROM video_assets WHERE id = ?').get(safeId);
    if (!row) return null;
    const folder = row.kind === 'output' ? outputRoot : inputRoot;
    const filePath = resolve(folder, row.file_name);
    try {
      const info = await stat(filePath);
      return { row, filePath, size: info.size };
    } catch { return null; }
  }

  function recover() {
    const rows = db.prepare("SELECT id, status, provider_task_id FROM video_jobs WHERE status IN ('queued','submitting','processing') ORDER BY created_at").all();
    for (const row of rows) {
      if (row.status === 'submitting' && !row.provider_task_id) {
        updateJob(row.id, { status: 'needs_review', error: '服务重启前的上游受理结果待确认，未重复提交也未结算积分' });
      } else {
        enqueue(row.id);
      }
    }
  }

  return {
    capabilities() {
      return {
        generationEnabled: provider.enabled,
        model: provider.model,
        billing: { currency: 'ec_points', unit: 'generation', providerCostCny: 4.355 },
        durations: { min: 4, max: 15 },
        resolutions: ['480p', '720p'],
        aspectRatios: [...RATIOS],
        qualities: [
          { sku: 'video_seedance_480p_short', resolution: '480p', duration: '4-8', points: 32 },
          { sku: 'video_seedance_480p_long', resolution: '480p', duration: '9-15', points: 40 },
          { sku: 'video_seedance_720p_short', resolution: '720p', duration: '4-8', points: 48 },
          { sku: 'video_seedance_720p_long', resolution: '720p', duration: '9-15', points: 58 },
        ],
      };
    },
    uploadAsset,
    createJob,
    getJob(ownerEmail, id) { return serializeJob(jobForOwner(ownerEmail, id)); },
    listJobs(ownerEmail, limit = 20) {
      return db.prepare('SELECT * FROM video_jobs WHERE owner_email = ? ORDER BY created_at DESC LIMIT ?')
        .all(ownerEmail, Math.max(1, Math.min(50, Number(limit) || 20))).map(serializeJob);
    },
    readAsset,
    recover,
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

export function sendVideoAsset(req, res, asset) {
  const range = clean(req.headers.range, 100);
  res.setHeader('Content-Type', asset.row.content_type);
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Cache-Control', asset.row.kind === 'output' ? 'private, max-age=86400' : 'public, max-age=3600');
  if (!range) {
    res.setHeader('Content-Length', asset.size);
    fs.createReadStream(asset.filePath).pipe(res);
    return;
  }
  const match = /^bytes=(\d*)-(\d*)$/.exec(range);
  if (!match) return res.status(416).end();
  const start = match[1] ? Number(match[1]) : 0;
  const end = match[2] ? Math.min(Number(match[2]), asset.size - 1) : asset.size - 1;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end < start || start >= asset.size) return res.status(416).end();
  res.status(206);
  res.setHeader('Content-Range', `bytes ${start}-${end}/${asset.size}`);
  res.setHeader('Content-Length', end - start + 1);
  fs.createReadStream(asset.filePath, { start, end }).pipe(res);
}
