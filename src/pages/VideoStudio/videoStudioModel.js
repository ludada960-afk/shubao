export const VIDEO_CREATION_MODES = [
  { id: 'smart', label: '智能成片', hint: '一句话起步，素材可选' },
  { id: 'frame', label: '首尾帧', hint: '用两张图锁定镜头起点和终点' },
  { id: 'remake', label: '爆款重构', hint: '保留参考节奏，替换为你的内容' },
];

export function resolveVideoApiMode(mode, files = {}) {
  if (mode === 'smart') return files.images?.length ? 'reference' : 'script';
  return mode;
}

export function hasRequiredVideoInputs(mode, files = {}) {
  if (mode === 'frame') return Boolean(files.first?.length && files.last?.length);
  if (mode === 'remake') return Boolean(files.images?.length && files.videos?.length);
  return true;
}
