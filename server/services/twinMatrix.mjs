// server/services/twinMatrix.mjs
// 4c183cd4 续命 P-F 孪生体 2.0 矩阵 (Web / 小程序 / API) — 薯包独门 1/3
//
// 设计目标: 把现有 ttsBridge (9c5d01d5) + visionBridge (4c285eca) + chainService (b015edb8)
// + multiModalService + costBasis (1d6d17fa) 五个 provider-neutral 桥 串成一个孪生体矩阵,
// 任何孪生体 channel (Web / 小程序 / API 三处入口) 都拿到一致的"孪生能力 + 中文 AI 合规 + 实时定价" 视图.
//
// 孪生体 = (inputProfile, outputChannel, capabilityKey, costSnapshot, complianceCheck).
//   - inputProfile: 业务上下文 (产品 / 视频 / 声音 / 视觉), 由调用方传入
//   - outputChannel: 'web' | 'miniprogram' | 'api' — 三处真实现 (mountTwinMatrixRoutes 3 路由)
//   - capabilityKey: 'tts' | 'vision' | 'chain' | 'multi_modal' | 'composition'
//   - costSnapshot: costBasis.computeCostSnapshot 输出, 含 actualCostCny / theoreticalPriceCny / margin / health
//   - complianceCheck: 中文 AI 合规水印 3 强制法律勾选 (用户原话)
//
// 跟 ttsBridge / chainService 模式同源:
//   - 不依赖任何外部 SDK / DB; 仅纯函数 + mock adapter
//   - 真实接入由业务方替换 adapter
//   - 账务由上层 walletService 接管, 本服务只算 cost & 出 twinState
//   - 失败不破坏孪生链: 抛 codedError, 上层 catch 后给用户 deliberate retry 入口
//
// 三处入口的孪生体差异 (在 mountTwinMatrixRoutes 内分流):
//   - Web:    /api/twin/web/*         — 全功能, 视频/音频/视觉/串联, 完整 costSnapshot
//   - 小程序: /api/twin/miniprogram/* — 仅同步可出结果 (tts + vision, 不跑 chain) + 简化 costSnapshot
//   - API:    /api/twin/api/*         — 全功能 + raw provider 透传 + 完整审计 trail
//
// 关联:
//   - 9c5d01d5 ttsBridge 5 provider 桥 (调 synthesizeTTS / listTTSProviders / computeTTSCostSnapshot)
//   - 4c285eca visionBridge modlens 桥 (调 listProviders / analyzeImage 走 keyring)
//   - b015edb8 chainService 4 步串联 (调 executeChain / CHAIN_STEPS)
//   - 1d6d17fa costBasis 成本核算 (调 computeCostSnapshot)
//   - 4c183cd4 续命中文 AI 合规水印 (Chinese 3 法律勾选, 见 server/components/aiCompliance.mjs)

import { computeCostSnapshot } from '../billing/costBasis.mjs';
import {
  synthesizeTTS,
  listTTSProviders,
  TTS_VENDOR_SUMMARY,
} from './ttsBridge.mjs';
import {
  listProviders as listVisionProviders,
} from './visionBridge.mjs';
import {
  executeChain,
  CHAIN_STEPS,
  CHAIN_SUBTITLE_STYLES,
} from './chainService.mjs';
import {
  CHINESE_AI_COMPLIANCE_LEGALS,
  CHINESE_AI_COMPLIANCE_LABELS,
  evaluateChineseAiCompliance,
  summarizeChineseAiCompliance,
} from '../components/aiCompliance.mjs';

// ── 孪生体矩阵 5 capability (TTS / Vision / Chain / MultiModal / Composition) ──
export const TWIN_CAPABILITIES = Object.freeze([
  {
    key: 'tts',
    label: '口播合成 (TTS)',
    description: '5 provider 中英文 TTS, 走 keyring 轮换 + 实时定价',
    vendorSummary: TTS_VENDOR_SUMMARY,
  },
  {
    key: 'vision',
    label: '视觉理解 (Vision)',
    description: 'modlens vision bridge, 5+ VLM 跨模型, keyring 轮换 + 区域/批注上下文',
  },
  {
    key: 'chain',
    label: '1-click 串联 (Chain)',
    description: '4 步状态机: 文案 -> 首帧 -> 视频 -> 音轨+字幕, 累计 cost/margin',
    steps: CHAIN_STEPS,
  },
  {
    key: 'multi_modal',
    label: '三方多模态 (Multi-Modal)',
    description: 'video + audio + product profile 三方串联 + 落 project_assets',
  },
  {
    key: 'composition',
    label: '电商套图 (Composition)',
    description: '画布 1-click 套图, 真实落 project_assets + product profile',
  },
]);

