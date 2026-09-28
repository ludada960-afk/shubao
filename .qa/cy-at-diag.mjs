/* 批 CY 诊断：首页·视频生成的 @ 菜单行为什么没有缩略图 —— dump 那一行的 DOM 与素材对象字段 */
import { chromium } from 'playwright';
import { startDevServer, stopDevServer } from '../test/helpers/live-browser.mjs';

const UPLOAD_FILE = 'public/gallery/ecommerce/baby-bottle-product-suite/01.webp';
const server = await startDevServer();
if (!server.ok) { console.log('dev server 起不来：' + server.reason); process.exit(1); }
const base = server.base.replace(/\/$/, '');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
page.on('pageerror', e => console.log('PAGEERR ' + String(e.message).slice(0, 160)));
page.on('console', m => { if (m.type() === 'error') console.log('CONSOLE ' + m.text().slice(0, 200)); });
await page.route('**/api/**', route => {
  const path = new URL(route.request().url()).pathname;
  const json = b => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(b) });
  if (path === '/api/session') return json({ ok: true, email: 'p@e.com' });
  if (path === '/api/works') return json({ works: [] });
  if (path === '/api/video/capabilities') return json({ loading: false, generationEnabled: true, workbenchEnabled: false, directorUi: false, uploadMode: 'tus', products: [] });
  return json({ ok: true, items: [], draft: null });
});
await page.goto(base + '/', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForSelector('.homepage-mode-card', { timeout: 45000 }).catch(() => {});
await page.waitForTimeout(1200);
await page.click('.homepage-mode-card.card-1').catch(() => {});   /* 视频生成 */
await page.waitForTimeout(1000);

for (const input of await page.$$('input[type=file]')) {
  const accept = (await input.getAttribute('accept')) || '';
  if (/video|audio/.test(accept)) continue;
  await input.setInputFiles(UPLOAD_FILE).catch(() => {});
  break;
}
await page.waitForTimeout(2500);

/* 先看素材对象长什么样（从 DOM 能看到的：素材卡的图 src） */
const cardInfo = await page.evaluate(() => {
  const imgs = Array.from(document.querySelectorAll('img')).filter(i => i.getBoundingClientRect().width > 40 && /blob:|data:/.test(i.currentSrc || i.src || ''));
  return imgs.slice(0, 4).map(i => ({ src: String(i.currentSrc || i.src).slice(0, 40), w: Math.round(i.getBoundingClientRect().width) }));
});
console.log('页面上带预览的 <img>：' + JSON.stringify(cardInfo));

await page.evaluate(() => document.querySelector('.image-mention-trigger')?.click());
await page.waitForTimeout(800);
const dump = await page.evaluate(() => {
  const menu = document.querySelector('.image-mention-menu');
  if (!menu) return { present: false };
  const row = menu.querySelector('button');
  return {
    present: true,
    menuClass: menu.className,
    rowClass: row?.className || '',
    rowHtml: (row?.innerHTML || '').replace(/\s+/g, ' ').slice(0, 400),
    rowGridCols: row ? getComputedStyle(row).gridTemplateColumns : '',
    hasKindThumb: Boolean(menu.querySelector('.image-mention-kind.is-thumb')),
    hasPlainKind: Boolean(menu.querySelector('.image-mention-kind:not(.is-thumb)')),
    imgsInMenu: menu.querySelectorAll('img').length,
  };
});
console.log('菜单 dump：' + JSON.stringify(dump, null, 1));
await browser.close();
stopDevServer(server.proc, { owned: server.owned });
