import { getVideoProduct, publicVideoProducts, unavailableVideoProducts, VIDEO_PRODUCTS } from './videoCatalog.mjs';

function clean(value, max = 500) {
  return String(value ?? '').trim().slice(0, max);
}

function parseJson(value, fallback = {}) {
  if (value && typeof value === 'object') return value;
  try { return JSON.parse(String(value || '')); } catch { return fallback; }
}

function errorWithCode(status, code, message, details = {}) {
  return Object.assign(new Error(message), { status, code, ...details });
}

function responseId(value) {
  const candidates = [
    value?.id,
    value?.task_id,
    value?.task?.id,
    value?.task?.task_id,
    value?.data?.id,
    value?.data?.task_id,
    value?.data?.task?.id,
    value?.result?.id,
    value?.result?.task_id,
  ];
  return candidates.map(item => clean(item, 200)).find(Boolean) || '';
}

function progressValue(value, fallback = 0) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(0, Math.min(100, Math.round(number)));
}

function statusValue(value) {
  const normalized = clean(value, 60).toLowerCase().replace(/[-\s]+/g, '_');
  if (['queued', 'pending', 'created', 'waiting'].includes(normalized)) return 'queued';
  if (['processing', 'in_progress', 'running', 'executing', 'generating'].includes(normalized)) return 'processing';
  if (['completed', 'complete', 'succeeded', 'success', 'done'].includes(normalized)) return 'completed';
  if (['failed', 'failure', 'error', 'cancelled', 'canceled', 'rejected'].includes(normalized)) return 'failed';
  return normalized || 'unknown';
}

export function normalizeProviderStatus(value = {}) {
  const source = value?.task || value?.data?.task || value?.data || value?.result || value || {};
  const status = statusValue(source.status || value.status);
  const downloadUrl = clean(
    source?.content?.url
      || source?.content?.video_url
      || source?.metadata?.url
      || source?.video_url
      || source?.download_url
      || value?.content?.url,
    2000,
  );
  return {
    status,
    progress: progressValue(source.progress ?? value.progress, status === 'completed' ? 100 : 0),
    downloadUrl,
  };
}

function referenceData(job) {
  const refs = parseJson(job?.refs_json, {});
  const urls = refs.urls && typeof refs.urls === 'object' ? refs.urls : {};
  const urlFor = id => clean(urls[id], 2000);
  return {
    refs,
    firstImage: urlFor(refs.firstImage),
    lastImage: urlFor(refs.lastImage),
    images: Array.isArray(refs.images) ? refs.images.map(urlFor).filter(Boolean) : [],
    videos: Array.isArray(refs.videos) ? refs.videos.map(urlFor).filter(Boolean) : [],
    audios: Array.isArray(refs.audios) ? refs.audios.map(urlFor).filter(Boolean) : [],
  };
}

function baseJobFields(job) {
  return {
    prompt: clean(job?.prompt, 7000),
    duration: Number(job?.duration),
    ratio: clean(job?.aspect_ratio, 20),
    resolution: clean(job?.resolution, 20).toLowerCase(),
    generate_audio: job?.generate_audio === 1 || job?.generate_audio === true,
    ...(Number.isSafeInteger(Number(job?.seed)) ? { seed: Number(job.seed) } : {}),
  };
}

function seedancePayload(product, job) {
  const refs = referenceData(job);
  const body = {
    model: product.routeId,
    ...baseJobFields(job),
  };
  if (job?.negative_prompt) body.negative_prompt = clean(job.negative_prompt, 7000);
  if (job?.mode === 'frame') {
    if (refs.firstImage) body.first_frame_url = refs.firstImage;
    if (refs.lastImage) body.last_frame_url = refs.lastImage;
  } else if (job?.mode !== 'script') {
    if (refs.images.length) body.reference_image_urls = refs.images;
    if (refs.videos.length) body.reference_video_urls = refs.videos;
    if (refs.audios.length) body.reference_audio_urls = refs.audios;
    if (refs.audios.length === 1) body.audio_url = refs.audios[0];
  }
  return body;
}

