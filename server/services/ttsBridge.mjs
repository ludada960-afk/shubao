// server/services/ttsBridge.mjs
// 4c183cd4 续命 P1 TTS 口播 - provider-neutral 桥 (跟 modlens vision 桥同模式)
// 设计: 5 provider (火山主推 + ElevenLabs 备选 + 阿里云 + 微软 Azure + MiniMax),
// 走 keyring 轮换 + costBasis (1d6d17fa P2 成本核算) 实时算 cost/margin.
// 调研: a8be4109 文档 (.superpowers/sdd/2026-08-28-tts-vendor-research.md)
//
// 跟 vision bridge 一脉相承:
//   - 密钥走 .env.d/tts-keyring.json (本文件以环境变量作 fallback, 真接入走 keyring)
//   - 切换供应商 = 改 keyring, 代码不动
//   - 账务三态 (hold/settle/release) 由上层 walletService 接管, 本桥只算成本
//   - costBasis.computeCostSnapshot 给出 actualCostCny + theoreticalPriceCny + margin + health
//
// 不依赖任何外部 SDK / DB; 仅纯函数 + mock adapter (真实接入时由业务方替换 adapter).

import { computeCostSnapshot } from '../billing/costBasis.mjs';

// ── 5 provider 单价表 (CNY / 1K 字符) ──
// 与 .superpowers/sdd/2026-08-28-tts-vendor-research.md §2.2 价格表保持一致.
export const TTS_PRICING = Object.freeze({
  volcengine: {
    name: '火山引擎 TTS',
    inputPricePerKChars: 0.0001,
    outputPricePerKChars: 0.0001,
    voiceCount: 150,
    marginBand: 'core',
  },
  elevenlabs: {
    name: 'ElevenLabs',
    inputPricePerKChars: 0.018,
    outputPricePerKChars: 0.022,
    voiceCount: 33,
    marginBand: 'premium',
  },
  aliyun: {
    name: '阿里云智能语音',
    inputPricePerKChars: 0.0002,
    outputPricePerKChars: 0.00022,
    voiceCount: 60,
    marginBand: 'core',
  },
  azure: {
    name: '微软 Azure TTS',
    inputPricePerKChars: 0.016,
    outputPricePerKChars: 0.10,
    voiceCount: 400,
    marginBand: 'core',
  },
  minimax: {
    name: 'MiniMax TTS (字节豆包)',
    inputPricePerKChars: 0.0001,
    outputPricePerKChars: 0.00012,
    voiceCount: 100,
    marginBand: 'core',
  },
});

// ── Provider rotation (keyring) ──
const providerKeys = Object.keys(TTS_PRICING);
let keyringIndex = 0;
export function nextProviderKey() {
  const k = providerKeys[keyringIndex % providerKeys.length];
  keyringIndex += 1;
  return k;
}

export function listTTSProviders() {
  return Object.entries(TTS_PRICING).map(([key, p]) => ({
    key,
    name: p.name,
    voiceCount: p.voiceCount,
    marginBand: p.marginBand,
  }));
}

// 别名: 兼容历史命名
export const listTPSProviders = listTTSProviders;

export const TTS_VENDOR_SUMMARY = Object.freeze({
  volcengine: '中文自然度第一梯队, 价格最低, 跟 IP233 字节系账务可并列',
  elevenlabs: '英文拟真头部, 跨境英文刚需, Voice Cloning 行业独家',
  aliyun: '国内合规与数据本地化最优, 方言与童声独家 (粤语/四川/东北)',
  azure: '稳定性/合规/跨区域部署的天花板, SLA 99.9%, 400+ 音色',
  minimax: '跟火山同源, 贵 15-30%, 多一层商务, 不推荐走',
});

