/**
 * 拼多多 提取器（有限支持）
 *
 * 限制说明：
 * - 拼多多大量使用 canvas/WebGL 渲染图片，无法从 DOM 中提取原始 URL
 * - 本提取器只能提取到缩略图列表中的图片
 * - 部分图片 CDN (pddpic.com) 有 token 时效性，后端下载可能失败
 * - 建议告知用户"拼多多因技术限制，仅能提取部分图片"
 */

export default {
  name: 'pdd',

  extract() {
    const images = [];
    let title = '';

    // ── 标题 ──
    const titleEl = document.querySelector('title');
    if (titleEl) {
      title = (titleEl.textContent || '').trim();
    }

    // ── 图片提取 ──
    // 拼多多的图片通常在缩略图轮播里，通过背景图或小图展示

    // 1. 轮播图列表中的 img 标签
    const carouselImgs = document.querySelectorAll(
      '.goods-carousel img, [class*="carousel"] img, [class*="gallery"] img, [class*="swiper"] img'
    );
    for (const img of carouselImgs) {
      let src = img.getAttribute('data-src')
        || img.getAttribute('src')
        || '';
      if (src) images.push(src);
    }

    // 2. 背景图中的图片 URL（拼多多常把图片作为背景图显示）
    const bgEls = document.querySelectorAll('[style*="background-image"]');
    for (const el of bgEls) {
      const style = el.getAttribute('style') || '';
      const match = style.match(/url\(['"]?(https?:\/\/[^'")\s]+)['"]?\)/);
      if (match) {
        const url = match[1];
        // 只取 pddpic.com 域名的图片
        if (url.includes('pddpic.com') || url.includes('pinduoduo')) {
          images.push(url);
        }
      }
    }

    // 3. 尝试从全局数据中提取（拼多多有时会在 script 中注入 JSON）
    const scripts = document.querySelectorAll('script');
    for (const script of scripts) {
      const text = script.textContent || '';
      if (!text.includes('gallery') && !text.includes('goods_id')) continue;

      // 尝试匹配 JSON 对象中的图片 URL
      const matches = text.match(/https?:\/\/[^'"\s]*(?:pddpic\.com|pinduoduo)[^'"\s]*(?:\.jpg|\.png|\.webp)/g);
      if (matches) {
        images.push(...matches);
      }
    }

    const unique = [...new Set(images)];
    return { images: unique, title };
  },
};
