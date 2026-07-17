/**
 * 薯包AI v4 五阶段流水线编排器
 *
 * 流程：
 *   Stage 1: 预处理 (VLM 分析 + LLM 决策)
 *   Stage 2: 视觉规划 (Skill + 双图融合 + 图片列表)
 *   Stage 3: 分层 Prompt 构建
 *   Stage 4: 生成 + 质检 (并发 + 自动重试)
 *   Stage 5: 后处理 (去底 / 拼接 / 打包)
 *
 * 双模式：
 *   mode='agent'   → Agent 自动决策所有参数
 *   mode='workshop' → Workshop 使用用户传入的手动参数
 */

import { runFullAnalysis } from './vlmClient.mjs';
import { assemblePrompt } from './promptAssembler.mjs';
import { batchCheck } from './qualityCheck.mjs';
import { decide } from './agentDecider.mjs';
import { getInputMode } from './vlmSchema.mjs';

// ============================================================
// 主流水线入口
// ============================================================

/**
 * 执行完整电商生图流水线
 *
 * @param {Object} input
 * @param {string} input.productName
 * @param {string} [input.category]
 * @param {string[]} [input.realShots=[]]        - 实拍图 URL
 * @param {string[]} [input.styleRefs=[]]         - 风格参考图 URL
 * @param {string[]} [input.sellingPoints=[]]
 * @param {string} [input.platform='淘宝']
 * @param {string} [input.mode='agent']           - 'agent' | 'workshop'
 * @param {Object} [input.workshopParams]          - Workshop 模式参数
 * @param {string} [input.workshopParams.styleSkill]
 * @param {number} [input.workshopParams.productFidelity]
 * @param {number} [input.workshopParams.styleTransfer]
 * @param {number} [input.workshopParams.creativity]
 * @param {string[]} [input.workshopParams.imageSelections]
 * @param {Object} [input.workshopParams.qualityConfig]
 * @param {Function} [onProgress]                 - 进度回调 (stage, msg)
 * @returns {Promise<{images: Object, report: Object, pipeline: string}>}
 */
