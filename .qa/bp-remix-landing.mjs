/* 批 BP-3 复验：点「做同款」→ 应该落到**图片生成**的技能子页面，并把案例素材/提示词预填好。
   同时记录：旧的工作台（#creation-workbench）不在目标页上。 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { startDevServer, stopDevServer, gotoHealthy } from '../test/helpers/live-browser.mjs';

const out = '.tmp/bp';
mkdirSync(out, { recursive: true });
const server = await startDevServer();
if (!server.ok) { console.log('dev server 起不来：' + server.reason); process.exit(1); }
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
page.on('pageerror', error => console.log('PAGEERROR: ' + error.message));
await page.route('**/api/**', route => {
  const path = new URL(route.request().url()).pathname;
  const json = (body) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  if (path === '/api/session') return json({ ok: true, email: 'probe@example.com' });
  if (path === '/api/works') return json({ works: [] });
  if (path === '/api/billing/balance') return json({ ok: true, balance: 999, credits: 999, unlimited: false, currency: 'ec_points' });
  return json({ ok: true });
});

await gotoHealthy(page, server.base, '.homepage-mode-card');
await page.waitForTimeout(1500);
/* 案例区在页面下方且按需渲染 —— 先滚过去、等按钮出现，再点 */
await page.evaluate(() => document.querySelector('.gallery-section')?.scrollIntoView({ block: 'center' }));
await page.waitForSelector('.gallery-card-remix', { timeout: 20000 });
await page.waitForTimeout(600);
/* 找一张**电商套图**案例的「做同款」（第一条就是） */
const target = await page.evaluate(() => {
  const buttons = Array.from(document.querySelectorAll('.gallery-card-remix'));
  const hit = buttons.find(node => {
    const card = node.closest('.gallery-card');
    return /电商套图|电商/.test(card?.querySelector('.gallery-card-badge')?.textContent || '');
  }) || buttons[0];
  const card = hit?.closest('.gallery-card');
  return { badge: card?.querySelector('.gallery-card-badge')?.textContent?.trim() || '', found: Boolean(hit) };
});
await page.evaluate(() => {
  const buttons = Array.from(document.querySelectorAll('.gallery-card-remix'));
  const hit = buttons.find(node => {
    const card = node.closest('.gallery-card');
    return /电商套图|电商/.test(card?.querySelector('.gallery-card-badge')?.textContent || '');
  }) || buttons[0];
  hit?.click();
});
await page.waitForTimeout(3000);

const after = await page.evaluate(() => {
  const uploads = Array.from(document.querySelectorAll('.media-asset-card, .ec-xhs-upload-card')).length;
  const textareas = Array.from(document.querySelectorAll('textarea')).map(node => (node.value || '').trim().slice(0, 40)).filter(Boolean);
  const hint = document.querySelector('.media-workbench-carry-hint, .media-creation-notice, [class*="carry"]')?.textContent?.trim() || '';
  return {
    url: location.href,
    hasOldWorkbench: Boolean(document.querySelector('#creation-workbench')),
    hasWorkbench: Boolean(document.querySelector('.media-workbench')),
    workbenchTitle: document.querySelector('.topbar-title')?.textContent?.trim() || '',
    seededUploads: uploads,
    textareas,
    carryHint: hint,
  };
});
await page.screenshot({ path: out + '/03-remix-landing.png' });

const report = { target, after };
writeFileSync(out + '/remix-after.json', JSON.stringify(report, null, 1));
console.log(JSON.stringify(report, null, 1));
await browser.close();
stopDevServer(server.proc, { owned: server.owned });