export const TTS_GANTT = Object.freeze([
  { day: '9/16 周一', task: '底座 + keyring + catalog + 毛利门禁' },
  { day: '9/17 周二', task: '4 provider adapter + 路由 + 单元测试' },
  { day: '9/18 周三', task: '账务三态 + 路由 API + 失败重放' },
  { day: '9/19 周四', task: '资产持久化 + 视频工作台接入' },
  { day: '9/20 周五', task: '真实跑 1 中 1 英 + 全量回归 + RTK 同步' },
]);

export function computeTTSCost({ provider, textChars, outputChars = 0 } = {}) {
  const pricing = TTS_PRICING[provider];
  if (!pricing) throw new Error('TTS unknown provider: ' + provider);
  if (!Number.isFinite(textChars) || textChars < 0) throw new TypeError('textChars must be a non-negative number');
  if (!Number.isFinite(outputChars) || outputChars < 0) throw new TypeError('outputChars must be a non-negative number');
  const inputCostCny = (textChars / 1000) * pricing.inputPricePerKChars;
  const outputCostCny = (outputChars / 1000) * pricing.outputPricePerKChars;
  return {
    provider,
    textChars,
    outputChars,
    inputCostCny,
    outputCostCny,
    totalCny: Number((inputCostCny + outputCostCny).toFixed(6)),
  };
}

export function computeTTSCostSnapshot({
  provider,
  textChars = 0,
  outputChars = null,
  sku = 'tts_synthesize',
  model = 'tts-default',
  itemUnits = 0,
  providerCostCnyOverride = null,
  currency = 'ec_points',
  platformCutRate = 0.03,
} = {}) {
  if (!TTS_PRICING[provider]) throw new Error('TTS unknown provider: ' + provider);
  const out = outputChars === null || outputChars === undefined ? textChars : outputChars;
  const local = computeTTSCost({ provider, textChars, outputChars: out });
  return computeCostSnapshot({
    sku,
    currency,
    itemUnits,
    cost: {
      model,
      providerCostCnyOverride: providerCostCnyOverride === null
        ? Number(local.totalCny.toFixed(6))
        : providerCostCnyOverride,
      platformCut: { rate: platformCutRate },
    },
  });
}

async function callVolcengineTTS({ apiKey, apiSecret, text, voiceId, lang, speed }) {
  return {
    provider: 'volcengine',
    voiceId,
    text,
    mockAudio: true,
    audioUrl: '/mock/tts-volc-' + Date.now() + '.mp3',
  };
}
async function callElevenLabsTTS({ apiKey, text, voiceId, lang, speed }) {
  return {
    provider: 'elevenlabs',
    voiceId,
    text,
    mockAudio: true,
    audioUrl: '/mock/tts-11l-' + Date.now() + '.mp3',
  };
}
async function callAliyunTTS({ apiKey, apiSecret, text, voiceId, lang, speed }) {
  return {
    provider: 'aliyun',
    voiceId,
    text,
    mockAudio: true,
    audioUrl: '/mock/tts-ali-' + Date.now() + '.mp3',
  };
}
async function callAzureTTS({ apiKey, region, text, voiceId, lang, speed }) {
  return {
    provider: 'azure',
    voiceId,
    text,
    mockAudio: true,
    audioUrl: '/mock/tts-azure-' + Date.now() + '.mp3',
  };
}
async function callMiniMaxTTS({ apiKey, text, voiceId, lang, speed }) {
  return {
    provider: 'minimax',
    voiceId,
    text,
    mockAudio: true,
    audioUrl: '/mock/tts-mmx-' + Date.now() + '.mp3',
  };
}

const ADAPTERS = Object.freeze({
  volcengine: callVolcengineTTS,
  elevenlabs: callElevenLabsTTS,
  aliyun: callAliyunTTS,
  azure: callAzureTTS,
  minimax: callMiniMaxTTS,
});

