/* ═══ 批 CU：按钮区**适配**实测 —— 把创作台面板强制成 5 档宽度，逐行量"内容有没有溢出面板" ═══════
   为什么用强制宽度：节点宽度由画布状态决定，探针没法稳定地把它拖窄（resize 手柄在创作台上不一定渲染）。
   而"超出框的边界"这件事的判据与宽度来源无关：**行内容宽度 > 面板内容盒宽度** 就是溢出。
   量法：对面板里每个直接子行，比较 scrollWidth / 子元素右缘 vs 面板 clientWidth。
   用法：node .qa/cu-adapt.mjs
─────────────────────────────────────────────────────────────────────────────────────────────── */
import { chromium } from 'playwright';
import { startDevServer, stopDevServer } from '../test/helpers/live-browser.mjs';

const UPLOAD_FILE = 'public/gallery/ecommerce/baby-bottle-product-suite/01.webp';
const server = await startDevServer();
if (!server.ok) { console.log('dev server 起不来：' + server.reason); process.exit(1); }
const base = server.base.replace(/\/$/, '');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
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

const measure = width => page.evaluate(width => {
  const host = document.querySelector('.ec-canvas-node-composer');
  if (!host) return { err: 'no composer' };
  host.style.width = width + 'px';
  host.style.maxWidth = width + 'px';
  const hb = host.getBoundingClientRect();
  const rows = Array.from(host.children).map(el => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return {
      cls: String(el.className).split(' ').slice(0, 2).join('.'),
      w: Math.round(r.width),
      scrollW: el.scrollWidth,
      clientW: el.clientWidth,
      overRight: Math.round(r.right - hb.right),
      wrap: cs.flexWrap,
    };
  });
  /* 深一层：每一行里最右的可交互子元素右缘（用户看到的就是按钮被挤出框） */
  const deep = [];
  for (const el of host.querySelectorAll('.ec-canvas-suite-controls, .ec-canvas-composer-footer, .ec-canvas-suite-source-rows, .ec-canvas-parameter-controls')) {
    const r = el.getBoundingClientRect();
    const kids = Array.from(el.children).map(k => Math.round(k.getBoundingClientRect().right));
    if (!kids.length) continue;
    deep.push({ cls: String(el.className).split(' ').slice(0, 2).join('.'), right: Math.round(r.right), maxKidRight: Math.max(...kids), over: Math.round(Math.max(...kids) - r.right) });
  }
  return { host: { w: Math.round(hb.width), scrollW: host.scrollWidth, clientW: host.clientWidth }, rows, deep };
}, width);

for (const w of [620, 540, 480, 435, 380, 320]) {
  const m = await measure(w);
  if (m.err) { console.log('w=' + w + ' → ' + m.err); continue; }
  const rowOver = m.rows.filter(r => r.scrollW > r.clientW + 1 || r.overRight > 1);
  const deepOver = m.deep.filter(d => d.over > 1);
  console.log('\nw=' + w + '  面板 ' + m.host.w + '（scrollW=' + m.host.scrollW + ' clientW=' + m.host.clientW + '）'
    + '  行溢出 ' + rowOver.length + ' 条 / 内部子元素溢出 ' + deepOver.length + ' 条');
  for (const r of rowOver) console.log('   ⚠️ 行 ' + r.cls.padEnd(34) + ' w=' + r.w + ' scrollW=' + r.scrollW + ' clientW=' + r.clientW + ' 右溢 ' + r.overRight + ' wrap=' + r.wrap);
  for (const d of deepOver) console.log('   ⚠️ 内部 ' + d.cls.padEnd(34) + ' 最右子元素右缘 ' + d.maxKidRight + ' > 行右缘 ' + d.right + '（溢 ' + d.over + 'px）');
}
await browser.close();
stopDevServer(server.proc, { owned: server.owned });
