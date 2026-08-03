import * as ort from 'onnxruntime-web/wasm';
import ortWasmUrl from 'onnxruntime-web/ort-wasm-simd-threaded.wasm?url';

import {
  normalizeSegmentationOutput,
  preprocessSegmentationImage,
  SEGMENTATION_INPUT_SIZE,
  SEGMENTATION_MODEL_SHA256,
  SEGMENTATION_MODEL_URL,
} from './canvasSegmentationModel.js';

const MODEL_CACHE = 'shubao-canvas-segmentation-v1';
const EXPECTED_MODEL_BYTES = 4_574_861;
const cancelledJobs = new Set();
let sessionPromise = null;

ort.env.wasm.numThreads = 1;
ort.env.wasm.proxy = false;
ort.env.wasm.wasmPaths = { wasm: new URL(ortWasmUrl, self.location.href).href };

function postProgress(jobId, stage, detail = {}) {
  self.postMessage({ type: 'progress', jobId, stage, ...detail });
}

function workerError(error) {
  return {
    code: error?.code || 'CANVAS_SEGMENTATION_WORKER_FAILED',
    message: error?.message || '智能抠图组件运行失败',
  };
}

function assertBrowserSupport() {
  if (typeof WebAssembly !== 'object'
    || typeof OffscreenCanvas !== 'function'
    || typeof createImageBitmap !== 'function'
    || typeof crypto !== 'object'
    || !crypto.subtle) {
    const error = new Error('当前浏览器不支持本地智能抠图，请升级浏览器后重试');
    error.code = 'CANVAS_SEGMENTATION_BROWSER_UNSUPPORTED';
    throw error;
  }
}

function invalidModelError() {
  const error = new Error('智能抠图模型文件不完整，请刷新后重试');
  error.code = 'CANVAS_SEGMENTATION_MODEL_INVALID';
  return error;
}

async function verifyModelIntegrity(bytes) {
  if (bytes.byteLength !== EXPECTED_MODEL_BYTES) throw invalidModelError();
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  const actual = [...digest].map(value => value.toString(16).padStart(2, '0')).join('');
  if (actual !== SEGMENTATION_MODEL_SHA256) throw invalidModelError();
}

async function readResponseBytes(response, jobId) {
  const headerBytes = Number(response.headers.get('content-length'));
  const total = Number.isFinite(headerBytes) && headerBytes > 0 ? headerBytes : EXPECTED_MODEL_BYTES;
  if (!response.body?.getReader) {
    const buffer = await response.arrayBuffer();
    postProgress(jobId, 'model-download', { loaded: buffer.byteLength, total });
    return new Uint8Array(buffer);
  }
  const reader = response.body.getReader();
  const chunks = [];
  let loaded = 0;
  postProgress(jobId, 'model-download', { loaded, total });
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.byteLength;
    postProgress(jobId, 'model-download', { loaded, total: Math.max(total, loaded) });
  }
  const bytes = new Uint8Array(loaded);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

async function loadModel(jobId) {
  const request = new Request(SEGMENTATION_MODEL_URL, { credentials: 'same-origin' });
  const cache = typeof caches === 'object' ? await caches.open(MODEL_CACHE) : null;
  let response = cache ? await cache.match(request) : null;
  const cached = Boolean(response);
  if (!response) {
    response = await fetch(request);
    if (!response.ok) throw new Error(`智能抠图模型加载失败 (${response.status})`);
  }
  const bytes = await readResponseBytes(response, jobId);
  try {
    await verifyModelIntegrity(bytes);
  } catch (error) {
    if (cached && cache) await cache.delete(request).catch(() => {});
    throw error;
  }
  if (!cached && cache) {
    const headers = { 'content-type': 'application/octet-stream', 'content-length': String(bytes.byteLength) };
    await cache.put(request, new Response(bytes, { status: 200, headers })).catch(() => {});
  }
  return { bytes, cached };
}

async function ensureSession(jobId) {
  if (!sessionPromise) {
    sessionPromise = (async () => {
      const model = await loadModel(jobId);
      postProgress(jobId, 'model-initialize');
      const session = await ort.InferenceSession.create(model.bytes, {
        executionProviders: ['wasm'],
        graphOptimizationLevel: 'all',
      });
      return { session, cached: model.cached };
    })().catch(error => {
      sessionPromise = null;
      throw error;
    });
  }
  return sessionPromise;
}