function minimaxContent(product, job) {
  const refs = referenceData(job);
  const content = [{ type: 'text', text: clean(job?.prompt, 7000) }];
  const addImage = (url, role) => {
    if (url) content.push({ type: 'image_url', image_url: { url }, role });
  };
  if (job?.mode === 'frame') {
    addImage(refs.firstImage, 'first_frame');
    addImage(refs.lastImage, 'last_frame');
  } else if (job?.mode !== 'script') {
    refs.images.forEach(url => addImage(url, 'reference_image'));
    refs.videos.forEach(url => content.push({ type: 'video_url', video_url: { url }, role: 'reference_video' }));
    refs.audios.forEach(url => content.push({ type: 'audio_url', audio_url: { url }, role: 'reference_audio' }));
  }
  return content;
}

/* 中转文档（https://new.ip233.com/docs/models）里 MiniMax 主路由的字段是
   seconds / resolution / size / prompt，resolution 的取值是 720p / 1440p / 2160p ——
   **没有 '2K' 这个写法**。2026-09-19 批 K-B 之前这里把 resolution 写死成 '2K'，
   等于给一条只认 720p/1080p 的路由发了它不认识的档位（公开档 minimax_h3_768p 走的就是这条）。
   现在改成**按产品声明的清晰度发**；文档字段与旧字段同时带上（Go 解码器忽略未知字段），
   所以 content/duration/ratio 这套旧报文继续兼容。 */
const MINIMAX_RESOLUTION = Object.freeze({
  '480p': '480p',
  '720p': '720p',
  '1080p': '1080p',
  '1440p': '1440p',
  '2160p': '2160p',
  /* 站内产品目录里 2K 档的写法是 '2k'；中转 minimax 分档里最接近的是 1440p */
  '2k': '1440p',
});

export function minimaxResolutionOf(resolution) {
  const raw = clean(resolution, 20).toLowerCase();
  return MINIMAX_RESOLUTION[raw] || '720p';
}

function minimaxPayload(product, job) {
  const duration = Number(job?.duration);
  const ratio = clean(job?.aspect_ratio, 20);
  return {
    model: product.routeId,
    content: minimaxContent(product, job),
    prompt: clean(job?.prompt, 7000),
    /* 文档口径：秒数字段是 seconds（字符串），比例字段是 size */
    seconds: String(duration),
    duration,
    resolution: minimaxResolutionOf(job?.resolution),
    size: ratio,
    ratio,
    generate_audio: job?.generate_audio === 1 || job?.generate_audio === true,
  };
}

export function buildProviderPayload({ product, job } = {}) {
  if (!product || !job) throw new TypeError('product and job are required');
  const protocol = product.credential === 'minimax' ? 'minimax-h3' : 'seedance';
  return {
    protocol,
    path: '/videos',
    body: protocol === 'minimax-h3' ? minimaxPayload(product, job) : seedancePayload(product, job),
  };
}

function normalizeBaseUrl(value) {
  const base = clean(value || 'https://api-new.ip233.com/v1', 500).replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(base)) throw new TypeError('video provider baseUrl must be an absolute URL');
  return base;
}

function responseJson(response) {
  return response.text().then(text => {
    if (!text) return {};
    try { return JSON.parse(text); } catch { throw errorWithCode(502, 'VIDEO_PROVIDER_INVALID_JSON', '视频服务返回了无法识别的数据'); }
  });
}

