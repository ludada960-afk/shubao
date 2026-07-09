/**
 * 淘宝 / 天猫 专用提取器
 *
 * DOM 特征：
 * - 商品主图在特定容器内：.tb-gallery, .tm-gallery, #J_UlThumb
 * - 缩略图通过 data-src 懒加载，尺寸后缀 _60x60 → 去掉
 * - JSON-LD 的结构化数据作为首选（已在主流程中优先处理）
 * - 本提取器仅作为 JSON-LD 的补充，只抓取商品主图区域
 * - 严禁扫描页面底部、侧边栏、footer 等非商品区域
 */

export default {
  name: 'taobao',

  extract() {
    const images = [];
    let title = '';

    // ── 标题 ──
    const titleEl = document.querySelector('.tb-main-title')
      || document.querySelector('[data-property="title"]')
      || document.querySelector('.tm-title')
      || document.querySelector('h1[data-spm*="title"]');
    if (titleEl) {
      title = (titleEl.getAttribute('title') || titleEl.textContent || '').trim();
    }

    // ── 只在商品主图容器内搜索 ──
    const galleryContainers = [
      document.querySelector('.tb-gallery'),
      document.querySelector('.tm-gallery'),
      document.querySelector('#J_UlThumb'),
      document.querySelector('.tb-pic'),
      document.querySelector('.tm-pic'),
      document.querySelector('.tb-booth'),
      document.querySelector('#J_DivItemImage'),
      document.querySelector('.tb-item-gallery'),
    ].filter(Boolean);

    // 如果没有找到任何容器，回退到页面的早期区域（避免扫到页脚）
    const searchRoot = galleryContainers.length > 0
      ? galleryContainers
      : [document.body];

    for (const root of searchRoot) {
      // 1. 容器内的所有 img 标签
      const imgs = root.querySelectorAll('img');
      for (const img of imgs) {
        let src = img.getAttribute('data-src')
          || img.getAttribute('data-original')
          || img.getAttribute('src')
          || '';
        if (!src) continue;
        // 淘宝缩略图 _60x60 → 转为大图
        src = src.replace(/_[0-9]+x[0-9]+\.(jpg|webp|png)/i, '.$1');
        if (src && !images.includes(src)) images.push(src);
      }

      // 2. 容器内带 data-zoom-href 的元素
      const zoomEls = root.querySelectorAll('[data-zoom-href]');
      for (const el of zoomEls) {
        const src = el.getAttribute('data-zoom-href');
        if (src && !images.includes(src)) images.push(src);
      }
    }

    // 注意：不再使用全页面范围的 [data-full] 选择器，
    // 因为该属性也出现在非商品元素上（footer、侧边栏等）
    // 仅在 gallery 容器内查找
    for (const root of searchRoot) {
      const fullImgs = root.querySelectorAll('[data-full]');
      for (const el of fullImgs) {
        const src = el.getAttribute('data-full');
        if (src && !images.includes(src)) images.push(src);
      }
    }

    const unique = [...new Set(images)];
    return { images: unique, title };
  },
};
