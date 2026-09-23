/* ═══ 火山引擎 AI MediaKit「视频口型对齐」适配器（2026-09-26 批 AU）════════════════════════════════
   用户口径：「数字人要不要用对口型的，你先看一下**知渔他们那边是什么策略**」→「**数字人你也可以做**」。
   知渔策略实查（docs/design/72）：他们的"数字人"就是**换口型** —— 模型入参只有
   `source_video_url`（referenceVideo）+ `source_audio_url`（referenceAudio），
   整个 bundle 里 lipsync / heygen / hedra / wav2lip / musetalk 全库 **0 命中**
   （他们把"换口型"包装成"数字人"卖，界面上一句"对口型"都不提）。
   ⇒ 我们照同一形态做：用户给一段真人视频 + 一段配音，出成片。

   ── 契约（官方文档逐字核对过，两条 URL 在文件末尾）────────────────────────────────────────────
   · 提交：`POST {base}/tools/lip-sync`（**没有** -pro/精细化版，全库 299 篇文档里口型对齐只有这一篇）
   · 查询：`GET {base}/tasks/{task_id}`（同字幕擦除；status ∈ running / completed / failed）
   · 鉴权：`Authorization: Bearer {API Key}`（同一把 Key）
   · Body **只有 8 个字段**：`video_url`(必填) `audio_url`(必填) `enable_video_loop` `media_output_destination`
     `client_token` `callback_args` `callback_url` `queue_id`
     ⚠️ 与字幕擦除**不同**：这里**没有** `mode`、**没有** `model_version`（逐字核对过整张参数表）。
   · 格式：视频**只支持 MP4**（字幕擦除那种"MP4/MOV 都行"在这里不成立）；
     音频 mp3 / aac / wav / m4a / flac。
   · 人像要求（原文）：仅支持**单人真人**出镜（卡通人物需五官与真人比例相近）；
     人脸正对镜头、水平转动 ≤45°、俯仰 ≤15°、无遮挡、面部光线稳定；暂不支持 HDR；视频 ≤30 分钟。
   · 计费：**按输出文件时长**，1 元/分钟，毫秒级累计（90 秒 = 1.5 分钟）；未查到最低时长与"失败不计费"。
   · 耗时：官方给的平均 **RTF 6~8**（处理耗时 / 驱动音频时长）—— 1 分钟音频要跑 6~8 分钟。
   · `enable_video_loop`：**我们固定传 true**，理由见下面 submit 里的注释（与计费口径绑死）。

   ── ⚠️ 诚实标注（这一档**一次真调用都没跑过**）──────────────────────────────────────────────
   与字幕擦除那档的差别必须写清楚：字幕擦除是**真机跑通之后**才翻 public 的（台账 callable），
   这一档**没有**那个证据 —— 手上没有"单人真人出镜"的素材，而付费调用要用户点头。
   所以：
     · 路由台账记 `unverified`（server/videoCatalog.mjs 的 ROUTE_REACHABILITY）；
     · 产品 `public: false`、SKU `public: false` ⇒ 用户点不到、也扣不到钱；
     · 提交体里的字段名照文档写，**没有**实测纠错（字幕擦除那三个坑就是实测才发现的）。
       ⇒ 真机跑通一次后，把纠正写进这里的注释并更新台账，才允许翻 public。

   ── 与上游视频适配器同形（submit / get / download），所以作业流水线不需要新分支 ────────────── */
import { clean, codedError, createMediaKitClient, mediaKitTaskIdOf, normalizeMediaKitStatus } from './volcMediaKitClient.mjs';

const CODE = 'VOLC_LIPSYNC';
const LABEL = '火山口型对齐';

/* 结果形状：**官方文档给了完整样例**（与字幕擦除的实测规律一致 —— 都在 `result` 里）
   完成态：{ success, task_id, status: 'completed', result: { video_url, duration }, expires_at, created_at, finished_at }
   `result.duration` = **输出视频时长（秒），就是计费用的那个数**（文档原文：单位为秒，用于计量计费）。
   ⚠️ 成片是**临时下载链接，有效期 24 小时**（查询接口会在剩余不足 2 小时时自动续期）。
   这里仍然顶层的 `video_url` 也兜一下：字幕擦除上已经踩过"字段位置猜错 → completed 但取不到地址"，
   多兜一处不花成本。 */
function resultOf(payload) {
  const source = payload?.result ?? payload?.data ?? payload?.Result ?? {};
  return {
    status: normalizeMediaKitStatus(source.status ?? payload?.status),
    videoUrl: clean(source.video_url ?? payload?.video_url ?? source.output?.video_url, 8000),
    duration: Number(source.duration ?? payload?.duration) || 0,
    message: clean(source.message ?? payload?.error?.message ?? payload?.error ?? payload?.message, 300),
  };
}

