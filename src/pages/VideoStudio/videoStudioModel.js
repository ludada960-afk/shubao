export const VIDEO_CREATION_MODES = [
  { id: 'smart', label: '智能成片', hint: '一句话起步，素材可选' },
  { id: 'frame', label: '首尾帧', hint: '用两张图锁定镜头起点和终点' },
  { id: 'remake', label: '爆款重构', hint: '保留参考节奏，替换为你的内容' },
];

export function quoteForVideoProduct(product, duration) {
  if (!product || typeof product !== 'object') throw new TypeError('视频产品报价需要产品契约');
  const seconds = Number(duration);
  const min = Number(product.durations?.min);
  const max = Number(product.durations?.max);
  if (!Number.isInteger(seconds) || !Number.isInteger(min) || !Number.isInteger(max) || seconds < min || seconds > max) {
    throw new Error(`视频产品支持 ${min} 到 ${max} 秒`);
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
