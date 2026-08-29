// server/components/aiCompliance.mjs
// 4c183cd4 续命 P-F 中文 AI 合规水印 — 薯包独门 2/3
//
// 用户原话 (任务书): "3 强制法律勾选"
//   即: 任何 AI 生成内容 (含孪生体矩阵 / tts / vision / chain) 在面向中国大陆用户出件前,
//   必须显式勾选 3 项中国 AI 合规法律. 这是薯包作为中国大陆电商 AI 工具的硬约束.
//
// 3 项法律:
//   1. 《生成式人工智能服务管理暂行办法》(2023-08-15 施行, 网信办等 7 部门)
//      — AI 生成内容必须标识, 不得生成违法违规内容, 服务提供者需担责
//   2. 《互联网信息服务深度合成管理规定》(2023-01-10 施行, 网信办工信部公安部)
//      — 深度合成内容需显著标识, 不得用于虚假新闻/诈骗, 需建审核机制
//   3. 《人工智能生成合成内容标识办法 (征求意见稿)》(2024-08 公开, 国家网信办)
//      — 显式 + 隐式双重水印, 用户调用时需勾选同意标识, 服务方需保存元数据
//
// evaluateChineseAiCompliance(compliance): 给孪生体 / TTS / 视觉 / 画布前置门
//   compliance 形如 { generative_ai_interim: true, deep_synthesis: true, content_labeling: true }
//   返回 { passed, missing, evaluated }
//
// summarizeChineseAiCompliance(): 给前端展示用, 含 3 项法律名 + 实施日期 + 强制勾选提示

export const CHINESE_AI_COMPLIANCE_LEGALS = Object.freeze([
  {
    key: 'generative_ai_interim',
    fullName: '生成式人工智能服务管理暂行办法',
    authority: '国家互联网信息办公室等七部门',
    effectiveDate: '2023-08-15',
    summary: 'AI 生成内容必须标识; 服务提供者对内容安全担责; 不得生成违法违规内容.',
  },
  {
    key: 'deep_synthesis',
    fullName: '互联网信息服务深度合成管理规定',
    authority: '国家互联网信息办公室 工业和信息化部 公安部',
    effectiveDate: '2023-01-10',
    summary: '深度合成内容需显著标识; 不得用于虚假新闻/诈骗; 服务方需建内容审核机制.',
  },
  {
    key: 'content_labeling',
    fullName: '人工智能生成合成内容标识办法 (征求意见稿)',
    authority: '国家互联网信息办公室',
    effectiveDate: '2024-08 (公开征求意见)',
    summary: '显式 + 隐式双重水印; 用户调用时需勾选同意标识; 服务方需保存生成元数据.',
  },
]);

// 强制勾选对应的中文标签 (用户 UI 展示)
export const CHINESE_AI_COMPLIANCE_LABELS = Object.freeze({
  generative_ai_interim: '我已阅读并同意《生成式人工智能服务管理暂行办法》, 确认 AI 生成内容已显著标识, 不会用于违法违规用途',
  deep_synthesis: '我已阅读并同意《互联网信息服务深度合成管理规定》, 确认深度合成内容已显著标识, 已建立内容审核',
  content_labeling: '我已阅读并同意《人工智能生成合成内容标识办法》, 同意显式 + 隐式双重水印, 同意服务方保存生成元数据',
});

// 校验 compliance 入参, 3 项必须全为 true
export function evaluateChineseAiCompliance(compliance) {
  if (!compliance || typeof compliance !== 'object') {
    return {
      passed: false,
      missing: CHINESE_AI_COMPLIANCE_LEGALS.map(l => l.key),
      evaluated: {},
    };
  }
  const evaluated = {};
  const missing = [];
  for (const legal of CHINESE_AI_COMPLIANCE_LEGALS) {
    const v = compliance[legal.key];
    const ok = v === true || v === 'true' || v === 1 || v === '1';
    evaluated[legal.key] = { value: !!v, passed: ok };
    if (!ok) missing.push(legal.key);
  }
  return {
    passed: missing.length === 0,
    missing,
    evaluated,
  };
}

// 摘要 — 给前端用, 含 3 项法律名 + 强制勾选提示
export function summarizeChineseAiCompliance() {
  return {
    legals: CHINESE_AI_COMPLIANCE_LEGALS.map(l => ({
      key: l.key,
      fullName: l.fullName,
      authority: l.authority,
      effectiveDate: l.effectiveDate,
      summary: l.summary,
      label: CHINESE_AI_COMPLIANCE_LABELS[l.key],
      required: true,
    })),
    note: '中国大陆 AI 服务 3 强制法律勾选; 任一未勾选 = 拒绝出件 (HTTP 451).',
    version: 1,
  };
}