/**
 * 建一个「火山口型对齐」适配器。
 * @param {object} options
 * @param {string} options.apiKey        AI MediaKit 的 API Key（Bearer，与字幕擦除同一把）
 * @param {string} [options.baseUrl]     默认 mediakit.cn-beijing.volces.com/api/v1
 * @param {Function} [options.fetchImpl] 便于测试与诊断注入
 */
export function createVolcLipSyncAdapter({ apiKey, baseUrl, fetchImpl = fetch, timeoutMs = 30_000 } = {}) {
  const client = createMediaKitClient({
    apiKey,
    ...(baseUrl ? { baseUrl } : {}),
    fetchImpl,
    codePrefix: CODE,
    label: LABEL,
    timeoutMs,
  });

  return {
    enabled: client.enabled,
    protocol: 'volc-mediakit',
    model: 'lip-sync',
    routeId: 'volc-media-kit-lipsync',
    async submit(payload = {}, idempotencyKey = '') {
      const videoUrl = clean(payload.videoUrl || payload.sourceUrl, 8000);
      const audioUrl = clean(payload.audioUrl || payload.sourceAudioUrl, 8000);
      if (!videoUrl) throw codedError(`${CODE}_VIDEO_REQUIRED`, '口型对齐需要一段人物视频');
      if (!audioUrl) throw codedError(`${CODE}_AUDIO_REQUIRED`, '口型对齐需要一段驱动音频');
      const body = {
        video_url: videoUrl,
        audio_url: audioUrl,
        /* ═══ `enable_video_loop` 固定 true：这一条是**与计费口径绑死**的，不是口味 ══════════════════
           官方语义：false（默认）= 以较短者为准截断；true = 以**音频**时长为准
           （音频比视频长 → 画面往复循环播放；比视频短 → 截断画面）。
           我们按**音频秒数**收费（video_lipsync_volc_* 是 perSecond SKU，数量取音频时长），
           若用默认的 false，一段 20 秒配音配 10 秒视频只会出 10 秒 —— 收 20 秒的钱、交 10 秒的货。
           另外音频侧本来就是驱动源：成片长度跟着音频走才是用户预期。 */
        enable_video_loop: payload.enableVideoLoop !== false,
        client_token: clean(idempotencyKey, 64) || undefined,
        ...(payload.callbackUrl ? { callback_url: clean(payload.callbackUrl, 2000) } : {}),
        ...(payload.outputDestination ? { media_output_destination: clean(payload.outputDestination, 500) } : {}),
      };
      const result = await client.request('/tools/lip-sync', { method: 'POST', body: JSON.stringify(body) }, 60_000);
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
    async download(taskId, normalizedStatus = {}) {
      const url = clean(normalizedStatus.downloadUrl, 8000);
      if (!url) throw codedError(`${CODE}_OUTPUT_MISSING`, '火山没有返回成片地址');
      const response = await fetchImpl(url, { method: 'GET' });
      if (!response.ok) throw codedError(`${CODE}_DOWNLOAD_FAILED`, '成片下载失败', { retryable: true });
      return response;
    },
    /* 本地上传共用同一套（同一份票据协议）—— 视频与音频都走它 */
    async uploadLocalFile({ filePath, fileName = '' } = {}) {
      const uploaded = await client.uploadLocalFile({ filePath, fileName: fileName || 'clip.mp4' });
      return { fileId: uploaded.fileId, mediaUrl: uploaded.url };
    },
  };
}

/* 诊断用：缺 Key 时说人话（与字幕擦除共用同一把 Key，所以原因文案指向同一个环境变量） */
export function volcLipSyncReadiness(apiKey) {
  const configured = Boolean(clean(apiKey, 500));
  return {
    configured,
    reason: configured ? '' : '未配置火山 AI MediaKit 的 API Key（控制台创建后填进 server/.env 的 VOLC_MEDIAKIT_API_KEY）',
  };
}

/* 文档出处（2026-09-26 逐字核对，别只信注释——改契约前回到这两页看一眼）：
   · 提交任务 API（路径 + 8 个 Body 参数 + 响应/错误）  https://docs.volcengine.com/docs/6448/2656064
   · 开发指南（流程 / 人像要求 / RTF / 限制）           https://docs.volcengine.com/docs/6448/2658349
   · 查询任务信息 API（status 枚举 / 结果 24 小时）      https://docs.volcengine.com/docs/6448/2278532
   · 视频工具计费（口型对齐 1 元/分钟，按输出时长）      https://docs.volcengine.com/docs/6448/2486473
   · 多源媒体输入与本地上传（mediakit:// 那条路）       https://docs.volcengine.com/docs/6448/2536893 */
