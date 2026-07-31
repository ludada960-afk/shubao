// ─────────────────────────────────────────────────────────────
// API 服务层：标准化重构版
// ─────────────────────────────────────────────────────────────

import { createApiError } from './apiError.js';
import { quoteBillingAction } from './billing.js';
import { consumeSseJson } from './sse.js';
import { getSessionToken } from './auth.js';
import {
  clearEcommerceTaskReference,
  isEcommerceAssetDeliverable,
  loadEcommerceTaskReference,
  normalizeEcommerceDeliveryRecord,
  normalizeEcommerceAssets,
  saveEcommerceTaskReference,
} from '../pages/Home/ec/ecommerceTaskProgressModel.js';
import {
  filterWorksForOwner,
  mergeWorkCollections,
  replaceCachedWorksForOwner,
} from '../utils/workRecords.js';
import { toGenerationStatus } from '../pages/EcCanvas/generationStatusModel.js';

const API_BASE = ''; // 使用相对路径，由 Vite Proxy 转发
const ECOMMERCE_SUITE_REPAIR_VERSION = 1;
const ECOMMERCE_SUITE_REPAIR_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_AUTOMATIC_SUITE_REPAIRS = 2;

export const API = API_BASE;

export function getSessionEmail() {
  try { return JSON.parse(localStorage.getItem('sb-auth') || 'null')?.email || ''; } catch { return ''; }
}

export function withSessionEmail(payload = {}) {
  return { ...payload, email: payload.email || getSessionEmail() };
}

function signedSessionHeaders(headers = {}) {
  const token = getSessionToken();
  return token ? { ...headers, Authorization: `Bearer ${token}` } : headers;
}

function ecommerceTaskError(task) {
  const errors = task?.output?.errors || task?.errors || [];
  const detail = Array.isArray(errors)
    ? errors.find(item => item?.error || item?.message) || {}
    : {};
  const error = new Error(toGenerationStatus({ ...task, error: detail.error || detail.message || task?.error }).detail);
  for (const key of [
    'code',
    'status',
    'retryable',
    'reQuoteRequired',
    'resumeable',
    'required',
    'available',
  ]) {
    if (detail[key] !== undefined) error[key] = detail[key];
  }
  return error;
}

function stableTaskImages(task) {
  const assets = normalizeEcommerceAssets(task?.assets);
  const assetsById = new Map(assets.map(asset => [asset.id, asset]).filter(([id]) => id));
  const images = {};
  Object.entries(task?.output?.images || {}).forEach(([id, url]) => {
    const asset = assetsById.get(id);
    if (id && url && (!asset || isEcommerceAssetDeliverable(asset))) images[id] = url;
  });
  assets.forEach(asset => {
    if (isEcommerceAssetDeliverable(asset)) images[asset.id] = asset.stableUrl;
  });
  return images;
}

function stableTaskImageRecords(task) {
  const assets = normalizeEcommerceAssets(task?.assets);
  const assetsById = new Map(assets.map(asset => [asset.id, asset]).filter(([id]) => id));
  return Object.entries(stableTaskImages(task)).map(([id, stableUrl]) => normalizeEcommerceDeliveryRecord({
    ...(assetsById.get(id) || {}),
    id,
    label: assetsById.get(id)?.label || id,
    stableUrl,
    state: 'completed',
  })).filter(Boolean);
}

function emitStableTaskImages(task, emitted, onImage, taskId = '') {
  stableTaskImageRecords(task).forEach(record => {
    const { id, url } = record;
    const emissionKey = `${id}\u0000${url}`;
    if (emitted.has(emissionKey)) return;
    emitted.add(emissionKey);
    onImage?.({
      id,
      url,
      stableUrl: url,
      role: record.role,
      label: record.label,
      displayName: record.displayName,
      group: record.group,
      ratio: record.ratio,
      size: record.size,
      width: record.width,
      height: record.height,
      state: 'completed',
      taskId,
    });
  });
}

function taskWithNormalizedAssets(task) {
  return task && typeof task === 'object'
    ? { ...task, assets: normalizeEcommerceAssets(task.assets) }
    : task;
}

function taskStatus(task) {
  return String(task?.status || task?.state || '').trim().toLowerCase();
}

function ecommerceTaskExpiredError(status) {
  const error = new Error('保存的生成任务已过期或不可用，请重新开始');
  error.code = 'ECOMMERCE_TASK_EXPIRED';
  error.status = status;
  error.resumeable = false;
  return error;
}

function ecommerceRetryRequiredError(task) {
  const error = ecommerceTaskError(task);
  error.message = '本次未能形成完整套图，系统没有交付半成品。请重新完成整套生成';
  error.code = 'ECOMMERCE_TASK_RETRY_REQUIRED';
  error.retryable = true;
  return error;
}

function suiteRepairStorageKey({ ownerEmail, draftId }) {
  const owner = String(ownerEmail || '').trim().toLowerCase();
  const draft = String(draftId || '').trim();
  return owner && draft
    ? `sb-ecommerce-suite-repair:v${ECOMMERCE_SUITE_REPAIR_VERSION}:${encodeURIComponent(owner)}:${encodeURIComponent(draft)}`
    : '';
}

function loadSuiteRepairCheckpoint(context) {
  const key = suiteRepairStorageKey(context);
  if (!key || typeof localStorage === 'undefined') return null;
  try {
    const value = JSON.parse(localStorage.getItem(key) || 'null');
    if (!value || value.version !== ECOMMERCE_SUITE_REPAIR_VERSION) return null;
    if (!Number.isFinite(value.updatedAt)
      || Date.now() - value.updatedAt > ECOMMERCE_SUITE_REPAIR_TTL_MS) {
      localStorage.removeItem(key);
      return null;
    }
    return value;
  } catch {
    localStorage.removeItem(key);
    return null;
  }
}

function saveSuiteRepairCheckpoint(context, checkpoint) {
  const key = suiteRepairStorageKey(context);
  if (!key || typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify({
      version: ECOMMERCE_SUITE_REPAIR_VERSION,
      ...checkpoint,
      updatedAt: Date.now(),
    }));
  } catch {}
}

