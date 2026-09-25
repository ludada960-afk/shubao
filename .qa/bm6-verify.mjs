/* ══════════════════════════════════════════════════════════════════════════════════════════
   批 BM-6 实机复验：模型下拉按家族分组 + 清晰度档位进「生成设置」+ 切档真的换产品（SKU 证据）

   要测到的四件事（每件都有可读数字，失败就是失败）：
     ① 下拉里的家族标签顺序 = Seedance / MiniMax / 通义万相 / 可灵，且**每族只出现一次**；
     ② MiniMax H3 只有**一行**（720P 与 2K 合并），通义万相 3.0 只有**一行**；
     ③ 「生成设置」里通义万相 3.0 的清晰度药丸 = 480P / 720P / 1080P；
     ④ 点「1080P」→ 报价请求里的 sku 变成 **video_wan_1080p_short**（钱路上确实换了产品），
        同时型号名仍显示「通义万相 3.0」（分辨率不再进型号名）。
   ⚠️ 全程不真实出片：POST /api/video/jobs 打桩成 500 并记录，被调到就是接线错了要响。
   ══════════════════════════════════════════════════════════════════════════════════════════ */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { startDevServer, stopDevServer, gotoHealthy } from '../test/helpers/live-browser.mjs';
import { publicVideoProducts } from '../server/videoCatalog.mjs';

const out = '.tmp/bm6';
mkdirSync(out, { recursive: true });

const CAPS = {
  loading: false,
  generationEnabled: true,
  workbenchEnabled: false,
  directorUi: false,
  uploadMode: 'tus',
  defaultProductId: 'seedance_standard',
  products: publicVideoProducts(),
};
const calls = { quote: [], videoJobs: 0 };

const server = await startDevServer();
if (!server.ok) { console.log('dev server 起不来：' + server.reason); process.exit(1); }
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
page.on('pageerror', error => console.log('PAGEERROR: ' + error.message));

await page.route('**/api/**', route => {
  const req = route.request();
  const path = new URL(req.url()).pathname;
  const json = (status, body) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  if (path === '/api/session') return json(200, { ok: true, email: 'probe@example.com', nickname: 'BM6' });
  if (path === '/api/video/capabilities') return json(200, CAPS);
  if (path === '/api/video/jobs' && req.method === 'POST') { calls.videoJobs += 1; return json(500, { error: 'BM6 探针：不许真实出片' }); }
  if (path === '/api/video/jobs') return json(200, { jobs: [] });
  if (path === '/api/billing/quote') {
    let body = {};
    try { body = JSON.parse(req.postData() || '{}'); } catch { /* 忽略 */ }
    calls.quote.push(body);
    return json(200, { quote: { quoteId: 'probe-1', sku: body.sku || '', totalUnits: 1000, currency: 'ec_points' } });
  }
  if (path === '/api/billing/balance') return json(200, { ok: true, currency: 'ec_points', balance: 999, unlimited: false, credits: 999 });
  return json(200, { ok: true });
});

await gotoHealthy(page, server.base, '.homepage-mode-card');
await page.waitForTimeout(1200);

/* 打开模型下拉 */
const triggerInfo = await page.evaluate(() => {
  const labels = Array.from(document.querySelectorAll('.video-config-trigger')).map(node => node.textContent.trim().slice(0, 40));
  return { triggers: labels };
});
await page.click('.video-config-trigger.is-model');
await page.waitForSelector('.video-inline-menu.is-model button', { timeout: 8000 });
await page.waitForTimeout(500);

