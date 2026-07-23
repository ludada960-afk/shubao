/**
 * 进程级图片生成限流器。
 *
 * 外部图片模型比 Web 请求昂贵得多；将所有调用放入同一个有限队列，
 * 能避免两个用户各自开一组并发后把 Node 内存、上游额度和 socket 一起耗尽。
 */
export function createImageGenerationPool({ concurrency = 3, maxQueue = 24 } = {}) {
  let active = 0;
  const queue = [];

  function drain() {
    while (active < concurrency && queue.length) {
      const item = queue.shift();
      active += 1;
      Promise.resolve()
        .then(item.task)
        .then(item.resolve, item.reject)
        .finally(() => {
          active -= 1;
          drain();
        });
    }
  }

  return {
    run(task) {
      if (typeof task !== 'function') return Promise.reject(new TypeError('Image task must be a function'));
      if (queue.length >= maxQueue) return Promise.reject(new Error('Image generation service is busy, please retry shortly'));
      return new Promise((resolve, reject) => {
        queue.push({ task, resolve, reject });
        drain();
      });
    },
    stats() {
      return { active, queued: queue.length, concurrency, maxQueue };
    },
  };
}

export const imageGenerationPool = createImageGenerationPool({
  concurrency: Number(process.env.IMAGE_GENERATION_CONCURRENCY || 3),
  maxQueue: Number(process.env.IMAGE_GENERATION_MAX_QUEUE || 24),
});
