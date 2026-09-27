/* 批 CU 诊断 4：把点击**直接派发给按钮本身**（绕开层叠/命中测试），看处理函数到底活不活。
   两种结论分开：
     · DOM 级 click 也开不出面板 → 处理函数/状态坏了（真"失效"）；
     · DOM 级 click 能开面板，但鼠标点在坐标上没反应 → 是**层叠/定位**问题（面板被别的层盖住或算出屏）。 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { startDevServer, stopDevServer } from '../test/helpers/live-browser.mjs';

const UPLOAD_FILE = 'public/gallery/ecommerce/baby-bottle-product-suite/01.webp';
mkdirSync('.playwright-shots/cu', { recursive: true });
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

const probe = async label => {
  const out = await page.evaluate(() => {
    const pops = Array.from(document.querySelectorAll('[class*="popover"]')).map(el => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return { cls: String(el.className).slice(0, 50), x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), vis: cs.visibility, op: cs.opacity, z: cs.zIndex };
    });
    const active = Array.from(document.querySelectorAll('.ec-canvas-suite-controls button')).map(b => ({ t: (b.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 8), act: b.classList.contains('is-active'), exp: b.getAttribute('aria-expanded') }));
    return { pops, active, controls: document.querySelectorAll('.ec-canvas-suite-controls').length };
  });
  console.log('\n### ' + label + '\n' + JSON.stringify(out, null, 1));
  return out;
};

await probe('初始');
/* 直接给按钮派发 click（不经命中测试） */
const clicked = await page.evaluate(() => {
  const btns = Array.from(document.querySelectorAll('.ec-canvas-suite-controls button'));
  const target = btns.find(b => (b.textContent || '').includes('商品信息')) || btns[btns.length - 1];
  if (!target) return null;
  target.click();
  return (target.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 10);
});
console.log('\nDOM 级 click 派发给：' + clicked);
await page.waitForTimeout(900);
const after = await probe('DOM 级 click「商品信息」之后');
await page.screenshot({ path: '.playwright-shots/cu/30-dom-click.png' });

/* 再直接派发给「生成设置」（底栏那颗模型按钮） */
const clicked2 = await page.evaluate(() => {
  const btns = Array.from(document.querySelectorAll('.ec-canvas-suite-settings-control button'));
  if (!btns.length) return null;
  btns[0].click();
  return (btns[0].textContent || '').replace(/\s+/g, ' ').trim().slice(0, 14);
});
console.log('\nDOM 级 click 派发给：' + clicked2);
await page.waitForTimeout(900);
await probe('DOM 级 click「生成设置」之后');
await page.screenshot({ path: '.playwright-shots/cu/31-dom-click-settings.png' });

console.log('\n结论提示：面板若在 pops 里出现 → 处理函数是活的，问题在层叠/定位；若始终为空 → 处理函数/状态真的没动。');
await browser.close();
stopDevServer(server.proc, { owned: server.owned });
