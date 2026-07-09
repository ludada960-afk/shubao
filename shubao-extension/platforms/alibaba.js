/**
 * 1688 提取器
 *
 * DOM 特征：
 * - 与淘宝同系的 DOM 结构，但有自己的类名前缀
 * - 主图区：div.offer-gallery, div.gallery
 * - 图片懒加载属性：data-src
 * - 高清规则：小图后缀 _310x310 → 去掉
 */

export default {
  name: 'alibaba',

  extract() {
    const images = [];
    let title = '';

    // ── 标题 ──
    const titleEl = document.querySelector('.offer-title')
      || document.querySelector('.title-text')
      || document.querySelector('.detail-title')
      || document.querySelector('[class*="product-title"]')
      || document.querySelector('h1');
    if (titleEl) {
      title = (titleEl.textContent || titleEl.getAttribute('title') || '').trim();
    }

    // ── 主图区 ──
    // 1. 缩略图列表
    const thumbs = document.querySelectorAll('.offer-gallery ul li img, .gallery-thumb img, [class*="gallery"] [class*="thumb"] img');
    for (const img of thumbs) {
      let src = img.getAttribute('data-src') || img.getAttribute('src') || '';
      if (!src) continue;
      // 去掉尺寸后缀
      src = src.replace(/_[0-9]+x[0-9]+\.(jpg|webp|png)/i, '.$1');
      if (src) images.push(src);
    }

    // 2. 主展示图
    const mainImgs = document.querySelectorAll('.offer-gallery .main-img img, .gallery-preview img, .offer-main-pic img');
    for (const img of mainImgs) {
      let src = img.getAttribute('data-src') || img.getAttribute('src') || '';
      src = src.replace(/_[0-9]+x[0-9]+\.(jpg|webp|png)/i, '.$1');
      if (src) images.push(src);
    }

    // 3. 1688 特有的 data-zoom-img
    const zoomImgs = document.querySelectorAll('[data-zoom-img]');
    for (const el of zoomImgs) {
      const src = el.getAttribute('data-zoom-img');
      if (src) images.push(src);
    }

    const unique = [...new Set(images)];
    return { images: unique, title };
  },
};
