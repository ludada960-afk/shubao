/**
 * Amazon 提取器
 *
 * DOM 特征：
 * - 所有 Amazon 站点共享同一套模板（全球统一）
 * - 主图区：div#imgTagWrapperId, ul#altImages
 * - 图片属性：data-a-dynamic-image（JSON 格式，包含图片URL → 尺寸映射）
 * - JSON-LD 结构化数据非常完整（首选）
 * - 高清图 URL：把 _SL1500_ 、_SY355_ 等去掉就是原图
 */

export default {
  name: 'amazon',

  extract() {
    const images = [];
    let title = '';

    // ── 标题 ──
    const titleEl = document.querySelector('#productTitle')
      || document.querySelector('[class*="product-title"]')
      || document.querySelector('h1[data-automation*="title"]');
    if (titleEl) {
      title = (titleEl.textContent || '').trim();
    }

    // ── 主图 ──
    // 1. data-a-dynamic-image（Amazon 核心图片数据结构）
    const dynamicContainers = document.querySelectorAll('[data-a-dynamic-image]');
    for (const container of dynamicContainers) {
      try {
        const raw = container.getAttribute('data-a-dynamic-image');
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        // parsed 是一个对象 { url: [width, height], ... }
        for (const url of Object.keys(parsed)) {
          // 去掉 Amazon 图片的尺寸后缀
          const clean = url.replace(/\._([A-Z]{2}[0-9]+_)+\.[a-z]+/i, (match) => {
            // 保留原扩展名
            const ext = url.split('.').pop();
            return `.${ext}`;
          });
          images.push(clean);
        }
      } catch { /* skip */ }
    }

    // 2. 主图 img 标签回退
    const mainImgs = document.querySelectorAll('#landingImage, #imgTagWrapperId img, #main-image');
    for (const img of mainImgs) {
      const src = img.getAttribute('data-old-hires')
        || img.getAttribute('src')
        || img.getAttribute('data-src')
        || '';
      if (src && !images.includes(src)) images.push(src);
    }

    // 3. 替代角度图（altImages）
    const altImgs = document.querySelectorAll('#altImages img, [class*="thumbnail"] img');
    for (const img of altImgs) {
      const src = img.getAttribute('src')
        || img.getAttribute('data-src')
        || '';
      if (src && /amazon/.test(src) && !images.includes(src)) {
        images.push(src);
      }
    }

    // 清理尺寸后缀
    const cleaned = images.map(url => url.replace(/\._([A-Z]{2}[0-9]+_)+\.[a-z]+/i, (m) => {
      const ext = url.split('?')[0].split('.').pop();
      return `.${ext}`;
    }));

    const unique = [...new Set(cleaned)];
    return { images: unique, title };
  },
};