function clearSuiteRepairCheckpoint(context) {
  const key = suiteRepairStorageKey(context);
  if (!key || typeof localStorage === 'undefined') return;
  try { localStorage.removeItem(key); } catch {}
}

async function repairIncompleteSuite(task, options) {
  const sourceTaskId = String(task?.id || task?.taskId || options.taskId || '').trim();
  if (!sourceTaskId) throw ecommerceRetryRequiredError(task);
  const repairAttempt = Number.isSafeInteger(options.repairAttempt) ? options.repairAttempt : 0;
  if (repairAttempt >= MAX_AUTOMATIC_SUITE_REPAIRS) {
    clearEcommerceTaskReference({
      ownerEmail: options.ownerEmail,
      draftId: options.draftId,
      taskId: sourceTaskId,
    });
    clearSuiteRepairCheckpoint(options);
    const error = ecommerceRetryRequiredError(task);
    error.message = '系统已自动补全两轮，但仍未形成完整套图。本轮未交付，也未扣除未交付图片额度，请稍后重试';
    throw error;
  }

  options.onProgress?.({
    ...taskWithNormalizedAssets(task),
    status: 'repairing',
    automaticSuiteRepair: repairAttempt + 1,
  });
  const saved = loadSuiteRepairCheckpoint(options);
  let quoteId = saved?.sourceTaskId === sourceTaskId ? saved.quoteId : '';
  let retryTaskId = saved?.sourceTaskId === sourceTaskId ? saved.retryTaskId : '';

  if (!retryTaskId) {
    if (!quoteId) {
      const retryQuote = await quoteFailedEcommerceTask(sourceTaskId, { signal: options.signal });
      quoteId = retryQuote.quote.quoteId;
      saveSuiteRepairCheckpoint(options, {
        sourceTaskId,
        quoteId,
        retryTaskId: '',
        repairAttempt,
      });
    }
    const queued = await retryFailedEcommerceTask(sourceTaskId, {
      billingQuoteId: quoteId,
      signal: options.signal,
    });
    retryTaskId = String(queued?.taskId || queued?.task?.id || '').trim();
    if (!retryTaskId) throw new Error('整套自动补全任务创建失败，请稍后重试');
    saveSuiteRepairCheckpoint(options, {
      sourceTaskId,
      quoteId,
      retryTaskId,
      repairAttempt,
    });
  }

  saveEcommerceTaskReference({
    ownerEmail: options.ownerEmail,
    draftId: options.draftId,
    taskId: retryTaskId,
  });
  return pollEcommerceTask(retryTaskId, {
    ...options,
    initialTask: undefined,
    repairAttempt: repairAttempt + 1,
  });
}

async function pollEcommerceTask(taskId, {
  initialTask,
  onImage,
  onProgress,
  pollIntervalMs,
  maxPollAttempts,
  ownerEmail,
  draftId,
  signal,
  isCurrent,
  repairAttempt = 0,
}) {
  const emitted = new Set();
  const pollLimit = Number.isSafeInteger(maxPollAttempts) && maxPollAttempts > 0 ? maxPollAttempts : 600;
  let task = initialTask;
  for (let pollAttempt = 0; pollAttempt < pollLimit; pollAttempt += 1) {
    if (typeof isCurrent === 'function' && !isCurrent()) return null;
    if (!task) {
      await waitFor(Number.isFinite(pollIntervalMs) ? Math.max(0, pollIntervalMs) : 1500);
      if (typeof isCurrent === 'function' && !isCurrent()) return null;
      task = await getEcommerceTask(taskId, { signal });
    }
    if (typeof isCurrent === 'function' && !isCurrent()) return null;
    onProgress?.(taskWithNormalizedAssets(task));
    const status = taskStatus(task);
    const images = stableTaskImages(task);
    if (status === 'needs_review') {
      return repairIncompleteSuite(task, {
        taskId,
        onImage,
        onProgress,
        pollIntervalMs,
        maxPollAttempts,
        ownerEmail,
        draftId,
        signal,
        isCurrent,
        repairAttempt,
      });
    }
    if (status === 'completed') {
      emitStableTaskImages(task, emitted, onImage, taskId);
      clearEcommerceTaskReference({ ownerEmail, draftId, taskId });
      clearSuiteRepairCheckpoint({ ownerEmail, draftId });
      if (Object.keys(images).length === 0) {
        const errors = task?.output?.errors || [];
        const message = errors.find(item => item?.error)?.error;
        throw new Error(message || '生成完成但没有可用图片，请重试');
      }
      return {
        taskId,
        status,
        images,
        imageRecords: stableTaskImageRecords(task),
        errors: task?.output?.errors || [],
        task,
      };
    }
    if (status === 'failed' || status === 'cancelled') {
      clearEcommerceTaskReference({ ownerEmail, draftId, taskId });
      throw ecommerceTaskError(task);
    }
    task = null;
  }
  const error = new Error('生成任务仍在后台处理中，请稍后从作品页继续查看');
  error.code = 'ECOMMERCE_POLL_TIMEOUT';
  error.taskId = taskId;
  error.resumeable = true;
  throw error;
}

function waitFor(ms) {
  return ms > 0 ? new Promise(resolve => setTimeout(resolve, ms)) : Promise.resolve();
}

// 图片代理（解决跨域）
export function proxyImg(url, variant = 'full', format = 'webp') {
  if (!url) return '';
  if (typeof url === 'object') {
    return proxyImg(url.url || url.src || url.image_url || url.cover_url || '', variant, format);
  }
  const sameOrigin = url.match(/^https?:\/\/(?:www\.)?shuimg\.cn(\/.*)$/i);
  if (sameOrigin) return imageVariantUrl(sameOrigin[1], variant, format);
  // 已经是代理地址或 data URI 则直接返回
  if (url.startsWith('/api/') || url.startsWith('data:') || url.startsWith('blob:')) return imageVariantUrl(url, variant, format);
  // 本地相对路径也直接返回
  if (url.startsWith('/')) return url;
  // 处理 http/https 图片 URL
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return imageVariantUrl(`${API_BASE}/api/proxy-image?url=${encodeURIComponent(url)}`, variant, format);
  }
  // 其他情况直接返回原 URL
  return url;
}

