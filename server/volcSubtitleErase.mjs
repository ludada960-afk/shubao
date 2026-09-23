/* ═══ 火山引擎 AI MediaKit「字幕擦除」适配器（2026-09-25 批 AP；2026-09-26 批 AU 抽走 HTTP 底座）══
   用户口径（拍板）：「我觉得自己接去字幕很麻烦，不如就**直接接火山API**吧」
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
     我们站内的片子是**带签名的内网地址**，火山拉不到 ⇒ 走「本地上传」那条路
     （取票据 → 纯二进制 PUT → 用 `mediakit://{file_id}` 提交）。
   · 计费：`累计擦除时长(分钟) × 系数 × 1 元/分钟`，标准版系数 0.4、精细化版 1。
     未指定 time_segment_filter 时"擦除时长 = 输出时长"。

   ── 真机实测（2026-09-26，用户充值 ¥5 后跑通一次）────────────────────────────────────────────
   任务 `amk-tool-erase-video-subtitle-1355189656834`：6 秒片 → completed、
   `result.duration = 5.967`、`result.video_url` 有值、扣费约 ¥0.04。
   实测纠正了三处（**文档里没有的**）：① 取票据必须带含 `file_size` 的 JSON body；
   ② `upload_url` 有 6079 字符，截断就 400；③ 成片地址在 `result.video_url`（不是顶层）。
   这三处连同上传骨架一起抽到了 `volcMediaKitClient.mjs`（口型对齐共用同一份）。

   ── 本模块的边界（诚实标注）────────────────────────────────────────────────────────────────
   · 只做 HTTP，不引 SDK：鉴权是 Bearer Key，官方文档里这个产品也没有语言 SDK 章节。
   * 与上游视频适配器**同形**（submit / get / download），所以作业流水线不需要第二套分支。 */
import { clean, codedError, createMediaKitClient, mediaKitTaskIdOf, normalizeMediaKitStatus } from './volcMediaKitClient.mjs';

const CODE = 'VOLC_SUBTITLE';
const LABEL = '火山字幕擦除';

/* 从火山返回体里取结果：字段名照**实测**（2026-09-26 对线上真实响应核过）
   完成态形状：{ success, task_id, task_type, status: 'completed', result: { duration: 5.967, video_url } }
   —— 成片地址在 **result.video_url**，时长在 **result.duration**（秒，带小数，就是计费的"累计擦除时长"）。
   ⚠️ 第一版我按文档猜成顶层 video_url，结果任务跑通了却取不到成片地址（"completed 但地址为空"）。
      这类字段位置**只能看真实响应** —— 文档里没有完整样例（本仓铁律：不许猜字段名）。 */
function resultOf(payload) {
  const source = payload?.result ?? payload?.data ?? payload?.Result ?? payload ?? {};
  return {
    status: normalizeMediaKitStatus(source.status ?? payload?.status),
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
  baseUrl,
  fetchImpl = fetch,
  refined = false,
  mode = 'Subtitle',
  timeoutMs = 30_000,
} = {}) {
  const client = createMediaKitClient({
    apiKey,
    ...(baseUrl ? { baseUrl } : {}),
    fetchImpl,
    codePrefix: CODE,
    label: LABEL,
    timeoutMs,
  });
  const erasePath = refined ? '/tools/erase-video-subtitle-pro' : '/tools/erase-video-subtitle';

  return {
    enabled: client.enabled,
    protocol: 'volc-mediakit',
    model: refined ? 'erase-video-subtitle-pro' : 'erase-video-subtitle',
    /* 与上游视频适配器同形：submit(payload, idempotencyKey) */
    async submit(payload = {}, idempotencyKey = '') {
      const videoUrl = clean(payload.videoUrl || payload.sourceUrl, 2000);
      if (!videoUrl) throw codedError(`${CODE}_INPUT_REQUIRED`, '字幕擦除需要一个视频地址');
      const body = {
        video_url: videoUrl,
        mode: clean(payload.mode, 20) || mode,
        model_version: clean(payload.modelVersion, 10) || 'v5',
        client_token: clean(idempotencyKey, 64) || undefined,
        ...(payload.callbackUrl ? { callback_url: clean(payload.callbackUrl, 2000) } : {}),
        ...(payload.outputDestination ? { media_output_destination: clean(payload.outputDestination, 500) } : {}),
      };
      const result = await client.request(erasePath, { method: 'POST', body: JSON.stringify(body) }, 60_000);
      const id = mediaKitTaskIdOf(result);
      if (!id) throw codedError(`${CODE}_TASK_MISSING`, '火山没有返回任务编号');
      return { id, progress: 0 };
    },
    async get(taskId) {
      const payload = await client.pollTask(taskId);
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
      const url = clean(normalizedStatus.downloadUrl, 8000);
      if (!url) throw codedError(`${CODE}_OUTPUT_MISSING`, '火山没有返回成片地址');
      const response = await fetchImpl(url, { method: 'GET' });
      if (!response.ok) throw codedError(`${CODE}_DOWNLOAD_FAILED`, '成片下载失败', { retryable: true });
      return response;
    },
    /* 本地上传：返回 {videoUrl: 'mediakit://…'}（调用方直接拿去 submit） */
    async uploadLocalFile({ filePath, fileName = '' } = {}) {
      const uploaded = await client.uploadLocalFile({ filePath, fileName: fileName || 'clip.mp4' });
      return { fileId: uploaded.fileId, videoUrl: uploaded.url };
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
