// 从粘贴事件提取媒体文件：图片/视频/音频优先走素材上传，而不是留在输入框。
const MEDIA_TYPE_PREFIXES = ['image/', 'video/', 'audio/'];
const MEDIA_EXTENSION = /\.(png|jpe?g|webp|gif|avif|mp4|webm|mov|m4v|mp3|wav|m4a|aac|ogg|flac)$/i;

function isMediaFile(file) {
  const type = String(file?.type || '').toLowerCase();
  if (MEDIA_TYPE_PREFIXES.some(prefix => type.startsWith(prefix))) return true;
  return MEDIA_EXTENSION.test(String(file?.name || '').toLowerCase());
}

function fileKey(file) {
  return [`${file?.name || ''}`, file?.size ?? '', file?.lastModified ?? ''].join('|');
}

export function extractPastedMediaFiles(dataTransfer) {
  if (!dataTransfer) return [];
  const direct = Array.from(dataTransfer.files || []).filter(isMediaFile);
  if (direct.length) return direct;
  // 部分 Windows 输入法/截图工具只通过 items 暴露剪贴板图片。
  const items = Array.from(dataTransfer.items || []);
  const fromItems = [];
  for (const item of items) {
    if (item?.kind !== 'file' || typeof item.getAsFile !== 'function') continue;
    const file = item.getAsFile();
    if (isMediaFile(file)) fromItems.push(file);
  }
  return [...new Map(fromItems.map(file => [fileKey(file), file])).values()];
}