const menu = await page.evaluate(() => {
  const panel = document.querySelector('.video-inline-menu.is-model');
  const children = Array.from(panel.children);
  const labels = [];
  const rows = [];
  for (const child of children) {
    if (child.classList.contains('video-model-group-label')) labels.push(child.textContent.trim());
    if (child.tagName === 'BUTTON') {
      const b = child.querySelector('b');
      rows.push({
        name: (b?.firstChild?.textContent || '').trim(),
        tier: (b?.querySelector('em')?.textContent || '').trim(),
        desc: (child.querySelector('small')?.textContent || '').trim(),
        selected: child.classList.contains('is-selected'),
      });
    }
  }
  return {
    labels,
    rows,
    labelCount: labels.length,
    rowCount: rows.length,
    panelHeight: Math.round(panel.getBoundingClientRect().height),
    panelWidth: Math.round(panel.getBoundingClientRect().width),
    scrollable: panel.scrollHeight > panel.clientHeight + 1,
    scrollHeight: panel.scrollHeight,
    clientHeight: panel.clientHeight,
  };
});
/* 版式复核：分组只是**加了兄弟节点**，模型行的样式全在 `.video-inline-menu > button` 这一族
   （直接子选择器）上 —— 这里逐项读计算样式，确认 Fragment 写法没有让那一族静默失配。 */
const menuStyles = await page.evaluate(() => {
  const panel = document.querySelector('.video-inline-menu.is-model');
  const rows = Array.from(panel.querySelectorAll(':scope > button'));
  const first = rows[0];
  const selected = rows.find(node => node.classList.contains('is-selected'));
  const label = panel.querySelector('.video-model-group-label');
  const mark = first.querySelector('.video-model-mark');
  const grid = getComputedStyle(panel);
  const rect = node => { const b = node.getBoundingClientRect(); return { w: Math.round(b.width), h: Math.round(b.height) }; };
  return {
    directChildRows: rows.length,
    panelGap: grid.gap,
    panelScrollbarWidth: grid.scrollbarWidth,
    row: {
      background: getComputedStyle(first).backgroundColor,
      borderRadius: getComputedStyle(first).borderRadius,
      borderWidth: getComputedStyle(first).borderTopWidth,
      minHeight: getComputedStyle(first).minHeight,
      height: rect(first).h,
      justifyContent: getComputedStyle(first).justifyContent,
    },
    selectedBorder: selected ? getComputedStyle(selected).borderTopColor : '',
    selectedShadow: selected ? getComputedStyle(selected).boxShadow : '',
    markSize: mark ? rect(mark) : null,
    markTransform: mark ? getComputedStyle(mark).transform : '',
    label: label ? {
      fontSize: getComputedStyle(label).fontSize,
      fontWeight: getComputedStyle(label).fontWeight,
      color: getComputedStyle(label).color,
      pointerEvents: getComputedStyle(label).pointerEvents,
      height: rect(label).h,
    } : null,
  };
});
await page.screenshot({ path: out + '/01-model-menu.png' });

/* 关掉下拉，切到「通义万相 3.0」那一行，再看生成设置里的清晰度药丸 */
const wanRowIndex = menu.rows.findIndex(row => row.name === '通义万相 3.0');
await page.evaluate(index => {
  const buttons = Array.from(document.querySelectorAll('.video-inline-menu.is-model > button'));
  buttons[index]?.click();
}, wanRowIndex);
await page.waitForTimeout(700);
const afterPick = await page.evaluate(() => {
  const trigger = document.querySelector('.video-config-trigger.is-model');
  return { modelName: trigger?.querySelector('strong')?.textContent?.trim() || '' };
});

/* 打开「生成设置」 */
await page.evaluate(() => {
  const buttons = Array.from(document.querySelectorAll('.video-config-trigger'));
  buttons.find(node => node.textContent.includes('生成设置') || node.querySelector('small')?.textContent.includes('生成设置'))?.click();
});
await page.waitForSelector('.video-resolution-pills', { timeout: 8000 });
await page.waitForTimeout(400);
const clarity = await page.evaluate(() => ({
  pills: Array.from(document.querySelectorAll('.video-resolution-pills button')).map(node => ({
    text: node.textContent.trim(),
    selected: node.classList.contains('is-selected'),
    title: node.getAttribute('title') || '',
  })),
  durationMax: document.querySelector('.video-duration-number')?.getAttribute('max') || '',
  settingsSummary: Array.from(document.querySelectorAll('.video-config-trigger')).map(node => node.querySelector('strong')?.textContent?.trim()).join(' | '),
}));
await page.screenshot({ path: out + '/02-clarity.png' });

