/**
 * Shopify 独立站通用提取器
 *
 * 虽然每个品牌站视觉设计不同，但底层 Shopify 框架的 DOM 结构是统一的：
 * - 模板变量：product.images, product.title（通过 JSON 注入页面的 <script>）
 * - data-media-gallery, data-product-images
 * - 标准 JSON-LD（几乎所有 Shopify 店都有）
 */

export default {
  name: 'shopify',

  extract() {
    const images = [];
    let title = '';

    // ── 方法1：读取 Shopify 产品 JSON 注入（最可靠） ──
    const productDataScript = document.querySelector('script[data-product-json]')
      || document.querySelector('[type="application/json"][data-product-json]');
    if (productDataScript) {
      try {
        const data = JSON.parse(productDataScript.textContent || productDataScript.innerHTML);
        const product = data.product || data;
        title = title || product.title || '';
        if (product.images && Array.isArray(product.images)) {
          for (const img of product.images) {
            const src = typeof img === 'string' ? img : (img.src || img.originalSrc || '');
            if (src) images.push(src);
          }
        }
        if (images.length > 0) return { images: [...new Set(images)], title };
      } catch { /* fall through */ }
    }

    // ── 方法2：product-media-gallery ──
    const galleryImgs = document.querySelectorAll(
      '[data-product-gallery] img, [data-product-media] img, .product-gallery img, .product-media img'
    );
    for (const img of galleryImgs) {
      let src = img.getAttribute('data-src')
        || img.getAttribute('data-zoom-src')
        || img.getAttribute('data-highres')
        || img.getAttribute('srcset')?.split(' ')[0]
        || img.getAttribute('src')
        || '';
      if (src && src.startsWith('http')) images.push(src);
    }

    // ── 方法3：所有 Shopify CDN 图片 ──
    const shopifyImgs = document.querySelectorAll('img[src*="cdn.shopify.com"]');
    for (const img of shopifyImgs) {
      let src = img.getAttribute('data-src') || img.getAttribute('src') || '';
      if (src) {
        // 去掉 Shopify 尺寸参数：_100x100, _200x200 等
        src = src.replace(/_[0-9]+x[0-9]+(\.[a-z]+)/i, '$1');
        if (!images.includes(src)) images.push(src);
      }
    }

    // ── 标题 ──
    if (!title) {
      const h1 = document.querySelector('h1[class*="product"], .product-title, [class*="product"] [class*="title"] h1');
      if (h1) title = h1.textContent?.trim() || '';
    }

    return { images: [...new Set(images)], title };
  },
};
