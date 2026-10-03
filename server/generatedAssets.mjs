import crypto from 'crypto';
/* AIGC 隐式标识（《标识办法》第五条三要素）。见 server/aigcStamp.mjs 顶部的法条与待核项。 */
import { stampImage, contentIdFor } from './aigcStamp.mjs';
import { link, mkdir, readFile, stat, unlink, writeFile } from 'node:fs/promises';
import { resolve, basename } from 'node:path';
/* aigcStamp 写 JPEG/WebP 元数据时要用（PNG 走零重编码的 chunk 插入，用不到它）。 */
import sharp from 'sharp';

/* ════════════════════════════════════════════════════════════════════════════
   为什么本仓库**没有**显式标识（画面角标）的代码 —— 2026-10-03 产品决定

   本站产物是**电商商品图**，用户拿去传淘宝/天猫、做社媒、发自媒体。
   画面角标会让产物在真实场景里**直接不可用**，所以不做。
   实现曾经存在（server/aigcVisibleLabel.mjs + AIGC_VISIBLE_LABEL 开关），
   已**整体删除** —— 不是「默认关」，是代码里不存在任何能画可见标识的路径。
   留着开关等于留一颗随时能踩的雷：改个环境变量就能全站生效。

   本文件只做**隐式标识**（《标识办法》第五条：文件元数据三要素），
   且是零重编码的 —— 产物像素一个字节都不会因为合规而改变。

   ⚠️ 法律敞口（如实记录，不要把这里当成"已合规"）：
     《标识办法》**第四条**要求图片「在适当位置添加显著的提示标识」，且
     「提供下载、复制、导出等功能时，应当确保文件中含有满足要求的显式标识」。
     **不做显式标识并不满足第四条。**

     法定的「不提供显式标识」路径是**第九条**：
       「用户申请服务提供者提供没有添加显式标识的生成合成内容的，服务提供者
         可以在通过用户协议明确用户的标识义务和使用责任后，提供不含显式标识的
         生成合成内容，并依法留存提供对象信息等相关日志不少于六个月。」
     三个条件：① 用户申请；② 用户协议明确用户的标识义务与使用责任；
     ③ 日志留存 ≥6 个月。
     · ③ 基本现成 —— 生成/计费表已有 owner_email + created_at。
     · ①② **尚未实现**（没有"申请"动作，协议里也还没写"用户不得删除标识"
       的责任条款）。

   ⇒ 要走到合规，是补 ①②，不是把角标加回来。
   ════════════════════════════════════════════════════════════════════════════ */

const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const DEFAULT_DOWNLOAD_TIMEOUT_MS = 20_000;
const DEFAULT_DOWNLOAD_RETRY_DELAYS_MS = Object.freeze([500, 1_500]);
const RETRYABLE_DOWNLOAD_CODES = new Set([
  'ECONNRESET',
  'ECONNREFUSED',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'EPIPE',
  'ETIMEDOUT',
]);
const MIME_EXTENSIONS = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

function getSafeHttpUrl(sourceUrl) {
  let parsed;
  try { parsed = new URL(sourceUrl); } catch { throw new Error('生成图片来源必须是 http(s) URL'); }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('生成图片来源必须是 http(s) URL');
  }
  return parsed;
}

function assetNameFor(buffer, extension) {
  return `${crypto.createHash('sha256').update(buffer).digest('hex')}.${extension}`;
}

function integrityError(cause) {
  return Object.assign(new Error('生成图片稳定存储校验失败'), {
    code: 'GENERATED_ASSET_INTEGRITY_ERROR',
    ...(cause ? { cause } : {}),
  });
}

function isRetryableDownloadError(error) {
  const name = String(error?.name || '').trim();
  const code = String(error?.code || '').trim().toUpperCase();
  return name === 'TimeoutError'
    || name === 'AbortError'
    || error instanceof TypeError
    || RETRYABLE_DOWNLOAD_CODES.has(code)
    || error?.retryable === true;
}

