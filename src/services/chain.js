// src/services/chain.js
// 4c183cd4 续命 P-G 画布 1-click chain UI 客户端
// 后端: server/services/chainService.mjs (mountChainRoutes)
// API:
//   GET  /api/chain/capabilities (无 auth, 拿 steps + subtitleStyles + ttsProviders)
//   POST /api/chain/execute (auth, body: text/referenceImage/audioSourceId/subtitleStyle)
// 复用 videoWorkbench.js 的 signedHeaders + requestJson 模式, 跟项目其它 service 对齐.

import { getSessionToken } from './auth.js';
import { createApiError } from './apiError.js';

function signedHeaders(headers = {}) {
  const token = getSessionToken();
  return token ? { ...headers, Authorization: `Bearer ${token}` } : headers;
}

async function requestJson(path, options = {}, fallbackMessage = '链式生成请求失败') {
  const response = await fetch(path, {
    ...options,
    headers: signedHeaders(options.headers),
  });
  if (!response.ok) throw await createApiError(response, fallbackMessage);
  return response.json();
}

function jsonBody(value) {
  return {
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(value || {}),
  };
}

// ── API wrappers ──

// capabilities: { steps: [{key,label,description}], subtitleStyles: [{key,label}], ttsProviders: [str], note: str }
export function fetchChainCapabilities() {
  return requestJson('/api/chain/capabilities', {}, '无法获取链式生成能力');
}

// execute: POST { text, referenceImage?, audioSourceId?, subtitleStyle? }
// 响应: { ok, chain: { ok, chainId, steps: [{step,ok,data,error?,code?,costSnapshot}], cost, startedAt, finishedAt, failedStep, subtitleStyle, stepCount }, actor }
export function executeChain(input = {}) {
  return requestJson('/api/chain/execute', { method: 'POST', ...jsonBody(input) }, '链式生成执行失败');
}

// ── 纯函数 helpers (供 ChainProgress / ChainOrchestrator 复用, 也供 test 直接覆盖) ──

// 把 executeChain 响应规范化为 { stepLabels, stepStatuses, totalCost, ok, failedStep }
// stepStatuses[i] ∈ 'pending' | 'ok' | 'failed' | 'skipped'
//   pending  — 还没轮到/没产出
//   ok       — 后端 stepResults[i].ok === true
//   failed   — 后端 stepResults[i].ok === false
//   skipped  — 该步因前面 failed 而被跳过 (后端不会 push 进来, 仅前端 UI 用)
export function normalizeChainResponse(payload) {
  const chain = payload && payload.chain ? payload.chain : payload;
  const steps = Array.isArray(chain && chain.steps) ? chain.steps : [];
  const labels = ['文案', '首帧', '视频', '音轨+字幕'];
  const stepLabels = steps.map(function (s, i) {
    return (s && s.step) || labels[i] || `步骤${i + 1}`;
  });
  const stepStatuses = steps.map(function (s) {
    if (!s) return 'skipped';
    return s.ok === false ? 'failed' : (s.ok === true ? 'ok' : 'skipped');
  });
  const cost = (chain && chain.cost) || {};
  return {
    ok: Boolean(chain && chain.ok),
    chainId: (chain && chain.chainId) || '',
    stepLabels,
    stepStatuses,
    totalCost: Number(cost.totalActualCostCny) || 0,
    theoreticalPrice: Number(cost.totalTheoreticalPriceCny) || 0,
    grossProfit: Number(cost.totalGrossProfitCny) || 0,
    margin: Number(cost.margin) || 0,
    health: (cost && cost.health) || 'ok',
    failedStep: (chain && chain.failedStep) || null,
    stepCount: steps.length,
    raw: chain,
  };
}

// 从 raw steps 数组提取人类可读 step summary (供 UI 展示用)
export function stepSummary(step) {
  if (!step) return '';
  if (step.ok === false) return step.error || step.code || '失败';
  const data = step.data || {};
  if (step.step === 'script') {
    const n = (data.script && data.script.length) || 0;
    return `已派生 ${n} 段分镜`;
  }
  if (step.step === 'keyframe') {
    const n = (data.keyframes && data.keyframes.length) || 0;
    return `已生成 ${n} 张首帧`;
  }
  if (step.step === 'video') {
    const n = (data.videos && data.videos.length) || 0;
    return `已派发 ${n} 段视频`;
  }
  if (step.step === 'audio') {
    const tts = data.tts || {};
    return `TTS ${tts.provider || 'mock'} · ${tts.durationMs ? Math.round(tts.durationMs / 100) / 10 + 's' : '已合成'}`;
  }
  return '已完成';
}

// 默认 chain 输入 (4 步)
export const DEFAULT_CHAIN_INPUT = Object.freeze({
  text: '',
  referenceImage: null,
  audioSourceId: null,
  subtitleStyle: 'simple',
});

export const CHAIN_STEP_LABELS = Object.freeze(['文案', '首帧', '视频', '音轨+字幕']);
