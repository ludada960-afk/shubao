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
import { stat } from 'node:fs/promises';

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

/* 从火山返回体里取任务 id 与结果地址：字段名照**实测**（2026-09-26 对线上真实响应核过）
   完成态形状：{ success, task_id, task_type, status: 'completed', result: { duration: 5.967, video_url } }
   —— 成片地址在 **result.video_url**，时长在 **result.duration**（秒，带小数，就是计费的"累计擦除时长"）。
   ⚠️ 第一版我按文档猜成顶层 video_url，结果任务跑通了却取不到成片地址（"completed 但地址为空"）。
      这类字段位置**只能看真实响应** —— 文档里没有完整样例（本仓铁律：不许猜字段名）。 */
function taskIdOf(payload) {
  return clean(payload?.task_id ?? payload?.result?.task_id ?? payload?.data?.task_id, 200);
}
function resultOf(payload) {
  const source = payload?.result ?? payload?.data ?? payload?.Result ?? payload ?? {};
  return {
    status: normalizeStatus(source.status ?? payload?.status),
    videoUrl: clean(source.video_url ?? source.output?.video_url, 8000),
    duration: Number(source.duration) || 0,
    message: clean(source.message ?? payload?.error?.message ?? payload?.error ?? payload?.message, 300),
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
       ⚠️ 字段名**实测过**（不是猜的，2026-09-26 对线上真实响应核过）：
          · 必须带 **JSON body**（空 body 会回 400「invalid empty request body」）——`file_name` 就够；
          · 响应在 `result` 里：`{ file_id, method, upload_headers, upload_url }`；
          · **`file_id` 本身就以 `mediakit://` 开头**（不要再拼一次前缀，否则变成 mediakit://mediakit://…）；
          · PUT 时要带上它给的 `upload_headers`（这次是空数组，但不许假设它永远空）。 */
    async uploadLocalFile({ filePath, fileName = '' } = {}) {
      if (!filePath) throw codedError('VOLC_SUBTITLE_UPLOAD_INPUT_REQUIRED', '缺少要上传的视频文件');
      /* ⚠️ 实测教训（2026-09-26）：**票据里必须带 file_size** —— 只带 file_name 时票据能拿到，
         但随后的 PUT 会回 400 `{"code":4000,"message":"Bad Request"}`（上传地址与申报大小对不上）。
         所以这里先 stat 一次，把字节数一并申报。 */
      const info = await stat(filePath).catch(() => null);
      if (!info?.isFile() || info.size <= 0) {
        throw codedError('VOLC_SUBTITLE_UPLOAD_INPUT_REQUIRED', '要上传的视频文件不存在或是空的');
      }
      const ticket = await request('/tools-sync/request-media-upload-url', {
        method: 'POST',
        body: JSON.stringify({ file_name: clean(fileName, 200) || 'clip.mp4', file_size: info.size }),
      });
      const result = ticket?.result ?? ticket?.data ?? {};
      /* ⚠️ **不许对 upload_url 用默认长度的 clean() 截断**：实测这条签名 URL 有 **6079 字符**
         （带一长串 Authorization JWT），截到 2000 就变成"票据拿得到、PUT 回 400 Bad Request"
         那种最难查的错（真机上我在这上面连踩两次才定位到）。给足 12000 的上限，并把原因写下来。 */
      const uploadUrl = clean(result.upload_url, 12000);
      const fileId = clean(result.file_id, 500);
      const uploadHeaders = Array.isArray(result.upload_headers) ? result.upload_headers : [];
      const method = clean(result.method, 10).toUpperCase() || 'PUT';
      if (!uploadUrl || !fileId) throw codedError('VOLC_SUBTITLE_UPLOAD_TICKET_MISSING', '没有拿到上传地址');
      /* 文档原文：**必须用纯二进制流上传，严禁 multipart/form-data** */
      const headers = { 'Content-Type': 'application/octet-stream' };
      for (const item of uploadHeaders) {
        if (item && item.key) headers[clean(item.key, 100)] = clean(item.value, 500);
      }
      const upload = await fetchImpl(uploadUrl, {
        method,
        headers,
        body: createReadStream(filePath),
        duplex: 'half',
      });
      if (!upload.ok) {
        /* 带上真实状态与响应片段 —— 上传失败时要有得查（本仓铁律：诊断信息不许省） */
        const detail = await upload.text().catch(() => '');
        throw codedError('VOLC_SUBTITLE_UPLOAD_FAILED', '视频上传到火山失败', {
          retryable: true,
          providerStatus: upload.status,
          providerDetail: clean(detail, 300),
        });
      }
      /* file_id 已带协议前缀；万一上游哪天不带，这里补上（两种都兼容） */
      return { fileId, videoUrl: /^mediakit:\/\//.test(fileId) ? fileId : `mediakit://${fileId}` };
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