function retryableDownloadStatus(status) {
  return status === 408 || status === 425 || status === 429
    || (Number.isInteger(status) && status >= 500);
}

export function stableAssetDataUrl({ buffer, contentType } = {}) {
  if (!Buffer.isBuffer(buffer) || !buffer.length) throw new Error('生成图片内容为空');
  const mimeType = String(contentType || '').trim().toLowerCase();
  if (!MIME_EXTENSIONS[mimeType]) throw new Error('生成图片类型不受支持');
  return `data:${mimeType};base64,${buffer.toString('base64')}`;
}

export function createGeneratedAssetStore({
  directory,
  publicPath = '/api/generated-assets',
  fetchImpl = fetch,
  maxBytes = MAX_IMAGE_BYTES,
  readFileImpl = readFile,
  onPersist = null,
  downloadTimeoutMs = DEFAULT_DOWNLOAD_TIMEOUT_MS,
  retryDelaysMs = DEFAULT_DOWNLOAD_RETRY_DELAYS_MS,
  sleepImpl = milliseconds => new Promise(resolveSleep => setTimeout(resolveSleep, milliseconds)),
} = {}) {
  if (!directory) throw new Error('generated asset directory is required');
  if (typeof readFileImpl !== 'function') throw new TypeError('readFileImpl must be a function');
  if (!Number.isSafeInteger(downloadTimeoutMs) || downloadTimeoutMs <= 0
    || !Array.isArray(retryDelaysMs) || retryDelaysMs.length > 5
    || retryDelaysMs.some(delay => !Number.isSafeInteger(delay) || delay < 0)
    || typeof sleepImpl !== 'function') {
    throw new TypeError('generated asset download retry configuration is invalid');
  }
  const root = resolve(directory);

  async function notifyPersist(asset) {
    if (typeof onPersist !== 'function') return;
    try { await onPersist(asset); } catch {}
  }

  async function downloadAndPersist({ sourceUrl, taskId = '', label = '' } = {}) {
    getSafeHttpUrl(sourceUrl);
    let response;
    let buffer;
    for (let attempt = 0; attempt <= retryDelaysMs.length; attempt += 1) {
      try {
        response = await fetchImpl(sourceUrl, { signal: AbortSignal.timeout(downloadTimeoutMs) });
        if (!response?.ok) {
          const error = Object.assign(
            new Error(`下载生成图片失败: ${response?.status || 'network error'}`),
            { retryable: retryableDownloadStatus(response?.status) },
          );
          throw error;
        }
        buffer = Buffer.from(await response.arrayBuffer());
        break;
      } catch (error) {
        const retryable = isRetryableDownloadError(error);
        if (!retryable) throw error;
        if (attempt >= retryDelaysMs.length) {
          throw Object.assign(new Error('生成图片下载暂时不可用', { cause: error }), {
            code: 'GENERATED_ASSET_DOWNLOAD_UNAVAILABLE',
            retryable: true,
          });
        }
        await sleepImpl(retryDelaysMs[attempt]);
      }
    }
    const mimeType = (response.headers?.get('content-type') || '').split(';')[0].trim().toLowerCase();
    const extension = MIME_EXTENSIONS[mimeType];
    if (!extension) throw new Error('生成图片类型不受支持');
    const declaredLength = Number(response.headers?.get('content-length') || 0);
    if (declaredLength > maxBytes) throw new Error('生成图片文件过大');
    if (!buffer.length || buffer.length > maxBytes) throw new Error('生成图片文件过大或为空');

    /* ═══ AIGC 隐式标识（《标识办法》第五条三要素）══════════════════════════════
       写文件元数据，**零重编码** —— 产物像素一个字节都不会因为合规而改变。
       画面上的显式标识（第四条）本仓库**不做**，理由与法律敞口见本文件顶部。 */
    const contentId = contentIdFor(taskId, mimeType + ':' + buffer.length);
    const stampedBuffer = await stampImage(buffer, {
      contentType: mimeType,
      contentId,
      sharp,
    });
    const fileName = assetNameFor(stampedBuffer, extension);
    await mkdir(root, { recursive: true });
    const filePath = resolve(root, fileName);
    try { await stat(filePath); } catch { await writeFile(filePath, stampedBuffer, { flag: 'wx' }); }
    const asset = {
      id: fileName,
      fileName,
      taskId,
      label,
      contentType: mimeType,
      url: `${publicPath}/${fileName}`,
    };
    await notifyPersist(asset);
    return { asset, buffer, contentType: mimeType };
  }

  async function persist(input = {}) {
    const { asset } = await downloadAndPersist(input);
    return asset;
  }

  async function persistBuffer({ buffer, contentType = 'image/png', taskId = '', label = '', generated = false } = {}) {
    if (!Buffer.isBuffer(buffer) || !buffer.length) throw new Error('生成图片内容为空');
    if (!MIME_EXTENSIONS[contentType]) throw new Error('生成图片类型不受支持');
    if (buffer.length > maxBytes) throw new Error('生成图片文件过大');
    const extension = MIME_EXTENSIONS[contentType];

    /* ⚠️ 这条路径**默认不打**任何 AIGC 标识 ——
       persistBuffer 是条**混合**路径，同时服务两类东西：
         · ecommerce-original / ecommerce-preview → **用户上传**（assetUpload.mjs）
         · canvas_crop / canvas_annotation / canvas_replace_text → 用户素材的派生编辑
       用户上传的照片不是我们生成的，打上 AIGC 属于**虚假标识**，那本身也是违规；
       而 test/ecommerce-asset-upload.test.mjs:104 断言的
       `assert.deepEqual(storedOriginal.buffer, originalBytes)` 正是这条契约。

       但它**也**服务真正的生成结果：provider 直接回 base64 的那些
       （xhs 封面 / plog 封面，server/billing/contentBilling.mjs:271）。
       那批以前是既没显式也没隐式标识 —— 一个合规缺口。

       ⇒ 解法不是「按路径猜」，而是让调用方**显式声明** generated: true。
          猜错的代价是给用户自己的照片打上"AI 生成"，那比漏标更糟。 */
    let out = buffer;
    if (generated === true) {
      const contentId = contentIdFor(taskId, contentType + ':' + buffer.length);
      out = await stampImage(out, { contentType, contentId, sharp });
    }

    const fileName = assetNameFor(out, extension);
    await mkdir(root, { recursive: true });
    const filePath = resolve(root, fileName);
    const tempPath = resolve(root, `.${fileName}.${crypto.randomUUID()}.tmp`);
    await writeFile(tempPath, out, { flag: 'wx' });
    try {
      try {
        await link(tempPath, filePath);
      } catch (error) {
        if (error?.code !== 'EEXIST') throw error;
        let existing;
        try {
          existing = await readFileImpl(filePath);
        } catch (readError) {
          throw integrityError(readError);
        }
        if (assetNameFor(existing, extension) !== fileName) throw integrityError();
      }
    } finally {
      try {
        await unlink(tempPath);
      } catch (error) {
        if (error?.code !== 'ENOENT') throw error;
      }
    }
    const asset = {
      id: fileName,
      fileName,
      taskId,
      label,
      contentType,
      url: `${publicPath}/${fileName}`,
    };
    await notifyPersist(asset);
    return asset;
  }

  async function read(assetId) {
    const safeName = basename(assetId || '');
    if (!/^[a-f0-9]{64}\.(jpg|png|webp)$/.test(safeName)) return null;
    const filePath = resolve(root, safeName);
    try {
      const buffer = await readFileImpl(filePath);
      const extension = safeName.split('.').pop();
      return { buffer, contentType: extension === 'jpg' ? 'image/jpeg' : `image/${extension}` };
    } catch (error) {
      if (error?.code === 'ENOENT') return null;
      throw error;
    }
  }

  async function persistAndRead(input = {}) {
    return downloadAndPersist(input);
  }

  return { persist, persistBuffer, persistAndRead, read };
}
