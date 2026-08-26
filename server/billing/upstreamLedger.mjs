import { FEATURE_SKUS } from './catalog.mjs';

export const UPSTREAM_LEDGER_VERSION = 'upstream-audit-2026-08-12-v1';
export const UPSTREAM_VERIFIED_AT = '2026-08-12T16:30:00+08:00';

const providers = [
  {
    id: 'relay_65535',
    label: '65535',
    dashboardUrl: 'https://my.65535.space/',
    balanceCny: 6.60,
    reportedSpendCny: 24.9205,
    todaySpendCny: 0.2309,
    reportedRequests: 1874,
    currencyPolicy: '后台虽显示 $，本站按人民币 1:1 核算',
    concurrency: { synchronous: 5, asynchronous: 20 },
    accountEvidence: '生图密钥累计 ¥24.6620；识图密钥累计 ¥0.2585',
    monitoring: { tone: 'healthy', label: '主链路有实测', detail: 'GPT Image 2 近 4 小时可用率 97.70%；识图 99.83%' },
    reconciliationNote: '上游账户含上线前测试；与本地账本的差额仅用于核账，不能直接视为漏记。',
  },
  {
    id: 'change2pro',
    label: 'Change2Pro',
    dashboardUrl: 'https://change2pro.com/',
    balanceCny: 9.32,
    reportedSpendCny: 0.78,
    todaySpendCny: 0,
    reportedRequests: 13,
    currencyPolicy: '后台虽显示 $，本站按人民币 1:1 核算',
    concurrency: { current: 0 },
    accountEvidence: '生产 Nano Banana 密钥累计 13 次请求，累计 ¥0.7800',
    monitoring: { tone: 'unknown', label: '未提供独立监控', detail: '13 次账户请求均成功；站点总状态不等于 Nano Banana 独立可用率' },
    reconciliationNote: '上游账户请求与本地动作口径可能不同，差额仅作人工核账提示。',
  },
  {
    id: 'ip233',
    label: 'IP233 Media API',
    dashboardUrl: 'https://new.ip233.com/',
    balanceCny: 10,
    reportedSpendCny: 0,
    todaySpendCny: 0,
    reportedRequests: 0,
    currencyPolicy: '模型广场以 ¥ 计价',
    concurrency: null,
    accountEvidence: 'Seedance 视频密钥已配置；遵守约束，尚未进行付费视频测试',
    monitoring: { tone: 'warning', label: '监控正常，库存有风险', detail: 'Seedance 2.0/Fast/Mini 近 7 日标示 100%；公告同时提示按条库存不足' },
    reconciliationNote: '尚无真实扣费记录；上线后须以任务日志与用量日志共同对账。',
  },
  {
    id: 'poke',
    label: 'Poke 中转（MiniMax）',
    dashboardUrl: 'https://www.poke2api.com/',
    balanceCny: null,
    reportedSpendCny: 0,
    todaySpendCny: 0,
    reportedRequests: 0,
    // 成本定案（2026-09）：用户在 poke2api 充值实测确认美元余额按人民币 1:1 核算。
    currencyPolicy: '美元标价按 0.2× 折扣后计：input $0.42–0.84、output $1.68–3.36 /1M token；用户实测确认 1:1，折合 ≈¥0.76/条',
    concurrency: null,
    accountEvidence: 'MiniMax H3 密钥经 poke2api 中转；计价口径已经用户充值实测确认为 1:1',
    monitoring: { tone: 'unknown', label: '未提供独立监控', detail: '稳定性验收中，仅对内部白名单开放' },
    reconciliationNote: '成本定案（用户实测确认 1:1）：≈¥0.76/条；首张真实账单出来后仍须对账校准输出 token 单耗误差。',
  },
];

const route = (input) => Object.freeze({ status: 'candidate', appSkus: [], ...input });

