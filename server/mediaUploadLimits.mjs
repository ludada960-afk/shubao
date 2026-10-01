/* ═══ 批 CY-㊴ 之十四（2026-10-01）：上传体积上限的**唯一真相** ═════════════════════
   用户原话：「等了非常久它才弹出来这个提示，然后素材上传不上来。」

   根因不是"上限太小"，是**同一个上限在三个地方各写了一份，只改了一处**：

     server/videoUploadService.mjs  LIMITS.video      300MB  ← 上次只改了这个
     server/videoGeneration.mjs     INPUT_LIMITS.video  50MB  ← 没改
     server/index.mjs               limits.video       50MB  ← 没改（且是内联字面量）

   tus 通道的前两道关（onUploadCreate 的 bytes 校验、Server 的 maxSize）读的是
   300MB，所以 5MB 一块地把整个文件**全部传完**；最后一块 PATCH 触发
   onUploadFinish → importUploadedAsset → 撞上 videoGeneration.mjs 那个还是 50MB 的
   INPUT_LIMITS → 413。⇒ 用户看到的正是"传了很久很久，最后才失败"。

   这个模块只做一件事：**让上限只有一份**。三处都从这里取，
   以后改大小只改这一行，再也不存在"改了一处漏了两处"。
   （CONTENT_TYPES 同理，也在下面统一了 —— 之前 videoUploadService 与
     videoGeneration 各有一份，格式白名单也可能对不上。） */

const MB = 1024 * 1024;

export const MEDIA_UPLOAD_LIMITS = Object.freeze({
  image: 10 * MB,
  video: 300 * MB,
  audio: 100 * MB,
});

export const MEDIA_UPLOAD_CONTENT_TYPES = Object.freeze({
  image: Object.freeze(['image/jpeg', 'image/png', 'image/webp']),
  video: Object.freeze(['video/mp4', 'video/webm', 'video/quicktime']),
  audio: Object.freeze(['audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/x-wav', 'audio/webm']),
});

/** 允许的媒体类型（大小写/参数已归一） */
export function isSupportedMediaContentType(kind, contentType) {
  const allowed = MEDIA_UPLOAD_CONTENT_TYPES[kind];
  if (!allowed) return false;
  const normalized = String(contentType || '').trim().toLowerCase().split(';')[0];
  return allowed.includes(normalized);
}

/** 供 /api/video/capabilities 对外公布，前端据此在上传前就拦（不传原文 tus 报错） */
export function mediaUploadLimits() {
  return { ...MEDIA_UPLOAD_LIMITS };
}

/** 人话版上限描述，出现在服务端 413 与前端提示里，保证两边同一句口径 */
export function formatMediaSize(bytes) {
  const value = Number(bytes || 0);
  if (!(value > 0)) return '0 MB';
  return value >= 1024 * MB ? `${(value / 1024 / MB).toFixed(1)} GB` : `${Math.round(value / MB)} MB`;
}
