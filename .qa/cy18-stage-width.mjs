/* ═══ 批 CY-⑱ 探针：**画布真实显示区为什么这么小** ══════════════════════════════════════════════════════
   用户原话（逐字）：「然后画布的真实显示区域也特别的小，基本上其他地方都会被遮挡，
     不知道是什么原因造成的，你优先去解决这两个问题先。」

   截图里的现象：网点背景（画布 stage）只占屏幕左边一小条，右边是大片纯灰 —— 也就是
   **stage 之外还有别的东西**，而 stage 自己被压窄了。

   本探针量四件事（每件都给"是谁占的"的证据，不猜）：
     ① viewport 宽；
     ② .ec-canvas-page / .ec-canvas-workbench / .ec-canvas-stage 各自**布局宽**与**屏幕宽**；
     ③ 谁在压 stage：逐层看 clientWidth 与 offsetWidth，以及右栏的 margin-right 预留；
     ④ 右栏开 / 关 两种状态下各量一次（怀疑与右栏让位有关）。

   画布有缩放层，所以**布局值一律用 offsetWidth/clientWidth**，
   屏幕值用 getBoundingClientRect —— 两套不混算（这一批之前栽在这上面两次）。
   ═══════════════════════════════════════════════════════════════════════════════════════ */
import { chromium } from 'playwright';
import { startDevServer, stopDevServer } from '../test/helpers/live-browser.mjs';

const VIEWPORTS = [
  { width: 1920, height: 1080 },
  { width: 1440, height: 900 },
  { width: 1280, height: 800 },
  /* ↓ 这两档才是用户截图那个窗口的量级（<1000px）—— 修之前画布被压到不足 550px */
  { width: 1024, height: 768 },
  { width: 900, height: 700 },
];

const server = await startDevServer();
if (!server.ok) { console.log('dev server 起不来：' + server.reason); process.exit(1); }
const base = server.base.replace(/\/$/, '');
const browser = await chromium.launch();

for (const vp of VIEWPORTS) {
  const page = await browser.newPage({ viewport: vp });
  page.on('pageerror', e => console.log('PAGEERR ' + String(e.message).slice(0, 160)));
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    const json = body => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    if (path === '/api/session') return json({ ok: true, email: 'p@e.com' });
    if (path === '/api/works') return json({ works: [] });
    if (path === '/api/video/capabilities') return json({ ok: true, items: [], draft: null });
    return json({ ok: true, items: [], draft: null });
  });
  await page.goto(base + '/ec-canvas?qa=ec-canvas', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(4000);

  const measure = () => page.evaluate(() => {
    const pick = sel => {
      const el = document.querySelector(sel);
      if (!el) return { sel, missing: true };
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return {
        sel,
        layoutW: el.offsetWidth,
        clientW: el.clientWidth,
        screenW: Math.round(r.width),
        marginRight: cs.marginRight,
        paddingRight: cs.paddingRight,
        flex: cs.flex,
        maxWidth: cs.maxWidth,
        overflowX: cs.overflowX,
        position: cs.position,
      };
    };
    const layers = [
      '.ec-canvas-page',
      '.ec-canvas-workbench',
      '.ec-canvas-stage',
      '.ec-canvas-right-panel',
      '.ec-canvas-left-rail',
    ].map(pick);
    const pageEl = document.querySelector('.ec-canvas-page');
    return {
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      reserveVar: pageEl ? getComputedStyle(pageEl).getPropertyValue('--canvas-right-panel-width').trim() : '',
      hasRightPanel: Boolean(document.querySelector('.ec-canvas-right-panel')),
      stage: layers.find(l => l.sel === '.ec-canvas-stage'),
      layers,
    };
  });

  const before = await measure();
  console.log(`\n════ viewport ${vp.width}×${vp.height} ════`);
  console.log(`  innerWidth=${before.innerWidth}  --canvas-right-panel-width=${before.reserveVar}  右栏存在=${before.hasRightPanel}`);
  for (const l of before.layers) {
    if (l.missing) { console.log(`  ${l.sel.padEnd(28)} (不存在)`); continue; }
    console.log(`  ${l.sel.padEnd(28)} 布局 ${String(l.layoutW).padStart(5)} | 屏幕 ${String(l.screenW).padStart(5)} | marginRight ${l.marginRight} | flex ${l.flex} | overflowX ${l.overflowX}`);
  }
  const stage = before.stage;
  if (stage && !stage.missing) {
    const ratio = stage.screenW / before.innerWidth;
    console.log(`  ⇒ stage 占视口 ${(ratio * 100).toFixed(0)}%` + (ratio < 0.75 ? '   ← 就是它！' : ''));
  }

  /* 开右栏再量一次 */
  const opened = await page.evaluate(() => {
    const node = document.querySelector('[data-canvas-node-id]');
    node?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1, button: 0, clientX: 40, clientY: 40 }));
    return true;
  });
  if (opened) {
    await page.waitForTimeout(1200);
    const after = await measure();
    console.log(`  ── 选中一个节点后（右栏开）──`);
    for (const l of after.layers) {
      if (l.missing) continue;
      console.log(`  ${l.sel.padEnd(28)} 布局 ${String(l.layoutW).padStart(5)} | 屏幕 ${String(l.screenW).padStart(5)} | marginRight ${l.marginRight}`);
    }
    const s2 = after.stage;
    if (s2 && !s2.missing) {
      const ratio = s2.screenW / after.innerWidth;
      console.log(`  ⇒ 开右栏后 stage 占视口 ${(ratio * 100).toFixed(0)}%` + (ratio < 0.75 ? '   ← 右栏把 stage 压窄了' : ''));
    }
  }
  await page.close();
}

await browser.close();
await stopDevServer();
console.log('\n盘点结束（未改任何代码）。');