const routes = [
  route({
    id: '65535-gpt-image-2', providerId: 'relay_65535', model: 'gpt-image-2', status: 'connected',
    purpose: '电商生图与小红书套图', billingUnit: '每张', unitPriceCny: 0.038,
    appSkus: ['ec_image_2k', 'ec_image_4k', 'xhs_image_set_2k'],
    health: '近 4 小时 97.70%，首字节约 44.8 秒',
    notes: '当前生产路由；2K/4K 同价，小红书一套按 9 张结算。记账成本区间 ¥0.038–¥0.04+/张（¥0.038 为 65535 现行价下沿，另有 ¥0.04 级通道报价），对账时注意通道差异。',
  }),
  route({
    id: '65535-gpt-5.6-luna', providerId: 'relay_65535', model: 'gpt-5.6-luna', status: 'connected',
    purpose: '识图与方案分析', billingUnit: '输入 / 输出每 100 万 Token', unitPriceText: '¥0.044 / ¥0.264',
    appSkus: ['ec_ai_assistant', 'ec_extension_analysis', 'ec_reverse_prompt', 'ec_canvas_ocr', 'video_plan_analysis', 'ec_direction_refresh'],
    health: '近 4 小时 99.83%，首字节约 5.6 秒', notes: '按 Token 浮动；站内动作采用封顶成本快照，非固定上游单次价。',
  }),
  route({ id: '65535-extension-ecommerce', providerId: 'relay_65535', model: 'gpt-image-2', status: 'connected',
    purpose: '浏览器扩展复刻套装', billingUnit: '每套',
    appSkus: ['ec_extension_basic', 'ec_extension_standard', 'ec_extension_complete'],
    health: '复用生产图片通道', notes: '3/5/9 张套装按等级一次结算。',
  }),
  route({
    id: 'change-nano-flash', providerId: 'change2pro', model: 'gemini-2.5-flash-image', status: 'connected',
    purpose: 'Nano Banana 生图', billingUnit: '每张', unitPriceCny: 0.06,
    appSkus: ['ec_nano_flash_1k', 'ec_nano_flash_2k', 'ec_nano_flash_4k', 'ec_nano_pro_1k', 'ec_nano_pro_2k', 'ec_nano_pro_4k'],
    health: '13 次账户请求均成功；无独立监控', notes: '生产密钥位于特惠组；1K/2K/4K 当前同价。',
  }),
  route({
    id: 'ip233-sd5-fast', providerId: 'ip233', model: 'sd5-seedance-2.0-fast', status: 'connected',
    purpose: 'Seedance 快速成片', billingUnit: '每条（720p）', unitPriceCny: 5.07,
    appSkus: ['video_seedance_fast_short', 'video_seedance_fast_long'],
    health: '同族监控 100%；按条库存不足', notes: 'IP233 按条计费口径 720p ¥5.07/条；失败不应自动重复扣积分。',
  }),
  route({
    id: 'ip233-sd5-standard', providerId: 'ip233', model: 'sd5-seedance-2.0', status: 'connected',
    purpose: 'Seedance 正式交付', billingUnit: '每条（720p；1080p ¥6.37 预留）', unitPriceCny: 5.07,
    appSkus: ['video_seedance_standard_short', 'video_seedance_standard_long'],
    health: '同族监控 100%；按条库存不足', notes: '当前正式交付路由；提交成功不代表最终生成成功。',
  }),
  route({
    id: 'poke-minimax-h3', providerId: 'poke', model: 'minimax-h3-2k', status: 'configured',
    purpose: 'MiniMax H3 2K', billingUnit: '每条', unitPriceCny: 0.76,
    appSkus: ['video_minimax_h3_2k_short', 'video_minimax_h3_2k_long'],
    health: '暂无本账户出账记录',
    notes: '经 poke2api 中转（0.2× 折扣）；成本定案（用户实测确认 1:1）：≈¥0.76/条；未向普通账号开放。',
  }),
  route({ id: '65535-gpt-image-2-eco', providerId: 'relay_65535', model: 'gpt-image-2-eco', purpose: '原生 4K 候选', billingUnit: '每张', unitPriceCny: 0.10, notes: '候选通道，当前未接入。' }),
  route({ id: '65535-gpt-image-2-auto', providerId: 'relay_65535', model: 'gpt-image-2-auto', purpose: '分辨率分级候选', billingUnit: '1K / 2K / 4K 每张', unitPriceText: '¥0.045 / ¥0.065 / ¥0.095', notes: '候选通道，当前未接入。' }),
  route({ id: '65535-gemini-pro-image', providerId: 'relay_65535', model: 'gemini-3-pro-image', purpose: 'Google 图片候选', billingUnit: '每张', unitPriceCny: 0.18, notes: '候选通道，当前未接入。' }),
  route({ id: '65535-gemini-flash-image', providerId: 'relay_65535', model: 'gemini-2.5-flash-image', purpose: 'Google 图片候选', billingUnit: '每张', unitPriceCny: 0.15, notes: '候选通道，当前未接入。' }),
  route({ id: '65535-seedvr2', providerId: 'relay_65535', model: 'seedvr2-7b', purpose: '图片超分候选', billingUnit: '每 1MP', unitPriceCny: 0.006, notes: '候选通道，当前未接入。' }),
  route({ id: '65535-seedance-fast', providerId: 'relay_65535', model: 'seedance-2.0-fast-std', purpose: '视频备用路由', billingUnit: '480P / 720P 每秒', unitPriceText: '¥0.35 / ¥0.50', health: '新路由，样本不足', notes: '建议独立视频密钥后作为备援，避免与图片流量混账。' }),
  route({ id: '65535-seedance-standard', providerId: 'relay_65535', model: 'seedance-2.0-std', purpose: '视频备用路由', billingUnit: '480P / 720P / 1080P 每秒', unitPriceText: '¥0.40 / ¥0.60 / ¥0.95', health: '近 4 小时 100%，平均约 341 秒', notes: '长视频成本明显高于 IP233 按条路由。' }),
  // 65535 seedance-native 类 token/秒路由：站点美元报价一律按 ×1 读（$ 余额与人民币 1:1 已实证，2026-09），
  // 无需再做汇率换算。
  route({ id: '65535-seedance-native', providerId: 'relay_65535', model: 'seedance-2.0-native', purpose: '原生视频候选', billingUnit: '每秒', unitPriceCny: 0.80, notes: '候选通道，当前未接入；65535 报价按 ×1 读（$≈¥ 已实证）。' }),
  route({ id: '65535-seedance-pro', providerId: 'relay_65535', model: 'seedance-2.0-pro', purpose: '高质量视频候选', billingUnit: '每秒', unitPriceCny: 0.80, notes: '候选通道，当前未接入。' }),
  route({ id: '65535-seedance-25-native', providerId: 'relay_65535', model: 'seedance-2.5-native', purpose: 'Seedance 2.5 候选', billingUnit: '每秒', unitPriceCny: 1.20, health: '近 4 小时 100%，平均约 202 秒', notes: '候选通道，当前未接入。' }),
  route({ id: '65535-seedance-25-std', providerId: 'relay_65535', model: 'seedance-2.5-std', purpose: 'Seedance 2.5 候选', billingUnit: '每秒', unitPriceCny: 0.60, health: '近 4 小时 100%，平均约 917 秒', notes: '候选通道，当前未接入。' }),
  route({ id: 'ip233-seedance-20', providerId: 'ip233', model: 'seedance-2.0', purpose: 'Seedance 按条候选', billingUnit: '每条', unitPriceCny: 5.07, health: '监控 100%；库存风险', notes: '未接入。' }),
  route({ id: 'ip233-seedance-20-fast', providerId: 'ip233', model: 'seedance-2.0-fast', purpose: 'Seedance Fast 候选', billingUnit: '每条', unitPriceCny: 3.77, health: '监控 100%；库存风险', notes: '未接入。' }),
  route({ id: 'ip233-seedance-20-mini', providerId: 'ip233', model: 'seedance-2.0-mini', purpose: 'Seedance Mini 候选', billingUnit: '每条', unitPriceCny: 3.12, health: '监控 100%；库存相对可用', notes: '未接入，可作为 IP233 同站降级。' }),
  route({ id: 'ip233-seedance-25-480', providerId: 'ip233', model: 'seedance-2.5-480p', purpose: 'Seedance 2.5 候选', billingUnit: '每秒', unitPriceCny: 0.325, health: '分辨率路由未独立监控', notes: '未接入。' }),
  route({ id: 'ip233-seedance-25-720', providerId: 'ip233', model: 'seedance-2.5-720p', purpose: 'Seedance 2.5 候选', billingUnit: '每秒', unitPriceCny: 0.455, health: '分辨率路由未独立监控', notes: '未接入。' }),
];

