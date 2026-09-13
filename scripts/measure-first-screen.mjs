#!/usr/bin/env node
// 首屏性能实测：Playwright (CDP Network) 统计 transferSize / 请求数 / 最大单文件 / LCP。
// 用法: node scripts/measure-first-screen.mjs [url] [tag]
//   url 缺省 http://127.0.0.1:4173/ ；tag 用于输出文件名（如 before / after）。
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const URL = process.argv[2] || 'http://127.0.0.1:4173/';
const TAG = process.argv[3] || 'run';
const SHOTS_DIR = path.join(ROOT, '.playwright-shots', 'perf');
fs.mkdirSync(SHOTS_DIR, { recursive: true });

const VIEWPORT = {
  width: Number(process.env.MEASURE_WIDTH) || 1280,
  height: Number(process.env.MEASURE_HEIGHT) || 800,
};

async function main() {
  const browser = await chromium.launch({
    channel: 'msedge',
    headless: true,
    args: ['--disable-features=OptimizationHints'],
  });
  const context = await browser.newContext({ viewport: VIEWPORT, locale: 'zh-CN' });
  const page = await context.newPage();

  // LCP observer (must register before navigation)
  await page.addInitScript(() => {
    window.__lcpEntries = [];
    try {
      new PerformanceObserver(list => {
        for (const e of list.getEntries()) {
          window.__lcpEntries.push({ time: Math.round(e.startTime), size: e.size || 0, url: e.url || '' });
        }
      }).observe({ type: 'largest-contentful-paint', buffered: true });
    } catch {}
  });

  // CDP network capture
  const client = await context.newCDPSession(page);
  await client.send('Network.enable');
  const reqs = new Map();
  const transferred = [];
  client.on('Network.requestWillBeSent', e => {
    reqs.set(e.requestId, { url: e.request.url, method: e.request.method });
  });
  client.on('Network.responseReceived', e => {
    const r = reqs.get(e.requestId);
    if (r) { r.type = e.type; r.status = e.response.status; r.mime = e.response.mimeType; }
  });
  client.on('Network.loadingFinished', e => {
    const r = reqs.get(e.requestId);
    if (r) {
      r.encodedDataLength = e.encodedDataLength;
      transferred.push(r);
    }
  });
  client.on('Network.loadingFailed', e => {
    const r = reqs.get(e.requestId);
    if (r) { r.failed = true; r.errorText = e.errorText; transferred.push(r); }
  });

  const startedAt = Date.now();
  const response = await page.goto(URL, { waitUntil: 'load', timeout: 60000 });
  // 让懒加载字体/图片与 fonts 子集有充分时间按需拉取（首屏窗口）
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2500);

  const metrics = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0] || {};
    const resources = performance.getEntriesByType('resource');
    return {
      domContentLoaded: nav.domContentLoadedEventEnd ? Math.round(nav.domContentLoadedEventEnd) : null,
      loadEventEnd: nav.loadEventEnd ? Math.round(nav.loadEventEnd) : null,
      transferSize: nav.transferSize || 0,
      resourceCount: resources.length,
      lcp: (window.__lcpEntries || []),
      title: document.title,
    };
  });
  const wallMs = Date.now() - startedAt;

  // Aggregate by CDP
  const byType = {};
  let total = 0;
  const list = [];
  for (const r of transferred) {
    if (r.failed) continue;
    const type = r.type || 'other';
    const bytes = r.encodedDataLength || 0;
    byType[type] = (byType[type] || 0) + bytes;
    total += bytes;
    list.push({ url: r.url, type, bytes, status: r.status });
  }
  list.sort((a, b) => b.bytes - a.bytes);
  const maxFile = list[0] || null;

  // Screenshots
  await page.screenshot({ path: path.join(SHOTS_DIR, `${TAG}-first-viewport.png`) });
  await page.screenshot({ path: path.join(SHOTS_DIR, `${TAG}-fullpage.png`), fullPage: true });

  const broken = list.filter(r => (r.status || 0) >= 400);
  const fontRequests = list.filter(r => r.type === 'Font');
  const result = {
    tag: TAG, url: URL, wallMs,
    viewport: VIEWPORT,
    totalTransferKB: Math.round(total / 1024),
    requestCount: list.length,
    maxFile: maxFile ? { ...maxFile, bytesKB: Math.round((maxFile.bytes || 0) / 1024) } : null,
    byType: Object.fromEntries(Object.entries(byType).map(([k, v]) => [k, Math.round(v / 1024)])),
    domContentLoaded: metrics.domContentLoaded,
    loadEventEnd: metrics.loadEventEnd,
    lcpMs: metrics.lcp.length ? Math.round(Math.max(...metrics.lcp.map(e => e.time))) : null,
    lcpEntries: metrics.lcp.slice(0, 5),
    broken: broken.slice(0, 15).map(r => ({ url: r.url, status: r.status, bytes: r.bytes })),
    top20: list.slice(0, 20).map(r => ({ url: r.url, type: r.type, bytesKB: Math.round((r.bytes || 0) / 1024), status: r.status })),
    fontCount: fontRequests.length,
    fontBytesKB: Math.round(fontRequests.reduce((sum, r) => sum + (r.bytes || 0), 0) / 1024),
    requests: list.map(r => ({ url: r.url, type: r.type, bytes: r.bytes, status: r.status })),
  };

  const outPath = path.join(SHOTS_DIR, `${TAG}-metrics.json`);
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
  await browser.close();
}

main().catch(err => { console.error(err); process.exit(1); });
