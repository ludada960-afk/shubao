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
  async function loadExtractors() {
    const base = chrome.runtime.getURL('');

    const [
      { extractStructuredData },
      { extractGenericDOM },
      { imageFilter },
      { buildURL },
    ] = await Promise.all([
      import(`${base}extractors/structuredData.js`),
      import(`${base}extractors/genericDOM.js`),
      import(`${base}utils/imageFilter.js`),
      import(`${base}utils/urlBuilder.js`),
    ]);

    return { extractStructuredData, extractGenericDOM, imageFilter, buildURL };
  }

  /* ── 加载平台专用提取器（如果有） ── */
  async function loadPlatformExtractor(platform) {
    try {
      const base = chrome.runtime.getURL('');
      const mod = await import(`${base}platforms/${platform}.js`);
      return mod.default || mod;
    } catch {
      return null;
    }
  }

  /* ── 主提取流程 ── */
  async function extract() {
    const platform = detectPlatform();
    const tools = await loadExtractors();
    const platformExtractor = await loadPlatformExtractor(platform);

    /* Step 1: JSON-LD 结构化数据提取（平台无关） */
    let images = tools.extractStructuredData();
    let title = '';

    /* Step 2: 如果 JSON-LD 拿到的图不够，走平台专用提取器 */
    if ((!images || images.length < 2) && platformExtractor) {
      const result = platformExtractor.extract();
      images = result.images || images;
      title = result.title || title;
    }

    /* Step 3: 如果还不够，走通用 DOM 扫描 */
    if (!images || images.length < 2) {
      const domResult = tools.extractGenericDOM();
      images = images?.length ? [...new Set([...images, ...(domResult.images || [])])] : domResult.images;
      title = title || domResult.title || '';
    }

    if (!images || images.length === 0) {
      return { images: [], title: '', platform, ratios: [] };
    }

    /* Step 4: 过滤 + 去重 + 构建完整 URL */
    const uniqueURLs = tools.imageFilter(images);
    const fullURLs = uniqueURLs.map(u => tools.buildURL(u));

    /* Step 5: 收集图片比例 */
    const ratios = fullURLs.map(() => ''); // 比例在 imageFilter 里已记录

    return {
      images: fullURLs,
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
