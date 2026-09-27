/* 批 CU 诊断 3：**先把套图节点挪进视口**，再点它的参数按钮（上一次探针把节点留在视口外，
   点击落在别的元素上，把"点不到"误读成了"按钮失效" —— 这条教训写进探针注释）。 */
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

/* ① 把画布缩放/平移调到能看见套图框（优先点缩放条里的"适应视口"，没有就用手动拖） */
const zoomBtns = await page.evaluate(() => Array.from(document.querySelectorAll('.ec-canvas-zoom-controls button')).map(b => ({ label: b.getAttribute('aria-label'), title: b.getAttribute('title') })));
console.log('缩放条按钮：' + JSON.stringify(zoomBtns));
const fit = await page.$('.ec-canvas-zoom-controls button[aria-label*="适应"], .ec-canvas-zoom-controls button[title*="适应"]');
if (fit) { await fit.click({ force: true }).catch(() => {}); await page.waitForTimeout(900); }
const composerRect0 = await page.evaluate(() => {
  const el = document.querySelector('.ec-canvas-suite-controls');
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), inView: r.x >= 0 && r.right <= window.innerWidth && r.y >= 0 && r.bottom <= window.innerHeight };
});
console.log('套图参数行 rect：' + JSON.stringify(composerRect0));

/* ⚠️ 关键：把套图节点**拖到画布中央**再点 —— 第一次诊断时它正好压在左下角缩放条下面，
   elementFromPoint 命中的是缩放条，于是"点不到"被误读成"按钮失效"（层叠问题，不是按钮问题）。 */
const dragNodeToCenter = async () => {
  const node = await page.$('.ec-canvas-node-composer');
  if (!node) return null;
  const box = await node.boundingBox();
  if (!box) return null;
  const label = await page.evaluate(() => (document.querySelector('.ec-canvas-node-composer')?.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 24));
  console.log('套图节点在 ' + JSON.stringify({ x: Math.round(box.x), y: Math.round(box.y), w: Math.round(box.width), h: Math.round(box.height) }) + ' 标题「' + label + '」');
  await page.mouse.move(box.x + box.width / 2, box.y + 10);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 120, box.y + 10 + 60, { steps: 8 });
  await page.mouse.move(820, 380, { steps: 14 });
  await page.mouse.up();
  await page.waitForTimeout(700);
  return box;
};
if (!composerRect0 || composerRect0.y > 600) await dragNodeToCenter();
const after = await page.evaluate(() => {
  const el = document.querySelector('.ec-canvas-suite-controls');
  if (!el) return null;
  const r = el.getBoundingClientRect();
  const btn = el.querySelector('button');
  const br = btn?.getBoundingClientRect();
  const hit = br ? document.elementFromPoint(Math.round(br.x + br.width / 2), Math.round(br.y + br.height / 2)) : null;
  return { row: { x: Math.round(r.x), y: Math.round(r.y) }, firstBtnHit: hit ? String(hit.className).slice(0, 34) : null };
});
console.log('拖动后：' + JSON.stringify(after));

/* ② 逐个点参数按钮：先确认 elementFromPoint 命中的就是那颗按钮，再点 */
const targets = await page.evaluate(() => Array.from(document.querySelectorAll('.ec-canvas-suite-controls button, .ec-canvas-suite-settings-control button'))
  .map((el, i) => {
    const r = el.getBoundingClientRect();
    return { i, t: (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 12), x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2), w: Math.round(r.width) };
  })
  .filter(b => b.w > 0));
console.log('\n参数按钮：' + JSON.stringify(targets));
for (const b of targets) {
  const hit = await page.evaluate(([x, y]) => {
    const el = document.elementFromPoint(x, y);
    return el ? { cls: String(el.className).slice(0, 30), text: (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 12) } : null;
  }, [b.x, b.y]);
  await page.mouse.click(b.x, b.y);
  await page.waitForTimeout(650);
  const state = await page.evaluate(() => {
    const pop = document.querySelector('.ec-canvas-suite-panel-popover, [class*="suite-panel-popover"]');
    const controls = document.querySelectorAll('.ec-canvas-suite-controls').length;
    if (!pop) return { controls, popover: null };
    const r = pop.getBoundingClientRect();
    return { controls, popover: { w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.x), y: Math.round(r.y), text: (pop.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60) } };
  });
  console.log(`  点「${b.t}」@(${b.x},${b.y}) 命中=${JSON.stringify(hit)} → ${state.popover ? '✅ 面板 ' + state.popover.w + '×' + state.popover.h + ' 「' + state.popover.text + '」' : '❌ 没有面板'}（参数行还在？controls=${state.controls}）`);
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(250);
}
await page.screenshot({ path: '.playwright-shots/cu/20-suite-params.png' });
await browser.close();
stopDevServer(server.proc, { owned: server.owned });