function createAdapter({ product, baseUrl, token, fetchImpl, timeoutMs = 30_000, model = '' }) {
  const endpoint = normalizeBaseUrl(baseUrl);
  const protocol = product.credential === 'minimax' ? 'minimax-h3' : 'seedance';
  const queryPath = taskId => `/videos/${encodeURIComponent(taskId)}`;
  const contentPath = taskId => `/videos/${encodeURIComponent(taskId)}/content`;

  async function request(path, options = {}, timeout = timeoutMs) {
    if (!token) throw errorWithCode(503, 'VIDEO_PROVIDER_NOT_CONFIGURED', '视频服务正在配置中');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
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
        const detail = await response.text().catch(() => '');
        const retryable = response.status === 408 || response.status === 409 || response.status === 429 || response.status >= 500;
        throw errorWithCode(response.status >= 500 ? 502 : 400, 'VIDEO_PROVIDER_REJECTED', '视频任务未被上游接受', {
          retryable,
          providerStatus: response.status,
          providerDetail: detail.slice(0, 300),
        });
      }
      return response;
    } catch (error) {
      if (error?.code) throw error;
      throw errorWithCode(502, 'VIDEO_PROVIDER_UNREACHABLE', '暂时无法连接视频服务', { retryable: true });
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    enabled: Boolean(token),
    routeId: product.routeId,
    productId: product.id,
    protocol,
    /* 备用网关可能用不同的模型 id（实测 65535：seedance-2.0-native 等），未提供映射时沿用本家模型名 */
    model: clean(model, 200) || product.routeId,
    async submit(payload, idempotencyKey) {
      const response = await request('/videos', {
        method: 'POST',
        headers: { 'Idempotency-Key': clean(idempotencyKey, 200) },
        body: JSON.stringify(payload),
      });
      const data = await responseJson(response);
      const id = responseId(data);
      if (!id) throw errorWithCode(502, 'VIDEO_PROVIDER_TASK_MISSING', '视频服务没有返回任务编号');
      return { id, progress: progressValue(data.progress ?? data.task?.progress, 0) };
    },
    async get(taskId) {
      const data = await responseJson(await request(queryPath(taskId), { method: 'GET' }));
      return normalizeProviderStatus(data);
    },
    async download(taskId, normalizedStatus = {}) {
      if (normalizedStatus.downloadUrl) {
        const response = await fetchImpl(normalizedStatus.downloadUrl, { method: 'GET' });
        if (!response.ok) throw errorWithCode(502, 'VIDEO_PROVIDER_DOWNLOAD_FAILED', '视频文件下载失败', { retryable: true });
        return response;
      }
      return request(contentPath(taskId), { method: 'GET' }, 180_000);
    },
  };
}

export function createVideoProviderRegistry({
  baseUrl,
  minimaxBaseUrl,
  credentials = {},
  fetchImpl = fetch,
  timeoutMs = 30_000,
  /* 9-12 用户要求：视频同样要有备用供应商。上游 routeId 本身就是模型名（如 sd5-seedance-2.0），
     所以「换供应商」= 换网关，模型不变、用户无感。 */
  backup = null,
} = {}) {
  const adapters = new Map();
  const alternateAdapters = new Map();
  const backupEnabled = Boolean(backup && backup.baseUrl);
  for (const product of Object.values(VIDEO_PRODUCTS)) {
    const token = clean(credentials?.[product.credential], 500);
    adapters.set(product.id, createAdapter({
      product,
      baseUrl: product.credential === 'minimax' ? (minimaxBaseUrl || baseUrl) : baseUrl,
      token,
      fetchImpl,
      timeoutMs,
    }));
    if (backupEnabled) {
      const backupToken = clean(backup?.credentials?.[product.credential], 500);
      /* 只有明确知道备用网关对应的模型 id 才挂备用 —— 否则可能把不被支持的模型名发过去，
         那比「没有备用」更糟（会以 5xx 收场）。映射来自实测的备用网关模型清单。 */
      const backupModel = clean(backup?.models?.[product.routeId], 200);
      if (backupToken && backupModel) {
        alternateAdapters.set(product.id, createAdapter({
          product,
          baseUrl: product.credential === 'minimax' ? (backup.minimaxBaseUrl || backup.baseUrl) : backup.baseUrl,
          token: backupToken,
          fetchImpl,
          timeoutMs,
          model: backupModel,
        }));
      }
    }
  }
  return {
    get(productId) {
      return adapters.get(productId) || null;
    },
    /* 备用通道：同一个模型、另一家上游网关；未配置时返回 null（调用方按「没备用」处理） */
    alternate(productId) {
      return alternateAdapters.get(productId) || null;
    },
    hasBackup: alternateAdapters.size > 0,
    list() {
      return [...adapters.values()];
    },
    publicProducts(options) {
      return publicVideoProducts(options);
    },
    /* 只读的"未上架模型"清单（给界面一句实话用，不参与路由 / 计费）——见 videoCatalog 里的说明 */
    unavailableProducts() {
      return unavailableVideoProducts();
    },
  };
}

export function isVideoProviderFailure(error) {
  return Boolean(error && (
    error.code === 'VIDEO_PROVIDER_REJECTED'
      || error.code === 'VIDEO_PROVIDER_UNREACHABLE'
      || error.code === 'VIDEO_PROVIDER_FAILED'
      || error.code === 'VIDEO_PROVIDER_DOWNLOAD_FAILED'
      || error.code === 'VIDEO_PROVIDER_INVALID_JSON'
      || error.code === 'VIDEO_PROVIDER_TASK_MISSING'
      || error.providerStatus >= 500
  ));
}
