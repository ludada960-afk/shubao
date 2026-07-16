const API_BASE = '';

export const API = API_BASE;

export function proxyImg(url) {
  return url ? `${API_BASE}/api/proxy-image?url=${encodeURIComponent(url)}` : '';
}

export function galleryImg(id, file) {
  return `${API_BASE}/api/gallery-image?id=${id}&file=${file}&t=${Date.now()}`;
}

/* ── 小红书图文生成 (SSE 流式) ── */
export async function generateContent(text, images, { onImage, onProgress, preview = false }) {
  const res = await fetch(`${API_BASE}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, images: images || [], preview }),
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => res.statusText);
    throw new Error(msg.slice(0, 200));
  }

  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  let gotComplete = false;
  const result = { cover_url: '', image_urls: [] };

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
  if (!gotComplete) throw new Error('生成未完成，请重试');
  return result;
}

/* ── 电商图生成（精修工坊重构版） ── */
export async function generateEcommerce({ productName, category, refImgs, realShots, platform, points, skus, detailPlan, maintenance, material, restrictions, imageSelections, imageSize, onImage, onProgress }) {
  const body = {
    product_name: productName,
    category,
    reference_images: refImgs || [],
    real_shots: realShots || [],
    platform,
    selling_points: points || '',
    skus: skus || [],
    detail_plan: detailPlan || null,
    maintenance: maintenance || '',
    material: material || '',
    restrictions: restrictions || '',
  };
  if (imageSize?.width && imageSize?.height) {
    body.image_size = imageSize;
  }
  if (imageSelections?.length > 0) {
    body.image_selections = imageSelections;
  }
  const res = await fetch(`${API_BASE}/api/generate-ecommerce`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => res.statusText);
    throw new Error(msg.slice(0, 200));
  }

  // SSE 流式解析（与 generateContent 一致）
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  const result = { images: {}, errors: [] };

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
  return result;
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

/* ── 作品存取 ── */
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
    await fetch(`${API_BASE}/api/save-work`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ work, phone: phone || '' }),
    });
  } catch (e) {
    console.warn('saveWork:', e.message);
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

