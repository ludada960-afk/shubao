/* 批 CU 诊断：套图节点参数行的按钮点下去之后**到底发生了什么**（只读，不改代码） */
import { chromium } from 'playwright';
import { startDevServer, stopDevServer } from '../test/helpers/live-browser.mjs';

const UPLOAD_FILE = 'public/gallery/ecommerce/baby-bottle-product-suite/01.webp';
const server = await startDevServer();
if (!server.ok) { console.log('dev server 起不来：' + server.reason); process.exit(1); }
const base = server.base.replace(/\/$/, '');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('pageerror', e => console.log('PAGEERR ' + String(e.message).slice(0, 200)));
page.on('console', m => { if (m.type() === 'error') console.log('CONSOLE ' + m.text().slice(0, 200)); });
await page.route('**/api/**', route => {
  const path = new URL(route.request().url()).pathname;
  const json = body => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  if (path === '/api/session') return json({ ok: true, email: 'p@e.com' });
  if (path === '/api/works') return json({ works: [] });
  return json({ ok: true, items: [], draft: null });
});
await page.goto(base + '/ec-canvas?qa=ec-canvas', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(4000);
for (const input of await page.$$('input[type=file]')) {
  const accept = (await input.getAttribute('accept')) || '';
  if (/video/.test(accept)) continue;
  await input.setInputFiles(UPLOAD_FILE).catch(() => {});
  break;
}
await page.waitForTimeout(2500);
await page.click('[data-derive-action="ecommerce-suite"]', { force: true }).catch(() => {});
await page.waitForTimeout(2500);

const dump = async label => {
  const info = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('.ec-canvas-suite-controls button, .ec-canvas-suite-settings-control button'));
    const popovers = Array.from(document.querySelectorAll('[class*="popover"]')).map(el => ({ cls: String(el.className).slice(0, 56), w: Math.round(el.getBoundingClientRect().width) }));
    return {
      counts: {
        nodes: document.querySelectorAll('[data-canvas-node-id]').length,
        suiteControls: document.querySelectorAll('.ec-canvas-suite-controls').length,
        composer: document.querySelectorAll('.ec-canvas-context-composer').length,
        contextComposer: document.querySelectorAll('.ec-canvas-composer').length,
        mentionMenu: document.querySelectorAll('.ec-canvas-mention-menu, [class*="mention-menu"]').length,
        surface: Array.from(document.querySelectorAll('[data-canvas-surface]')).map(el => el.getAttribute('data-canvas-surface')).slice(0, 4),
      },
      active: btns.map(b => ({ t: (b.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 10), active: b.classList.contains('is-active'), expanded: b.getAttribute('aria-expanded') })),
      popovers: popovers.slice(0, 8),
      bodyLen: document.body.innerHTML.length,
    };
  });
  console.log('\n--- ' + label + ' ---');
  console.log('  计数：' + JSON.stringify(info.counts) + '  bodyLen=' + info.bodyLen);
  console.log('  按钮：' + JSON.stringify(info.active));
  console.log('  popover：' + JSON.stringify(info.popovers));
};

await dump('点之前');
const buttons = await page.$$('.ec-canvas-suite-controls button, .ec-canvas-suite-settings-control button');
for (let i = 0; i < buttons.length; i += 1) {
  const t = ((await buttons[i].textContent()) || '').replace(/\s+/g, ' ').trim().slice(0, 10);
  await buttons[i].click({ force: true }).catch(() => {});
  await page.waitForTimeout(500);
  await dump('点了「' + t + '」之后');
  await page.keyboard.press('Escape').catch(() => {});
  await page.mouse.click(30, 830).catch(() => {});
  await page.waitForTimeout(250);
}
await browser.close();
stopDevServer(server.proc, { owned: server.owned });
