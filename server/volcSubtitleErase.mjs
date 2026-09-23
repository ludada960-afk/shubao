/* ═══ 火山引擎 AI MediaKit「字幕擦除」适配器（2026-09-25 批 AP）══════════════════════════════════
   用户口径（本轮的拍板）：
     「我觉得自己接去字幕很麻烦，不如就**直接接火山API**吧」
   ⇒ 不再自研本机 OCR 找框，自动标记这一档走火山的字幕擦除。

   ── 契约（逐条来自官方文档，不猜字段名）─────────────────────────────────────────────────────
   · 标准版：`POST https://mediakit.cn-beijing.volces.com/api/v1/tools/erase-video-subtitle`
     精细化版：`POST .../api/v1/tools/erase-video-subtitle-pro`
     （docs.volcengine.com/docs/6448/2386125 与 /2372084）
   · 鉴权：Header `Authorization: Bearer {API Key}` —— **不是 AK/SK 签名**（两页参数表原文），
     Key 在 AI MediaKit 控制台 API Key 管理页创建。
   · 查询：`GET https://mediakit.cn-beijing.volces.com/api/v1/tasks/{task_id}`，
     `status` ∈ running / completed / failed（docs/6448/2278532）。
   · 参数：`video_url`（必填）、`mode`（默认 Subtitle = **自动检测字幕**；Text = 连人名地名一起擦）、
     `model_version`（默认 v4，可选 v5）、`output_encode_mode`、`erase_ratio_location`（≤20 个框，
     与自动检测互斥）、`time_segment_filter`、`subtitle_filter`、`client_token`（幂等）、`callback_url`…
     ⚠️ 自动检测的**官方边界**：字幕需在画面下方 50% 以内且横向偏中央、文字竖向高度占画面 1%~10%、
     白色、仅中英文；超出这些条件的擦不到（他们自己写在文档里的）。
   · 输入视频：公网 HTTPS URL / `mediakit://{file_id}`（本地上传，≤5GB）/ `tos://` / `vod://`。
     我们站内的片子是**带签名的内网地址**，火山拉不到 ⇒ 走「本地上传」那条路：
     先 POST `/api/v1/tools-sync/request-media-upload-url` 拿 `upload_url` + `file_id`，
     再用 **PUT 纯二进制**（严禁 multipart）上传，最后用 `mediakit://{file_id}` 提交任务。
   · 计费：`累计擦除时长(分钟) × 系数 × 1 元/分钟`，标准版系数 0.4、精细化版 1。
     未指定 time_segment_filter 时"擦除时长 = 输出时长"。

   ── 本模块的边界（诚实标注）────────────────────────────────────────────────────────────────
   · **未实测**：本机没有可用的 API Key，所以这里只做到"契约忠实 + 失败可诊断"。
     台账状态记 unverified，产品保持 public:false —— 等用户配好 Key 后跑一次真片子（要花钱 ⇒ 须他点头），
     再把状态改成 callable/verified 并翻 public（与 1080P 的 Seedance 那条同一套做法）。
   · 只做 HTTP，不引 SDK：鉴权是 Bearer Key，官方文档里这个产品也没有语言 SDK 章节。
   * 与上游视频适配器**同形**（submit / get / download），所以作业流水线不需要第二套分支。 */
import { createReadStream } from 'node:fs';

const DEFAULT_BASE_URL = 'https://mediakit.cn-beijing.volces.com/api/v1';
const POLL_PATH = taskId => `/tasks/${encodeURIComponent(String(taskId || ''))}`;

function clean(value, max = 2000) {
  return String(value ?? '').trim().slice(0, max);
}

function codedError(code, message, details = {}) {
  return Object.assign(new Error(message), { code, ...details });
}

function normalizeStatus(value) {
  const status = clean(value, 40).toLowerCase();
  if (['running', 'queued', 'pending', 'processing'].includes(status)) return 'processing';
  if (['completed', 'success', 'succeeded'].includes(status)) return 'completed';
  if (['failed', 'error', 'cancelled', 'canceled'].includes(status)) return 'failed';
  return status || 'unknown';
}

/* 从火山返回体里取任务 id 与结果地址：字段名照文档，取不到就报错（不猜第二套名字） */
function taskIdOf(payload) {
  return clean(payload?.task_id ?? payload?.data?.task_id ?? payload?.Result?.task_id, 200);
}
function resultOf(payload) {
  const source = payload?.data ?? payload?.Result ?? payload ?? {};
  return {
    status: normalizeStatus(source.status ?? payload?.status),
    videoUrl: clean(source.video_url ?? source.Result?.video_url, 2000),
    duration: Number(source.duration ?? source.Result?.duration) || 0,
    message: clean(source.message ?? payload?.error ?? payload?.message, 300),
  };
}

/**
 * 建一个「火山字幕擦除」适配器。
 * @param {object} options
 * @param {string} options.apiKey        AI MediaKit 的 API Key（Bearer）
 * @param {string} [options.baseUrl]     默认 mediakit.cn-beijing.volces.com
 * @param {Function} [options.fetchImpl] 便于测试与诊断注入
 * @param {boolean} [options.refined]    true = 精细化版（-pro，1 元/分钟），false = 标准版（0.4 元/分钟）
 * @param {string} [options.mode]        'Subtitle'（默认，自动检测字幕）| 'Text'
 */