export function imageVariantUrl(url, variant = 'full', format = 'webp') {
  const value = String(url || '');
  if (!value || variant === 'full' || value.startsWith('data:') || value.startsWith('blob:')) return value;
  if (!value.startsWith('/api/generated-assets/')
    && !value.startsWith('/api/proxy-image')
    && !value.startsWith('/api/gallery-image')) return value;
  const params = new URLSearchParams();
  params.set('variant', variant);
  if (format === 'avif') params.set('format', 'avif');
  params.set('v', '3');
  return `${value}${value.includes('?') ? '&' : '?'}${params.toString()}`;
}

function imageValue(image) {
  if (typeof image === 'string') return image;
  if (image && typeof image === 'object') return image.url || image.src || image.image_url || '';
  return '';
}

async function imageToDataUrl(image) {
  if (typeof image === 'string') return image;
  if (image?.file) return imageToDataUrl(image.file);
  if (typeof Blob !== 'undefined' && image instanceof Blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('图片读取失败'));
      reader.readAsDataURL(image);
    });
  }
  return imageValue(image);
}

async function prepareImageInputs(images, { signal } = {}) {
  if (signal?.aborted) throw ecommerceUploadAbortError();
  if (!images?.length) return [];
  const values = (await Promise.all(images.map(imageToDataUrl))).filter(Boolean);
  if (signal?.aborted) throw ecommerceUploadAbortError();
  const urls = values.filter(value => /^(?:https?:\/\/|\/api\/)/i.test(value));
  const base64s = values.filter(value => value.startsWith('data:image/'));
  if (!base64s.length) return urls;
  return [...urls, ...(await uploadECTempImages(base64s, { signal }))];
}

function ownedAssetReference(image) {
  if (!image || typeof image !== 'object') return null;
  const assetId = typeof image.assetId === 'string' ? image.assetId.trim() : '';
  const url = imageValue(image);
  return assetId && url ? { assetId, url } : null;
}

function splitEcommerceInputs(images) {
  const owned = [];
  const legacy = [];
  for (const image of Array.isArray(images) ? images : []) {
    const asset = ownedAssetReference(image);
    if (asset) owned.push(asset);
    else legacy.push(image);
  }
  return { owned, legacy };
}

function ecommerceUploadAbortError() {
  const error = new Error('原图上传已取消');
  error.name = 'AbortError';
  return error;
}

export async function uploadEcommerceAsset({ data, file, role = 'product', signal } = {}) {
  if (signal?.aborted) throw ecommerceUploadAbortError();
  const sourceData = data || await imageToDataUrl(file);
  if (signal?.aborted) throw ecommerceUploadAbortError();
  if (typeof sourceData !== 'string' || !sourceData.startsWith('data:image/')) {
    throw new Error('请选择 JPEG 或 PNG 原图后重试');
  }
  const res = await fetch(`${API_BASE}/api/ecommerce/assets`, {
    method: 'POST',
    headers: signedSessionHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ data: sourceData, role }),
    signal,
  });
  if (!res.ok) throw await createApiError(res, '原图上传失败');
  const response = await res.json();
  if (!response?.original?.assetId || !response?.original?.url || !response?.preview?.url) {
    throw new Error('原图上传结果不完整，请重试');
  }
  return {
    assetId: response.original.assetId,
    url: response.original.url,
    previewUrl: response.preview.url,
    role: response.original.role || role,
  };
}

export async function uploadEcommerceAssets(images, role = 'product', { signal } = {}) {
  if (signal?.aborted) throw ecommerceUploadAbortError();
  return Promise.all((Array.isArray(images) ? images : []).map(async image => {
    const existing = ownedAssetReference(image);
    if (existing) {
      return {
        ...existing,
        previewUrl: image.previewUrl || image.preview?.url || image.url,
        role: image.role || role,
      };
    }
    return uploadEcommerceAsset({
      data: typeof image === 'string' && image.startsWith('data:image/') ? image : undefined,
      file: image?.file || image,
      role,
      signal,
    });
  }));
}

function planToSelections(batchPlan) {
  if (Array.isArray(batchPlan?.imageSelections)) return batchPlan.imageSelections;
  if (!batchPlan || typeof batchPlan !== 'object') return null;
  const keyMap = { main: 'main_text', scene: 'main_3x4', sku: 'sku', detail: 'detail_slice_feature' };
  return Object.entries(batchPlan)
    .filter(([key, count]) => keyMap[key] && Number(count) > 0)
    .map(([key, count]) => ({ key: keyMap[key], count: Math.min(20, Number(count)) }));
}

// ─────────────────────────────────────────────────────────────
// 核心生图接口：智能成套生成 (重构版)
// ─────────────────────────────────────────────────────────────

/**
 * 发起成套电商生图任务
 * @param {Object} payload
 * @param {Array<File|string>} payload.productImages - 必须保持不变的产品图
 * @param {Array<File|string>} payload.referenceImages - 仅参考风格的参考图
 * @param {string} payload.sceneStyle - 场景风格 ID 或描述
 * @param {string} payload.platform - 平台 taobao/xiaohongshu
 * @param {Object} payload.batchPlan - 生成计划配置
 */
export async function generateEcommerceSuite({
  productImages,
  referenceImages,
  sceneStyle,
  platform,
  batchPlan,
  email,
  draftId,
  resumeTaskId,
  retry,
  onProgress,
  onImage,
  signal,
  isCurrent
}) {
  return generateEcommerce({
    productName: sceneStyle || '商品',
    category: '其他',
    refImgs: referenceImages || [],
    realShots: productImages || [],
    platform: platform || '淘宝',
    imageSelections: planToSelections(batchPlan),
    email,
    draftId,
    resumeTaskId,
    retry,
    onProgress,
    onImage,
    signal,
    isCurrent,
  });
}

