/* 批 CU：量「生成框（虚线框）」与「创作台面板」的宽度关系 —— 用户圈的是"面板比框还宽" */
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

const dump = async label => {
  const out = await page.evaluate(() => {
    const R = el => { const r = el.getBoundingClientRect(); return { l: Math.round(r.left), r: Math.round(r.right), w: Math.round(r.width), t: Math.round(r.top), b: Math.round(r.bottom) }; };
    const frames = Array.from(document.querySelectorAll('[data-canvas-node-id]')).map(el => ({ id: el.getAttribute('data-canvas-node-id'), kind: String(el.className).match(/is-([a-z-]+)/)?.[1] || '', box: R(el) }));
    const composer = document.querySelector('.ec-canvas-node-composer');
    const stage = document.querySelector('.ec-canvas-stage');
    return {
      stage: stage ? R(stage) : null,
      frames: frames.filter(f => /composer/.test(f.id) || /composer/.test(f.kind)),
      allFramesCount: frames.length,
      composer: composer ? R(composer) : null,
      composerCls: composer ? String(composer.className).slice(0, 60) : null,
    };
  });
  console.log('\n### ' + label + '\n' + JSON.stringify(out, null, 1));
  return out;
};
const m = await dump('套图框 vs 创作台面板');
if (m.composer && m.frames.length) {
  const f = m.frames[0].box;
  console.log('\n结论：框 ' + f.l + '..' + f.r + '（w=' + f.w + '）  面板 ' + m.composer.l + '..' + m.composer.r + '（w=' + m.composer.w + '）'
    + '  ⇒ 面板比框宽 ' + (m.composer.w - f.w) + 'px，右侧超出 ' + (m.composer.r - f.r) + 'px');
}
await browser.close();
stopDevServer(server.proc, { owned: server.owned });
