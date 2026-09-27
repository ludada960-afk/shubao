/* ═══ 批 CX 探针：模板入口收敛后的实测 ═══════════════════════════════════════════════════════════
   ① 画布能开（无错误边界 —— 改了 8000 行的 index.jsx，先跑这个再看端到端）
   ② 顶栏「模板广场」打开的是**真的那套**（WorkflowTemplateGallery：有图结构缩略图/铺开按钮）
   ③ 直达 URL `?page=ec-canvas&tab=templates` 能自动打开它（用户要的"先挑模板再干活"链接路径）
   ④ 「新建画布」按钮在（用户点名的「新建空白画布」）
   用法：node .qa/cx-template-entry.mjs
────────────────────────────────────────────────────────────────────────────────────────────── */
import { chromium } from 'playwright';
import { startDevServer, stopDevServer } from '../test/helpers/live-browser.mjs';

const server = await startDevServer();
if (!server.ok) { console.log('dev server 起不来：' + server.reason); process.exit(1); }
const base = server.base.replace(/\/$/, '');
const browser = await chromium.launch();
const errors = [];
const mock = async page => page.route('**/api/**', route => {
  const path = new URL(route.request().url()).pathname;
  const json = b => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(b) });
  if (path === '/api/session') return json({ ok: true, email: 'p@e.com' });
  if (path === '/api/works') return json({ works: [] });
  if (/workflow-templates/.test(path)) return json({ templates: [], items: [] });
  return json({ ok: true, items: [], draft: null, templates: [] });
});

const galleryState = page => page.evaluate(() => {
  const text = document.body.innerText || '';
  const overlay = Array.from(document.querySelectorAll('div')).find(el => /模板|工作流/.test(el.innerText || '') && getComputedStyle(el).position === 'fixed' && el.getBoundingClientRect().width > 400);
  return {
    errBoundary: /页面出了点问题|is not defined/.test(text),
    galleryText: overlay ? overlay.innerText.replace(/\s+/g, ' ').slice(0, 160) : '',
    hasGallery: Boolean(overlay),
    hasSpread: /铺开|使用|一键/.test(text),
  };
});

/* ① + ② 顶栏按钮 */
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('pageerror', e => errors.push('PAGEERR ' + String(e.message).slice(0, 160)));
  await mock(page);
  await page.goto(base + '/ec-canvas?qa=ec-canvas', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('.ec-canvas-topbar', { timeout: 45000 }).catch(() => {});
  await page.waitForTimeout(2500);
  console.log('   页面正文前 110 字：' + await page.evaluate(() => (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 110)));
  const before = await galleryState(page);
  console.log('① 画布打开：错误边界=' + before.errBoundary + '  模板库已开=' + before.hasGallery);
  const btn = await page.$('button[aria-label*="模板广场"]');
  console.log('② 顶栏「模板广场」按钮：' + (btn ? '存在' : '⚠️ 不存在'));
  if (btn) {
    await btn.click({ force: true }).catch(() => {});
    await page.waitForTimeout(2500);
    const after = await galleryState(page);
    console.log('   点击后：模板库已开=' + after.hasGallery + '  正文「' + after.galleryText + '」');
  }
  const newBtn = await page.$$('button:has-text("新建画布")');
  console.log('④ 「新建画布」按钮个数：' + newBtn.length);
  await page.close();
}

/* ③ 直达 URL */
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('pageerror', e => errors.push('PAGEERR ' + String(e.message).slice(0, 160)));
  await mock(page);
  await page.goto(base + '/ec-canvas?qa=ec-canvas&tab=templates', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('.ec-canvas-topbar', { timeout: 45000 }).catch(() => {});
  await page.waitForTimeout(3000);
  const st = await galleryState(page);
  console.log('③ 直达 ?tab=templates：自动打开=' + st.hasGallery + '  错误边界=' + st.errBoundary + '  正文「' + st.galleryText + '」');
  await page.close();
}

console.log('\n运行时错误：' + (errors.length ? JSON.stringify(errors.slice(0, 5), null, 1) : '无'));
await browser.close();
stopDevServer(server.proc, { owned: server.owned });