/* 点 1080P —— 关注报价请求里的 sku 是否换成 wan_1080p 那一条 */
const quotesBefore = calls.quote.length;
await page.evaluate(() => {
  const pill = Array.from(document.querySelectorAll('.video-resolution-pills button')).find(node => node.textContent.trim() === '1080P');
  pill?.click();
});
await page.waitForTimeout(1500);
const after1080 = await page.evaluate(() => ({
  pills: Array.from(document.querySelectorAll('.video-resolution-pills button')).map(node => ({
    text: node.textContent.trim(), selected: node.classList.contains('is-selected'),
  })),
  durationValue: document.querySelector('.video-duration-number')?.value || '',
  durationMax: document.querySelector('.video-duration-number')?.getAttribute('max') || '',
  settingsSummary: Array.from(document.querySelectorAll('.video-config-trigger')).map(node => node.querySelector('strong')?.textContent?.trim()).join(' | '),
  modelName: document.querySelector('.video-config-trigger.is-model strong')?.textContent?.trim() || '',
}));
await page.screenshot({ path: out + '/03-1080p.png' });

/* ── MiniMax H3：用户点名的另一条 —— 720P 与 2K 也必须合并成一行的一排药丸 ── */
await page.click('.video-config-trigger.is-model');
await page.waitForSelector('.video-inline-menu.is-model button', { timeout: 8000 });
await page.waitForTimeout(400);
await page.evaluate(() => {
  const buttons = Array.from(document.querySelectorAll('.video-inline-menu.is-model > button'));
  buttons.find(node => node.querySelector('b')?.firstChild?.textContent?.trim() === 'MiniMax H3')?.click();
});
await page.waitForTimeout(700);
await page.evaluate(() => {
  const buttons = Array.from(document.querySelectorAll('.video-config-trigger'));
  buttons.find(node => node.querySelector('small')?.textContent.includes('生成设置'))?.click();
});
await page.waitForSelector('.video-resolution-pills', { timeout: 8000 });
await page.waitForTimeout(400);
const miniPills = await page.evaluate(() => ({
  modelName: document.querySelector('.video-config-trigger.is-model strong')?.textContent?.trim() || '',
  pills: Array.from(document.querySelectorAll('.video-resolution-pills button')).map(node => ({
    text: node.textContent.trim(), selected: node.classList.contains('is-selected'), title: node.getAttribute('title') || '',
  })),
}));
const quotesBefore2k = calls.quote.length;
await page.evaluate(() => {
  const pill = Array.from(document.querySelectorAll('.video-resolution-pills button')).find(node => node.textContent.trim() === '2K');
  pill?.click();
});
await page.waitForTimeout(1500);
const mini2k = await page.evaluate(() => ({
  pills: Array.from(document.querySelectorAll('.video-resolution-pills button')).map(node => ({
    text: node.textContent.trim(), selected: node.classList.contains('is-selected'),
  })),
  settingsSummary: Array.from(document.querySelectorAll('.video-config-trigger')).map(node => node.querySelector('strong')?.textContent?.trim()).join(' | '),
}));
await page.screenshot({ path: out + '/04-minimax-2k.png' });

const report = {
  triggerInfo,
  menu,
  menuStyles,
  afterPick,
  clarity,
  after1080,
  miniPills,
  mini2k,
  quoteSkus: calls.quote.map(item => item.sku || '(none)'),
  quoteSkusAfter1080: calls.quote.slice(quotesBefore).map(item => item.sku || '(none)'),
  quoteSkusAfter2k: calls.quote.slice(quotesBefore2k).map(item => item.sku || '(none)'),
  videoJobs: calls.videoJobs,
};
writeFileSync(out + '/bm6-verify.json', JSON.stringify(report, null, 1));
console.log(JSON.stringify(report, null, 1));

await browser.close();
stopDevServer(server.proc, { owned: server.owned });
