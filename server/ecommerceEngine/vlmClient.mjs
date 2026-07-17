/**
 * 薯包AI v4 VLM API 客户端
 *
 * ⚠️ 预留接口位：VLM_API_KEY 和 VLM_BASE_URL 需要在 .env 中配置
 * 当前使用空壳实现，网络恢复后填入真实 API 即可启用
 *
 * 对接方式（填入下方标记位）：
 *   1. 在 server/.env 添加：
 *      VLM_API_KEY=xxx
 *      VLM_BASE_URL=https://api.xxx.com/v1
 *      VLM_MODEL=xxx-vision
 *   2. 重启服务 → 自动启用
 *   3. 零代码改动
 */

import { buildVlmPrompt, parseRealShot, parseStyleRef, aggregateAnalyses } from './vlmSchema.mjs';

// ============================================================
// ★★★★★ 接入点：替换为真实 VLM API ★★★★★
// ============================================================
const VLM_CONFIG = {
  apiKey: process.env.VLM_API_KEY || '',      // ← 填入 API Key
  baseUrl: process.env.VLM_BASE_URL || '',     // ← 填入 API URL
  model: process.env.VLM_MODEL || '',           // ← 填入模型名
  enabled: false,                               // ← true 后启用
};
// ============================================================

/**
 * 调用 VLM 分析图片
 * 当前为 mock 实现在无 API 时返回模拟数据
 *
 * @param {string[]} imageUrls - 图片 URL 列表
 * @param {'real_shot'|'style_ref'} type - 分析类型
 * @returns {Promise<Object>} VLM 原始输出
 */
export async function analyzeImages(imageUrls, type = 'real_shot') {
  if (!imageUrls || imageUrls.length === 0) return null;

  if (VLM_CONFIG.enabled && VLM_CONFIG.apiKey) {
    // ★★★ 真实 VLM API 调用 ★★★
    return await callVlmApi(imageUrls, type);
  }

  // ★★★ Mock 实现（API 不可用时返回模拟数据）★★★
  return mockVlmAnalysis(imageUrls, type);
}

/**
 * 真实 VLM API 调用 (预留实现)
 */
async function callVlmApi(imageUrls, type) {
  const { systemPrompt, userPrompt } = buildVlmPrompt(type, imageUrls);

  const response = await fetch(`${VLM_CONFIG.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${VLM_CONFIG.apiKey}`,
    },
    body: JSON.stringify({
      model: VLM_CONFIG.model,
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: [
            { type: 'text', text: userPrompt },
            ...imageUrls.map(url => ({
              type: 'image_url',
              image_url: { url, detail: 'high' },
            })),
          ],
        },
      ],
      temperature: 0.1,
      max_tokens: 2048,
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
    console.warn('[VLM] Failed to parse VLM response as JSON, returning null');
    return null;
  }
}

/**
 * 执行完整的 VLM 分析流程：
 *   1. 分析实拍图 → RealShotAnalysis
 *   2. 分析风格图 → StyleRefAnalysis
 *   3. 聚合结果
 *
 * @param {string[]} realShots - 实拍图 URL 列表
 * @param {string[]} styleRefs - 风格参考图 URL 列表
 * @returns {Promise<{realShot: Object, styleRef: Object, mode: string}>}
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
