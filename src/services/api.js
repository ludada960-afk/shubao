// ─────────────────────────────────────────────────────────────
// API 服务层：标准化重构版
// ─────────────────────────────────────────────────────────────

import { createApiError } from './apiError.js';
import { consumeSseJson } from './sse.js';

const API_BASE = ''; // 使用相对路径，由 Vite Proxy 转发

export const API = API_BASE;

export function getSessionEmail() {
  try { return JSON.parse(localStorage.getItem('sb-auth') || 'null')?.email || ''; } catch { return ''; }
}

export function withSessionEmail(payload = {}) {
  return { ...payload, email: payload.email || getSessionEmail() };
}

// 图片代理（解决跨域）
export function proxyImg(url) {
  if (!url) return '';
  if (typeof url === 'object') {
    return proxyImg(url.url || url.src || url.image_url || url.cover_url || '');
  }
  const sameOrigin = url.match(/^https?:\/\/(?:www\.)?shuimg\.cn(\/.*)$/i);
  if (sameOrigin) return sameOrigin[1];
  // 已经是代理地址或 data URI 则直接返回
  if (url.startsWith('/api/') || url.startsWith('data:') || url.startsWith('blob:')) return url;
  // 本地相对路径也直接返回
  if (url.startsWith('/')) return url;
  // 处理 http/https 图片 URL
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return `${API_BASE}/api/proxy-image?url=${encodeURIComponent(url)}`;
  }
  // 其他情况直接返回原 URL
  return url;
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

async function prepareImageInputs(images) {
  if (!images?.length) return [];
  const values = (await Promise.all(images.map(imageToDataUrl))).filter(Boolean);
  const urls = values.filter(value => /^(?:https?:\/\/|\/api\/)/i.test(value));
  const base64s = values.filter(value => value.startsWith('data:image/'));
  if (!base64s.length) return urls;
  return [...urls, ...(await uploadECTempImages(base64s))];
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
  onProgress,
  onImage
}) {
  return generateEcommerce({
    productName: sceneStyle || '商品',
    category: '其他',
    refImgs: referenceImages || [],
    realShots: productImages || [],
    platform: platform || '淘宝',
    imageSelections: planToSelections(batchPlan),
    email,
    onProgress,
    onImage,
  });
}

// ─────────────────────────────────────────────────────────────
// 基础工具接口 (保留原有逻辑)
// ─────────────────────────────────────────────────────────────

export async function uploadECTempImages(base64Images) {
  const res = await fetch(`${API_BASE}/api/ec-temp-upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ images: base64Images.map((data, i) => ({ name: `img_${i}`, data })) }),
  });
  if (!res.ok) throw new Error('图片上传失败');
  return (await res.json()).urls || [];
}

export async function reversePrompt({ image_url, product_name }) {
  const res = await fetch(`${API_BASE}/api/reverse-prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(withSessionEmail({ image_url, product_name })),
  });
  if (!res.ok) throw await createApiError(res, '反推失败');
  return res.json();
}

export async function removeBg({ image_url }) {
  const res = await fetch(`${API_BASE}/api/remove-bg`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(withSessionEmail({ image_url })),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || '去除背景失败');
  }
  return res.json();
}

export function galleryImg(id, file) {
  return `${API_BASE}/api/gallery-image?id=${id}&file=${encodeURIComponent(file)}&t=${Date.now()}`;
}

