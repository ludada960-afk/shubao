/**
 * 京东 专用提取器
 *
 * DOM 特征：
 * - 主图区：div.spec-items, ul.img-list, li img
 * - 图片属性：data-lazy-img, data-origin
 * - 高清版本：将 /s54x54_ 替换为 /n0_ 或 /r0_
 * - JDE (京东国际) 有独立的 DOM 结构
 * - 京东图片 URL：img*.360buyimg.com
 */

export default {
  name: 'jd',

  extract() {
    const images = [];
    let title = '';

    // ── 标题 ──
    const titleEl = document.querySelector('.sku-name')
      || document.querySelector('.itemInfo-wrap .sku-name')
      || document.querySelector('.product-name')
      || document.querySelector('[class*="product-name"]')
      || document.querySelector('h1');

    if (titleEl) {
      title = (titleEl.textContent || '').trim();
    }

    // ── 主图区 ──
    // 1. 缩略图列表
    const thumbs = document.querySelectorAll('.spec-items img, .spec-list img, .lh li img, [class*="thumb"] img');
    for (const img of thumbs) {
      let src = img.getAttribute('data-lazy-img')
        || img.getAttribute('data-origin')
        || img.getAttribute('data-original')
        || img.getAttribute('src')
        || '';

      if (!src) continue;
      // 京东缩略图 /s54x54_ → 转为大图 /n0_
      src = src.replace(/\/s[0-9]+x[0-9]+_/i, '/n0_');
      src = src.replace(/!q[0-9]+.*$/i, '');
      src = src.replace(/!cc_.*$/i, '');

      if (src) images.push(src);
    }

    // 2. 主展示图
    const mainImgs = document.querySelectorAll('.preview img, .pic img, #spec-img, [class*="preview"] img');
    for (const img of mainImgs) {
      let src = img.getAttribute('data-origin')
        || img.getAttribute('data-lazy-img')
        || img.getAttribute('src')
        || '';
      if (!src) continue;
      src = src.replace(/\/s[0-9]+x[0-9]+_/i, '/n0_');
      if (src) images.push(src);
    }

    // 3. 详情区域大图
    const detailImgs = document.querySelectorAll('.detail-content img, .product-detail img, .parameter img');
    for (const img of detailImgs) {
      let src = img.getAttribute('data-lazy-img')
        || img.getAttribute('data-original')
        || img.getAttribute('src')
        || '';
      if (src && /img\d*\.360buyimg\.com/.test(src)) {
        images.push(src);
      }
    }

    // 4. 特色功能：京东图册 modal
    const modalImgs = document.querySelectorAll('.spec-items-backup img, [class*="gallery"] img[data-url]');
    for (const img of modalImgs) {
      const src = img.getAttribute('data-url');
      if (src) images.push(src);
    }

    const unique = [...new Set(images)];
    return { images: unique, title };
  },
};
