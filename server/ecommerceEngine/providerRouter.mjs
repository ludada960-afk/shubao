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
    overflow: assertAdapter(overflow, 'overflow'),
  };
  if (legacy) adapters.legacy = assertAdapter(legacy, 'legacy');
  return {
    async submitEdit(request) {
      try {
        return withRoute('primary', await adapters.primary.submitEdit(request));
      } catch (error) {
        if (!canOverflow(error)) throw error;
        return withRoute('overflow', await adapters.overflow.submitEdit(request));
      }
    },
    async poll(jobId) {
      const resolved = resolveJob(jobId, Boolean(adapters.legacy));
      return withRoute(resolved.route, await adapters[resolved.route].poll(resolved.jobId));
    },
    async pollUntilReady(jobId, options) {
      const resolved = resolveJob(jobId, Boolean(adapters.legacy));
      return withRoute(resolved.route, await adapters[resolved.route].pollUntilReady(resolved.jobId, options));
    },
  };
}
