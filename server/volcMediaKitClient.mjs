import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';

/* ═══ 火山引擎 AI MediaKit：**共用的 HTTP 底座**（2026-09-26 批 AU）══════════════════════════════
   为什么要有这个文件：MediaKit 下的每个工具（字幕擦除 / 口型对齐 / 后续还会有别的）用的是
   **同一套骨架** —— Bearer Key 鉴权、`/tools/xxx` 提交、`/tasks/{id}` 轮询、`/tools-sync/
   request-media-upload-url` 取票据后用纯二进制 PUT 换 `mediakit://{file_id}`。
   这套骨架在 2026-09-26 才被**真机打磨过**（字幕擦除跑通了一次，踩掉三个坑，见下），
   把它抄第二遍就是等着抄错 —— 所以抽到这里，两个工具都从这里取。

   ── 三个坑（都是**实测**踩出来的，不是文档里写的；踩坑记录在 volcSubtitleErase 的文件头）──────
   ① 取票据必须带 **JSON body 且含 `file_size`**：只带 file_name 时票据能拿到，
      但随后的 PUT 回 400 `{"code":4000,"message":"Bad Request"}`（上传地址与申报大小对不上）。
   ② **`upload_url` 有 6000+ 字符**（带一长串 Authorization JWT）—— 用 2000 的上限 clean 一下，
      就变成"票据拿得到、PUT 400"这种最难查的错。这里给 12000。
   ③ 完成态的结果在 **`result`** 里（`result.video_url` / `result.duration`），不在顶层。

   ── 边界（诚实标注）─────────────────────────────────────────────────────────────────────────
   · 只做 HTTP，不引 SDK：官方文档里这个产品没有语言 SDK 章节，鉴权就是 Bearer Key。
   · 错误码**按工具分开**（`codePrefix`）：呼叫方（作业流水线 / 页面）要按 code 分流，
     所以 `VOLC_SUBTITLE_*` 与 `VOLC_LIPSYNC_*` 不能混成一个 —— 那样"缺哪把钥匙"就分不清了。 */

const DEFAULT_BASE_URL = 'https://mediakit.cn-beijing.volces.com/api/v1';

export function clean(value, max = 2000) {
  return String(value ?? '').trim().slice(0, max);
}

export function codedError(code, message, details = {}) {
  return Object.assign(new Error(message), { code, ...details });
}

/* 上游状态 → 我们流水线的三态（作业流水线只认 processing / completed / failed） */
export function normalizeMediaKitStatus(value) {
  const status = clean(value, 40).toLowerCase();
  if (['running', 'queued', 'pending', 'processing'].includes(status)) return 'processing';
  if (['completed', 'success', 'succeeded'].includes(status)) return 'completed';
  if (['failed', 'error', 'cancelled', 'canceled'].includes(status)) return 'failed';
  return status || 'unknown';
}

/* 任务编号的字段位置（顶层 task_id 优先，再兜 result/data —— 各工具返回形状不完全一致） */
export function mediaKitTaskIdOf(payload) {
  return clean(payload?.task_id ?? payload?.result?.task_id ?? payload?.data?.task_id, 200);
}

/**
 * 建一个 MediaKit 客户端（共用地基，不直接给产品用）。
 * @param {object} options
 * @param {string} options.apiKey            AI MediaKit 控制台创建的 API Key（Bearer）
 * @param {string} [options.baseUrl]         默认 mediakit.cn-beijing.volces.com/api/v1
 * @param {Function} [options.fetchImpl]     测试/诊断注入
 * @param {string} [options.codePrefix]      错误码前缀（如 VOLC_SUBTITLE / VOLC_LIPSYNC）
 * @param {string} [options.label]           人话名字（错误文案里用，如「火山字幕擦除」）
 * @param {number} [options.timeoutMs]       单次请求超时（上传单独放宽，见 uploadLocalFile）
 */
export function createMediaKitClient({
  apiKey,
  baseUrl = DEFAULT_BASE_URL,
  fetchImpl = fetch,
  codePrefix = 'VOLC_MEDIAKIT',
  label = '火山 AI MediaKit',
  timeoutMs = 30_000,
} = {}) {
  const endpoint = clean(baseUrl, 500).replace(/\/+$/, '');
  const token = clean(apiKey, 500);
  const prefix = clean(codePrefix, 60) || 'VOLC_MEDIAKIT';
  const name = clean(label, 80) || label;

  async function request(path, options = {}, timeout = timeoutMs) {
    if (!token) throw codedError(`${prefix}_NOT_CONFIGURED`, `${name}未配置（缺 API Key）`);
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
        throw codedError(`${prefix}_REJECTED`, `${name}拒绝了这次请求`, {
          providerStatus: response.status,
          providerDetail: clean(payload?.error || payload?.message || text, 300),
          retryable: response.status === 429 || response.status >= 500,
        });
      }
      return payload;
    } catch (error) {
      if (error?.code) throw error;
      throw codedError(`${prefix}_UNREACHABLE`, `暂时无法连接${name}服务`, { retryable: true });
    } finally {
      clearTimeout(timer);
    }
  }

  /* 轮询路径：所有工具共用 `/tasks/{task_id}`（docs.volcengine.com/docs/6448/2278532） */
  async function pollTask(taskId) {
    return request(`/tasks/${encodeURIComponent(String(taskId || ''))}`, { method: 'GET' });
  }

  /* ═══ 本地上传：站内片子是**带签名的内网地址**，火山拉不到 ⇒ 走 mediakit:// 那条路（文档 2536891）
     返回 `mediakit://{file_id}`，直接当 video_url / audio_url 用。
     ⚠️ 三个字段名都是**实测**过的（不是猜的），见上面 ①②。 */
  async function uploadLocalFile({ filePath, fileName = 'clip.mp4' } = {}) {
    if (!filePath) throw codedError(`${prefix}_UPLOAD_INPUT_REQUIRED`, '缺少要上传的文件');
    /* ⚠️ 坑①：票据里**必须带 file_size** —— 先 stat 一次把字节数一并申报 */
    const info = await stat(filePath).catch(() => null);
    if (!info?.isFile() || info.size <= 0) {
      throw codedError(`${prefix}_UPLOAD_INPUT_REQUIRED`, '要上传的文件不存在或是空的');
    }
    const ticket = await request('/tools-sync/request-media-upload-url', {
      method: 'POST',
      body: JSON.stringify({ file_name: clean(fileName, 200) || 'clip.mp4', file_size: info.size }),
    });
    const result = ticket?.result ?? ticket?.data ?? {};
    const uploadUrl = clean(result.upload_url, 12000);   /* ⚠️ 不许截断，见 ② */
    const fileId = clean(result.file_id, 500);
    const uploadHeaders = Array.isArray(result.upload_headers) ? result.upload_headers : [];
    const method = clean(result.method, 10).toUpperCase() || 'PUT';
    if (!uploadUrl || !fileId) throw codedError(`${prefix}_UPLOAD_TICKET_MISSING`, '没有拿到上传地址');
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
      throw codedError(`${prefix}_UPLOAD_FAILED`, '文件上传到火山失败', {
        retryable: true,
        providerStatus: upload.status,
        providerDetail: clean(detail, 300),
      });
    }
    /* file_id 已带协议前缀；万一上游哪天不带，这里补上（两种都兼容） */
    return { fileId, url: /^mediakit:\/\//.test(fileId) ? fileId : `mediakit://${fileId}` };
  }

  return { enabled: Boolean(token), endpoint, prefix, label: name, request, pollTask, uploadLocalFile };
}
