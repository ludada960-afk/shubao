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

function canOverflow(error) {
  return error?.code === 'PROVIDER_NETWORK_ERROR'
    && error?.retryable === true
    && !String(error?.jobId || '').trim();
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