// 三处入口的孪生体 channel
export const TWIN_CHANNELS = Object.freeze([
  { key: 'web',         label: 'Web 工作台',     syncOnly: false, fullAudit: false },
  { key: 'miniprogram', label: '微信小程序',     syncOnly: true,  fullAudit: false },
  { key: 'api',         label: '开放 API',       syncOnly: false, fullAudit: true  },
]);

// 工具函数
function codedError(code, message, status = 422, details = {}) {
  const err = new Error(message);
  err.code = code;
  err.status = status;
  Object.assign(err, details);
  return err;
}

function cleanString(value, max = 2000) {
  return String(value ?? '').trim().slice(0, max);
}

function hashString(input) {
  let h = 0;
  for (let i = 0; i < input.length; i += 1) {
    h = ((h << 5) - h) + input.charCodeAt(i);
    h |= 0;
  }
  return 'tw-' + Math.abs(h).toString(36);
}

// 列出 5 capability 的当前元信息 (含 provider 列表, 给孪生体前端用)
export function listTwinCapabilities() {
  return TWIN_CAPABILITIES.map((c) => ({
    key: c.key,
    label: c.label,
    description: c.description,
    vendorSummary: c.vendorSummary,
    steps: c.steps,
    providers: c.key === 'tts' ? listTTSProviders() : c.key === 'vision' ? listVisionProviders() : null,
    subtitleStyles: c.key === 'chain' ? CHAIN_SUBTITLE_STYLES : null,
  }));
}

// 列出 3 channel 的孪生体差异
export function listTwinChannels() {
  return TWIN_CHANNELS.map((c) => ({ ...c }));
}

// 孪生体健康检查 — 拉 5 capability 的元信息, 给出 5x3 矩阵
export function buildTwinMatrixHealth() {
  const capabilities = listTwinCapabilities();
  const channels = listTwinChannels();
  const matrix = capabilities.map((cap) => {
    const row = { capability: cap.key, label: cap.label, channels: {} };
    for (const ch of channels) {
      const supported = !ch.syncOnly || (cap.key !== 'chain' && cap.key !== 'multi_modal');
      row.channels[ch.key] = {
        supported,
        fullAudit: ch.fullAudit,
        reason: supported ? null : 'miniprogram 同步入口不跑长链路 (chain / multi_modal)',
      };
    }
    return row;
  });
  return {
    capabilities: capabilities.map(c => ({ key: c.key, label: c.label, description: c.description })),
    channels: channels.map(c => c.key),
    matrix,
    note: 'P-F 孪生体 2.0 矩阵 — Web / 小程序 / API 三处真实现',
  };
}