export function createVolcSubtitleAdapter({
  apiKey,
  baseUrl = DEFAULT_BASE_URL,
  fetchImpl = fetch,
  refined = false,
  mode = 'Subtitle',
  timeoutMs = 30_000,
} = {}) {
  const endpoint = clean(baseUrl, 500).replace(/\/+$/, '');
  const token = clean(apiKey, 500);
  const erasePath = refined ? '/tools/erase-video-subtitle-pro' : '/tools/erase-video-subtitle';

  async function request(path, options = {}, timeout = timeoutMs) {
    if (!token) throw codedError('VOLC_SUBTITLE_NOT_CONFIGURED', '火山字幕擦除未配置（缺 API Key）');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    timer.unref?.();
    try {
      const response = await fetchImpl(`${endpoint}${path}`, {
        ...options,
        headers: {
          Authorization: `Bearer ${token}`,
          ...(options.body && typeof options.body === 'string' ? { 'Content-Type': 'application/json' } : {}),
          ...(options.headers || {}),
        },
        signal: controller.signal,
      });
      const text = await response.text().catch(() => '');
      let payload = {};
      try { payload = text ? JSON.parse(text) : {}; } catch { payload = { raw: text.slice(0, 300) }; }
      if (!response.ok || payload?.success === false) {
        /* 文档口径：响应含 success / task_id / request_id / error；失败时把上游原话带回来 */
        throw codedError('VOLC_SUBTITLE_REJECTED', '火山字幕擦除拒绝了这次请求', {
          providerStatus: response.status,
          providerDetail: clean(payload?.error || payload?.message || text, 300),
          retryable: response.status === 429 || response.status >= 500,
        });
      }
      return payload;
    } catch (error) {
      if (error?.code) throw error;
      throw codedError('VOLC_SUBTITLE_UNREACHABLE', '暂时无法连接火山字幕擦除服务', { retryable: true });
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    enabled: Boolean(token),
    protocol: 'volc-mediakit',
    model: refined ? 'erase-video-subtitle-pro' : 'erase-video-subtitle',
    /* 与上游视频适配器同形：submit(payload, idempotencyKey) */
    async submit(payload = {}, idempotencyKey = '') {
      const videoUrl = clean(payload.videoUrl || payload.sourceUrl, 2000);
      if (!videoUrl) throw codedError('VOLC_SUBTITLE_INPUT_REQUIRED', '字幕擦除需要一个视频地址');
      const body = {
        video_url: videoUrl,
        mode: clean(payload.mode, 20) || mode,
        model_version: clean(payload.modelVersion, 10) || 'v5',
        client_token: clean(idempotencyKey, 64) || undefined,
        ...(payload.callbackUrl ? { callback_url: clean(payload.callbackUrl, 2000) } : {}),
        ...(payload.outputDestination ? { media_output_destination: clean(payload.outputDestination, 500) } : {}),
      };
      const result = await request(erasePath, { method: 'POST', body: JSON.stringify(body) }, 60_000);
      const id = taskIdOf(result);
      if (!id) throw codedError('VOLC_SUBTITLE_TASK_MISSING', '火山没有返回任务编号');
      return { id, progress: 0 };
    },
    async get(taskId) {
      const payload = await request(POLL_PATH(taskId), { method: 'GET' });
      const result = resultOf(payload);
      return {
        status: result.status,
        progress: result.status === 'completed' ? 100 : 50,
        downloadUrl: result.videoUrl,
        duration: result.duration,
        error: result.message,
      };
    },
    /* 与上游 download 同形：返回可读流。火山给的是**带有效期的公网 URL**（默认 24 小时），
       所以这里下载它并包成流，交给流水线既有的落库通道。 */
    async download(taskId, normalizedStatus = {}) {
      const url = clean(normalizedStatus.downloadUrl, 2000);
      if (!url) throw codedError('VOLC_SUBTITLE_OUTPUT_MISSING', '火山没有返回成片地址');
      const response = await fetchImpl(url, { method: 'GET' });
      if (!response.ok) throw codedError('VOLC_SUBTITLE_DOWNLOAD_FAILED', '成片下载失败', { retryable: true });
      return response;
    },
    /* 本地上传：站内片子是带签名的地址，火山拉不到 ⇒ 走 mediakit:// 那条路（文档 2536891）。
       返回 `mediakit://{file_id}`，submit 时当 video_url 用。 */
    async uploadLocalFile({ filePath, fileName = '' } = {}) {
      if (!filePath) throw codedError('VOLC_SUBTITLE_UPLOAD_INPUT_REQUIRED', '缺少要上传的视频文件');
      const ticket = await request('/tools-sync/request-media-upload-url', {
        method: 'POST',
        body: JSON.stringify({ file_name: clean(fileName, 200) || undefined }),
      });
      const uploadUrl = clean(ticket?.upload_url ?? ticket?.data?.upload_url, 2000);
      const fileId = clean(ticket?.file_id ?? ticket?.data?.file_id, 200);
      if (!uploadUrl || !fileId) throw codedError('VOLC_SUBTITLE_UPLOAD_TICKET_MISSING', '没有拿到上传地址');
      /* 文档原文：**必须用纯二进制流上传，严禁 multipart/form-data** */
      const upload = await fetchImpl(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: createReadStream(filePath),
        duplex: 'half',
      });
      if (!upload.ok) throw codedError('VOLC_SUBTITLE_UPLOAD_FAILED', '视频上传到火山失败', { retryable: true });
      return { fileId, videoUrl: `mediakit://${fileId}` };
    },
  };
}

/* 诊断用：这条适配器现在到底能不能用（缺 Key 时给出人话原因，而不是让用户点了才发现） */
export function volcSubtitleReadiness(apiKey) {
  const configured = Boolean(clean(apiKey, 500));
  return {
    configured,
    reason: configured ? '' : '未配置火山 AI MediaKit 的 API Key（控制台 API Key 管理页创建后填进 server/.env 的 VOLC_MEDIAKIT_API_KEY）',
  };
}
