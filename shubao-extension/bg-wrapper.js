/**
 * 薯包AI · 插件后台 Service Worker
 *
 * 职责：转发 content script → 后端的数据、监听来自 popup 的消息
 * 注意：Manifest V3 service worker 不持久的，重要状态走 storage
 */

const API_BASE = 'http://localhost:3099';

/* ── 消息路由 ── */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const handlers = {
    /* 把采集的数据发送到后端 */
    async submitExtraction(data) {
      try {
        const res = await fetch(`${API_BASE}/api/extension/collect`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...data,
            pageUrl: sender?.tab?.url || data.pageUrl || '',
            collectedAt: Date.now(),
          }),
        });
        const result = await res.json();
        // 把 taskId 存入 storage 供 popup 读取
        if (result?.taskId) {
          await chrome.storage.local.set({ lastTaskId: result.taskId, lastTask: result });
        }
        return { ok: true, ...result };
      } catch (err) {
        return { ok: false, error: err.message };
      }
    },

    /* 从 storage 获取上一次任务 */
    async getLastTask() {
      const { lastTask } = await chrome.storage.local.get('lastTask');
      return lastTask || null;
    },

    /* 打开 AI 复刻页面 */
    async openRemakePage({ taskId }) {
      const url = `http://localhost:5173/#/remake?task=${taskId}`;
      await chrome.tabs.create({ url });
      return { ok: true };
    },
  };

  const handler = handlers[request.action];
  if (handler) {
    handler(request.payload).then(sendResponse);
    return true; // 保持 message channel 打开
  }
});

/* ── 安装时设置默认值 ── */
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({
    apiBase: API_BASE,
    version: chrome.runtime.getManifest().version,
  });
});
