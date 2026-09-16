export const VIDEO_CREATION_MODES = [
  { id: 'smart', label: '智能成片', hint: '一句话起步，素材可选' },
  { id: 'frame', label: '首尾帧', hint: '用两张图锁定镜头起点和终点' },
  { id: 'remake', label: '爆款重构', hint: '保留参考节奏，替换为你的内容' },
];

/* 合法秒数：产品带 durationOptions（上游按秒档位校验）时只认白名单，
   否则退回 [min,max] 整数区间。界面能选的秒数必须与上游接受的秒数一致。 */
export function videoDurationOptions(product) {
  const options = product?.durationOptions;
  if (Array.isArray(options) && options.length) return [...options];
  const min = Number(product?.durations?.min);
  const max = Number(product?.durations?.max);
  if (!Number.isInteger(min) || !Number.isInteger(max)) return [];
  return [min, max];
}

/* 滑块/输入框的取值范围：声明了白名单就按白名单的等间距步长走（5/10/15 → step 5），
   否则沿用 [min,max] 的 1 秒步长。 */
export function videoDurationRange(product) {
  const declared = Array.isArray(product?.durationOptions) && product.durationOptions.length > 0;
  const options = videoDurationOptions(product);
  if (!options.length) return { min: 4, max: 15, step: 1, declared: false, options: [] };
  const gaps = options.slice(1).map((value, index) => value - options[index]).filter(gap => gap > 0);
  const step = declared && gaps.length ? Math.min(...gaps) : 1;
  return { min: options[0], max: options[options.length - 1], step, declared, options };
}

/* 完整合法档位列表（给下拉/选择器用）：声明了白名单就给白名单，
   否则把 [min,max] 展开成整数秒。 */
export function videoDurationChoices(product) {
  if (Array.isArray(product?.durationOptions) && product.durationOptions.length) return [...product.durationOptions];
  const min = Number(product?.durations?.min);
  const max = Number(product?.durations?.max);
  if (!Number.isInteger(min) || !Number.isInteger(max) || max < min) return [5];
  return Array.from({ length: max - min + 1 }, (_, index) => min + index);
}

export function snapVideoDuration(product, seconds) {
  const options = videoDurationOptions(product);
  const value = Number(seconds);
  if (!options.length) return Number.isFinite(value) ? value : 0;
  if (!Number.isFinite(value)) return options[0];
  return options.reduce((best, option) => (Math.abs(option - value) < Math.abs(best - value) ? option : best), options[0]);
}

export function isVideoDurationSupported(product, seconds) {
  const options = videoDurationOptions(product);
  const value = Number(seconds);
  if (!Number.isInteger(value) || !options.length) return false;
  const declared = Array.isArray(product?.durationOptions) && product.durationOptions.length;
  return declared ? options.includes(value) : value >= options[0] && value <= options[options.length - 1];
}

export function quoteForVideoProduct(product, duration) {
  if (!product || typeof product !== 'object') throw new TypeError('视频产品报价需要产品契约');
  const seconds = Number(duration);
  const min = Number(product.durations?.min);
  const max = Number(product.durations?.max);
  if (!isVideoDurationSupported(product, seconds)) {
    const options = videoDurationOptions(product);
    const declared = Array.isArray(product?.durationOptions) && product.durationOptions.length;
    throw new Error(declared ? `视频产品只支持 ${options.join('/')} 秒` : `视频产品支持 ${min} 到 ${max} 秒`);
  }
  const quote = product.quotes?.[seconds <= 8 ? 'short' : 'long'];
  if (!quote) throw new Error('当前视频产品暂无可用报价');
  return quote;
}

export function resolveVideoApiMode(mode, files = {}) {
  if (mode === 'smart') return files.images?.length || files.videos?.length || files.audios?.length ? 'reference' : 'script';
  return mode;
}

export function hasRequiredVideoInputs(mode, files = {}) {
  if (mode === 'frame') return Boolean(files.first?.length && files.last?.length);
  if (mode === 'remake') return Boolean(files.images?.length && files.videos?.length);
  return true;
}