function roundMoney(value) {
  return Number((Number(value) || 0).toFixed(6));
}

function actionForSku(sku) {
  const feature = FEATURE_SKUS[sku];
  if (!feature) return null;
  return {
    sku,
    points: Number((feature.units / 1000).toFixed(3)),
    providerCostCny: feature.providerCostCny,
  };
}

export function buildUpstreamCostLedger({ bySku = [], localSettledCostCny = 0 } = {}) {
  const providerLabels = new Map(providers.map(provider => [provider.id, provider.label]));
  const settledBySku = new Map();
  for (const row of bySku) {
    const current = settledBySku.get(row.sku) || { actions: 0, providerCostCny: 0 };
    current.actions += Number(row.actions || 0);
    current.providerCostCny += Number(row.provider_cost_cny || 0);
    settledBySku.set(row.sku, current);
  }

  const enrichedRoutes = routes.map(item => {
    const settled = item.appSkus.reduce((total, sku) => {
      const value = settledBySku.get(sku);
      return {
        actions: total.actions + Number(value?.actions || 0),
        providerCostCny: total.providerCostCny + Number(value?.providerCostCny || 0),
      };
    }, { actions: 0, providerCostCny: 0 });
    return {
      ...item,
      providerLabel: providerLabels.get(item.providerId) || item.providerId,
      appActions: item.appSkus.map(actionForSku).filter(Boolean),
      localSettledActions: settled.actions,
      localSettledCostCny: roundMoney(settled.providerCostCny),
    };
  });

  const enrichedProviders = providers.map(provider => {
    const localAttributedCostCny = roundMoney(enrichedRoutes
      .filter(item => item.providerId === provider.id && item.status !== 'candidate')
      .reduce((total, item) => total + item.localSettledCostCny, 0));
    return {
      ...provider,
      localAttributedCostCny,
      referenceDifferenceCny: roundMoney(provider.reportedSpendCny - localAttributedCostCny),
    };
  });

  return {
    version: UPSTREAM_LEDGER_VERSION,
    verifiedAt: UPSTREAM_VERIFIED_AT,
    currencyPolicy: '三个中转站的美元符号均按人民币 1:1 核算，不做汇率换算。',
    scopeNote: '上游累计扣费是人工核验快照；本地已结算成本随真实 AI 操作实时更新。两者统计起点不同，差额只用于人工对账。',
    localSettledCostCny: roundMoney(localSettledCostCny),
    providerReportedSpendCny: roundMoney(enrichedProviders.reduce((total, item) => total + item.reportedSpendCny, 0)),
    providers: enrichedProviders,
    routes: enrichedRoutes,
  };
}