function normalizePrompt(prompt, image) {
  const box = Array.isArray(prompt?.box) ? prompt.box.map(Number) : [];
  const id = typeof prompt?.id === 'string' ? prompt.id.trim() : '';
  if (!id || box.length !== 4 || !box.every(Number.isSafeInteger)) {
    throw new TypeError('商品裁剪框无效');
  }
  const [left, top, right, bottom] = box;
  if (left < 0 || top < 0 || right > image.width || bottom > image.height || right <= left || bottom <= top) {
    throw new TypeError('商品裁剪框超出图片范围');
  }
  return { id, box };
}

async function inferMask(session, image, prompt) {
  const [left, top, right, bottom] = prompt.box;
  const canvas = new OffscreenCanvas(SEGMENTATION_INPUT_SIZE, SEGMENTATION_INPUT_SIZE);
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('无法创建智能抠图画布');
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(
    image,
    left,
    top,
    right - left,
    bottom - top,
    0,
    0,
    SEGMENTATION_INPUT_SIZE,
    SEGMENTATION_INPUT_SIZE,
  );
  const imageData = context.getImageData(0, 0, SEGMENTATION_INPUT_SIZE, SEGMENTATION_INPUT_SIZE);
  const input = new ort.Tensor(
    'float32',
    preprocessSegmentationImage(imageData),
    [1, 3, SEGMENTATION_INPUT_SIZE, SEGMENTATION_INPUT_SIZE],
  );
  const result = await session.run({ [session.inputNames[0]]: input });
  const output = result[session.outputNames[0]];
  if (!output?.data?.length) throw new Error('智能抠图模型没有返回结果');
  const alpha = normalizeSegmentationOutput(output.data);
  const rgba = new Uint8ClampedArray(alpha.length * 4);
  for (let index = 0; index < alpha.length; index += 1) {
    const offset = index * 4;
    rgba[offset] = alpha[index];
    rgba[offset + 1] = alpha[index];
    rgba[offset + 2] = alpha[index];
    rgba[offset + 3] = 255;
  }
  context.putImageData(new ImageData(rgba, SEGMENTATION_INPUT_SIZE, SEGMENTATION_INPUT_SIZE), 0, 0);
  return canvas.convertToBlob({ type: 'image/png' });
}

async function warm(jobId) {
  try {
    assertBrowserSupport();
    const existing = Boolean(sessionPromise);
    const { cached } = await ensureSession(jobId);
    if (!cancelledJobs.has(jobId)) self.postMessage({ type: 'ready', jobId, cached: existing || cached });
  } catch (error) {
    if (!cancelledJobs.has(jobId)) self.postMessage({ type: 'error', jobId, ...workerError(error) });
  } finally {
    cancelledJobs.delete(jobId);
  }
}

async function segment(jobId, imageUrl, rawPrompts) {
  let image;
  try {
    assertBrowserSupport();
    const { session } = await ensureSession(jobId);
    if (cancelledJobs.has(jobId)) return;
    const response = await fetch(imageUrl, { credentials: 'same-origin' });
    if (!response.ok) throw new Error(`源图片加载失败 (${response.status})`);
    image = await createImageBitmap(await response.blob());
    const prompts = rawPrompts.map(prompt => normalizePrompt(prompt, image));
    const masks = [];
    for (let index = 0; index < prompts.length; index += 1) {
      if (cancelledJobs.has(jobId)) return;
      postProgress(jobId, 'segmenting', { completed: index, total: prompts.length });
      const blob = await inferMask(session, image, prompts[index]);
      if (cancelledJobs.has(jobId)) return;
      masks.push({ promptId: prompts[index].id, buffer: await blob.arrayBuffer() });
      postProgress(jobId, 'segmenting', { completed: index + 1, total: prompts.length });
    }
    if (!cancelledJobs.has(jobId)) {
      self.postMessage({ type: 'result', jobId, masks }, masks.map(mask => mask.buffer));
    }
  } catch (error) {
    if (!cancelledJobs.has(jobId)) self.postMessage({ type: 'error', jobId, ...workerError(error) });
  } finally {
    image?.close?.();
    cancelledJobs.delete(jobId);
  }
}

self.onmessage = event => {
  const message = event?.data || {};
  if (message.type === 'cancel') {
    cancelledJobs.add(message.jobId);
    return;
  }
  if (message.type === 'warm') {
    void warm(message.jobId);
    return;
  }
  if (message.type === 'segment') {
    void segment(message.jobId, message.imageUrl, Array.isArray(message.prompts) ? message.prompts : []);
  }
};
