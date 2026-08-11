import { getVideoProduct, publicVideoProducts, VIDEO_PRODUCTS } from './videoCatalog.mjs';

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

function minimaxPayload(product, job) {
  return {
    model: product.routeId,
    content: minimaxContent(product, job),
    duration: Number(job?.duration),
    resolution: '2K',
    ratio: clean(job?.aspect_ratio, 20),
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

function createAdapter({ product, baseUrl, token, fetchImpl, timeoutMs = 30_000 }) {
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
    model: product.routeId,
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
} = {}) {
  const adapters = new Map();
  for (const product of Object.values(VIDEO_PRODUCTS)) {
    const token = clean(credentials?.[product.credential], 500);
    adapters.set(product.id, createAdapter({
      product,
      baseUrl: product.credential === 'minimax' ? (minimaxBaseUrl || baseUrl) : baseUrl,
      token,
      fetchImpl,
      timeoutMs,
    }));
  }
  return {
    get(productId) {
      return adapters.get(productId) || null;
    },
    list() {
      return [...adapters.values()];
    },
    publicProducts(options) {
      return publicVideoProducts(options);
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