// ─────────────────────────────────────────────────────────────
// 基础工具接口 (保留原有逻辑)
// ─────────────────────────────────────────────────────────────

function canvasBillingActionId() {
  const uuid = globalThis.crypto?.randomUUID?.();
  return uuid ? `canvas-${uuid}` : `canvas-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

async function quoteCanvasAction(sku) {
  const response = await quoteBillingAction({ sku, quantity: 1 });
  const quote = response?.quote;
  if (!quote?.quoteId) throw new Error('暂时无法确认本次处理费用，请重试');
  return { quoteId: quote.quoteId, actionId: canvasBillingActionId() };
}

export async function uploadECTempImages(base64Images, { signal } = {}) {
  const res = await fetch(`${API_BASE}/api/ec-temp-upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ images: base64Images.map((data, i) => ({ name: `img_${i}`, data })) }),
    signal,
  });
  if (!res.ok) throw new Error('图片上传失败');
  return (await res.json()).urls || [];
}

export async function reversePrompt({ image_url, product_name }) {
  const billing = await quoteCanvasAction('ec_reverse_prompt');
  const res = await fetch(`${API_BASE}/api/reverse-prompt`, {
    method: 'POST',
    headers: signedSessionHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(withSessionEmail({ image_url, product_name, billing_quote_id: billing.quoteId, billing_action_id: billing.actionId })),
  });
  if (!res.ok) throw await createApiError(res, '反推失败');
  return res.json();
}

export async function removeBg({ image_url }) {
  const billing = await quoteCanvasAction('ec_remove_bg');
  const res = await fetch(`${API_BASE}/api/remove-bg`, {
    method: 'POST',
    headers: signedSessionHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(withSessionEmail({ image_url, billing_quote_id: billing.quoteId, billing_action_id: billing.actionId })),
  });
  if (!res.ok) {
    throw await createApiError(res, '去除背景失败');
  }
  return res.json();
}

export function galleryImg(id, file) {
  return `${API_BASE}/api/gallery-image?id=${encodeURIComponent(id)}&file=${encodeURIComponent(file)}`;
}

function contentStreamError(event) {
  const error = new Error(event?.error || '生成失败');
  for (const key of ['code', 'resumeable', 'generationId', 'workId', 'billing']) {
    if (event?.[key] !== undefined) error[key] = event[key];
  }
  error.payload = event && typeof event === 'object' ? event : {};
  return error;
}

async function generateContentStream(path, payload, { onImage, onProgress, signal } = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 180000); // 3分钟超时
  // 合并外部 signal
  if (signal) signal.addEventListener('abort', () => controller.abort());

  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(withSessionEmail(payload)),
    signal: controller.signal,
  }).catch(e => { clearTimeout(timeoutId); throw new Error('网络请求失败: ' + e.message); });

  if (!res.ok) {
    clearTimeout(timeoutId);
    throw await createApiError(res, '生成失败');
  }

  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  let gotComplete = false;
  const result = { cover_url: '', image_urls: [] };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        try {
          const d = JSON.parse(line.slice(6));
          if (d.type === 'progress' && onProgress) onProgress(d);
          else if (d.type === 'image') {
            if (d.id === 'cover') result.cover_url = d.url;
            else if (d.url) result.image_urls.push(d.url);
            if (onImage) onImage(d);
          } else if (d.type === 'complete') {
            gotComplete = true;
            Object.assign(result, d);
            result.image_count = d.image_urls?.length || 0;
          } else if (d.type === 'error') {
            throw contentStreamError(d);
          }
        } catch (e) {
          if (e.message && !e.message.includes('JSON')) throw e;
        }
      }
    }
  } finally {
    clearTimeout(timeoutId);
    try { reader.releaseLock(); } catch {}
  }
  if (!gotComplete) throw new Error('生成未完成，请重试');
  return result;
}

export function generateContent(text, images, {
  preview = false,
  generationId,
  referenceAssetIds,
  ...options
} = {}) {
  return generateContentStream('/api/generate', {
    text,
    images: images || [],
    preview,
    ...(generationId ? { generationId } : {}),
    ...(Array.isArray(referenceAssetIds) && referenceAssetIds.length ? { referenceAssetIds } : {}),
  }, options);
}

export function generatePlogContent({
  text,
  refImage,
  style,
  layout,
  coverVariant,
  skipEnrich,
  preview = false,
  generationId,
  referenceAssetIds,
} = {}, options = {}) {
  return generateContentStream('/api/plog-generate', {
    text,
    style,
    layout,
    coverVariant,
    preview,
    ...(refImage ? { refImage } : {}),
    ...(skipEnrich ? { skipEnrich: true } : {}),
    ...(generationId ? { generationId } : {}),
    ...(Array.isArray(referenceAssetIds) && referenceAssetIds.length ? { referenceAssetIds } : {}),
  }, options);
}

