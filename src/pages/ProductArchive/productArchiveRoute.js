// 商品档案独立页路由工具：纯函数，跨浏览器/服务端共用。
// 路径：`/product-archives/:profileId`（hash 形式或 history 形式均支持）。
// 设计约束：
// - 必须能被 Node 直接 import 而无 React 依赖（路由契约可被测试直接验证）。
// - profileId 复用服务端 `productProfilePathSegment` 的硬约束：trim 后非空、≤200、控制字符拒绝。
// - 任何路径分隔符（含 `?`、`#`、空白）都视为终止符，避免把后续 query/hash 吃进 id。

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function parseProductArchiveRoute(rawHashOrPath) {
  const raw = text(rawHashOrPath);
  if (!raw) return null;
  // 接受：
  //   `#/product-archives/<id>`（App hash 路由默认）
  //   `/product-archives/<id>`（history 路由）
  //   `https://host/product-archives/<id>` 或 `https://host#/product-archives/<id>`（完整 URL / 分享链接）
  // 终止符为 `?`、`#`、空白、URL 末尾，确保 id 不会吃进 query/hash 后续内容。
  const match = raw.match(/(?:^|[/#])product-archives\/([^/?#\s]+)/i);
  if (!match) return null;
  const id = decodeURIComponent(match[1]);
  if (!id || id.length > 200 || /[\u0000-\u001F\u007F]/.test(id)) return null;
  return id;
}

export function buildProductArchiveUrl(profileId, { origin = '' } = {}) {
  const safeId = encodeURIComponent(text(profileId));
  if (!safeId) return '';
  return `${origin}#/product-archives/${safeId}`;
}