export async function synthesizeTTS({
  text,
  voiceId = 'default',
  model = null,
  lang = 'zh-CN',
  speed = 1.0,
  provider = null,
  apiKey = null,
  apiSecret = null,
  region = null,
  sku = 'tts_synthesize',
  itemUnits = 0,
  withCostSnapshot = false,
} = {}) {
  if (!text || !text.trim()) throw new Error('TTS empty text');
  const providerToUse = provider || nextProviderKey();
  const adapter = ADAPTERS[providerToUse];
  if (!adapter) throw new Error('TTS unknown provider: ' + providerToUse);
  const textChars = text.length;
  const startMs = Date.now();
  const result = await adapter({
    apiKey: apiKey || process.env['TTS_API_KEY_' + providerToUse.toUpperCase()] || 'mock-key',
    apiSecret: apiSecret || process.env['TTS_API_SECRET_' + providerToUse.toUpperCase()] || 'mock-secret',
    region: region || process.env['TTS_REGION_' + providerToUse.toUpperCase()] || 'cn-north-1',
    text, voiceId, lang, speed,
  });
  const cost = computeTTSCost({ provider: providerToUse, textChars });
  const latencyMs = Date.now() - startMs;
  const charMs = lang && lang.toLowerCase().startsWith('en') ? 50 : 60;
  const durationMs = Math.round(textChars * charMs / Math.max(speed, 0.1));
  const payload = {
    provider: providerToUse,
    voiceId,
    audioUrl: result.audioUrl,
    textChars,
    durationMs,
    costCny: cost.totalCny,
    latencyMs,
    mockAudio: true,
  };
  if (withCostSnapshot) {
    payload.costSnapshot = computeTTSCostSnapshot({
      provider: providerToUse,
      textChars,
      model: model || `tts-${providerToUse}`,
      sku,
      itemUnits,
    });
  }
  return payload;
}

export function mountTTSRoutes(app, { authenticateOwner, requireAccountAccess = null } = {}) {
  if (!app) throw new Error('app required');
  if (typeof authenticateOwner !== 'function' && typeof requireAccountAccess !== 'function') {
    throw new Error('authenticateOwner or requireAccountAccess is required');
  }

  const auth = (handler) => async (req, res) => {
    try {
      const result = typeof requireAccountAccess === 'function'
        ? requireAccountAccess(req)
        : authenticateOwner(req);
      const email = typeof result === 'string' ? result : result && result.email;
      if (!email) {
        res.status(401).json({ code: 'TTS_UNAUTHORIZED', error: '未登录' });
        return;
      }
      return handler(req, res, email);
    } catch (e) {
      const message = e && e.message ? e.message : String(e);
      if (e && (e.code === 'AUTH_SESSION_REQUIRED' || e.code === 'AUTH_INVALID' || e.status === 401)) {
        res.status(401).json({ code: 'TTS_UNAUTHORIZED', error: message });
        return;
      }
      res.status(500).json({ code: 'TTS_AUTH_ERROR', error: message });
    }
  };

  app.get('/api/tts/providers', (_req, res) => {
    res.json({ providers: listTTSProviders() });
  });

  app.post('/api/tts/synthesize', auth(async (req, res, email) => {
    const { text, voiceId, model, lang, speed, provider, sku, itemUnits } = req.body || {};
    try {
      const result = await synthesizeTTS({
        text, voiceId, model, lang, speed, provider,
        sku: sku || `tts_${provider || 'default'}`,
        itemUnits: Number(itemUnits) || 0,
        withCostSnapshot: true,
      });
      return res.json({
        ok: true,
        tts: result,
        actor: email,
        note: 'mock audio; real provider integration swaps adapter in ttsBridge.mjs',
      });
    } catch (e) {
      res.status(400).json({
        code: 'TTS_SYNTHESIZE_FAILED',
        error: e && e.message ? e.message : String(e),
      });
    }
  }));
}

