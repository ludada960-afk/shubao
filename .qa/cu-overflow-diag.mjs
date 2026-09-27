/* 批 CU 续：图片/文案/视频三个框的底栏（或控件行）为什么还在溢出 —— 逐项 dump computed + rect */
import { chromium } from 'playwright';
import { startDevServer, stopDevServer } from '../test/helpers/live-browser.mjs';

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

const openAdd = async () => { await page.click('.ec-canvas-left-rail button, .ec-canvas-left-rail [role="button"]').catch(() => {}); await page.waitForTimeout(600); };
const addNode = async match => {
  await openAdd();
  const ok = await page.evaluate(match => {
    const b = Array.from(document.querySelectorAll('.ec-canvas-add-menu button, [class*="add-menu"] button')).find(x => (x.textContent || '').includes(match));
    if (!b) return false; b.click(); return true;
  }, match);
  await page.waitForTimeout(2400);
  return ok;
};

const dump = async (label, width, sel) => {
  const out = await page.evaluate(([width, sel]) => {
    const host = document.querySelector('.ec-canvas-node-composer, .ec-canvas-context-composer');
    if (!host) return { err: 'no host' };
    host.style.width = width + 'px'; host.style.maxWidth = width + 'px';
    const row = host.querySelector(sel);
    if (!row) return { err: 'no row ' + sel, hostCls: String(host.className).slice(0, 80) };
    const rr = row.getBoundingClientRect();
    const cs = getComputedStyle(row);
    const kids = Array.from(row.children).map(k => {
      const r = k.getBoundingClientRect(); const kcs = getComputedStyle(k);
      return {
        cls: String(k.className).split(' ').slice(0, 2).join('.').slice(0, 34) || k.tagName.toLowerCase(),
        left: Math.round(r.left), right: Math.round(r.right), w: Math.round(r.width),
        flex: kcs.flex, minW: kcs.minWidth, pos: kcs.position,
        over: Math.round(r.right - rr.right),
      };
    });
    return {
      hostW: Math.round(host.getBoundingClientRect().width),
      row: { cls: String(row.className).slice(0, 60), w: Math.round(rr.width), flexWrap: cs.flexWrap, overflow: cs.overflow, scrollW: row.scrollWidth, clientW: row.clientWidth },
      kids,
    };
  }, [width, sel]);
  console.log('\n### ' + label + ' @w=' + width + (out.err ? ' → ' + out.err + ' host=' + out.hostCls : ''));
  if (out.err) return;
  console.log('  行 ' + out.row.cls + ' w=' + out.row.w + ' flexWrap=' + out.row.flexWrap + ' overflow=' + out.row.overflow + ' scrollW=' + out.row.scrollW + ' clientW=' + out.row.clientW);
  for (const k of out.kids) console.log('   ▸ ' + k.cls.padEnd(36) + ' ' + k.left + '..' + k.right + ' w=' + k.w + ' flex=' + k.flex + ' minW=' + k.minW + (k.over > 0 ? '  ⚠️溢 ' + k.over : ''));
};

await addNode('生成图片');
await dump('图片生成', 320, '.ec-canvas-composer-footer');
await addNode('生成文案');
await dump('生成文案', 320, '.ec-canvas-composer-footer');
await addNode('生成视频');
await dump('生成视频', 320, '.ec-canvas-video-controls');
await dump('生成视频', 320, '.ec-canvas-composer-footer');
await browser.close();
stopDevServer(server.proc, { owned: server.owned });
