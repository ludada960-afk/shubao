/* 上传前的**本地**素材探测 —— 画布建框要用的真实尺寸，不等上传、不走服务器。
 *
 * ── 为什么需要它 ──────────────────────────────────────────────────────────────
 * 用户原话：「素材的尺寸要跟你的框是同等适配的……这些你自己要想明白。」
 *
 * 改之前的真实情况（不是猜，是读代码读出来的）：
 *   `canvasStudioModel.js` 的 `createUploadedVideoNodes` 里 `const width = 320` 是写死的，
 *   `aspectRatio` 只从 `asset.width/asset.height` 取 —— 而那是**上传完成后服务器才有的信息**。
 *   ⇒ 一条 9:16 的竖屏片子，会先躺进 320×180 的 16:9 框里（上下/左右留黑边），
 *     等 `<video onLoadedMetadata>` 触发后再校正一次 —— **用户会看到框跳一下**。
 *   原注释自己承认了：「拿不到的部分交给 onLoadedMetadata 事后校正」。
 *
 * ── 为什么本地就拿得到 ────────────────────────────────────────────────────────
 * `URL.createObjectURL(file)` + `<video preload="metadata">` 就能读到
 * `videoWidth / videoHeight / duration`；图片走 `createImageBitmap`（或 `<img>` 的 naturalWidth）。
 * 这是**纯本地**的，毫秒级，不等服务端往返。
 *
 * ⚠️ `src/pages/VideoStudio/videoAssetAnalysis.js` 里其实已经有同样的两个探针
 *   （`videoMetadata` / `imageMetadata`），但它们是**模块私有**的、而且顺带抽 3 帧（重），
 *   画布上传路径完全没用。这里抽一份**只读 metadata、不抽帧**的轻量版给上传路径用。
 *
 * ⚠️ 探测失败**不能挡住上传**：拿不到尺寸就返回 null，调用方落回原来的默认值。
 *   尺寸是锦上添花，传不上去才是硬伤。
 */

/** 等一个媒体元素上的事件（成功 resolve，error/超时 reject）。 */
function waitForMedia(target, event, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { cleanup(); reject(new Error(`等待 ${event} 超时`)); }, timeoutMs);
    const done = () => { cleanup(); resolve(); };
    const failed = () => { cleanup(); reject(new Error('素材无法读取')); };
    const cleanup = () => {
      clearTimeout(timer);
      target.removeEventListener('error', failed);
      target.removeEventListener(event, done);
    };
    target.addEventListener(event, done, { once: true });
    target.addEventListener('error', failed, { once: true });
  });
}

/** 图片：优先 createImageBitmap（不建 DOM、不解码整张），退回 <img>。 */
async function probeImage(file) {
  if (typeof globalThis.createImageBitmap === 'function') {
    const bitmap = await globalThis.createImageBitmap(file);
    const out = { width: bitmap.width, height: bitmap.height, duration: 0 };
    bitmap.close?.();
    return out;
  }
  const source = URL.createObjectURL(file);
  const image = new Image();
  image.src = source;
  try {
    await waitForMedia(image, 'load');
    return { width: image.naturalWidth, height: image.naturalHeight, duration: 0 };
  } finally {
    URL.revokeObjectURL(source);
  }
}

/** 视频：只读 metadata，**不抽帧**（抽帧留给 VideoStudio 那个模块，上传路径不需要）。 */
async function probeVideo(file) {
  const source = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.preload = 'metadata';
  video.muted = true;
  video.src = source;
  try {
    await waitForMedia(video, 'loadedmetadata');
    return {
      width: Number(video.videoWidth) || 0,
      height: Number(video.videoHeight) || 0,
      duration: Number.isFinite(video.duration) ? Number(video.duration) : 0,
    };
  } finally {
    video.removeAttribute('src');
    video.load();
    URL.revokeObjectURL(source);
  }
}

/**
 * 探一个上传文件的真实尺寸。
 * @returns {Promise<{width:number,height:number,duration:number}|null>}
 *   拿不到 / 不支持 / 非浏览器环境一律返回 `null`（**绝不抛**）——
 *   尺寸是锦上添花，探测失败不该让整个上传失败。
 */
export async function probeLocalMediaSize(file) {
  if (!file || typeof file !== 'object') return null;
  const type = String(file.type || '');
  try {
    if (type.startsWith('image/')) return await probeImage(file);
    if (type.startsWith('video/')) return await probeVideo(file);
  } catch {
    /* 探测失败不是上传失败：落回调用方的默认值 */
    return null;
  }
  return null;
}

/** 并发探多个文件（图片/视频混传时用），失败的那个返回 null。 */
export async function probeLocalMediaSizes(files = []) {
  return Promise.all((files || []).map(file => probeLocalMediaSize(file)));
}