// ── 真 keyring 加载 (跟 visionBridge.mjs loadKeyring 4c285eca 同模式) ──
// keyring 文件: .env.d/tts-keyring.json (不入 git, 切换 = 改文件不改代码).
// 单价表以 TTS_PRICING 为准; keyring 负责 apiKey/region/weight 路由.
// 格式: { tts_providers: [{ name, label, apiKey, region?, weight?, dailyLimitHint? }], rotation: { strategy } }
import { join } from 'node:path';
import { readFileSync, existsSync } from 'node:fs';

export const TTS_KEYRING_VERSION = 1;

function decodeKeyringB64(b64) {
  if (!b64) return '';
  if (!b64.startsWith('c2') && !b64.startsWith('c3')) return b64; // 非 base64 包装, 原值透传 (开发/测试)
  try { return Buffer.from(b64, 'base64').toString('utf8'); } catch { return ''; }
}

let _ttsKeyring = null;
let _ttsKeyringPath = null;
export function loadTTSKeyring({ cwd = process.cwd(), path = null } = {}) {
  if (_ttsKeyring && !path) return _ttsKeyring;
  const p = path || join(cwd, '.env.d', 'tts-keyring.json');
  _ttsKeyringPath = p;
  if (!existsSync(p)) {
    const empty = { tts_providers: [], rotation: { strategy: 'round-robin', cooldownSec: 0 } };
    if (!path) _ttsKeyring = empty;
    return empty;
  }
  try {
    const raw = JSON.parse(readFileSync(p, 'utf8'));
    raw.tts_providers = (raw.tts_providers || []).map((v) => ({
      name: v.name,
      label: v.label || v.name,
      apiKey: decodeKeyringB64(v.apiKey),
      region: v.region || 'cn-north-1',
      weight: v.weight || 50,
      dailyLimitHint: v.dailyLimitHint || '',
    }));
    raw.rotation = raw.rotation || { strategy: 'round-robin', cooldownSec: 0 };
    if (!path) _ttsKeyring = raw;
    return raw;
  } catch {
    const empty = { tts_providers: [], rotation: { strategy: 'round-robin', cooldownSec: 0 } };
    if (!path) _ttsKeyring = empty;
    return empty;
  }
}

export function clearTTSKeyringCache() {
  _ttsKeyring = null;
  _ttsKeyringPath = null;
}

export function getTTSKeyringPath() {
  return _ttsKeyringPath || join(process.cwd(), '.env.d', 'tts-keyring.json');
}

let _ttsRRIndex = 0;
export function pickTTSProvider({ preferredProvider = null, strategy = null, cwd = process.cwd(), path = null } = {}) {
  const ring = loadTTSKeyring({ cwd, path });
  const ks = (ring.tts_providers || []).filter((v) => v.apiKey && TTS_PRICING[v.name]);
  if (preferredProvider) {
    const p = ks.find((v) => v.name === preferredProvider);
    return p || null;
  }
  if (!ks.length) return null;
  const strat = strategy || ring.rotation?.strategy || 'round-robin';
  if (strat === 'weighted') {
    const sum = ks.reduce((a, p) => a + (p.weight || 50), 0);
    let r = Math.random() * sum;
    for (const p of ks) { r -= (p.weight || 50); if (r <= 0) return p; }
    return ks[0];
  }
  // 默认 round-robin (与 visionBridge 4c285eca pickProvider 行为一致)
  const p = ks[_ttsRRIndex % ks.length];
  _ttsRRIndex += 1;
  return p;
}

// 兼容 visionBridge listProviders 风格, 把 keyring 中的 provider 元信息对外列出.
export function listTTSKeyringProviders({ cwd = process.cwd(), path = null } = {}) {
  const ring = loadTTSKeyring({ cwd, path });
  return (ring.tts_providers || []).map((p) => ({
    name: p.name,
    label: p.label,
    weight: p.weight,
    hasApiKey: Boolean(p.apiKey),
    region: p.region,
    dailyLimitHint: p.dailyLimitHint,
    marginBand: TTS_PRICING[p.name]?.marginBand || 'unknown',
  }));
}
