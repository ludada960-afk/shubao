/* 批 CU 诊断 6：逐颗按钮（DOM 级 click）判定"活的 / 死的"，@ 放最后（它会把整个创作框收起来） */
import { chromium } from 'playwright';
import { startDevServer, stopDevServer } from '../test/helpers/live-browser.mjs';

const UPLOAD_FILE = 'public/gallery/ecommerce/baby-bottle-product-suite/01.webp';
const server = await startDevServer();
if (!server.ok) { console.log('dev server 起不来：' + server.reason); process.exit(1); }
const base = server.base.replace(/\/$/, '');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('pageerror', e => console.log('PAGEERR ' + String(e.message).slice(0, 200)));
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

const clickByText = async text => {
  const ok = await page.evaluate(text => {
    const btns = Array.from(document.querySelectorAll('.ec-canvas-suite-controls button, .ec-canvas-suite-settings-control button'));
    const b = text ? btns.find(x => (x.textContent || '').includes(text)) : btns[0];
    if (!b) return false;
    b.click();
    return true;
  }, text);
  await page.waitForTimeout(700);
  const out = await page.evaluate(() => ({
    pops: Array.from(document.querySelectorAll('[class*="popover"]')).map(el => String(el.className).split(' ')[0] + ':' + Math.round(el.getBoundingClientRect().width) + 'x' + Math.round(el.getBoundingClientRect().height)),
    controls: document.querySelectorAll('.ec-canvas-suite-controls').length,
    active: Array.from(document.querySelectorAll('.ec-canvas-suite-controls button')).filter(b => b.classList.contains('is-active')).map(b => (b.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 10)),
  }));
  console.log(`  「${text || '@'}」 → 点得到=${ok} 参数行还在=${out.controls} is-active=${JSON.stringify(out.active)} popover=${JSON.stringify(out.pops)}`);
  return out;
};

console.log('逐颗按钮（DOM 级 click，每颗点两次 = 开/关）：');
for (const t of ['智能套图', 'SKU变体', '技能', '商品信息', 'AI规划', 'GPT Image']) {
  await clickByText(t);
  await clickByText(t);
}
await clickByText('');   /* @ 放最后 */
await browser.close();
stopDevServer(server.proc, { owned: server.owned });
