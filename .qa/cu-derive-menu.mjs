/* ═══ 批 CU 探针（2026-09-27）：画布「右侧加号的派生选项区」三个入口都要能张开 ═══════════════════
   用户原话（逐字）：
     「你现在画布进来的话，随便上传一个素材，**右边的这个加号里面的选项都不见了**呀。怎么丢失了呀？
      之前不是跟你说了吗？我们进来之后随便上传一个素材，**它应该自动张开右边的这个加号的选项区**呀。
      然后我刚刚试了一下**右边的加号一拉动。鼠标停下来，它依然没有出现选项区**呀。
      你这可能又是一个bug，你要去解决掉。」
   三个入口：① 上传素材后自动张开（openConnectionPickerForNode 不传 triggerEl）
            ② 点一下加号（handlePortClick，带触发按钮的视口矩形）
            ③ 拖动加号 → 在空白处松手（handlePointerUp 的 connect 分支）
   判据：`.ec-canvas-derive-menu` 必须真实渲染出来，且**逐项打印**菜单 rect 与条目数
        （不许把"没渲染"读成"渲染了但看不见" —— 批 CR 的纪律）。
   用法：node .qa/cu-derive-menu.mjs
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
page.on('pageerror', e => errors.push('PAGEERR ' + String(e.message).slice(0, 200)));
page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE ' + m.text().slice(0, 180)); });
await page.route('**/api/**', route => {
  const path = new URL(route.request().url()).pathname;
  const json = body => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  if (path === '/api/session') return json({ ok: true, email: 'p@e.com' });
  if (path === '/api/works') return json({ works: [] });
  if (path === '/api/canvas/drafts' || path.startsWith('/api/canvas')) return json({ ok: true, draft: null, items: [] });
  return json({ ok: true });
});

const menuState = () => page.evaluate(() => {
  const menu = document.querySelector('.ec-canvas-derive-menu');
  if (!menu) return { present: false };
  const r = menu.getBoundingClientRect();
  const cs = getComputedStyle(menu);
  const tiles = Array.from(menu.querySelectorAll('[data-derive-action]')).map(b => (b.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 18));
  return {
    present: true,
    rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
    visible: r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && Number(cs.opacity) > 0,
    inViewport: r.x >= 0 && r.y >= 0 && r.right <= window.innerWidth + 1 && r.bottom <= window.innerHeight + 1,
    tiles,
    heading: (menu.querySelector('.ec-canvas-menu-heading')?.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40),
  };
});

await page.goto(base + '/ec-canvas?qa=ec-canvas', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(4000);
console.log('画布已打开：' + await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').slice(0, 60)));

/* ── ① 上传素材 → 派生选项区应当**自动张开** ───────────────────────────────────────────── */
const inputs = await page.$$('input[type=file]');
console.log('\n① 上传素材后自动张开 —— 页面上 file input 个数 = ' + inputs.length);
let uploaded = false;
for (const input of inputs) {
  const accept = (await input.getAttribute('accept')) || '';
  if (/video/.test(accept)) continue;
  await input.setInputFiles(UPLOAD_FILE).catch(() => {});
  uploaded = true;
  break;
}
if (!uploaded) console.log('   ⚠️ 没找到可用的图片 file input');
await page.waitForTimeout(2500);
const afterUpload = await menuState();
console.log('   上传后菜单：' + JSON.stringify(afterUpload));
console.log('   节点数 = ' + await page.evaluate(() => document.querySelectorAll('[data-canvas-node-id], [data-node-id]').length));

/* 关掉菜单，准备第 ② 步（顺手把刚上传的素材**重新点一次**选中 —— 用户就是这么做的：
   "随便上传一个素材" → 素材亮着 + 右侧加号可见） */
await page.keyboard.press('Escape').catch(() => {});
await page.click('.ec-canvas-derive-menu .ec-canvas-menu-heading button[aria-label="关闭派生菜单"]').catch(() => {});
await page.waitForTimeout(400);
console.log('   关闭后菜单：' + JSON.stringify(await menuState()));

const allPorts = () => page.evaluate(() => Array.from(document.querySelectorAll('[data-canvas-port-role]'))
  .map((el, i) => {
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return {
      i, role: el.getAttribute('data-canvas-port-role'), cls: String(el.className).slice(0, 26),
      opacity: cs.opacity, pe: cs.pointerEvents, display: cs.display, tag: el.tagName.toLowerCase(),
      x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height),
    };
  }));
console.log('   端口清单（未过滤）：' + JSON.stringify(await allPorts()));

