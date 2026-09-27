/* ═══ 批 CU 探针（2026-09-27）：四个生成框的**按钮区适配** —— 有没有内容超出框的边界 ═════════════
   用户原话（逐字）：「而且你这里现在这些**按钮区的适配现在也没有做好，很多部分，它现在都是
   **超出框的边界**的。可能不止电商套图有存在这个问题，其他的区域应该也有存在这些问题，
   像**生成文案啊，生成图片啊，生成视频**啊，他们那边应该也有这些类似的问题存在，
   那你都得去把他们给解决掉。」
   量什么：每个框在**三档宽度**（原宽 / 收窄 150 / 收窄 300）下，
          ① 节点框 [data-canvas-node-id] 的矩形；② 创作台面板（.ec-canvas-node-composer）的矩形；
          ③ 面板内每一行的左右缘 —— 任何一行 right > 面板 right 或 left < 面板 left 记一条越界。
   用法：node .qa/cu-overflow.mjs
─────────────────────────────────────────────────────────────────────────────────────────────── */
import { chromium } from 'playwright';
import { startDevServer, stopDevServer } from '../test/helpers/live-browser.mjs';

const UPLOAD_FILE = 'public/gallery/ecommerce/baby-bottle-product-suite/01.webp';
const server = await startDevServer();
if (!server.ok) { console.log('dev server 起不来：' + server.reason); process.exit(1); }
const base = server.base.replace(/\/$/, '');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', e => errors.push('PAGEERR ' + String(e.message).slice(0, 160)));
await page.route('**/api/**', route => {
  const path = new URL(route.request().url()).pathname;
  const json = body => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  if (path === '/api/session') return json({ ok: true, email: 'p@e.com' });
  if (path === '/api/works') return json({ works: [] });
  return json({ ok: true, items: [], draft: null });
});
await page.goto(base + '/ec-canvas?qa=ec-canvas', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(4000);

/* 上传一张素材（派生菜单里的四个动作都靠它当来源） */
for (const input of await page.$$('input[type=file]')) {
  const accept = (await input.getAttribute('accept')) || '';
  if (/video/.test(accept)) continue;
  await input.setInputFiles(UPLOAD_FILE).catch(() => {});
  break;
}
await page.waitForTimeout(2500);

const measure = () => page.evaluate(() => {
  const node = document.querySelector('.ec-canvas-node-composer');
  if (!node) return null;
  const host = node.getBoundingClientRect();
  const rows = Array.from(node.querySelectorAll(':scope > *, :scope > * > *'))
    .map(el => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      if (r.width < 10 || cs.display === 'contents') return null;
      return {
        cls: String(el.className).split(' ').slice(0, 2).join('.').slice(0, 40),
        left: Math.round(r.left), right: Math.round(r.right), w: Math.round(r.width),
        overRight: Math.round(r.right - host.right), overLeft: Math.round(r.left - host.left),
      };
    }).filter(Boolean);
  return {
    host: { left: Math.round(host.left), right: Math.round(host.right), w: Math.round(host.width) },
    nodeKind: String(node.className).match(/ec-canvas-(node-composer)/) ? node.className : '',
    rows,
    over: rows.filter(r => r.overRight > 1 || r.overLeft < -1),
  };
});

for (const [action, label] of [['ecommerce-suite', '电商套图'], ['text-generation', '生成文案'], ['image-edit', '图片生成'], ['video-generation', '生成视频']]) {
  /* 从派生菜单进（上传后菜单会自动张开；若已关就点加号重开） */
  const hasMenu = await page.$('[data-derive-action="' + action + '"]');
  if (!hasMenu) {
    const ports = await page.evaluate(() => Array.from(document.querySelectorAll('[data-canvas-port-role="output"]'))
      .map(el => { const r = el.getBoundingClientRect(); return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2), op: getComputedStyle(el).opacity }; })
      .filter(p => Number(p.op) > 0.5));
    if (ports.length) { await page.mouse.click(ports[0].x, ports[0].y); await page.waitForTimeout(700); }
  }
  const ok = await page.click('[data-derive-action="' + action + '"]', { force: true }).then(() => true).catch(() => false);
  await page.waitForTimeout(2200);
  const m0 = await measure();
  console.log('\n===== ' + label + '（' + action + '）新建=' + ok + ' =====');
  if (!m0) { console.log('  ⚠️ 没量到 .ec-canvas-node-composer（这一支可能不是 node-composer 结构）'); continue; }
  console.log('  原宽：面板 ' + m0.host.left + '..' + m0.host.right + '（w=' + m0.host.w + '）  越界行 ' + m0.over.length + ' 条');
  for (const r of m0.over) console.log('     ⚠️ ' + r.cls.padEnd(40) + ' ' + r.left + '..' + r.right + ' 右溢 ' + r.overRight + 'px');

  /* 收窄：拖右下角 resize 手柄（没有就用 east 手柄） */
  for (const delta of [-150, -150]) {
    const handle = await page.$('.ec-canvas-resize-handle.is-se, .ec-canvas-resize-handle.is-e');
    if (!handle) { console.log('  ⚠️ 找不到 resize 手柄'); break; }
    const box = await handle.boundingBox();
    if (!box) break;
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + delta, cy + (delta / 6), { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(600);
    const m = await measure();
    if (!m) { console.log('  （收窄后量不到面板）'); break; }
    console.log('  收窄后：面板 ' + m.host.left + '..' + m.host.right + '（w=' + m.host.w + '）  越界行 ' + m.over.length + ' 条');
    for (const r of m.over) console.log('     ⚠️ ' + r.cls.padEnd(40) + ' ' + r.left + '..' + r.right + ' 右溢 ' + r.overRight + 'px');
  }
  /* 换下一个框之前把这个框删掉，避免互相干扰 */
  await page.keyboard.press('Delete').catch(() => {});
  await page.waitForTimeout(500);
}
console.log('\n运行时错误：' + (errors.length ? JSON.stringify(errors.slice(0, 4)) : '无'));
await page.screenshot({ path: '.playwright-shots/cu-overflow.png' }).catch(() => {});
await browser.close();
stopDevServer(server.proc, { owned: server.owned });
