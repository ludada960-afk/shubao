// ─────────────────────────────────────────────────────────────
// API 服务层：标准化重构版
// ─────────────────────────────────────────────────────────────

const API_BASE = ''; // 使用相对路径，由 Vite Proxy 转发

export const API = API_BASE;

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
  onProgress,
  onImage
}) {
  // 1. 图片预处理：区分上传
  const uploadImgs = async (imgs) => {
    if (!imgs?.length) return [];
    const urls = imgs.filter(u => typeof u === 'string' && (u.startsWith('http') || u.startsWith('/api/')));
    const base64s = imgs.filter(u => typeof u === 'string' && u.startsWith('data:'));
    if (base64s.length === 0) return urls;
    const uploaded = await uploadECTempImages(base64s);
    return [...urls, ...uploaded];
  };

  const productUrls = await uploadImgs(productImages);
  const refUrls = await uploadImgs(referenceImages);

  // 2. 构建严格请求体
  const body = {
    product_images: productUrls,
    reference_images: refUrls,
    scene_style: sceneStyle || 'default',
    platform: platform || 'taobao',
    plan: batchPlan || { main: 1, scene: 3, sku: 3, detail: 3 }
  };

  const res = await fetch(`${API_BASE}/api/generate-ecommerce-v2`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const msg = await res.text().catch(() => res.statusText);
    throw new Error(msg.slice(0, 200));
  }

  // 3. SSE 流式解析
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  const result = { images: [] };

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
          const normalizedImage = {
            id: d.id || Date.now().toString(),
            url: d.url,
            category: d.category || 'main',
            name: d.name || '生成图片',
            width: d.width || 1024,
            height: d.height || 1024
          };
          result.images.push(normalizedImage);
          if (onImage) onImage(normalizedImage);
        }
        else if (d.type === 'complete') Object.assign(result, d);
        else if (d.type === 'error') throw new Error(d.error || '生成失败');
      } catch (e) {
        console.warn('Parse error', e);
      }
    }
  }
  return result;
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
    body: JSON.stringify({ image_url, product_name }),
  });
  if (!res.ok) throw new Error('反推失败');
  return res.json();
}

export async function removeBg({ image_url }) {
  const res = await fetch(`${API_BASE}/api/remove-bg`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image_url }),
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
    body: JSON.stringify({ text, images: images || [], preview }),
    signal: controller.signal,
  }).catch(e => { clearTimeout(timeoutId); throw new Error('网络请求失败: ' + e.message); });

  if (!res.ok) {
    clearTimeout(timeoutId);
    const raw = await res.text().catch(() => res.statusText);
    let message = raw;
    try { message = JSON.parse(raw).error || raw; } catch {}
    throw new Error(String(message).slice(0, 200));
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
            throw new Error(d.error || '生成失败');
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

export async function generateEcommerce({ productName, category, refImgs, realShots, platform, points, skus, detailPlan, maintenance, material, restrictions, imageSelections, imageSize, generationSettings, styleSkill, customColors, sizing, onImage, onProgress }) {
  // 上传图片到服务器
  const uploadImgs = async (imgs) => {
    if (!imgs?.length) return [];
    const urls = imgs.filter(u => typeof u === 'string' && (u.startsWith('http') || u.startsWith('/api/')));
    const base64s = imgs.filter(u => typeof u === 'string' && u.startsWith('data:'));
    if (base64s.length === 0) return urls;
    const uploaded = await uploadECTempImages(base64s);
    return [...urls, ...uploaded];
  };

  const body = {
    product_name: productName,
    category,
    reference_images: await uploadImgs(refImgs),
    real_shots: await uploadImgs(realShots),
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
    if (session?.email) body.email = session.email;
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
    const msg = await res.text().catch(() => res.statusText);
    throw new Error(msg.slice(0, 200));
  }

  // SSE 流式解析（与 generateContent 一致）
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  const result = { images: {}, errors: [] };

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
          if (d.type === 'progress') {
            if (onProgress) onProgress(d);
          } else if (d.type === 'job') {
            result.taskId = d.taskId;
            try { localStorage.setItem('sb-last-ecommerce-task', d.taskId); } catch {}
          } else if (d.type === 'image') {
            if (d.id && d.url) result.images[d.id] = d.url;
            if (onImage) onImage(d);
          } else if (d.type === 'complete') {
            Object.assign(result, d);
            result.images = result.images || {};
          } else if (d.type === 'error') {
            throw new Error(d.error || '生成失败');
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
  return result;
}

export async function getEcommerceTask(taskId) {
  if (!taskId) throw new Error('缺少任务编号');
  let email = '';
  try { email = JSON.parse(localStorage.getItem('sb-auth') || 'null')?.email || ''; } catch {}
  const res = await fetch(`${API_BASE}/api/ecommerce/jobs/${encodeURIComponent(taskId)}?email=${encodeURIComponent(email)}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || '读取任务失败');
  return data.task;
}

/* ── 电商智能识别（Vision 回填 5 步字段） ── */
export async function autoRecognizeEcommerce({ smartBrief, refShots }) {
  const res = await fetch(`${API_BASE}/api/ecommerce/auto-recognize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ smartBrief: smartBrief || '', refShots: refShots || [] }),
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => res.statusText);
    throw new Error(msg.slice(0, 200));
  }
  return res.json();
}

