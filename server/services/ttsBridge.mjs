// 4c183cd4 续命 P1 TTS 口播 - provider-neutral 桥 (主线程亲自做, 子代理 OOM)
// 设计: 5 provider (火山主推 + ElevenLabs 备选 + 阿里云 + 微软 Azure + MiniMax)
// 跟 modlens vision 桥 (4c285eca) 同样模式: 5 个 adapter + keyring + costBasis
// 调研: a8be4109 文档

import crypto from "node:crypto";

// 5 provider 单价表 (CNY / 1K 字符)
const TTS_PRICING = Object.freeze({
  volcengine: { name: "火山引擎 TTS", inputPricePerKChars: 0.0001, outputPricePerKChars: 0.0001, voiceCount: 150 },
  elevenlabs: { name: "ElevenLabs", inputPricePerKChars: 0.018, outputPricePerKChars: 0.022, voiceCount: 33 },
  aliyun: { name: "阿里云智能语音", inputPricePerKChars: 0.0002, outputPricePerKChars: 0.00022, voiceCount: 60 },
  azure: { name: "微软 Azure TTS", inputPricePerKChars: 0.016, outputPricePerKChars: 0.10, voiceCount: 400 },
  minimax: { name: "MiniMax TTS (字节豆包)", inputPricePerKChars: 0.0001, outputPricePerKChars: 0.00012, voiceCount: 100 },
});

// Provider rotation (keyring) - 简单 5 选 1 round-robin
const providerKeys = Object.keys(TTS_PRICING);
let keyringIndex = 0;
export function nextProviderKey() {
  const k = providerKeys[keyringIndex % providerKeys.length];
  keyringIndex += 1;
  return k;
}

export function listTTSProviders() {
  return Object.entries(TTS_PRICING).map(([key, p]) => ({ key, name: p.name, voiceCount: p.voiceCount }));
}

// Cost computation (跟 costBasis 1d6d17fa 同模式)
export function computeTTSCost({ provider, textChars, outputChars = 0 }) {
  const pricing = TTS_PRICING[provider];
  if (!pricing) throw new Error("TTS unknown provider: " + provider);
  const inputCostCny = (textChars / 1000) * pricing.inputPricePerKChars;
  const outputCostCny = (outputChars / 1000) * pricing.outputPricePerKChars;
  return { inputCostCny, outputCostCny, totalCny: inputCostCny + outputCostCny };
}

// Provider adapter interface
async function callVolcengineTTS({ apiKey, apiSecret, text, voiceId, lang, speed }) {
  // 火山 TTS: https://openspeech.bytedance.com/api/v1/tts
  // Mock: 真实接入时把这里替换成 fetch + sign
  return { provider: "volcengine", voiceId, text, mockAudio: true, audioUrl: "/mock/tts-volc-" + Date.now() + ".mp3" };
}
async function callElevenLabsTTS({ apiKey, text, voiceId, lang, speed }) {
  return { provider: "elevenlabs", voiceId, text, mockAudio: true, audioUrl: "/mock/tts-11l-" + Date.now() + ".mp3" };
}
async function callAliyunTTS({ apiKey, apiSecret, text, voiceId, lang, speed }) {
  return { provider: "aliyun", voiceId, text, mockAudio: true, audioUrl: "/mock/tts-ali-" + Date.now() + ".mp3" };
}
async function callAzureTTS({ apiKey, region, text, voiceId, lang, speed }) {
  return { provider: "azure", voiceId, text, mockAudio: true, audioUrl: "/mock/tts-azure-" + Date.now() + ".mp3" };
}
async function callMiniMaxTTS({ apiKey, text, voiceId, lang, speed }) {
  return { provider: "minimax", voiceId, text, mockAudio: true, audioUrl: "/mock/tts-mmx-" + Date.now() + ".mp3" };
}

const ADAPTERS = Object.freeze({
  volcengine: callVolcengineTTS,
  elevenlabs: callElevenLabsTTS,
  aliyun: callAliyunTTS,
  azure: callAzureTTS,
  minimax: callMiniMaxTTS,
});

