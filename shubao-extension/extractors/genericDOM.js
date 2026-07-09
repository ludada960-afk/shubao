/**
 * 通用 DOM 启发式提取器（平台无关，回退方案）
 *
 * 只在 JSON-LD 和平台提取器都失败时才启用。
 * 限定在页面头部区域，避免扫描到页脚/侧边栏。
 * 只返回最可能是商品主图的图片。
 */

export function extractGenericDOM() {
  const images = [];
  let title = '';

  // ── 标题 ──
  const titleSelectors = [
    'meta[property="og:title"]',
    'meta[name="twitter:title"]',
    'h1',
    '.product-title',
    '[class*="product"] [class*="title"]',
    '[class*="product"] [class*="name"]',
  ];
  for (const sel of titleSelectors) {
    const el = document.querySelector(sel);
    if (el) {
      title = el.getAttribute?.('content') || el.textContent?.trim() || '';
      if (title) break;
    }
  }

  // ── OG Image 主图（唯一最可靠的图片） ──
  const ogImg = document.querySelector('meta[property="og:image"]');
  if (ogImg?.content) {
    images.push(ogImg.content);
  }

  // ── 只在页面顶部 40% 区域搜索 img（避免页脚/侧边栏的垃圾图） ──
  // 商品详情页的图片通常集中在页面顶部的主图区域
  const allImgs = document.querySelectorAll('img');
  const viewportHeight = window.innerHeight || 1000;
  const candidates = [];

  for (const img of allImgs) {
    // 只处理在页面顶部的图片
    const rect = img.getBoundingClientRect?.();
    if (rect && rect.top > viewportHeight * 0.6) continue; // 跳过页面底部 60% 区域

    // 优先取懒加载属性
    const src = img.getAttribute('data-src')
      || img.getAttribute('data-original')
      || img.getAttribute('data-lazy-src')
      || img.getAttribute('srcset')?.split(' ')[0]
      || img.src
      || '';

    if (!src || src.startsWith('data:')) continue;

    // 跳过小图
    const w = img.naturalWidth || img.width || parseInt(img.getAttribute('width') || '0');
    const h = img.naturalHeight || img.height || parseInt(img.getAttribute('height') || '0');
    if (w > 0 && w < 250 && h > 0 && h < 250) continue;

    // 跳过明显是图标/logo/头像的
    const cls = (img.className || '').toLowerCase();
    const alt = (img.alt || '').toLowerCase();
    if (/icon|logo|avatar|banner|qr|code|footer|shop|rate|comment|review/.test(cls + alt)) continue;

    candidates.push({ src, w, h });
  }

  // 按尺寸从大到小排序
  candidates.sort((a, b) => (b.w * b.h) - (a.w * a.h));

  // 取前 15 张（严格控制数量）
  for (const c of candidates.slice(0, 15)) {
    images.push(c.src);
  }

  return { images: [...new Set(images)], title };
}