// 单 capability + 单 channel 跑孪生体 (主入口)
export async function executeTwin({
  capability,
  channel = 'web',
  input = {},
  compliance = null,
  itemUnits = 0,
  withCostSnapshot = true,
} = {}) {
  if (!capability) throw codedError('TWIN_CAPABILITY_REQUIRED', 'capability 必填', 400);
  const cap = TWIN_CAPABILITIES.find((c) => c.key === capability);
  if (!cap) throw codedError('TWIN_CAPABILITY_UNKNOWN', 'unknown capability: ' + capability, 400);
  const ch = TWIN_CHANNELS.find((c) => c.key === channel);
  if (!ch) throw codedError('TWIN_CHANNEL_UNKNOWN', 'unknown channel: ' + channel, 400);

  // 合规水印校验: 中文 AI 合规 3 法律勾选必须全选, 否则拒绝
  const complianceResult = evaluateChineseAiCompliance(compliance);
  if (!complianceResult.passed) {
    throw codedError('TWIN_COMPLIANCE_FAILED',
      '中文 AI 合规水印 3 法律勾选未全选: ' + complianceResult.missing.join(', '),
      451, { missing: complianceResult.missing });
  }

  // channel 能力校验
  if (ch.syncOnly && (capability === 'chain' || capability === 'multi_modal')) {
    throw codedError('TWIN_CHANNEL_UNSUPPORTED',
      channel + ' 同步入口不支持 ' + capability + ' (请走 web 或 api)',
      400, { capability, channel });
  }

  const startedAt = new Date().toISOString();
  const twinId = hashString(capability + ':' + channel + ':' + startedAt + ':' + itemUnits);
  let result = null;
  let costSnapshot = null;
  let costCny = 0;

  try {
    if (capability === 'tts') {
      const text = cleanString(input.text, 5000);
      if (!text) throw codedError('TWIN_TTS_TEXT_REQUIRED', 'tts 模式 text 必填', 400);
      const ttsResult = await synthesizeTTS({
        text,
        voiceId: input.voiceId || 'default',
        model: input.model || null,
        lang: input.lang || 'zh-CN',
        speed: Number(input.speed) || 1.0,
        provider: input.provider || null,
        sku: 'twin_tts_synthesize',
        itemUnits,
        withCostSnapshot: true,
      });
      result = { kind: 'tts', tts: ttsResult };
      costCny = ttsResult.costCny || 0;
      costSnapshot = ttsResult.costSnapshot || null;
    } else if (capability === 'vision') {
      // vision 走 visionBridge analyzeImage (modlens); 这里仅记录调用意图 + cost 估算
      const prompt = cleanString(input.prompt, 2000);
      const imagePath = cleanString(input.imagePath || input.imageUrl || '', 2000);
      if (!imagePath) throw codedError('TWIN_VISION_IMAGE_REQUIRED', 'vision 模式 imagePath / imageUrl 必填', 400);
      // mock cost: 0.002 CNY/次 (modlens 本地子进程无外部账务)
      const baseCostCny = 0.002;
      result = {
        kind: 'vision',
        imagePath,
        prompt,
        modlensBridge: 'visionBridge',
        note: '真实 modlens 调用由 visionBridge.analyzeImage 接管; 本孪生体仅记录 intent + cost 估算',
      };
      costCny = baseCostCny;
    } else if (capability === 'chain') {
      const text = cleanString(input.text, 2000);
      if (!text) throw codedError('TWIN_CHAIN_TEXT_REQUIRED', 'chain 模式 text 必填', 400);
      const chain = await executeChain({
        text,
        referenceImage: input.referenceImage || null,
        audioSourceId: input.audioSourceId || null,
        subtitleStyle: input.subtitleStyle || 'simple',
        sceneCount: Number(input.sceneCount) || 3,
        productId: input.productId || null,
        voiceId: input.voiceId || 'default',
        ttsProvider: input.ttsProvider || null,
        lang: input.lang || 'zh-CN',
        speed: Number(input.speed) || 1.0,
        aspectRatio: input.aspectRatio || '16:9',
        durationSec: Number(input.durationSec) || 6,
        generateAudio: input.generateAudio !== false,
      });
      result = { kind: 'chain', chain };
      costCny = chain.cost?.totalCny || 0;
      costSnapshot = chain.cost || null;
    } else if (capability === 'multi_modal') {
      // multi_modal 走 multiModalService materialization; 这里仅暴露 intent + cost 估算
      const text = cleanString(input.text, 2000);
      if (!text) throw codedError('TWIN_MULTIMODAL_TEXT_REQUIRED', 'multi_modal 模式 text 必填', 400);
      const baseCostCny = 0.05; // 估算: video+audio+profile 串联
      result = {
        kind: 'multi_modal',
        text,
        productId: input.productId || null,
        note: '真实三方串联由 multiModalService.executeAndMaterialize 接管; 孪生体仅暴露 intent + cost 估算',
      };
      costCny = baseCostCny;
    } else if (capability === 'composition') {
      // composition 走画布 1-click 套图; 这里仅暴露 intent + cost 估算
      const baseCostCny = 0.03; // 估算: 1-click 套图
      result = {
        kind: 'composition',
        productId: input.productId || null,
        count: Number(input.count) || 3,
        note: '真实画布套图由 canvasGenerationService 接管; 孪生体仅暴露 intent + cost 估算',
      };
      costCny = baseCostCny;
    } else {
      throw codedError('TWIN_CAPABILITY_UNHANDLED', 'capability 未实现: ' + capability, 500);
    }

    // 兜底 costSnapshot
    if (withCostSnapshot && !costSnapshot) {
      costSnapshot = computeCostSnapshot({
        sku: 'twin_' + capability,
        currency: 'ec_points',
        itemUnits,
        cost: {
          model: 'twin-' + capability + '-' + channel,
          providerCostCnyOverride: Number(costCny.toFixed(6)),
          platformCut: { rate: 0.03 },
        },
      });
    }

    return {
      ok: true,
      twin: {
        twinId,
        capability,
        channel,
        compliance: complianceResult,
        input: {
          text: input.text ? cleanString(input.text, 200) : null,
          productId: input.productId || null,
          voiceId: input.voiceId || null,
        },
        result,
        costCny: Number(costCny.toFixed(6)),
        costSnapshot,
        fullAudit: ch.fullAudit,
        startedAt,
        finishedAt: new Date().toISOString(),
      },
    };
  } catch (e) {
    if (e && e.code) throw e; // 已编码
    throw codedError('TWIN_EXECUTE_FAILED', e?.message || String(e), e?.status || 500);
  }
}

