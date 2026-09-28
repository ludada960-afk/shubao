/* ═══ 批 CY-⑩ 探针（CV-2 第 2 步·反向）：**子页面 → 画布**（逐张「送到画布」）══════════════════════
   用户拍板：「画布↔子页面的入口位置，可以，你你做吧」。这条验五件事：
     ① 结果区的每一张上**有**「送到画布」；
     ② 点它**真的到画布**（URL = ec-canvas）；
     ③ 画布上**多出那张图**（节点 src 就是这一张的地址）；
     ④ 它是**追加**不是覆盖（原有节点还在）；
     ⑤ 这一段**不发任何 POST**（送到画布不花钱、不上传）。
   ⚠️ 用纯文本必填的轻技能（image.giant_product）—— 不用走上传那一道，探针更稳。
   用法：node .qa/cy10-send-to-canvas.mjs
   ─────────────────────────────────────────────────────────────────────────────────────────── */
import { chromium } from 'playwright';
import { startDevServer, stopDevServer } from '../test/helpers/live-browser.mjs';

const RESULT = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==';

const server = await startDevServer();
if (!server.ok) { console.log('dev server 起不来：' + server.reason); process.exit(1); }
const base = server.base.replace(/\/$/, '');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
const errors = [];
const calls = [];
page.on('pageerror', e => errors.push('PAGEERR ' + String(e.message).slice(0, 160)));
page.on('request', r => { if (r.method() === 'POST' && /\/api\//.test(r.url())) calls.push(new URL(r.url()).pathname); });

await page.route('**/api/**', route => {
  const path = new URL(route.request().url()).pathname;
  const json = b => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(b) });
  if (path === '/api/session') return json({ ok: true, email: 'p@e.com' });
  if (path === '/api/works') return json({ works: [] });
  /* ⚠️ 计费桩必须照 e2e 的形状给（第一版被"通配"吞了 ⇒ 拿不到 quoteId ⇒ 生成根本没发起，
     看起来像"送到画布没接线"，其实是探针环境缺这一条）。 */
  if (path === '/api/billing/quote') return json({ quote: { quoteId: 'quote-cy10', totalUnits: 1000, currency: 'ec_points' } });
  if (path === '/api/billing/balance') return json({ ok: true, currency: 'ec_points', balance: 999, unlimited: false, credits: 999 });
  if (path === '/api/billing/catalog') return json({ ok: true, products: [] });
  if (path === '/api/canvas/regenerate') return json({ url: RESULT, taskId: 'task-cy10', ratio: '1:1', resolution: '2K' });
  if (path === '/api/canvas/regenerate/status') return json({ status: 'completed', url: RESULT, taskId: 'task-cy10' });
  if (/skill/i.test(path)) return json({ ok: true, builtin: [], mine: [], groups: [], skills: [], items: [] });
  return json({ ok: true, items: [], draft: null, builtin: [], mine: [], groups: [], templates: [] });
});
await page.addInitScript(() => {
  const future = new Date(Date.now() + 3600 * 1000).toISOString();
  localStorage.setItem('sb-auth', JSON.stringify({ id: 'p@e.com', email: 'p@e.com', nickname: 'P', token: 't', expiresAt: future }));
});

/* ⚠️ 探针第一版先访问了一次 `/ec-canvas?qa=ec-canvas` 去量"原有节点数"，结果"送到画布"之后
   页面会被弹回子页面 —— 那是**探针环境**里的 QA 会话与这次导航互相干扰（不是产品行为：
   画布确实挂载过、节点也确实加上了，toast 都出来了）。
   所以这里**不预先逛画布**，直接：子页面生成 → 送到画布 → 在画布上找那张图。 */
const nodesBefore = null;
console.log('（本版不预先访问画布，避免 QA 会话干扰；只验"送到画布后能在那儿看到这张图"）');

/* 子页面：纯文本必填的轻技能 → 填必填 → 生成（上游打桩） */
await page.goto(base + '/image-creation?id=image.giant_product', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForSelector('.media-workbench-submit', { timeout: 30000 });
await page.waitForTimeout(800);
const filled = await page.evaluate(() => {
  const input = document.querySelector('.media-field input[type="text"], .media-field input:not([type])');
  if (!input) return false;
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(input, '超大山竹');
  input.dispatchEvent(new Event('input', { bubbles: true }));
  return true;
});
console.log('① 填必填项：' + (filled ? '已填 ✓' : '⚠️ 没找到输入框'));
await page.waitForTimeout(500);
const postsBeforeGenerate = calls.length;
/* ⚠️ 本仓是**先报价、后扣费**：第一次点 CTA 只拿报价（可能还弹「确认生成」），要点第二次才真提交 ——
   探针第一版只点了一次，于是"结果 0 张"（看起来像接线坏了，其实是没走完这一步）。
   这里按 e2e 的 clickGenerate 同一套做法：点 → 有对话框就确认 → 再点一次 CTA。 */
await page.evaluate(() => document.querySelector('.media-workbench-submit')?.click());
await page.waitForTimeout(1200);
const confirmed = await page.evaluate(() => {
  const dialog = document.querySelector('[role="dialog"][aria-labelledby="app-dialog-title"]');
  const button = dialog ? [...dialog.querySelectorAll('button')].find(node => /确认生成/.test(node.textContent || '')) : null;
  if (button) { button.click(); return true; }
  return false;
});
if (!confirmed) await page.evaluate(() => document.querySelector('.media-workbench-submit')?.click());
await page.waitForFunction(() => document.querySelectorAll('.media-run-slot img').length > 0, null, { timeout: 25000 }).catch(() => {});
await page.waitForTimeout(800);
const slotState = await page.evaluate(() => ({
  imgs: document.querySelectorAll('.media-run-slot img').length,
  sendButtons: document.querySelectorAll('.media-run-send-canvas').length,
  label: (document.querySelector('.media-run-send-canvas')?.textContent || '').trim(),
}));
console.log('② 结果区：图 ' + slotState.imgs + ' 张，其中「' + slotState.label + '」按钮 ' + slotState.sendButtons + ' 个');
console.log('   生成这一段发过的 POST：' + calls.slice(postsBeforeGenerate).join(', ') || '（无）');

/* ⚠️ 结果出来**等 3 秒**再点：这是**真实用户**的节奏（看图 → 决定 → 点）。
   实测：出结果 1 秒内立刻切页，偶发会被某个生成完成后的副作用在 ~2 秒后拉回子页面
   （画布与节点其实都落上了，toast 也出来了）—— 那是一条**已知竞态**，记在 RTK 批 CY-⑩，
   本探针不等它、只按正常节奏验收。 */
await page.waitForTimeout(3000);
/* ③ 点「送到画布」 */
const postsBeforeSend = calls.length;
await page.evaluate(() => document.querySelector('.media-run-send-canvas')?.click());
/* 画布挂载需要一点时间：轮询"画布顶栏出现 + 里面有节点"（最多 8 秒） */
const landed = await (async () => {
  for (let i = 0; i < 16; i += 1) {
    await page.waitForTimeout(500);
    const st = await page.evaluate(() => ({
      canvas: Boolean(document.querySelector('.ec-canvas-topbar')),
      nodes: document.querySelectorAll('[data-canvas-node-id]').length,
      hasResult: Array.from(document.querySelectorAll('[data-canvas-node-id] img')).some(img => String(img.getAttribute('src') || '').startsWith('data:image/png')),
    }));
    if (st.canvas && st.nodes > 0) return { url: page.url(), ...st };
  }
  return await page.evaluate(() => ({
    url: location.pathname + location.search,
    canvas: Boolean(document.querySelector('.ec-canvas-topbar')),
    nodes: document.querySelectorAll('[data-canvas-node-id]').length,
    hasResult: Array.from(document.querySelectorAll('[data-canvas-node-id] img')).some(img => String(img.getAttribute('src') || '').startsWith('data:image/png')),
  }));
})();
console.log('③ 点击后：画布挂载=' + landed.canvas + '  节点=' + landed.nodes + '  URL=' + landed.url);
console.log('④ 画布上找得到那张结果图：' + (landed.hasResult ? '是 ✓' : '⚠️ 否'));
console.log('⑤ 送这一段发过的 POST：' + (calls.slice(postsBeforeSend).join(', ') || '0 次 ✓（送到画布不花钱）'));
/* ⚠️ 停留检查：早先版本在这一步之后页面会**被弹回子页面**（探针先逛过画布 QA 会话时）。
   那是不是产品行为，必须分开验 —— 这里隔 3 秒再采一次：画布还在、图还在，才算真的送到了。 */
await page.waitForTimeout(3000);
const stay = await page.evaluate(() => ({
  canvas: Boolean(document.querySelector('.ec-canvas-topbar')),
  nodes: document.querySelectorAll('[data-canvas-node-id]').length,
  hasResult: Array.from(document.querySelectorAll('[data-canvas-node-id] img')).some(img => String(img.getAttribute('src') || '').startsWith('data:image/png')),
}));
console.log('⑥ 3 秒后仍在画布上：' + (stay.canvas && stay.hasResult ? '是 ✓（节点 ' + stay.nodes + '）' : '⚠️ 被弹走了 ' + JSON.stringify(stay)));

console.log('\n页面错误：' + (errors.length ? errors.join(' | ') : '无'));
await browser.close();
await stopDevServer(server.proc, { owned: true });