export async function generateContent(text, images, { onImage, onProgress, preview = false, signal } = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 180000); // 3分钟超时
  // 合并外部 signal
  if (signal) signal.addEventListener('abort', () => controller.abort());

  const res = await fetch(`${API_BASE}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(withSessionEmail({ text, images: images || [], preview })),
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
            const error = new Error(d.error || '生成失败');
            error.code = d.code;
            error.resumeable = d.resumeable;
            throw error;
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

export async function generateEcommerce({ productName, category, refImgs, realShots, platform, points, skus, detailPlan, maintenance, material, restrictions, imageSelections, imageSize, generationSettings, styleSkill, customColors, sizing, email, onImage, onProgress }) {
  const body = {
    product_name: productName,
    category,
    reference_images: await prepareImageInputs(refImgs),
    real_shots: await prepareImageInputs(realShots),
    platform,
    selling_points: points || '',
    skus: skus || [],
    detail_plan: detailPlan || null,
    maintenance: maintenance || '',
    material: material || '',
    restrictions: restrictions || '',
  };
  // 电商生图属于封闭内测能力；请求携带本地会话邮箱，服务端仍会二次校验。
  try {
    const session = JSON.parse(localStorage.getItem('sb-auth') || 'null');
    if (email || session?.email) body.email = email || session.email;
  } catch {}
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
  if (sizing) body.sizing = sizing;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 300000); // 5分钟超时（电商生图更慢）

  const res = await fetch(`${API_BASE}/api/generate-ecommerce`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: controller.signal,
  }).catch(e => { clearTimeout(timeoutId); throw new Error('网络请求失败: ' + e.message); });

  if (!res.ok) {
    clearTimeout(timeoutId);
    throw await createApiError(res, '生成失败');
  }

  // SSE 流式解析（与 generateContent 一致）
  const result = { images: {}, errors: [] };
  let gotComplete = false;

  try {
    await consumeSseJson(res.body.getReader(), d => {
      if (d.type === 'progress') {
        if (onProgress) onProgress(d);
      } else if (d.type === 'job') {
        result.taskId = d.taskId;
        try { localStorage.setItem('sb-last-ecommerce-task', d.taskId); } catch {}
      } else if (d.type === 'image') {
        if (d.id && d.url) result.images[d.id] = d.url;
        if (onImage) onImage(d);
      } else if (d.type === 'complete') {
        gotComplete = true;
        Object.assign(result, d);
        result.images = result.images || {};
      } else if (d.type === 'error') {
        const error = new Error(d.error || '生成失败');
        error.code = d.code;
        error.resumeable = d.resumeable;
        throw error;
      }
    });
  } finally {
    clearTimeout(timeoutId);
  }
  if (!gotComplete) throw new Error('生成未完成，请重试');
  const imageCount = Object.keys(result.images || {}).length;
  if (imageCount === 0) {
    const firstError = Array.isArray(result.errors) ? result.errors.find(item => item?.error)?.error : '';
    throw new Error(firstError || '生成完成但没有返回图片，请重试');
  }
  return result;
}

export async function getEcommerceTask(taskId) {
  if (!taskId) throw new Error('缺少任务编号');
  let email = '';
  try { email = JSON.parse(localStorage.getItem('sb-auth') || 'null')?.email || ''; } catch {}
  const res = await fetch(`${API_BASE}/api/ecommerce/jobs/${encodeURIComponent(taskId)}?email=${encodeURIComponent(email)}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || '读取任务失败');
  return data.task || data;
}

/* ── 电商智能识别（Vision 回填 5 步字段） ── */
export async function autoRecognizeEcommerce({ smartBrief, refShots }) {
  const res = await fetch(`${API_BASE}/api/ecommerce/auto-recognize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(withSessionEmail({ smartBrief: smartBrief || '', refShots: refShots || [] })),
  });
  if (!res.ok) throw await createApiError(res, '智能识别失败');
  return res.json();
}

export async function getDesignDirections(params) {
  // 先上传图片到服务器，再用 URL 请求
  const uploadAndReplace = async (imgs) => {
    if (!imgs?.length) return [];
    return prepareImageInputs(imgs);
  };

  const real_shots = await uploadAndReplace(params.real_shots);
  const ref_shots = await uploadAndReplace(params.ref_shots);

  const res = await fetch(`${API_BASE}/api/ecommerce/design-directions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(withSessionEmail({ ...params, real_shots, ref_shots })),
  });
  if (!res.ok) throw await createApiError(res, '设计方向生成失败');
  return res.json();
}

