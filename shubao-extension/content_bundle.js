try {
console.log("[shubao] content script injected");
// === Bundle: 2026-07-02T07:56:42.416Z ===
// === utils/imageFilter.js ===
/**
 * 图片过滤工具
 *
 * 去重、剔除水印/广告/图标、尺寸过滤
 * 严格按照「只保留商品主图/细节图/场景图」原则
 */

function imageFilter(urls) {
  if (!urls || !urls.length) return [];

  const seen = new Set();
  const result = [];

  for (const url of urls) {
    if (!url || typeof url !== 'string') continue;

    const clean = url.trim().split('?')[0].split('#')[0];

    // 去重
    if (seen.has(clean)) continue;
    seen.add(clean);

    // 只接受 http/https
    if (!clean.startsWith('http://') && !clean.startsWith('https://')) continue;

    // ── 跳过非商品图片 ──
    const lower = clean.toLowerCase();
    const skipPatterns = [
      // 广告/图标/logo
      '/icon/', '/logo/', '/banner/', '/badge/', '/watermark/',
      'icon.', 'logo.', 'badge.', 'sprite.',
      'favicon', 'transparent',
      // 认证/资质/法律相关
      'license', 'certificate', 'credential', 'legal',
      'business', 'zhizhao', 'yyzz',  // 营业执照
      'report', 'jubao',              // 举报
      'complain', 'rights', 'law',
      'register', 'icp', 'beian',
      // 页脚/店铺信息
      'footer', 'foot-', '-foot',
      'shop-info', 'shopinfo',
      'copyright',
      // 二维码/条形码
      'qrcode', 'qr_code', 'erweima',
      'barcode', 'barcode',
      // 用户头像/评价
      'avatar', 'user-pic', 'user_face',
      'rate', 'review', 'comment',
      // 推荐/相关商品（非当前商品）
      'recommend', 'relate', 'similar',
      'suggest', 'hot-', '/hot_',
      // 尺寸图标/按钮装饰
      'size-guide', 'size_chart',
      'return-', '售后',
      'service', 'guarantee',
    ];
    if (skipPatterns.some(p => lower.includes(p))) continue;

    // 限制总图片数不超过 30 张
    if (result.length >= 30) break;

    result.push(clean);
  }

  return result;
}

/**
 * 检测图片是否为水印/图标（基于文件名）
 */
function isJunkImage(url) {
  if (!url) return true;
  const lower = url.toLowerCase();
  const junk = [
    '/watermark', 'watermark.', 'shuiyin', 'sy.',
    '/icon', 'icon_', '_icon',
    '/logo', 'logo.',
    'sprite.', 'sprite_',
    'banner_', '/banner/',
    'placeholder', 'loading.',
    'pixel.', 'tracker.', 'beacon.',
    'avatar', 'head_',
    'qr_code', 'erweima', 'qrcode',
    'recommend',
  ];
  return junk.some(j => lower.includes(j));
}


// === utils/urlBuilder.js ===
/**
 * URL 标准化工具
 */

/**
 * 构建完整 URL
 * 处理相对路径、协议相对路径(//...)
 */
function buildURL(raw) {
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
function cleanTrackingParams(url) {
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
function getImageFormat(url) {
  const ext = url.split('?')[0].split('#')[0].split('.').pop()?.toLowerCase();
  if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif', 'bmp'].includes(ext)) {
    return ext;
  }
  return 'unknown';
}


// === extractors/structuredData.js ===
/**
 * JSON-LD 结构化数据提取器（平台无关）
 *
 * 利用电商页面嵌入的 schema.org JSON-LD 结构化数据
 * 提取商品图片和标题。覆盖：淘宝/京东/Amazon/Shopify/1688
 *
 * 这是首选的提取方式，无需维护 DOM 选择器。
 */

function extractStructuredData() {
  const images = [];
  let title = '';

  // 查找所有 JSON-LD script 标签
  const scripts = document.querySelectorAll('script[type="application/ld+json"]');
  if (!scripts.length) return { images, title };

  for (const script of scripts) {
    try {
      const data = JSON.parse(script.textContent);
      const product = findProduct(data);
      if (!product) continue;

      // 提取商品标题
      if (!title && product.name) {
        title = product.name;
      }

      // 提取图片 —— schema.org image 可以是 string | string[]
      const imgs = extractImages(product);
      if (imgs.length) {
        images.push(...imgs);
      }

    } catch {
      // 个别 JSON-LD 片段格式不对不影响整体
      continue;
    }
  }

  // 去重
  const unique = [...new Set(images)];
  return { images: unique, title };
}

/* ── 递归查找 Product 类型 ── */
function findProduct(data) {
  if (!data || typeof data !== 'object') return null;

  // 直接命中
  if (data['@type'] === 'Product' || data['@type'] === 'ProductGroup') {
    return data;
  }

  // 嵌套在 @graph 中
  if (data['@graph'] && Array.isArray(data['@graph'])) {
    for (const item of data['@graph']) {
      const found = findProduct(item);
      if (found) return found;
    }
  }

  // mainEntity
  if (data.mainEntity) {
    const found = findProduct(data.mainEntity);
    if (found) return found;
  }

  return null;
}

/* ── 从 Product 节点提取所有图片 URL ── */
function extractImages(product) {
  const urls = [];
  const image = product.image;

  if (!image) return urls;

  // string → 单张
  if (typeof image === 'string') {
    urls.push(image);
  }
  // string[]
  else if (Array.isArray(image)) {
    for (const img of image) {
      if (typeof img === 'string') urls.push(img);
      // 也可能是 ImageObject
      else if (img?.['@type'] === 'ImageObject' && img.contentUrl) {
        urls.push(img.contentUrl);
      }
    }
  }
  // ImageObject
  else if (image['@type'] === 'ImageObject' && image.contentUrl) {
    urls.push(image.contentUrl);
  }

  return urls;
}


// === extractors/genericDOM.js ===
/**
 * 通用 DOM 启发式提取器（平台无关，回退方案）
 *
 * 只在 JSON-LD 和平台提取器都失败时才启用。
 * 限定在页面头部区域，避免扫描到页脚/侧边栏。
 * 只返回最可能是商品主图的图片。
 */

function extractGenericDOM() {
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


// === Platform registry ===
const PLATFORM_EXTRACTORS = {};

// === platforms/taobao.js ===
PLATFORM_EXTRACTORS["taobao"] = (function() {
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

return {
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
})();

// === platforms/jd.js ===
PLATFORM_EXTRACTORS["jd"] = (function() {
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

return {
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
})();

// === platforms/amazon.js ===
PLATFORM_EXTRACTORS["amazon"] = (function() {
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

return {
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
})();

// === platforms/shopify.js ===
PLATFORM_EXTRACTORS["shopify"] = (function() {
/**
 * Shopify 独立站通用提取器
 *
 * 虽然每个品牌站视觉设计不同，但底层 Shopify 框架的 DOM 结构是统一的：
 * - 模板变量：product.images, product.title（通过 JSON 注入页面的 <script>）
 * - data-media-gallery, data-product-images
 * - 标准 JSON-LD（几乎所有 Shopify 店都有）
 */

return {
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
})();

// === platforms/alibaba.js ===
PLATFORM_EXTRACTORS["alibaba"] = (function() {
/**
 * 1688 提取器
 *
 * DOM 特征：
 * - 与淘宝同系的 DOM 结构，但有自己的类名前缀
 * - 主图区：div.offer-gallery, div.gallery
 * - 图片懒加载属性：data-src
 * - 高清规则：小图后缀 _310x310 → 去掉
 */

return {
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
})();

// === platforms/pdd.js ===
PLATFORM_EXTRACTORS["pdd"] = (function() {
/**
 * 拼多多 提取器（有限支持）
 *
 * 限制说明：
 * - 拼多多大量使用 canvas/WebGL 渲染图片，无法从 DOM 中提取原始 URL
 * - 本提取器只能提取到缩略图列表中的图片
 * - 部分图片 CDN (pddpic.com) 有 token 时效性，后端下载可能失败
 * - 建议告知用户"拼多多因技术限制，仅能提取部分图片"
 */

return {
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
})();

// === platforms/shopee.js ===
PLATFORM_EXTRACTORS["shopee"] = (function() {
/**
 * Shopee 提取器（有限支持）
 *
 * 限制说明：
 * - 各站点 (sg/tw/th/ph/my/vn) DOM 结构有差异
 * - 类名高度混淆，大量使用 CSS Modules 的 hash 类名
 * - 图片 URL 有有效期
 * - 建议只做基础提取，配合 JSON-LD 使用
 */

return {
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
})();


/**
 * 薯包AI · Content Script
 *
 * 注入到所有电商页面的主脚本。
 * 职责：接收 popup 指令 → 检测平台 → 执行提取 → 返回结果
 */

(() => {
  'use strict';

  let loaded = false;

  /* ── 平台检测 ── */
  function detectPlatform() {
    const host = window.location.hostname;

    if (/taobao\.com|tmall\.com/.test(host))  return 'taobao';
    if (/1688\.com/.test(host))               return 'alibaba';
    if (/jd\.com/.test(host))                 return 'jd';
    if (/amazon\./.test(host))                return 'amazon';
    if (/myshopify\.com/.test(host))          return 'shopify';
    if (/shopify\.com/.test(host))            return 'shopify';
    if (/pinduoduo\.com|yangkeduo\.com/.test(host)) return 'pdd';
    if (/shopee\./.test(host))                return 'shopee';

    return 'unknown';
  }

  /* ── 加载提取器模块 ── */
  
  /* ── 加载平台专用提取器（如果有） ── */
  
  /* ── 主提取流程 ── */
  async function extract() {
    const platform = detectPlatform();

    // Step 1: JSON-LD 结构化数据提取（最可靠）
    let result = extractStructuredData();
    let images = result.images || [];
    let title = result.title || '';

    // Step 2: 如果 JSON-LD 图不够，补平台专用提取器
    if ((!images || images.length < 3) && PLATFORM_EXTRACTORS[platform]) {
      try {
        const r = PLATFORM_EXTRACTORS[platform].extract();
        if (r.images?.length) {
          // 只合并新图，不覆盖已有图
          const combined = [...new Set([...images, ...r.images])];
          if (combined.length > images.length) images = combined;
        }
        title = title || r.title || '';
      } catch(e) { console.warn('[shubao] platform error:', e); }
    }

    // Step 3: 图还是太少才走通用 DOM（回退方案）
    if (!images || images.length < 3) {
      try {
        const domResult = extractGenericDOM();
        if (domResult.images?.length) {
          images = [...new Set([...images, ...domResult.images])];
        }
        title = title || domResult.title || '';
      } catch(e) { console.warn('[shubao] DOM error:', e); }
    }

    if (!images || images.length === 0) {
      return { images: [], title: '', platform, ratios: [] };
    }

    // Step 4: 过滤 + URL 标准化
    const uniqueURLs = imageFilter(images);
    const fullURLs = uniqueURLs.map(u => buildURL(u));

    // Step 5: 只保留前 20 张（不要页脚垃圾图）
    const topImages = fullURLs.slice(0, 20);

    return {
      images: topImages,
      title: title || document.title.replace(/[_-]淘宝|京东|Amazon|天猫/g, '').trim(),
      platform,
      ratios: [],
    };
  }

  /* ── 消息监听 ── */
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'extract') {
      extract().then(sendResponse).catch(err => {
        sendResponse({ images: [], title: '', platform: 'unknown', error: err.message });
      });
      return true; // 保持通道打开
    }
  });

  loaded = true;
})();

} catch(e) {
console.error("[shubao] FATAL:", e.message, e.stack);
}