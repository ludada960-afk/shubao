/* ═══ 批 CU 探针 2（2026-09-27）：画布「电商套图」节点里的按钮还活着吗 + 内容有没有超出框 ═══════
   用户原话（逐字）：
     「像这个**商品信息**AI规划这些按钮现在其实都是**失效的状态**。我点击了是没有反应的，
      那我觉得这些东西**可以不要了，你就直接拿掉吧**。然后**模型的选择和生成配置的那些按钮，
      你看是不是应该拿上来呢**？而且你这里现在这些**按钮区的适配现在也没有做好，很多部分，
      它现在都是超出框的边界**的。可能不止电商套图有存在这个问题，其他的区域应该也有存在这些问题，
      像**生成文案啊，生成图片啊，生成视频**啊，他们那边应该也有这些类似的问题存在，
      那你都得去把他们给解决掉。」
   量什么：① 每个参数按钮点下去，`.ec-canvas-suite-panel-popover` 到底出不出来（出来=活的，不出来=死按钮）；
          ② 节点框 rect 与内部每一行的 rect —— 有没有行宽/行右缘超出框右缘（"超出框的边界"）。
   用法：node .qa/cu-suite-node.mjs
────────────────────────────────────────────────────────────────────────────────────────────── */
import { chromium } from 'playwright';
import { startDevServer, stopDevServer } from '../test/helpers/live-browser.mjs';

const UPLOAD_FILE = 'public/gallery/ecommerce/baby-bottle-product-suite/01.webp';
const server = await startDevServer();
if (!server.ok) { console.log('dev server 起不来：' + server.reason); process.exit(1); }
const base = server.base.replace(/\/$/, '');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', e => errors.push('PAGEERR ' + String(e.message).slice(0, 200)));
page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE ' + m.text().slice(0, 180)); });
await page.route('**/api/**', route => {
  const path = new URL(route.request().url()).pathname;
  const json = body => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  if (path === '/api/session') return json({ ok: true, email: 'p@e.com' });
  if (path === '/api/works') return json({ works: [] });
  return json({ ok: true, items: [], draft: null });
});

await page.goto(base + '/ec-canvas?qa=ec-canvas', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(4000);

/* ① 上传一张素材 → 派生菜单里点「电商套图」→ 套图节点落画布（与用户的操作路径一致） */
const inputs = await page.$$('input[type=file]');
for (const input of inputs) {
  const accept = (await input.getAttribute('accept')) || '';
  if (/video/.test(accept)) continue;
  await input.setInputFiles(UPLOAD_FILE).catch(() => {});
  break;
}
await page.waitForTimeout(2500);
const tile = await page.$('[data-derive-action="ecommerce-suite"]');
console.log('派生菜单里的「电商套图」格子：' + (tile ? '找到了' : '⚠️ 没找到'));
if (tile) await tile.click({ force: true }).catch(e => console.log('点击失败：' + String(e.message).slice(0, 90)));
await page.waitForTimeout(2200);

/* ② 套图节点：框 rect + 内部每一行的 rect（查"超出框的边界"） */
const layout = await page.evaluate(() => {
  const node = document.querySelector('[data-canvas-node-id], [data-node-id]');
  const frames = Array.from(document.querySelectorAll('.ec-canvas-suite-composer, .ec-canvas-composer, .ec-canvas-node'))
    .map(el => ({ cls: String(el.className).slice(0, 60), r: el.getBoundingClientRect() }))
    .filter(x => x.r.width > 120);
  const host = frames.find(f => /suite/i.test(f.cls)) || frames[0];
  if (!host) return { err: '没找到套图节点容器', frames: frames.length };
  const hostRect = host.r;
  const rows = Array.from(host.el ? [] : host.element ? [] : []);
  return { host: { cls: host.cls, x: Math.round(hostRect.x), w: Math.round(hostRect.width), h: Math.round(hostRect.height) }, frames: frames.length };
});
console.log('\n② 套图节点容器：' + JSON.stringify(layout));

const overflow = await page.evaluate(() => {
  const host = document.querySelector('.ec-canvas-suite-composer, .ec-canvas-composer');
  if (!host) return { err: '没有 .ec-canvas-suite-composer / .ec-canvas-composer' };
  const hr = host.getBoundingClientRect();
  const rows = Array.from(host.querySelectorAll(':scope > *, :scope > * > *'))
    .map(el => { const r = el.getBoundingClientRect(); return { cls: String(el.className).slice(0, 44), left: Math.round(r.left), right: Math.round(r.right), w: Math.round(r.width), over: Math.round(r.right - hr.right) }; })
    .filter(x => x.w > 8);
  return { host: { left: Math.round(hr.left), right: Math.round(hr.right), w: Math.round(hr.width) }, rows: rows.slice(0, 24) };
});
console.log('   框与内部各行（over = 右缘超出框右缘多少 px）：');
if (overflow.err) console.log('   ⚠️ ' + overflow.err);
else {
  console.log('   框 left=' + overflow.host.left + ' right=' + overflow.host.right + ' w=' + overflow.host.w);
  for (const r of overflow.rows) console.log('     ' + String(r.cls).padEnd(46) + ' ' + r.left + '..' + r.right + ' w=' + r.w + (r.over > 0 ? '  ⚠️ 超出 ' + r.over + 'px' : ''));
}

/* ③ 每个参数按钮点一次：popover 出不出来 */
const buttons = await page.$$('.ec-canvas-suite-controls button, .ec-canvas-suite-settings-control button');
console.log('\n③ 参数行按钮共 ' + buttons.length + ' 个，逐个点一遍：');
for (let i = 0; i < buttons.length; i += 1) {
  const text = (await buttons[i].textContent() || '').replace(/\s+/g, ' ').trim().slice(0, 16);
  await buttons[i].click({ force: true }).catch(() => {});
  await page.waitForTimeout(600);
  const state = await page.evaluate(() => {
    const pop = document.querySelector('.ec-canvas-suite-panel-popover');
    if (!pop) return { present: false };
    const r = pop.getBoundingClientRect();
    return { present: true, w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.x), y: Math.round(r.y), text: (pop.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 48) };
  });
  console.log('   「' + text + '」 → ' + (state.present ? '✅ 面板开了 ' + state.w + '×' + state.h + ' 「' + state.text + '」' : '❌ 点了没反应（没有 .ec-canvas-suite-panel-popover）'));
  await page.keyboard.press('Escape').catch(() => {});
  await page.mouse.click(20, 700).catch(() => {});
  await page.waitForTimeout(350);
}

console.log('\n运行时错误：' + (errors.length ? JSON.stringify(errors.slice(0, 6), null, 1) : '无'));
await page.screenshot({ path: '.playwright-shots/cu-suite-node.png' }).catch(() => {});
await browser.close();
stopDevServer(server.proc, { owned: server.owned });