/* ── EC 文案 AI 润色 ── */
export async function polishECText({ text, product_name, category }) {
  const res = await fetch(`${API_BASE}/api/polish-ec-text`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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

export async function saveWork(work, phone) {
  // 本地先存
  try {
    const local = JSON.parse(localStorage.getItem('sb-works') || '[]');
    const saveKey = work._saveKey;
    if (saveKey != null) {
      const idx = local.findIndex(x => String(x._saveKey) === String(saveKey));
      if (idx >= 0) local[idx] = { ...local[idx], ...work };
      else local.unshift({ ...work, id: Date.now(), at: new Date().toLocaleDateString('zh-CN') });
    } else {
      local.unshift({ ...work, id: Date.now(), at: new Date().toLocaleDateString('zh-CN') });
    }
    localStorage.setItem('sb-works', JSON.stringify(local.slice(0, 50)));
  } catch (e) { /* ignore */ }

  // 服务器存
  try {
    const response = await fetch(`${API_BASE}/api/save-work`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ work, phone: phone || '' }),
    });
    if (response.ok) {
      const saved = await response.json().catch(() => ({}));
      if (saved._saveKey && !work._saveKey) {
        try {
          const next = JSON.parse(localStorage.getItem('sb-works') || '[]');
          const item = next.find(x => x.title === work.title && !x._saveKey);
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
  const email = getSessionEmail();
  const res = await fetch(`${API_BASE}/api/canvas/regenerate`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, image_url: imageUrl, reference_images: referenceImages, ratio, email }),
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
  const res = await fetch(`${API_BASE}/api/canvas/transform`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action,
      image_url: imageUrl,
      prompt,
      ratio,
      target_language: targetLanguage,
      resolution,
      annotation,
      email: getSessionEmail(),
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw await createApiError(new Response(JSON.stringify(data), { status: res.status }), '画布处理失败');
  return data;
}

export async function analyzeCanvasLayers(imageUrl) {
  const res = await fetch(`${API_BASE}/api/canvas/analyze-layers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image_url: imageUrl, email: getSessionEmail() }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw await createApiError(new Response(JSON.stringify(data), { status: res.status }), '图层分析失败');
  return data;
}

export async function deleteWork(saveKey) {
  if (!saveKey) return false;
  try {
    const res = await fetch(`${API_BASE}/api/delete-work`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ _saveKey: saveKey }),
    });
    return res.ok;
  } catch (e) {
    console.warn('restoreWork:', e.message);
    return false;
  }
}

export async function loadTrash(phone) {
  try {
    const url = phone ? `${API_BASE}/api/trash?phone=${encodeURIComponent(phone)}` : `${API_BASE}/api/trash`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (e) {
    console.warn('loadTrash:', e.message);
    return [];
  }
}

export async function loadWorks(phone) {
  try {
    const url = phone ? `${API_BASE}/api/works?phone=${encodeURIComponent(phone)}` : `${API_BASE}/api/works`;
    const res = await fetch(url);
    if (res.ok) {
      let data = await res.json();
      try {
        const local = JSON.parse(localStorage.getItem('sb-works') || '[]');
        const localMap = new Map();
        local.forEach(x => { if (x._saveKey != null) localMap.set(String(x._saveKey), x); });
        // 服务端是稳定来源；本地只补充尚未同步的字段，避免旧缓存覆盖最新的稳定图片 URL。
        data = data.map(sv => ({ ...(localMap.get(String(sv._saveKey)) || {}), ...sv }));
        const seenKeys = new Set(data.map(x => String(x._saveKey)));
        const missing = local.filter(x =>
          x._saveKey != null && !seenKeys.has(String(x._saveKey)) && (x.title || x.product_name) && !(x.title || '').includes('�')
        );
        if (missing.length > 0) data = [...missing, ...data].slice(0, 50);
      } catch (e) { /* ignore */ }
      localStorage.setItem('sb-works', JSON.stringify(data));
      data.sort((a, b) => (b.id || 0) - (a.id || 0));
      return data;
    }
  } catch (e) {
    console.warn('loadWorks:', e.message);
  }
  try { return JSON.parse(localStorage.getItem('sb-works') || '[]'); } catch { return []; }
}

/* ── ZIP 下载 ── */
export async function downloadZip(coverUrl, imageUrls, title, bodyText, hashtags) {
  if (!coverUrl && !imageUrls?.length) { alert('暂无图片可下载'); return; }
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
    if (!ok) { alert('下载失败，图片可能已过期'); return; }

    const content = await zip.generateAsync({ type: 'blob' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(content);
    link.download = `${(title || '薯包AI').slice(0, 20).replace(/[\\/:*?"<>|]/g, '')}.zip`;
    link.click();
    URL.revokeObjectURL(link.href);
  } catch { alert('下载失败，请重试'); }
}

/* ── 一键出图 ── */
export async function autoGenerate({ platform, input, refImages, email }) {
  const prompt = String(input || '').trim();
  return generateEcommerce({
    productName: prompt.slice(0, 80) || '商品',
    category: '其他',
    points: prompt,
    refImgs: refImages || [],
    realShots: [],
    platform: platform || '淘宝',
    email,
  });
}



/* ── EC 文案 AI 润色 ── */