export async function generateEcommerce({ productName, category, refImgs, realShots, platform, points, skus, detailPlan, maintenance, material, restrictions, imageSelections, imageSize, generationSettings, styleSkill, customColors, sizing, direction, billingQuoteId, email, draftId, resumeTaskId, retry = false, onImage, onProgress, pollIntervalMs = 1500, maxPollAttempts = 600, signal, isCurrent }) {
  const ownerEmail = getSessionEmail() || String(email || '').trim().toLowerCase();
  const savedReference = loadEcommerceTaskReference({ ownerEmail, draftId });
  if (savedReference && (!resumeTaskId || resumeTaskId === savedReference.taskId)) {
    let savedTask;
    try {
      if (typeof isCurrent === 'function' && !isCurrent()) return null;
      savedTask = await getEcommerceTask(savedReference.taskId, { signal });
    } catch (error) {
      if (typeof isCurrent === 'function' && !isCurrent()) return null;
      if (error?.status === 403 || error?.status === 404) {
        clearEcommerceTaskReference({ ownerEmail, draftId, taskId: savedReference.taskId });
        throw ecommerceTaskExpiredError(error.status);
      }
      throw error;
    }
    if (typeof isCurrent === 'function' && !isCurrent()) return null;
    const savedStatus = taskStatus(savedTask);
    if (savedStatus === 'failed' || savedStatus === 'cancelled') {
      if (typeof isCurrent === 'function' && !isCurrent()) return null;
      clearEcommerceTaskReference({ ownerEmail, draftId, taskId: savedReference.taskId });
      if (!retry) throw ecommerceRetryRequiredError(savedTask);
    } else {
      return pollEcommerceTask(savedReference.taskId, {
        initialTask: savedTask,
        onImage,
        onProgress,
        pollIntervalMs,
        maxPollAttempts,
        ownerEmail,
        draftId,
        signal,
        isCurrent,
      });
    }
  }

  const productInputs = splitEcommerceInputs(realShots);
  const referenceInputs = splitEcommerceInputs(refImgs);
  const body = {
    product_name: productName,
    category,
    platform,
    selling_points: points || '',
    skus: skus || [],
    detail_plan: detailPlan || null,
    maintenance: maintenance || '',
    material: material || '',
    restrictions: restrictions || '',
    direction: direction || null,
  };
  if (productInputs.owned.length || referenceInputs.owned.length) {
    body.assets = {
      product: productInputs.owned,
      reference: referenceInputs.owned,
    };
  }
  if (productInputs.legacy.length) {
    body.real_shots = await prepareImageInputs(productInputs.legacy);
    if (typeof isCurrent === 'function' && !isCurrent()) return null;
  }
  if (referenceInputs.legacy.length) {
    body.reference_images = await prepareImageInputs(referenceInputs.legacy);
    if (typeof isCurrent === 'function' && !isCurrent()) return null;
  }
  if (typeof isCurrent === 'function' && !isCurrent()) return null;
  // 电商生图是受控能力；请求携带会话信息，服务端仍会二次校验。
  if (email || ownerEmail) body.email = email || ownerEmail;
  if (imageSize?.width && imageSize?.height) {
    body.image_size = imageSize;
  }
  if (generationSettings) body.generation_settings = generationSettings;
  if (imageSelections?.length > 0) {
    body.image_selections = imageSelections;
  }
  // B5: 传递场景预设风格到后端
  if (styleSkill) body.style_skill = styleSkill;
  if (customColors) body.custom_colors = customColors;
  if (sizing || generationSettings?.resolution) {
    body.sizing = {
      ...(sizing || {}),
      resolution: generationSettings?.resolution || sizing?.resolution || '2K',
    };
  }
  if (typeof billingQuoteId === 'string' && billingQuoteId.trim()) {
    body.billing_quote_id = billingQuoteId.trim();
  }
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 1200000);
  const abortFromCaller = () => controller.abort();
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener('abort', abortFromCaller, { once: true });
  }
  const clearController = () => {
    clearTimeout(timeoutId);
    signal?.removeEventListener?.('abort', abortFromCaller);
  };

  const res = await fetch(`${API_BASE}/api/generate-ecommerce`, {
    method: 'POST',
    headers: signedSessionHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
    signal: controller.signal,
  }).catch(e => { clearController(); throw new Error('网络请求失败: ' + e.message); });

  if (!res.ok) {
    clearController();
    throw await createApiError(res, '生成失败');
  }

  if (res.status === 202) {
    try {
      const queued = await res.json();
      const taskId = queued.taskId || queued.task?.id;
      if (!taskId) throw new Error('生成任务创建失败，请重试');
      if (typeof isCurrent === 'function' && !isCurrent()) return null;
      saveEcommerceTaskReference({ ownerEmail, draftId, taskId });
      return pollEcommerceTask(taskId, {
        onImage,
        onProgress,
        pollIntervalMs,
        maxPollAttempts,
        ownerEmail,
        draftId,
        signal: controller.signal,
        isCurrent,
      });
    } finally {
      clearController();
    }
  }

  // SSE 流式解析（与 generateContent 一致）
  const result = { images: {}, imageRecords: [], errors: [], assets: [] };
  let gotComplete = false;

  try {
    await consumeSseJson(res.body.getReader(), d => {
      if (typeof isCurrent === 'function' && !isCurrent()) return;
      if (d.type === 'progress') {
        if (onProgress) onProgress(d);
      } else if (d.type === 'job') {
        result.taskId = d.taskId;
        saveEcommerceTaskReference({ ownerEmail, draftId, taskId: d.taskId });
      } else if (d.type === 'image') {
        const image = {
          ...d,
          stableUrl: d.stableUrl || d.url,
          state: d.state || d.status || '',
          taskId: d.taskId || result.taskId || '',
        };
        if (isEcommerceAssetDeliverable(image)) {
          result.images[image.id] = image.stableUrl;
          result.assets = [
            ...result.assets.filter(asset => (asset.id || asset.assetId) !== image.id),
            image,
          ];
        }
      } else if (d.type === 'complete') {
        gotComplete = true;
        Object.assign(result, d);
        result.status = d.status || 'completed';
        result.images = result.images || {};
      } else if (d.type === 'error') {
        const error = new Error(d.error || '生成失败');
        error.code = d.code;
        error.resumeable = d.resumeable;
        throw error;
      }
    });
  } finally {
    clearController();
  }
  if (typeof isCurrent === 'function' && !isCurrent()) return null;
  if (!gotComplete) throw new Error('生成未完成，请重试');
  const imageCount = Object.keys(result.images || {}).length;
  if (result.status === 'needs_review') {
    return repairIncompleteSuite(result, {
      taskId: result.taskId,
      onImage,
      onProgress,
      pollIntervalMs,
      maxPollAttempts,
      ownerEmail,
      draftId,
      signal,
      isCurrent,
      repairAttempt: 0,
    });
  }
  if (result.status === 'failed' || result.status === 'cancelled') {
    if (result.taskId) clearEcommerceTaskReference({ ownerEmail, draftId, taskId: result.taskId });
    throw ecommerceTaskError(result);
  }
  if (imageCount === 0) {
    const firstError = Array.isArray(result.errors) ? result.errors.find(item => item?.error)?.error : '';
    throw new Error(firstError || '生成完成但没有返回图片，请重试');
  }
  if (result.taskId && result.status === 'completed') {
    clearEcommerceTaskReference({ ownerEmail, draftId, taskId: result.taskId });
  }
  clearSuiteRepairCheckpoint({ ownerEmail, draftId });
  result.imageRecords = stableTaskImageRecords({
    output: { images: result.images },
    assets: result.assets || [],
  });
  const delivered = new Set();
  emitStableTaskImages({ output: { images: result.images }, assets: result.assets || [] }, delivered, onImage, result.taskId || '');
  return result;
}

