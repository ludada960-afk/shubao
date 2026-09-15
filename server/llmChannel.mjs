// server/llmChannel.mjs
// ═══════════════════════════════════════════════════════════════════════════
// 「LLM 通道」的解析规则 —— **全仓只有这一份**（index.mjs 与 extensionRoutes.mjs 共用）。
//
// 为什么需要它（2026-09-15，真实事故链）：
//   ① 用户指示去掉已 401 失效的 DeepSeek 配置，于是 .env 里的
//      LLM_API_KEY / LLM_BASE_URL / LLM_MODEL 被删除；
//   ② 但读代码的人会发现：**删掉这三行不是「无害清理」**。删之前
//      `if (LLM_KEY && LLM_BASE)` 是 **true**（指向一个必失败的通道），
//      删之后变成 false —— 两条调用链的行为都会**静默改变**：
//        · callLLMWithVision（extract-link 的视觉风格分析）从「401 后 catch 跳过」
//          变成「未配置后 throw 再 catch 跳过」—— 看起来一样，但**日志与排查路径不同**；
//        · createVideoPlanningTextClient 从「走失效通道」变成「走 MINI 网关」。
//   ③ 更麻烦的是**两台机器的解析结果会不一样**：旧机的 server/.env 里还留着一份
//      LLM_*（与 MINI_* 逐字相同），而新机没有 → 切流后同一个功能行为分裂。
//
// 所以把规则收成一处并显式回退：**LLM_* 缺失时用 MINI_***（项目里真正在用的网关，
// 也是 index.mjs 里 createEcommerceVlmClient 本来就优先选的那条）。
// 这样「去掉失效配置」就不会顺手弄坏一个功能，也不会让两台机器分叉。
// ═══════════════════════════════════════════════════════════════════════════

/** 空白一律视为「未配置」（与视频备用通道 env 的既有约定一致） */
const clean = (value) => (value == null ? '' : String(value)).trim();

/**
 * 解析 LLM 通道。
 * @param {Record<string, string|undefined>} [env]
 * @returns {{ key: string, base: string, model: string, source: 'llm'|'mini'|'none' }}
 */
export const DEFAULT_LLM_MODEL = 'claude-sonnet-4-6';

export function resolveLlmChannel(env = process.env) {
  const e = env || {};
  const llmKey = clean(e.LLM_API_KEY);
  const llmBase = clean(e.LLM_BASE_URL).replace(/\/+$/, '');
  const miniKey = clean(e.MINI_API_KEY);
  const miniBase = clean(e.MINI_BASE_URL).replace(/\/+$/, '');

  /* 键与地址**整组**二选一，不做逐项回退 ——
     逐项回退（key 用 LLM、base 用 MINI）会拼出「甲家的 key + 乙家的地址」，
     那是一条**必然 401** 的组合，比「干脆没有」更难排查。 */
  const useLlm = Boolean(llmKey && llmBase);
  const source = useLlm ? 'llm' : (miniKey && miniBase ? 'mini' : 'none');
  const key = useLlm ? llmKey : miniKey;
  const base = useLlm ? llmBase : miniBase;
  const model = (useLlm ? clean(e.LLM_MODEL) : clean(e.MINI_MODEL)) || DEFAULT_LLM_MODEL;

  return { key, base, model, source };
}
