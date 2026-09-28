/* ═══ 批 CY-⑦ 探针：左栏/右栏的**内缩与滚动条槽**到底还剩多少不齐（把 RTK 那条待办量实）═══════════
   背景（RTK 待办）：批 CH 的取舍 —— `scrollbar-gutter: stable` 只保右沟，代价是"右边比左边多 11px"；
   注释里写着"真正的对称要把内边距从滚动容器挪到内层包裹元素（结构性改动）"。
   本探针要回答三件事，答案决定**要不要动结构**：
     ① 左右内缩各是多少（内容边缘 vs 栏边缘）—— 差的是不是就是那条滚动条？
     ② 有没有"**空槽**"：容器不滚（scrollHeight ≤ clientHeight）却仍然占着一条滚动条槽（= 用户会看到一条空的假轨道）；
     ③ 右栏是不是也有同样的槽。
   另外顺带量：那颗大按钮加了 min-width: 180 之后的实际宽度（今天应仍为内容宽 188）。
   用法：node .qa/cy7-insets-and-scrollbars.mjs
   ─────────────────────────────────────────────────────────────────────────────────────────── */
import { chromium } from 'playwright';
import { startDevServer, stopDevServer } from '../test/helpers/live-browser.mjs';

const server = await startDevServer();
if (!server.ok) { console.log('dev server 起不来：' + server.reason); process.exit(1); }
const base = server.base.replace(/\/$/, '');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on('pageerror', e => errors.push('PAGEERR ' + String(e.message).slice(0, 140)));

await page.route('**/api/**', route => {
  const path = new URL(route.request().url()).pathname;
  const json = b => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(b) });
  if (path === '/api/session') return json({ ok: true, email: 'p@e.com' });
  if (path === '/api/works') return json({ works: [] });
  if (path === '/api/video/capabilities') return json({ loading: false, generationEnabled: true, workbenchEnabled: false, directorUi: false, uploadMode: 'tus', products: [] });
  if (/skills/.test(path)) return json({ ok: true, builtin: [], mine: [], groups: [] });
  return json({ ok: true, items: [], draft: null, templates: [] });
});
await page.addInitScript(() => {
  const future = new Date(Date.now() + 3600 * 1000).toISOString();
  localStorage.setItem('sb-auth', JSON.stringify({ id: 'p@e.com', email: 'p@e.com', nickname: 'P', token: 't', expiresAt: future }));
});

const MEASURE = `(() => {
  const R = el => { const r = el.getBoundingClientRect(); return { x: Math.round(r.x), w: Math.round(r.width), right: Math.round(r.right) }; };
  const readCol = sel => {
    const el = document.querySelector(sel);
    if (!el) return { missing: sel };
    const cs = getComputedStyle(el);
    const bar = el.offsetWidth - el.clientWidth;                 /* 滚动条占的宽度（含预留槽） */
    const scrolling = el.scrollHeight > el.clientHeight + 1;
    const r = el.getBoundingClientRect();
    const padL = parseFloat(cs.paddingLeft), padR = parseFloat(cs.paddingRight);
    /* 内容盒（不含内边距）与"最靠边的可见内容" */
    const contentLeft = r.left + padL, contentRight = r.right - padR - bar;
    const kids = Array.from(el.querySelectorAll('.media-field, .media-workbench-group, .media-workbench-panel, .media-workbench-cta'))
      .map(k => k.getBoundingClientRect()).filter(b => b.width > 20);
    const minLeft = kids.length ? Math.round(Math.min(...kids.map(b => b.left))) : null;
    const maxRight = kids.length ? Math.round(Math.max(...kids.map(b => b.right))) : null;
    return {
      栏: sel, box: { x: Math.round(r.x), w: Math.round(r.width), right: Math.round(r.right) },
      内边距: cs.paddingLeft + ' / ' + cs.paddingRight,
      滚动条占宽: bar, 是否可滚: scrolling, 滚动条可见: bar > 0 && scrolling,
      scrollHeight: el.scrollHeight, clientHeight: el.clientHeight,
      内容盒: { left: Math.round(contentLeft), right: Math.round(contentRight) },
      内容实际: { minLeft, maxRight },
      左内缩: minLeft == null ? null : Math.round(minLeft - r.left),
      右内缩: maxRight == null ? null : Math.round(r.right - maxRight),
      gutter: cs.scrollbarGutter || '(未设)',
    };
  };
  const big = document.querySelector('.media-workbench-field-action button');
  const br = big ? big.getBoundingClientRect() : null;
  return {
    左栏: readCol('.media-workbench-left'),
    右栏: readCol('.media-workbench-right'),
    大按钮: br ? { w: Math.round(br.width), h: Math.round(br.height), minW: getComputedStyle(big).minWidth } : null,
  };
})()`;

for (const [label, url] of [
  ['商品套图（字段多、左栏一定滚）', '/image-creation?id=image.product_suite'],
  ['中文海报（字段少）', '/image-creation?id=image.poster'],
]) {
  console.log('\n══════ ' + label + ' ══════');
  await page.goto(base + url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(2200);
  const m = await page.evaluate(MEASURE);
  for (const key of ['左栏', '右栏']) {
    const c = m[key];
    if (c.missing) { console.log('  ' + key + '：没有这个栏（' + c.missing + '）'); continue; }
    console.log('  ' + key + '  box=' + JSON.stringify(c.box) + '  内边距=' + c.内边距 + '  gutter=' + c.gutter);
    console.log('      滚动条占宽=' + c.滚动条占宽 + 'px  可滚=' + c.是否可滚 + '  滚动条可见=' + c.滚动条可见 +
      '  (scrollH ' + c.scrollHeight + ' / clientH ' + c.clientHeight + ')');
    console.log('      内容盒 ' + JSON.stringify(c.内容盒) + '  内容实际 ' + JSON.stringify(c.内容实际));
    console.log('      **左内缩 ' + c.左内缩 + 'px / 右内缩 ' + c.右内缩 + 'px**  差=' + (c.左内缩 != null && c.右内缩 != null ? (c.右内缩 - c.左内缩) : '?') + 'px');
    if (c.滚动条占宽 > 0 && !c.是否可滚) console.log('      ⚠️ 空槽：不滚却占着 ' + c.滚动条占宽 + 'px —— 用户会看到一条"拉了没意义"的空轨道');
  }
  if (m.大按钮) console.log('  大按钮 w=' + m.大按钮.w + ' h=' + m.大按钮.h + ' minWidth=' + m.大按钮.minW);
}

console.log('\n页面错误：' + (errors.length ? errors.join(' | ') : '无'));
await browser.close();
await stopDevServer(server.proc, { owned: true });