export async function getEcommerceTask(taskId, { signal } = {}) {
  if (!taskId) throw new Error('缺少任务编号');
  const res = await fetch(`${API_BASE}/api/ecommerce/jobs/${encodeURIComponent(taskId)}`, {
    headers: signedSessionHeaders(),
    signal,
  });
  if (!res.ok) throw await createApiError(res, '读取任务失败');
  const data = await res.json();
  return data.task || data;
}

export async function listEcommerceTasks({ signal } = {}) {
  const res = await fetch(`${API_BASE}/api/ecommerce/jobs`, {
    headers: signedSessionHeaders(),
    signal,
  });
  if (!res.ok) throw await createApiError(res, '读取任务列表失败');
  const data = await res.json();
  return Array.isArray(data.tasks) ? data.tasks : [];
}

export async function quoteFailedEcommerceTask(taskId, { signal } = {}) {
  if (!taskId) throw new Error('缺少任务编号');
  const planResponse = await fetch(`${API_BASE}/api/ecommerce/jobs/${encodeURIComponent(taskId)}/retry-plan`, {
    method: 'POST',
    headers: signedSessionHeaders(),
    signal,
  });
  if (!planResponse.ok) throw await createApiError(planResponse, '读取整套重试费用失败');
  const planBody = await planResponse.json();
  const plan = planBody?.plan || planBody;
  const sku = typeof plan?.sku === 'string' ? plan.sku.trim() : '';
  const quantity = Number(plan?.quantity);
  if (!sku || !Number.isSafeInteger(quantity) || quantity <= 0) {
    throw new Error('整套重试的费用信息无效，请刷新后重试');
  }
  const billing = await quoteBillingAction({ sku, quantity });
  const quote = billing?.quote;
  if (!quote?.quoteId || !Number.isSafeInteger(quote.totalUnits) || quote.totalUnits < 0) {
    throw new Error('暂时无法确认本次重新生成费用，请重试');
  }
  return { ...plan, quote };
}

export async function retryFailedEcommerceTask(taskId, { billingQuoteId, signal } = {}) {
  if (!taskId) throw new Error('缺少任务编号');
  if (!billingQuoteId) throw new Error('缺少重新生成费用确认');
  const res = await fetch(`${API_BASE}/api/ecommerce/jobs/${encodeURIComponent(taskId)}/retry-failed`, {
    method: 'POST',
    headers: signedSessionHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ billingQuoteId }),
    signal,
  });
  if (!res.ok) throw await createApiError(res, '重新生成整套失败');
  return res.json();
}

/* ── 电商智能识别（Vision 回填 5 步字段） ── */
export async function autoRecognizeEcommerce({ smartBrief, refShots }) {
  const res = await fetch(`${API_BASE}/api/ecommerce/auto-recognize`, {
    method: 'POST',
    headers: signedSessionHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(withSessionEmail({ smartBrief: smartBrief || '', refShots: refShots || [] })),
  });
  if (!res.ok) throw await createApiError(res, '智能识别失败');
  return res.json();
}

export async function getDesignDirections(params, { signal } = {}) {
  // 先上传图片到服务器，再用 URL 请求
  const uploadAndReplace = async (imgs) => {
    if (!imgs?.length) return [];
    return prepareImageInputs(imgs, { signal });
  };

  const real_shots = await uploadAndReplace(params.real_shots);
  const ref_shots = await uploadAndReplace(params.ref_shots);

  const res = await fetch(`${API_BASE}/api/ecommerce/design-directions`, {
    method: 'POST',
    headers: signedSessionHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(withSessionEmail({
      ...params,
      real_shots,
      ref_shots,
      billing_quote_id: params.billingQuoteId,
      billing_action_id: params.billingActionId,
    })),
    signal,
  });
  if (!res.ok) throw await createApiError(res, '设计方向生成失败');
  return res.json();
}

/* ── EC 文案 AI 润色 ── */
export async function polishECText({ text, product_name, category }) {
  const res = await fetch(`${API_BASE}/api/polish-ec-text`, {
    method: 'POST',
    headers: signedSessionHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(withSessionEmail({ text, product_name, category })),
  });
  if (!res.ok) throw await createApiError(res, '润色失败');
  return res.json();
}

/* ── 详情切片拼长图（微信分享用） ── */
export async function stitchLongImage(imageUrls) {
  const res = await fetch(`${API_BASE}/api/ecommerce/stitch-long`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageUrls }),
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => res.statusText);
    throw new Error(msg.slice(0, 200));
  }
  return res.json();
}

/* ── 电商大纲预览（重构版） ── */
export async function generateEcommercePreview({ productName, category, points, refCount, hasMaterial, imageSelections, skus, detailPlan, maintenance }) {
  const res = await fetch(`${API_BASE}/api/ecommerce-preview`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      product_name: productName,
      category,
      selling_points: points,
      ref_count: refCount || 0,
      has_material: !!hasMaterial,
      image_selections: imageSelections || null,
      skus: skus || [],
      detail_plan: detailPlan || null,
      maintenance: maintenance || '',
    }),
  });
  if (!res.ok) throw new Error('预览请求失败');
  return res.json();
}
export async function extractProductLink(url) {
  const res = await fetch(`${API_BASE}/api/extract-product-link`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(withSessionEmail({ url })),
  });
  if (!res.ok) throw await createApiError(res, '链接分析失败');
  return res.json();
}