// 5 类 1 句话: 5 句话每家优劣
export const TTS_VENDOR_SUMMARY = Object.freeze({
  volcengine: "中文自然度第一梯队, 价格最低, 跟 IP233 字节系账务可并列",
  elevenlabs: "英文拟真头部, 跨境英文刚需, Voice Cloning 行业独家",
  aliyun: "国内合规与数据本地化最优, 方言与童声独家 (粤语/四川/东北)",
  azure: "稳定性/合规/跨区域部署的天花板, SLA 99.9%, 400+ 音色",
  minimax: "跟火山同源, 贵 15-30%, 多一层商务, 不推荐走",
});

// 5 天 W4 D12 落地甘特图 (1 周)
export const TTS_GANTT = Object.freeze([
  { day: "9/16 周一", task: "底座 + keyring + catalog + 毛利门禁" },
  { day: "9/17 周二", task: "4 provider adapter + 路由 + 单元测试" },
  { day: "9/18 周三", task: "账务三态 + 路由 API + 失败重放" },
  { day: "9/19 周四", task: "资产持久化 + 视频工作台接入" },
  { day: "9/20 周五", task: "真实跑 1 中 1 英 + 全量回归 + RTK 同步" },
]);

// 主入口 (主线程接子代理挂活)
export async function synthesizeTTS({ text, voiceId = "default", model = null, lang = "zh-CN", speed = 1.0, provider = null, apiKey = null, apiSecret = null, region = null } = {}) {
  if (!text || !text.trim()) throw new Error("TTS empty text");
  const providerToUse = provider || nextProviderKey();
  const adapter = ADAPTERS[providerToUse];
  if (!adapter) throw new Error("TTS unknown provider: " + providerToUse);
  const textChars = text.length;
  const result = await adapter({
    apiKey: apiKey || (process.env["TTS_API_KEY_" + providerToUse.toUpperCase()] || "mock-key"),
    apiSecret: apiSecret || process.env["TTS_API_SECRET_" + providerToUse.toUpperCase()] || "mock-secret",
    region: region || process.env["TTS_REGION_" + providerToUse.toUpperCase()] || "cn-north-1",
    text, voiceId, lang, speed,
  });
  const cost = computeTTSCost({ provider: providerToUse, textChars });
  return {
    provider: providerToUse,
    voiceId,
    audioUrl: result.audioUrl,
    textChars,
    durationMs: Math.round(textChars * 60),  // 估算: 中文 ~60ms/字
    costCny: cost.totalCny,
    latencyMs: Date.now() % 1000 + 200,  // mock
    mockAudio: true,  // 真实接入时删掉
  };
}

// Mount routes (admin/owner only)
export function mountTTSRoutes(app, { db, authenticateOwner, requireAccountAccess = null } = {}) {
  if (!app) throw new Error("app required");

  const auth = (handler) => async (req, res) => {
    try {
      const result = typeof requireAccountAccess === "function" ? requireAccountAccess(req) : authenticateOwner(req);
      const email = typeof result === "string" ? result : result && result.email;
      if (!email) { res.status(401).json({ code: "TTS_UNAUTHORIZED", error: "未登录" }); return; }
      return handler(req, res, email);
    } catch (e) { res.status(500).json({ code: "TTS_ERROR", error: e && e.message ? e.message : String(e) }); }
  };

  app.get("/api/tts/providers", (req, res) => res.json({ providers: listTTSProviders() }));

  app.post("/api/tts/synthesize", auth(async (req, res, email) => {
    const { text, voiceId, model, lang, speed, provider } = req.body || {};
    try {
      const result = await synthesizeTTS({ text, voiceId, model, lang, speed, provider });
      // 记录用量 (跟 costBasis 1d6d17fa 集成, 写到 usage_events)
      try {
        const now = new Date().toISOString();
        db.prepare(
          "INSERT INTO usage_events (owner_email, action_kind, provider, model, points, created_at, metadata_json) VALUES (?, ?, ?, ?, ?, ?, ?)"
        ).run(email, "tts.synthesize", result.provider, voiceId || "default", Math.max(1, Math.ceil(result.textChars / 100)), now, JSON.stringify({
          textChars: result.textChars, durationMs: result.durationMs, costCny: result.costCny,
        }));
      } catch (e) { /* ignore 记录失败 */ }
      return res.json({ tts: result });
    } catch (e) {
      res.status(400).json({ code: "TTS_SYNTHESIZE_FAILED", error: e && e.message ? e.message : String(e) });
    }
  }));
}
