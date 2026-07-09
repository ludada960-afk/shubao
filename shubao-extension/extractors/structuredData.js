/**
 * JSON-LD 结构化数据提取器（平台无关）
 *
 * 利用电商页面嵌入的 schema.org JSON-LD 结构化数据
 * 提取商品图片和标题。覆盖：淘宝/京东/Amazon/Shopify/1688
 *
 * 这是首选的提取方式，无需维护 DOM 选择器。
 */

export function extractStructuredData() {
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
