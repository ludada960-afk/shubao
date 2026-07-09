/**
 * Shopee 提取器（有限支持）
 *
 * 限制说明：
 * - 各站点 (sg/tw/th/ph/my/vn) DOM 结构有差异
 * - 类名高度混淆，大量使用 CSS Modules 的 hash 类名
 * - 图片 URL 有有效期
 * - 建议只做基础提取，配合 JSON-LD 使用
 */

export default {
  name: 'shopee',

  extract() {
    const images = [];
    let title = '';

    // ── 标题 ──
    const titleEl = document.querySelector('[class*="product"] [class*="title"], .attF, [class*="name"]');
    let titleCandidates = [];
    if (titleEl) {
      titleCandidates.push(titleEl.textContent?.trim());
    }
    // 从 meta 取
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle?.content) titleCandidates.push(ogTitle.content);
    title = titleCandidates.filter(Boolean)[0] || document.title;

    // ── 图片 ──
    // 1. 图片轮播中的 img
    const galleryImgs = document.querySelectorAll(
      '[class*="gallery"] img, [class*="image"] img, [class*="picture"] img, .WwzrD img'
    );
    for (const img of galleryImgs) {
      let src = img.getAttribute('src')
        || img.getAttribute('data-src')
        || '';
      if (src && src.startsWith('http')) images.push(src);
    }

    // 2. Shopee 主图区域常见类名（Shopee 有很多 hash 类名但有些关键类名固定）
    const mainImgContainers = document.querySelectorAll('[class*="product"] [class*="image"], .flex[class*="wrap"] img');
    for (const el of mainImgContainers) {
      if (el.tagName === 'IMG') {
        const src = el.getAttribute('src') || '';
        if (src && src.startsWith('http') && !images.includes(src)) images.push(src);
      }
    }

    // 3. OG:image（最安全的方式）
    const ogImg = document.querySelector('meta[property="og:image"]');
    if (ogImg?.content && !images.includes(ogImg.content)) {
      images.unshift(ogImg.content);
    }

    const unique = [...new Set(images)];
    return { images: unique, title };
  },
};
