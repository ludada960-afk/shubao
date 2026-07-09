/**
 * 薯包AI 插件后端 - API 路由
 *
 * 处理扩展发起的采集→下载→分析→生成全链路
 * 挂载到 /api/extension/ 下
 */

import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { createTask, getTask, updateTask, TASK_STATUS } from './extensionTaskManager.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DOWNLOADS_DIR = path.resolve(__dirname, 'extension_downloads');
if (!fs.existsSync(DOWNLOADS_DIR)) fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });

const router = Router();

/* ════════════════════════════════════════
 * 接口1：接收插件上传的采集数据
 * ════════════════════════════════════════ */
router.post('/collect', (req, res) => {
  try {
    const { images, title, platform, pageUrl, ratios } = req.body || {};

    if (!images || !Array.isArray(images) || images.length === 0) {
      return res.status(400).json({ ok: false, error: '缺少图片数据' });
    }

    // 创建任务
    const taskId = createTask({ images, title, platform, pageUrl, ratios });
    console.log(`[ext] 新任务 ${taskId}：${images.length} 张图片，来自 ${platform || '未知平台'}`);

    // 异步：开始下载图片
    downloadImages(taskId).catch(err => {
      console.error(`[ext] 下载失败 ${taskId}:`, err.message);
      updateTask(taskId, { status: TASK_STATUS.FAILED, error: err.message });
    });

    res.json({ ok: true, taskId, imageCount: images.length });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/* ════════════════════════════════════════
 * 接口2：查询任务进度
 * ════════════════════════════════════════ */
router.get('/task/:id', (req, res) => {
  const task = getTask(req.params.id);
  if (!task) return res.status(404).json({ ok: false, error: '任务不存在' });

  // 返回客户端所需信息（去掉敏感/内部字段）
  res.json({
    ok: true,
    taskId: task.taskId,
    status: task.status,
    progress: task.progress,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    platform: task.platform,
    title: task.title,
    imageCount: task.images.length,
    analysis: task.analysis,
    userProduct: task.userProduct,
    generatedImages: task.generatedImages,
    error: task.error,
  });
});

/* ════════════════════════════════════════
 * 接口3：手动触发 AI 分析（或查询分析结果）
 * ════════════════════════════════════════ */
router.post('/analyze', async (req, res) => {
  try {
    const { taskId } = req.body || {};
    if (!taskId) return res.status(400).json({ ok: false, error: '缺少 taskId' });

    const task = getTask(taskId);
    if (!task) return res.status(404).json({ ok: false, error: '任务不存在' });

    // 如果已经分析过了，直接返回结果
    if (task.analysis) {
      return res.json({ ok: true, analysis: task.analysis });
    }

    // 如果图片还没下载完，返回等待状态
    if (task.status !== TASK_STATUS.DOWNLOADED && task.status !== TASK_STATUS.ANALYZING) {
      return res.json({ ok: true, status: task.status, message: '图片尚未就绪，等待下载完成' });
    }

    // 开始分析（异步执行）
    updateTask(taskId, { status: TASK_STATUS.ANALYZING, progress: 30 });
    runAnalysis(taskId).catch(err => {
      console.error(`[ext] 分析失败 ${taskId}:`, err.message);
      updateTask(taskId, { status: TASK_STATUS.FAILED, error: err.message });
    });

    res.json({ ok: true, status: TASK_STATUS.ANALYZING, message: '分析已启动' });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/* ════════════════════════════════════════
 * 接口4：用户提交替换信息 → 重新生成
 * ════════════════════════════════════════ */
router.post('/regenerate', async (req, res) => {
  try {
    const { taskId, productName, category, sellingPoints, tier, platform } = req.body || {};
    if (!taskId || !productName) {
      return res.status(400).json({ ok: false, error: '缺少 taskId 或 productName' });
    }

    const task = getTask(taskId);
    if (!task) return res.status(404).json({ ok: false, error: '任务不存在' });

    // 保存用户替换信息
    updateTask(taskId, {
      status: TASK_STATUS.GENERATING,
      progress: 50,
      userProduct: { productName, category: category || '', sellingPoints: sellingPoints || [], tier: tier || 'basic', platform: platform || '' },
    });

    // 启动生成（异步）
    runGeneration(taskId).catch(err => {
      console.error(`[ext] 生成失败 ${taskId}:`, err.message);
      updateTask(taskId, { status: TASK_STATUS.FAILED, error: err.message });
    });

    res.json({ ok: true, taskId, message: '生成已启动' });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/* ──────── 下载图片（异步） ──────── */
async function downloadImages(taskId) {
  const task = getTask(taskId);
  if (!task || !task.images.length) return;

  updateTask(taskId, { status: TASK_STATUS.DOWNLOADING, progress: 5 });
  const downloaded = [];
  const errors = [];

  for (let i = 0; i < task.images.length; i++) {
    const url = task.images[i];
    try {
      const result = await downloadSingleImage(url, task.pageUrl, taskId, i);
      if (result) downloaded.push(result);
      else errors.push({ url, error: '下载返回空' });
    } catch (err) {
      errors.push({ url, error: err.message });
    }
    // 更新进度
    const progress = 5 + Math.round(((i + 1) / task.images.length) * 20);
    updateTask(taskId, { progress, downloadedImages: downloaded, downloadErrors: errors });
  }

  const finalStatus = downloaded.length > 0 ? TASK_STATUS.DOWNLOADED : TASK_STATUS.FAILED;
  updateTask(taskId, {
    status: finalStatus,
    progress: finalStatus === TASK_STATUS.DOWNLOADED ? 25 : 0,
    downloadedImages: downloaded,
    downloadErrors: errors,
    error: finalStatus === TASK_STATUS.FAILED ? '所有图片下载失败' : null,
  });

  console.log(`[ext] ${taskId}：成功下载 ${downloaded.length}/${task.images.length} 张图片`);
}

/* ──────── 单张图片下载（带 Referer） ──────── */
function downloadSingleImage(url, referer, taskId, index) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const ext = path.extname(urlObj.pathname).split('?')[0].toLowerCase() || '.jpg';
    const filename = `${taskId}_${String(index).padStart(3, '0')}${ext}`;
    const filePath = path.join(DOWNLOADS_DIR, filename);

    const client = url.startsWith('https') ? https : http;

    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Referer': referer || urlObj.origin,
        'Sec-Fetch-Dest': 'image',
        'Sec-Fetch-Mode': 'no-cors',
      },
    };

    const req = client.get(options, (res) => {
      // 处理重定向
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const redirectUrl = new URL(res.headers.location, url).href;
        return downloadSingleImage(redirectUrl, referer, taskId, index)
          .then(resolve)
          .catch(reject);
      }

      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} for ${url.slice(0, 80)}`));
      }

      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        if (buffer.length < 100) {
          return reject(new Error(`图片太小 (${buffer.length} bytes)：可能是防盗链拦截`));
        }
        fs.writeFileSync(filePath, buffer);
        resolve({ url, localPath: filePath, size: buffer.length, index });
      });
      res.on('error', reject);
    });

    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('下载超时')); });
  });
}

/* ──────── AI 视觉分析（核心逻辑） ──────── */
async function runAnalysis(taskId) {
  const task = getTask(taskId);
  if (!task || !task.downloadedImages?.length) {
    throw new Error('没有已下载的图片可供分析');
  }

  const analysisResults = [];
  const env = loadEnv();

  for (const img of task.downloadedImages) {
    try {
      const result = await analyzeSingleImage(img, env, task.title);
      analysisResults.push(result);
    } catch (err) {
      console.warn(`[ext] 分析图片 ${img.index} 失败:`, err.message);
      analysisResults.push({
        index: img.index,
        url: img.url,
        error: err.message,
        // 提供兜底值，让流程能继续
        subject: task.title || '商品',
        layout: '居中展示',
        lighting: '产品摄影灯光',
        background: '纯色背景',
        colors: ['#FFFFFF'],
        text: '',
      });
    }

    const progress = 30 + Math.round(((analysisResults.length) / task.downloadedImages.length) * 20);
    updateTask(taskId, {
      progress,
      analysis: { images: analysisResults, fullTitle: task.title },
    });
  }

  updateTask(taskId, {
    status: TASK_STATUS.ANALYZED,
    progress: 50,
    analysis: { images: analysisResults, fullTitle: task.title },
  });

  console.log(`[ext] ${taskId}：AI 分析完成，${analysisResults.length} 张图片`);
}

/* ──────── 单张图片 Vision 分析 ──────── */
async function analyzeSingleImage(imgInfo, env, productTitle) {
  // 调用 Vision API 分析图片
  const imageUrl = imgInfo.url; // 用原始 URL，不用本地路径

  const systemPrompt = `你是一位电商视觉分析师。你的任务是对商品图片进行逆向分析，输出图片的视觉构成参数。
请分析这张商品图片，输出以下 JSON 格式（不要 markdown，纯 JSON）：

{
  "subject": "商品主体描述（什么商品、什么材质、什么颜色）",
  "layout": "构图布局（居中/左置/右置/对角线/上下分层/留白比例）",
  "lighting": "光照风格（产品光/场景光/氛围光/自然光）",
  "background": "背景/场景描述（纯白底/生活场景/渐变/纹理）",
  "colors": ["主色调1", "主色调2", "主色调3"],
  "text": "图片上的文字/角标内容（无文字则空字符串）",
  "composition": "构图细节（产品位置、角度、透视关系）",
  "mood": "画面情绪/风格（专业/温暖/科技/自然/高端）"
}`;

  // 尝试调用 LLM Vision API
  // 支持 Claude (Anthropic) 或 OpenAI-compatible endpoint
  const model = env.LLM_MODEL || 'claude-sonnet-4-6';
  const apiKey = env.LLM_API_KEY || process.env.ANTHROPIC_API_KEY || '';
  const apiBase = (env.LLM_BASE_URL || '').replace(/\/+$/, '');

  if (!apiKey) {
    // 如果没有 API Key，返回兜底分析结果
    return {
      index: imgInfo.index,
      url: imgInfo.url,
      subject: productTitle || '商品',
      layout: '居中展示，留白充分',
      lighting: '柔和的商业产品光',
      background: '纯色背景',
      colors: ['#F5F5F5', '#333333', '#FFFFFF'],
      text: '',
      composition: '商品居中，3/4视角',
      mood: '专业电商',
    };
  }

  // 构建请求体：先尝试 OpenAI-compatible (含 image_url)
  try {
    // Anthropic Claude API (兼容模式)
    if (apiBase.includes('anthropic') || model.startsWith('claude') || !apiBase) {
      // 用 Anthropic 的 Messages API
      const anthropicKey = process.env.ANTHROPIC_API_KEY || apiKey;
      const body = JSON.stringify({
        model: model.replace('claude-', 'claude-'),
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: systemPrompt },
            { type: 'image', source: { type: 'url', url: imageUrl } }
          ]
        }]
      });

      const response = await fetch(
        apiBase ? `${apiBase}/v1/messages` : 'https://api.anthropic.com/v1/messages',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': anthropicKey,
            'anthropic-version': '2023-06-01',
          },
          body,
        }
      );

      if (!response.ok) {
        throw new Error(`Vision API ${response.status}`);
      }

      const data = await response.json();
      const text = data.content?.[0]?.text || '';
      // 尝试解析 JSON
      try {
        // 从 markdown 代码块提取
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) return { index: imgInfo.index, url: imgInfo.url, ...JSON.parse(jsonMatch[0]) };
      } catch { /* use fallback */ }
    } else {
      // OpenAI-compatible endpoint (含 GPT-4o Vision)
      const body = JSON.stringify({
        model: model,
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: systemPrompt },
            { type: 'image_url', image_url: { url: imageUrl, detail: 'high' } }
          ]
        }]
      });

      const response = await fetch(`${apiBase}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body,
      });

      if (!response.ok) throw new Error(`Vision API ${response.status}`);

      const data = await response.json();
      const text = data.choices?.[0]?.message?.content || '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) return { index: imgInfo.index, url: imgInfo.url, ...JSON.parse(jsonMatch[0]) };
    }
  } catch (err) {
    console.warn(`[ext] Vision API call failed:`, err.message);
  }

  // 兜底
  return {
    index: imgInfo.index,
    url: imgInfo.url,
    subject: productTitle || '商品',
    layout: '居中展示，留白充分',
    lighting: '柔和的商业产品光',
    background: '纯色背景',
    colors: ['#F5F5F5', '#333333', '#FFFFFF'],
    text: '',
    composition: '商品居中',
    mood: '专业电商',
  };
}

/* ──────── AI 重新生成 ──────── */
async function runGeneration(taskId) {
  const task = getTask(taskId);
  if (!task) throw new Error('任务不存在');

  const env = loadEnv();
  const { userProduct, analysis } = task;
  if (!userProduct || !analysis) throw new Error('缺少用户产品信息或分析结果');

  const productName = userProduct.productName;
  const category = userProduct.category || '其他';
  const sellingPoints = userProduct.sellingPoints || [];
  const tier = userProduct.tier || 'basic';
  const targetPlatform = userProduct.platform || '淘宝';

  const generated = [];

  for (let i = 0; i < analysis.images.length; i++) {
    const ref = analysis.images[i];
    const sp = sellingPoints[i % Math.max(1, sellingPoints.length)] || '';

    // 构建保持原图构图的 prompt
    const prompt = buildRemakePrompt({
      productName,
      category,
      sellingPoint: sp,
      reference: ref,
      platform: targetPlatform,
      tier,
    });

    try {
      // 调用 GPT Image 2 生成
      const imageUrl = await callImageGeneration(prompt, env);
      generated.push({
        index: i,
        role: `remake_${i}`,
        style: ref.background?.includes('白底') ? '白底主图' : '场景图',
        url: imageUrl,
        group: i === 0 ? '主图' : '详情图',
        referenceIndex: i,
      });
    } catch (err) {
      console.warn(`[ext] 生成图 ${i} 失败:`, err.message);
      generated.push({
        index: i,
        role: `remake_${i}`,
        style: ref.background?.includes('白底') ? '白底主图' : '场景图',
        url: '',
        error: err.message,
        group: i === 0 ? '主图' : '详情图',
      });
    }

    const progress = 50 + Math.round(((i + 1) / analysis.images.length) * 45);
    updateTask(taskId, { progress, generatedImages: generated });
  }

  updateTask(taskId, {
    status: TASK_STATUS.COMPLETED,
    progress: 100,
    generatedImages: generated,
  });

  console.log(`[ext] ${taskId}：生成完成，共 ${generated.length} 张`);
}

/* ──────── 构建「复刻」prompt ──────── */
function buildRemakePrompt({ productName, category, sellingPoint, reference, platform, tier }) {
  const sizeMap = {
    '1:1': '800×800px',
    '3:4': '750×1000px',
    '9:16': '720×1280px',
  };
  const targetRatio = reference.ratio || '1:1';
  const targetSize = sizeMap[targetRatio] || '800×800px';

  let prompt = `Generate a professional e-commerce product image.

PRODUCT: ${productName}
CATEGORY: ${category}
${sellingPoint ? `SELLING POINT: ${sellingPoint}` : ''}

COMPOSITION REFERENCE:
- Layout: ${reference.layout || 'Centered composition with balanced whitespace'}
- Lighting: ${reference.lighting || 'Professional studio soft key light'}
- Background: ${reference.background || 'Clean solid light background'}
- Color palette: ${(reference.colors || ['white']).join(', ')}
- Mood: ${reference.mood || 'Professional e-commerce'}
${reference.text ? `- Text overlay might be acceptable on non-main images` : '- No text overlay on the primary image'}
- Aspect ratio: ${targetRatio}, output size: ${targetSize}

REQUIREMENTS:
1. Keep the SAME layout composition and whitespace distribution
2. Match the SAME lighting style and direction
3. Use the SAME background approach (solid / scene / gradient)
4. Replace the product with ${productName} — make it the focal point
5. Maintain the professional e-commerce photography quality
6. NO text on primary/main images
7. High resolution, sharp focus, realistic product texture`;

  return prompt;
}

/* ──────── 图片生成调用 ──────── */
async function callImageGeneration(prompt, env) {
  const apiKey = env.IMAGE_API_KEY || '';
  const apiBase = (env.IMAGE_BASE_URL || '').replace(/\/+$/, '');
  const model = env.IMAGE_MODEL || 'gpt-image-2';

  if (!apiKey) throw new Error('IMAGE_API_KEY 未配置');

  const body = JSON.stringify({
    model,
    prompt,
    n: 1,
    size: '1024x1024',
    quality: 'standard',
    response_format: 'url',
  });

  const response = await fetch(`${apiBase}/v1/images/generations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Image API ${response.status}: ${text.slice(0, 200)}`);
  }

  const data = await response.json();
  return data.data?.[0]?.url || '';
}

/* ──────── 加载环境变量 ──────── */
function loadEnv() {
  return {
    LLM_API_KEY: process.env.LLM_API_KEY || '',
    LLM_BASE_URL: process.env.LLM_BASE_URL || '',
    LLM_MODEL: process.env.LLM_MODEL || 'claude-sonnet-4-6',
    IMAGE_API_KEY: process.env.IMAGE_API_KEY || '',
    IMAGE_BASE_URL: process.env.IMAGE_BASE_URL || '',
    IMAGE_MODEL: process.env.IMAGE_MODEL || 'gpt-image-2',
  };
}

export default router;

/* 备用：直接挂载到 app 上（如果 Router 方式有兼容问题） */

export function mountOnApp(app) {
  // Express 4: 直接用 app.post/get 注册路由
  app.post('/api/extension/collect', (req, res) => {
    try {
      const { images, title, platform, pageUrl, ratios } = req.body || {};
      if (!images || !Array.isArray(images) || images.length === 0) {
        return res.status(400).json({ ok: false, error: '缺少图片数据' });
      }
      const taskId = createTask({ images, title, platform, pageUrl, ratios });
      downloadImages(taskId).catch(err => {
        console.error(`[ext] 下载失败 ${taskId}:`, err.message);
        updateTask(taskId, { status: TASK_STATUS.FAILED, error: err.message });
      });
      res.json({ ok: true, taskId, imageCount: images.length });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.get('/api/extension/task/:id', (req, res) => {
    const task = getTask(req.params.id);
    if (!task) return res.status(404).json({ ok: false, error: '任务不存在' });
    res.json({
      ok: true, taskId: task.taskId, status: task.status, progress: task.progress,
      createdAt: task.createdAt, updatedAt: task.updatedAt, platform: task.platform,
      title: task.title, imageCount: task.images.length,
      analysis: task.analysis, userProduct: task.userProduct,
      generatedImages: task.generatedImages, error: task.error,
    });
  });

  app.post('/api/extension/analyze', async (req, res) => {
    try {
      const { taskId } = req.body || {};
      if (!taskId) return res.status(400).json({ ok: false, error: '缺少 taskId' });
      const task = getTask(taskId);
      if (!task) return res.status(404).json({ ok: false, error: '任务不存在' });
      if (task.analysis) return res.json({ ok: true, analysis: task.analysis });
      if (task.status !== TASK_STATUS.DOWNLOADED && task.status !== TASK_STATUS.ANALYZING) {
        return res.json({ ok: true, status: task.status, message: '图片尚未就绪' });
      }
      updateTask(taskId, { status: TASK_STATUS.ANALYZING, progress: 30 });
      runAnalysis(taskId).catch(err => {
        console.error(`[ext] 分析失败 ${taskId}:`, err.message);
        updateTask(taskId, { status: TASK_STATUS.FAILED, error: err.message });
      });
      res.json({ ok: true, status: TASK_STATUS.ANALYZING, message: '分析已启动' });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.post('/api/extension/regenerate', async (req, res) => {
    try {
      const { taskId, productName, category, sellingPoints, tier, platform } = req.body || {};
      if (!taskId || !productName) return res.status(400).json({ ok: false, error: '缺少 taskId 或 productName' });
      const task = getTask(taskId);
      if (!task) return res.status(404).json({ ok: false, error: '任务不存在' });
      updateTask(taskId, {
        status: TASK_STATUS.GENERATING, progress: 50,
        userProduct: { productName, category: category || '', sellingPoints: sellingPoints || [], tier: tier || 'basic', platform: platform || '' },
      });
      runGeneration(taskId).catch(err => {
        console.error(`[ext] 生成失败 ${taskId}:`, err.message);
        updateTask(taskId, { status: TASK_STATUS.FAILED, error: err.message });
      });
      res.json({ ok: true, taskId, message: '生成已启动' });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  console.log('[ext] Direct-mount routes registered on app');
}