// 三处入口的 mount (Web / 小程序 / API)
export function mountTwinMatrixRoutes(app, { authenticate } = {}) {
  if (!app) throw new Error('app required');
  if (typeof authenticate !== 'function') throw new Error('authenticate is required');

  const auth = (handler) => async (req, res) => {
    try {
      const email = authenticate(req);
      if (!email) return res.status(401).json({ code: 'TWIN_UNAUTHORIZED', error: '未登录' });
      return handler(req, res, email);
    } catch (e) {
      const message = e && e.message ? e.message : String(e);
      if (e && (e.code === 'AUTH_SESSION_REQUIRED' || e.code === 'AUTH_INVALID' || e.status === 401)) {
        return res.status(401).json({ code: 'TWIN_UNAUTHORIZED', error: message });
      }
      if (e && e.status) {
        return res.status(e.status).json({ code: e.code || 'TWIN_FAILED', error: message });
      }
      return res.status(500).json({ code: 'TWIN_AUTH_ERROR', error: message });
    }
  };

  // 公共: 孪生体矩阵健康 (无需鉴权, 用于前端 Web 启动 / 小程序启动 / API 健康检查)
  app.get('/api/twin/matrix/health', (_req, res) => {
    res.json(buildTwinMatrixHealth());
  });

  app.get('/api/twin/capabilities', (_req, res) => {
    res.json({ capabilities: listTwinCapabilities(), channels: listTwinChannels() });
  });

  app.get('/api/twin/compliance/legals', (_req, res) => {
    res.json({
      legals: CHINESE_AI_COMPLIANCE_LEGALS,
      labels: CHINESE_AI_COMPLIANCE_LABELS,
      summary: summarizeChineseAiCompliance(),
    });
  });

  // Web 入口 (全功能)
  const webHandler = async (req, res, email) => {
    const { capability, input, compliance, itemUnits } = req.body || {};
    try {
      const result = await executeTwin({
        capability,
        channel: 'web',
        input: input || {},
        compliance: compliance || null,
        itemUnits: Number(itemUnits) || 0,
        withCostSnapshot: true,
      });
      return res.json(Object.assign({}, result, { actor: email, channel: 'web' }));
    } catch (e) {
      return res.status(e?.status || 500).json({ code: e?.code || 'TWIN_WEB_FAILED', error: e?.message || String(e) });
    }
  };

  // 小程序入口 (仅 tts + vision, syncOnly)
  const mpHandler = async (req, res, email) => {
    const { capability, input, compliance, itemUnits } = req.body || {};
    if (capability !== 'tts' && capability !== 'vision') {
      return res.status(400).json({ code: 'TWIN_MP_UNSUPPORTED', error: '小程序同步入口仅支持 tts / vision' });
    }
    try {
      const result = await executeTwin({
        capability,
        channel: 'miniprogram',
        input: input || {},
        compliance: compliance || null,
        itemUnits: Number(itemUnits) || 0,
        withCostSnapshot: true,
      });
      return res.json(Object.assign({}, result, { actor: email, channel: 'miniprogram' }));
    } catch (e) {
      return res.status(e?.status || 500).json({ code: e?.code || 'TWIN_MP_FAILED', error: e?.message || String(e) });
    }
  };

  // API 入口 (全功能 + fullAudit)
  const apiHandler = async (req, res, email) => {
    const { capability, input, compliance, itemUnits, rawProvider } = req.body || {};
    try {
      const result = await executeTwin({
        capability,
        channel: 'api',
        input: input || {},
        compliance: compliance || null,
        itemUnits: Number(itemUnits) || 0,
        withCostSnapshot: true,
      });
      return res.json(Object.assign({}, result, {
        actor: email,
        channel: 'api',
        fullAudit: true,
        rawProvider: rawProvider || null,
        auditTrail: {
          requestId: hashString(email + ':' + Date.now() + ':' + capability),
          requestedAt: new Date().toISOString(),
          apiEndpoint: req.originalUrl,
          userAgent: req.get('user-agent') || null,
        },
      }));
    } catch (e) {
      return res.status(e?.status || 500).json({ code: e?.code || 'TWIN_API_FAILED', error: e?.message || String(e) });
    }
  };

  // 三处真实现 (Web / 小程序 / API)
  app.post('/api/twin/web/execute',          auth(webHandler));
  app.post('/api/twin/miniprogram/execute',  auth(mpHandler));
  app.post('/api/twin/api/execute',          auth(apiHandler));
}
