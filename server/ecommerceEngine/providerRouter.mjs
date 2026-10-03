function assertAdapter(value, label) {
  if (!value || typeof value.submitEdit !== 'function' || typeof value.poll !== 'function' || typeof value.pollUntilReady !== 'function') {
    throw new TypeError(`${label} provider adapter is required`);
  }
  return value;
}

function resolveJob(jobId, hasLegacy) {
  const value = String(jobId || '').trim();
  for (const route of ['primary', 'overflow']) {
    const prefix = `${route}:`;
    if (value.startsWith(prefix)) return { route, jobId: value.slice(prefix.length) };
  }
  return { route: hasLegacy ? 'legacy' : 'primary', jobId: value };
}

function withRoute(route, result) {
  if (!result || typeof result !== 'object') return result;
  if (route === 'legacy') return result;
  return { ...result, jobId: `${route}:${result.jobId}` };
}

/* ═══ 2026-10-04：主通道说「**这个模型我这儿没有**」时也要切兜底 ═════════════════════════════
   生产实测（65535 + `image2-5-sunburst`），两条真实回复：

     · 403  {"message":"group \"任务专用分组\" not authorized for model image2-5-sunburst"}
     · 503  {"detail":"No available channel for model image2-5-sunburst under group default (distributor)"}

   原来 `canOverflow` 只认 `PROVIDER_NETWORK_ERROR`，而上面两条经 providerError 落成
   `PROVIDER_ERROR`（403 甚至 `retryable:false`）⇒ **都不切兜底**，请求直接失败。
   也就是说：把 IP233 接成兜底之后，2.5 这条路**实际上一根手指都没够着** ——
   用户看到的还是"生成不出来"，而我们以为已经修好了。
   （`test/ecommerce-provider-router` 那条 "does not evade provider rate limits" 守的是
     429：**不许**靠换供应商绕过限速。那条意图是对的，403/503 也不是限速，两件事不该混。）

   ⇒ 判据改成"主通道**没有受理**这次请求，原因是它自己**没有这个模型/这个分组没权限**"：
     · 必须**没有 jobId** —— 受理过了就不许二次提交（否则会重复出图、重复扣费）；
     · **429 一律不切** —— 那是限速，绕过它就是那条门禁说的 "evade rate limits"；
     · 匹配「模型不可用 / 分组无权 / 渠道缺失」这几种说法才切。

   ⚠️ 为什么不按 status 一刀切（403/404/503 全放行）：用户自己的问题（400 参数错、
     内容被拒 CONTENT_REJECTED）在备用那边**同样会失败**，切过去只是白跑一趟、
      还多一次上游请求。内容拒单尤其不能切（用户原话：「为什么还要重新花钱呢」）。 */
const MODEL_UNAVAILABLE_HINT = /(no available channel|not authori[sz]ed for model|model[^\n]{0,40}not (?:found|available)|无可用渠道|无权使用该模型|没有可用的渠道)/i;
const RATE_LIMIT_STATUS = new Set([429]);

function providerRefusedToServeThisModel(error) {
  if (RATE_LIMIT_STATUS.has(error?.status)) return false;
  if (error?.code === 'CONTENT_REJECTED') return false;
  const detail = String(error?.message || error?.detail || '');
  return MODEL_UNAVAILABLE_HINT.test(detail);
}

function canOverflow(error) {
  /* 已受理 ⇒ 绝不二次提交（重复出图 + 重复扣费） */
  if (String(error?.jobId || '').trim()) return false;
  if (error?.code === 'PROVIDER_NETWORK_ERROR' && error?.retryable === true) return true;
  return providerRefusedToServeThisModel(error);
}

export function createProviderRouter({ primary, overflow, legacy } = {}) {
  const adapters = {
    primary: assertAdapter(primary, 'primary'),
  };
  if (overflow) adapters.overflow = assertAdapter(overflow, 'overflow');
  if (legacy) adapters.legacy = assertAdapter(legacy, 'legacy');
  return {
    async submitEdit(request) {
      try {
        return withRoute('primary', await adapters.primary.submitEdit(request));
      } catch (error) {
        if (!adapters.overflow || !canOverflow(error)) throw error;
        return withRoute('overflow', await adapters.overflow.submitEdit(request));
      }
    },
    async poll(jobId) {
      const resolved = resolveJob(jobId, Boolean(adapters.legacy));
      if (!adapters[resolved.route]) throw new Error(`${resolved.route} provider adapter is unavailable`);
      return withRoute(resolved.route, await adapters[resolved.route].poll(resolved.jobId));
    },
    async pollUntilReady(jobId, options) {
      const resolved = resolveJob(jobId, Boolean(adapters.legacy));
      if (!adapters[resolved.route]) throw new Error(`${resolved.route} provider adapter is unavailable`);
      return withRoute(resolved.route, await adapters[resolved.route].pollUntilReady(resolved.jobId, options));
    },
    /* 9-12 同模型换供应商：主通道「任务跑失败」时用**同一请求、同一模型**改提交到备用供应商。
       与 submitEdit 里的 canOverflow 不同 —— 那条只覆盖「提交就失败」，覆盖不到「提交成功但任务失败」。
       调用方负责保证只切一次（备用 jobId 带 overflow: 前缀，见 resolveJob）。 */
    hasOverflow: Boolean(adapters.overflow),
    async failover(request) {
      if (!adapters.overflow) return null;
      return withRoute('overflow', await adapters.overflow.submitEdit(request));
    },
  };
}
