// ── 页面内提取函数（被注入到目标页面执行） ──
// v5 — 定向容器优先 + DOM 遍历兜底 + 容器内 HTML 补充
function scrapeProduct() {
  var host = location.hostname;
  var groups = { main: [], sku: [], detail: [] };
  var seen = {};
  var title = '';

  // 平台 -> 区域 -> 容器 CSS 选择器（定向用）
  var ZONE_MAP = null;

  if (/taobao|tmall/.test(host) && !/1688/.test(host)) {
    ZONE_MAP = {
      main:   ['#J_UlThumb', '.tb-booth', '#J_ImgBooth', '.tb-gallery', '.tm-gallery', '#J_Gallery', '.tb-pic'],
      sku:    ['#J_TSaleProp', '.tb-sku', '.tm-sku', '#J_Prop', '.J_TSaleProp', '.sku-group', '[class*=sku]'],
      detail: ['#description', '#J_DivItemDesc', '.tb-detail', '.J_Detail', '.detail-content', '#J_Desc', '.J_Desc']
    };
  } else if (/jd\.com/.test(host)) {
    ZONE_MAP = {
      main:   ['#spec-list', '.spec-items', '.preview-all', '.jqzoom', '.lh', '.J-preview', '.preview'],
      sku:    ['#choose-attr', '.J-choose-attr', '#choose-color', '.choose-sku', '#choose-size', '.choose-attr', '.J-choose'],
      detail: ['#product-detail', '.detail-content', '.parameter2', '.parameter', '.J-detail-content', '#detail', '.detail']
    };
  } else if (/pinduoduo|yangkeduo/.test(host)) {
    ZONE_MAP = {
      main:   ['.gallery', '.goods-preview', '.carousel', '.goods-gallery', '#mainImg', '.preview'],
      sku:    ['.sku-list', '.goods-spec', '.spec-item', '.sku-selector', '.spec-panel', '.J-sku'],
      detail: ['.goods-detail', '.detail-content', '.J-detail', '.goods-intro', '.detail']
    };
  } else if (/1688/.test(host)) {
    ZONE_MAP = {
      main:   ['#J_UlThumb', '.tb-booth', '#J_ImgBooth', '.offer-gallery', '#dt', '.gallery'],
      sku:    ['#J_TSaleProp', '.sku-group', '.J_TSaleProp', '.prop-table', '[class*=sku]'],
      detail: ['#J_DivItemDesc', '#description', '.offer-detail', '.detail-content', '.detail']
    };
  } else if (/amazon/.test(host)) {
    ZONE_MAP = {
      main:   ['#imgTagWrapperId', '#altImages', '#main-img', '.imgTagWrapper'],
      sku:    ['#variation_color_name', '#variation_size_name', '.variations', '.variation', '#variation'],
      detail: ['#productDescription', '.aplus-vip', '#detailBullets', '#dpx-legal', '.aplus']
    };
  }

  // 过滤规则
  var JUNK_RE = /(logo|icon|avatar|sprite|blank|placeholder|loading|emoji|sns|share|qr_|code|barcode|arrow|star|rating|badge|cert|trust|verified|secure|88vip|vip|member|level|shop\.|store\.|copyright|footer|header|banner|advert|sale|tip|hint|notice|popup|mask|close|delete|search|cart|buy|subscribe|follow|feedback|kefu|phone|wechat|weixin|qq\.|qzone|weibo)/i;

  function isJunkUrl(u) {
    return !u || !/^https?:\/\//i.test(u) || JUNK_RE.test(u) || !/\.(jpg|jpeg|png|webp|gif|avif)(\?|$)/i.test(u);
  }

  function add(u, zone) {
    if (!u || typeof u !== 'string') return;
    if (u.startsWith('//')) u = location.protocol + u;
    var key = u.split('#')[0].split('?')[0];
    if (!key || seen[key]) return;
    seen[key] = true;
    (groups[zone] || groups.other || []).push(key);
  }

  // ── 标题提取 ──
  try {
    if (/taobao|tmall/.test(host)) { var h = document.querySelector('h1.tb-main-title,.tb-detail-hd h1,h1[data-title],h1'); if (h) title = h.textContent.trim(); }
    else if (/jd\.com/.test(host)) { var h = document.querySelector('.sku-name,.itemInfo-wrap .sku-name,h1'); if (h) title = h.textContent.trim(); }
    else if (/amazon/.test(host)) { var h = document.querySelector('#productTitle,#title,h1'); if (h) title = h.textContent.trim(); }
    else if (/pinduoduo|yangkeduo/.test(host)) { var h = document.querySelector('.goods-name,[class*="goodsName"],h1'); if (h) title = h.textContent.trim(); }
    else { var h = document.querySelector('h1'); if (h) title = h.textContent.trim(); }
  } catch (e) {}
  if (!title) { var ogt = document.querySelector('meta[property="og:title"]'); if (ogt) title = ogt.getAttribute('content') || ''; }
  if (!title) title = document.title.replace(/[_-].*$|（.*$|\(.*$| 淘宝| 京东| 拼多多/i, '').trim() || document.title;

  // ── 阶段 1: 定向提取（从平台已知容器捞） ──
  if (ZONE_MAP) {
    ['main', 'sku', 'detail'].forEach(function (zone) {
      var containers = ZONE_MAP[zone] || [];
      containers.forEach(function (sel) {
        try {
          var el = document.querySelector(sel);
          if (!el) return;
          // 容器内的 img 标签
          el.querySelectorAll('img').forEach(function (img) {
            var src = img.currentSrc || img.getAttribute('src') || img.getAttribute('data-src') || img.getAttribute('data-lazy-src') || img.getAttribute('data-original') || '';
            if (!src || isJunkUrl(src)) return;
            var w = img.naturalWidth || img.width || 0;
            var h = img.naturalHeight || img.height || 0;
            if (w > 0 && h > 0 && w < 60 && h < 60) return;
            add(src, zone);
          });
          // 容器内 HTML 补漏
          var html = el.innerHTML.replace(/\\u002[fF]/g, '/').replace(/\\\//g, '/');
          var dataRe = /data-(?:src|lazy-src|original|img|url)\s*=\s*["']([^"']+)["']/gi, dm;
          while ((dm = dataRe.exec(html)) !== null) { if (dm[1] && !isJunkUrl(dm[1])) add(dm[1], zone); }
          var bgRe = /background-image\s*:\s*url\(["']?([^"'\s)]+)["']?\)/gi, bm;
          while ((bm = bgRe.exec(html)) !== null) { if (bm[1] && !isJunkUrl(bm[1])) add(bm[1], zone); }
          var srcRe = /<img[^>]+src=["']([^"']+)["']/gi, sm;
          while ((sm = srcRe.exec(html)) !== null) { if (sm[1] && !isJunkUrl(sm[1])) add(sm[1], zone); }
        } catch (e) {}
      });
    });
  }

  // ── 阶段 2: DOM 遍历兜底（所有 img 元素，严格过滤后按容器分类） ──
  var ALL_ZONE_CLASSES = /(gallery|preview|main.?pic|main.?img|booth|tb-booth|tb-pic|tb-gallery|jqzoom|magnifier|zoom|spu-img|spec-img|sku|spec|prop|attr|variant|color|J_TSaleProp|J_isku|J_Prop|J_SKU|choose|select|option|parameter|detail|desc|description|参数|属性|详情|介绍|特性|feature|J_Detail|J_desc)/i;

  var totalFound = 0;
  for (var z in groups) totalFound += (groups[z] || []).length;

  if (totalFound < 5) {
    // 定向提取没捞够 → 打开 DOM 兜底
    try {
      document.querySelectorAll('img').forEach(function (el) {
        var src = el.currentSrc || el.getAttribute('src') || '';
        if (!src) return;
        if (isJunkUrl(src)) return;
        var w = el.naturalWidth || el.width || 0;
        var h = el.naturalHeight || el.height || 0;
        if (w > 0 && h > 0 && w < 80 && h < 80) return;

        // 爬 15 层父级找已知区域
        var zone = null;
        var cur = el;
        for (var d = 0; d < 15 && cur; d++) {
          var cid = (cur.className || '') + ' ' + (cur.id || '');
          if (/(gallery|preview|main.?pic|main.?img|booth|tb-booth|tb-pic|tb-gallery|jqzoom|J_Zoom|magnifier|zoom|J_Gallery|J_preview|J_ImgBooth|spu-img|spec-img)/i.test(cid)) { zone = 'main'; break; }
          if (/(sku|spec|prop|attr|variant|color|J_TSaleProp|J_isku|J_Prop|J_SKU|choose|select|option|parameter|J_Attr)/i.test(cid) && !/header|footer|nav/i.test(cid)) { zone = 'sku'; break; }
          if (/(detail|desc|description|参数|属性|详情|介绍|特性|feature|J_Detail|J_desc|module-detail|item-detail)/i.test(cid)) { zone = 'detail'; break; }
          cur = cur.parentElement;
        }

        if (!zone) {
          // 大图且来自 CDN → main，否则丢
          if (w * h >= 80000 && /(alicdn|360buyimg|pddpic)/i.test(src)) zone = 'main';
          else return;
        }

        add(src, zone);
      });
    } catch (e) {}
  }

  // ── 阶段 3: JSON-LD 结构化数据主图 ──
  try {
    var scripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (var si = 0; si < scripts.length; si++) {
      var json;
      try { json = JSON.parse(scripts[si].textContent); } catch (_) { continue; }
      if (!json || typeof json !== 'object') continue;
      var imgs = json.image || json.images || (json.mainEntity ? json.mainEntity.image : null) || [];
      if (typeof imgs === 'string') imgs = [imgs];
      if (imgs && typeof imgs.forEach === 'function') {
        imgs.forEach(function (imgUrl) { if (typeof imgUrl === 'string') add(imgUrl, 'main'); });
      }
    }
  } catch (e) {}

  var orderedUrls = [];
  ['main', 'sku', 'detail', 'other'].forEach(function (z) {
    (groups[z] || []).forEach(function (u) { orderedUrls.push(u); });
  });

  return { title: title, groups: groups, urls: orderedUrls };
}