/**
 * 薯包AI v4 VLM API 客户端
 *
 * 使用 MINI_* 环境变量配置的 Vision 模型 (gpt-5.4-mini / api.65535.space)
 * 在 server/.env 中设置：
 *   MINI_API_KEY=xxx
 *   MINI_BASE_URL=https://api.65535.space
 *   MINI_MODEL=gpt-5.4-mini
 *
 * 无 API 时自动降级为 Mock 数据输出，不影响业务流程。
 */

import { buildVlmPrompt, parseRealShot, parseStyleRef, aggregateAnalyses } from './vlmSchema.mjs';

// ============================================================
// 从环境变量读取 Vision API 配置
// ============================================================
const VLM_CONFIG = {
  apiKey: process.env.MINI_API_KEY || '',
  baseUrl: (process.env.MINI_BASE_URL || '').replace(/\/+$/, ''),
  model: process.env.MINI_MODEL || 'gpt-5.4-mini',
  enabled: !!(process.env.MINI_API_KEY && process.env.MINI_BASE_URL),
};
// ============================================================

/**
 * 调用 Vision 模型分析图片
 * 降级链：真实 API → Mock
 *
 * @param {string[]} imageUrls - 图片 URL 列表
 * @param {'real_shot'|'style_ref'} type - 分析类型
 * @returns {Promise<Object>} VLM 原始输出
 */
export async function analyzeImages(imageUrls, type = 'real_shot') {
  if (!imageUrls || imageUrls.length === 0) return null;

  if (VLM_CONFIG.enabled && VLM_CONFIG.apiKey) {
    return await callVlmApi(imageUrls, type);
  }

  // 无 Vision API 时降级 Mock
  return mockVlmAnalysis(imageUrls, type);
}

/**
 * 调用 Vision API (兼容 OpenAI 格式)
 */
async function callVlmApi(imageUrls, type) {
  const { systemPrompt, userPrompt } = buildVlmPrompt(type, imageUrls);

  const messages = [
    { role: 'system', content: systemPrompt },
    {
      role: 'user',
      content: [
        { type: 'text', text: userPrompt },
        ...imageUrls.slice(0, 5).map(url => ({
          type: 'image_url',
          image_url: { url, detail: 'high' },
        })),
      ],
    },
  ];

  const response = await fetch(`${VLM_CONFIG.baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${VLM_CONFIG.apiKey}`,
    },
    body: JSON.stringify({
      model: VLM_CONFIG.model,
      messages,
      max_tokens: 2048,
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    throw new Error(`VLM API ${response.status}: ${await response.text().catch(() => '')}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';
  try {
    return JSON.parse(content.replace(/```(json)?/g, '').trim());
  } catch {
    console.warn('[VLM] Vision 返回非 JSON，返回原始文本');
    return null;
  }
}

/**
 * 执行完整 VLM 分析流程
 */
export async function runFullAnalysis(realShots = [], styleRefs = []) {
  const hasReal = realShots.length > 0;
  const hasStyle = styleRefs.length > 0;
  const mode = hasReal && hasStyle ? 'dual' : hasReal ? 'real_only' : hasStyle ? 'style_only' : 'none';

  let realShot = null;
  let styleRef = null;

  if (hasReal) {
    const rawResults = await Promise.all(
      realShots.slice(0, 5).map(url => analyzeImages([url], 'real_shot'))
    );
    realShot = aggregateAnalyses(rawResults.filter(Boolean), 'real_shot');
  }

  if (hasStyle) {
    const rawResults = await Promise.all(
      styleRefs.slice(0, 5).map(url => analyzeImages([url], 'style_ref'))
    );
    styleRef = aggregateAnalyses(rawResults.filter(Boolean), 'style_ref');
  }

  return { realShot, styleRef, mode };
}

// ============================================================
// Mock 实现
// ============================================================

function mockVlmAnalysis(imageUrls, type) {
  if (type === 'real_shot') {
    return {
      product: {
        shape: imageUrls.length > 0 ? 'standard product shape' : '',
        dominantColors: ['#F5F0EB', '#C4A882'],
        materials: ['premium quality material'],
        texture: 'smooth refined finish',
        anglesPresent: ['front'],
        bestAngle: '3/4 elevated',
        keyFeatures: ['main product body', 'brand marking'],
        printText: [],
        dimensionsHint: 'standard size',
      },
      quality: {
        resolution: 'high',
        focus: 'sharp',
        noise: 'clean',
        suitability: 0.85,
      },
      preservation: {
        shape: true,
        colorAccuracy: true,
        textureFidelity: true,
        details: ['overall product shape and design'],
      },
    };
  }

  return {
    visualTreatment: {
      lighting: {
        type: 'professional studio',
        direction: 'above-left 45°',
        temperature: 'neutral ~5500K',
        shadowHardness: 'soft',
        contrast: 'medium',
      },
      colorPalette: {
        dominant: ['#FFFFFF', '#F5F0EB'],
        accent: ['#333333'],
        temperature: 'neutral',
        saturation: 'natural',
      },
      composition: {
        style: 'centered product',
        productPlacement: 'center',
        depth: 'medium',
        backgroundType: 'solid',
      },
      mood: 'professional clean',
      backgroundDetail: 'Clean solid background with soft gradient',
    },
    transferWeights: {
      lighting: 0.7,
      color: 0.6,
      composition: 0.5,
      mood: 0.6,
    },
  };
}

export { VLM_CONFIG };