export async function getDesignDirections(params) {
  // 先上传图片到服务器，再用 URL 请求
  const uploadAndReplace = async (imgs) => {
    if (!imgs?.length) return [];
    // 已经是 URL 的直接返回
    const urls = imgs.filter(u => u.startsWith('http') || u.startsWith('/api/'));
    const base64s = imgs.filter(u => u.startsWith('data:'));
    if (base64s.length === 0) return urls;
    // 上传 base64 到服务器
    const uploaded = await uploadECTempImages(base64s);
    return [...urls, ...uploaded];
  };

  const real_shots = await uploadAndReplace(params.real_shots);
  const ref_shots = await uploadAndReplace(params.ref_shots);

  const res = await fetch(`${API_BASE}/api/ecommerce/design-directions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...params, real_shots, ref_shots }),
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => res.statusText);
    throw new Error(msg.slice(0, 200));
  }
  return res.json();
}

/* ── EC 文案 AI 润色 ── */
export async function polishECText({ text, product_name, category }) {
  const res = await fetch(`${API_BASE}/api/polish-ec-text`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, product_name, category }),
  });
  if (!res.ok) throw new Error('润色失败');
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
    body: JSON.stringify({ url }),
  });
  if (!res.ok) throw new Error('链接分析失败');
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
    body: JSON.stringify({ prompt, category: category || '' }),
  });
  if (!res.ok) throw new Error('请求失败');
  const d = await res.json();
  if (!d.url) throw new Error('生成失败');
  return d.url;
}

/* ── 文案重生成 ── */
export async function regenerateText(text, category) {
  const res = await fetch(`${API_BASE}/api/regenerate-text`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, category }),
  });
  if (!res.ok) throw new Error('文案重生成失败');
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

export async function regenerateCanvasImage({ prompt, imageUrl, ratio }) {
  let email = '';
  try { email = JSON.parse(localStorage.getItem('sb-auth') || 'null')?.email || ''; } catch {}
  const res = await fetch(`${API_BASE}/api/canvas/regenerate`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, image_url: imageUrl, ratio, email }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.url) throw new Error(data.error || '重新生成失败');
  return data.url;
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
        data = data.map(sv => localMap.get(String(sv._saveKey)) || sv);
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

/* ── 免费试用状态（基于手机号）── */
export async function getTrialStatus(phone) {
  if (!phone) return { freeRemaining: 0 };
  try {
    const res = await fetch(`${API_BASE}/api/trial/status?phone=${encodeURIComponent(phone)}`);
    if (res.ok) return res.json();
  } catch (e) { /* ignore */ }
  return { freeRemaining: 0 };
}

export async function registerTrial(phone) {
  try {
    const res = await fetch(`${API_BASE}/api/trial/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone }),
    });
    if (res.ok) return res.json();
  } catch (e) { /* ignore */ }
  return { freeRemaining: 0, isNew: false };
}

export async function consumeTrial(phone) {
  try {
    const res = await fetch(`${API_BASE}/api/trial/consume`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone }),
    });
    return res.ok;
  } catch (e) { return false; }
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
export async function autoGenerate({ platform, input, refImages }) {
  const res = await fetch(`${API_BASE}/api/auto-generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ platform, input, refImages: refImages || [] }),
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => res.statusText);
    throw new Error(msg.slice(0, 200));
  }
  return res.json();
}



/* ── EC 文案 AI 润色 ── */
