function assertAdapter(adapter, label) {
  if (!adapter || typeof adapter.submitEdit !== 'function' || typeof adapter.poll !== 'function' || typeof adapter.pollUntilReady !== 'function') {
    throw new TypeError(`${label} provider adapter is required`);
  }
  return adapter;
}

function resolveJob(jobId) {
  const value = String(jobId || '').trim();
  if (value.startsWith('nano:')) return { provider: 'nano', jobId: value.slice(5) };
  if (value.startsWith('image2:')) return { provider: 'image2', jobId: value.slice(7) };
  return { provider: 'image2', jobId: value };
}

function prefix(provider, result) {
  return result && typeof result === 'object' && result.jobId
    ? { ...result, jobId: `${provider}:${result.jobId}` }
    : result;
}

export function createModelProviderRouter({ image2, nanoBanana } = {}) {
  const adapters = { image2: assertAdapter(image2, 'Image2') };
  if (nanoBanana) adapters.nano = assertAdapter(nanoBanana, 'Nano Banana');
  const adapterForRequest = (request) => {
    if (request?.modelRoute?.provider !== 'nano-banana') return { provider: 'image2', adapter: adapters.image2 };
    if (!adapters.nano) {
      const error = new Error('Nano Banana 服务暂未配置，请改用 GPT Image 2');
      error.code = 'NANO_BANANA_PROVIDER_UNAVAILABLE';
      error.retryable = false;
      throw error;
    }
    return { provider: 'nano', adapter: adapters.nano };
  };
  return {
    async submitEdit(request) {
      const route = adapterForRequest(request);
      return prefix(route.provider, await route.adapter.submitEdit(request));
    },
    async poll(jobId) {
      const route = resolveJob(jobId);
      if (!adapters[route.provider]) throw new Error(`${route.provider} provider adapter is unavailable`);
      return prefix(route.provider, await adapters[route.provider].poll(route.jobId));
    },
    async pollUntilReady(jobId, options) {
      const route = resolveJob(jobId);
      if (!adapters[route.provider]) throw new Error(`${route.provider} provider adapter is unavailable`);
      return prefix(route.provider, await adapters[route.provider].pollUntilReady(route.jobId, options));
    },
  };
}
