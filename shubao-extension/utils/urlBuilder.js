/**
 * URL 标准化工具
 */

/**
 * 构建完整 URL
 * 处理相对路径、协议相对路径(//...)
 */
export function buildURL(raw) {
  if (!raw) return '';
  let url = raw.trim();

  // 协议相对路径 → 补全协议
  if (url.startsWith('//')) {
    url = `https:${url}`;
  }

  // 相对路径 → 基于当前页面补全
  if (url.startsWith('/')) {
    url = `${window.location.origin}${url}`;
  }

  // 去掉不需要的图片处理参数（保留原始图）
  // 淘宝的参数裁剪
  url = url.replace(/_[0-9]+x[0-9]+\.jpg/gi, '.jpg');
  url = url.replace(/_[0-9]+x[0-9]+\.webp/gi, '.webp');
  // 京东的参数裁剪
  url = url.replace(/!q[0-9]+/i, '');
  url = url.replace(/!cc_.+/i, '');

  return url;
}

/**
 * 清理不需要的追踪参数
 */
export function cleanTrackingParams(url) {
  try {
    const u = new URL(url);
    const keep = ['src', 'id', 'type', 'fmt'];
    const params = new URLSearchParams(u.search);
    for (const key of params.keys()) {
      if (!keep.includes(key)) params.delete(key);
    }
    u.search = params.toString();
    return u.toString();
  } catch {
    return url;
  }
}

/**
 * 获取图片格式
 */
export function getImageFormat(url) {
  const ext = url.split('?')[0].split('#')[0].split('.').pop()?.toLowerCase();
  if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif', 'bmp'].includes(ext)) {
    return ext;
  }
  return 'unknown';
}