export async function getExtractData(token) {
  const res = await fetch(`${API_BASE}/api/bookmarklet-data?token=${encodeURIComponent(token)}`);
  if (!res.ok) return { ok: false };
  return res.json();
}

/* ── 单图重生成 ── */
export async function regenerateImage(prompt, category) {
  const res = await fetch(`${API_BASE}/api/regenerate-image`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(withSessionEmail({ prompt, category: category || '' })),
  });
  if (!res.ok) throw await createApiError(res, '图片重生成失败');
  const d = await res.json();
  if (!d.url) throw new Error('生成失败');
  return d.url;
}

/* ── 文案重生成 ── */
export async function regenerateText(text, category) {
  const res = await fetch(`${API_BASE}/api/regenerate-text`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(withSessionEmail({ text, category })),
  });
  if (!res.ok) throw await createApiError(res, '文案重生成失败');
  return res.json();
}

export async function saveWork(work, phone, { signal } = {}) {
  if (signal?.aborted) return null;
  const ownerEmail = String(phone || getSessionEmail() || '').trim().toLowerCase();
  const localWork = ownerEmail ? { ...work, _phone: ownerEmail } : work;
  // 本地先存
  try {
    if (ownerEmail) {
      const local = JSON.parse(localStorage.getItem('sb-works') || '[]');
      const ownerWorks = filterWorksForOwner(local, ownerEmail);
      const saveKey = localWork._saveKey;
      if (saveKey != null) {
        const idx = ownerWorks.findIndex(x => String(x._saveKey) === String(saveKey));
        if (idx >= 0) ownerWorks[idx] = { ...ownerWorks[idx], ...localWork };
        else ownerWorks.unshift({ ...localWork, id: Date.now(), at: new Date().toLocaleDateString('zh-CN') });
      } else {
        ownerWorks.unshift({ ...localWork, id: Date.now(), at: new Date().toLocaleDateString('zh-CN') });
      }
      localStorage.setItem('sb-works', JSON.stringify(
        replaceCachedWorksForOwner(local, ownerEmail, ownerWorks),
      ));
    }
  } catch (e) { /* ignore */ }

  // 服务器存
  try {
    if (signal?.aborted) return null;
    const response = await fetch(`${API_BASE}/api/save-work`, {
      method: 'POST',
      headers: signedSessionHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ work: localWork }),
      signal,
    });
    if (response.ok) {
      const saved = await response.json().catch(() => ({}));
      if (saved._saveKey && !work._saveKey) {
        try {
          const next = JSON.parse(localStorage.getItem('sb-works') || '[]');
          const item = next.find(x => x.title === localWork.title
            && String(x._phone || '').trim().toLowerCase() === ownerEmail
            && !x._saveKey);
          if (item) item._saveKey = saved._saveKey;
          localStorage.setItem('sb-works', JSON.stringify(next));
        } catch { /* ignore local cache repair */ }
      }
      return saved;
    }
  } catch (e) {
    console.warn('saveWork:', e.message);
  }
  return null;
}

export async function regenerateCanvasImage({ prompt, imageUrl, referenceImages = [], ratio }) {
  const billing = await quoteCanvasAction('ec_image_2k');
  const res = await fetch(`${API_BASE}/api/canvas/regenerate`, {
    method: 'POST', headers: signedSessionHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ prompt, image_url: imageUrl, reference_images: referenceImages, ratio, billing_quote_id: billing.quoteId, billing_action_id: billing.actionId }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw await createApiError(new Response(JSON.stringify(data), { status: res.status }), '重新生成失败');
  if (!data.url) throw new Error(data.error || '重新生成失败');
  return data.url;
}

export async function transformCanvasImage({
  action,
  imageUrl,
  prompt = '',
  ratio = '1:1',
  targetLanguage = '中文',
  resolution = '2K',
  annotation = '',
}) {
  const paid = new Set(['retouch', 'extend', 'translate', 'upscale', 'inpaint']);
  const billingSku = String(resolution).toUpperCase() === '4K' ? 'ec_image_4k' : 'ec_image_2k';
  const billing = paid.has(action) ? await quoteCanvasAction(billingSku) : null;
  const res = await fetch(`${API_BASE}/api/canvas/transform`, {
    method: 'POST',
    headers: signedSessionHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      action,
      image_url: imageUrl,
      prompt,
      ratio,
      target_language: targetLanguage,
      resolution,
      annotation,
      ...(billing ? { billing_quote_id: billing.quoteId, billing_action_id: billing.actionId } : {}),
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw await createApiError(new Response(JSON.stringify(data), { status: res.status }), '画布处理失败');
  return data;
}

export async function analyzeCanvasLayers(imageUrl) {
  const res = await fetch(`${API_BASE}/api/canvas/analyze-layers`, {
    method: 'POST',
    headers: signedSessionHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ image_url: imageUrl }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw await createApiError(new Response(JSON.stringify(data), { status: res.status }), '图层分析失败');
  return data;
}

async function requestTextComposition(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: signedSessionHeaders(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw await createApiError(new Response(JSON.stringify(data), { status: res.status }), '文字合成失败');
  return data;
}

export function createTextComposition({ projectId, versionId, width, height, colorSpace = 'srgb', backgroundAssetId = null, layers }) {
  return requestTextComposition('/api/compositions', {
    method: 'POST',
    body: { projectId, versionId, width, height, colorSpace, backgroundAssetId, layers },
  });
}

export async function listTextCompositions({ projectId, versionId }) {
  const query = new URLSearchParams({ projectId, versionId });
  const data = await requestTextComposition(`/api/compositions?${query.toString()}`);
  return Array.isArray(data.documents) ? data.documents : [];
}

export function loadTextComposition(documentId) {
  return requestTextComposition(`/api/compositions/${encodeURIComponent(documentId)}`);
}

export function saveTextCompositionRevision({ documentId, expectedRevision, layers, backgroundAssetId }) {
  return requestTextComposition(`/api/compositions/${encodeURIComponent(documentId)}/revisions`, {
    method: 'POST',
    body: {
      expectedRevision,
      layers,
      ...(backgroundAssetId === undefined ? {} : { backgroundAssetId }),
    },
  });
}

export async function createCanvasPixelLayers({ documentId, expectedRevision, document }) {
  const billing = await quoteCanvasAction('ec_layer_psd');
  return requestTextComposition('/api/canvas/pixel-layers', {
    method: 'POST',
    body: {
      documentId,
      expectedRevision,
      billing_quote_id: billing.quoteId,
      billing_action_id: billing.actionId,
      ...(document === undefined ? {} : { document }),
    },
  });
}

function filenameFromContentDisposition(value = '', fallback = 'canvas-layers.psd') {
  const match = String(value).match(/filename\*?=(?:UTF-8''|")?([^";]+)/i);
  if (!match) return fallback;
  try {
    return decodeURIComponent(match[1].replace(/^"|"$/g, '')) || fallback;
  } catch {
    return fallback;
  }
}

export async function exportCanvasPsd({ documentId }) {
  const res = await fetch(`${API_BASE}/api/canvas/psd-export`, {
    method: 'POST',
    headers: signedSessionHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ documentId }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw await createApiError(new Response(JSON.stringify(data), { status: res.status }), 'PSD 导出失败');
  }
  return {
    buffer: await res.arrayBuffer(),
    contentType: res.headers.get('content-type') || 'image/vnd.adobe.photoshop',
    filename: filenameFromContentDisposition(res.headers.get('content-disposition') || ''),
  };
}

export async function deleteWork(saveKey) {
  if (!saveKey) return false;
  try {
    const res = await fetch(`${API_BASE}/api/delete-work`, {
      method: 'POST',
      headers: signedSessionHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ _saveKey: saveKey }),
    });
    if (res.ok) return true;
  } catch (e) {
    console.warn('deleteWork:', e.message);
  }
  return false;
}

export async function restoreWork(saveKey) {
  if (!saveKey) return false;
  try {
    const res = await fetch(`${API_BASE}/api/restore-work`, {
      method: 'POST',
      headers: signedSessionHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ _saveKey: saveKey }),
    });
    return res.ok;
  } catch (e) {
    console.warn('restoreWork:', e.message);
    return false;
  }
}

