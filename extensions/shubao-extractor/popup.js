// 薯包AI 商品提取器 — Popup（直接在当前标签页注入提取）
(function () {
  var API_URL = 'http://localhost:3099/api/bookmarklet-extract';
  var APP_URL = 'http://localhost:5173';
  var appEl = document.getElementById('app');

  function escapeHtml(s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

  function render(data) {
    var groups = data.groups || {};
    var allUrls = data.urls || [];
    var title = data.title || '';
    var total = 0; for (var g in groups) total += groups[g].length;

    if (!total) {
      appEl.innerHTML = '<div class="body"><div class="status-bar err">未提取到商品图</div><div class="actions"><button class="btn btn-outline" onclick="window.close()">关闭</button></div></div>';
      return;
    }

    var html = '';
    var order = ['main', 'sku', 'detail', 'other'];
    var labels = { main: '商品主图', sku: 'SKU/规格', detail: '详情图', other: '其他' };

    for (var oi = 0; oi < order.length; oi++) {
      var g = order[oi];
      var imgs = groups[g];
      if (!imgs || !imgs.length) continue;
      html += '<div class="zone-label">' + labels[g] + ' <span class="count">' + imgs.length + '张</span></div>';
      var maxRows = 3;
      var rows = Math.ceil(imgs.length / 4);
      var showMore = false;
      if (rows > maxRows) { rows = maxRows; showMore = true; }
      for (var r = 0; r < rows; r++) {
        html += '<div class="img-row">';
        for (var c = 0; c < 4; c++) {
          var idx = r * 4 + c;
          if (idx < imgs.length) {
            var u = imgs[idx];
            var fname = decodeURIComponent(u.split('/').pop().split('?')[0]).slice(0, 12);
            html += '<div class="img-cell" onclick="window.open(\'' + escapeHtml(u) + '\',\'_blank\')">';
            html += '<img src="' + escapeHtml(u) + '" onerror="this.parentElement.style.display=\'none\'">';
            html += '<div class="img-fname">' + escapeHtml(fname) + '</div></div>';
          } else { html += '<div class="img-cell" style="border:none;background:transparent"></div>'; }
        }
        html += '</div>';
      }
      if (showMore) { html += '<div class="zone-more">还有 ' + (imgs.length - maxRows * 4) + ' 张</div>'; }
    }

    appEl.innerHTML = '<div class="body">' +
      '<div class="status-bar ok">' + escapeHtml((title || '已提取').slice(0, 60)) + '</div>' +
      '<div style="font-size:10px;color:#999;margin-bottom:2px">共 ' + total + ' 张</div>' +
      html + '</div>' +
      '<div class="actions">' +
      '<button class="btn btn-primary" id="sendBtn">发送到薯包AI</button>' +
      '<button class="btn btn-outline" onclick="window.close()">取消</button></div>';

    document.getElementById('sendBtn').onclick = function () {
      var btn = this;
      btn.disabled = true;
      btn.textContent = '发送中...';
      var sendUrls = allUrls.filter(Boolean);
      var detailUrl = data.detailIframeUrl || '';

      // 尝试截前 3 张图转 base64（方便服务端做视觉反推）
      var pending = sendUrls.slice(0, 3).map(function (url) {
        return new Promise(function (resolve) {
          var img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = function () {
            try {
              var c = document.createElement('canvas');
              c.width = Math.min(img.naturalWidth || 300, 800);
              c.height = Math.min(img.naturalHeight || 300, 800);
              c.getContext('2d').drawImage(img, 0, 0);
              resolve(c.toDataURL('image/jpeg', 0.8));
            } catch (e) { resolve(null); }
          };
          img.onerror = function () { resolve(null); };
          img.src = url;
        });
      });

      Promise.all(pending).then(function (base64Arr) {
        var b64 = base64Arr.filter(Boolean);
        return fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: title || '',
            images: sendUrls,
            base64Images: b64.length ? b64 : undefined,
            detailIframeUrl: detailUrl || undefined,
          }),
        });
      }).then(function (r) {
        return r.json();
      }).then(function (result) {
        if (result.token) {
          var targetUrl = APP_URL + '/?extract_token=' + result.token;
          var newWin = window.open(targetUrl, '_blank');
          if (newWin) {
            window.close();
          } else {
            // 弹窗被拦截，让用户自己处理
            alert('请允许弹出窗口，或手动访问:\n' + targetUrl);
            btn.disabled = false;
          }
        } else {
          alert('发送失败');
          btn.disabled = false;
        }
      }).catch(function (e) {
        alert('发送失败：' + e.message);
        btn.disabled = false;
      });
    };
  }

  function showError(msg) {
    appEl.innerHTML = '<div class="body"><div class="status-bar err">' + escapeHtml(msg) + '</div><div class="actions"><button class="btn btn-outline" onclick="window.close()">关闭</button></div></div>';
    if (msg.length > 40) { console.error('[薯包提取器]', msg); }
  }

  // ── 启动 ──
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    var tab = tabs[0];
    if (!tab) { showError('无法获取页面'); return; }

    var url = tab.url || '';
    if (!/taobao|tmall|jd\.com|pinduoduo|yangkeduo|1688|amazon/.test(url)) {
      showError('请在商品页面使用');
      return;
    }

    appEl.innerHTML = '<div class="empty"><div class="icon">⏳</div><p>正在提取商品信息...</p><p style="font-size:10px;color:#aaa;margin-top:6px">💡 想要提取最全的图片信息？请把页面往下滑到底，让主图、SKU、详情图都加载出来，再启动此插件</p></div>';

    // 轮询检测页面加载完毕 + 详情容器就绪，再提取
    pollUntilReady(tab.id, function () {
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: scrapeProduct
      }, function (results) {
        if (chrome.runtime.lastError) {
          showError('注入失败：' + chrome.runtime.lastError.message);
          return;
        }
        var r = (results && results[0] && results[0].result) || { title: '', groups: {}, urls: [] };
        render(r);
      });
    });

    // 10 秒总超时
    setTimeout(function () {
      if (appEl.innerHTML.indexOf('⏳') !== -1) {
        showError('⏱️ 页面加载超时，请刷新后重试。刷新后先往下划一划，让页面图都加载出来再点插件');
      }
    }, 12000);
  });

  // ── 轮询检测页面就绪 ──
  function pollUntilReady(tabId, callback) {
    var maxPolls = 16; // 最多等 16 × 500ms = 8 秒
    var polls = 0;

    function poll() {
      chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: function checkReady() {
          var ready = document.readyState === 'complete';

          // 详情容器是否有内容（避免 AJAX 未加载完就提取）
          var detailEl = document.querySelector('#J_DivItemDesc, #description, .tb-detail, .J_Detail, #product-detail, .detail-content, #J_Desc, .goods-detail, .J-detail-content, #detail');
          var detailReady = detailEl && detailEl.innerHTML.replace(/\s/g, '').length > 50;

          // 主要图片是否已渲染（超过 3 张即认为渲染完成）
          var imgCount = document.querySelectorAll('img').length;
          var hasImages = imgCount > 3;

          return { ready: ready && hasImages, detailReady: detailReady, imgCount: imgCount };
        }
      }, function (results) {
        var status = results && results[0] && results[0].result;
        if (!status) {
          // executeScript 失败（页面可能被关闭了）
          callback();
          return;
        }

        if (status.ready && (status.detailReady || polls > 8)) {
          // 页面就绪了，提取
          callback();
        } else if (polls >= maxPolls) {
          // 超时了，不管怎样也提
          callback();
        } else {
          polls++;
          setTimeout(poll, 500);
        }
      });
    }

    poll();
  }

  // ════════════════════════════════════════
  //  提取函数（被 chrome.scripting.executeScript 注入到页面执行）
  // ════════════════════════════════════════
  function scrapeProduct() {
    var host = location.hostname;
    var groups = { main: [], sku: [], detail: [], other: [] };
    var seen = {};
    var title = '';

    // ── 平台 -> 区域 -> 容器选择器 ──
    var ZONE_MAP = null;

    if (/taobao|tmall/.test(host) && !/1688/.test(host)) {
      ZONE_MAP = {
        main:   ['#J_UlThumb', '.tb-booth', '#J_ImgBooth', '.tb-gallery', '.tm-gallery', '#J_Gallery', '.tb-pic'],
        sku:    ['#J_TSaleProp', '.tb-sku', '.tm-sku', '#J_Prop', '.J_TSaleProp', '.sku-group', '[class*=sku]'],
        detail: ['#description', '#J_DivItemDesc', '.tb-detail', '.J_Detail', '.detail-content', '#J_Desc', '#desc', '.module-detail']
      };
    } else if (/jd\.com/.test(host)) {
      ZONE_MAP = {
        main:   ['#spec-list', '.spec-items', '.preview-all', '.jqzoom', '.lh', '.J-preview', '.preview'],
        sku:    ['#choose-attr', '.J-choose-attr', '#choose-color', '.choose-sku', '#choose-size', '.choose-attr'],
        detail: ['#product-detail', '.detail-content', '.parameter2', '.parameter', '.J-detail-content', '#detail', '.detail', '.J-detail']
      };
    } else if (/pinduoduo|yangkeduo/.test(host)) {
      ZONE_MAP = {
        main:   ['.gallery', '.goods-preview', '.carousel', '.goods-gallery', '#mainImg', '.preview'],
        sku:    ['.sku-list', '.goods-spec', '.spec-item', '.sku-selector', '.spec-panel'],
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
        sku:    ['#variation_color_name', '#variation_size_name', '.variations', '.variation'],
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

    if (!ZONE_MAP) {
      return { title: title, groups: {}, urls: [] };
    }

    // ── 阶段 1: 定向提取（从平台已知容器捞） ──
    ['main', 'sku', 'detail'].forEach(function (zone) {
      var containers = ZONE_MAP[zone] || [];
      containers.forEach(function (sel) {
        try {
          var el = document.querySelector(sel);
          if (!el) return;
          el.querySelectorAll('img').forEach(function (img) {
            var src = img.currentSrc || img.getAttribute('src') || img.getAttribute('data-src') || img.getAttribute('data-lazy-src') || img.getAttribute('data-original') || '';
            if (!src || isJunkUrl(src)) return;
            var w = img.naturalWidth || img.width || 0;
            var h = img.naturalHeight || img.height || 0;
            if (w > 0 && h > 0 && w < 60 && h < 60) return;
            add(src, zone);
          });
          // 容器内 HTML 补漏（懒加载属性、背景图等）
          var html = el.innerHTML.replace(/\\u002[fF]/g, '/').replace(/\\\//g, '/');
          var dataRe = /data-(?:src|lazy-src|original|img|url)\s*=\s*["']([^"']+)["']/gi, dm;
          while ((dm = dataRe.exec(html)) !== null) { if (dm[1] && !isJunkUrl(dm[1])) add(dm[1], zone); }
          var bgRe = /background-image\s*:\s*url\(["']?([^"'\s)]+)["']?\)/gi, bm;
          while ((bm = bgRe.exec(html)) !== null) { if (bm[1] && !isJunkUrl(bm[1])) add(bm[1], zone); }
        } catch (e) {}
      });
    });

    // 记录阶段 1 结果
    var p1Counts = {};
    ['main', 'sku', 'detail'].forEach(function (z) { p1Counts[z] = (groups[z] || []).length; });

    // ── 阶段 2: DOM 遍历（全量 img，严格过滤 + 爬容器分类） ──
    // 和阶段 1 同时跑，两路互补
    try {
      document.querySelectorAll('img').forEach(function (el) {
        var src = el.currentSrc || el.getAttribute('src') || '';
        if (!src || isJunkUrl(src)) return;
        var w = el.naturalWidth || el.width || 0;
        var h = el.naturalHeight || el.height || 0;
        if (w > 0 && h > 0 && w < 80 && h < 80) return;

        // 如果已经在前一阶段拿到了，跳过
        var key = src.split('#')[0].split('?')[0];
        if (seen[key]) return;

        // 排查评论/推荐/页脚等非商品区域（这些图会污染分类）
        var skip = false;
        var check = el;
        for (var cd = 0; cd < 12 && check; cd++) {
          var ck = (check.className || '') + ' ' + (check.id || '');
          if (/(review|comment|evaluate|rate|rating|recommend|recom|related|guess|like-like|shop-recommend|hot-sale|head|footer|sidebar|aside|copyright|copy|service|kefu|phone|wechat|weixin|qq\.|qzone|weibo|J_TModule|J_Widget|J_Module|widget|module-sale|sale-module)/i.test(ck)) { skip = true; break; }
          check = check.parentElement;
        }
        if (skip) return;

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

    // ── 阶段 3: 全页 HTML 无差别扫——不依赖懒加载，直接从源码薅图 URL ──
    try {
      // 先标记已知垃圾区的图
      var junkSelectors = [
        '#reviews', '#review', '.review', '.tb-review', '.review-items', '.J-Reviews',
        '.recommend', '.J_ShopRecom', '.shop-recommend', '.recom', '.recommendation', '.J_Recom',
        '#footer', '.footer', '#copyright', '.copyright', '.J_Footer',
        '#J_TabBar', '.tb-rate', '[class*=rate]', '[class*=comment]', '[class*=evaluate]', '#J_RateTab',
        '.J_TModule', '[class*=relate]', '[class*=guess]', '[class*=hot]', '.guess', '.J_Guess',
        '#J_SiteNav', '.site-nav', '.top-nav', '.J_TopNav', '.J_Header', '#header',
        '#J_Search', '.search', '.J_Search', '#J_MiniCart', '.mini-cart',
        '.service', '.J_Service', '#J_Service', '#J_ShopInfo', '.shop-info',
        '.J_ShopSign', '.shop-sign', '#J_ShopSign', '#J_AskAnnie', '.ask-annie',
        '.J_Phone', '#J_Phone', '.phone-layer', '#sidebar', '.sidebar',
        '#J_Relate', '.J_Relate', '[class*=relate]', '.J_Scroll'
      ];
      junkSelectors.forEach(function (sel) {
        try {
          var el = document.querySelector(sel);
          if (el) {
            el.querySelectorAll('img').forEach(function (img) {
              var src = img.getAttribute('src') || img.getAttribute('data-src') || img.getAttribute('data-original') || '';
              if (src) { var k = src.split('#')[0].split('?')[0]; if (k) seen[k] = true; }
            });
          }
        } catch (e) {}
      });

      // 扫全页 HTML——收 CDN 图片 URL
      var html = document.documentElement ? document.documentElement.innerHTML : '';
      html = html.replace(/\\u002[fF]/g, '/').replace(/\\\//g, '/');

      // 1. 全页 data-src/original/lazy-src/img/url 属性
      var dataRe = /data-(?:src|lazy-src|original|img|url)\s*=\s*["']([^"']+)["']/gi, dm;
      while ((dm = dataRe.exec(html)) !== null) {
        var u = dm[1];
        if (!u || u.length < 10 || u.length > 500 || isJunkUrl(u)) continue;
        if (!/https?:\/\//i.test(u)) continue;
        if (!/\.(jpg|jpeg|png|webp|gif|avif)(\?|$)/i.test(u)) continue;
        var key = u.split('#')[0].split('?')[0];
        if (!key || seen[key]) continue;
        seen[key] = true;
        // 按 URL 推测区域
        if (/(sku|spec|prop|attr|variant|color|choose|select|option|size|规格|属性|颜色|尺码)/i.test(u)) {
          (groups.sku || []).push(key);
        } else if (/(desc|detail|description|详情|介绍|参数|feature)/i.test(u) || /\/desc\//i.test(u) || /\/detail\//i.test(u)) {
          (groups.detail || []).push(key);
        } else {
          // 只收明确来自商品图 CDN 的
          if (/imgextra/i.test(u) || /n[0-5]\//i.test(u)) {
            (groups.main || []).push(key);
          } else {
            (groups.other || []).push(key);
          }
        }
      }

      // 2. background-image
      var bgRe = /background(?:-image)?\s*:\s*url\(["']?([^"'\s)]+)["']?\)/gi, bm;
      while ((bm = bgRe.exec(html)) !== null) {
        var bu = bm[1];
        if (!bu || bu.length < 10 || bu.length > 500 || isJunkUrl(bu)) continue;
        if (!/https?:\/\//i.test(bu)) continue;
        var bk = bu.split('#')[0].split('?')[0];
        if (!bk || seen[bk]) continue;
        seen[bk] = true;
        (groups.detail || []).push(bk);
      }

      // 3. 全页 CDN 图片 URL 正则
      var cdnHosts = /(alicdn|taobaocdn|360buyimg|jdcloud|pddpic|media-amazon|images-amazon|ssl-images-amazon|byteimg|ecombdimg|douyinpic|xhscdn|sns-img|ci\.xiaohongshu)\.com\//i;
      var urlRe = /https?:\/\/[^\s"'\\)<>]+\.(?:jpg|jpeg|png|webp|gif|avif)[^\s"'\\)<>]*/gi, m;
      while ((m = urlRe.exec(html)) !== null) {
        var cu = m[0].split('"')[0].split("'")[0].split(')')[0].split('#')[0];
        if (!cu || cu.length > 500 || isJunkUrl(cu)) continue;
        if (!cdnHosts.test(cu)) continue;
        var ck = cu.split('?')[0];
        if (!ck || seen[ck]) continue;
        seen[ck] = true;
        // 按 URL 推测区域
        if (/(sku|spec|prop|attr|variant|color|choose|select|option|size|规格|属性|颜色|尺码)/i.test(cu)) {
          (groups.sku || []).push(ck);
        } else if (/(desc|detail|description|详情|介绍|参数|feature)/i.test(cu) || /\/desc\//i.test(cu) || /\/detail\//i.test(cu)) {
          (groups.detail || []).push(ck);
        } else if (/imgextra/i.test(cu) || /n[0-5]\//i.test(cu)) {
          (groups.main || []).push(ck);
        } else {
          (groups.other || []).push(ck);
        }
      }

      // 4. <link rel="preload" as="image">
      var linkRe = /<link[^>]*rel=["']preload["'][^>]*as=["']image["'][^>]*href=["']([^"']+)["']/gi, lm;
      while ((lm = linkRe.exec(html)) !== null) {
        var lu = lm[1];
        if (!lu || isJunkUrl(lu)) continue;
        var lk = lu.split('#')[0].split('?')[0];
        if (!lk || seen[lk]) continue;
        seen[lk] = true;
        (groups.main || []).push(lk);
      }
    } catch (e) {}

    // ── 阶段 4: JSON-LD 结构化数据主图 ──
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

    // ── 清理：阶段 1 没找到 SKU 区域的，后面阶段补充的也不保留 ──
    // 详情图不按此规则——详情常在 iframe 里阶段 1 容器查不到，但阶段 3 扫描能拿到
    if (p1Counts['sku'] === 0) { groups['sku'] = []; }

    // ── 阶段 5: 获取详情 iframe URL（传给服务端异步拉图） ──
    var detailIframeUrl = '';
    if (ZONE_MAP && ZONE_MAP.detail) {
      for (var di = 0; di < ZONE_MAP.detail.length; di++) {
        try {
          var el = document.querySelector(ZONE_MAP.detail[di]);
          if (el) { var ifr = el.querySelector('iframe'); if (ifr && ifr.src) { detailIframeUrl = ifr.src; break; } }
        } catch (e) {}
      }
    }
    // 兜底：全页找详情 URL
    if (!detailIframeUrl) {
      try {
        var iframes = document.querySelectorAll('iframe');
        for (var fi = 0; fi < iframes.length; fi++) {
          var s = iframes[fi].src || '';
          if (/(desc|detail|description|详情|介绍)/i.test(s)) { detailIframeUrl = s; break; }
        }
      } catch (e) {}
    }

    var orderedUrls = [];
    ['main', 'sku', 'detail', 'other'].forEach(function (z) {
      (groups[z] || []).forEach(function (u) { orderedUrls.push(u); });
    });

    return { title: title, groups: groups, urls: orderedUrls, detailIframeUrl: detailIframeUrl };
  }
})();