export async function runPipeline(input, onProgress = () => {}) {
  const {
    productName, category,
    realShots = [], styleRefs = [],
    sellingPoints = [],
    platform = '淘宝',
    mode = 'agent',
    workshopParams = {},
  } = input;

  onProgress('pre_processing', '正在分析输入信息...');

  // ============================================================
  // Stage 1: 预处理
  // ============================================================
  onProgress('vlm_analysis', '正在分析参考图...');
  const { realShot, styleRef, mode: inputMode } = await runFullAnalysis(realShots, styleRefs);

  onProgress('planning', '正在规划生成策略...');

  // Agent 模式自动决策 / Workshop 模式使用用户参数
  const decision = mode === 'agent'
    ? decide(productName, realShots, styleRefs, { forcedCategory: category })
    : {
        styleSkill: workshopParams.styleSkill || 'premium_minimal',
        category: category || '其他',
        realShots,
        styleRefs,
        productFidelity: workshopParams.productFidelity ?? 0.85,
        styleTransfer: workshopParams.styleTransfer ?? 0.65,
        creativity: workshopParams.creativity ?? 0.3,
        qualityConfig: workshopParams.qualityConfig || { enabled: true, autoRegen: true },
        postProcess: workshopParams.postProcess ?? 1,
      };

  // ============================================================
  // Stage 2: 视觉规划
  // ============================================================
  const expandedImages = buildImageList(decision, productName);
  onProgress('planning', `已规划 ${expandedImages.length} 张图片`);

  // ============================================================
  // Stage 3: 分层 Prompt 构建
  // ============================================================
  onProgress('assembling', '正在构建生成参数...');
  const prompts = expandedImages.map((img, idx) => {
    const prompt = assemblePrompt({
      productName,
      category: decision.category,
      roleKey: img.baseKey || img.key,
      sellingPoints,
      platform,
      variant: img.variant,
      sliceNote: img.sliceNote,
      styleSkill: decision.styleSkill,
      realShot,
      styleRef,
      productFidelity: decision.productFidelity,
      styleTransfer: decision.styleTransfer,
    });
    return { ...img, prompt };
  });

  // ============================================================
  // Stage 4: 生成 + 质检
  // ============================================================
  onProgress('generating', '正在生成商品图 (0%)...');
  const images = {};
  const errors = [];
  const qualityResults = [];

  const CONCURRENCY = 5;
  let completed = 0;
  const total = prompts.length;

  // genOne 函数 — 生成单张图 (含质检重试)
  const genOne = async (item, idx) => {
    for (let attempt = 0; attempt <= 3; attempt++) {
      try {
        const url = await callImageGen(item.prompt, decision.category);
        if (url) {
          images[item.label || item.key] = url;

          // 质检
          onProgress('quality_check', `质检第 ${idx + 1}/${total} 张...`);
          const qc = await checkQuality({
            imageUrl: url,
            roleKey: item.key,
            retryCount: attempt,
          });
          qualityResults.push(qc);

          if (qc.passed) {
            completed++;
            onProgress('generating', `正在生成商品图 (${Math.round(completed / total * 100)}%)...`);
            return;
          }
          if (!qc.shouldRetry) {
            completed++;
            onProgress('generating', `正在生成商品图 (${Math.round(completed / total * 100)}%)...`);
            return;
          }
          // 需要重试：更新 prompt
          item.prompt += `\n[REGEN NOTE: ${qc.nextParams?.note || 'Focus on product detail'}]`;
        } else {
          errors.push({ label: item.label, error: '生成空结果' });
          completed++;
          return;
        }
      } catch (err) {
        if (attempt === 3) {
          errors.push({ label: item.label, error: err.message });
          completed++;
          return;
        }
        // 重试
        await new Promise(r => setTimeout(r, 1000));
      }
    }
  };

  // 并发执行
  let cursor = 0;
  async function worker() {
    while (cursor < total) {
      const idx = cursor++;
      await genOne(prompts[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

  // ============================================================
  // Stage 5: 后处理
  // ============================================================
  onProgress('post_processing', '正在处理最终结果...');
  // 后处理逻辑在 postProcessor.mjs

  onProgress('complete', '生成完成!');

  return {
    images,
    errors,
    qualityResults,
    pipeline: 'v4',
    mode,
    inputMode,
    decision,
    stats: {
      totalImages: total,
      generated: Object.keys(images).length,
      failed: errors.length,
      qualityPassed: qualityResults.filter(q => q.passed).length,
    },
  };
}

// ============================================================
// 辅助函数
// ============================================================

/** 构建图片类型列表 */
function buildImageList(decision, productName) {
  const list = [];
  const { imageTypes, imageCounts, detailSlices, showSKU, skus } = decision;

  if (imageTypes && imageCounts) {
    imageTypes.forEach((type, i) => {
      const count = imageCounts[i] || 1;
      for (let j = 0; j < count; j++) {
        list.push({
          key: count > 1 ? `${type}_${j + 1}` : type,
          baseKey: type,
          label: count > 1 ? `${type}_${j + 1}` : type,
          variant: type === 'sku' ? (skus?.[j] || null) : null,
          sliceNote: null,
        });
      }
    });
  }

  // 详情切片
  if (Array.isArray(detailSlices)) {
    detailSlices.forEach(slice => {
      list.push({ key: `detail_slice_${slice}`, baseKey: `detail_slice_${slice}`, label: `detail_slice_${slice}`, sliceNote: null });
    });
  }

  // SKU
  if (showSKU && Array.isArray(skus) && skus.length) {
    skus.forEach((variant, i) => {
      list.push({ key: `sku_${i + 1}`, baseKey: 'sku', label: `SKU ${i + 1}`, variant });
    });
  }

  return list;
}

// 导入质检模块
import { checkQuality } from './qualityCheck.mjs';

/** 图片生成 API 调用 (GPT Image 2) — 从上一版保持兼容 */
async function callImageGen(prompt, category) {
  const apiKey = process.env.IMAGE_API_KEY || '';
  const apiBase = (process.env.IMAGE_BASE_URL || '').replace(/\/+$/, '');
  const model = process.env.IMAGE_MODEL || 'gpt-image-2';

  if (!apiKey) {
    // Mock: 没有 API key 时返回占位图
    return `https://placehold.co/1024x1024/EEE/999?text=${encodeURIComponent(category || 'Product')}&font=noto-sans`;
  }

  const body = JSON.stringify({ model, prompt, n: 1, size: '1024x1024', quality: 'hd', response_format: 'url' });

  const response = await fetch(`${apiBase}/v1/images/generations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body,
  });

  if (!response.ok) throw new Error(`Image API ${response.status}`);
  const data = await response.json();
  return data.data?.[0]?.url || '';
}
