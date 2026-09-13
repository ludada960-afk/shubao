function assertAdapter(adapter, label) {
  if (!adapter || typeof adapter.submitEdit !== 'function' || typeof adapter.poll !== 'function' || typeof adapter.pollUntilReady !== 'function') {
    throw new TypeError(`${label} provider adapter is required`);
  }
  return adapter;
}

/* route.provider（模型目录）→ 适配器键（本路由器） */
const PROVIDER_KEYS = Object.freeze({
  'nano-banana': 'nano',
  'advanced-image': 'advanced',
});

function resolveJob(jobId) {
  const value = String(jobId || '').trim();
  if (value.startsWith('nano:')) return { provider: 'nano', jobId: value.slice(5) };
  if (value.startsWith('advanced:')) return { provider: 'advanced', jobId: value.slice(9) };
  if (value.startsWith('image2:')) return { provider: 'image2', jobId: value.slice(7) };
  return { provider: 'image2', jobId: value };
}

function prefix(provider, result) {
  return result && typeof result === 'object' && result.jobId
    ? { ...result, jobId: `${provider}:${result.jobId}` }
    : result;
}

export function createModelProviderRouter({ image2, nanoBanana, advancedImage } = {}) {
  const adapters = { image2: assertAdapter(image2, 'Image2') };
  if (nanoBanana) adapters.nano = assertAdapter(nanoBanana, 'Nano Banana');
  if (advancedImage) adapters.advanced = assertAdapter(advancedImage, 'Advanced image');
  const adapterForRequest = (request) => {
    const key = PROVIDER_KEYS[request?.modelRoute?.provider] || 'image2';
    if (key === 'image2') return { provider: 'image2', adapter: adapters.image2 };
    if (!adapters[key]) {
      /* 面向用户的文案不能露出供应商信息（模型没配置好时引导换模型，不解释内部原因）。 */
      const error = new Error(key === 'nano' ? 'Nano Banana 服务暂未配置，请改用 GPT Image 2' : '这个图片模型暂时不可用，请先换个模型');
      error.code = key === 'nano' ? 'NANO_BANANA_PROVIDER_UNAVAILABLE' : 'ADVANCED_IMAGE_PROVIDER_UNAVAILABLE';
      error.retryable = false;
      throw error;
    }
    return { provider: key, adapter: adapters[key] };
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
