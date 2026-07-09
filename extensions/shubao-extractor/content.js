// 薯包AI 商品提取器 — 内容脚本（仅作消息桥梁）
// 主要提取工作在 popup 的 world:MAIN 完成

(function () {
  if (window.__SHUBAO_EXTRACTOR_LOADED) return;
  window.__SHUBAO_EXTRACTOR_LOADED = true;

  // 监听 popup 消息 → 直接转发给 popup 去跑 world:MAIN
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === 'ping') {
      sendResponse({ alive: true });
    }
  });
})();