/* 用真实鼠标点一下最后落下的那个素材节点（把它选中），端口才会可见 */
const lastNode = await page.evaluate(() => {
  const nodes = Array.from(document.querySelectorAll('[data-canvas-node-id]')).map(el => {
    const r = el.getBoundingClientRect();
    return { id: el.getAttribute('data-canvas-node-id'), x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2), w: Math.round(r.width) };
  });
  return nodes.sort((a, b) => b.x - a.x)[0] || nodes[0] || null;
});
if (lastNode) {
  await page.mouse.click(lastNode.x, lastNode.y);
  await page.waitForTimeout(600);
  console.log('   点节点 ' + lastNode.id + ' @(' + lastNode.x + ',' + lastNode.y + ') 之后端口：' + JSON.stringify((await allPorts()).filter(p => Number(p.opacity) > 0.5)));
}

/* ── ② 点一下加号 → 菜单应当张开 ─────────────────────────────────────────────────────────
   ⚠️ 只能点**可见的那个**加号（`pointerEvents: auto` + opacity 1）——
   画布上每个节点都有一个 `[data-canvas-port-role]`，未选中的那些是 `pointerEvents: none` 的隐形锚点，
   点它们等于点空气（第一次跑探针就是这么误判成"点了没反应"的）。 */
const visiblePorts = async () => page.evaluate(() => Array.from(document.querySelectorAll('.ec-canvas-node-port, [data-canvas-port-role="output"]'))
  .map((el, i) => {
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return { i, role: el.getAttribute('data-canvas-port-role'), opacity: cs.opacity, pe: cs.pointerEvents, x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2), w: Math.round(r.width) };
  })
  .filter(p => Number(p.opacity) > 0.5 && p.pe !== 'none'));
const ports = await visiblePorts();
console.log('\n② 点加号 —— 可见端口 ' + ports.length + ' 个：' + JSON.stringify(ports));
if (ports.length) {
  const p = ports[ports.length - 1];
  await page.mouse.click(p.x, p.y);
  await page.waitForTimeout(700);
  console.log('   点击 (' + p.x + ',' + p.y + ') 后菜单：' + JSON.stringify(await menuState()));
} else {
  console.log('   ⚠️ 没有可见端口（节点没选中？）');
}

/* ── ③ 拖动加号 → 空白处松手 → 菜单应当张开 ─────────────────────────────────────────────── */
await page.click('.ec-canvas-derive-menu .ec-canvas-menu-heading button[aria-label="关闭派生菜单"]').catch(() => {});
await page.waitForTimeout(300);
if (ports.length) {
  const p = ports[ports.length - 1];
  /* ⚠️ 落点必须是**画布空白**（不是右侧面板 —— 第一次跑探针往右下拖正好落进面板里，
     stage 的 pointerup 收不到，于是误判成"拖拽坏了"）。先确认落点下面是谁。 */
  const dropX = 640;
  const dropY = 660;
  const under = await page.evaluate(([x, y]) => {
    const el = document.elementFromPoint(x, y);
    return el ? String(el.className || el.tagName).slice(0, 60) : 'null';
  }, [dropX, dropY]);
  console.log('\n③ 拖加号到空白处松手 —— 从 (' + p.x + ',' + p.y + ') 拖到 (' + dropX + ',' + dropY + ')；落点下面是：' + under);
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.mouse.move((p.x + dropX) / 2, (p.y + dropY) / 2, { steps: 10 });
  await page.mouse.move(dropX, dropY, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(900);
  console.log('   松手后菜单：' + JSON.stringify(await menuState()));
}

console.log('\n运行时错误：' + (errors.length ? JSON.stringify(errors.slice(0, 6), null, 1) : '无'));

/* ── ④ 拖加号 → 在**右侧面板上**松手（stage 收不到 pointerup）→ 菜单仍应张开、且不残留 connect 态 ──
   批 CU 补的 window 兜底就是为这一条：用户把线往右拖，很容易松在面板上。 */
await page.click('.ec-canvas-derive-menu .ec-canvas-menu-heading button[aria-label="关闭派生菜单"]').catch(() => {});
await page.waitForTimeout(300);
if (ports.length) {
  const p = ports[ports.length - 1];
  const overX = 1220;
  const overY = 420;
  const under = await page.evaluate(([x, y]) => {
    const el = document.elementFromPoint(x, y);
    return el ? String(el.className || el.tagName).slice(0, 50) : 'null';
  }, [overX, overY]);
  console.log('\n④ 拖加号 → 在右侧面板上松手 —— 落点下面：' + under);
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.mouse.move((p.x + overX) / 2, (p.y + overY) / 2, { steps: 10 });
  await page.mouse.move(overX, overY, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(800);
  console.log('   松手后菜单：' + JSON.stringify(await menuState()));
  /* 不残留 connect 态：再点一下空白，草稿线应当不在 */
  const draft = await page.evaluate(() => document.querySelectorAll('.ec-canvas-connection-draft, [class*="connection-draft"]').length);
  console.log('   残留的连接草稿元素 = ' + draft + '（应为 0）');
}
await page.screenshot({ path: '.playwright-shots/cu-derive-menu.png' }).catch(() => {});
await browser.close();
stopDevServer(server.proc, { owned: server.owned });
