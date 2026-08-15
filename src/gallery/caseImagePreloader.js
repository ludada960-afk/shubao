export function createCaseImagePreloader({ loadImage, concurrency = 2 } = {}) {
  if (typeof loadImage !== 'function') throw new Error('loadImage must be a function');
  const limit = Math.max(1, Math.floor(Number(concurrency) || 1));
  const cache = new Map();
  let generation = 0;

  const cachedLoad = url => {
    if (cache.has(url)) return cache.get(url);
    const request = Promise.resolve()
      .then(() => loadImage(url))
      .catch(error => {
        cache.delete(url);
        throw error;
      });
    cache.set(url, request);
    return request;
  };

  return {
    async preload(urls = [], activeIndex = 0) {
      const ownGeneration = ++generation;
      const source = Array.isArray(urls) ? urls.filter(Boolean) : [];
      if (source.length === 0) return [];

      const normalizedIndex = Math.max(0, Math.min(source.length - 1, Number(activeIndex) || 0));
      const ordered = [
        source[normalizedIndex],
        source[(normalizedIndex + 1) % source.length],
        ...source,
      ].filter((url, index, all) => url && all.indexOf(url) === index);
      let cursor = 0;
      const loaded = [];

      const worker = async () => {
        while (ownGeneration === generation && cursor < ordered.length) {
          const url = ordered[cursor];
          cursor += 1;
          try {
            loaded.push(await cachedLoad(url));
          } catch {
            loaded.push(undefined);
          }
        }
      };

      await Promise.all(Array.from({ length: Math.min(limit, ordered.length) }, worker));
      return loaded;
    },
    cancel() {
      generation += 1;
    },
  };
}