export async function loadTrash() {
  try {
    const res = await fetch(`${API_BASE}/api/trash`, { headers: signedSessionHeaders() });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (e) {
    console.warn('loadTrash:', e.message);
    return [];
  }
}

export async function loadWorks(ownerEmail = getSessionEmail()) {
  const owner = String(ownerEmail || '').trim().toLowerCase();
  try {
    const res = await fetch(`${API_BASE}/api/works`, { headers: signedSessionHeaders() });
    if (res.ok) {
      const serverWorks = await res.json();
      let cached = [];
      let local = [];
      try {
        cached = JSON.parse(localStorage.getItem('sb-works') || '[]');
        local = filterWorksForOwner(cached, owner);
      } catch (e) { /* ignore */ }
      // Do not resurrect stale browser snapshots over a durable task record.
      // Local data only fills a genuinely unsynced work or supports offline use.
      const data = mergeWorkCollections(serverWorks, local).slice(0, 50);
      localStorage.setItem('sb-works', JSON.stringify(
        replaceCachedWorksForOwner(cached, owner, data),
      ));
      data.sort((a, b) => (b.id || 0) - (a.id || 0));
      return data;
    }
  } catch (e) {
    console.warn('loadWorks:', e.message);
  }
  try {
    return mergeWorkCollections([], filterWorksForOwner(
      JSON.parse(localStorage.getItem('sb-works') || '[]'),
      owner,
    ));
  } catch { return []; }
}

/* ── ZIP 下载 ── */
export async function downloadZip(coverUrl, imageUrls, title, bodyText, hashtags) {
  if (!coverUrl && !imageUrls?.length) throw new Error('暂无图片可下载');
  try {
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    const all = [coverUrl, ...(imageUrls || [])].filter(Boolean);
    let ok = 0;

    if (bodyText || title) {
      zip.file('00-文章内容.txt', `${title || ''}\n\n${bodyText || ''}\n\n${(hashtags || []).join(' ')}`);
    }

    const results = await Promise.all(
      all.map(async (url, i) => {
        try {
          const resp = await fetch(`${API_BASE}/api/proxy-image?url=${encodeURIComponent(url)}`);
          if (!resp.ok) return null;
          const blob = await resp.blob();
          return { name: i === 0 ? '01-封面' : `0${i + 1}`, blob };
        } catch { return null; }
      })
    );

    results.forEach(r => { if (r) { zip.file(`${r.name}.png`, r.blob); ok++; } });
    if (!ok) throw new Error('图片暂时无法下载，可能已过期');

    const content = await zip.generateAsync({ type: 'blob' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(content);
    link.download = `${(title || '薯包AI').slice(0, 20).replace(/[\\/:*?"<>|]/g, '')}.zip`;
    link.click();
    URL.revokeObjectURL(link.href);
  } catch (error) { throw new Error(error?.message || '下载失败，请重试'); }
}

/* ── 一键出图 ── */
export async function autoGenerate({ platform, input, refImages, email, draftId, resumeTaskId, retry, onProgress, onImage, signal, isCurrent }) {
  const prompt = String(input || '').trim();
  return generateEcommerce({
    productName: prompt.slice(0, 80) || '商品',
    category: '其他',
    points: prompt,
    refImgs: refImages || [],
    realShots: [],
    platform: platform || '淘宝',
    email,
    draftId,
    resumeTaskId,
    retry,
    onProgress,
    onImage,
    signal,
    isCurrent,
  });
}



/* ── EC 文案 AI 润色 ── */
